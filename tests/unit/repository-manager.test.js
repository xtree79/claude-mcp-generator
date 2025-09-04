const { describe, test, expect, beforeEach } = require('@jest/globals');
const RepositoryManager = require('../../src/utils/repository-manager');

describe('RepositoryManager', () => {
  let manager;

  beforeEach(() => {
    manager = new RepositoryManager();
  });

  describe('detectRepositoryType', () => {
    test('should detect GitHub repositories', () => {
      expect(manager.detectRepositoryType('https://github.com/user/repo.git')).toBe('github');
      expect(manager.detectRepositoryType('git@github.com:user/repo.git')).toBe('github');
    });

    test('should detect GitLab repositories', () => {
      expect(manager.detectRepositoryType('https://gitlab.com/user/repo.git')).toBe('gitlab');
      expect(manager.detectRepositoryType('https://gitlab.company.com/team/repo.git')).toBe('gitlab');
    });

    test('should detect Azure DevOps repositories', () => {
      expect(manager.detectRepositoryType('https://dev.azure.com/org/project/_git/repo')).toBe('azure');
    });

    test('should detect Gitea repositories', () => {
      expect(manager.detectRepositoryType('https://gitea.example.com/user/repo.git')).toBe('gitea');
    });

    test('should default to custom for unknown repositories', () => {
      expect(manager.detectRepositoryType('https://unknown.example.com/repo.git')).toBe('custom');
    });
  });

  describe('parseRepositoryUrl', () => {
    test('should parse GitHub HTTPS URL', () => {
      const result = manager.parseRepositoryUrl('https://github.com/mycompany/myrepo.git', 'github');
      
      expect(result.host).toBe('github.com');
      expect(result.owner).toBe('mycompany');
      expect(result.repo).toBe('myrepo');
    });

    test('should parse GitHub SSH URL', () => {
      const result = manager.parseRepositoryUrl('git@github.com:mycompany/myrepo.git', 'github');
      
      expect(result.host).toBe('github.com');
      expect(result.owner).toBe('mycompany');
      expect(result.repo).toBe('myrepo');
    });

    test('should parse Azure DevOps URL', () => {
      const result = manager.parseRepositoryUrl('https://dev.azure.com/myorg/myproject/_git/myrepo', 'azure');
      
      expect(result.host).toBe('dev.azure.com');
      expect(result.org).toBe('myorg');
      expect(result.owner).toBe('myproject');
      expect(result.repo).toBe('myrepo');
    });

    test('should handle malformed URLs gracefully', () => {
      const result = manager.parseRepositoryUrl('not-a-url', 'github');
      
      expect(result.host).toBeNull();
      expect(result.owner).toBeNull();
      expect(result.repo).toBeNull();
    });
  });

  describe('generateRepositoryUrl', () => {
    test('should generate GitHub HTTPS URL', () => {
      const details = {
        owner: 'mycompany',
        repo: 'myproject',
        protocol: 'https'
      };

      const result = manager.generateRepositoryUrl('github', details);
      
      expect(result).toBe('https://github.com/mycompany/myproject.git');
    });

    test('should generate GitHub SSH URL', () => {
      const details = {
        owner: 'mycompany',
        repo: 'myproject',
        protocol: 'ssh'
      };

      const result = manager.generateRepositoryUrl('github', details);
      
      expect(result).toBe('git@github.com:mycompany/myproject.git');
    });

    test('should generate custom Gitea URL', () => {
      const details = {
        host: 'git.example.com',
        owner: 'team',
        repo: 'project',
        protocol: 'https'
      };

      const result = manager.generateRepositoryUrl('gitea', details);
      
      expect(result).toBe('https://git.example.com/team/project.git');
    });

    test('should handle Azure DevOps URL generation', () => {
      const details = {
        owner: 'myorg',  // org
        project: 'myproject',
        repo: 'myrepo',
        protocol: 'https'
      };

      const result = manager.generateRepositoryUrl('azure', details);
      
      expect(result).toBe('https://dev.azure.com/myorg/myproject/_git/myrepo');
    });
  });

  describe('generateWebUrl', () => {
    test('should generate GitHub web URL', () => {
      const details = {
        owner: 'mycompany',
        repo: 'myproject'
      };

      const result = manager.generateWebUrl('github', details);
      
      expect(result).toBe('https://github.com/mycompany/myproject');
    });

    test('should return null for custom repositories', () => {
      const details = {
        owner: 'someone',
        repo: 'something'
      };

      const result = manager.generateWebUrl('custom', details);
      
      expect(result).toBeNull();
    });
  });

  describe('getVisibilityChoices', () => {
    test('should return basic choices for GitHub', () => {
      const choices = manager.getVisibilityChoices('github');
      
      expect(choices).toHaveLength(3);
      expect(choices.some(c => c.value === 'private')).toBe(true);
      expect(choices.some(c => c.value === 'public')).toBe(true);
      expect(choices.some(c => c.value === 'internal')).toBe(true);
    });

    test('should return appropriate choices for GitLab', () => {
      const choices = manager.getVisibilityChoices('gitlab');
      
      expect(choices).toHaveLength(3);
      expect(choices.some(c => c.value === 'internal')).toBe(true);
    });
  });

  describe('getVisibilityIcon', () => {
    test('should return correct icons for visibility levels', () => {
      expect(manager.getVisibilityIcon('private')).toBe('🔒');
      expect(manager.getVisibilityIcon('public')).toBe('🌍');
      expect(manager.getVisibilityIcon('internal')).toBe('🏢');
      expect(manager.getVisibilityIcon('unknown')).toBe('❓');
    });
  });

  describe('parseGitRemotes', () => {
    test('should parse git config remotes correctly', () => {
      const gitConfig = `
[core]
    repositoryformatversion = 0
[remote "origin"]
    url = https://github.com/user/repo.git
    fetch = +refs/heads/*:refs/remotes/origin/*
[remote "upstream"]
    url = git@github.com:upstream/repo.git
    fetch = +refs/heads/*:refs/remotes/upstream/*
      `;

      const result = manager.parseGitRemotes(gitConfig);
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('origin');
      expect(result[0].url).toBe('https://github.com/user/repo.git');
      expect(result[0].type).toBe('github');
      expect(result[1].name).toBe('upstream');
      expect(result[1].type).toBe('github');
    });
  });
});