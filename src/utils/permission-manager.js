const fs = require('fs-extra');
const path = require('path');

class PermissionManager {
  constructor() {
    this.standardDirectories = {
      read: [
        './',
        './src',
        './lib',
        './app',
        './components',
        './utils',
        './config',
        './public',
        './assets',
        './docs',
        './tests',
        './test'
      ],
      write: [
        './',
        './src',
        './lib',
        './app',
        './components',
        './utils',
        './config',
        './dist',
        './build',
        './output'
      ]
    };

    this.projectTypeDirectories = {
      nodejs: {
        read: ['./node_modules', './dist', './coverage'],
        write: ['./dist', './coverage', './logs']
      },
      react: {
        read: ['./node_modules', './build', './coverage'],
        write: ['./build', './coverage', './logs']
      },
      nextjs: {
        read: ['./node_modules', './.next', './out', './coverage'],
        write: ['./.next', './out', './coverage', './logs']
      },
      python: {
        read: ['./venv', './.venv', './__pycache__', './dist', './.pytest_cache'],
        write: ['./__pycache__', './dist', './.pytest_cache', './logs']
      },
      dotnet: {
        read: ['./bin', './obj', './packages'],
        write: ['./bin', './obj', './logs']
      },
      rust: {
        read: ['./target', './Cargo.lock'],
        write: ['./target', './logs']
      },
      go: {
        read: ['./vendor', './bin'],
        write: ['./bin', './logs']
      }
    };

    this.dangerousDirectories = [
      '/etc',
      '/bin',
      '/sbin',
      '/usr/bin',
      '/usr/sbin',
      '/System',
      '/Windows',
      '/Program Files',
      '/Program Files (x86)',
      '~/.ssh',
      '~/.aws',
      '~/.config',
      '/var/log',
      '/tmp',
      '/temp'
    ];
  }

  async analyzeProjectDirectories(targetDir) {
    const directories = {
      existing: [],
      missing: [],
      recommended: {
        read: [],
        write: []
      }
    };

    // Check existing directories
    try {
      const items = await fs.readdir(targetDir);
      for (const item of items) {
        const itemPath = path.join(targetDir, item);
        const stats = await fs.stat(itemPath);
        if (stats.isDirectory()) {
          directories.existing.push(item);
        }
      }
    } catch (error) {
      console.warn('Error reading target directory:', error.message);
    }

    return directories;
  }

  generatePermissions(projectType, targetDir, options = {}) {
    const {
      includeStandard = true,
      includeProjectSpecific = true,
      customRead = [],
      customWrite = [],
      restrictive = false
    } = options;

    const permissions = {
      allowedReadPaths: [],
      allowedWritePaths: []
    };

    // Add standard directories
    if (includeStandard) {
      permissions.allowedReadPaths.push(
        ...this.standardDirectories.read.map(dir => path.resolve(targetDir, dir))
      );
      permissions.allowedWritePaths.push(
        ...this.standardDirectories.write.map(dir => path.resolve(targetDir, dir))
      );
    }

    // Add project-type specific directories
    if (includeProjectSpecific && this.projectTypeDirectories[projectType]) {
      const projectDirs = this.projectTypeDirectories[projectType];
      permissions.allowedReadPaths.push(
        ...projectDirs.read.map(dir => path.resolve(targetDir, dir))
      );
      permissions.allowedWritePaths.push(
        ...projectDirs.write.map(dir => path.resolve(targetDir, dir))
      );
    }

    // Add custom directories
    permissions.allowedReadPaths.push(
      ...customRead.map(dir => path.resolve(targetDir, dir))
    );
    permissions.allowedWritePaths.push(
      ...customWrite.map(dir => path.resolve(targetDir, dir))
    );

    // Remove duplicates and sort
    permissions.allowedReadPaths = [...new Set(permissions.allowedReadPaths)].sort();
    permissions.allowedWritePaths = [...new Set(permissions.allowedWritePaths)].sort();

    // Apply restrictive mode if requested
    if (restrictive) {
      permissions.allowedReadPaths = permissions.allowedReadPaths.filter(p => 
        p.startsWith(path.resolve(targetDir))
      );
      permissions.allowedWritePaths = permissions.allowedWritePaths.filter(p => 
        p.startsWith(path.resolve(targetDir))
      );
    }

    return permissions;
  }

  validatePermissions(permissions) {
    const warnings = [];
    const errors = [];

    // Check for dangerous paths
    for (const readPath of permissions.allowedReadPaths) {
      if (this.isDangerousPath(readPath)) {
        warnings.push(`Potentially dangerous read path: ${readPath}`);
      }
    }

    for (const writePath of permissions.allowedWritePaths) {
      if (this.isDangerousPath(writePath)) {
        errors.push(`Dangerous write path detected: ${writePath}`);
      }
    }

    // Check for write paths that aren't also read paths
    for (const writePath of permissions.allowedWritePaths) {
      const hasReadAccess = permissions.allowedReadPaths.some(readPath => 
        writePath.startsWith(readPath) || readPath.startsWith(writePath)
      );
      
      if (!hasReadAccess) {
        warnings.push(`Write path without read access: ${writePath}`);
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
  }

  isDangerousPath(filePath) {
    const normalizedPath = path.normalize(filePath);
    
    return this.dangerousDirectories.some(dangerous => {
      const normalizedDangerous = path.normalize(dangerous);
      return normalizedPath.startsWith(normalizedDangerous) ||
             normalizedPath === normalizedDangerous;
    });
  }

  async createDirectories(permissions, options = {}) {
    const { 
      dryRun = false,
      createRead = false,
      createWrite = true 
    } = options;

    const results = {
      created: [],
      skipped: [],
      errors: []
    };

    const pathsToCreate = [];
    
    if (createRead) {
      pathsToCreate.push(...permissions.allowedReadPaths);
    }
    
    if (createWrite) {
      pathsToCreate.push(...permissions.allowedWritePaths);
    }

    // Remove duplicates
    const uniquePaths = [...new Set(pathsToCreate)];

    for (const dirPath of uniquePaths) {
      try {
        if (dryRun) {
          const exists = await fs.pathExists(dirPath);
          if (exists) {
            results.skipped.push(dirPath);
          } else {
            results.created.push(dirPath);
          }
        } else {
          await fs.ensureDir(dirPath);
          results.created.push(dirPath);
        }
      } catch (error) {
        results.errors.push({
          path: dirPath,
          error: error.message
        });
      }
    }

    return results;
  }

  generateSecurityReport(permissions, targetDir) {
    const report = {
      totalReadPaths: permissions.allowedReadPaths.length,
      totalWritePaths: permissions.allowedWritePaths.length,
      projectScope: {
        read: 0,
        write: 0
      },
      systemScope: {
        read: 0,
        write: 0
      },
      validation: this.validatePermissions(permissions),
      recommendations: []
    };

    const projectRoot = path.resolve(targetDir);

    // Analyze scope
    permissions.allowedReadPaths.forEach(p => {
      if (p.startsWith(projectRoot)) {
        report.projectScope.read++;
      } else {
        report.systemScope.read++;
      }
    });

    permissions.allowedWritePaths.forEach(p => {
      if (p.startsWith(projectRoot)) {
        report.projectScope.write++;
      } else {
        report.systemScope.write++;
      }
    });

    // Generate recommendations
    if (report.systemScope.write > 0) {
      report.recommendations.push('Consider restricting write permissions to project directory only');
    }

    if (report.systemScope.read > 3) {
      report.recommendations.push('Review system-level read permissions for security');
    }

    if (permissions.allowedWritePaths.length > permissions.allowedReadPaths.length) {
      report.recommendations.push('You have more write permissions than read permissions - this is unusual');
    }

    return report;
  }

  formatPermissionsForDisplay(permissions, options = {}) {
    const { 
      relative = true,
      groupByType = true,
      baseDir = process.cwd()
    } = options;

    const formatPath = (p) => {
      if (relative) {
        return path.relative(baseDir, p) || './';
      }
      return p;
    };

    if (groupByType) {
      return {
        read: permissions.allowedReadPaths.map(formatPath),
        write: permissions.allowedWritePaths.map(formatPath)
      };
    }

    return {
      allowedReadPaths: permissions.allowedReadPaths.map(formatPath),
      allowedWritePaths: permissions.allowedWritePaths.map(formatPath)
    };
  }
}

module.exports = PermissionManager;