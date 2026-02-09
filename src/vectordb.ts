/**
 * Vector database module using LanceDB
 * Handles persistent storage and retrieval of document embeddings
 */

import * as lancedb from '@lancedb/lancedb';
import { getEmbeddingService } from './embeddings.js';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface DocumentChunk {
  id: string;
  text: string;
  embedding: number[];
  file_path: string;
  line_start: number;
  line_end: number;
  chunk_index: number;
  metadata: {
    file_name: string;
    directory: string;
    indexed_at: string;
    char_count: number;
  };
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  distance: number;
}

export class VectorDatabase {
  private db: lancedb.Connection | null = null;
  private table: lancedb.Table | null = null;
  private readonly dbPath: string;
  private readonly tableName = 'document_chunks';
  private embeddingService = getEmbeddingService();

  constructor(dbPath: string = './lancedb') {
    this.dbPath = path.resolve(dbPath);
  }

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    try {
      // Ensure database directory exists
      await fs.mkdir(this.dbPath, { recursive: true });

      console.error(`Connecting to LanceDB at ${this.dbPath}...`);
      this.db = await lancedb.connect(this.dbPath);

      // Check if table exists
      const tableNames = await this.db.tableNames();
      if (tableNames.includes(this.tableName)) {
        this.table = await this.db.openTable(this.tableName);
        console.error(`Opened existing table: ${this.tableName}`);
      } else {
        console.error(`Table ${this.tableName} does not exist yet, will create on first insert`);
      }
    } catch (error) {
      throw new Error(`Failed to initialize LanceDB: ${error}`);
    }
  }

  /**
   * Add or update document chunks in the database
   */
  async addChunks(chunks: Omit<DocumentChunk, 'embedding'>[]): Promise<void> {
    await this.initialize();

    if (!this.db) {
      throw new Error('Database not initialized');
    }

    if (chunks.length === 0) {
      console.error('No chunks to add');
      return;
    }

    try {
      // Generate embeddings for all chunks
      console.error(`Generating embeddings for ${chunks.length} chunks...`);
      const texts = chunks.map(c => c.text);
      const embeddings = await this.embeddingService.embedBatch(texts);

      // Combine chunks with embeddings - convert to plain objects
      const chunksWithEmbeddings = chunks.map((chunk, i) => ({
        id: chunk.id,
        text: chunk.text,
        embedding: embeddings[i],
        file_path: chunk.file_path,
        line_start: chunk.line_start,
        line_end: chunk.line_end,
        chunk_index: chunk.chunk_index,
        file_name: chunk.metadata.file_name,
        directory: chunk.metadata.directory,
        indexed_at: chunk.metadata.indexed_at,
        char_count: chunk.metadata.char_count,
      }));

      // Create or append to table
      if (!this.table) {
        console.error(`Creating new table: ${this.tableName}`);
        this.table = await this.db.createTable(this.tableName, chunksWithEmbeddings);
      } else {
        console.error(`Adding ${chunksWithEmbeddings.length} chunks to existing table`);
        await this.table.add(chunksWithEmbeddings);
      }

      console.error(`Successfully added ${chunksWithEmbeddings.length} chunks`);
    } catch (error) {
      throw new Error(`Failed to add chunks: ${error}`);
    }
  }

  /**
   * Delete all chunks from a specific file
   */
  async deleteFileChunks(filePath: string): Promise<number> {
    await this.initialize();

    if (!this.table) {
      return 0;
    }

    try {
      const normalizedPath = path.resolve(filePath);
      
      // LanceDB uses SQL-like filter syntax
      await this.table.delete(`file_path = '${normalizedPath.replace(/'/g, "''")}'`);
      
      console.error(`Deleted chunks for file: ${normalizedPath}`);
      return 1;
    } catch (error) {
      console.error(`Failed to delete chunks for ${filePath}: ${error}`);
      return 0;
    }
  }

  /**
   * Search for similar chunks using vector similarity
   */
  async search(
    query: string,
    limit: number = 10,
    filePathFilter?: string
  ): Promise<SearchResult[]> {
    await this.initialize();

    if (!this.table) {
      console.error('No indexed documents found');
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.embeddingService.embed(query);

      // Perform vector search
      let searchQuery = this.table
        .vectorSearch(queryEmbedding)
        .limit(limit);

      // Apply file path filter if provided
      if (filePathFilter) {
        const normalizedPath = path.resolve(filePathFilter);
        searchQuery = searchQuery.where(`file_path = '${normalizedPath.replace(/'/g, "''")}'`);
      }

      const results = await searchQuery.toArray();

      // Transform results
      return results.map((result: any) => ({
        chunk: {
          id: result.id,
          text: result.text,
          embedding: result.embedding,
          file_path: result.file_path,
          line_start: result.line_start,
          line_end: result.line_end,
          chunk_index: result.chunk_index,
          metadata: {
            file_name: result.file_name,
            directory: result.directory,
            indexed_at: result.indexed_at,
            char_count: result.char_count,
          },
        },
        score: 1 - (result._distance || 0), // Convert distance to similarity score
        distance: result._distance || 0,
      }));
    } catch (error) {
      throw new Error(`Search failed: ${error}`);
    }
  }

  /**
   * Get statistics about the indexed documents
   */
  async getStats(): Promise<{
    total_chunks: number;
    total_files: number;
    file_list: string[];
    db_size_mb: number;
  }> {
    await this.initialize();

    if (!this.table) {
      return {
        total_chunks: 0,
        total_files: 0,
        file_list: [],
        db_size_mb: 0,
      };
    }

    try {
      const count = await this.table.countRows();
      
      // Get unique file paths
      const allData = await this.table.query().toArray();
      const uniqueFiles = new Set<string>();
      for (const row of allData) {
        if (row.file_path) {
          uniqueFiles.add(row.file_path);
        }
      }
      const fileList = Array.from(uniqueFiles);

      // Estimate database size
      let dbSize = 0;
      try {
        const getDirectorySize = async (dirPath: string): Promise<number> => {
          let totalSize = 0;
          const files = await fs.readdir(dirPath, { withFileTypes: true });
          
          for (const file of files) {
            const filePath = path.join(dirPath, file.name);
            if (file.isDirectory()) {
              totalSize += await getDirectorySize(filePath);
            } else {
              const stats = await fs.stat(filePath);
              totalSize += stats.size;
            }
          }
          
          return totalSize;
        };
        
        const bytes = await getDirectorySize(this.dbPath);
        dbSize = bytes / (1024 * 1024); // Convert to MB
      } catch {
        dbSize = 0;
      }

      return {
        total_chunks: count,
        total_files: fileList.length,
        file_list: fileList,
        db_size_mb: parseFloat(dbSize.toFixed(2)),
      };
    } catch (error) {
      throw new Error(`Failed to get stats: ${error}`);
    }
  }

  /**
   * Delete all data (for reindex)
   */
  async clear(): Promise<void> {
    await this.initialize();

    if (!this.table) {
      return;
    }

    try {
      // Drop the table
      if (this.db) {
        await this.db.dropTable(this.tableName);
        this.table = null;
        console.error('Database cleared');
      }
    } catch (error) {
      throw new Error(`Failed to clear database: ${error}`);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    // LanceDB connections are managed automatically
    this.db = null;
    this.table = null;
  }
}

// Singleton instance
let vectorDbInstance: VectorDatabase | null = null;

export function getVectorDatabase(dbPath?: string): VectorDatabase {
  if (!vectorDbInstance) {
    vectorDbInstance = new VectorDatabase(dbPath);
  }
  return vectorDbInstance;
}
