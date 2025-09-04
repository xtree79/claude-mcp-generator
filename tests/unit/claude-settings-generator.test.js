const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const fs = require('fs-extra');
const path = require('path');
const ClaudeSettingsGenerator = require('../../src/generators/claude-settings');

describe('ClaudeSettingsGenerator', () => {
  let generator;
  let testDir;

  beforeEach(async () => {
    generator = new ClaudeSettingsGenerator();
    testDir = path.join(__dirname, '../fixtures/settings-test');
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('generateSettings', () => {
    test('should generate basic settings for Node.js project', async () => {
      const projectConfig = {
        shell: 'bash',
        commands: { build: 'npm run build', test: 'npm test' },
        workspaceFiles: ['package.json', 'src/**/*.js'],
        permissions: {
          read: ['./', './src'],
          write: ['./', './src']
        },
        mcpServer: {
          name: 'test-mcp-server',
          command: 'node',
          args: ['server.js']
        }
      };

      const options = {
        projectName: 'test-project',
        includeWorkspaceFiles: true,
        includePermissions: true
      };

      const result = await generator.generateSettings(projectConfig, testDir, options);

      expect(result).toHaveProperty('claude_desktop_integration');
      expect(result.claude_desktop_integration.enabled).toBe(true);
      expect(result).toHaveProperty('mcp');
      expect(result.mcp.mcpServers).toHaveProperty('test-mcp-server');
      expect(result.workspaceFiles).toEqual(['package.json', 'src/**/*.js']);
      expect(result.directoryPermissions.allowedReadPaths).toHaveLength(2);
    });

    test('should handle PowerShell configuration for .NET projects', async () => {
      const projectConfig = {
        shell: 'powershell',
        commands: { build: 'dotnet build' },
        mcpServer: { name: 'dotnet-server', command: 'dotnet', args: ['run'] }
      };

      const result = await generator.generateSettings(projectConfig, testDir);

      expect(result.tools.bash.enabled).toBe(false);
      expect(result.tools.powershell.enabled).toBe(true);
    });

    test('should include hooks configuration when provided', async () => {
      const projectConfig = {
        shell: 'bash',
        mcpServer: { name: 'test-server', command: 'node', args: [] }
      };

      const hooksConfig = {
        on_project_open: 'echo "Project opened"',
        after_file_edit: 'echo "File edited"'
      };

      const result = await generator.generateSettings(projectConfig, testDir, { hooksConfig });

      expect(result).toHaveProperty('hooks');
      expect(result.hooks.on_project_open).toBe('echo "Project opened"');
      expect(result.hooks.after_file_edit).toBe('echo "File edited"');
    });

    test('should handle workspace detection with multiple projects', async () => {
      const projectConfig = {
        shell: 'bash',
        permissions: { read: ['./', './src'], write: ['./', './src'] },
        mcpServer: { name: 'workspace-server', command: 'node', args: [] }
      };

      const workspaceDetection = {
        isWorkspace: true,
        workspaceType: 'Lerna Monorepo',
        structure: 'workspace',
        projects: [
          { name: 'frontend', path: 'frontend', type: 'nextjs', confidence: 95 },
          { name: 'backend', path: 'backend', type: 'nodejs', confidence: 90 }
        ]
      };

      const result = await generator.generateSettings(projectConfig, testDir, { workspaceDetection });

      expect(result).toHaveProperty('workspace');
      expect(result.workspace.type).toBe('Lerna Monorepo');
      expect(result.workspace.projects).toHaveLength(2);
      expect(result.workspace.projects[0].name).toBe('frontend');
    });

    test('should include repository configuration', async () => {
      const projectConfig = {
        shell: 'bash',
        mcpServer: { name: 'test-server', command: 'node', args: [] }
      };

      const repositoryConfig = new Map();
      repositoryConfig.set('frontend', [
        {
          name: 'origin',
          type: 'github',
          url: 'https://github.com/user/frontend.git',
          webUrl: 'https://github.com/user/frontend',
          visibility: 'private',
          action: 'add'
        }
      ]);

      const result = await generator.generateSettings(projectConfig, testDir, { repositoryConfig });

      expect(result).toHaveProperty('repositories');
      expect(result.repositories.frontend).toHaveLength(1);
      expect(result.repositories.frontend[0].visibility).toBe('private');
      expect(result.repositories.frontend[0].type).toBe('github');
    });

    test('should skip optional configurations when not provided', async () => {
      const projectConfig = {
        shell: 'bash',
        mcpServer: { name: 'minimal-server', command: 'node', args: [] }
      };

      const options = {
        includeWorkspaceFiles: false,
        includePermissions: false
      };

      const result = await generator.generateSettings(projectConfig, testDir, options);

      expect(result.workspaceFiles).toEqual([]);
      expect(result.directoryPermissions.allowedReadPaths).toEqual([]);
      expect(result).not.toHaveProperty('hooks');
      expect(result).not.toHaveProperty('workspace');
      expect(result).not.toHaveProperty('repositories');
    });
  });

  describe('writeSettings', () => {
    test('should write settings to correct location', async () => {
      const settings = {
        claude_desktop_integration: { enabled: true },
        mcp: { mcpServers: {} }
      };

      const result = await generator.writeSettings(settings, testDir);
      
      expect(result).toBe(path.join(testDir, '.claude', 'settings.local.json'));
      expect(await fs.pathExists(result)).toBe(true);
      
      const writtenSettings = await fs.readJSON(result);
      expect(writtenSettings).toEqual(settings);
    });

    test('should create .claude directory if it does not exist', async () => {
      const claudeDir = path.join(testDir, '.claude');
      expect(await fs.pathExists(claudeDir)).toBe(false);

      await generator.writeSettings({ test: true }, testDir);

      expect(await fs.pathExists(claudeDir)).toBe(true);
    });
  });

  describe('updateSettings', () => {
    test('should merge settings with existing file', async () => {
      const existingSettings = {
        existing: 'value',
        nested: { keep: 'this' }
      };
      
      const settingsPath = path.join(testDir, '.claude', 'settings.local.json');
      await fs.ensureDir(path.dirname(settingsPath));
      await fs.writeJSON(settingsPath, existingSettings);

      const updates = {
        new: 'value',
        nested: { add: 'this' }
      };

      const result = await generator.updateSettings(testDir, updates);

      expect(result.existing).toBe('value');
      expect(result.new).toBe('value');
      expect(result.nested.keep).toBe('this');
      expect(result.nested.add).toBe('this');
    });

    test('should create new settings file if none exists', async () => {
      const updates = { first: 'setting' };

      const result = await generator.updateSettings(testDir, updates);

      expect(result).toEqual(updates);
      
      const settingsPath = path.join(testDir, '.claude', 'settings.local.json');
      expect(await fs.pathExists(settingsPath)).toBe(true);
    });
  });
});