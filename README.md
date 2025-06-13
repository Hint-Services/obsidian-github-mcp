# ⚠️ DEPRECATION NOTICE

This package has been **renamed and moved** to `obsidian-github-mcp`.

## 🚀 Migrate to the New Package

Please update your installation to use the new package:

```bash
npm uninstall mcp-private-github-search
npm install obsidian-github-mcp
```

### Update Your MCP Configuration

**Old configuration:**
```json
{
  "mcpServers": {
    "privateGithubSearch": {
      "command": "npx",
      "args": ["-y", "mcp-private-github-search"],
      "env": {
        "GITHUB_TOKEN": "your-token",
        "GITHUB_OWNER": "your-owner",
        "GITHUB_REPO": "your-repo"
      }
    }
  }
}
```

**New configuration:**
```json
{
  "mcpServers": {
    "obsidianGithub": {
      "command": "npx",
      "args": ["-y", "obsidian-github-mcp"],
      "env": {
        "GITHUB_TOKEN": "your-token",
        "GITHUB_OWNER": "your-owner",
        "GITHUB_REPO": "your-repo"
      }
    }
  }
}
```

## Why the Change?

The package has been rebranded to better reflect its primary use case: **accessing GitHub repositories containing Obsidian vaults**. The new package offers:

- ✅ Same functionality - no breaking changes
- ✅ Better positioning for Obsidian users
- ✅ Enhanced documentation and examples
- ✅ Continued active development

## New Package Details

- **Package Name**: `obsidian-github-mcp`
- **NPM**: https://www.npmjs.com/package/obsidian-github-mcp
- **GitHub**: https://github.com/hint-services/obsidian-github-mcp
- **Documentation**: Complete README with Obsidian-focused use cases

## Deprecation Timeline

- **Now**: This package is deprecated (but still functional)
- **6 months**: Package will be archived
- **Recommendation**: Migrate as soon as possible

---

## Legacy Documentation (For Reference Only)

[![smithery badge](https://smithery.ai/badge/@Hint-Services/mcp-private-github-search)](https://smithery.ai/server/@Hint-Services/mcp-private-github-search)
[![npm version](https://img.shields.io/npm/v/mcp-private-github-search)](https://www.npmjs.com/package/mcp-private-github-search)

### MCP Private GitHub Search (DEPRECATED)

A Model Context Protocol (MCP) server that provides tools for searching private GitHub repositories. 

**⚠️ This package is deprecated. Please use [obsidian-github-mcp](https://www.npmjs.com/package/obsidian-github-mcp) instead.**

#### Features

- **GitHub Repository Search**: Search private GitHub repositories
- **Type-Safe Implementation**: Written in TypeScript
- **Input Validation**: Robust validation using Zod schemas
- **Error Handling**: Graceful error handling

#### Available Tools

- **getFileContents**: Retrieves raw file content from repository
- **searchFiles**: Searches files with GitHub code search syntax (paginated)
- **searchIssues**: Searches repository issues
- **getCommitHistory**: Retrieves commit history with optional diffs

#### Installation (Not Recommended)

```bash
npm install mcp-private-github-search
```

**Please migrate to `obsidian-github-mcp` instead.**

#### Configuration

```json
{
  "mcpServers": {
    "privateGithubSearch": {
      "command": "npx",
      "args": ["-y", "mcp-private-github-search"],
      "env": {
        "GITHUB_TOKEN": "your-token",
        "GITHUB_OWNER": "your-owner", 
        "GITHUB_REPO": "your-repo"
      }
    }
  }
}
```

#### Required Environment Variables

- `GITHUB_TOKEN`: Your GitHub personal access token
- `GITHUB_OWNER`: The owner/organization of the GitHub repository
- `GITHUB_REPO`: The name of the repository

---

## About Hint Services

Hint Services is a boutique consultancy focused on AI and User Experience. [Learn more](https://hint.services).