/**
 * Embeddings module using Transformers.js
 * Model: all-MiniLM-L6-v2 (384 dimensions, local CPU inference)
 */

import { pipeline, env, FeatureExtractionPipeline } from '@xenova/transformers';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Configure Transformers.js to use local cache (proxy workaround)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
env.localModelPath = path.join(__dirname, '..', '.cache');
env.allowRemoteModels = false; // Use local cache only

export class EmbeddingService {
  private model: FeatureExtractionPipeline | null = null;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';
  private initializationPromise: Promise<void> | null = null;

  /**
   * Initialize the embedding model (lazy loading)
   */
  async initialize(): Promise<void> {
    if (this.model) return;

    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        console.error(`Loading embedding model: ${this.modelName}...`);
        // Use local cache, CPU inference
        this.model = await pipeline('feature-extraction', this.modelName);
        console.error('Embedding model loaded successfully');
      } catch (error) {
        this.initializationPromise = null;
        throw new Error(`Failed to load embedding model: ${error}`);
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    await this.initialize();

    if (!this.model) {
      throw new Error('Embedding model not initialized');
    }

    try {
      const output = await this.model(text, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert tensor to array
      const embedding = Array.from(output.data) as number[];
      return embedding;
    } catch (error) {
      throw new Error(`Embedding generation failed: ${error}`);
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    await this.initialize();

    if (!this.model) {
      throw new Error('Embedding model not initialized');
    }

    try {
      const embeddings: number[][] = [];

      // Process in batches to avoid memory issues
      const batchSize = 32;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchPromises = batch.map(text => this.embed(text));
        const batchResults = await Promise.all(batchPromises);
        embeddings.push(...batchResults);
      }

      return embeddings;
    } catch (error) {
      throw new Error(`Batch embedding generation failed: ${error}`);
    }
  }

  /**
   * Get embedding dimension
   */
  getDimension(): number {
    return 384; // all-MiniLM-L6-v2 produces 384-dimensional embeddings
  }

  /**
   * Check if model is initialized
   */
  isInitialized(): boolean {
    return this.model !== null;
  }
}

// Singleton instance
let embeddingServiceInstance: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService();
  }
  return embeddingServiceInstance;
}
