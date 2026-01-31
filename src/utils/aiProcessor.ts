/**
 * AI Processor - Now uses local Ollama with llama3.2
 * Falls back to local generation if Ollama is unavailable
 */

// Re-export everything from ollamaProcessor for backwards compatibility
export {
  processChunk,
  setCustomInstructions,
  getCustomInstructions,
  checkOllamaStatus,
  splitIntoChunks
} from './ollamaProcessor';
