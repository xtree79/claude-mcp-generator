const fs = require('fs-extra');
const path = require('path');
const { glob } = require('glob');

class WorkspaceDetector {
  constructor() {
    this.workspaceIndicators = {
      // Workspace configuration files
      'workspace.json': 'Generic Workspace',
      'workspace.yaml': 'Generic Workspace',
      'workspace.yml': 'Generic Workspace',
      '*.code-workspace': 'VS Code Workspace',
      
      // Lerna (JavaScript monorepo)
      'lerna.json': 'Lerna Monorepo',
      
      // Nx (Extensible dev tools)
      'nx.json': 'Nx Workspace',
      // Note: workspace.json is also used by Nx but conflicts with generic workspace
      
      // Rush (Microsoft's monorepo tool)
      'rush.json': 'Rush Monorepo',
      
      // pnpm workspaces
      'pnpm-workspace.yaml': 'pnpm Workspace',
      'pnpm-lock.yaml': 'pnpm Workspace',
      
      // Yarn workspaces
      'yarn.lock': 'Yarn Workspace', // Check package.json for workspaces field
      
      // Bazel
      'WORKSPACE': 'Bazel Workspace',
      'WORKSPACE.bazel': 'Bazel Workspace',
      
      // Cargo workspaces (Rust)
      'Cargo.toml': 'Cargo Workspace', // Check for [workspace] section
      
      // Maven multi-module
      'pom.xml': 'Maven Multi-Module', // Check for <modules> section
      
      // .NET solutions
      '*.sln': '.NET Solution'
    };

    this.projectIndicators = {
      // JavaScript/TypeScript
      'package.json': { type: 'nodejs', weight: 10 },
      'tsconfig.json': { type: 'typescript', weight: 8 },
      'next.config.js': { type: 'nextjs', weight: 15 },
      'nuxt.config.js': { type: 'nuxtjs', weight: 9 },
      'vue.config.js': { type: 'vue', weight: 9 },
      'angular.json': { type: 'angular', weight: 10 },
      'svelte.config.js': { type: 'svelte', weight: 9 },
      
      // Python
      'pyproject.toml': { type: 'python', weight: 10 },
      'requirements.txt': { type: 'python', weight: 8 },
      'setup.py': { type: 'python', weight: 9 },
      'Pipfile': { type: 'python', weight: 8 },
      'poetry.lock': { type: 'python', weight: 7 },
      
      // Rust
      'Cargo.toml': { type: 'rust', weight: 10 },
      
      // Go
      'go.mod': { type: 'go', weight: 10 },
      'go.sum': { type: 'go', weight: 8 },
      
      // .NET
      '*.csproj': { type: 'dotnet', weight: 10 },
      '*.vbproj': { type: 'dotnet', weight: 10 },
      '*.fsproj': { type: 'dotnet', weight: 10 },
      
      // Java
      'pom.xml': { type: 'java', weight: 9 },
      'build.gradle': { type: 'java', weight: 9 },
      'gradle.properties': { type: 'java', weight: 7 },
      
      // PHP
      'composer.json': { type: 'php', weight: 10 },
      
      // Ruby
      'Gemfile': { type: 'ruby', weight: 10 },
      
      // Other
      'Dockerfile': { type: 'docker', weight: 5 },
      'docker-compose.yml': { type: 'docker', weight: 6 }
    };
  }

  async detectWorkspace(rootDir) {
    const detection = {
      isWorkspace: false,
      workspaceType: null,
      workspaceConfig: null,
      projects: [],
      structure: 'single-project'
    };

    try {
      // First, check for workspace indicator files
      const workspaceInfo = await this.findWorkspaceIndicators(rootDir);
      
      if (workspaceInfo.found) {
        detection.isWorkspace = true;
        detection.workspaceType = workspaceInfo.type;
        detection.workspaceConfig = workspaceInfo.config;
        detection.structure = 'workspace';
      }

      // Scan for projects (whether workspace or not)
      const projects = await this.scanForProjects(rootDir);
      detection.projects = projects;

      // If we found multiple projects but no workspace config, it might be an implicit workspace
      if (!detection.isWorkspace && projects.length > 1) {
        detection.structure = 'multi-project';
        detection.workspaceType = 'Implicit Multi-Project';
      }

      // Additional analysis for specific workspace types
      if (detection.isWorkspace) {
        await this.analyzeWorkspaceStructure(rootDir, detection);
      }

      return detection;
    } catch (error) {
      console.error('Error detecting workspace:', error.message);
      return detection;
    }
  }

  async findWorkspaceIndicators(rootDir) {
    for (const [filename, type] of Object.entries(this.workspaceIndicators)) {
      const filePath = path.join(rootDir, filename);
      
      // Handle glob patterns for files like *.sln
      if (filename.includes('*')) {
        const matches = await glob(filename, { cwd: rootDir });
        if (matches.length > 0) {
          const config = await this.readWorkspaceConfig(path.join(rootDir, matches[0]), type);
          return {
            found: true,
            type,
            file: matches[0],
            config
          };
        }
      } else {
        if (await fs.pathExists(filePath)) {
          const config = await this.readWorkspaceConfig(filePath, type);
          return {
            found: true,
            type,
            file: filename,
            config
          };
        }
      }
    }

    return { found: false };
  }

  async readWorkspaceConfig(filePath, _type) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === '.json' || filePath.endsWith('.code-workspace')) {
        return await fs.readJSON(filePath);
      } else if (ext === '.yaml' || ext === '.yml') {
        // For YAML files, we'd need a YAML parser, but for now return basic info
        const content = await fs.readFile(filePath, 'utf8');
        return { content: content.substring(0, 200) + '...' };
      } else if (ext === '.toml') {
        const content = await fs.readFile(filePath, 'utf8');
        return { content: content.substring(0, 200) + '...' };
      } else {
        // For other files, return basic info
        const stats = await fs.stat(filePath);
        return { size: stats.size, modified: stats.mtime };
      }
    } catch (error) {
      console.warn(`Could not read workspace config ${filePath}:`, error.message);
      return null;
    }
  }

  async scanForProjects(rootDir) {
    const projects = [];
    
    try {
      // Get all directories in root (potential project directories)
      const items = await fs.readdir(rootDir, { withFileTypes: true });
      const directories = items
        .filter(item => item.isDirectory() && !this.shouldIgnoreDirectory(item.name))
        .map(item => item.name);

      // Check root directory itself as a potential project
      const rootProject = await this.analyzeProjectDirectory(rootDir, '.');
      if (rootProject) {
        projects.push(rootProject);
      }

      // Check each subdirectory
      for (const dirName of directories) {
        const dirPath = path.join(rootDir, dirName);
        const project = await this.analyzeProjectDirectory(dirPath, dirName);
        if (project) {
          projects.push(project);
        }
      }

      return projects.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      console.warn('Error scanning for projects:', error.message);
      return [];
    }
  }

  async analyzeProjectDirectory(dirPath, dirName) {
    try {
      const indicators = {};
      let totalWeight = 0;
      let maxWeight = 0;
      let primaryType = 'unknown';

      // Check for project indicator files
      for (const [filename, info] of Object.entries(this.projectIndicators)) {
        let filePath;
        
        if (filename.includes('*')) {
          const matches = await glob(filename, { cwd: dirPath });
          if (matches.length > 0) {
            filePath = path.join(dirPath, matches[0]);
          }
        } else {
          filePath = path.join(dirPath, filename);
        }

        if (filePath && await fs.pathExists(filePath)) {
          indicators[filename] = info;
          totalWeight += info.weight;
          
          if (info.weight > maxWeight) {
            maxWeight = info.weight;
            primaryType = info.type;
          }
        }
      }

      // Must have at least one indicator to be considered a project
      if (totalWeight === 0) {
        return null;
      }

      // Calculate confidence (0-100)
      const confidence = Math.min(100, (totalWeight / 20) * 100);

      // Get basic project info
      const stats = await fs.stat(dirPath);
      const fileCount = await this.countFiles(dirPath);

      // Try to get project name from package.json, Cargo.toml, etc.
      const projectName = await this.extractProjectName(dirPath, primaryType) || dirName;

      return {
        name: projectName,
        path: dirName,
        absolutePath: dirPath,
        type: primaryType,
        confidence,
        indicators: Object.keys(indicators),
        fileCount,
        size: stats.size,
        modified: stats.mtime
      };
    } catch (error) {
      console.warn(`Error analyzing project directory ${dirName}:`, error.message);
      return null;
    }
  }

  async extractProjectName(dirPath, projectType) {
    try {
      switch (projectType) {
      case 'nodejs':
      case 'typescript':
      case 'nextjs':
      case 'vue':
      case 'nuxtjs':
      case 'svelte': {
        const packageJson = path.join(dirPath, 'package.json');
        if (await fs.pathExists(packageJson)) {
          const pkg = await fs.readJSON(packageJson);
          return pkg.name;
        }
        break;
      }
          
      case 'rust': {
        const cargoToml = path.join(dirPath, 'Cargo.toml');
        if (await fs.pathExists(cargoToml)) {
          const content = await fs.readFile(cargoToml, 'utf8');
          const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
          if (nameMatch) return nameMatch[1];
        }
        break;
      }
          
      case 'python': {
        const pyprojectToml = path.join(dirPath, 'pyproject.toml');
        if (await fs.pathExists(pyprojectToml)) {
          const content = await fs.readFile(pyprojectToml, 'utf8');
          const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
          if (nameMatch) return nameMatch[1];
        }
        break;
      }
          
      case 'go': {
        const goMod = path.join(dirPath, 'go.mod');
        if (await fs.pathExists(goMod)) {
          const content = await fs.readFile(goMod, 'utf8');
          const moduleMatch = content.match(/module\s+([^\s\n]+)/);
          if (moduleMatch) {
            const modulePath = moduleMatch[1];
            return modulePath.split('/').pop(); // Get last part of module path
          }
        }
        break;
      }
      }
    } catch (error) {
      // Ignore errors, just return null
    }
    
    return null;
  }

  async countFiles(dirPath) {
    try {
      const files = await glob('**/*', { 
        cwd: dirPath, 
        nodir: true,
        ignore: ['node_modules/**', '.git/**', 'target/**', 'dist/**', 'build/**']
      });
      return files.length;
    } catch (error) {
      return 0;
    }
  }

  shouldIgnoreDirectory(dirName) {
    const ignoredDirs = [
      'node_modules', '.git', '.svn', '.hg',
      'dist', 'build', 'target', 'bin', 'obj',
      '__pycache__', '.pytest_cache',
      '.vscode', '.idea', '.vs',
      'coverage', '.nyc_output'
    ];
    
    return ignoredDirs.includes(dirName) || dirName.startsWith('.');
  }

  async analyzeWorkspaceStructure(rootDir, detection) {
    // Additional analysis based on workspace type
    switch (detection.workspaceType) {
    case 'Lerna Monorepo':
      await this.analyzeLernaWorkspace(rootDir, detection);
      break;
    case 'pnpm Workspace':
      await this.analyzePnpmWorkspace(rootDir, detection);
      break;
    case 'Yarn Workspace':
      await this.analyzeYarnWorkspace(rootDir, detection);
      break;
    case 'Nx Workspace':
      await this.analyzeNxWorkspace(rootDir, detection);
      break;
    case 'VS Code Workspace':
      await this.analyzeVSCodeWorkspace(rootDir, detection);
      break;
      // Add more specific analyzers as needed
    }
  }

  async analyzeLernaWorkspace(rootDir, detection) {
    if (detection.workspaceConfig && detection.workspaceConfig.packages) {
      detection.packagePatterns = detection.workspaceConfig.packages;
      
      // Scan package directories for projects
      for (const pattern of detection.workspaceConfig.packages) {
        const cleanPattern = pattern.replace('/*', '');
        const packagesDir = path.join(rootDir, cleanPattern);
        
        if (await fs.pathExists(packagesDir)) {
          const subdirs = await fs.readdir(packagesDir);
          for (const subdir of subdirs) {
            const projectPath = path.join(packagesDir, subdir);
            const stat = await fs.stat(projectPath);
            if (stat.isDirectory()) {
              const project = await this.analyzeProjectDirectory(projectPath, `${cleanPattern}/${subdir}`);
              if (project && !detection.projects.some(p => p.path === project.path)) {
                detection.projects.push(project);
              }
            }
          }
        }
      }
    }
  }

  async analyzePnpmWorkspace(rootDir, detection) {
    // pnpm-workspace.yaml contains package patterns
    const workspaceFile = path.join(rootDir, 'pnpm-workspace.yaml');
    if (await fs.pathExists(workspaceFile)) {
      const content = await fs.readFile(workspaceFile, 'utf8');
      // Basic YAML parsing for packages array
      const packagesMatch = content.match(/packages:\s*\n((?:\s*-\s*.+\n?)*)/);
      if (packagesMatch) {
        const packages = packagesMatch[1]
          .split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.replace(/^\s*-\s*['"]?/, '').replace(/['"]?\s*$/, ''))
          .filter(p => p.length > 0);
        detection.packagePatterns = packages;
      }
    }
  }

  async analyzeYarnWorkspace(rootDir, detection) {
    // Check package.json for workspaces field
    const packageJsonPath = path.join(rootDir, 'package.json');
    if (await fs.pathExists(packageJsonPath)) {
      const packageJson = await fs.readJSON(packageJsonPath);
      if (packageJson.workspaces) {
        detection.packagePatterns = Array.isArray(packageJson.workspaces) 
          ? packageJson.workspaces 
          : packageJson.workspaces.packages || [];
      }
    }
  }

  async analyzeNxWorkspace(rootDir, detection) {
    if (detection.workspaceConfig && detection.workspaceConfig.projects) {
      detection.projectsConfig = detection.workspaceConfig.projects;
    }
  }

  async analyzeVSCodeWorkspace(rootDir, detection) {
    if (detection.workspaceConfig && detection.workspaceConfig.folders) {
      const externalProjects = [];
      
      for (const folder of detection.workspaceConfig.folders) {
        const folderPath = folder.path;
        let absolutePath;
        
        // Handle relative paths relative to the workspace file location
        if (path.isAbsolute(folderPath)) {
          absolutePath = folderPath;
        } else {
          absolutePath = path.resolve(rootDir, folderPath);
        }
        
        // Check if this path exists and is different from rootDir
        if (await fs.pathExists(absolutePath) && path.resolve(absolutePath) !== path.resolve(rootDir)) {
          const folderName = folder.name || path.basename(absolutePath);
          const project = await this.analyzeProjectDirectory(absolutePath, folderName);
          
          if (project) {
            // Mark this as an external project
            project.isExternal = true;
            project.absolutePath = absolutePath;
            project.path = folderName; // Use folder name as path for display
            externalProjects.push(project);
          }
        }
      }
      
      // Add external projects to the detection results
      detection.projects = [...detection.projects, ...externalProjects];
      detection.externalProjects = externalProjects;
    }
  }

  formatDetectionSummary(detection) {
    const summary = {
      structure: detection.structure,
      type: detection.workspaceType || 'Single Project',
      projectCount: detection.projects.length,
      projects: detection.projects.map(p => ({
        name: p.name,
        type: p.type,
        path: p.path,
        confidence: Math.round(p.confidence)
      }))
    };

    return summary;
  }
}

module.exports = WorkspaceDetector;