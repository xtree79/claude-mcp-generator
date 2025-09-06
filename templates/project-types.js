const projectTypes = {
  nodejs: {
    name: 'Node.js Project',
    shell: 'bash',
    commands: {
      install: 'npm install',
      dev: 'npm run dev',
      build: 'npm run build',
      test: 'npm test',
      lint: 'npm run lint',
      typecheck: 'npm run typecheck'
    },
    workspaceFiles: ['package.json', 'src/**/*.js', 'src/**/*.ts', '*.md'],
    permissions: {
      read: ['./', './src', './dist', './node_modules'],
      write: ['./', './src', './dist']
    },
    mcpServer: {
      name: 'nodejs-mcp-server',
      command: 'node',
      args: ['mcp-server.js']
    }
  },
  
  react: {
    name: 'React Project',
    shell: 'bash',
    commands: {
      install: 'npm install',
      dev: 'npm start',
      build: 'npm run build',
      test: 'npm test',
      lint: 'npm run lint',
      typecheck: 'npm run typecheck'
    },
    workspaceFiles: ['package.json', 'src/**/*.js', 'src/**/*.jsx', 'src/**/*.ts', 'src/**/*.tsx', 'public/**/*', '*.md'],
    permissions: {
      read: ['./', './src', './public', './build', './node_modules'],
      write: ['./', './src', './public', './build']
    },
    mcpServer: {
      name: 'react-mcp-server',
      command: 'node',
      args: ['mcp-server.js']
    }
  },

  nextjs: {
    name: 'Next.js Project',
    shell: 'bash',
    commands: {
      install: 'npm install',
      dev: 'npm run dev',
      build: 'npm run build',
      test: 'npm test',
      lint: 'npm run lint',
      typecheck: 'npm run typecheck'
    },
    workspaceFiles: ['package.json', 'app/**/*', 'pages/**/*', 'src/**/*', 'components/**/*', 'public/**/*', '*.md', 'next.config.js'],
    permissions: {
      read: ['./', './app', './pages', './src', './components', './public', './.next', './node_modules'],
      write: ['./', './app', './pages', './src', './components', './public', './.next']
    },
    mcpServer: {
      name: 'nextjs-mcp-server',
      command: 'node',
      args: ['mcp-server.js']
    }
  },

  dotnet: {
    name: '.NET Project',
    shell: 'powershell',
    commands: {
      restore: 'dotnet restore',
      build: 'dotnet build',
      dev: 'dotnet run',
      test: 'dotnet test',
      clean: 'dotnet clean'
    },
    workspaceFiles: ['*.sln', '**/*.csproj', '**/*.cs', '**/*.json', '*.md'],
    permissions: {
      read: ['./', './src', './bin', './obj'],
      write: ['./', './src', './bin', './obj']
    },
    mcpServer: {
      name: 'dotnet-mcp-server',
      command: 'dotnet',
      args: ['run', '--project', 'McpServer']
    }
  },

  python: {
    name: 'Python Project',
    shell: 'bash',
    commands: {
      install: 'pip install -r requirements.txt',
      dev: 'python main.py',
      test: 'pytest',
      lint: 'flake8 .',
      format: 'black .'
    },
    workspaceFiles: ['*.py', '**/*.py', 'requirements.txt', 'setup.py', 'pyproject.toml', '*.md'],
    permissions: {
      read: ['./', './src', './__pycache__', './venv'],
      write: ['./', './src', './__pycache__']
    },
    mcpServer: {
      name: 'python-mcp-server',
      command: 'python',
      args: ['mcp_server.py']
    }
  },

  rust: {
    name: 'Rust Project',
    shell: 'bash',
    commands: {
      build: 'cargo build',
      dev: 'cargo run',
      test: 'cargo test',
      check: 'cargo check',
      fmt: 'cargo fmt',
      clippy: 'cargo clippy'
    },
    workspaceFiles: ['Cargo.toml', 'Cargo.lock', 'src/**/*.rs', '*.md'],
    permissions: {
      read: ['./', './src', './target'],
      write: ['./', './src', './target']
    },
    mcpServer: {
      name: 'rust-mcp-server',
      command: 'cargo',
      args: ['run', '--bin', 'mcp-server']
    }
  },

  go: {
    name: 'Go Project',
    shell: 'bash',
    commands: {
      build: 'go build',
      dev: 'go run .',
      test: 'go test ./...',
      mod: 'go mod tidy',
      fmt: 'go fmt ./...',
      vet: 'go vet ./...'
    },
    workspaceFiles: ['go.mod', 'go.sum', '**/*.go', '*.md'],
    permissions: {
      read: ['./', './cmd', './internal', './pkg'],
      write: ['./', './cmd', './internal', './pkg']
    },
    mcpServer: {
      name: 'go-mcp-server',
      command: 'go',
      args: ['run', 'mcp-server.go']
    }
  },

  docker: {
    name: 'Docker Project',
    shell: 'bash',
    commands: {
      build: 'docker-compose build',
      up: 'docker-compose up',
      down: 'docker-compose down',
      logs: 'docker-compose logs',
      ps: 'docker-compose ps',
      restart: 'docker-compose restart'
    },
    workspaceFiles: ['docker-compose.yml', 'docker-compose.yaml', 'Dockerfile', '**/*.py', '**/*.js', '**/*.ts', 'requirements.txt', 'package.json', '*.md'],
    permissions: {
      read: ['./', './src', './app', './api', './web'],
      write: ['./', './src', './app', './api', './web']
    },
    mcpServer: {
      name: 'docker-mcp-server',
      command: 'node',
      args: ['mcp-server.js']
    }
  }
};

module.exports = projectTypes;