/**
 * Search module with intelligent chunking and hybrid search
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getVectorDatabase, DocumentChunk, SearchResult } from './vectordb.js';
import { createHash } from 'crypto';

/**
 * Intelligent document chunking
 * Chunks by paragraphs/sections, not fixed size
 */
export function chunkDocument(content: string, filePath: string): Omit<DocumentChunk, 'embedding'>[] {
  const chunks: Omit<DocumentChunk, 'embedding'>[] = [];
  
  // Split by double newlines (paragraphs) first
  const paragraphs = content.split(/\n\s*\n/);
  
  let currentChunk = '';
  let currentLineStart = 1;
  let currentLineCount = 0;
  let chunkIndex = 0;
  
  const maxChunkSize = 1000; // characters
  const minChunkSize = 200; // Don't create tiny chunks
  
  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    if (!trimmedPara) continue;
    
    const paraLineCount = trimmedPara.split('\n').length;
    
    // If adding this paragraph exceeds max size, save current chunk
    if (currentChunk.length > 0 && 
        currentChunk.length + trimmedPara.length > maxChunkSize &&
        currentChunk.length >= minChunkSize) {
      
      chunks.push(createChunk(
        currentChunk,
        filePath,
        currentLineStart,
        currentLineStart + currentLineCount - 1,
        chunkIndex++
      ));
      
      currentChunk = trimmedPara;
      currentLineStart += currentLineCount;
      currentLineCount = paraLineCount;
    } else {
      // Add to current chunk
      if (currentChunk.length > 0) {
        currentChunk += '\n\n' + trimmedPara;
      } else {
        currentChunk = trimmedPara;
      }
      currentLineCount += paraLineCount;
    }
  }
  
  // Add final chunk
  if (currentChunk.length >= minChunkSize || chunks.length === 0) {
    chunks.push(createChunk(
      currentChunk,
      filePath,
      currentLineStart,
      currentLineStart + currentLineCount - 1,
      chunkIndex
    ));
  }
  
  return chunks;
}

/**
 * Create a chunk object
 */
function createChunk(
  text: string,
  filePath: string,
  lineStart: number,
  lineEnd: number,
  chunkIndex: number
): Omit<DocumentChunk, 'embedding'> {
  const normalizedPath = path.resolve(filePath);
  const fileName = path.basename(filePath);
  const directory = path.dirname(filePath);
  
  // Generate deterministic ID
  const id = createHash('sha256')
    .update(`${normalizedPath}-${chunkIndex}`)
    .digest('hex')
    .substring(0, 16);
  
  return {
    id,
    text: text.trim(),
    file_path: normalizedPath,
    line_start: lineStart,
    line_end: lineEnd,
    chunk_index: chunkIndex,
    metadata: {
      file_name: fileName,
      directory,
      indexed_at: new Date().toISOString(),
      char_count: text.length,
    },
  };
}

/**
 * Index a single file
 */
export async function indexFile(filePath: string): Promise<number> {
  const vectorDb = getVectorDatabase();
  
  try {
    // Read file
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Delete existing chunks for this file
    await vectorDb.deleteFileChunks(filePath);
    
    // Chunk the document
    const chunks = chunkDocument(content, filePath);
    
    if (chunks.length === 0) {
      console.error(`No chunks created for ${filePath}`);
      return 0;
    }
    
    // Add chunks to database
    await vectorDb.addChunks(chunks);
    
    return chunks.length;
  } catch (error) {
    throw new Error(`Failed to index ${filePath}: ${error}`);
  }
}

/**
 * Index all files in a directory
 */
export async function indexDirectory(
  dirPath: string,
  pattern: string = '**/*.md'
): Promise<{ indexed: number; failed: string[] }> {
  const glob = await import('glob');
  const normalizedDir = path.resolve(dirPath);
  
  try {
    // Find matching files
    const files = glob.sync(pattern, {
      cwd: normalizedDir,
      absolute: true,
      nodir: true,
      ignore: ['**/node_modules/**', '**/build/**', '**/.git/**'],
    });
    
    console.error(`Found ${files.length} files to index in ${normalizedDir}`);
    
    let indexed = 0;
    const failed: string[] = [];
    
    // Index each file
    for (const file of files) {
      try {
        const chunkCount = await indexFile(file);
        indexed += chunkCount;
        console.error(`✓ Indexed ${file} (${chunkCount} chunks)`);
      } catch (error) {
        console.error(`✗ Failed to index ${file}: ${error}`);
        failed.push(file);
      }
    }
    
    return { indexed, failed };
  } catch (error) {
    throw new Error(`Failed to index directory ${dirPath}: ${error}`);
  }
}

/**
 * Reindex all documents (clear and rebuild)
 */
export async function reindexAll(workspaceRoot: string): Promise<{ 
  indexed: number; 
  failed: string[]; 
  files_count: number;
}> {
  const vectorDb = getVectorDatabase();
  
  try {
    console.error('Clearing existing index...');
    await vectorDb.clear();
    
    // Define directories to index
    const indexPaths = [
      'memory/**/*.md',
      'diaries/**/*.md',
      '.lane/plans/**/*.md',
      '*.md', // Root markdown files
    ];
    
    let totalIndexed = 0;
    let totalFiles = 0;
    const allFailed: string[] = [];
    
    for (const pattern of indexPaths) {
      try {
        const result = await indexDirectory(workspaceRoot, pattern);
        totalIndexed += result.indexed;
        allFailed.push(...result.failed);
        
        const successCount = Math.ceil(result.indexed / 5); // Approximate files (5 chunks avg)
        totalFiles += successCount;
      } catch (error) {
        console.error(`Failed to index pattern ${pattern}: ${error}`);
      }
    }
    
    return {
      indexed: totalIndexed,
      failed: allFailed,
      files_count: totalFiles,
    };
  } catch (error) {
    throw new Error(`Reindex failed: ${error}`);
  }
}

/**
 * Hybrid search: semantic + keyword matching
 */
export async function hybridSearch(
  query: string,
  limit: number = 10,
  enableHybrid: boolean = true
): Promise<SearchResult[]> {
  const vectorDb = getVectorDatabase();
  
  // Perform semantic search
  const semanticResults = await vectorDb.search(query, limit * 2); // Get more for reranking
  
  if (!enableHybrid) {
    return semanticResults.slice(0, limit);
  }
  
  // Extract keywords from query (simple approach)
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3); // Only consider words > 3 chars
  
  // Boost results that contain exact keyword matches
  const boostedResults = semanticResults.map(result => {
    let keywordScore = 0;
    const textLower = result.chunk.text.toLowerCase();
    
    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        keywordScore += 0.2; // Boost by 0.2 per keyword match
      }
    }
    
    return {
      ...result,
      score: Math.min(result.score + keywordScore, 1.0), // Cap at 1.0
    };
  });
  
  // Re-sort by boosted score
  boostedResults.sort((a, b) => b.score - a.score);
  
  return boostedResults.slice(0, limit);
}

/**
 * Format search results for display
 */
export function formatResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No results found.';
  }
  
  let output = `Found ${results.length} results:\n\n`;
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const chunk = result.chunk;
    
    output += `${i + 1}. ${chunk.metadata.file_name} (lines ${chunk.line_start}-${chunk.line_end})\n`;
    output += `   Score: ${result.score.toFixed(3)}\n`;
    output += `   Path: ${chunk.file_path}\n`;
    
    // Show snippet (first 150 chars)
    const snippet = chunk.text.substring(0, 150).replace(/\n/g, ' ');
    output += `   Preview: ${snippet}${chunk.text.length > 150 ? '...' : ''}\n\n`;
  }
  
  return output;
}
