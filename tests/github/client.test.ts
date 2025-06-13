/// <reference types="vitest" />

import { describe, it, expect, vi } from "vitest";
import { GithubClient } from "../../src/github/client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GithubConfig } from "../../src/github/types";

// Mock the McpServer
const mockTool = vi.fn();
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => {
  return {
    McpServer: vi.fn().mockImplementation(() => {
      return {
        tool: mockTool,
      };
    }),
  };
});

// Mock Octokit
const mockSearchCode = vi.fn();
vi.mock("@octokit/rest", () => {
  const Octokit = vi.fn().mockImplementation(() => {
    return {
      search: {
        code: mockSearchCode,
      },
    };
  });
  return { Octokit };
});

describe("GithubClient searchFiles", () => {
  const config: GithubConfig = {
    owner: "test-owner",
    repo: "test-repo",
    githubToken: "test-token",
  };

  const server = new McpServer({
    name: "test-server",
    version: "1.0.0",
  });
  const client = new GithubClient(config);
  client.registerGithubTools(server);

  const searchFilesCall = mockTool.mock.calls.find(
    (call) => call[0] === "searchFiles"
  );
  if (!searchFilesCall) {
    throw new Error("searchFiles tool not registered");
  }
  const searchFilesImpl = searchFilesCall[3];

  it("should construct the correct query for a multi-word search in 'all' mode", async () => {
    mockSearchCode.mockResolvedValue({
      data: { total_count: 0, items: [] },
    });

    const query = "OKR 2025";
    await searchFilesImpl({ query, searchIn: "all" });

    expect(mockSearchCode).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'OKR 2025 repo:test-owner/test-repo OR path:"OKR 2025" repo:test-owner/test-repo OR filename:"OKR 2025" repo:test-owner/test-repo',
      })
    );
  });

  it("should construct the correct query for a single-word search in 'all' mode", async () => {
    mockSearchCode.mockResolvedValue({
      data: { total_count: 0, items: [] },
    });

    const query = "refactor";
    await searchFilesImpl({ query, searchIn: "all" });

    expect(mockSearchCode).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "refactor repo:test-owner/test-repo OR path:refactor repo:test-owner/test-repo OR filename:refactor repo:test-owner/test-repo",
      })
    );
  });

  it("should construct the correct query for a path-like search in 'all' mode", async () => {
    mockSearchCode.mockResolvedValue({
      data: { total_count: 0, items: [] },
    });

    const query = "src/components/Button.tsx";
    await searchFilesImpl({ query, searchIn: "all" });

    expect(mockSearchCode).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'src/components/Button.tsx repo:test-owner/test-repo OR path:"src/components/Button.tsx" repo:test-owner/test-repo',
      })
    );
  });
});
