/**
 * AI Adapter - Multi-provider support for StudySync
 * Supports: Ollama (local), Google Gemini, Groq
 * Uses server proxy in production for API key security
 */

import type { Flashcard, MCQ, FillInBlank, ShortAnswer } from '../types';

// Check if we're in production (using server proxy) or development (direct API calls)
const IS_PRODUCTION = import.meta.env.PROD;

// For development only - import local keys
let API_CONFIG: { gemini: string; groq: string } = { gemini: '', groq: '' };
if (!IS_PRODUCTION) {
  try {
    const config = await import('../config/apiKeys');
    API_CONFIG = config.API_CONFIG;
  } catch {
    console.log('[AIAdapter] No local API keys found, using server proxy');
  }
}

// Provider types
export type AIProvider = 'ollama' | 'gemini' | 'groq';

export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface GeneratedContent {
  flashcards: Omit<Flashcard, 'id' | 'chunkIndex'>[];
  mcqs: Omit<MCQ, 'id' | 'chunkIndex'>[];
  fillBlanks: Omit<FillInBlank, 'id' | 'chunkIndex'>[];
  shortAnswers: Omit<ShortAnswer, 'id' | 'chunkIndex'>[];
}

// Default models for each provider
const DEFAULT_MODELS: Record<AIProvider, string> = {
  ollama: 'llama3.2',
  gemini: 'gemini-1.5-flash',
  groq: 'llama-3.3-70b-versatile'
};

// Storage keys
const STORAGE_KEYS = {
  provider: 'studysync_ai_provider',
  geminiKey: 'studysync_gemini_key',
  groqKey: 'studysync_groq_key',
  customInstructions: 'studysync_custom_instructions'
};

// Current configuration
let currentConfig: AIConfig = {
  provider: 'ollama'
};

let customInstructions = '';

// ============================================================================
// Configuration Management
// ============================================================================

export function loadConfig(): AIConfig {
  try {
    const provider = (localStorage.getItem(STORAGE_KEYS.provider) as AIProvider) || 'ollama';
    const geminiKey = localStorage.getItem(STORAGE_KEYS.geminiKey) || '';
    const groqKey = localStorage.getItem(STORAGE_KEYS.groqKey) || '';
    customInstructions = localStorage.getItem(STORAGE_KEYS.customInstructions) || '';
    
    currentConfig = {
      provider,
      apiKey: provider === 'gemini' ? geminiKey : provider === 'groq' ? groqKey : undefined,
      model: DEFAULT_MODELS[provider]
    };
    
    return currentConfig;
  } catch {
    return { provider: 'ollama' };
  }
}

export function saveConfig(config: Partial<AIConfig>): void {
  if (config.provider) {
    localStorage.setItem(STORAGE_KEYS.provider, config.provider);
    currentConfig.provider = config.provider;
    currentConfig.model = DEFAULT_MODELS[config.provider];
  }
  
  if (config.apiKey && currentConfig.provider === 'gemini') {
    localStorage.setItem(STORAGE_KEYS.geminiKey, config.apiKey);
    currentConfig.apiKey = config.apiKey;
  }
  
  if (config.apiKey && currentConfig.provider === 'groq') {
    localStorage.setItem(STORAGE_KEYS.groqKey, config.apiKey);
    currentConfig.apiKey = config.apiKey;
  }
}

export function getConfig(): AIConfig {
  return { ...currentConfig };
}

export function setProvider(provider: AIProvider): void {
  const geminiKey = localStorage.getItem(STORAGE_KEYS.geminiKey) || '';
  const groqKey = localStorage.getItem(STORAGE_KEYS.groqKey) || '';
  
  saveConfig({ 
    provider,
    apiKey: provider === 'gemini' ? geminiKey : provider === 'groq' ? groqKey : undefined
  });
}

export function setApiKey(provider: AIProvider, apiKey: string): void {
  if (provider === 'gemini') {
    localStorage.setItem(STORAGE_KEYS.geminiKey, apiKey);
  } else if (provider === 'groq') {
    localStorage.setItem(STORAGE_KEYS.groqKey, apiKey);
  }
  
  if (currentConfig.provider === provider) {
    currentConfig.apiKey = apiKey;
  }
}

export function getApiKey(provider: AIProvider): string {
  // Use keys from separate config file
  if (provider === 'gemini') {
    return API_CONFIG.gemini;
  } else if (provider === 'groq') {
    return API_CONFIG.groq;
  }
  return '';
}

export function setCustomInstructions(instructions: string): void {
  customInstructions = instructions;
  localStorage.setItem(STORAGE_KEYS.customInstructions, instructions);
}

export function getCustomInstructions(): string {
  if (!customInstructions) {
    customInstructions = localStorage.getItem(STORAGE_KEYS.customInstructions) || '';
  }
  return customInstructions;
}

// ============================================================================
// Prompt Template
// ============================================================================

function getStudyMaterialsPrompt(text: string): string {
  const userInstructions = getCustomInstructions();
  const additionalContext = userInstructions ? `\nUSER NOTES: ${userInstructions}` : '';
  
  return `You are an expert educator. Generate study materials for this topic.${additionalContext}

TOPIC: ${text}

Rules:
- If just a topic name, use your knowledge
- Create exam-quality questions
- Be concise but educational

Return ONLY this JSON format:
{
  "flashcards": [{"question": "Q", "answer": "A (2-3 sentences)"}],
  "mcqs": [{"question": "Q", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "Why A is correct"}],
  "fillBlanks": [{"sentence": "Text with _____", "answer": "word", "explanation": "Brief context"}],
  "shortAnswers": [{"question": "Q requiring analysis", "suggestedAnswer": "Model answer"}]
}

GENERATE: 12 flashcards, 6 MCQs, 6 fill-blanks, 4 short answers.
OUTPUT: Valid JSON only, no markdown.`;
}

// ============================================================================
// Provider Status Checks
// ============================================================================

export async function checkOllamaStatus(): Promise<boolean> {
  // Ollama only works locally
  if (IS_PRODUCTION) return false;
  
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkGeminiStatus(): Promise<boolean> {
  if (IS_PRODUCTION) {
    // Use server proxy to check status
    try {
      const response = await fetch('/api/status/gemini');
      const data = await response.json();
      return data.available;
    } catch {
      return false;
    }
  }
  
  const apiKey = getApiKey('gemini');
  if (!apiKey) return false;
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: 'GET' }
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkGroqStatus(): Promise<boolean> {
  if (IS_PRODUCTION) {
    // Use server proxy to check status
    try {
      const response = await fetch('/api/status/groq');
      const data = await response.json();
      return data.available;
    } catch {
      return false;
    }
  }
  
  const apiKey = getApiKey('groq');
  if (!apiKey) return false;
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkProviderStatus(provider?: AIProvider): Promise<boolean> {
  const p = provider || currentConfig.provider;
  
  switch (p) {
    case 'ollama':
      return checkOllamaStatus();
    case 'gemini':
      return checkGeminiStatus();
    case 'groq':
      return checkGroqStatus();
    default:
      return false;
  }
}

// ============================================================================
// Ollama Provider
// ============================================================================

async function callOllama(prompt: string, onProgress?: (text: string) => void): Promise<string> {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: currentConfig.model || 'llama3.2',
      prompt: prompt,
      stream: !!onProgress,
      format: 'json',
      options: {
        temperature: 0.5,
        num_predict: 3000,
        num_ctx: 2048,
        num_batch: 512,
        num_gpu: 99,
        top_k: 20,
        top_p: 0.8,
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }

  if (onProgress && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          fullResponse += parsed.response;
          onProgress(fullResponse);
        } catch {
          // Skip malformed chunks
        }
      }
    }
    reader.releaseLock();
    return fullResponse;
  }

  const data = await response.json();
  return data.response;
}

// ============================================================================
// Gemini Provider
// ============================================================================

async function callGemini(prompt: string, onProgress?: (text: string) => void): Promise<string> {
  // Use server proxy in production
  if (IS_PRODUCTION) {
    const response = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt, 
        model: currentConfig.model || 'gemini-1.5-flash' 
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Gemini error: ${response.status}`);
    }

    const data = await response.json();
    if (onProgress) onProgress(data.text);
    return data.text;
  }

  // Direct API call in development
  const apiKey = currentConfig.apiKey || getApiKey('gemini');
  
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const model = currentConfig.model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Gemini error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  if (onProgress) {
    onProgress(text);
  }
  
  return text;
}

// ============================================================================
// Groq Provider
// ============================================================================

async function callGroq(prompt: string, onProgress?: (text: string) => void): Promise<string> {
  // Use server proxy in production
  if (IS_PRODUCTION) {
    const response = await fetch('/api/groq/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt, 
        model: currentConfig.model || 'llama-3.3-70b-versatile' 
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Groq error: ${response.status}`);
    }

    const data = await response.json();
    if (onProgress) onProgress(data.text);
    return data.text;
  }

  // Direct API call in development
  const apiKey = currentConfig.apiKey || getApiKey('groq');
  
  if (!apiKey) {
    throw new Error('Groq API key not configured');
  }

  const model = currentConfig.model || 'llama-3.3-70b-versatile';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert educator that generates study materials. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Groq error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  
  if (onProgress) {
    onProgress(text);
  }
  
  return text;
}

// ============================================================================
// Main AI Adapter
// ============================================================================

export async function callAI(
  prompt: string, 
  onProgress?: (text: string) => void
): Promise<string> {
  const provider = currentConfig.provider;
  
  console.log(`[AIAdapter] Using provider: ${provider}`);
  
  switch (provider) {
    case 'ollama':
      return callOllama(prompt, onProgress);
    case 'gemini':
      return callGemini(prompt, onProgress);
    case 'groq':
      return callGroq(prompt, onProgress);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ============================================================================
// Response Parser
// ============================================================================

function parseAIResponse(response: string): GeneratedContent {
  const result: GeneratedContent = {
    flashcards: [],
    mcqs: [],
    fillBlanks: [],
    shortAnswers: []
  };

  try {
    let jsonStr = response.trim();
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (Array.isArray(parsed.flashcards)) {
        result.flashcards = parsed.flashcards
          .filter((f: { question?: string; answer?: string }) => f.question && f.answer)
          .map((f: { question: string; answer: string }) => ({
            question: f.question,
            answer: f.answer
          }));
      }
      
      if (Array.isArray(parsed.mcqs)) {
        result.mcqs = parsed.mcqs
          .filter((m: { question?: string; options?: string[] }) => m.question && Array.isArray(m.options) && m.options.length >= 2)
          .map((m: { question: string; options: string[]; correctIndex?: number; explanation?: string }) => ({
            question: m.question,
            options: m.options,
            correctIndex: typeof m.correctIndex === 'number' ? m.correctIndex : 0,
            explanation: m.explanation || ''
          }));
      }
      
      if (Array.isArray(parsed.fillBlanks)) {
        result.fillBlanks = parsed.fillBlanks
          .filter((f: { sentence?: string; answer?: string }) => f.sentence && f.answer)
          .map((f: { sentence: string; answer: string; explanation?: string }) => ({
            sentence: f.sentence,
            answer: f.answer,
            explanation: f.explanation || ''
          }));
      }
      
      if (Array.isArray(parsed.shortAnswers)) {
        result.shortAnswers = parsed.shortAnswers
          .filter((s: { question?: string }) => s.question)
          .map((s: { question: string; suggestedAnswer?: string }) => ({
            question: s.question,
            suggestedAnswer: s.suggestedAnswer || ''
          }));
      }
      
      console.log('[AIAdapter] Parsed results:', {
        flashcards: result.flashcards.length,
        mcqs: result.mcqs.length,
        fillBlanks: result.fillBlanks.length,
        shortAnswers: result.shortAnswers.length
      });
    }
  } catch (e) {
    console.error('[AIAdapter] Error parsing response:', e);
  }

  return result;
}

// ============================================================================
// Fallback Generator
// ============================================================================

function extractSentences(text: string): string[] {
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 600);
  
  return sentences.length > 0 ? sentences : cleaned.split(/[.\n]+/).map(s => s.trim()).filter(s => s.length > 10);
}

function extractImportantWords(sentence: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'to', 'of', 'in', 'for', 'on', 'with',
    'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after',
    'and', 'but', 'if', 'or', 'because', 'this', 'that', 'these', 'those',
    'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who', 'whom'
  ]);
  
  return sentence
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word.toLowerCase()));
}

function generateFallbackContent(text: string): GeneratedContent {
  console.log('[AIAdapter] Generating fallback content locally');
  
  const sentences = extractSentences(text);
  const flashcards: GeneratedContent['flashcards'] = [];
  const mcqs: GeneratedContent['mcqs'] = [];
  const fillBlanks: GeneratedContent['fillBlanks'] = [];
  const shortAnswers: GeneratedContent['shortAnswers'] = [];
  
  for (let i = 0; i < sentences.length && flashcards.length < 25; i++) {
    const sentence = sentences[i];
    const words = extractImportantWords(sentence);
    
    if (words.length > 0) {
      flashcards.push({
        question: `What do you know about: ${words.slice(0, 2).join(', ')}?`,
        answer: sentence
      });
    }
  }
  
  for (let i = 0; i < sentences.length && fillBlanks.length < 15; i++) {
    const sentence = sentences[i];
    const words = extractImportantWords(sentence);
    
    if (words.length > 0) {
      const wordToRemove = words[Math.floor(Math.random() * Math.min(3, words.length))];
      const blanked = sentence.replace(new RegExp(`\\b${wordToRemove}\\b`, 'i'), '_____');
      
      if (blanked !== sentence) {
        fillBlanks.push({ sentence: blanked, answer: wordToRemove, explanation: '' });
      }
    }
  }
  
  for (let i = 0; i < sentences.length && mcqs.length < 10; i++) {
    const sentence = sentences[i];
    const words = extractImportantWords(sentence);
    
    if (words.length >= 4) {
      const correctWord = words[0];
      const wrongOptions = words.slice(1, 4);
      while (wrongOptions.length < 3) wrongOptions.push(`Option ${wrongOptions.length + 1}`);
      
      const options = [correctWord, ...wrongOptions];
      for (let j = options.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [options[j], options[k]] = [options[k], options[j]];
      }
      
      mcqs.push({
        question: `Which term is most relevant to: "${sentence.substring(0, 60)}..."?`,
        options,
        correctIndex: options.indexOf(correctWord),
        explanation: sentence
      });
    }
  }
  
  for (let i = 0; i < sentences.length && shortAnswers.length < 8; i++) {
    const sentence = sentences[i];
    const words = extractImportantWords(sentence);
    if (words.length > 0) {
      shortAnswers.push({
        question: `Explain the concept: ${words.slice(0, 2).join(' ')}`,
        suggestedAnswer: sentence
      });
    }
  }
  
  return { flashcards, mcqs, fillBlanks, shortAnswers };
}

// ============================================================================
// Main Processing Function
// ============================================================================

export async function processChunk(
  text: string,
  chunkIndex: number,
  totalChunks: number,
  onProgress?: (text: string) => void
): Promise<GeneratedContent> {
  console.log(`[AIAdapter] Processing chunk ${chunkIndex + 1}/${totalChunks} with ${currentConfig.provider}`);
  
  if (text.trim().length < 50) {
    console.log('[AIAdapter] Text too short, returning empty result');
    return { flashcards: [], mcqs: [], fillBlanks: [], shortAnswers: [] };
  }

  const prompt = getStudyMaterialsPrompt(text);

  try {
    const isAvailable = await checkProviderStatus();
    if (!isAvailable) {
      throw new Error(`${currentConfig.provider} is not available. Check connection or API key.`);
    }

    const response = await callAI(prompt, onProgress);
    const parsed = parseAIResponse(response);
    
    const totalItems = parsed.flashcards.length + parsed.mcqs.length + 
                       parsed.fillBlanks.length + parsed.shortAnswers.length;
    
    if (totalItems > 0) {
      console.log(`[AIAdapter] Successfully generated ${totalItems} items`);
      return parsed;
    }
    
    console.log('[AIAdapter] No items parsed, using fallback');
    return generateFallbackContent(text);
    
  } catch (error) {
    console.error('[AIAdapter] Error:', error);
    console.log('[AIAdapter] Falling back to local content generator');
    return generateFallbackContent(text);
  }
}

// ============================================================================
// Utility Exports
// ============================================================================

export function splitIntoChunks(text: string, maxWords: number = 1500): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += maxWords) {
    const chunk = words.slice(i, i + maxWords).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
  }
  
  console.log(`[AIAdapter] Split text into ${chunks.length} chunks`);
  return chunks;
}

// Initialize on load
loadConfig();
