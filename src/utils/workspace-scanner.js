const fs = require('fs-extra');
const path = require('path');
const { glob } = require('glob');

class WorkspaceScanner {
  constructor() {
    this.defaultIgnorePatterns = [
      'node_modules/**',
      '.git/**',
      '.svn/**',
      '.hg/**',
      'dist/**',
      'build/**',
      'target/**',
      'bin/**',
      'obj/**',
      '*.log',
      '.DS_Store',
      'Thumbs.db',
      '*.tmp',
      '*.temp',
      '__pycache__/**',
      '*.pyc',
      '.pytest_cache/**',
      '.coverage',
      '*.egg-info/**'
    ];
  }

  async scanDirectory(targetDir, options = {}) {
    const {
      includePatterns = ['**/*'],
      excludePatterns = [],
      maxFileSize = 10 * 1024 * 1024, // 10MB default
      maxFiles = 1000,
      includeHidden = false
    } = options;

    const allExcludes = [...this.defaultIgnorePatterns, ...excludePatterns];
    
    if (!includeHidden) {
      allExcludes.push('.*/**');
    }

    const foundFiles = [];
    
    for (const pattern of includePatterns) {
      try {
        const files = await glob(pattern, {
          cwd: targetDir,
          ignore: allExcludes,
          nodir: true,
          absolute: false
        });

        for (const file of files) {
          const fullPath = path.join(targetDir, file);
          
          try {
            const stats = await fs.stat(fullPath);
            
            // Skip files that are too large
            if (stats.size > maxFileSize) {
              console.warn(`Skipping large file: ${file} (${Math.round(stats.size / 1024 / 1024)}MB)`);
              continue;
            }

            foundFiles.push({
              relativePath: file,
              absolutePath: fullPath,
              size: stats.size,
              modified: stats.mtime,
              isDirectory: stats.isDirectory()
            });

            // Limit number of files
            if (foundFiles.length >= maxFiles) {
              console.warn(`Reached maximum file limit (${maxFiles}). Some files may be excluded.`);
              break;
            }
          } catch (statError) {
            console.warn(`Could not stat file: ${file}`, statError.message);
          }
        }
      } catch (globError) {
        console.warn(`Error scanning pattern ${pattern}:`, globError.message);
      }
    }

    return foundFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  }

  async detectProjectType(targetDir) {
    const indicators = {
      nodejs: ['package.json'],
      react: ['package.json', 'src/App.js', 'src/App.jsx', 'src/App.tsx'],
      nextjs: ['next.config.js', 'next.config.ts', 'app/layout.js', 'app/layout.tsx', 'pages/_app.js'],
      python: ['requirements.txt', 'setup.py', 'pyproject.toml', 'main.py', 'app.py'],
      dotnet: ['*.sln', '*.csproj', 'Program.cs'],
      rust: ['Cargo.toml'],
      go: ['go.mod', 'main.go'],
      java: ['pom.xml', 'build.gradle', 'src/main/java'],
      php: ['composer.json', 'index.php'],
      ruby: ['Gemfile', 'config.ru', 'app.rb']
    };

    const detectedTypes = [];

    for (const [type, patterns] of Object.entries(indicators)) {
      let matches = 0;
      
      for (const pattern of patterns) {
        try {
          const files = await glob(pattern, {
            cwd: targetDir,
            nodir: type !== 'java', // Java might have directory indicators
            absolute: false
          });
          
          if (files.length > 0) {
            matches++;
          }
        } catch (error) {
          // Ignore glob errors
        }
      }

      if (matches > 0) {
        detectedTypes.push({
          type,
          confidence: matches / patterns.length,
          matches
        });
      }
    }

    // Sort by confidence and return the most likely type
    detectedTypes.sort((a, b) => b.confidence - a.confidence);
    
    return detectedTypes.length > 0 ? detectedTypes : null;
  }

  async generateWorkspacePatterns(targetDir, projectType) {
    const projectTypePatterns = {
      nodejs: [
        'package.json',
        'package-lock.json',
        'yarn.lock',
        'src/**/*.js',
        'src/**/*.ts',
        'lib/**/*.js',
        'lib/**/*.ts',
        '*.js',
        '*.ts',
        '*.md',
        '.env.example'
      ],
      react: [
        'package.json',
        'src/**/*.{js,jsx,ts,tsx}',
        'public/**/*',
        '*.{js,ts}',
        '*.md',
        '.env.example'
      ],
      nextjs: [
        'package.json',
        'next.config.{js,ts}',
        'app/**/*.{js,jsx,ts,tsx}',
        'pages/**/*.{js,jsx,ts,tsx}',
        'components/**/*.{js,jsx,ts,tsx}',
        'src/**/*.{js,jsx,ts,tsx}',
        'public/**/*',
        '*.{js,ts}',
        '*.md'
      ],
      python: [
        '*.py',
        '**/*.py',
        'requirements.txt',
        'setup.py',
        'pyproject.toml',
        '*.md',
        '.env.example'
      ],
      dotnet: [
        '*.sln',
        '**/*.csproj',
        '**/*.cs',
        '**/*.json',
        '*.md'
      ],
      rust: [
        'Cargo.toml',
        'Cargo.lock',
        'src/**/*.rs',
        '*.md'
      ],
      go: [
        'go.mod',
        'go.sum',
        '**/*.go',
        '*.md'
      ]
    };

    return projectTypePatterns[projectType] || projectTypePatterns.nodejs;
  }

  async analyzeWorkspace(targetDir, options = {}) {
    const detectedTypes = await this.detectProjectType(targetDir);
    const primaryType = detectedTypes && detectedTypes.length > 0 ? detectedTypes[0].type : 'nodejs';
    
    const patterns = await this.generateWorkspacePatterns(targetDir, primaryType);
    const files = await this.scanDirectory(targetDir, {
      includePatterns: patterns,
      ...options
    });

    const analysis = {
      projectType: primaryType,
      detectedTypes,
      totalFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      filesByType: this.categorizeFiles(files),
      recommendedPatterns: patterns,
      files
    };

    return analysis;
  }

  categorizeFiles(files) {
    const categories = {};
    
    files.forEach(file => {
      const ext = path.extname(file.relativePath).toLowerCase();
      
      if (!categories[ext]) {
        categories[ext] = {
          count: 0,
          totalSize: 0,
          files: []
        };
      }
      
      categories[ext].count++;
      categories[ext].totalSize += file.size;
      categories[ext].files.push(file.relativePath);
    });

    return categories;
  }

  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  async validateWorkspacePatterns(targetDir, patterns) {
    const results = [];
    
    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern, {
          cwd: targetDir,
          nodir: true
        });
        
        results.push({
          pattern,
          matches: matches.length,
          valid: true,
          sampleFiles: matches.slice(0, 5)
        });
      } catch (error) {
        results.push({
          pattern,
          matches: 0,
          valid: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

module.exports = WorkspaceScanner;