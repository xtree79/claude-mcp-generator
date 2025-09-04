#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');

const projectTypes = require('../templates/project-types');
const ClaudeSettingsGenerator = require('./generators/claude-settings');
const McpServerGenerator = require('./generators/mcp-server');
const WorkspaceScanner = require('./utils/workspace-scanner');
const PermissionManager = require('./utils/permission-manager');
const HooksManager = require('./utils/hooks-manager');
const WorkspaceDetector = require('./utils/workspace-detector');
const RepositoryManager = require('./utils/repository-manager');

const program = new Command();

program
  .name('claude-gen')
  .description('Generate Claude Code MCP configurations for different project types')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize Claude MCP configuration for current project')
  .option('-t, --type <type>', 'Project type (nodejs, react, nextjs, python, dotnet, rust, go)')
  .option('-d, --directory <dir>', 'Target directory', process.cwd())
  .option('--auto-detect', 'Auto-detect project type')
  .option('--dry-run', 'Show what would be generated without creating files')
  .action(async (options) => {
    try {
      await initCommand(options);
    } catch (error) {
      console.error(chalk.red('Error during initialization:'), error.message);
      process.exit(1);
    }
  });

program
  .command('scan')
  .description('Scan directory and analyze workspace')
  .option('-d, --directory <dir>', 'Target directory', process.cwd())
  .action(async (options) => {
    try {
      await scanCommand(options);
    } catch (error) {
      console.error(chalk.red('Error during scan:'), error.message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate existing Claude configuration')
  .option('-d, --directory <dir>', 'Target directory', process.cwd())
  .action(async (options) => {
    try {
      await validateCommand(options);
    } catch (error) {
      console.error(chalk.red('Error during validation:'), error.message);
      process.exit(1);
    }
  });

async function initCommand(options) {
  const targetDir = path.resolve(options.directory);
  
  console.log(chalk.blue('🚀 Claude MCP Generator'));
  console.log(chalk.gray(`Target directory: ${targetDir}`));
  console.log();

  // Check if directory exists
  if (!await fs.pathExists(targetDir)) {
    console.error(chalk.red(`Directory does not exist: ${targetDir}`));
    process.exit(1);
  }

  let projectType = options.type;
  
  // Auto-detect project type if requested or not specified
  if (options.autoDetect || !projectType) {
    console.log(chalk.yellow('🔍 Detecting project type...'));
    const scanner = new WorkspaceScanner();
    const detectedTypes = await scanner.detectProjectType(targetDir);
    
    if (detectedTypes && detectedTypes.length > 0) {
      console.log(chalk.green('✅ Project types detected:'));
      detectedTypes.forEach(type => {
        console.log(`  - ${chalk.cyan(type.type)} (${Math.round(type.confidence * 100)}% confidence)`);
      });
      
      if (!projectType) {
        const answer = await inquirer.prompt([{
          type: 'list',
          name: 'selectedType',
          message: 'Select project type:',
          choices: [
            ...detectedTypes.map(type => ({
              name: `${projectTypes[type.type]?.name || type.type} (detected)`,
              value: type.type
            })),
            new inquirer.Separator(),
            ...Object.keys(projectTypes).filter(type => 
              !detectedTypes.some(d => d.type === type)
            ).map(type => ({
              name: projectTypes[type].name,
              value: type
            }))
          ]
        }]);
        projectType = answer.selectedType;
      }
    } else {
      console.log(chalk.yellow('⚠️  Could not auto-detect project type'));
      
      if (!projectType) {
        const answer = await inquirer.prompt([{
          type: 'list',
          name: 'selectedType',
          message: 'Select project type:',
          choices: Object.keys(projectTypes).map(type => ({
            name: projectTypes[type].name,
            value: type
          }))
        }]);
        projectType = answer.selectedType;
      }
    }
  }

  if (!projectTypes[projectType]) {
    console.error(chalk.red(`Unknown project type: ${projectType}`));
    console.log(chalk.gray('Available types:'), Object.keys(projectTypes).join(', '));
    process.exit(1);
  }

  const config = projectTypes[projectType];
  console.log(chalk.green(`✅ Using project type: ${chalk.cyan(config.name)}`));
  console.log();

  // Detect workspace type and structure
  console.log(chalk.yellow('🔍 Detecting workspace structure...'));
  const workspaceDetector = new WorkspaceDetector();
  const workspaceDetection = await workspaceDetector.detectWorkspace(targetDir);

  // Display workspace detection results
  if (workspaceDetection.isWorkspace) {
    console.log(chalk.green(`📦 Found ${chalk.cyan(workspaceDetection.workspaceType)}`));
    console.log(chalk.blue(`🏗️  Structure: ${workspaceDetection.structure}`));
    console.log(chalk.blue(`📁 Projects found: ${chalk.cyan(workspaceDetection.projects.length)}`));
    
    workspaceDetection.projects.forEach(project => {
      console.log(`  ${chalk.cyan(project.name)} (${project.type}) - ${project.fileCount} files - ${Math.round(project.confidence)}% confidence`);
    });
  } else if (workspaceDetection.projects.length > 1) {
    console.log(chalk.yellow(`🔍 Multiple projects detected (${workspaceDetection.projects.length}) but no workspace configuration`));
    workspaceDetection.projects.forEach(project => {
      console.log(`  ${chalk.cyan(project.name)} (${project.type}) - ${project.fileCount} files`);
    });
  } else {
    console.log(chalk.blue('📝 Single project detected'));
  }

  // Scan workspace files  
  console.log(chalk.yellow('🔍 Scanning workspace files...'));
  const scanner = new WorkspaceScanner();
  const workspaceAnalysis = await scanner.analyzeWorkspace(targetDir);
  
  console.log(chalk.blue('📁 Found files:'));
  console.log(`  Total: ${chalk.cyan(workspaceAnalysis.totalFiles)} files`);
  console.log(`  Size: ${chalk.cyan(scanner.formatFileSize(workspaceAnalysis.totalSize))}`);
  
  const topFileTypes = Object.entries(workspaceAnalysis.filesByType)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);
    
  topFileTypes.forEach(([ext, data]) => {
    console.log(`  ${chalk.cyan(ext || '(no ext)')}: ${data.count} files`);
  });

  // Check if project is small/simple enough to not need workspace patterns
  const isSmallProject = workspaceAnalysis.totalFiles <= 20;
  const hasSimpleStructure = !workspaceAnalysis.files.some(f => f.relativePath.includes('/') || f.relativePath.includes('\\'));
  
  if (isSmallProject && hasSimpleStructure) {
    console.log(chalk.yellow('💡 This appears to be a small, single-directory project'));
  }
  
  console.log();

  // Interactive configuration
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: path.basename(targetDir)
    },
    {
      type: 'list',
      name: 'workspaceFilesOption',
      message: 'How would you like to configure workspace files?',
      choices: [
        { 
          name: `Use recommended patterns for this project type (${config.workspaceFiles.length} patterns)`, 
          value: 'recommended' 
        },
        { 
          name: `Use all scanned files from this directory (${workspaceAnalysis.totalFiles} files)`, 
          value: 'scanned' 
        },
        { 
          name: 'Customize patterns manually', 
          value: 'custom' 
        },
        { 
          name: 'Skip workspace files (Claude won\'t access project files directly)', 
          value: 'none' 
        }
      ],
      default: isSmallProject && hasSimpleStructure ? 'scanned' : 'recommended'
    },
    {
      type: 'confirm',
      name: 'includePermissions',
      message: 'Configure directory permissions?',
      default: true
    },
    {
      type: 'confirm',
      name: 'generateMcpServer',
      message: 'Generate MCP server file?',
      default: true
    },
    {
      type: 'checkbox',
      name: 'additionalCommands',
      message: 'Select additional commands to include:',
      choices: Object.keys(config.commands).map(cmd => ({
        name: `${cmd}: ${config.commands[cmd]}`,
        value: cmd,
        checked: true
      }))
    }
  ]);

  // Ask about hooks configuration
  let hooksAnswers = {};
  const shouldConfigureHooks = await inquirer.prompt([{
    type: 'confirm',
    name: 'configureHooks',
    message: 'Configure Claude Code hooks (startup actions, file events)?',
    default: true
  }]);

  if (shouldConfigureHooks.configureHooks) {
    const hooksManager = new HooksManager();
    const hookChoices = hooksManager.getHookChoices(projectType);
    
    hooksAnswers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedHooks',
        message: 'Select hooks to enable:',
        choices: hookChoices,
        pageSize: 15
      },
      {
        type: 'confirm',
        name: 'addCustomHook',
        message: 'Add a custom hook?',
        default: false,
        when: (answers) => answers.selectedHooks.length > 0
      }
    ]);

    // Handle custom hooks
    if (hooksAnswers.addCustomHook) {
      const customHook = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Custom hook name:',
          validate: (input) => input.length > 0 || 'Hook name is required'
        },
        {
          type: 'list',
          name: 'event',
          message: 'When should this hook run?',
          choices: [
            { name: 'When project opens', value: 'on_project_open' },
            { name: 'After file edit', value: 'after_file_edit' },
            { name: 'When project closes', value: 'on_project_close' },
            { name: 'Before tool execution', value: 'before_tool_execution' }
          ]
        },
        {
          type: 'input',
          name: 'command',
          message: 'Command to execute:',
          validate: (input) => input.length > 0 || 'Command is required'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Description (optional):'
        }
      ]);

      hooksAnswers.customHooks = [customHook];
    }
  }

  // Handle workspace files configuration (workspace-aware)
  let workspaceFiles = [];
  let includeWorkspaceFiles = false;

  if (answers.workspaceFilesOption === 'recommended') {
    if (workspaceDetection.isWorkspace || workspaceDetection.projects.length > 1) {
      // Generate multi-project workspace patterns
      workspaceFiles = [];
      workspaceDetection.projects.forEach(project => {
        const projectConfig = projectTypes[project.type] || config;
        projectConfig.workspaceFiles.forEach(pattern => {
          if (project.path === '.') {
            workspaceFiles.push(pattern);
          } else {
            workspaceFiles.push(`${project.path}/${pattern}`);
          }
        });
      });
      
      // Add workspace-level files
      workspaceFiles.push('*.md', '*.json', '*.yaml', '*.yml');
      
      // Remove duplicates
      workspaceFiles = [...new Set(workspaceFiles)];
    } else {
      // Single project - use standard patterns
      workspaceFiles = config.workspaceFiles;
    }
    
    includeWorkspaceFiles = true;
    console.log(chalk.blue(`📋 Using ${workspaceFiles.length} workspace patterns:`));
    workspaceFiles.forEach(pattern => console.log(`  ${chalk.gray(pattern)}`));
    
  } else if (answers.workspaceFilesOption === 'scanned') {
    workspaceFiles = workspaceAnalysis.files.map(f => f.relativePath);
    includeWorkspaceFiles = true;
    console.log(chalk.blue(`📋 Using ${workspaceFiles.length} scanned files from directory`));
  } else if (answers.workspaceFilesOption === 'custom') {
    const defaultPatterns = workspaceDetection.isWorkspace 
      ? ['*/src/**/*', '*/package.json', '*.md', '*.json']
      : config.workspaceFiles;
      
    const customPatterns = await inquirer.prompt([{
      type: 'input',
      name: 'patterns',
      message: 'Enter workspace file patterns (comma-separated):',
      default: defaultPatterns.join(', '),
      filter: (input) => input.split(',').map(s => s.trim()).filter(s => s.length > 0)
    }]);
    workspaceFiles = customPatterns.patterns;
    includeWorkspaceFiles = true;
    console.log(chalk.blue('📋 Using custom workspace patterns:'));
    workspaceFiles.forEach(pattern => console.log(`  ${chalk.gray(pattern)}`));
  } else {
    includeWorkspaceFiles = false;
    console.log(chalk.gray('⏭️  Skipping workspace files'));
  }
  console.log();

  // Repository configuration for each project
  console.log(chalk.blue('🔧 Configuring repositories...'));
  const repositoryManager = new RepositoryManager();
  const projectRepositories = new Map();

  // Configure repositories for each detected project
  for (const project of workspaceDetection.projects) {
    console.log(chalk.yellow(`\n📁 Configuring repository for: ${chalk.cyan(project.name)} (${project.type})`));
    
    // Analyze existing Git remotes
    const existingRepo = await repositoryManager.analyzeExistingRepositories(project.absolutePath);
    
    if (existingRepo.hasGit && existingRepo.remotes.length > 0) {
      console.log(chalk.blue('  Existing remotes found:'));
      existingRepo.remotes.forEach(remote => {
        console.log(`    ${chalk.cyan(remote.name)}: ${remote.url}`);
      });
    }

    // Ask about repository configuration
    const shouldConfigureRepo = await inquirer.prompt([{
      type: 'confirm',
      name: 'configure',
      message: `Configure repository settings for ${project.name}?`,
      default: !existingRepo.hasGit || existingRepo.remotes.length === 0
    }]);

    if (shouldConfigureRepo.configure) {
      const repoChoices = repositoryManager.generateRepositoryChoices(existingRepo.remotes);
      
      const repoSelection = await inquirer.prompt([{
        type: 'checkbox',
        name: 'repositories',
        message: `Select repository configurations for ${project.name}:`,
        choices: repoChoices,
        pageSize: 12
      }]);

      const projectRepos = [];
      
      // Handle each selected repository
      for (const selection of repoSelection.repositories) {
        if (selection.action === 'add') {
          const detailPrompts = await repositoryManager.promptForRepositoryDetails(selection.type, project.name);
          const repoDetails = await inquirer.prompt(detailPrompts);
          
          const repoUrl = repositoryManager.generateRepositoryUrl(selection.type, repoDetails);
          const webUrl = repositoryManager.generateWebUrl(selection.type, repoDetails);
          
          projectRepos.push({
            action: 'add',
            name: repoDetails.name,
            type: selection.type,
            url: repoUrl,
            webUrl,
            visibility: repoDetails.visibility,
            details: repoDetails
          });
          
          const visibilityIcon = repoDetails.visibility === 'private' ? '🔒' : 
                                  repoDetails.visibility === 'public' ? '🌍' : 
                                  repoDetails.visibility === 'internal' ? '🏢' : '❓';
          
          console.log(chalk.green(`  ✅ Added ${repoDetails.name}: ${repoUrl}`));
          console.log(chalk.gray(`     ${visibilityIcon} ${repoDetails.visibility.charAt(0).toUpperCase() + repoDetails.visibility.slice(1)} repository`));
          if (webUrl) {
            console.log(chalk.gray(`     🌐 Web: ${webUrl}`));
          }
        } else if (selection.action === 'keep') {
          projectRepos.push({
            action: 'keep',
            ...selection.remote
          });
        }
      }
      
      if (projectRepos.length > 0) {
        projectRepositories.set(project.name, projectRepos);
      }
    }
  }

  if (options.dryRun) {
    console.log(chalk.yellow('🔍 Dry run mode - showing what would be generated:'));
    console.log();
  }

  // Generate Claude settings
  console.log(chalk.blue('📝 Generating Claude settings...'));
  const settingsGenerator = new ClaudeSettingsGenerator();
  
  // Generate hooks configuration
  let hooksConfig = {};
  if (shouldConfigureHooks.configureHooks && hooksAnswers.selectedHooks) {
    const hooksManager = new HooksManager();
    hooksConfig = hooksManager.generateHooksConfig(
      hooksAnswers.selectedHooks,
      hooksAnswers.customHooks || []
    );
  }

  const settingsOptions = {
    projectName: answers.projectName,
    includeWorkspaceFiles,
    workspaceFiles: workspaceFiles,
    includePermissions: answers.includePermissions,
    customCommands: answers.additionalCommands.reduce((acc, cmd) => {
      acc[cmd] = config.commands[cmd];
      return acc;
    }, {}),
    hooksConfig,
    workspaceDetection,
    repositoryConfig: projectRepositories
  };

  const settingsData = await settingsGenerator.generateSettings(config, targetDir, settingsOptions);
  
  if (!options.dryRun) {
    const settingsPath = await settingsGenerator.writeSettings(settingsData, targetDir);
    console.log(chalk.green(`✅ Claude settings written to: ${chalk.cyan(path.relative(process.cwd(), settingsPath))}`));
  } else {
    console.log(chalk.gray('Would create: .claude/settings.local.json'));
    console.log(JSON.stringify(settingsData, null, 2));
  }

  // Generate MCP server
  if (answers.generateMcpServer) {
    console.log(chalk.blue('🔧 Generating MCP server...'));
    const mcpGenerator = new McpServerGenerator();
    
    const mcpOptions = {
      projectName: answers.projectName,
      customCommands: settingsOptions.customCommands
    };

    const mcpData = await mcpGenerator.generateMcpServer(projectType, config, targetDir, mcpOptions);
    
    if (!options.dryRun) {
      const serverPath = await mcpGenerator.writeMcpServer(mcpData, targetDir);
      console.log(chalk.green(`✅ MCP server written to: ${chalk.cyan(path.relative(process.cwd(), serverPath))}`));
    } else {
      console.log(chalk.gray(`Would create: ${mcpData.filename}`));
      console.log(chalk.gray('Server code preview:'));
      console.log(mcpData.code.slice(0, 200) + '...');
    }
  }

  // Show summary
  console.log();
  console.log(chalk.green('🎉 Generation complete!'));
  
  if (!options.dryRun) {
    console.log(chalk.blue('Next steps:'));
    console.log('1. Review the generated files');
    console.log('2. Install Claude Code if you haven\'t already');
    console.log('3. Open your project in Claude Code');
    console.log('4. The MCP server will be automatically configured');
  }
}

async function scanCommand(options) {
  const targetDir = path.resolve(options.directory);
  
  console.log(chalk.blue('🔍 Scanning workspace...'));
  console.log(chalk.gray(`Directory: ${targetDir}`));
  console.log();

  const scanner = new WorkspaceScanner();
  const analysis = await scanner.analyzeWorkspace(targetDir);

  console.log(chalk.green('📊 Workspace Analysis'));
  console.log(`Project type: ${chalk.cyan(analysis.projectType)}`);
  console.log(`Total files: ${chalk.cyan(analysis.totalFiles)}`);
  console.log(`Total size: ${chalk.cyan(scanner.formatFileSize(analysis.totalSize))}`);
  console.log();

  if (analysis.detectedTypes && analysis.detectedTypes.length > 0) {
    console.log(chalk.blue('🎯 Detected Project Types:'));
    analysis.detectedTypes.forEach(type => {
      console.log(`  ${chalk.cyan(type.type)}: ${Math.round(type.confidence * 100)}% confidence`);
    });
    console.log();
  }

  console.log(chalk.blue('📁 Files by Type:'));
  Object.entries(analysis.filesByType).forEach(([ext, data]) => {
    console.log(`  ${chalk.cyan(ext || '(no extension)')}: ${data.count} files, ${scanner.formatFileSize(data.totalSize)}`);
  });
  console.log();

  console.log(chalk.blue('📋 Recommended Workspace Patterns:'));
  analysis.recommendedPatterns.forEach(pattern => {
    console.log(`  ${chalk.gray(pattern)}`);
  });
}

async function validateCommand(options) {
  const targetDir = path.resolve(options.directory);
  const settingsPath = path.join(targetDir, '.claude', 'settings.local.json');
  
  console.log(chalk.blue('✅ Validating Claude configuration...'));
  console.log(chalk.gray(`Directory: ${targetDir}`));
  console.log();

  // Check if settings file exists
  if (!await fs.pathExists(settingsPath)) {
    console.log(chalk.red('❌ No Claude settings file found'));
    console.log(chalk.gray(`Expected: ${settingsPath}`));
    console.log(chalk.yellow('💡 Run \\`claude-gen init\\` to create configuration'));
    return;
  }

  try {
    const settings = await fs.readJSON(settingsPath);
    console.log(chalk.green('✅ Settings file found and valid JSON'));
    
    // Validate permissions
    if (settings.directoryPermissions) {
      const permissionManager = new PermissionManager();
      const validation = permissionManager.validatePermissions(settings.directoryPermissions);
      
      if (validation.valid) {
        console.log(chalk.green('✅ Directory permissions look good'));
      } else {
        console.log(chalk.yellow('⚠️  Permission issues found:'));
        validation.errors.forEach(error => {
          console.log(chalk.red(`  ❌ ${error}`));
        });
        validation.warnings.forEach(warning => {
          console.log(chalk.yellow(`  ⚠️  ${warning}`));
        });
      }
    }

    // Validate workspace files
    if (settings.workspaceFiles && settings.workspaceFiles.length > 0) {
      const scanner = new WorkspaceScanner();
      const validation = await scanner.validateWorkspacePatterns(targetDir, settings.workspaceFiles);
      
      console.log(chalk.blue('📁 Workspace Files Validation:'));
      validation.forEach(result => {
        if (result.valid && result.matches > 0) {
          console.log(chalk.green(`  ✅ ${result.pattern}: ${result.matches} matches`));
        } else if (result.valid && result.matches === 0) {
          console.log(chalk.yellow(`  ⚠️  ${result.pattern}: no matches`));
        } else {
          console.log(chalk.red(`  ❌ ${result.pattern}: ${result.error}`));
        }
      });
    }

    // Validate MCP servers
    if (settings.mcp && settings.mcp.mcpServers) {
      console.log(chalk.blue('🔧 MCP Servers:'));
      Object.entries(settings.mcp.mcpServers).forEach(([name, config]) => {
        console.log(`  ${chalk.cyan(name)}: ${config.command} ${(config.args || []).join(' ')}`);
      });
    }

  } catch (error) {
    console.log(chalk.red('❌ Error reading settings file:'), error.message);
  }
}

if (require.main === module) {
  program.parse();
}

module.exports = { initCommand, scanCommand, validateCommand };