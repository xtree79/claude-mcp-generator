const projectTypes = require('../templates/project-types');
const ClaudeSettingsGenerator = require('./generators/claude-settings');
const McpServerGenerator = require('./generators/mcp-server');
const WorkspaceScanner = require('./utils/workspace-scanner');
const PermissionManager = require('./utils/permission-manager');

module.exports = {
  projectTypes,
  ClaudeSettingsGenerator,
  McpServerGenerator,
  WorkspaceScanner,
  PermissionManager
};