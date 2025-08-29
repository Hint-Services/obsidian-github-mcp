/**
 * Obsidian GitHub MCP Server
 *
 * A Model Context Protocol server for accessing GitHub repositories containing Obsidian vaults.
 * This server enables AI assistants to interact with your Obsidian knowledge base stored in GitHub.
 *
 * Features:
 * - File content retrieval from Obsidian vaults
 * - Search functionality for notes and documentation
 * - Issue tracking integration
 * - Commit history analysis for knowledge evolution
 *
 * For more information about MCP, visit:
 * https://modelcontextprotocol.io
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { GithubClient } from "./github/client.js";

// Read GitHub config from environment variables
const githubToken = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;

if (!githubToken || !owner || !repo) {
  throw new Error(
    "Environment variables GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO are required"
  );
}

export const configSchema = z.object({
  githubToken: z.string().describe("GitHub API token"),
  owner: z.string().describe("GitHub repository owner"),
  repo: z.string().describe("GitHub repository name"),
});

export default function createServer({
  config,
}: {
  config: z.infer<typeof configSchema>;
}) {
  /**
   * Create a new MCP server instance with full capabilities
   */
  const server = new McpServer({
    name: "obsidian-github-mcp",
    version: "0.4.0",
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
      streaming: true,
    },
  });

  const githubClient = new GithubClient(config);
  githubClient.registerGithubTools(server);

  return server;
}

/**
 * Helper function to send log messages to the client
 */
function logMessage(level: "info" | "warn" | "error", message: string) {
  console.error(`[${level.toUpperCase()}] ${message}`);
}

/**
 * Main server startup function
 */
async function main() {
  try {
    // Read GitHub config from environment variables
    const githubToken = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    const server = createServer({
      config: {
        githubToken: githubToken || "",
        owner: owner || "",
        repo: repo || "",
      },
    });

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
