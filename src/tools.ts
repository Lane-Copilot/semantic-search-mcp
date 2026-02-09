/**
 * MCP tool definitions for semantic search
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { 
  indexFile, 
  indexDirectory, 
  reindexAll, 
  hybridSearch, 
  formatResults 
} from './search.js';
import { getVectorDatabase } from './vectordb.js';
import * as path from 'path';

// Get workspace root from environment or default
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

/**
 * Register all semantic search tools with the MCP server
 */
export function registerTools(server: Server) {
  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'search':
          return await handleSearch(args || {});
        
        case 'index_file':
          return await handleIndexFile(args || {});
        
        case 'index_directory':
          return await handleIndexDirectory(args || {});
        
        case 'reindex_all':
          return await handleReindexAll(args || {});
        
        case 'get_stats':
          return await handleGetStats(args || {});
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error.message}`
          }
        ],
        isError: true
      };
    }
  });

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'search',
        description: 'Perform semantic search across indexed documents. Supports natural language queries and returns relevant chunks with file locations.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (natural language or keywords)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10)',
              default: 10,
              minimum: 1,
              maximum: 100
            },
            hybrid: {
              type: 'boolean',
              description: 'Enable hybrid search (semantic + keyword boosting, default: true)',
              default: true
            }
          },
          required: ['query']
        }
      },
      {
        name: 'index_file',
        description: 'Index or re-index a specific file. Replaces existing chunks if file was already indexed.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute or relative path to the file to index'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'index_directory',
        description: 'Index all matching files in a directory. Supports glob patterns.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Directory path to index'
            },
            pattern: {
              type: 'string',
              description: 'Glob pattern for file matching (default: "**/*.md")',
              default: '**/*.md'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'reindex_all',
        description: 'Clear the index and rebuild from scratch. Indexes memory/, diaries/, .lane/plans/, and root .md files.',
        inputSchema: {
          type: 'object',
          properties: {
            workspace_root: {
              type: 'string',
              description: 'Workspace root directory (optional, defaults to WORKSPACE_ROOT env var)',
              default: WORKSPACE_ROOT
            }
          }
        }
      },
      {
        name: 'get_stats',
        description: 'Get statistics about the indexed documents (chunk count, file count, database size).',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  }));
}

/**
 * Handle search tool call
 */
async function handleSearch(args: Record<string, any>) {
  const { query, limit = 10, hybrid = true } = args;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('Query parameter is required and must be a non-empty string');
  }

  const numLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
  
  console.error(`Searching for: "${query}" (limit: ${numLimit}, hybrid: ${hybrid})`);
  
  const results = await hybridSearch(query, numLimit, hybrid);
  const formattedResults = formatResults(results);

  return {
    content: [
      {
        type: 'text' as const,
        text: formattedResults
      }
    ]
  };
}

/**
 * Handle index_file tool call
 */
async function handleIndexFile(args: Record<string, any>) {
  const { path: filePath } = args;

  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Path parameter is required and must be a string');
  }

  const resolvedPath = path.resolve(WORKSPACE_ROOT, filePath);
  console.error(`Indexing file: ${resolvedPath}`);
  
  const chunkCount = await indexFile(resolvedPath);

  return {
    content: [
      {
        type: 'text' as const,
        text: `Successfully indexed ${resolvedPath}\nCreated ${chunkCount} chunks`
      }
    ]
  };
}

/**
 * Handle index_directory tool call
 */
async function handleIndexDirectory(args: Record<string, any>) {
  const { path: dirPath, pattern = '**/*.md' } = args;

  if (!dirPath || typeof dirPath !== 'string') {
    throw new Error('Path parameter is required and must be a string');
  }

  const resolvedPath = path.resolve(WORKSPACE_ROOT, dirPath);
  console.error(`Indexing directory: ${resolvedPath} (pattern: ${pattern})`);
  
  const result = await indexDirectory(resolvedPath, pattern);

  let message = `Indexed ${result.indexed} chunks from ${resolvedPath}\n`;
  
  if (result.failed.length > 0) {
    message += `\nFailed to index ${result.failed.length} files:\n`;
    message += result.failed.map(f => `  - ${f}`).join('\n');
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: message
      }
    ]
  };
}

/**
 * Handle reindex_all tool call
 */
async function handleReindexAll(args: Record<string, any>) {
  const { workspace_root = WORKSPACE_ROOT } = args;
  const resolvedRoot = path.resolve(workspace_root);

  console.error(`Reindexing all documents from ${resolvedRoot}...`);
  
  const result = await reindexAll(resolvedRoot);

  let message = `Reindex complete!\n\n`;
  message += `Total chunks indexed: ${result.indexed}\n`;
  message += `Files processed: ~${result.files_count}\n`;
  
  if (result.failed.length > 0) {
    message += `\nFailed files: ${result.failed.length}\n`;
    message += result.failed.map(f => `  - ${f}`).join('\n');
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: message
      }
    ]
  };
}

/**
 * Handle get_stats tool call
 */
async function handleGetStats(_args: Record<string, any>) {
  const vectorDb = getVectorDatabase();
  const stats = await vectorDb.getStats();

  const message = `Index Statistics:\n\n` +
    `Total chunks: ${stats.total_chunks}\n` +
    `Total files: ${stats.total_files}\n` +
    `Database size: ${stats.db_size_mb} MB\n\n` +
    `Indexed files:\n` +
    stats.file_list.map(f => `  - ${f}`).join('\n');

  return {
    content: [
      {
        type: 'text' as const,
        text: message
      }
    ]
  };
}
