#!/usr/bin/env node
/**
 * Quick test script for embeddings with WASM backend
 */

// Try to prevent sharp from loading
process.env.SHARP_IGNORE_GLOBAL_LIBVIPS = '1';

console.log('[Test] Starting embeddings test with WASM backend...');

try {
  const { embed, getModelInfo } = await import('./build/embeddings.js');
  
  console.log('[Test] Embeddings module loaded successfully');
  console.log('[Test] Model info:', getModelInfo());
  
  console.log('[Test] Generating embedding for "test"...');
  const embedding = await embed('test');
  
  console.log('[Test] ✅ SUCCESS!');
  console.log('[Test] Embedding dimensions:', embedding.length);
  console.log('[Test] First 10 values:', embedding.slice(0, 10));
  console.log('[Test] WASM backend is working correctly!');
  
  process.exit(0);
} catch (error) {
  console.error('[Test] ❌ FAILED:', error.message);
  console.error('[Test] Stack:', error.stack);
  process.exit(1);
}
