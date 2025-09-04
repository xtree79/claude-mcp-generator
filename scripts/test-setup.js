#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

async function setupTestEnvironment() {
  console.log(chalk.blue('Setting up test environment...'));

  try {
    // Ensure test directories exist
    const testDirs = [
      'tests/fixtures/temp',
      'tests/fixtures/cli-test',
      'tests/fixtures/settings-test',
      'tests/fixtures/test-workspace',
      'coverage'
    ];

    for (const dir of testDirs) {
      const fullPath = path.join(__dirname, '..', dir);
      await fs.ensureDir(fullPath);
      console.log(chalk.green(`✓ Created directory: ${dir}`));
    }

    // Create .gitkeep files for empty directories
    const gitkeepDirs = [
      'tests/fixtures/temp',
      'coverage'
    ];

    for (const dir of gitkeepDirs) {
      const gitkeepPath = path.join(__dirname, '..', dir, '.gitkeep');
      await fs.writeFile(gitkeepPath, '');
      console.log(chalk.green(`✓ Created .gitkeep in: ${dir}`));
    }

    console.log(chalk.green('\n✅ Test environment setup complete!'));
    console.log(chalk.yellow('\nAvailable test commands:'));
    console.log('  npm test              - Run all tests');
    console.log('  npm run test:unit     - Run unit tests only');
    console.log('  npm run test:integration - Run integration tests only');
    console.log('  npm run test:watch    - Run tests in watch mode');
    console.log('  npm run test:coverage - Run tests with coverage report');

  } catch (error) {
    console.error(chalk.red('❌ Failed to set up test environment:'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  setupTestEnvironment();
}

module.exports = { setupTestEnvironment };