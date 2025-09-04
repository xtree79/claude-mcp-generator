const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

// Helper function to run CLI commands
function runCLI(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['src/cli.js', ...args], {
      cwd: path.join(__dirname, '../..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on('error', reject);

    // Send inputs if provided
    if (options.input) {
      child.stdin.write(options.input);
      child.stdin.end();
    }
  });
}

describe('CLI Integration Tests', () => {
  let testDir;

  beforeEach(async () => {
    testDir = path.join(__dirname, '../fixtures/cli-test', Date.now().toString());
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('claude-gen --help', () => {
    test('should show help information', async () => {
      const result = await runCLI(['--help']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Generate Claude Code MCP configurations');
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('Options:');
    });
  });

  describe('claude-gen --version', () => {
    test('should show version information', async () => {
      const result = await runCLI(['--version']);

      expect(result.code).toBe(0);
      expect(result.stdout.trim()).toBe('1.0.0');
    });
  });

  describe('claude-gen scan', () => {
    test('should scan empty directory', async () => {
      const result = await runCLI(['scan', '--directory', testDir]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Scanning workspace');
      expect(result.stdout).toContain('Total files: 0');
    });

    test('should scan Node.js project', async () => {
      // Create a simple Node.js project
      await fs.writeJSON(path.join(testDir, 'package.json'), {
        name: 'test-nodejs',
        version: '1.0.0',
        scripts: { test: 'jest' }
      });
      await fs.ensureDir(path.join(testDir, 'src'));
      await fs.writeFile(path.join(testDir, 'src/index.js'), 'console.log("Hello");');

      const result = await runCLI(['scan', '--directory', testDir]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Project type: nodejs');
      expect(result.stdout).toContain('Total files:');
      expect(result.stdout).toContain('.js:');
      expect(result.stdout).toContain('.json:');
    });

    test('should scan Python project', async () => {
      await fs.writeFile(path.join(testDir, 'requirements.txt'), 'flask==2.0.0');
      await fs.writeFile(path.join(testDir, 'main.py'), 'print("Hello Python")');
      await fs.writeFile(path.join(testDir, 'README.md'), '# Python Project');

      const result = await runCLI(['scan', '--directory', testDir]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Project type: python');
      expect(result.stdout).toContain('.py:');
      expect(result.stdout).toContain('.txt:');
      expect(result.stdout).toContain('.md:');
    });
  });

  describe('claude-gen validate', () => {
    test('should fail validation when no Claude config exists', async () => {
      const result = await runCLI(['validate', '--directory', testDir]);

      expect(result.code).toBe(0); // Command succeeds but shows validation failure
      expect(result.stdout).toContain('No Claude settings file found');
    });

    test('should validate existing Claude configuration', async () => {
      // Create a valid Claude configuration
      const claudeDir = path.join(testDir, '.claude');
      await fs.ensureDir(claudeDir);
      await fs.writeJSON(path.join(claudeDir, 'settings.local.json'), {
        claude_desktop_integration: { enabled: true },
        mcp: { mcpServers: {} },
        workspaceFiles: ['*.js'],
        directoryPermissions: {
          allowedReadPaths: [testDir],
          allowedWritePaths: [testDir]
        }
      });

      const result = await runCLI(['validate', '--directory', testDir]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Settings file found and valid JSON');
      expect(result.stdout).toContain('Directory permissions look good');
    });

    test('should detect invalid JSON in Claude config', async () => {
      const claudeDir = path.join(testDir, '.claude');
      await fs.ensureDir(claudeDir);
      await fs.writeFile(path.join(claudeDir, 'settings.local.json'), '{ invalid json }');

      const result = await runCLI(['validate', '--directory', testDir]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Error reading settings file');
    });
  });

  describe('claude-gen init --dry-run', () => {
    test('should show what would be generated for Node.js project', async () => {
      await fs.writeJSON(path.join(testDir, 'package.json'), {
        name: 'test-project',
        version: '1.0.0'
      });

      // Mock inputs for interactive prompts
      const inputs = [
        'test-project',    // Project name
        '',                // Use default workspace files option
        'y',               // Configure permissions
        'y',               // Generate MCP server
        '',                // Select all commands
        'n',               // Skip hooks configuration
      ].join('\n') + '\n';

      const result = await runCLI(['init', '--type', 'nodejs', '--directory', testDir, '--dry-run'], {
        input: inputs,
        timeout: 15000
      });

      if (result.code !== 0) {
        console.log('STDOUT:', result.stdout.substring(0, 500));
        console.log('STDERR:', result.stderr);
      }
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Dry run mode');
      expect(result.stdout).toContain('Using project type: Node.js Project');
      expect(result.stdout).toContain('Would create: .claude/settings.local.json');
    });

    test('should auto-detect project type', async () => {
      // Create a React project structure
      await fs.writeJSON(path.join(testDir, 'package.json'), {
        name: 'react-app',
        dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' }
      });
      await fs.ensureDir(path.join(testDir, 'src'));
      await fs.writeFile(path.join(testDir, 'src/App.jsx'), 'export default function App() {}');

      const result = await runCLI(['init', '--auto-detect', '--directory', testDir, '--dry-run'], {
        input: 'test-react\n\nn\ny\ny\n\nn\n',
        timeout: 15000
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Project types detected');
      expect(result.stdout).toContain('react');
    });
  });

  describe('Error handling', () => {
    test('should handle non-existent directory', async () => {
      const result = await runCLI(['scan', '--directory', '/nonexistent/path']);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Error');
    });

    test('should handle invalid project type', async () => {
      const result = await runCLI(['init', '--type', 'invalid-type', '--directory', testDir]);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Unknown project type');
    });
  });
});