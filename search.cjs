#!/usr/bin/env node
/**
 * Semantic Search CLI
 * Usage: node search.js "your query here"
 *        node search.js --index /path/to/file.md
 *        node search.js --index-dir /path/to/directory
 *        node search.js --reindex
 *        node search.js --stats
 */

// Mock sharp before importing anything else
require.cache[require.resolve('sharp')] = { exports: {} };

const { indexFile, indexDirectory, reindexAll, hybridSearch, formatResults } = require('./build/search.js');
const { getVectorDatabase } = require('./build/vectordb.js');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node search.js "your query"     - Search indexed documents');
    console.log('  node search.js --index <file>   - Index a single file');
    console.log('  node search.js --index-dir <dir> - Index a directory');
    console.log('  node search.js --reindex        - Reindex workspace');
    console.log('  node search.js --stats          - Show index stats');
    process.exit(0);
  }
  
  if (args[0] === '--index' && args[1]) {
    console.log(`Indexing ${args[1]}...`);
    const chunks = await indexFile(args[1]);
    console.log(`✅ Indexed ${chunks} chunks`);
  } else if (args[0] === '--index-dir' && args[1]) {
    console.log(`Indexing directory ${args[1]}...`);
    const result = await indexDirectory(args[1], '**/*.md');
    console.log(`✅ Indexed ${result.indexed} chunks`);
    if (result.failed.length > 0) {
      console.log(`⚠️  Failed: ${result.failed.join(', ')}`);
    }
  } else if (args[0] === '--reindex') {
    const workspace = process.env.SEMANTIC_SEARCH_WORKSPACE || '/opt/openclaw/workspace';
    console.log(`Reindexing workspace: ${workspace}`);
    const result = await reindexAll(workspace);
    console.log(`✅ Indexed ${result.indexed} chunks from ~${result.files_count} files`);
  } else if (args[0] === '--stats') {
    const db = getVectorDatabase();
    const stats = await db.getStats();
    console.log('📊 Index Stats:');
    console.log(`   Total chunks: ${stats.total_chunks}`);
    console.log(`   Indexed files: ${stats.total_files}`);
    console.log(`   Database size: ${stats.db_size_mb} MB`);
  } else {
    // Search
    const query = args.join(' ');
    console.log(`🔍 Searching: "${query}"\n`);
    const results = await hybridSearch(query, 5);
    console.log(formatResults(results));
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
