# Semantic Search MCP Server

A local-first MCP server that enables semantic search across Lane's workspace using Transformers.js and LanceDB.

## Features

- 🔍 **Semantic Search**: Natural language queries powered by `all-MiniLM-L6-v2` embeddings
- 💾 **Persistent Storage**: LanceDB vector database with disk-based persistence
- 🔄 **Hybrid Search**: Combines semantic similarity with keyword boosting
- 📚 **Intelligent Chunking**: Document chunking by paragraphs, not fixed size
- ⚡ **Local Inference**: No external API calls, runs entirely on CPU
- 🔧 **Incremental Indexing**: Update individual files or entire directories

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Tools

### search
Perform semantic search across indexed documents.

**Parameters:**
- `query` (string, required): Search query in natural language or keywords
- `limit` (number, optional): Maximum results to return (1-100, default: 10)
- `hybrid` (boolean, optional): Enable hybrid search (default: true)

**Example:**
```json
{
  "query": "when did we discuss security patterns",
  "limit": 5,
  "hybrid": true
}
```

### index_file
Index or re-index a specific file.

**Parameters:**
- `path` (string, required): Absolute or relative path to the file

**Example:**
```json
{
  "path": "memory/2026-02-08.md"
}
```

### index_directory
Index all matching files in a directory.

**Parameters:**
- `path` (string, required): Directory path to index
- `pattern` (string, optional): Glob pattern (default: "**/*.md")

**Example:**
```json
{
  "path": "memory",
  "pattern": "**/*.md"
}
```

### reindex_all
Clear the index and rebuild from scratch. Automatically indexes:
- `memory/**/*.md`
- `diaries/**/*.md`
- `.lane/plans/**/*.md`
- `*.md` (root markdown files)

**Parameters:**
- `workspace_root` (string, optional): Workspace root directory

**Example:**
```json
{
  "workspace_root": "/opt/openclaw/workspace"
}
```

### get_stats
Get statistics about the indexed documents.

**No parameters required.**

**Returns:**
- Total chunks
- Total files
- Database size
- List of indexed files

## Configuration

### Environment Variables

- `WORKSPACE_ROOT`: Default workspace directory (default: current directory)
- `LANCEDB_PATH`: Path to LanceDB storage (default: `./lancedb`)

### MCP Client Configuration

Add to your MCP client config (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "semantic-search": {
      "command": "node",
      "args": ["/opt/openclaw/workspace/mcp-servers/semantic-search/build/index.js"],
      "env": {
        "WORKSPACE_ROOT": "/opt/openclaw/workspace",
        "LANCEDB_PATH": "/opt/openclaw/workspace/mcp-servers/semantic-search/lancedb"
      }
    }
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────┐
│         Semantic Search MCP Server          │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Tools   │  │  Search  │  │ Chunking │ │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘ │
│        │             │              │      │
│        └─────────────┼──────────────┘      │
│                      │                     │
│         ┌────────────┴────────────┐        │
│         │                         │        │
│    ┌────▼─────┐          ┌────────▼─────┐ │
│    │ Embeddings│          │  VectorDB    │ │
│    │(Transformers.js)     │  (LanceDB)   │ │
│    └──────────┘          └──────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

### Components

- **embeddings.ts**: Transformers.js wrapper for generating embeddings
- **vectordb.ts**: LanceDB integration for vector storage and retrieval
- **search.ts**: Document chunking and hybrid search logic
- **tools.ts**: MCP tool definitions
- **index.ts**: Server entry point and initialization

## Performance

- **First search after cold start**: ~3 seconds (model loading)
- **Subsequent searches**: <500ms for 10k documents
- **Embedding model**: 384 dimensions, ~80MB on disk
- **Index storage**: ~100MB for 10k documents

## Development

```bash
# Watch mode (auto-rebuild on changes)
npm run watch

# Start server manually (for testing)
npm start
```

## Troubleshooting

### Model Download Issues
The embedding model (~80MB) is downloaded on first use and cached locally. If download fails:
1. Check network connectivity
2. Ensure sufficient disk space
3. Check Transformers.js cache directory

### LanceDB Errors
If you encounter database errors:
1. Delete the `lancedb` directory
2. Run `reindex_all` to rebuild the index

### Memory Issues
If running out of memory:
1. Reduce batch size in `embeddings.ts`
2. Process files in smaller batches
3. Increase Node.js heap size: `NODE_OPTIONS=--max-old-space-size=4096`

## License

MIT
