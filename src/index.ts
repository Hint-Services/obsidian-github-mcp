/**
 * MCP Private GitHub Search Server - DEPRECATED
 *
 * ⚠️  DEPRECATION NOTICE: This package has been renamed to 'obsidian-github-mcp'
 * Please update your configuration to use the new package name.
 *
 * A Model Context Protocol server for searching private GitHub repositories.
 * This server provides tools for searching and analyzing GitHub repositories.
 *
 * For more information about MCP, visit:
 * https://modelcontextprotocol.io
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GithubClient } from "./github/client.js";

// DEPRECATION WARNING
console.error(`\n${"=".repeat(80)}`);
console.error(
  "⚠️  DEPRECATION NOTICE: 'mcp-private-github-search' has been renamed!"
);
console.error("");
console.error("   This package is deprecated. Please migrate to:");
console.error("   📦 'obsidian-github-mcp'");
console.error("");
console.error("   Installation:");
console.error("   npm install obsidian-github-mcp");
console.error("");
console.error("   Update your MCP configuration to use:");
console.error("   npx obsidian-github-mcp");
console.error("");
console.error("   This deprecated package will be maintained for 6 months.");
console.error(`${"=".repeat(80)}\n`);

// Read GitHub config from environment variables
const githubToken = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;

if (!githubToken || !owner || !repo) {
  throw new Error(
    "Environment variables GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO are required"
  );
}

// Create GithubClient with full config
const githubClient = new GithubClient({ githubToken, owner, repo });

/**
 * Create a new MCP server instance with full capabilities
 */
const server = new McpServer({
  name: "mcp-private-github-search",
  version: "0.2.1",
  capabilities: {
    tools: {},
    resources: {},
    prompts: {},
    streaming: true,
  },
});

/**
 * Helper function to send log messages to the client
 */
function logMessage(level: "info" | "warn" | "error", message: string) {
  console.error(`[${level.toUpperCase()}] ${message}`);
}

/**
 * Set up error handling for the server
 */
process.on("uncaughtException", (error: Error) => {
  logMessage("error", `Uncaught error: ${error.message}`);
  console.error("Server error:", error);
});

// Register GitHub tools
try {
  githubClient.registerGithubTools(server);
  logMessage("info", "Successfully registered all tools");
} catch (error) {
  logMessage(
    "error",
    `Failed to register tools: ${
      error instanceof Error ? error.message : "Unknown error"
    }`
  );
  process.exit(1);
}

/**
 * Set up proper cleanup on process termination
 */
async function cleanup() {
  try {
    await server.close();
    logMessage("info", "Server shutdown completed");
  } catch (error) {
    logMessage(
      "error",
      `Error during shutdown: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  } finally {
    process.exit(0);
  }
}

// Handle termination signals
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);

/**
 * Main server startup function
 */
async function main() {
  try {
    // Set up communication with the MCP host using stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logMessage("info", "MCP Server started successfully");
    console.error("MCP Server running on stdio transport");
  } catch (error) {
    logMessage(
      "error",
      `Failed to start server: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
