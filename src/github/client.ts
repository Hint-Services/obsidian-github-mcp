import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Octokit } from "@octokit/rest";
import { z } from "zod";

import type { GithubConfig } from "./types.js";

export class GithubClient {
  private octokit: Octokit;

  constructor(private config: GithubConfig) {
    this.octokit = new Octokit({
      auth: config.githubToken,
    });
  }

  // Simplified error handler for Octokit requests
  private async handleRequest<T>(
    request: () => Promise<{ data: T }>
  ): Promise<T> {
    try {
      const { data } = await request();
      return data;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`GitHub API error: ${error.message}`);
      }
      throw new Error(`GitHub API error: ${String(error)}`);
    }
  }

  registerGithubTools(server: McpServer) {
    server.tool(
      "getFileContents",
      `Get the contents of a specific file in the configured repository (${this.config.owner}/${this.config.repo}).`,
      {
        filePath: z
          .string()
          .describe("Path to the file within the repository."),
      },
      async ({ filePath }) => {
        const fileContent = await this.handleRequest(async () => {
          return this.octokit.repos.getContent({
            owner: this.config.owner,
            repo: this.config.repo,
            path: filePath,
            // Request raw content to avoid base64 decoding complexities for now
            mediaType: {
              format: "raw",
            },
          });
        });

        // The raw format returns the content directly as a string
        if (typeof fileContent !== "string") {
          throw new Error(
            "Received unexpected content format from GitHub API."
          );
        }

        return {
          content: [{ type: "text", text: fileContent }],
        };
      }
    );

    // Placeholder for searchFiles tool
    server.tool(
      "searchFiles",
      `Search for files within the configured repository (${this.config.owner}/${this.config.repo}).`,
      {
        query: z
          .string()
          .describe("Search query (uses GitHub Code Search syntax)"),
        page: z
          .number()
          .optional()
          .default(0)
          .describe("Page number to retrieve (0-indexed)"),
        perPage: z
          .number()
          .optional()
          .default(100)
          .describe("Number of results per page"),
      },
      async ({ query, page = 0, perPage = 100 }) => {
        const repoQualifier = `repo:${this.config.owner}/${this.config.repo}`;
        const qualifiedQuery = `${query} ${repoQualifier}`;
        const searchResults = await this.handleRequest(async () => {
          return this.octokit.search.code({
            q: qualifiedQuery,
            page,
            per_page: perPage,
          });
        });
        // Format results as a markdown list
        const formattedResults = searchResults.items
          .map((item) => `- "${item.path}"`)
          .join("\n");
        return {
          // Return formatted text instead of raw JSON string
          content: [
            {
              type: "text",
              text: `Found ${searchResults.total_count} files:\n${formattedResults}`,
            },
          ],
        };
      }
    );

    // Placeholder for searchIssues tool
    server.tool(
      "searchIssues",
      `Search for issues within the configured repository (${this.config.owner}/${this.config.repo}).`,
      {
        query: z
          .string()
          .describe("Search query (uses GitHub Issue Search syntax)"),
      },
      async ({ query }) => {
        const repoQualifier = `repo:${this.config.owner}/${this.config.repo}`;
        const qualifiedQuery = `${query} is:issue ${repoQualifier}`;
        const searchResults = await this.handleRequest(async () => {
          return this.octokit.search.issuesAndPullRequests({
            q: qualifiedQuery,
          });
        });
        // Format results as a markdown list
        const formattedResults = searchResults.items
          .map((item) => `- #${item.number} ${item.title} (${item.html_url})`)
          .join("\n");
        return {
          // Return formatted text instead of raw JSON string
          content: [
            {
              type: "text",
              text: `Found ${searchResults.total_count} issues:\n${formattedResults}`,
            },
          ],
        };
      }
    );

    // getCommitHistory tool - focuses on file changes and diffs
    server.tool(
      "getCommitHistory",
      `Get commit history for the configured repository (${this.config.owner}/${this.config.repo}) within the last X days, focusing on actual file changes and diffs.`,
      {
        days: z
          .number()
          .min(1)
          .max(365)
          .describe("Number of days to look back for commits"),
        includeDiffs: z
          .boolean()
          .optional()
          .default(true)
          .describe(
            "Whether to include actual file changes/diffs (default: true)"
          ),
        author: z
          .string()
          .optional()
          .describe("Filter commits by author username"),
        maxCommits: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .default(25)
          .describe("Maximum number of commits to return"),
        page: z
          .number()
          .optional()
          .default(0)
          .describe("Page number for pagination (0-indexed)"),
      },
      async ({
        days,
        includeDiffs = true,
        author,
        maxCommits = 25,
        page = 0,
      }) => {
        // Calculate date range
        const since = new Date();
        since.setDate(since.getDate() - days);
        const sinceISO = since.toISOString();

        console.error("sinceISO", sinceISO);

        // Fetch commits list
        const commits = await this.handleRequest(async () => {
          return this.octokit.repos.listCommits({
            owner: this.config.owner,
            repo: this.config.repo,
            since: sinceISO,
            // author: author,
            page: page,
            per_page: maxCommits,
          });
        });

        if (commits.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No commits found in the last ${days} days since ${sinceISO}${
                  author ? ` from author ${author}` : ""
                }.`,
              },
            ],
          };
        }

        let formattedOutput = `Found ${
          commits.length
        } commits in the last ${days} days${
          author ? ` from ${author}` : ""
        }:\n\n`;

        if (includeDiffs) {
          // Fetch detailed commit information with diffs
          const detailedCommits = await Promise.all(
            commits.slice(0, maxCommits).map(async (commit) => {
              const detailed = await this.handleRequest(async () => {
                return this.octokit.repos.getCommit({
                  owner: this.config.owner,
                  repo: this.config.repo,
                  ref: commit.sha,
                });
              });
              return detailed;
            })
          );

          // Format results with diffs
          for (const commit of detailedCommits) {
            const shortSha = commit.sha.substring(0, 7);
            const commitUrl = `https://github.com/${this.config.owner}/${this.config.repo}/commit/${commit.sha}`;

            formattedOutput += `## Commit ${shortSha} (${commit.sha})\n`;
            formattedOutput += `**${commit.commit.message.split("\n")[0]}**\n`;
            formattedOutput += `Author: ${commit.commit.author?.name} <${commit.commit.author?.email}>\n`;
            formattedOutput += `Date: ${commit.commit.author?.date}\n`;
            formattedOutput += `URL: ${commitUrl}\n\n`;

            if (commit.files && commit.files.length > 0) {
              formattedOutput += `### Files Changed (${commit.files.length}):\n`;
              for (const file of commit.files) {
                const additions = file.additions || 0;
                const deletions = file.deletions || 0;
                formattedOutput += `- ${file.filename} (+${additions}, -${deletions})\n`;
              }
              formattedOutput += "\n### File Changes:\n\n";

              for (const file of commit.files) {
                formattedOutput += `#### ${file.filename}\n`;
                if (file.patch) {
                  // Truncate large diffs for readability
                  let patch = file.patch;
                  const maxPatchLength = 8000; // Essay-length for note-taking
                  if (patch.length > maxPatchLength) {
                    patch = `${patch.substring(
                      0,
                      maxPatchLength
                    )}\n\n... (diff truncated for readability) ...`;
                  }
                  formattedOutput += `\`\`\`diff\n${patch}\n\`\`\`\n\n`;
                } else {
                  formattedOutput +=
                    "_No diff available (binary file or no changes to display)_\n\n";
                }
              }
            } else {
              formattedOutput += "No file changes detected.\n\n";
            }
            formattedOutput += "---\n\n";
          }
        } else {
          // Just show commit metadata without diffs
          for (const commit of commits) {
            const shortSha = commit.sha.substring(0, 7);
            const commitUrl = `https://github.com/${this.config.owner}/${this.config.repo}/commit/${commit.sha}`;

            formattedOutput += `## Commit ${shortSha}\n`;
            formattedOutput += `**${commit.commit.message.split("\n")[0]}**\n`;
            formattedOutput += `Author: ${commit.commit.author?.name} <${commit.commit.author?.email}>\n`;
            formattedOutput += `Date: ${commit.commit.author?.date}\n`;
            formattedOutput += `URL: ${commitUrl}\n\n`;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: formattedOutput,
            },
          ],
        };
      }
    );
  }
}
