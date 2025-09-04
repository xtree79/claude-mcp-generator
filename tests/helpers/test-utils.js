const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Create a temporary test directory with optional structure
 * @param {Object} structure - Directory/file structure to create
 * @param {string} basePath - Base path for the test directory
 * @returns {Promise<string>} Path to the created test directory
 */
async function createTestProject(structure = {}, basePath = null) {
  const testDir = basePath || path.join(__dirname, '../fixtures/temp', `test-${Date.now()}`);
  await fs.ensureDir(testDir);
  
  for (const [filePath, content] of Object.entries(structure)) {
    const fullPath = path.join(testDir, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    
    if (typeof content === 'string') {
      await fs.writeFile(fullPath, content);
    } else if (typeof content === 'object') {
      await fs.writeJSON(fullPath, content, { spaces: 2 });
    }
  }
  
  return testDir;
}

/**
 * Clean up test directory
 * @param {string} testDir - Path to test directory to remove
 */
async function cleanupTestProject(testDir) {
  if (await fs.pathExists(testDir)) {
    await fs.remove(testDir);
  }
}

/**
 * Run CLI command and return result
 * @param {string[]} args - Command arguments
 * @param {Object} options - Spawn options
 * @returns {Promise<Object>} Command result with code, stdout, stderr
 */
function runCLICommand(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['src/cli.js', ...args], {
      cwd: path.join(__dirname, '../..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: options.timeout || 30000,
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

    // Handle input for interactive prompts
    if (options.input) {
      setTimeout(() => {
        child.stdin.write(options.input);
        child.stdin.end();
      }, 100);
    }
  });
}

/**
 * Create a Node.js project structure
 * @param {string} testDir - Directory to create project in
 * @param {Object} packageJson - Custom package.json content
 */
async function createNodeJSProject(testDir, packageJson = {}) {
  const defaultPackageJson = {
    name: 'test-nodejs-project',
    version: '1.0.0',
    scripts: {
      start: 'node index.js',
      test: 'jest',
      build: 'webpack'
    },
    dependencies: {
      express: '^4.18.2'
    },
    devDependencies: {
      jest: '^29.7.0'
    }
  };

  await fs.ensureDir(path.join(testDir, 'src'));
  await fs.writeJSON(
    path.join(testDir, 'package.json'), 
    { ...defaultPackageJson, ...packageJson },
    { spaces: 2 }
  );
  await fs.writeFile(path.join(testDir, 'src/index.js'), 'console.log("Hello World");');
}

/**
 * Create a React project structure
 * @param {string} testDir - Directory to create project in
 */
async function createReactProject(testDir) {
  await fs.ensureDir(path.join(testDir, 'src'));
  await fs.ensureDir(path.join(testDir, 'public'));
  
  await fs.writeJSON(path.join(testDir, 'package.json'), {
    name: 'test-react-app',
    version: '1.0.0',
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0'
    },
    devDependencies: {
      '@vitejs/plugin-react': '^4.0.3',
      vite: '^4.4.5'
    },
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview'
    }
  }, { spaces: 2 });

  await fs.writeFile(path.join(testDir, 'src/App.jsx'), `
import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <h1>Test React App</h1>
      <button onClick={() => setCount((count) => count + 1)}>
        count is {count}
      </button>
    </div>
  )
}

export default App
  `);

  await fs.writeFile(path.join(testDir, 'vite.config.js'), `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
  `);
}

/**
 * Create a Python project structure
 * @param {string} testDir - Directory to create project in
 */
async function createPythonProject(testDir) {
  await fs.writeFile(path.join(testDir, 'requirements.txt'), 'flask==2.3.2\npytest==7.4.0');
  await fs.writeFile(path.join(testDir, 'main.py'), `
from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello_world():
    return 'Hello, World!'

if __name__ == '__main__':
    app.run(debug=True)
  `);
  
  await fs.writeFile(path.join(testDir, 'pyproject.toml'), `
[build-system]
requires = ["setuptools>=45", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "test-python-project"
version = "1.0.0"
  `);
}

/**
 * Create a Lerna monorepo structure
 * @param {string} testDir - Directory to create monorepo in
 */
async function createLernaMonorepo(testDir) {
  // Root package.json
  await fs.writeJSON(path.join(testDir, 'package.json'), {
    name: 'test-monorepo',
    private: true,
    workspaces: ['packages/*'],
    scripts: {
      build: 'lerna run build',
      test: 'lerna run test'
    }
  }, { spaces: 2 });

  // Lerna config
  await fs.writeJSON(path.join(testDir, 'lerna.json'), {
    version: '1.0.0',
    packages: ['packages/*']
  }, { spaces: 2 });

  // Create frontend package
  await fs.ensureDir(path.join(testDir, 'packages/frontend/src'));
  await fs.writeJSON(path.join(testDir, 'packages/frontend/package.json'), {
    name: 'frontend',
    version: '1.0.0',
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0'
    }
  }, { spaces: 2 });

  await fs.writeFile(
    path.join(testDir, 'packages/frontend/src/App.jsx'),
    'export default function App() { return <div>Frontend</div>; }'
  );

  // Create backend package
  await fs.ensureDir(path.join(testDir, 'packages/backend/src'));
  await fs.writeJSON(path.join(testDir, 'packages/backend/package.json'), {
    name: 'backend',
    version: '1.0.0',
    dependencies: {
      express: '^4.18.2'
    }
  }, { spaces: 2 });

  await fs.writeFile(
    path.join(testDir, 'packages/backend/src/index.js'),
    'console.log("Backend server");'
  );
}

/**
 * Wait for a specified amount of time
 * @param {number} ms - Milliseconds to wait
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  createTestProject,
  cleanupTestProject,
  runCLICommand,
  createNodeJSProject,
  createReactProject,
  createPythonProject,
  createLernaMonorepo,
  sleep
};