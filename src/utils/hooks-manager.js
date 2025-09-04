const path = require('path');

class HooksManager {
  constructor() {
    this.hookTemplates = {
      startup: {
        read_readmes: {
          name: 'Read all README files',
          description: 'Automatically read README files when opening project',
          hook: 'on_project_open',
          command: 'find . -maxdepth 2 -name "README*" -type f -exec echo "=== {} ===" \\; -exec cat {} \\; 2>/dev/null || echo "No README files found"'
        },
        git_status: {
          name: 'Show git status and recent commits',
          description: 'Display project git status and recent changes',
          hook: 'on_project_open', 
          command: 'echo "=== Git Status ===" && git status --porcelain && echo "" && echo "=== Recent Commits ===" && git log --oneline -5 2>/dev/null || echo "Not a git repository"'
        },
        package_info: {
          name: 'Show package information',
          description: 'Display project dependencies and scripts',
          hook: 'on_project_open',
          command: 'if [ -f package.json ]; then echo "=== Package Info ===" && jq -r ".name, .version, .description" package.json 2>/dev/null && echo "" && echo "=== Available Scripts ===" && jq -r ".scripts | keys[]" package.json 2>/dev/null; fi'
        },
        project_structure: {
          name: 'Show project structure',
          description: 'Display directory tree overview',
          hook: 'on_project_open',
          command: 'echo "=== Project Structure ===" && tree -L 2 -I "node_modules|.git|dist|build|target|bin|obj" . 2>/dev/null || find . -maxdepth 2 -type d -name ".*" -prune -o -type d -print | head -20'
        },
        health_check: {
          name: 'Project health check',
          description: 'Check for outdated dependencies and issues',
          hook: 'on_project_open',
          command: 'echo "=== Health Check ===" && if [ -f package.json ]; then echo "Checking npm dependencies..." && npm outdated 2>/dev/null | head -10 || echo "Dependencies up to date"; fi'
        }
      },
      
      file_events: {
        file_change_summary: {
          name: 'Summarize file changes',
          description: 'Show summary when files are modified',
          hook: 'after_file_edit',
          command: 'echo "File modified: $CLAUDE_FILE_PATH" && if command -v git >/dev/null 2>&1; then git diff --stat $CLAUDE_FILE_PATH 2>/dev/null; fi'
        },
        auto_format: {
          name: 'Auto-format on save',
          description: 'Automatically format files after editing',
          hook: 'after_file_edit',
          command: 'if [[ "$CLAUDE_FILE_PATH" == *.js || "$CLAUDE_FILE_PATH" == *.ts ]]; then npx prettier --write "$CLAUDE_FILE_PATH" 2>/dev/null; elif [[ "$CLAUDE_FILE_PATH" == *.py ]]; then black "$CLAUDE_FILE_PATH" 2>/dev/null; fi'
        },
        update_readme: {
          name: 'Update README after code changes',
          description: 'Automatically update README when significant code changes are made',
          hook: 'after_file_edit',
          command: 'if [[ "$CLAUDE_FILE_PATH" == *.js || "$CLAUDE_FILE_PATH" == *.ts || "$CLAUDE_FILE_PATH" == *.py || "$CLAUDE_FILE_PATH" == *.cs ]]; then echo "Code file modified: $CLAUDE_FILE_PATH - Consider updating README.md if API/functionality changed"; fi'
        }
      },

      validation: {
        test_validation: {
          name: 'Run tests after changes',
          description: 'Automatically run project tests when code is modified',
          hook: 'after_file_edit',
          command: 'if [[ "$CLAUDE_FILE_PATH" == *.js || "$CLAUDE_FILE_PATH" == *.ts ]]; then npm test 2>/dev/null | head -20; elif [[ "$CLAUDE_FILE_PATH" == *.py ]]; then python -m pytest -v 2>/dev/null | head -20; elif [[ "$CLAUDE_FILE_PATH" == *.cs ]]; then dotnet test 2>/dev/null | head -20; fi'
        }
      },

      git_events: {
        commit_reminder: {
          name: 'Remind to commit changes',
          description: 'Remind about uncommitted changes',
          hook: 'on_project_close',
          command: 'if git status --porcelain 2>/dev/null | grep -q .; then echo "⚠️  You have uncommitted changes. Consider committing before closing."; fi'
        }
      }
    };

    this.projectTypeHooks = {
      nodejs: {
        dependency_check: {
          name: 'Check for security vulnerabilities',
          hook: 'on_project_open',
          command: 'npm audit --audit-level moderate 2>/dev/null | head -20 || echo "No npm audit available"'
        }
      },
      python: {
        venv_status: {
          name: 'Check virtual environment',
          hook: 'on_project_open', 
          command: 'echo "=== Python Environment ===" && python --version && if [ -n "$VIRTUAL_ENV" ]; then echo "Virtual env: $VIRTUAL_ENV"; else echo "⚠️  No virtual environment active"; fi'
        }
      },
      dotnet: {
        project_info: {
          name: 'Show .NET project info',
          hook: 'on_project_open',
          command: 'echo "=== .NET Project Info ===" && dotnet --version && if [ -f *.csproj ]; then dotnet list package --outdated 2>/dev/null | head -10; fi'
        },
        test_env_setup: {
          name: 'Setup .NET test environment',
          hook: 'on_project_open',
          command: 'powershell -Command "Write-Host \'=== .NET Test Environment Setup ===\'; if (Get-Process -Name dotnet -ErrorAction SilentlyContinue) { Write-Host \'Existing dotnet processes found\' } else { Write-Host \'No existing dotnet processes\' }"'
        },
        test_env_cleanup: {
          name: 'Kill .NET test environment processes',
          hook: 'on_project_close',
          command: 'powershell -Command "Write-Host \'=== Cleaning up .NET Test Environment ===\'; Get-Process -Name dotnet -ErrorAction SilentlyContinue | ForEach-Object { Write-Host \'Stopping dotnet process:\' $_.Id; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }; Get-Process -Name testhost -ErrorAction SilentlyContinue | ForEach-Object { Write-Host \'Stopping testhost process:\' $_.Id; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }; Write-Host \'Test environment cleanup complete\'"'
        },
        kill_dev_server: {
          name: 'Kill development server processes',
          hook: 'on_project_close',
          command: 'powershell -Command "Write-Host \'=== Killing Dev Server Processes ===\'; $ports = @(5000, 5001, 7000, 7001); foreach ($port in $ports) { $proc = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($proc) { foreach ($p in $proc) { Write-Host \'Killing process on port\' $port \':\' $p; Stop-Process -Id $p -Force -ErrorAction SilentlyContinue } } }"'
        }
      }
    };
  }

  getAvailableHooks(projectType = 'nodejs') {
    const hooks = { ...this.hookTemplates };
    
    // Add project-specific hooks
    if (this.projectTypeHooks[projectType]) {
      hooks.projectSpecific = this.projectTypeHooks[projectType];
    }

    return hooks;
  }

  generateHooksConfig(selectedHooks, customHooks = []) {
    const hooksConfig = {};

    // Add selected predefined hooks
    selectedHooks.forEach(hookId => {
      const hook = this.findHookById(hookId);
      if (hook) {
        if (!hooksConfig[hook.hook]) {
          hooksConfig[hook.hook] = [];
        }
        hooksConfig[hook.hook].push({
          name: hook.name,
          command: hook.command,
          description: hook.description
        });
      }
    });

    // Add custom hooks
    customHooks.forEach(customHook => {
      if (!hooksConfig[customHook.event]) {
        hooksConfig[customHook.event] = [];
      }
      hooksConfig[customHook.event].push({
        name: customHook.name,
        command: customHook.command,
        description: customHook.description || 'Custom hook'
      });
    });

    // Convert arrays to single commands if only one hook per event
    Object.keys(hooksConfig).forEach(hookName => {
      const hooks = hooksConfig[hookName];
      if (hooks.length === 1) {
        hooksConfig[hookName] = hooks[0].command;
      } else {
        // Combine multiple hooks for the same event
        hooksConfig[hookName] = hooks.map(h => h.command).join(' && ');
      }
    });

    return hooksConfig;
  }

  findHookById(hookId) {
    for (const [category, hooks] of Object.entries(this.hookTemplates)) {
      if (hooks[hookId]) {
        return { ...hooks[hookId], id: hookId, category };
      }
    }
    
    // Check project-specific hooks
    for (const [projectType, hooks] of Object.entries(this.projectTypeHooks)) {
      if (hooks[hookId]) {
        return { ...hooks[hookId], id: hookId, category: 'projectSpecific' };
      }
    }
    
    return null;
  }

  getHookChoices(projectType = 'nodejs') {
    const choices = [];
    const hooks = this.getAvailableHooks(projectType);

    // Startup hooks
    choices.push({ type: 'separator', line: '--- Startup Hooks ---' });
    Object.entries(hooks.startup).forEach(([id, hook]) => {
      choices.push({
        name: `${hook.name} - ${hook.description}`,
        value: id,
        checked: id === 'read_readmes' || id === 'git_status' // Default selections
      });
    });

    // File event hooks  
    choices.push({ type: 'separator', line: '--- File Event Hooks ---' });
    Object.entries(hooks.file_events).forEach(([id, hook]) => {
      choices.push({
        name: `${hook.name} - ${hook.description}`,
        value: id,
        checked: false
      });
    });

    // Validation hooks
    choices.push({ type: 'separator', line: '--- Validation & Testing ---' });
    Object.entries(hooks.validation).forEach(([id, hook]) => {
      choices.push({
        name: `${hook.name} - ${hook.description}`,
        value: id,
        checked: false
      });
    });

    // Git hooks
    choices.push({ type: 'separator', line: '--- Git Hooks ---' });
    Object.entries(hooks.git_events).forEach(([id, hook]) => {
      choices.push({
        name: `${hook.name} - ${hook.description}`,
        value: id,
        checked: false
      });
    });

    // Project-specific hooks
    if (hooks.projectSpecific) {
      choices.push({ type: 'separator', line: `--- ${projectType.toUpperCase()} Specific ---` });
      Object.entries(hooks.projectSpecific).forEach(([id, hook]) => {
        choices.push({
          name: `${hook.name} - ${hook.description || 'Project-specific hook'}`,
          value: id,
          checked: false
        });
      });
    }

    return choices;
  }

  validateHook(hookConfig) {
    const warnings = [];
    const errors = [];

    // Check for potentially dangerous commands
    const dangerousPatterns = [
      /rm\s+-rf/,
      /sudo/,
      /chmod\s+777/,
      />\s*\/dev\/null.*2>&1.*&\s*$/,  // Background processes
      /curl.*\|\s*sh/,  // Pipe to shell
      /wget.*\|\s*sh/
    ];

    dangerousPatterns.forEach(pattern => {
      if (pattern.test(hookConfig.command)) {
        errors.push(`Potentially dangerous command detected: ${pattern.toString()}`);
      }
    });

    // Check command length
    if (hookConfig.command.length > 500) {
      warnings.push('Command is very long - consider breaking it into smaller hooks');
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
  }

  formatHooksForDisplay(hooksConfig) {
    return Object.entries(hooksConfig).map(([hookName, command]) => {
      return `${hookName}: ${typeof command === 'string' ? command : JSON.stringify(command)}`;
    }).join('\n');
  }
}

module.exports = HooksManager;