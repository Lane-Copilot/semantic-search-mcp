#!/usr/bin/env node

/**
 * Semantic Search MCP Server
 * 
 * A local-first MCP server that enables semantic search across Lane's workspace
 * using Transformers.js (all-MiniLM-L6-v2) and LanceDB.
 * 
 * Features:
 * - Local embeddings (no external API calls)
 * - Persistent vector storage with LanceDB
 * - Hybrid search (semantic + keyword boosting)
 * - Intelligent document chunking
 * - Support for incremental indexing
 * 
 * Tools:
 * - search: Semantic search across indexed documents
 * - index_file: Index a single file
 * - index_directory: Index all files in a directory
 * - reindex_all: Clear and rebuild the entire index
 * - get_stats: Get index statistics
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools.js';
import { getVectorDatabase } from './vectordb.js';

// Server configuration
const SERVER_NAME = 'semantic-search-server';
const SERVER_VERSION = '1.0.0';

/**
 * Create and configure the MCP server
 */
function createServer(): Server {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register all tools
  registerTools(server);

  // Setup error handlers
  server.onerror = (error) => {
    console.error('[MCP Error]', error);
  };

  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
  });

  return server;
}

/**
 * Cleanup resources on shutdown
 */
async function cleanup() {
  console.error('Shutting down semantic search server...');
  try {
    const vectorDb = getVectorDatabase();
    await vectorDb.close();
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

/**
 * Initialize server components
 */
async function initializeServer() {
  console.error('='.repeat(60));
  console.error(`${SERVER_NAME} v${SERVER_VERSION}`);
  console.error('='.repeat(60));
  console.error('Initializing server components...');

  try {
    // Embedding service will lazy-load on first use
    console.error('✓ Embedding service ready (will load model on first use)');

    // Initialize vector database
    const vectorDb = getVectorDatabase(
      process.env.LANCEDB_PATH || './lancedb'
    );
    await vectorDb.initialize();
    console.error('✓ Vector database connected');

    // Get initial stats
    const stats = await vectorDb.getStats();
    console.error(`✓ Index loaded: ${stats.total_chunks} chunks, ${stats.total_files} files`);

    console.error('='.repeat(60));
    console.error('Server ready! Waiting for requests...');
    console.error('='.repeat(60));
  } catch (error) {
    console.error('Failed to initialize server:', error);
    throw error;
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Create the server
    const server = createServer();

    // Initialize components
    await initializeServer();

    // Create stdio transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.connect(transport);

    // Server is now running and will handle requests via stdio
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Start the server
main();
