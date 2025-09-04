const fs = require('fs-extra');
const path = require('path');

class McpServerGenerator {
  constructor() {
    this.serverTemplates = {
      nodejs: this.getNodeJsTemplate(),
      python: this.getPythonTemplate(),
      dotnet: this.getDotNetTemplate(),
      rust: this.getRustTemplate(),
      go: this.getGoTemplate()
    };
  }

  getNodeJsTemplate() {
    return `#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');

const server = new Server(
  {
    name: 'PROJECT_NAME-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'execute_command',
        description: 'Execute project-specific commands',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Command to execute',
              enum: [PROJECT_COMMANDS]
            },
            args: {
              type: 'array',
              items: { type: 'string' },
              description: 'Command arguments'
            }
          },
          required: ['command']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'execute_command') {
    const { command, args: cmdArgs = [] } = args;
    
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const child = spawn(command, cmdArgs, { 
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true 
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
        resolve({
          content: [
            {
              type: 'text',
              text: \`Command: \${command} \${cmdArgs.join(' ')}\\nExit code: \${code}\\n\\nOutput:\\n\${stdout}\${stderr ? '\\nError:\\n' + stderr : ''}\`
            }
          ]
        });
      });
      
      child.on('error', (error) => {
        reject(new McpError(ErrorCode.InternalError, \`Failed to execute command: \${error.message}\`));
      });
    });
  }

  throw new McpError(ErrorCode.MethodNotFound, \`Unknown tool: \${name}\`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PROJECT_NAME MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
`;
  }

  getPythonTemplate() {
    return `#!/usr/bin/env python3

import asyncio
import logging
import subprocess
import sys
from typing import Any, Sequence

from mcp.server.models import InitializationOptions
import mcp.types as types
from mcp.server import NotificationOptions, Server
import mcp.server.stdio


logger = logging.getLogger(__name__)

server = Server("PROJECT_NAME-mcp-server")

PROJECT_COMMANDS = [PROJECT_COMMAND_LIST]

@server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="execute_command",
            description="Execute project-specific commands",
            inputSchema={
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Command to execute",
                        "enum": PROJECT_COMMANDS
                    },
                    "args": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Command arguments"
                    }
                },
                "required": ["command"]
            }
        )
    ]

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict[str, Any]) -> list[types.TextContent]:
    if name == "execute_command":
        command = arguments.get("command")
        args = arguments.get("args", [])
        
        try:
            result = subprocess.run(
                [command] + args,
                capture_output=True,
                text=True,
                shell=True
            )
            
            output = f"Command: {command} {' '.join(args)}\\n"
            output += f"Exit code: {result.returncode}\\n\\n"
            output += f"Output:\\n{result.stdout}"
            if result.stderr:
                output += f"\\nError:\\n{result.stderr}"
                
            return [types.TextContent(type="text", text=output)]
            
        except Exception as e:
            raise RuntimeError(f"Failed to execute command: {e}")
    
    raise ValueError(f"Unknown tool: {name}")

async def main():
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="PROJECT_NAME-mcp-server",
                server_version="0.1.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())
`;
  }

  getDotNetTemplate() {
    return `using System;
using System.Diagnostics;
using System.Text.Json;
using System.Threading.Tasks;
using MCP.SDK;

namespace PROJECT_NAME.McpServer
{
    public class Program
    {
        private static readonly string[] ProjectCommands = { PROJECT_COMMAND_ARRAY };

        public static async Task Main(string[] args)
        {
            var server = new McpServer("PROJECT_NAME-mcp-server", "0.1.0");

            server.RegisterTool("execute_command", "Execute project-specific commands", 
                new
                {
                    type = "object",
                    properties = new
                    {
                        command = new
                        {
                            type = "string",
                            description = "Command to execute",
                            @enum = ProjectCommands
                        },
                        args = new
                        {
                            type = "array",
                            items = new { type = "string" },
                            description = "Command arguments"
                        }
                    },
                    required = new[] { "command" }
                },
                ExecuteCommand);

            await server.RunAsync();
        }

        private static async Task<object> ExecuteCommand(dynamic arguments)
        {
            string command = arguments.command;
            string[] args = arguments.args ?? new string[0];

            try
            {
                using var process = new Process();
                process.StartInfo = new ProcessStartInfo
                {
                    FileName = command,
                    Arguments = string.Join(" ", args),
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                process.Start();
                string output = await process.StandardOutput.ReadToEndAsync();
                string error = await process.StandardError.ReadToEndAsync();
                await process.WaitForExitAsync();

                var result = $"Command: {command} {string.Join(" ", args)}\\n";
                result += $"Exit code: {process.ExitCode}\\n\\n";
                result += $"Output:\\n{output}";
                if (!string.IsNullOrEmpty(error))
                    result += $"\\nError:\\n{error}";

                return new { content = new[] { new { type = "text", text = result } } };
            }
            catch (Exception ex)
            {
                throw new Exception($"Failed to execute command: {ex.Message}");
            }
        }
    }
}
`;
  }

  getRustTemplate() {
    return `use std::process::Command;
use serde_json::{json, Value};
use tokio;

#[tokio::main]
async fn main() {
    let server = mcp_sdk::Server::new("PROJECT_NAME-mcp-server", "0.1.0");
    
    server.register_tool(
        "execute_command",
        "Execute project-specific commands",
        json!({
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "Command to execute",
                    "enum": [PROJECT_COMMAND_LIST]
                },
                "args": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Command arguments"
                }
            },
            "required": ["command"]
        }),
        execute_command
    ).await;
    
    server.run().await;
}

async fn execute_command(arguments: Value) -> Result<Value, Box<dyn std::error::Error>> {
    let command = arguments["command"].as_str().unwrap();
    let args: Vec<&str> = arguments["args"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|v| v.as_str().unwrap_or(""))
        .collect();

    let output = Command::new(command)
        .args(&args)
        .output()?;

    let result = format!(
        "Command: {} {}\\nExit code: {}\\n\\nOutput:\\n{}{}",
        command,
        args.join(" "),
        output.status.code().unwrap_or(-1),
        String::from_utf8_lossy(&output.stdout),
        if !output.stderr.is_empty() {
            format!("\\nError:\\n{}", String::from_utf8_lossy(&output.stderr))
        } else {
            String::new()
        }
    );

    Ok(json!({
        "content": [{
            "type": "text",
            "text": result
        }]
    }))
}
`;
  }

  getGoTemplate() {
    return `package main

import (
    "encoding/json"
    "fmt"
    "os"
    "os/exec"
    "strings"
)

type McpServer struct {
    Name    string \`json:"name"\`
    Version string \`json:"version"\`
}

type Tool struct {
    Name        string      \`json:"name"\`
    Description string      \`json:"description"\`
    InputSchema interface{} \`json:"inputSchema"\`
}

var projectCommands = []string{PROJECT_COMMAND_LIST}

func main() {
    server := &McpServer{
        Name:    "PROJECT_NAME-mcp-server",
        Version: "0.1.0",
    }

    // Handle MCP protocol messages
    for {
        var request map[string]interface{}
        decoder := json.NewDecoder(os.Stdin)
        if err := decoder.Decode(&request); err != nil {
            break
        }

        switch request["method"] {
        case "tools/list":
            handleListTools()
        case "tools/call":
            handleCallTool(request)
        }
    }
}

func handleListTools() {
    tools := []Tool{
        {
            Name:        "execute_command",
            Description: "Execute project-specific commands",
            InputSchema: map[string]interface{}{
                "type": "object",
                "properties": map[string]interface{}{
                    "command": map[string]interface{}{
                        "type":        "string",
                        "description": "Command to execute",
                        "enum":        projectCommands,
                    },
                    "args": map[string]interface{}{
                        "type": "array",
                        "items": map[string]interface{}{
                            "type": "string",
                        },
                        "description": "Command arguments",
                    },
                },
                "required": []string{"command"},
            },
        },
    }

    response := map[string]interface{}{
        "tools": tools,
    }
    
    json.NewEncoder(os.Stdout).Encode(response)
}

func handleCallTool(request map[string]interface{}) {
    params := request["params"].(map[string]interface{})
    name := params["name"].(string)
    arguments := params["arguments"].(map[string]interface{})

    if name == "execute_command" {
        executeCommand(arguments)
    }
}

func executeCommand(arguments map[string]interface{}) {
    command := arguments["command"].(string)
    
    var args []string
    if argsInterface, ok := arguments["args"]; ok {
        argsSlice := argsInterface.([]interface{})
        for _, arg := range argsSlice {
            args = append(args, arg.(string))
        }
    }

    cmd := exec.Command(command, args...)
    output, err := cmd.CombinedOutput()

    result := fmt.Sprintf("Command: %s %s\\nExit code: %d\\n\\nOutput:\\n%s",
        command, strings.Join(args, " "), cmd.ProcessState.ExitCode(), string(output))

    if err != nil {
        result += fmt.Sprintf("\\nError: %s", err.Error())
    }

    response := map[string]interface{}{
        "content": []map[string]interface{}{
            {
                "type": "text",
                "text": result,
            },
        },
    }

    json.NewEncoder(os.Stdout).Encode(response)
}
`;
  }

  async generateMcpServer(projectType, projectConfig, targetDir = process.cwd(), options = {}) {
    const {
      projectName = path.basename(targetDir),
      customCommands = {}
    } = options;

    // Get template based on project type
    let template = this.serverTemplates[projectType];
    if (!template) {
      // Default to Node.js template
      template = this.serverTemplates.nodejs;
    }

    // Prepare command list
    const allCommands = { ...projectConfig.commands, ...customCommands };
    const commandList = Object.keys(allCommands);

    // Replace placeholders in template
    const serverCode = template
      .replace(/PROJECT_NAME/g, projectName)
      .replace(/PROJECT_COMMANDS/g, commandList.map(cmd => `'${cmd}'`).join(', '))
      .replace(/PROJECT_COMMAND_LIST/g, commandList.map(cmd => `"${cmd}"`).join(', '))
      .replace(/PROJECT_COMMAND_ARRAY/g, commandList.map(cmd => `"${cmd}"`).join(', '));

    return {
      code: serverCode,
      filename: this.getServerFilename(projectType),
      commands: allCommands
    };
  }

  getServerFilename(projectType) {
    const extensions = {
      nodejs: 'mcp-server.js',
      python: 'mcp_server.py',
      dotnet: 'Program.cs',
      rust: 'src/main.rs',
      go: 'mcp-server.go'
    };

    return extensions[projectType] || 'mcp-server.js';
  }

  async writeMcpServer(serverData, targetDir = process.cwd()) {
    const serverPath = path.join(targetDir, serverData.filename);
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(serverPath));
    
    // Write server file
    await fs.writeFile(serverPath, serverData.code);
    
    return serverPath;
  }

  async generateAndWrite(projectType, projectConfig, targetDir = process.cwd(), options = {}) {
    const serverData = await this.generateMcpServer(projectType, projectConfig, targetDir, options);
    const serverPath = await this.writeMcpServer(serverData, targetDir);
    
    return {
      ...serverData,
      path: serverPath
    };
  }
}

module.exports = McpServerGenerator;