# Claude MCP Generator

[![npm version](https://badge.fury.io/js/claude-mcp-generator.svg)](https://badge.fury.io/js/claude-mcp-generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub release](https://img.shields.io/github/release/xtree79/claude-mcp-generator.svg)](https://github.com/xtree79/claude-mcp-generator/releases)

A CLI tool to generate Claude Code MCP (Model Context Protocol) configurations for different project types. This tool automates the setup of `.claude/settings.local.json` files and MCP server implementations for your projects.

## Features

- 🚀 **Auto-detection** of project types (Node.js, React, Next.js, Python, .NET, Rust, Go)
- 🏗️ **Workspace & monorepo detection** - Lerna, Nx, pnpm, Yarn, Rush, VS Code workspaces, and more
- 🔄 **Multi-repository management** - Different Git targets per project (GitHub, GitLab, Gitea, Azure DevOps)
- 🔒 **Repository visibility tracking** - Private, public, and internal repository management
- 📝 **Automatic generation** of Claude settings with workspace files and permissions
- 🔧 **MCP server generation** in multiple languages
- 🔗 **Claude Code hooks configuration** - Startup actions, file events, and custom behaviors
- 📁 **Smart workspace file detection** - Scans actual files vs. templates
- 🛡️ **Security validation** of directory permissions
- 📊 **Workspace analysis** and file scanning
- 🎯 **Interactive CLI** with customization options

## Quick Start

```bash
# Install globally
npm install -g claude-mcp-generator

# Navigate to your project
cd /path/to/your/project

# Generate Claude configuration
claude-gen init --auto-detect

# That's it! Your project is now configured for Claude Code
```

## Installation

### Global Installation (Recommended)
Install once, use anywhere:

```bash
npm install -g claude-mcp-generator
```

Then use in any project directory:
```bash
cd d:\my_project
claude-gen init --auto-detect
```

### Local Development/Testing
For development or testing the generator:

```bash
# Clone/download the generator
cd claude_mcp_generator
npm install
npm link  # Creates global symlink for testing
npm install -g .
# Then use anywhere
claude-gen init --auto-detect --directory d:\some_project
```

### Direct Usage
Run directly without global installation:

```bash
# In the generator directory
node src/cli.js init --auto-detect --directory d:\target_project
```

## Usage

### Initialize Claude Configuration

Generate Claude configuration for your current project:

```bash
claude-gen init
```

Options:
- `-t, --type <type>` - Specify project type (nodejs, react, nextjs, python, dotnet, rust, go)
- `-d, --directory <dir>` - Target directory (default: current directory)
- `--auto-detect` - Auto-detect project type
- `--dry-run` - Preview what would be generated

Examples:
```bash
# Auto-detect project type and configure current directory
claude-gen init --auto-detect

# Auto-detect for a specific directory (Windows paths supported)
claude-gen init --auto-detect --directory d:\my_project

# Specify project type for a specific directory
claude-gen init --type nextjs --directory d:\my_nextjs_app

# Configure a different directory (Unix-style paths also work)
claude-gen init --directory /path/to/project --type python

# Preview without creating files
claude-gen init --dry-run --auto-detect --directory d:\test_project

# Combine all options
claude-gen init --type react --directory d:\my_react_app --dry-run
```

### Scan Workspace

Analyze your workspace and get insights:

```bash
claude-gen scan
```

This will show:
- Detected project types
- File count and sizes by type
- Recommended workspace patterns

### Validate Configuration

Check your existing Claude configuration:

```bash
claude-gen validate
```

This validates:
- Settings file syntax
- Directory permissions security
- Workspace file patterns
- MCP server configurations

## Smart Workspace File Detection

The generator automatically scans your project directory and provides intelligent workspace file options:

### Automatic Scanning
When you run `claude-gen init`, it will:

1. **Scan the directory** to see what files actually exist
2. **Show file statistics** - total files, sizes, file types
3. **Offer workspace options**:
   - 🎯 **Recommended patterns** - Predefined patterns for your project type
   - 📁 **Scanned files** - Use actual files found in directory
   - ✏️ **Custom patterns** - Manually specify glob patterns
   - ⏭️ **Skip** - No workspace files

### Example Output - Large Project
```bash
🔍 Scanning workspace files...
📁 Found files:
  Total: 127 files
  Size: 2.4 MB
  .js: 23 files
  .json: 8 files
  .md: 3 files

? How would you like to configure workspace files?
  ❯ Use recommended patterns for this project type (4 patterns)
    Use all scanned files from this directory (127 files)  
    Customize patterns manually
    Skip workspace files (Claude won't access project files directly)
```

### Example Output - Small/Single-Directory Project
```bash
🔍 Scanning workspace files...
📁 Found files:
  Total: 8 files
  Size: 24.3 KB
  .js: 3 files
  .json: 2 files
  .md: 1 files

💡 This appears to be a small, single-directory project

? How would you like to configure workspace files?
    Use recommended patterns for this project type (4 patterns)
  ❯ Use all scanned files from this directory (8 files)
    Customize patterns manually  
    Skip workspace files (Claude won't access project files directly)
```

### Workspace File Options

| Option | Description | Best For | Auto-Selected When |
|--------|-------------|----------|-------------------|
| **Recommended** | Uses predefined patterns like `src/**/*.js`, `*.md` | Large projects, follows conventions | Projects with >20 files or subdirectories |
| **Scanned** | Includes all actual files found in directory | Small/single-directory projects | ≤20 files in single directory |
| **Custom** | Manually specify glob patterns | Advanced users, specific requirements | Never (manual choice) |
| **Skip** | No workspace files in Claude config | Security-focused, minimal setups | Never (manual choice) |

### Smart Default Selection

The generator intelligently chooses the best default option:

- **Small projects** (≤20 files, single directory): Defaults to **"Scanned files"**
  - Perfect for simple scripts, small utilities, or single-file projects
  - Claude gets direct access to all your actual files
  
- **Large projects** (>20 files or has subdirectories): Defaults to **"Recommended patterns"**
  - Uses proven glob patterns for the project type
  - Avoids overwhelming Claude with too many files
  - Follows best practices for workspace organization

## Workspace & Monorepo Detection

The generator automatically detects and configures complex workspace structures with multiple projects.

### Supported Workspace Types

| Workspace Type | Detection File(s) | Description |
|---------------|-------------------|-------------|
| **Lerna** | `lerna.json` | JavaScript monorepo management |
| **Nx** | `nx.json`, `workspace.json` | Extensible dev tools for monorepos |
| **pnpm** | `pnpm-workspace.yaml`, `pnpm-lock.yaml` | Fast, disk space efficient package manager |
| **Yarn** | `yarn.lock` + `workspaces` in `package.json` | Yarn workspaces |
| **Rush** | `rush.json` | Microsoft's scalable monorepo manager |
| **VS Code** | `*.code-workspace` | VS Code workspace with external folders |
| **Cargo** | `Cargo.toml` with `[workspace]` | Rust workspace |
| **.NET** | `*.sln` | Visual Studio solution files |
| **Maven** | `pom.xml` with `<modules>` | Java multi-module projects |
| **Bazel** | `WORKSPACE`, `WORKSPACE.bazel` | Build tool for large codebases |

### Multi-Project Detection

For each detected workspace, the generator:

1. **Scans all subdirectories** for individual projects
2. **Identifies project types** (React, Node.js, Python, etc.) with confidence scoring
3. **Generates project-specific configurations** for each sub-project
4. **Creates workspace-wide permissions** for Claude to access all projects

### Example: Lerna Monorepo Detection

```bash
claude-gen init --auto-detect --directory d:\my-workspace

🔍 Detecting workspace structure...
📦 Found Lerna Monorepo
🏗️  Structure: workspace
📁 Projects found: 4
  frontend (nextjs) - 67 files - 95% confidence
  backend (nodejs) - 45 files - 90% confidence
  mobile (react) - 89 files - 87% confidence
  shared-lib (typescript) - 23 files - 85% confidence
```

### VS Code Workspace Support

The generator has special support for VS Code workspace files (`.code-workspace`) that can reference folders outside the main directory:

```json
// dbhm-workspace.code-workspace
{
  "folders": [
    { "path": "." },
    { "path": "../ML-DBHM-Intelligence", "name": "ML Intelligence" }
  ]
}
```

When detected, the generator:
- ✅ **Parses workspace file** to find all folder references
- ✅ **Includes external folders** in Claude configuration  
- ✅ **Handles both relative and absolute paths**
- ✅ **Maintains folder names** from workspace configuration

This ensures Claude can access all projects referenced in your VS Code workspace, even if they're located outside the main project directory.

## Repository Management Per Project

Configure different Git repositories for each project in your workspace, perfect for organizations using multiple Git hosting platforms.

### Supported Repository Types

| Platform | Description | Features |
|----------|-------------|----------|
| **GitHub** | GitHub.com public and private repos | Pages, Actions, Packages |
| **GitLab** | GitLab.com or self-hosted instances | Pages, CI/CD, Packages |
| **Gitea** | Lightweight self-hosted Git service | Pages, Actions |
| **Bitbucket** | Atlassian Bitbucket Cloud/Server | Pipelines |
| **Azure DevOps** | Microsoft Azure DevOps Services | Pipelines, Artifacts |
| **Custom** | Any other Git server | Basic Git operations |

### Repository Visibility Options

Each repository can be configured with proper visibility settings:

- 🔒 **Private** - Only you and collaborators can access
- 🌍 **Public** - Anyone can view this repository
- 🏢 **Internal** - Organization/enterprise members can access
- ❓ **Unknown** - For existing repos or custom setups

### Multi-Repository Workflow Example

```bash
📁 Configuring repository for: frontend (nextjs)
  Existing remotes found:
    origin: https://github.com/user/old-frontend.git

? Configure repository settings for frontend? Yes
? Select repository configurations for frontend:
  ✓ Keep origin (GitHub) - https://github.com/user/old-frontend.git
  ✓ GitHub - GitHub.com - Public and private repositories

? Remote name for GitHub: production
? Repository owner/username: mycompany
? Repository name: frontend-app
? Repository visibility: Private - Only you and collaborators can access
? Preferred protocol: HTTPS (recommended)

  ✅ Added production: https://github.com/mycompany/frontend-app.git
     🔒 Private repository
     🌐 Web: https://github.com/mycompany/frontend-app

📁 Configuring repository for: backend (nodejs)
? Configure repository settings for backend? Yes
? Select repository configurations for backend:
  ✓ GitLab - GitLab.com or self-hosted instance

? Remote name for GitLab: work
? GitLab host: gitlab.company.com
? Repository owner/username: team
? Repository name: backend-api
? Repository visibility: Internal - Organization/group members can access

  ✅ Added work: https://gitlab.company.com/team/backend-api.git
     🏢 Internal repository
     🌐 Web: https://gitlab.company.com/team/backend-api
```

### Use Cases for Multi-Repository Management

- **Open Source + Private**: Public GitHub for open source, private GitLab for proprietary code
- **Work Separation**: Personal Gitea for side projects, corporate Azure DevOps for work
- **Environment Separation**: Different repos for development, staging, and production
- **Client Projects**: Different Git hosts per client or project

## Supported Project Types

| Project Type | Description | Shell | Key Features |
|-------------|-------------|-------|--------------|
| **nodejs** | Node.js projects | bash | npm scripts, TypeScript support |
| **react** | React applications | bash | JSX/TSX files, build tools |
| **nextjs** | Next.js projects | bash | App/Pages router, optimizations |
| **python** | Python projects | bash | pip, pytest, virtual environments |
| **dotnet** | .NET projects | powershell | MSBuild, C# files |
| **rust** | Rust projects | bash | Cargo, clippy, rustfmt |
| **go** | Go projects | bash | go mod, testing, formatting |

## Generated Files

### `.claude/settings.local.json`

The main Claude configuration file with:

```json
{
  "claude_desktop_integration": {
    "enabled": true
  },
  "mcp": {
    "mcpServers": {
      "project-mcp-server": {
        "command": "node",
        "args": ["mcp-server.js"]
      }
    }
  },
  "tools": {
    "bash": {
      "enabled": true
    }
  },
  "workspaceFiles": [
    "package.json",
    "src/**/*.js",
    "**/*.md"
  ],
  "directoryPermissions": {
    "allowedReadPaths": ["./", "./src", "./node_modules"],
    "allowedWritePaths": ["./", "./src", "./dist"]
  },
  "hooks": {
    "on_project_open": "find . -name 'README*' -exec cat {} \\; && git status --porcelain",
    "after_file_edit": "echo 'File modified: $CLAUDE_FILE_PATH'",
    "on_project_close": "git status --porcelain && echo 'Remember to commit changes'"
  },
  "workspace": {
    "type": "Lerna Monorepo",
    "structure": "workspace",
    "projects": [
      {"name": "frontend", "path": "frontend", "type": "nextjs", "confidence": 95},
      {"name": "backend", "path": "backend", "type": "nodejs", "confidence": 90},
      {"name": "shared-lib", "path": "shared", "type": "typescript", "confidence": 85}
    ]
  },
  "repositories": {
    "frontend": [
      {
        "name": "origin",
        "type": "github", 
        "url": "https://github.com/user/frontend.git",
        "webUrl": "https://github.com/user/frontend",
        "visibility": "public",
        "action": "keep"
      }
    ],
    "backend": [
      {
        "name": "work",
        "type": "gitlab",
        "url": "https://gitlab.company.com/team/backend-api.git", 
        "webUrl": "https://gitlab.company.com/team/backend-api",
        "visibility": "private",
        "action": "add"
      }
    ]
  }
}
```

### MCP Server Files

Generated MCP server implementations that provide project-specific commands:

- **Node.js**: `mcp-server.js`
- **Python**: `mcp_server.py`
- **Rust**: `src/main.rs`
- **Go**: `mcp-server.go`
- **.NET**: `Program.cs`

## Configuration Options

During interactive setup, you can configure:

- ✅ **Project name** - Used in MCP server naming
- ✅ **Workspace files** - Include file patterns in Claude config
- ✅ **Directory permissions** - Configure read/write access
- ✅ **MCP server generation** - Create server implementation
- ✅ **Command selection** - Choose which project commands to include
- ✅ **Claude Code hooks** - Startup actions, file events, and custom behaviors

## Claude Code Hooks

The generator includes powerful hooks configuration that automates actions when Claude interacts with your project.

### Available Hook Types

#### 🚀 Startup Hooks (on_project_open)
Executed automatically when Claude opens your project:

- **📖 Read all README files** - Automatically displays README content
- **🔄 Show git status and recent commits** - Shows current git state and recent changes
- **📦 Show package information** - Displays project dependencies and available scripts
- **📁 Show project structure** - Shows directory tree overview
- **🔍 Project health check** - Checks for outdated dependencies and issues

#### 📝 File Event Hooks (after_file_edit)
Triggered when files are modified:

- **📊 Summarize file changes** - Shows what changed in the modified file
- **🎨 Auto-format on save** - Automatically formats code (Prettier, Black, etc.)
- **📖 Update README after code changes** - Reminds you to update README when API/functionality changes

#### ✅ Validation & Testing Hooks (after_file_edit)
Automatically validate your changes:

- **🧪 Run tests after changes** - Automatically runs project tests when code is modified (npm test, pytest, dotnet test)

#### 🔧 Git Hooks (on_project_close)
Executed when closing the project:

- **⚠️ Remind to commit changes** - Warns about uncommitted changes

#### 🎯 Project-Specific Hooks
Tailored to your project type:

- **Node.js**: Security vulnerability checks with `npm audit`
- **Python**: Virtual environment status and Python version
- **.NET**: 
  - 📊 Project info and outdated package checks
  - 🔧 Setup .NET test environment (on project open)
  - 🧹 Kill .NET test environment processes (on project close)
  - ⚡ Kill development server processes on ports 5000, 5001, 7000, 7001 (on project close)

### Interactive Hooks Configuration

During setup, you'll see prompts like this:

```bash
? Configure Claude Code hooks (startup actions, file events)? (Y/n) 

? Select hooks to enable:
  --- Startup Hooks ---
  ✓ Read all README files - Automatically read README files when opening project
  ✓ Show git status and recent commits - Display project git status and recent changes  
  ○ Show package information - Display project dependencies and scripts
  ○ Show project structure - Display directory tree overview
  ○ Project health check - Check for outdated dependencies and issues
  
  --- File Event Hooks ---
  ○ Summarize file changes - Show summary when files are modified
  ○ Auto-format on save - Automatically format files after editing
  ○ Update README after code changes - Remind to update README when API changes
  
  --- Validation & Testing ---
  ○ Run tests after changes - Automatically run project tests when code is modified
  
  --- Git Hooks ---
  ○ Remind to commit changes - Remind about uncommitted changes
  
  --- DOTNET Specific ---
  ○ Setup .NET test environment - Check for existing dotnet processes on startup
  ○ Kill .NET test environment processes - Clean up dotnet and testhost processes
  ○ Kill development server processes - Stop dev servers on common ports

? Add a custom hook? (y/N)
? Custom hook name: Check for TODOs
? When should this hook run? When project opens  
? Command to execute: grep -r "TODO" src/ || echo "No TODOs found"
? Description (optional): Find all TODO comments in source code
```

### Custom Hooks

You can create custom hooks for any project-specific automation:

```json
{
  "hooks": {
    "on_project_open": "echo 'Welcome to MyProject!' && npm run status",
    "after_file_edit": "npm run lint $CLAUDE_FILE_PATH",
    "on_project_close": "npm run cleanup"
  }
}
```

### Hook Events

| Event | When it runs | Environment Variables |
|-------|-------------|----------------------|
| `on_project_open` | When Claude opens the project | Project directory as CWD |
| `after_file_edit` | After Claude modifies a file | `$CLAUDE_FILE_PATH` - path to modified file |
| `on_project_close` | When Claude closes the project | Project directory as CWD |
| `before_tool_execution` | Before Claude runs any tool | Tool name and arguments available |

### Example Workflow with Hooks

1. **Open project in Claude Code**
   ```bash
   # Hooks automatically run:
   === README.md ===
   # My Awesome Project
   This project does amazing things...
   
   === Git Status ===
   M  src/components/Button.js
   ?? src/utils/helpers.js
   
   === Recent Commits ===
   abc1234 Add new button component
   def5678 Fix styling issues
   ```

2. **Edit a file**
   ```bash
   # After saving changes to src/components/Button.js:
   File modified: src/components/Button.js
   1 file changed, 5 insertions(+), 2 deletions(-)
   
   # If README update hook is enabled:
   Code file modified: src/components/Button.js - Consider updating README.md if API/functionality changed
   
   # If test validation hook is enabled:
   Running tests...
   ✓ Button component renders correctly
   ✓ Button handles click events
   2 tests passed
   ```

3. **Close .NET project** (with PowerShell cleanup enabled)
   ```bash
   # Before closing:
   === Cleaning up .NET Test Environment ===
   Stopping dotnet process: 1234
   Stopping testhost process: 5678
   
   === Killing Dev Server Processes ===
   Killing process on port 5000: 9012
   Test environment cleanup complete
   
   ⚠️  You have uncommitted changes. Consider committing before closing.
   ```

## Security Features

- 🛡️ **Permission validation** - Warns about dangerous directory access
- 🔒 **Sandbox enforcement** - Keeps permissions within project scope
- ⚠️ **Security reports** - Analysis of permission scope and risks
- 🚫 **Dangerous path detection** - Prevents access to system directories

## API Usage

You can also use the generator programmatically:

```javascript
const { 
  ClaudeSettingsGenerator, 
  McpServerGenerator, 
  HooksManager,
  WorkspaceDetector,
  RepositoryManager,
  projectTypes 
} = require('claude-mcp-generator');

const settingsGen = new ClaudeSettingsGenerator();
const mcpGen = new McpServerGenerator();
const hooksManager = new HooksManager();
const workspaceDetector = new WorkspaceDetector();
const repositoryManager = new RepositoryManager();

// Detect workspace structure
const workspaceDetection = await workspaceDetector.detectWorkspace('D:\\my_workspace');
console.log(`Found: ${workspaceDetection.workspaceType}`);
console.log(`Projects: ${workspaceDetection.projects.length}`);

// Generate hooks configuration
const hooksConfig = hooksManager.generateHooksConfig(
  ['read_readmes', 'git_status'], // Selected hook IDs
  [{ // Custom hooks
    name: 'Custom startup',
    event: 'on_project_open', 
    command: 'echo "Hello from workspace!"'
  }]
);

// Configure repositories per project
const repositoryConfig = new Map();
workspaceDetection.projects.forEach(project => {
  repositoryConfig.set(project.name, [{
    name: 'origin',
    type: 'github',
    url: `https://github.com/mycompany/${project.name}.git`,
    webUrl: `https://github.com/mycompany/${project.name}`,
    visibility: 'private',
    action: 'add'
  }]);
});

// Generate workspace-aware settings
const settings = await settingsGen.generateSettings(
  projectTypes.nodejs,
  'D:\\my_workspace',
  { 
    projectName: 'my-workspace',
    hooksConfig: hooksConfig,
    workspaceDetection: workspaceDetection,
    repositoryConfig: repositoryConfig
  }
);

// Write settings with full workspace and repository info
await settingsGen.writeSettings(settings, 'D:\\my_workspace');
console.log('Generated workspace configuration with repository management!');
```

## Examples

### Node.js Project
```bash
cd my-node-app
claude-gen init --type nodejs
```

Generated files:
- `.claude/settings.local.json` with npm scripts
- `mcp-server.js` with Node.js commands

### Python Project
```bash
cd my-python-app
claude-gen init --type python
```

Generated files:
- `.claude/settings.local.json` with Python tools
- `mcp_server.py` with pip and pytest commands

### Auto-Detection with Hooks
```bash
cd any-project
claude-gen init --auto-detect
# Automatically detects: React, Next.js, Python, etc.
# Prompts for hooks configuration
# Generates .claude/settings.local.json with hooks enabled
```

### Complete Workspace Example
```bash
# Generate configuration for a multi-project workspace
claude-gen init --auto-detect --directory d:\my_awesome_workspace

# What happens:
# 1. Detects workspace structure (Lerna, Nx, etc.)
# 2. Scans and identifies all projects in the workspace
# 3. Shows project detection results with confidence scores
# 4. Analyzes files across all projects
# 5. Prompts for workspace file configuration (multi-project aware)
# 6. Configures repositories per project with visibility settings
# 7. Sets up hooks for the entire workspace
# 8. Generates comprehensive .claude/settings.local.json

# Example output:
🔍 Detecting workspace structure...
📦 Found Lerna Monorepo  
🏗️  Structure: workspace
📁 Projects found: 3
  frontend (nextjs) - 67 files - 95% confidence
  backend (nodejs) - 45 files - 90% confidence
  shared (typescript) - 23 files - 85% confidence

🔍 Scanning workspace files...
📁 Found files: 135 files, 2.8 MB
  .tsx: 28 files    .ts: 19 files    .js: 12 files

? How would you like to configure workspace files?
❯ Use recommended patterns for this project type (12 patterns)
  Use all scanned files from this directory (135 files)

📋 Using 12 workspace patterns:
  frontend/src/**/*.tsx
  frontend/package.json
  backend/src/**/*.js
  backend/package.json
  shared/**/*.ts
  *.md

🔧 Configuring repositories...

📁 Configuring repository for: frontend (nextjs)
? Configure repository settings for frontend? Yes
  ✅ Added github: https://github.com/company/frontend.git
     🔒 Private repository

📁 Configuring repository for: backend (nodejs)
? Configure repository settings for backend? Yes  
  ✅ Added work: https://gitlab.company.com/api/backend.git
     🏢 Internal repository

✅ Claude settings written to: .claude/settings.local.json
✅ MCP server written to: mcp-server.js
```

## Troubleshooting

### Common Issues

1. **Permission denied**: Ensure you have write access to the target directory
2. **Module not found**: Run `npm install` in the generator directory
3. **Invalid JSON**: Check `.claude/settings.local.json` syntax with `claude-gen validate`

### Getting Help

```bash
claude-gen --help
claude-gen init --help
claude-gen scan --help
claude-gen validate --help
```

## Testing

The project includes a comprehensive testing framework with unit tests, integration tests, and fixtures for different project types.

### Running Tests

```bash
# Install dependencies and set up test environment
npm install

# Run all tests
npm test

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:watch         # Watch mode for development
npm run test:coverage      # Tests with coverage report

# Code quality
npm run lint               # Check code style
npm run lint:fix           # Fix linting issues automatically
npm run ci                 # Full CI pipeline (lint + test + coverage)
```

### Test Structure

```
tests/
├── unit/                  # Unit tests for individual classes
│   ├── workspace-detector.test.js
│   ├── repository-manager.test.js
│   └── claude-settings-generator.test.js
├── integration/           # Integration tests for CLI commands
│   └── cli.test.js
├── fixtures/              # Test data and mock projects
│   ├── package.json       # Node.js project fixture
│   ├── Cargo.toml         # Rust project fixture
│   ├── lerna.json         # Lerna monorepo fixture
│   ├── sample-claude-config.json
│   └── mcp-server-templates/
└── helpers/               # Test utilities
    └── test-utils.js      # Helper functions for creating test projects
```

### Test Coverage

The testing framework covers:

- **Workspace Detection**: All supported workspace types (Lerna, Nx, pnpm, etc.)
- **Repository Management**: Multi-platform Git repository handling
- **CLI Commands**: Interactive prompts and command-line options
- **Configuration Generation**: Claude settings and MCP server creation
- **Project Type Detection**: Auto-detection with confidence scoring
- **File System Operations**: Directory scanning and file pattern matching

### Adding Tests for New Features

When adding new project types or features:

1. **Create unit tests** for utility classes in `tests/unit/`
2. **Add integration tests** for CLI commands in `tests/integration/`
3. **Create test fixtures** in `tests/fixtures/` for new project types
4. **Use test utilities** from `tests/helpers/test-utils.js` for common operations

Example:
```javascript
const { createTestProject, runCLICommand } = require('../helpers/test-utils');

test('should detect Vue.js project', async () => {
  const testDir = await createTestProject({
    'package.json': {
      name: 'vue-app',
      dependencies: { vue: '^3.0.0' }
    },
    'src/main.js': 'import { createApp } from "vue"; createApp({}).mount("#app");'
  });
  
  const result = await runCLICommand(['scan', '--directory', testDir]);
  expect(result.stdout).toContain('Project type: vue');
});
```

## Development

### Project Structure

```
src/
├── cli.js                 # Main CLI interface
├── generators/            # Configuration generators
│   ├── claude-settings.js # Claude settings generator
│   └── mcp-server.js      # MCP server generator
├── utils/                 # Utility classes
│   ├── workspace-detector.js   # Workspace/monorepo detection
│   ├── repository-manager.js   # Git repository management
│   └── hooks-manager.js        # Claude Code hooks
├── templates/             # Project type definitions
│   └── project-types.js   # Supported project configurations
scripts/
├── test-setup.js          # Test environment setup
tests/                     # Test suite
├── unit/                  # Unit tests
├── integration/           # Integration tests
├── fixtures/              # Test data and mock projects
└── helpers/               # Test utilities
```

### Development Workflow

1. **Clone and setup**:
   ```bash
   git clone <repository>
   cd claude-mcp-generator
   npm install
   npm link  # Create global symlink for testing
   ```

2. **Development**:
   ```bash
   npm run dev               # Start development with auto-reload
   npm run test:watch        # Run tests in watch mode
   npm run lint:fix          # Fix code style issues
   ```

3. **Testing changes**:
   ```bash
   # Test CLI globally after npm link
   claude-gen init --auto-detect --directory /path/to/test/project
   
   # Or run directly
   node src/cli.js init --auto-detect --directory /path/to/test/project
   ```

4. **Before committing**:
   ```bash
   npm run ci                # Run full CI pipeline
   ```

### Continuous Integration

The project uses GitHub Actions for CI/CD:

- **Multi-platform testing**: Ubuntu, Windows
- **Multiple Node.js versions**: 16.x, 18.x, 20.x  
- **Automated testing**: Unit tests, integration tests, linting
- **Coverage reporting**: Uploaded to Codecov
- **Quality gates**: All tests must pass before merge

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Run the test suite (`npm run ci`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Contribution Guidelines

- **Follow existing code style** (enforced by ESLint)
- **Add tests** for new features or project types
- **Update documentation** for user-facing changes
- **Test on multiple platforms** (Windows and Unix paths)
- **Include fixtures** for new project types in `tests/fixtures/`

## License

MIT License - see LICENSE file for details.