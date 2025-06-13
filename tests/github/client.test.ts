/// <reference types="vitest" />

import { describe, it, expect, vi, beforeEach } from "vitest";
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

  let searchFilesImpl: (args: {
    query: string;
    searchIn: string;
  }) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
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
    searchFilesImpl = searchFilesCall[3];
    mockSearchCode.mockResolvedValue({
      data: { total_count: 0, items: [] },
    });
  });

  it("should use `in:file,path` for 'all' search", async () => {
    await searchFilesImpl({ query: "my query", searchIn: "all" });
    expect(mockSearchCode).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "my query in:file,path repo:test-owner/test-repo",
      })
    );
  });

  it("should use `in:path` for 'path' search", async () => {
    await searchFilesImpl({ query: "my/path", searchIn: "path" });
    expect(mockSearchCode).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "my/path in:path repo:test-owner/test-repo",
      })
    );
  });

  it("should use `filename:` for 'filename' search", async () => {
    await searchFilesImpl({ query: "MyFile.md", searchIn: "filename" });
    expect(mockSearchCode).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "filename:MyFile.md repo:test-owner/test-repo",
      })
    );
  });

  it("should quote multi-word filenames", async () => {
    await searchFilesImpl({ query: "My File.md", searchIn: "filename" });
    expect(mockSearchCode).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'filename:"My File.md" repo:test-owner/test-repo',
      })
    );
  });

  it("should search only content for 'content' search", async () => {
    await searchFilesImpl({ query: "some content", searchIn: "content" });
    expect(mockSearchCode).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "some content repo:test-owner/test-repo",
      })
    );
  });
});
