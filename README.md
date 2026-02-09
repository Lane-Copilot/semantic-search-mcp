# Semantic Search for AI Agents

A local-first semantic search tool for AI assistants. Index your workspace, search with natural language, save context tokens. Built with Transformers.js and LanceDB.

**Works as:** CLI tool (primary) • MCP server (optional)

> 📖 **New to this?** Read the [Agent Integration Guide](AGENT-GUIDE.md) — it covers the *habit* of using semantic search effectively, not just the API.

## Features

- 🔍 **Semantic Search**: Natural language queries powered by `all-MiniLM-L6-v2` embeddings
- 💾 **Persistent Storage**: LanceDB vector database with disk-based persistence
- 🔄 **Hybrid Search**: Combines semantic similarity with keyword boosting
- 📚 **Intelligent Chunking**: Document chunking by paragraphs, not fixed size
- ⚡ **Local Inference**: No external API calls, runs entirely on CPU
- 🔧 **Incremental Indexing**: Update individual files or entire directories

## Quick Start

```bash
# Install
npm install && npm run build

# Index your workspace
node search.cjs --reindex

# Search
node search.cjs "what did we discuss yesterday"
```

## CLI Usage (Recommended for AI Agents)

```bash
# Search
node search.cjs "your query here"

# Index a file
node search.cjs --index /path/to/file.md

# Reindex entire workspace
node search.cjs --reindex

# Show stats
node search.cjs --stats
```

### Wrapper Script (Optional)

Create a wrapper to filter runtime warnings and simplify usage:

```bash
#!/bin/bash
cd /path/to/semantic-search && node search.cjs "$@" 2>&1 | grep -v "pthread_setaffinity"
```

Save as `semantic-search` in your PATH, then:
```bash
semantic-search "your query"
```

## The Core Habit

**For AI Assistants:** Don't read entire files when you need 3 lines.

```
Need past information?
  1. semantic-search "query" FIRST
  2. Review snippets (with file paths + line numbers)
  3. Read only the specific lines you need
```

This saves context tokens and is faster than scanning files manually.

## MCP Server Usage (Optional)

If your client supports the Model Context Protocol:

```json
{
  "mcpServers": {
    "semantic-search": {
      "command": "node",
      "args": ["/path/to/semantic-search/build/index.js"],
      "env": {
        "WORKSPACE_ROOT": "/your/workspace",
        "LANCEDB_PATH": "/path/to/semantic-search/lancedb"
      }
    }
  }
}
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `search` | Semantic search with optional hybrid mode |
| `index_file` | Index a single file |
| `index_directory` | Index files matching a pattern |
| `reindex_all` | Clear and rebuild entire index |
| `get_stats` | Index statistics |

## Configuration

### Environment Variables

- `SEMANTIC_SEARCH_WORKSPACE`: Workspace root for reindexing (default: current directory)
- `LANCEDB_PATH`: Vector database location (default: `./lancedb`)

### Default Index Paths

When running `--reindex`, these directories are indexed:
- `memory/**/*.md`
- `diaries/**/*.md`
- `.lane/plans/**/*.md`
- `*.md` (root markdown files)

## Architecture

```
┌─────────────────┐
│  search.cjs     │  CLI interface
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼────┐ ┌──▼───┐
│Embeddings│ │Storage│
│(Transformers.js)│ │(LanceDB)│
└─────────┘ └──────┘
```

- **Model:** all-MiniLM-L6-v2 (384 dimensions, ~90MB download)
- **Database:** LanceDB (disk-persistent, no external service)
- **Search:** Cosine similarity + keyword boost

## Performance

- **Cold start:** ~3 seconds (model loading)
- **Warm searches:** <500ms
- **Index size:** ~100MB per 10k documents

## Troubleshooting

### pthread_setaffinity warnings
Harmless ONNX runtime warnings. Use the wrapper script to filter them.

### Model download fails
Ensure `huggingface.co` is accessible. Model is cached after first download.

### Stale results
Run `--reindex` to rebuild from scratch.

### Memory issues
Increase heap: `NODE_OPTIONS=--max-old-space-size=4096 node search.cjs ...`

## Documentation

- [AGENT-GUIDE.md](AGENT-GUIDE.md) — Integration guide for AI assistants
- [INTEGRATION.md](INTEGRATION.md) — Technical implementation details
- [TESTING.md](TESTING.md) — Test procedures
- [WASM-FIX.md](WASM-FIX.md) — WebAssembly backend notes

## License

MIT
