#!/usr/bin/env python3

import asyncio
import json
import sys
from typing import Any, Dict, List, Optional

from mcp.server.models import InitializationOptions
from mcp.server import NotificationOptions, Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    CallToolRequest,
    ListToolsRequest,
    TextContent,
    Tool,
)

server = Server("test-python-project")

@server.list_tools()
async def handle_list_tools() -> List[Tool]:
    """List available tools."""
    return [
        Tool(
            name="run_python_test",
            description="Run Python tests",
            inputSchema={
                "type": "object",
                "properties": {
                    "test_path": {
                        "type": "string",
                        "description": "Path to test file or directory",
                    },
                    "verbose": {
                        "type": "boolean",
                        "description": "Run tests in verbose mode",
                        "default": False,
                    },
                },
                "required": ["test_path"],
            },
        ),
        Tool(
            name="format_code",
            description="Format Python code using black",
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to Python file to format",
                    },
                },
                "required": ["file_path"],
            },
        ),
    ]

@server.call_tool()
async def handle_call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
    """Handle tool calls."""
    if name == "run_python_test":
        test_path = arguments.get("test_path")
        verbose = arguments.get("verbose", False)
        
        result = f"Running Python tests for: {test_path}"
        if verbose:
            result += " (verbose mode)"
            
        return [TextContent(type="text", text=result)]
    
    elif name == "format_code":
        file_path = arguments.get("file_path")
        return [TextContent(
            type="text",
            text=f"Formatted Python file: {file_path}"
        )]
    
    else:
        raise ValueError(f"Unknown tool: {name}")

async def main():
    """Main server entry point."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="test-python-project",
                server_version="1.0.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())