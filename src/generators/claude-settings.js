const fs = require('fs-extra');
const path = require('path');

class ClaudeSettingsGenerator {
  constructor() {
    this.defaultSettings = {
      'claude_desktop_integration': {
        'enabled': true
      },
      'mcp': {
        'mcpServers': {}
      },
      'tools': {
        'bash': {
          'enabled': true
        },
        'computer_20241022': {
          'enabled': false
        }
      },
      'workspaceFiles': [],
      'directoryPermissions': {
        'allowedReadPaths': [],
        'allowedWritePaths': []
      }
    };
  }

  async generateSettings(projectConfig, targetDir = process.cwd(), options = {}) {
    const {
      projectName = path.basename(targetDir), // eslint-disable-line no-unused-vars
      includeWorkspaceFiles = true,
      workspaceFiles = null,
      includePermissions = true,
      customCommands = {},
      mcpServerConfig = {},
      hooksConfig = {},
      workspaceDetection = null,
      repositoryConfig = null
    } = options;

    // Start with default settings
    const settings = JSON.parse(JSON.stringify(this.defaultSettings));

    // Configure shell based on project type
    if (projectConfig.shell === 'powershell') {
      settings.tools.bash.enabled = false;
      settings.tools.powershell = { enabled: true };
    }

    // Add MCP server configuration
    const serverName = mcpServerConfig.name || projectConfig.mcpServer.name;
    settings.mcp.mcpServers[serverName] = {
      command: mcpServerConfig.command || projectConfig.mcpServer.command,
      args: mcpServerConfig.args || projectConfig.mcpServer.args,
      env: mcpServerConfig.env || {}
    };

    // Add workspace files if enabled
    if (includeWorkspaceFiles) {
      if (workspaceFiles && workspaceFiles.length > 0) {
        // Use custom workspace files provided in options
        settings.workspaceFiles = [...workspaceFiles];
      } else if (projectConfig.workspaceFiles) {
        // Fall back to project config workspace files
        settings.workspaceFiles = [...projectConfig.workspaceFiles];
      }
    }

    // Add directory permissions if enabled (workspace-aware)
    if (includePermissions) {
      const readPaths = new Set();
      const writePaths = new Set();
      
      if (workspaceDetection && (workspaceDetection.isWorkspace || workspaceDetection.projects.length > 1)) {
        // Multi-project workspace permissions
        workspaceDetection.projects.forEach(project => {
          const projectPath = project.path === '.' ? targetDir : path.resolve(targetDir, project.path);
          
          // Add project-specific paths
          if (projectConfig.permissions) {
            projectConfig.permissions.read.forEach(p => {
              readPaths.add(path.resolve(projectPath, p));
            });
            projectConfig.permissions.write.forEach(p => {
              writePaths.add(path.resolve(projectPath, p));
            });
          }
        });
        
        // Add workspace-level paths
        readPaths.add(path.resolve(targetDir, './'));
        writePaths.add(path.resolve(targetDir, './'));
        
      } else if (projectConfig.permissions) {
        // Single project permissions
        projectConfig.permissions.read.forEach(p => {
          readPaths.add(path.resolve(targetDir, p));
        });
        projectConfig.permissions.write.forEach(p => {
          writePaths.add(path.resolve(targetDir, p));
        });
      }
      
      settings.directoryPermissions.allowedReadPaths = Array.from(readPaths);
      settings.directoryPermissions.allowedWritePaths = Array.from(writePaths);
    }

    // Add custom commands as MCP tools
    const allCommands = { ...projectConfig.commands, ...customCommands };
    if (Object.keys(allCommands).length > 0) {
      settings.customCommands = allCommands;
    }

    // Add hooks configuration
    if (Object.keys(hooksConfig).length > 0) {
      settings.hooks = hooksConfig;
    }

    // Add workspace and repository information
    if (workspaceDetection) {
      settings.workspace = {
        type: workspaceDetection.workspaceType,
        structure: workspaceDetection.structure,
        projects: workspaceDetection.projects.map(p => ({
          name: p.name,
          path: p.path,
          type: p.type,
          confidence: Math.round(p.confidence)
        }))
      };
    }

    // Add repository configuration
    if (repositoryConfig && repositoryConfig.size > 0) {
      settings.repositories = {};
      for (const [projectName, repos] of repositoryConfig) {
        settings.repositories[projectName] = repos.map(repo => ({
          name: repo.name,
          type: repo.type,
          url: repo.url,
          webUrl: repo.webUrl || null,
          visibility: repo.visibility || 'unknown',
          action: repo.action
        }));
      }
    }

    return settings;
  }

  async writeSettings(settings, targetDir = process.cwd()) {
    const claudeDir = path.join(targetDir, '.claude');
    const settingsPath = path.join(claudeDir, 'settings.local.json');

    // Ensure .claude directory exists
    await fs.ensureDir(claudeDir);

    // Write settings file
    await fs.writeJSON(settingsPath, settings, { spaces: 2 });

    return settingsPath;
  }

  async generateAndWrite(projectConfig, targetDir = process.cwd(), options = {}) {
    const settings = await this.generateSettings(projectConfig, targetDir, options);
    const settingsPath = await this.writeSettings(settings, targetDir);
    
    return {
      settings,
      path: settingsPath
    };
  }

  // Helper method to update existing settings
  async updateSettings(targetDir, updates) {
    const settingsPath = path.join(targetDir, '.claude', 'settings.local.json');
    
    // Ensure .claude directory exists
    await fs.ensureDir(path.dirname(settingsPath));
    
    let existingSettings = {};
    if (await fs.pathExists(settingsPath)) {
      existingSettings = await fs.readJSON(settingsPath);
    }

    const mergedSettings = this.deepMerge(existingSettings, updates);
    await fs.writeJSON(settingsPath, mergedSettings, { spaces: 2 });
    
    return mergedSettings;
  }

  // Deep merge utility
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
}

module.exports = ClaudeSettingsGenerator;