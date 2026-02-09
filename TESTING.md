# Testing the Semantic Search MCP Server

## Quick Start

The stub server is fully functional and responds to all tool calls with mock data.

### Build

```bash
cd /opt/openclaw/workspace/mcp-servers/semantic-search
npm install --cache /tmp/.npm-cache --include=dev
node ./node_modules/typescript/bin/tsc
```

### Run Server

```bash
node build/index.js
```

The server communicates via stdio (JSON-RPC 2.0).

## Test Tool Calls

### List Available Tools

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node build/index.js 2>/dev/null
```

### Call: search

```bash
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search","arguments":{"query":"machine learning","limit":5,"hybrid":false}}}' | node build/index.js 2>/dev/null
```

**Expected Response:**
```json
{
  "result": {
    "content": [{
      "type": "text",
      "text": "{\n  \"query\": \"machine learning\",\n  \"total_results\": 2,\n  \"results\": [\n    {\n      \"id\": \"doc-001\",\n      \"path\": \"/opt/openclaw/workspace/example.md\",\n      \"content\": \"This is a stub result...\",\n      \"score\": 0.95,\n      \"metadata\": {...}\n    }\n  ]\n}"
    }]
  }
}
```

### Call: index_file

```bash
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"index_file","arguments":{"path":"/path/to/file.md"}}}' | node build/index.js 2>/dev/null
```

### Call: index_directory

```bash
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"index_directory","arguments":{"path":"/path/to/docs","pattern":"*.md"}}}' | node build/index.js 2>/dev/null
```

### Call: reindex_all

```bash
echo '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"reindex_all","arguments":{}}}' | node build/index.js 2>/dev/null
```

### Call: get_stats

```bash
echo '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"get_stats","arguments":{}}}' | node build/index.js 2>/dev/null
```

## Testing with MCP Inspector

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) provides a visual UI for testing:

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

This opens a web interface where you can:
- Browse available tools
- Test tool calls interactively
- View request/response logs
- Validate JSON schemas

## Integration Testing

### With Claude Desktop

1. Edit `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "semantic-search": {
      "command": "node",
      "args": ["/opt/openclaw/workspace/mcp-servers/semantic-search/build/index.js"]
    }
  }
}
```

2. Restart Claude Desktop
3. Tools should appear in the tool panel

### With mcporter

Add to your mcporter configuration and the tools will be available to the AI assistant.

## Stub Behavior

All tools currently return **mock data**:

- `search` → Returns 2 fake results with similarity scores
- `index_file` → Reports success with 5 chunks
- `index_directory` → Reports success with 12 files
- `reindex_all` → Reports success with 47 files
- `get_stats` → Returns mock statistics

**Stub implementations are in:** `src/tools.ts`

Each stub logs to stderr when called (visible with `2>&1`).

## Next Steps for Implementation

1. **Embeddings**: Replace mock search with real vector embeddings
2. **Storage**: Implement vector database (Pinecone, Weaviate, LanceDB)
3. **Indexing**: Add file reading, chunking, and embedding generation
4. **Watching**: Auto-reindex on file changes
5. **Caching**: Add query result caching

See `README.md` for architecture details.

## File Structure

```
semantic-search/
├── package.json           # Dependencies
├── tsconfig.json         # TypeScript config
├── build/                # Compiled JavaScript (gitignored)
│   ├── index.js         # Main server
│   ├── tools.js         # Tool implementations
│   └── types.js         # Type definitions
├── src/                  # TypeScript source
│   ├── index.ts         # Server entry point
│   ├── tools.ts         # Tool stubs
│   └── types.ts         # Interfaces
└── src/*.impl           # Backup of previous implementation (not compiled)
```

## Status

✅ **Server starts successfully**  
✅ **Responds to MCP protocol messages**  
✅ **All 5 tools registered and callable**  
✅ **Input validation with Zod schemas**  
✅ **Error handling implemented**  
✅ **TypeScript compilation successful**  

Ready for real implementation by other agents!
