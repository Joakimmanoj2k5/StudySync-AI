/**
 * AI Processor - Multi-provider support (Ollama, Gemini, Groq)
 * Re-exports from aiAdapter for backwards compatibility
 */

export {
  // Main processing
  processChunk,
  splitIntoChunks,
  
  // Configuration
  loadConfig,
  saveConfig,
  getConfig,
  setProvider,
  setApiKey,
  getApiKey,
  setCustomInstructions,
  getCustomInstructions,
  
  // Status checks
  checkProviderStatus,
  checkOllamaStatus,
  checkGeminiStatus,
  checkGroqStatus,
  
  // Types
  type AIProvider,
  type AIConfig,
  type GeneratedContent
} from './aiAdapter';
