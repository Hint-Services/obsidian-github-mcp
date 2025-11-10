[![smithery badge](https://smithery.ai/badge/@Hint-Services/obsidian-github-mcp)](https://smithery.ai/server/@Hint-Services/obsidian-github-mcp)
[![npm version](https://img.shields.io/npm/v/obsidian-github-mcp)](https://www.npmjs.com/package/obsidian-github-mcp)
[![npm downloads](https://img.shields.io/npm/dm/obsidian-github-mcp)](https://www.npmjs.com/package/obsidian-github-mcp)

# Obsidian GitHub MCP

A Model Context Protocol (MCP) server that connects AI assistants to GitHub repositories containing Obsidian vaults. This server enables seamless integration with your knowledge base stored on GitHub, allowing AI assistants to read, search, and analyze your Obsidian notes and documentation.

## Why This Tool?

Many Obsidian users store their vaults in GitHub for backup, versioning, and collaboration. This MCP server bridges the gap between your GitHub-hosted Obsidian vault and AI assistants, enabling:

- **Knowledge Base Access**: Retrieve specific notes and documents from your Obsidian vault
- **Intelligent Search**: Find relevant content across your entire knowledge base
- **Evolution Tracking**: See how your ideas and notes have developed over time
- **Task Integration**: Connect with issues and project management workflows

## Features

- **GitHub Repository Access**: Connect to any GitHub repository containing your Obsidian vault
- **Type-Safe Implementation**: Written in TypeScript with comprehensive type definitions
- **Input Validation**: Robust validation for all API inputs using Zod schemas
- **Error Handling**: Graceful error handling with informative messages
- **MCP Integration**: Full compatibility with Claude, Cursor, Windsurf, Cline, and other MCP hosts

## Available Tools

### Knowledge Base Access

- **getFileContents**: Retrieve the contents of specific notes, documents, or files from your Obsidian vault
- **searchFiles**: Enhanced search with multiple modes:
  - `filename`: Find files by exact filename (perfect for "OKR 2025" type searches)
  - `path`: Search anywhere in file paths 
  - `content`: Search within file contents
  - `all`: Comprehensive search across filenames, paths, and content

### Project Management Integration

- **searchIssues**: Search for issues and discussions related to your knowledge base projects
- **getCommitHistory**: Track how your knowledge base has evolved over time with detailed commit history and diffs

## Use Cases

### For Knowledge Workers
- **Research Assistant**: AI can access your research notes and reference materials
- **Writing Support**: Pull relevant background information from your knowledge base
- **Idea Development**: Track how concepts have evolved across your notes

### For Developers
- **Documentation Access**: Retrieve project documentation and technical notes
- **Learning Journals**: Access your learning notes and code examples
- **Project Planning**: Integrate with GitHub issues for comprehensive project management

### For Students & Academics
- **Study Materials**: Access lecture notes and study guides
- **Research Papers**: Retrieve research notes and citations
- **Collaboration**: Work with shared knowledge bases stored in GitHub

## Installation

### Using Smithery (Recommended)

The easiest way to install Obsidian GitHub MCP is using Smithery:

```bash
# For Claude Desktop
npx -y @smithery/cli install @Hint-Services/obsidian-github-mcp --client claude

# For Cursor
npx -y @smithery/cli install @Hint-Services/obsidian-github-mcp --client cursor

# For Windsurf
npx -y @smithery/cli install @Hint-Services/obsidian-github-mcp --client windsurf

# For Cline
npx -y @smithery/cli install @Hint-Services/obsidian-github-mcp --client cline
```

### Manual Installation

```bash
npm install obsidian-github-mcp
```

## Configuration

Add the server to your MCP settings file with the following configuration:

```json
{
  "mcpServers": {
    "obsidianGithub": {
      "command": "npx",
      "args": ["-y", "obsidian-github-mcp"],
      "env": {
        "GITHUB_TOKEN": "your-github-token",
        "GITHUB_OWNER": "your-github-username",
        "GITHUB_REPO": "your-obsidian-vault-repo"
      }
    }
  }
}
```

### Required Environment Variables

- `GITHUB_TOKEN`: Your GitHub personal access token ([create one here](https://github.com/settings/tokens))
- `GITHUB_OWNER`: The owner/organization of the GitHub repository
- `GITHUB_REPO`: The name of the repository containing your Obsidian vault

### GitHub Token Permissions

Your GitHub token needs the following permissions:
- `repo` (for private repositories) or `public_repo` (for public repositories)
- `read:org` (if accessing organization repositories)

## Example Workflows

### Accessing Your Daily Notes

```json
{
  "tool": "getFileContents",
  "arguments": {
    "filePath": "Daily Notes/2024-01-15.md"
  }
}
```

### Finding Files by Name (Perfect for "OKR 2025" example!)

```json
{
  "tool": "searchFiles",
  "arguments": {
    "query": "OKR 2025",
    "searchIn": "filename"
  }
}
```

### Finding Files by Path

```json
{
  "tool": "searchFiles",
  "arguments": {
    "query": "Daily Notes",
    "searchIn": "path"
  }
}
```

### Finding Research on a Topic (Content Search)

```json
{
  "tool": "searchFiles",
  "arguments": {
    "query": "machine learning algorithms",
    "searchIn": "content",
    "perPage": 10
  }
}
```

### Comprehensive Search (Filename, Path, and Content)

```json
{
  "tool": "searchFiles",
  "arguments": {
    "query": "project planning",
    "searchIn": "all"
  }
}
```

### Advanced GitHub Search Syntax

```json
{
  "tool": "searchFiles",
  "arguments": {
    "query": "path:*.md extension:md",
    "searchIn": "content"
  }
}
```

### Tracking Knowledge Evolution

```json
{
  "tool": "getCommitHistory",
  "arguments": {
    "days": 30,
    "includeDiffs": true,
    "maxCommits": 10
  }
}
```

## Search Tips & Troubleshooting

### Can't Find Your File by Name?

**Problem**: Searching for "OKR 2025" doesn't find your file named "OKR 2025.md"

**Solution**: Use the `searchIn: "filename"` parameter:

```json
{
  "tool": "searchFiles",
  "arguments": {
    "query": "OKR 2025",
    "searchIn": "filename"
  }
}
```

### Advanced Search Techniques

1. **Exact Phrases**: Use quotes for multi-word searches
   ```json
   {
     "query": "\"project planning 2025\"",
     "searchIn": "content"
   }
   ```

2. **File Extensions**: Find specific file types
   ```json
   {
     "query": "path:*.md",
     "searchIn": "content"
   }
   ```

3. **Directory Specific**: Search within folders
   ```json
   {
     "query": "path:\"Daily Notes/\"",
     "searchIn": "content"
   }
   ```

## Project Structure

```
obsidian-github-mcp/
├── src/
│   ├── index.ts          # Main MCP server entry point
│   └── github/           # GitHub API integration
│       ├── client.ts     # GitHub client implementation
│       └── types.ts      # TypeScript type definitions
├── docs/                 # Documentation
├── package.json          # Project configuration
└── tsconfig.json         # TypeScript configuration
```

## For Developers

If you're interested in contributing to this project or developing your own tools with this server, please see the [Development Guide](docs/development.md).

### Development Commands

- `pnpm install` - Install dependencies
- `pnpm run build` - Build the project
- `pnpm run dev` - Run in development mode with inspector
- `pnpm run inspector` - Launch MCP inspector for testing

## Migration from mcp-private-github-search

If you're migrating from the older `mcp-private-github-search` package:

1. Update your package name in configuration:
   ```json
   {
     "mcpServers": {
       "obsidianGithub": {
         "command": "npx",
         "args": ["-y", "obsidian-github-mcp"]
       }
     }
   }
   ```

2. The functionality remains the same - all existing tools work identically
3. Consider the new Obsidian-focused use cases and workflows

## Learn More

For further information on the MCP ecosystem, refer to:

- [Model Context Protocol Documentation](https://modelcontextprotocol.io): Detailed coverage of MCP architecture and design principles
- [Smithery - MCP Server Registry](https://smithery.ai/docs): Guidelines for publishing MCP servers
- [MCP TypeScript SDK Documentation](https://modelcontextprotocol.io/typescript): Comprehensive TypeScript SDK documentation
- [Obsidian](https://obsidian.md): The knowledge management app that inspired this tool

## About Hint Services

> "The future is already here, it's just unevenly distributed"
>
> — William Gibson, Author

Hint Services is a boutique consultancy with a mission to develop and expand how user interfaces leverage artificial intelligence technology. We architect ambition at the intersection of AI and User Experience, founded and led by Ben Hofferber.

We offer specialized AI workshops for design teams looking to embrace AI tools without becoming developers. [Learn more about our training and workshops](https://hint.services/training-workshops).