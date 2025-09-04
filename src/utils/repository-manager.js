const fs = require('fs-extra');
const path = require('path');

class RepositoryManager {
  constructor() {
    this.repositoryTypes = {
      github: {
        name: 'GitHub',
        description: 'GitHub.com - Public and private repositories',
        baseUrl: 'https://github.com',
        sshFormat: 'git@github.com:{owner}/{repo}.git',
        httpsFormat: 'https://github.com/{owner}/{repo}.git',
        webFormat: 'https://github.com/{owner}/{repo}',
        supportsPages: true,
        supportsActions: true,
        supportsPackages: true
      },
      
      gitea: {
        name: 'Gitea',
        description: 'Self-hosted Git service with a web interface',
        baseUrl: null, // User-provided
        sshFormat: 'git@{host}:{owner}/{repo}.git',
        httpsFormat: 'https://{host}/{owner}/{repo}.git',
        webFormat: 'https://{host}/{owner}/{repo}',
        supportsPages: true,
        supportsActions: true,
        supportsPackages: false
      },
      
      gitlab: {
        name: 'GitLab',
        description: 'GitLab.com or self-hosted GitLab instance',
        baseUrl: 'https://gitlab.com',
        sshFormat: 'git@{host}:{owner}/{repo}.git',
        httpsFormat: 'https://{host}/{owner}/{repo}.git',
        webFormat: 'https://{host}/{owner}/{repo}',
        supportsPages: true,
        supportsActions: true,
        supportsPackages: true
      },
      
      bitbucket: {
        name: 'Bitbucket',
        description: 'Atlassian Bitbucket Cloud or Server',
        baseUrl: 'https://bitbucket.org',
        sshFormat: 'git@{host}:{owner}/{repo}.git',
        httpsFormat: 'https://{host}/{owner}/{repo}.git',
        webFormat: 'https://{host}/{owner}/{repo}',
        supportsPages: false,
        supportsActions: true,
        supportsPackages: false
      },
      
      azure: {
        name: 'Azure DevOps',
        description: 'Microsoft Azure DevOps Services',
        baseUrl: 'https://dev.azure.com',
        sshFormat: 'git@ssh.dev.azure.com:v3/{org}/{project}/{repo}',
        httpsFormat: 'https://dev.azure.com/{org}/{project}/_git/{repo}',
        webFormat: 'https://dev.azure.com/{org}/{project}/_git/{repo}',
        supportsPages: false,
        supportsActions: true,
        supportsPackages: true
      },
      
      custom: {
        name: 'Custom Repository',
        description: 'Custom Git repository (self-hosted or other)',
        baseUrl: null,
        sshFormat: null,
        httpsFormat: null,
        webFormat: null,
        supportsPages: false,
        supportsActions: false,
        supportsPackages: false
      }
    };

    this.defaultRemoteNames = {
      github: 'origin',
      gitea: 'gitea',
      gitlab: 'gitlab', 
      bitbucket: 'bitbucket',
      azure: 'azure',
      custom: 'custom'
    };
  }

  async analyzeExistingRepositories(projectPath) {
    const repoInfo = {
      hasGit: false,
      remotes: [],
      currentBranch: null,
      hasCommits: false
    };

    try {
      const gitDir = path.join(projectPath, '.git');
      if (!await fs.pathExists(gitDir)) {
        return repoInfo;
      }

      repoInfo.hasGit = true;

      // Try to read git config for remotes
      const gitConfig = path.join(gitDir, 'config');
      if (await fs.pathExists(gitConfig)) {
        const configContent = await fs.readFile(gitConfig, 'utf8');
        repoInfo.remotes = this.parseGitRemotes(configContent);
      }

      // Try to get current branch
      const headFile = path.join(gitDir, 'HEAD');
      if (await fs.pathExists(headFile)) {
        const headContent = await fs.readFile(headFile, 'utf8').catch(() => '');
        const branchMatch = headContent.match(/ref: refs\/heads\/(.+)/);
        if (branchMatch) {
          repoInfo.currentBranch = branchMatch[1].trim();
        }
      }

      // Check if there are any commits
      const refsHeads = path.join(gitDir, 'refs', 'heads');
      if (await fs.pathExists(refsHeads)) {
        const branches = await fs.readdir(refsHeads).catch(() => []);
        repoInfo.hasCommits = branches.length > 0;
      }

    } catch (error) {
      console.warn(`Error analyzing git repository in ${projectPath}:`, error.message);
    }

    return repoInfo;
  }

  parseGitRemotes(configContent) {
    const remotes = [];
    const remoteMatches = configContent.matchAll(/\[remote "([^"]+)"\]\s*\n\s*url\s*=\s*(.+)/g);
    
    for (const match of remoteMatches) {
      const [, name, url] = match;
      const repoType = this.detectRepositoryType(url.trim());
      const repoInfo = this.parseRepositoryUrl(url.trim(), repoType);
      
      remotes.push({
        name: name.trim(),
        url: url.trim(),
        type: repoType,
        ...repoInfo
      });
    }
    
    return remotes;
  }

  detectRepositoryType(url) {
    if (url.includes('github.com')) return 'github';
    if (url.includes('gitlab.com') || url.includes('gitlab')) return 'gitlab';
    if (url.includes('bitbucket.org') || url.includes('bitbucket')) return 'bitbucket';
    if (url.includes('dev.azure.com') || url.includes('visualstudio.com')) return 'azure';
    if (url.includes('gitea')) return 'gitea';
    return 'custom';
  }

  parseRepositoryUrl(url, type) {
    const info = { host: null, owner: null, repo: null, org: null };
    
    try {
      if (url.startsWith('git@')) {
        // SSH format: git@host:owner/repo.git
        const sshMatch = url.match(/git@([^:]+):(.+)\/(.+?)(?:\.git)?$/);
        if (sshMatch) {
          info.host = sshMatch[1];
          info.owner = sshMatch[2];
          info.repo = sshMatch[3];
        }
      } else if (url.startsWith('https://')) {
        // HTTPS format varies by provider
        if (type === 'azure') {
          // https://dev.azure.com/org/project/_git/repo
          const azureMatch = url.match(/https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/(.+)/);
          if (azureMatch) {
            info.host = 'dev.azure.com';
            info.org = azureMatch[1];
            info.owner = azureMatch[2]; // project name
            info.repo = azureMatch[3];
          }
        } else {
          // Standard format: https://host/owner/repo(.git)
          const httpsMatch = url.match(/https:\/\/([^/]+)\/(.+?)\/(.+?)(?:\.git)?(?:\/.*)?$/);
          if (httpsMatch) {
            info.host = httpsMatch[1];
            info.owner = httpsMatch[2];
            info.repo = httpsMatch[3];
          }
        }
      }
    } catch (error) {
      console.warn(`Error parsing repository URL ${url}:`, error.message);
    }
    
    return info;
  }

  generateRepositoryChoices(existingRemotes = []) {
    const choices = [];
    
    // Add existing remotes first
    if (existingRemotes.length > 0) {
      choices.push({ type: 'separator', line: '--- Existing Remotes ---' });
      existingRemotes.forEach(remote => {
        const repoType = this.repositoryTypes[remote.type];
        choices.push({
          name: `Keep ${remote.name} (${repoType?.name || remote.type}) - ${remote.url}`,
          value: { action: 'keep', remote },
          checked: true
        });
      });
    }

    // Add new repository options
    choices.push({ type: 'separator', line: '--- Add New Repository ---' });
    
    Object.entries(this.repositoryTypes).forEach(([key, config]) => {
      if (key !== 'custom') {
        choices.push({
          name: `${config.name} - ${config.description}`,
          value: { action: 'add', type: key },
          checked: false
        });
      }
    });

    choices.push({
      name: 'Custom Repository - Specify your own Git server',
      value: { action: 'add', type: 'custom' },
      checked: false
    });

    choices.push({ type: 'separator', line: '--- Other Options ---' });
    choices.push({
      name: 'Skip repository configuration',
      value: { action: 'skip' },
      checked: false
    });

    return choices;
  }

  async promptForRepositoryDetails(type, projectName) {
    const config = this.repositoryTypes[type];
    const prompts = [];

    if (type === 'custom') {
      prompts.push({
        type: 'input',
        name: 'name',
        message: 'Remote name:',
        default: 'origin'
      });
      prompts.push({
        type: 'input',
        name: 'url',
        message: 'Repository URL:',
        validate: (input) => input.length > 0 || 'Repository URL is required'
      });
      prompts.push({
        type: 'list',
        name: 'visibility',
        message: 'Repository visibility:',
        choices: [
          { name: 'Private - Only you and collaborators can access', value: 'private' },
          { name: 'Public - Anyone can view this repository', value: 'public' },
          { name: 'Internal - Organization members can access', value: 'internal' },
          { name: 'Unknown - Visibility not specified', value: 'unknown' }
        ],
        default: 'private'
      });
    } else {
      prompts.push({
        type: 'input',
        name: 'name',
        message: `Remote name for ${config.name}:`,
        default: this.defaultRemoteNames[type] || type
      });

      if (type === 'gitea' || (type === 'gitlab' && config.baseUrl === null)) {
        prompts.push({
          type: 'input',
          name: 'host',
          message: `${config.name} host (e.g., git.example.com):`,
          validate: (input) => input.length > 0 || 'Host is required'
        });
      }

      prompts.push({
        type: 'input',
        name: 'owner',
        message: type === 'azure' ? 'Organization:' : 'Repository owner/username:',
        validate: (input) => input.length > 0 || 'Owner is required'
      });

      if (type === 'azure') {
        prompts.push({
          type: 'input',
          name: 'project',
          message: 'Project name:',
          validate: (input) => input.length > 0 || 'Project name is required'
        });
      }

      prompts.push({
        type: 'input',
        name: 'repo',
        message: 'Repository name:',
        default: projectName,
        validate: (input) => input.length > 0 || 'Repository name is required'
      });

      // Repository visibility
      prompts.push({
        type: 'list',
        name: 'visibility',
        message: 'Repository visibility:',
        choices: this.getVisibilityChoices(type),
        default: this.getDefaultVisibility(type)
      });

      prompts.push({
        type: 'list',
        name: 'protocol',
        message: 'Preferred protocol:',
        choices: [
          { name: 'HTTPS (recommended for most users)', value: 'https' },
          { name: 'SSH (requires SSH key setup)', value: 'ssh' }
        ],
        default: 'https'
      });
    }

    return prompts;
  }

  getVisibilityChoices(type) {
    const baseChoices = [
      { name: 'Private - Only you and collaborators can access', value: 'private' },
      { name: 'Public - Anyone can view this repository', value: 'public' }
    ];

    // Add platform-specific choices
    if (type === 'gitlab' || type === 'azure') {
      baseChoices.splice(1, 0, { 
        name: 'Internal - Organization/group members can access', 
        value: 'internal' 
      });
    }

    if (type === 'github') {
      // GitHub has different terminology for enterprise
      baseChoices.splice(1, 0, { 
        name: 'Internal - Enterprise members can access (GitHub Enterprise only)', 
        value: 'internal' 
      });
    }

    return baseChoices;
  }

  getDefaultVisibility(_type) {
    // Most work/corporate repos default to private
    return 'private';
  }

  generateRepositoryUrl(type, details) {
    const config = this.repositoryTypes[type];
    
    if (type === 'custom') {
      return details.url;
    }

    const host = details.host || config.baseUrl?.replace('https://', '') || 'github.com';
    const protocol = details.protocol || 'https';
    
    let template;
    if (protocol === 'ssh') {
      template = config.sshFormat;
    } else {
      template = config.httpsFormat;
    }

    // Replace placeholders
    let url = template
      .replace('{host}', host)
      .replace('{owner}', details.owner)
      .replace('{repo}', details.repo);

    // Handle Azure DevOps special case
    if (type === 'azure') {
      url = url
        .replace('{org}', details.owner)
        .replace('{project}', details.project);
    }

    return url;
  }

  generateWebUrl(type, details) {
    const config = this.repositoryTypes[type];
    
    if (type === 'custom' || !config.webFormat) {
      return null;
    }

    const host = details.host || config.baseUrl?.replace('https://', '') || 'github.com';
    
    let url = config.webFormat
      .replace('{host}', host)
      .replace('{owner}', details.owner)
      .replace('{repo}', details.repo);

    // Handle Azure DevOps special case
    if (type === 'azure') {
      url = url
        .replace('{org}', details.owner)
        .replace('{project}', details.project);
    }

    return url;
  }

  generateRepositoryCommands(repositories, _projectPath) {
    const commands = {
      setup: [],
      push: [],
      deploy: []
    };

    repositories.forEach(repo => {
      if (repo.action === 'add') {
        // Git remote add command
        commands.setup.push(`git remote add ${repo.name} ${repo.url}`);
        
        // Push command
        commands.push.push(`git push -u ${repo.name} main`);

        // Generate deploy commands based on repository type
        const deployCommands = this.generateDeployCommands(repo);
        commands.deploy.push(...deployCommands);
      }
    });

    return commands;
  }

  generateDeployCommands(repo) {
    const commands = [];
    const config = this.repositoryTypes[repo.type];

    if (config?.supportsActions && (repo.type === 'github' || repo.type === 'gitlab')) {
      commands.push(`# ${config.name} Actions/CI deployment will be triggered automatically on push`);
    }

    if (config?.supportsPages && repo.type === 'github') {
      commands.push(`# Enable GitHub Pages: Visit ${this.generateWebUrl(repo.type, repo)}/settings/pages`);
    }

    if (config?.supportsPackages) {
      commands.push(`# Package publishing available for ${config.name}`);
    }

    return commands;
  }

  formatRepositorySummary(repositories) {
    return repositories.map(repo => {
      const config = this.repositoryTypes[repo.type];
      const webUrl = this.generateWebUrl(repo.type, repo);
      
      return {
        name: repo.name,
        type: config?.name || repo.type,
        url: repo.url,
        webUrl,
        visibility: repo.visibility || 'unknown',
        features: {
          pages: config?.supportsPages || false,
          actions: config?.supportsActions || false,
          packages: config?.supportsPackages || false
        }
      };
    });
  }

  getVisibilityIcon(visibility) {
    switch (visibility) {
    case 'private': return '🔒';
    case 'public': return '🌍';  
    case 'internal': return '🏢';
    default: return '❓';
    }
  }

  getVisibilityDescription(visibility) {
    switch (visibility) {
    case 'private': return 'Private - Only collaborators can access';
    case 'public': return 'Public - Anyone can view';
    case 'internal': return 'Internal - Organization members can access';
    default: return 'Unknown visibility';
    }
  }
}

module.exports = RepositoryManager;