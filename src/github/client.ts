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

  // Check if configuration is complete
  private checkConfig(): void {
    if (!this.config.githubToken || !this.config.owner || !this.config.repo) {
      throw new Error(
        `GitHub configuration incomplete. Please set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO environment variables. Current config: token=${this.config.githubToken ? "set" : "missing"}, owner=${this.config.owner || "missing"}, repo=${this.config.repo || "missing"}`
      );
    }
  }

  // Simplified error handler for Octokit requests
  private async handleRequest<T>(
    request: () => Promise<{ data: T }>
  ): Promise<T> {
    this.checkConfig(); // Ensure config is complete before making requests
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

  // Run diagnostics when search returns no results
  private async runSearchDiagnostics(_originalQuery: string): Promise<{
    repoSize?: number;
    repoSizeGB?: number;
    isPrivate?: boolean;
    defaultBranch?: string;
    basicSearchWorks?: boolean;
    filesFound?: number;
    repoIndexed?: boolean;
    isLarge?: boolean;
    diagnosticError?: string;
  }> {
    try {
      // Test 1: Repository accessibility
      const repoInfo = await this.handleRequest(async () => {
        return this.octokit.repos.get({
          owner: this.config.owner,
          repo: this.config.repo,
        });
      });

      // Test 2: Basic search functionality with simple query
      let basicSearchWorks = false;
      let basicSearchCount = 0;
      try {
        const basicTest = await this.handleRequest(async () => {
          return this.octokit.search.code({
            q: `repo:${this.config.owner}/${this.config.repo} extension:md`,
            per_page: 1,
          });
        });
        basicSearchWorks = true;
        basicSearchCount = basicTest.total_count;
      } catch (_error) {
        basicSearchWorks = false;
      }

      const repoSizeKB = repoInfo.size;
      const repoSizeGB = repoSizeKB / (1024 * 1024);
      const isLarge = repoSizeGB > 50;

      return {
        repoSize: repoSizeKB,
        repoSizeGB: repoSizeGB,
        isPrivate: repoInfo.private,
        defaultBranch: repoInfo.default_branch,
        basicSearchWorks,
        filesFound: basicSearchCount,
        repoIndexed: basicSearchWorks && basicSearchCount > 0,
        isLarge,
      };
    } catch (error) {
      return {
        diagnosticError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Format response when no search results are found
  private formatNoResultsResponse(
    _searchResults: { total_count: number },
    diagnostics: {
      diagnosticError?: string;
      repoIndexed?: boolean;
      isLarge?: boolean;
      repoSizeGB?: number;
      isPrivate?: boolean;
      defaultBranch?: string;
      filesFound?: number;
    },
    query: string,
    searchIn: string
  ): { content: Array<{ type: "text"; text: string }> } {
    let resultText = `Found 0 files matching "${query}"`;
    if (searchIn !== "all") {
      resultText += ` in ${searchIn}`;
    }
    resultText += "\n\n";

    if (diagnostics.diagnosticError) {
      resultText += `⚠️ **Search System Issue**: ${diagnostics.diagnosticError}\n\n`;
    } else if (!diagnostics.repoIndexed) {
      resultText +=
        "⚠️ **Repository May Not Be Indexed**: GitHub might not have indexed this repository for search.\n";
      resultText += "This can happen with:\n";
      resultText += "- New repositories (indexing takes time)\n";
      if (diagnostics.isLarge) {
        resultText += `- Large repositories (${diagnostics.repoSizeGB?.toFixed(
          2
        )} GB exceeds 50 GB limit)\n`;
      }
      if (diagnostics.isPrivate) {
        resultText += "- Private repositories with indexing issues\n";
      }
      resultText += "\n**Try**:\n";
      resultText += "- Search directly on GitHub.com to confirm\n";
      resultText +=
        "- Use the diagnoseSearch tool for detailed diagnostics\n\n";
    } else {
      resultText += "📊 **Search Debug Info**:\n";
      resultText += `- Repository: ${
        diagnostics.isPrivate ? "Private" : "Public"
      } (${diagnostics.repoSizeGB?.toFixed(3)} GB)\n`;
      resultText += `- Default branch: ${diagnostics.defaultBranch} (only branch searchable)\n`;
      resultText += `- Files in repo: ${diagnostics.filesFound} found\n`;
      resultText += `- Search query used: \`${query}\`\n\n`;

      resultText += "**Possible reasons for no results**:\n";
      resultText += "- The search term doesn't exist in the repository\n";
      resultText +=
        "- Content might be in non-default branches (not searchable)\n";
      resultText += "- Files might be larger than 384 KB (not indexed)\n\n";
    }

    // Add search tips
    resultText += "💡 **Search Tips:**\n";
    resultText += `- Try \`searchIn: "filename"\` to search only filenames\n`;
    resultText += `- Try \`searchIn: "path"\` to search file paths\n`;
    resultText += `- Try \`searchIn: "content"\` to search file contents\n`;
    resultText += `- Use quotes for exact phrases: "exact phrase"\n`;
    resultText += "- Use wildcards: `*.md` for markdown files\n";
    resultText += "- Try simpler or partial search terms";

    return {
      content: [
        {
          type: "text" as const,
          text: resultText,
        },
      ],
    };
  }

  registerGithubResources(server: McpServer) {
    // Resource for repository information
    server.resource(
      "repo-info",
      `obsidian://vault/${this.config.owner}/${this.config.repo}/info`,
      {
        description: "Basic information about your Obsidian vault repository",
        mimeType: "application/json",
      },
      async (uri) => {
        try {
          const repoInfo = await this.handleRequest(async () => {
            return this.octokit.repos.get({
              owner: this.config.owner,
              repo: this.config.repo,
            });
          });

          const info = {
            name: repoInfo.name,
            fullName: repoInfo.full_name,
            description: repoInfo.description,
            isPrivate: repoInfo.private,
            defaultBranch: repoInfo.default_branch,
            size: `${(repoInfo.size / 1024).toFixed(2)} MB`,
            createdAt: repoInfo.created_at,
            updatedAt: repoInfo.updated_at,
            language: repoInfo.language,
            topics: repoInfo.topics || [],
            htmlUrl: repoInfo.html_url,
          };

          return {
            contents: [
              {
                uri: uri.toString(),
                mimeType: "application/json",
                text: JSON.stringify(info, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            contents: [
              {
                uri: uri.toString(),
                mimeType: "text/plain",
                text: `Error fetching repository information: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
          };
        }
      }
    );

    // Resource for recent activity summary
    server.resource(
      "recent-activity",
      `obsidian://vault/${this.config.owner}/${this.config.repo}/activity`,
      {
        description: "Summary of recent commits and changes to your vault",
        mimeType: "text/markdown",
      },
      async (uri) => {
        try {
          const since = new Date();
          since.setDate(since.getDate() - 7); // Last 7 days

          const commits = await this.handleRequest(async () => {
            return this.octokit.repos.listCommits({
              owner: this.config.owner,
              repo: this.config.repo,
              since: since.toISOString(),
              per_page: 10,
            });
          });

          let markdown = `# Recent Activity - ${this.config.owner}/${this.config.repo}\n\n`;
          markdown += "Last 7 days of commits:\n\n";

          if (commits.length === 0) {
            markdown += "_No commits in the last 7 days_\n";
          } else {
            for (const commit of commits) {
              const date = new Date(
                commit.commit.author?.date || ""
              ).toLocaleDateString();
              const message = commit.commit.message.split("\n")[0];
              const author = commit.commit.author?.name || "Unknown";
              markdown += `- **${date}**: ${message} _(by ${author})_\n`;
            }
          }

          return {
            contents: [
              {
                uri: uri.toString(),
                mimeType: "text/markdown",
                text: markdown,
              },
            ],
          };
        } catch (error) {
          return {
            contents: [
              {
                uri: uri.toString(),
                mimeType: "text/plain",
                text: `Error fetching recent activity: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              },
            ],
          };
        }
      }
    );
  }

  registerGithubPrompts(server: McpServer) {
    // Prompt to explore vault structure and recent activity
    server.prompt(
      "explore-vault",
      "Explore your Obsidian vault structure, recent changes, and key content",
      {},
      async () => {
        return {
          description: "Comprehensive exploration of your Obsidian vault",
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Please help me explore my Obsidian vault in the GitHub repository ${this.config.owner}/${this.config.repo}.

I'd like to understand:
1. What types of notes and content are in my vault
2. Recent changes and updates (last 7 days)
3. Key topics or themes in my notes
4. Overall structure and organization

Please use the available tools to:
- Search for markdown files to understand the content types
- Check recent commit history to see what's been updated
- Suggest ways to better organize or explore my knowledge base`,
              },
            },
          ],
        };
      }
    );

    // Prompt to search for specific topics
    server.prompt(
      "find-notes-about",
      "Search your vault for notes related to a specific topic",
      {
        topic: z.string().describe("The topic or keyword to search for"),
      },
      async ({ topic }) => {
        return {
          description: `Search vault for notes about: ${topic}`,
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Please search my Obsidian vault (${this.config.owner}/${this.config.repo}) for notes related to "${topic}".

Use the searchFiles tool to:
1. Find files with "${topic}" in the filename
2. Search for "${topic}" in file contents
3. Look for related terms or concepts

Then provide:
- A summary of what you found
- Key insights from the most relevant notes
- Suggestions for related topics to explore`,
              },
            },
          ],
        };
      }
    );

    // Prompt to analyze knowledge base evolution
    server.prompt(
      "analyze-recent-changes",
      "Analyze how your knowledge base has evolved recently",
      {
        days: z
          .string()
          .optional()
          .describe("Number of days to look back (default: 7)"),
      },
      async ({ days }) => {
        const daysNum = days ? Number.parseInt(days, 10) : 7;
        return {
          description: `Analyze vault changes over the last ${daysNum} days`,
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Please analyze how my Obsidian vault (${this.config.owner}/${this.config.repo}) has evolved over the last ${daysNum} days.

Use the getCommitHistory tool to:
1. Review all commits from the last ${daysNum} days
2. Identify which notes were created, modified, or deleted
3. Analyze the types of changes (new topics, updates to existing notes, etc.)

Then provide:
- A summary of the main themes or topics you've been working on
- Patterns in your note-taking or knowledge development
- Suggestions for areas that might need more attention or organization`,
              },
            },
          ],
        };
      }
    );
  }

  registerGithubTools(server: McpServer) {
    server.tool(
      "getFileContents",
      `Retrieve the contents of a specific note, document, or file from your Obsidian vault stored in GitHub (${this.config.owner}/${this.config.repo}). Perfect for accessing your knowledge base content.`,
      {
        filePath: z
          .string()
          .describe("Path to the file within the repository."),
      },
      {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
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
          content: [{ type: "text" as const, text: fileContent }],
        };
      }
    );

    // Enhanced searchFiles tool with filename and content search
    server.tool(
      "searchFiles",
      `Search for notes, documents, and files within your Obsidian vault on GitHub (${this.config.owner}/${this.config.repo}). Find specific knowledge base content using GitHub's powerful search syntax. Supports searching in filenames, paths, and content.`,
      {
        query: z
          .string()
          .describe(
            "Search query - can be a simple term or use GitHub search qualifiers"
          ),
        searchIn: z
          .enum(["filename", "path", "content", "all"])
          .optional()
          .default("all")
          .describe(
            "Where to search: 'filename' (exact filename match), 'path' (anywhere in file path), 'content' (file contents), or 'all' (comprehensive search)"
          ),
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
      {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      async ({ query, searchIn = "all", page = 0, perPage = 100 }) => {
        // Empty query is allowed - useful for listing files
        const repoQualifier = `repo:${this.config.owner}/${this.config.repo}`;

        // Build search query based on searchIn parameter
        let qualifiedQuery: string;

        if (searchIn === "filename") {
          // Search for exact filename matches
          qualifiedQuery = `filename:${
            query.includes(" ") ? `"${query}"` : query
          } ${repoQualifier}`;
        } else if (searchIn === "path") {
          // Search anywhere in the file path. The `in:path` qualifier searches for the
          // query term within the file path.
          qualifiedQuery = `${query} in:path ${repoQualifier}`;
        } else if (searchIn === "content") {
          // Search only in file contents. This is the default behavior without qualifiers.
          qualifiedQuery = `${query} ${repoQualifier}`;
        } else {
          // "all" - comprehensive search. The GitHub search API (legacy) does not
          // support OR operators. The best we can do in a single query is to search
          // in file content and file path. The `in:file,path` qualifier does this.
          // This will match the query term if it appears in the content or anywhere
          // in the full path of a file, which includes the filename.
          qualifiedQuery = `${query} in:file,path ${repoQualifier}`;
        }

        let searchResults: {
          items: Array<{ name: string; path: string }>;
          total_count: number;
        };
        try {
          searchResults = await this.handleRequest(async () => {
            return this.octokit.search.code({
              q: qualifiedQuery,
              page,
              per_page: perPage,
            });
          });
        } catch (error) {
          // Enhanced error messages with specific GitHub search issues
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (errorMessage.includes("validation failed")) {
            throw new Error(
              `GitHub search query invalid: "${qualifiedQuery}". Try simpler terms or check syntax.`
            );
          }
          if (errorMessage.includes("rate limit")) {
            throw new Error(
              "GitHub code search rate limit exceeded. Wait a moment and try again."
            );
          }
          if (
            errorMessage.includes("Forbidden") ||
            errorMessage.includes("401")
          ) {
            throw new Error(
              "GitHub API access denied. Check that your token has 'repo' scope for private repositories."
            );
          }
          throw error; // Re-throw other errors
        }

        // Enhanced formatting with file sizes and relevance indicators
        const formattedResults = searchResults.items
          .map((item) => {
            const fileName = item.name;
            const filePath = item.path;
            // const score = item.score || 0; // Could be used for relevance ranking in future

            // Determine why this file matched
            let matchReason = "";
            if (searchIn === "filename") {
              matchReason = "📝 filename match";
            } else if (searchIn === "path") {
              matchReason = "📁 path match";
            } else if (searchIn === "content") {
              matchReason = "📄 content match";
            } else {
              // searchIn is 'all', so we deduce the reason
              if (fileName.toLowerCase().includes(query.toLowerCase())) {
                matchReason = "📝 filename match";
              } else if (filePath.toLowerCase().includes(query.toLowerCase())) {
                matchReason = "📁 path match";
              } else {
                matchReason = "📄 content match";
              }
            }

            return `- **${fileName}** (${filePath}) ${matchReason}`;
          })
          .join("\n");

        let resultText = `Found ${searchResults.total_count} files`;
        if (searchIn !== "all") {
          resultText += ` searching in ${searchIn}`;
        }
        resultText += `:\n\n${formattedResults}`;

        // If no results, run diagnostics and provide enhanced response
        if (searchResults.total_count === 0) {
          const diagnostics = await this.runSearchDiagnostics(query);
          return this.formatNoResultsResponse(
            searchResults,
            diagnostics,
            query,
            searchIn
          );
        }

        return {
          content: [
            {
              type: "text" as const,
              text: resultText,
            },
          ],
        };
      }
    );

    // Placeholder for searchIssues tool
    server.tool(
      "searchIssues",
      `Search for issues and discussions in your Obsidian vault repository (${this.config.owner}/${this.config.repo}). Great for tracking tasks, project management, and collaborative knowledge work.`,
      {
        query: z
          .string()
          .describe("Search query (uses GitHub Issue Search syntax)"),
      },
      {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
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
              type: "text" as const,
              text: `Found ${searchResults.total_count} issues:\n${formattedResults}`,
            },
          ],
        };
      }
    );

    // getCommitHistory tool - focuses on file changes and diffs
    server.tool(
      "getCommitHistory",
      `Track the evolution of your Obsidian vault knowledge base by retrieving commit history from GitHub (${this.config.owner}/${this.config.repo}). See how your notes and ideas have developed over time with detailed diffs.`,
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
      {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
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
                type: "text" as const,
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
              type: "text" as const,
              text: formattedOutput,
            },
          ],
        };
      }
    );

    // diagnoseSearch tool for repository diagnostics
    server.tool(
      "diagnoseSearch",
      `Diagnose search functionality and repository configuration for your Obsidian vault on GitHub (${this.config.owner}/${this.config.repo}). Verifies repository connectivity, search capabilities, and checks if repository size is within GitHub's indexing limits.`,
      {},
      {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      async () => {
        try {
          // Get repository information
          const repoInfo = await this.handleRequest(async () => {
            return this.octokit.repos.get({
              owner: this.config.owner,
              repo: this.config.repo,
            });
          });

          // Test search functionality with a simple query
          let searchWorks = false;
          let searchError: string | null = null;
          let searchResultCount = 0;

          try {
            const testSearch = await this.handleRequest(async () => {
              return this.octokit.search.code({
                q: `repo:${this.config.owner}/${this.config.repo} extension:md`,
                per_page: 1,
              });
            });
            searchWorks = true;
            searchResultCount = testSearch.total_count;
          } catch (error) {
            searchWorks = false;
            searchError =
              error instanceof Error ? error.message : String(error);
          }

          // GitHub's code search limitations
          const MAX_INDEXED_SIZE_GB = 50; // GitHub doesn't index repos > ~50GB
          const repoSizeGB = repoInfo.size / (1024 * 1024); // Convert KB to GB
          const isWithinSizeLimit = repoSizeGB <= MAX_INDEXED_SIZE_GB;

          // Format diagnostic output
          let diagnosticOutput = "# Repository Search Diagnostics\n\n";
          diagnosticOutput += "## Repository Information\n";
          diagnosticOutput += `- **Repository**: ${this.config.owner}/${this.config.repo}\n`;
          diagnosticOutput += `- **Visibility**: ${
            repoInfo.private ? "Private" : "Public"
          }\n`;
          diagnosticOutput += `- **Size**: ${repoSizeGB.toFixed(3)} GB (${(
            repoInfo.size / 1024
          ).toFixed(2)} MB)\n`;
          diagnosticOutput += `- **Default Branch**: ${repoInfo.default_branch}\n\n`;

          diagnosticOutput += "## Search Capabilities\n";
          diagnosticOutput += `- **Search API Access**: ${
            searchWorks ? "✅ Working" : "❌ Failed"
          }\n`;
          diagnosticOutput += `- **Indexed Branch**: Only '${repoInfo.default_branch}' branch is searchable\n`;

          if (searchWorks) {
            diagnosticOutput += `- **Markdown Files Found**: ${searchResultCount}\n`;
          } else if (searchError) {
            diagnosticOutput += `- **Error**: ${searchError}\n`;
          }

          diagnosticOutput += `- **Within Size Limit**: ${
            isWithinSizeLimit
              ? `✅ Yes (${repoSizeGB.toFixed(
                  3
                )} GB < ${MAX_INDEXED_SIZE_GB} GB)`
              : `⚠️ No (${repoSizeGB.toFixed(3)} GB > ${MAX_INDEXED_SIZE_GB} GB)`
          }\n\n`;

          // Add recommendations
          diagnosticOutput += "## Recommendations\n";

          if (!searchWorks && repoInfo.private) {
            diagnosticOutput += `- ⚠️ **Private Repository**: Ensure your GitHub token has the 'repo' scope for full access to private repositories.\n`;
          }

          if (!isWithinSizeLimit) {
            diagnosticOutput += `- ⚠️ **Large Repository**: GitHub's code search doesn't index repositories larger than ~${MAX_INDEXED_SIZE_GB} GB. Consider:\n`;
            diagnosticOutput +=
              "  - Using file path navigation instead of search for specific files\n";
            diagnosticOutput +=
              "  - Splitting your vault into multiple repositories\n";
            diagnosticOutput +=
              "  - Using getFileContents tool with known paths\n";
            diagnosticOutput +=
              "  - Note: Individual files must be < 384 KB to be searchable\n";
          }

          if (searchWorks && searchResultCount === 0) {
            diagnosticOutput +=
              "- ℹ️ **No Markdown Files**: No .md files found in the default branch. Your vault might be empty, use different file extensions, or have content in other branches.\n";
          }

          if (searchWorks && isWithinSizeLimit) {
            diagnosticOutput +=
              "- ✅ **All Systems Operational**: Repository is properly configured and searchable!\n";
          }

          return {
            content: [
              {
                type: "text" as const,
                text: diagnosticOutput,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to diagnose repository: ${
                  error instanceof Error ? error.message : String(error)
                }\n\nPlease check your GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO configuration.`,
              },
            ],
          };
        }
      }
    );
  }
}
