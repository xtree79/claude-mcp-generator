const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const fs = require('fs-extra');
const path = require('path');
const WorkspaceDetector = require('../../src/utils/workspace-detector');

describe('WorkspaceDetector', () => {
  let detector;
  let testDir;

  beforeEach(async () => {
    detector = new WorkspaceDetector();
    testDir = path.join(__dirname, '../fixtures/test-workspace');
    await fs.ensureDir(testDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('detectWorkspace', () => {
    test('should detect single project', async () => {
      // Create a simple Node.js project
      await fs.writeJSON(path.join(testDir, 'package.json'), {
        name: 'test-project',
        version: '1.0.0'
      });

      const result = await detector.detectWorkspace(testDir);

      expect(result.isWorkspace).toBe(false);
      expect(result.structure).toBe('single-project');
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].name).toBe('test-project');
      expect(result.projects[0].type).toBe('nodejs');
    });

    test('should detect Lerna monorepo', async () => {
      // Create Lerna workspace
      await fs.writeJSON(path.join(testDir, 'lerna.json'), {
        version: '1.0.0',
        packages: ['packages/*']
      });
      await fs.writeJSON(path.join(testDir, 'package.json'), {
        name: 'monorepo-root',
        workspaces: ['packages/*']
      });

      // Create packages
      await fs.ensureDir(path.join(testDir, 'packages/frontend'));
      await fs.writeJSON(path.join(testDir, 'packages/frontend/package.json'), {
        name: 'frontend',
        dependencies: { react: '^18.0.0' }
      });

      await fs.ensureDir(path.join(testDir, 'packages/backend'));
      await fs.writeJSON(path.join(testDir, 'packages/backend/package.json'), {
        name: 'backend'
      });

      const result = await detector.detectWorkspace(testDir);

      expect(result.isWorkspace).toBe(true);
      expect(result.workspaceType).toBe('Lerna Monorepo');
      expect(result.structure).toBe('workspace');
      expect(result.projects.length).toBeGreaterThanOrEqual(2);
    });

    test('should detect Python project', async () => {
      await fs.writeFile(path.join(testDir, 'requirements.txt'), 'flask==2.0.0\n');
      await fs.writeFile(path.join(testDir, 'main.py'), 'print("Hello World")');

      const result = await detector.detectWorkspace(testDir);

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].type).toBe('python');
      expect(result.projects[0].indicators).toContain('requirements.txt');
    });

    test('should detect Rust project', async () => {
      await fs.writeFile(path.join(testDir, 'Cargo.toml'), `
[package]
name = "test-rust"
version = "0.1.0"
edition = "2021"
      `);

      const result = await detector.detectWorkspace(testDir);

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].type).toBe('rust');
      expect(result.projects[0].name).toBe('test-rust');
    });

    test('should handle empty directory', async () => {
      const result = await detector.detectWorkspace(testDir);

      expect(result.isWorkspace).toBe(false);
      expect(result.projects).toHaveLength(0);
      expect(result.structure).toBe('single-project');
    });

    test('should detect VS Code workspace with external folders', async () => {
      // Create a VS Code workspace file
      const workspaceConfig = {
        folders: [
          { path: '.' },
          { path: '../external-project', name: 'External Project' }
        ],
        settings: {},
        extensions: {}
      };
      await fs.writeJSON(path.join(testDir, 'workspace.code-workspace'), workspaceConfig);

      // Create external project directory
      const externalDir = path.join(__dirname, '../fixtures/external-project');
      await fs.ensureDir(externalDir);
      await fs.writeJSON(path.join(externalDir, 'package.json'), {
        name: 'external-ml-project',
        version: '1.0.0',
        dependencies: { tensorflow: '^2.0.0' }
      });

      try {
        const result = await detector.detectWorkspace(testDir);

        expect(result.isWorkspace).toBe(true);
        expect(result.workspaceType).toBe('VS Code Workspace');
        expect(result.structure).toBe('workspace');
        
        // Should find the external project
        const externalProject = result.projects.find(p => p.isExternal);
        expect(externalProject).toBeDefined();
        expect(externalProject.name).toBe('external-ml-project');
        expect(externalProject.type).toBe('nodejs');
        expect(externalProject.path).toBe('External Project');
      } finally {
        // Clean up external directory
        await fs.remove(externalDir);
      }
    });
  });

  describe('analyzeProjectDirectory', () => {
    test('should analyze Next.js project correctly', async () => {
      await fs.writeJSON(path.join(testDir, 'package.json'), {
        name: 'nextjs-app',
        dependencies: { next: '^13.0.0', react: '^18.0.0' }
      });
      await fs.writeFile(path.join(testDir, 'next.config.js'), 'module.exports = {}');

      const result = await detector.analyzeProjectDirectory(testDir, 'nextjs-app');

      expect(result).not.toBeNull();
      expect(result.type).toBe('nextjs');
      expect(result.name).toBe('nextjs-app');
      expect(result.confidence).toBeGreaterThan(80);
    });

    test('should return null for directory without project indicators', async () => {
      await fs.writeFile(path.join(testDir, 'random.txt'), 'just a text file');

      const result = await detector.analyzeProjectDirectory(testDir, 'random');

      expect(result).toBeNull();
    });
  });

  describe('extractProjectName', () => {
    test('should extract name from package.json', async () => {
      await fs.writeJSON(path.join(testDir, 'package.json'), {
        name: '@company/my-package',
        version: '2.1.0'
      });

      const result = await detector.extractProjectName(testDir, 'nodejs');

      expect(result).toBe('@company/my-package');
    });

    test('should extract name from Cargo.toml', async () => {
      await fs.writeFile(path.join(testDir, 'Cargo.toml'), `
[package]
name = "my-rust-crate"
version = "0.2.1"
      `);

      const result = await detector.extractProjectName(testDir, 'rust');

      expect(result).toBe('my-rust-crate');
    });
  });
});