/**
 * AI Adapter - Multi-provider support for StudySync
 * Supports: Ollama (local), Google Gemini, Groq
 * Uses server proxy in production for API key security
 */

import type { Flashcard, MCQ, FillInBlank, ShortAnswer } from '../types';

// Check if we're in production (using server proxy) or development (direct API calls)
const IS_PRODUCTION = import.meta.env.PROD;

// API keys from environment variables (for development)
// In production, we use server-side proxy so keys aren't needed client-side
const API_CONFIG = {
  gemini: import.meta.env.VITE_GEMINI_API_KEY || '',
  groq: import.meta.env.VITE_GROQ_API_KEY || ''
};

const DEBUG_AI = import.meta.env.DEV;
const debugLog = (...args: unknown[]) => {
  if (DEBUG_AI) console.log(...args);
};

debugLog('[AIAdapter] Environment:', IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT');
debugLog('[AIAdapter] Gemini key loaded:', API_CONFIG.gemini ? 'YES' : 'NO');
debugLog('[AIAdapter] Groq key loaded:', API_CONFIG.groq ? 'YES' : 'NO');

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

interface GenerationTargets {
  flashcards: number;
  mcqs: number;
  fillBlanks: number;
  shortAnswers: number;
}

interface ProcessChunkOptions {
  skipAvailabilityCheck?: boolean;
}

// Default models for each provider
const DEFAULT_MODELS: Record<AIProvider, string> = {
  ollama: 'llama3.2',
  gemini: 'gemini-2.0-flash',
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
  provider: 'groq'
};

let customInstructions = '';

// ============================================================================
// Configuration Management
// ============================================================================

export function loadConfig(): AIConfig {
  try {
    const provider = (localStorage.getItem(STORAGE_KEYS.provider) as AIProvider) || 'groq';
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

function getWordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function getGenerationTargets(text: string, totalChunks: number): GenerationTargets {
  const wordCount = getWordCount(text);

  const baseTargets: GenerationTargets =
    wordCount < 250
      ? { flashcards: 3, mcqs: 2, fillBlanks: 2, shortAnswers: 1 }
      : wordCount < 700
        ? { flashcards: 5, mcqs: 3, fillBlanks: 2, shortAnswers: 1 }
        : wordCount < 1400
          ? { flashcards: 7, mcqs: 4, fillBlanks: 3, shortAnswers: 2 }
          : { flashcards: 8, mcqs: 4, fillBlanks: 4, shortAnswers: 2 };

  if (totalChunks === 1) {
    return {
      flashcards: Math.min(10, baseTargets.flashcards + 2),
      mcqs: Math.min(5, baseTargets.mcqs + 1),
      fillBlanks: Math.min(5, baseTargets.fillBlanks + 1),
      shortAnswers: Math.min(3, baseTargets.shortAnswers + 1),
    };
  }

  return baseTargets;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
}

function uniqueBySignature<T>(items: T[], getSignature: (item: T) => string): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const signature = getSignature(item);
    if (!signature || seen.has(signature)) {
      return false;
    }

    seen.add(signature);
    return true;
  });
}

function trimGeneratedContent(content: GeneratedContent, targets: GenerationTargets): GeneratedContent {
  return {
    flashcards: uniqueBySignature(content.flashcards, (item) => normalizeText(item.question))
      .slice(0, targets.flashcards),
    mcqs: uniqueBySignature(content.mcqs, (item) => normalizeText(item.question))
      .slice(0, targets.mcqs),
    fillBlanks: uniqueBySignature(content.fillBlanks, (item) => normalizeText(item.sentence))
      .slice(0, targets.fillBlanks),
    shortAnswers: uniqueBySignature(content.shortAnswers, (item) => normalizeText(item.question))
      .slice(0, targets.shortAnswers),
  };
}

function getStudyMaterialsPrompt(
  text: string,
  chunkIndex: number,
  totalChunks: number,
  targets: GenerationTargets
): string {
  const userInstructions = getCustomInstructions();
  const additionalContext = userInstructions ? `\n\nADDITIONAL USER INSTRUCTIONS: ${userInstructions}` : '';
  
  return `You are an expert educator and exam question writer. Your task is to create HIGH-QUALITY, EXAM-WORTHY study materials.${additionalContext}

DOCUMENT SEGMENT: ${chunkIndex + 1} of ${totalChunks}

CONTENT TO STUDY:
"""
${text}
"""

QUALITY RULES (MANDATORY):
1. Use exact terminology from the source text whenever possible.
2. No generic prompts like "What is X?" unless X is a precise technical term from the text.
3. Every question must include enough context to stand alone.
4. Prefer "how/why/compare/analyze" style questions over definition-only questions.
5. MCQ distractors must be plausible and domain-relevant, not random words.
6. Flashcard answers must be specific and include 1 concrete detail from the source text.
7. Fill-in-the-blank must hide a key concept/term, not a filler word.
8. If the source has formulas, steps, timelines, or named entities, include them.
9. Do not invent facts not present in the source text.
10. Keep language clear and exam-focused.
11. Avoid repeating the same concept in multiple formats unless the source strongly justifies it.
12. If this segment is thin or overlaps with nearby text, return fewer items instead of filler.

RETURN ONLY THIS JSON FORMAT (no markdown, no extra text):
{
  "flashcards": [
    {"question": "Specific question about a key concept from the source", "answer": "Comprehensive answer (2-4 sentences) with concrete details"}
  ],
  "mcqs": [
    {"question": "Question testing understanding from the source text", "options": ["Correct answer", "Plausible distractor 1", "Plausible distractor 2", "Plausible distractor 3"], "correctIndex": 0, "explanation": "Why the correct option is right based on the source"}
  ],
  "fillBlanks": [
    {"sentence": "A complete sentence from the source with _____ for a key term", "answer": "key term", "explanation": "Why this term matters in context"}
  ],
  "shortAnswers": [
    {"question": "Open-ended analytical question grounded in the source", "suggestedAnswer": "Detailed model answer (3-5 sentences) with key points"}
  ]
}

DO NOT EXCEED THESE TARGET COUNTS:
- ${targets.flashcards} high-quality flashcards
- ${targets.mcqs} MCQs with 4 plausible options each
- ${targets.fillBlanks} fill-in-the-blanks for key terminology
- ${targets.shortAnswers} short answer questions requiring deeper thinking

OUTPUT: Valid JSON only. No markdown code blocks. No extra text.`;
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
        model: currentConfig.model || 'gemini-2.0-flash' 
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

  const model = currentConfig.model || 'gemini-2.0-flash';
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
          .map((s: { question: string; suggestedAnswer?: string; answer?: string; modelAnswer?: string }) => ({
            question: s.question,
            suggestedAnswer: s.suggestedAnswer || s.answer || s.modelAnswer || ''
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

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pickKeyPhrase(words: string[]): string {
  return words.slice(0, Math.min(4, words.length)).join(' ');
}

function buildFallbackQuestion(sentence: string, words: string[]): string {
  const normalizedSentence = sentence.replace(/\s+/g, ' ').trim();
  const definitionMatch = normalizedSentence.match(/^([^.!?]{3,80}?)\s+(is|are|refers to|means)\s+/i);

  if (definitionMatch && definitionMatch[1].split(/\s+/).length <= 8) {
    return `What is ${definitionMatch[1].trim()}?`;
  }

  if (/ because /i.test(normalizedSentence)) {
    return `Why is ${pickKeyPhrase(words)} important?`;
  }

  if (/(steps?|process|procedure|method|workflow)/i.test(normalizedSentence)) {
    return `How does ${pickKeyPhrase(words)} work?`;
  }

  return `Explain ${pickKeyPhrase(words)} in context.`;
}

function generateFallbackContent(text: string, targets: GenerationTargets): GeneratedContent {
  console.log('[AIAdapter] Generating fallback content locally');
  
  const sentences = extractSentences(text);
  const optionPool = Array.from(
    new Set(
      sentences
        .flatMap((sentence) => extractImportantWords(sentence))
        .map((word) => word.trim())
        .filter((word) => word.length > 3)
    )
  );
  const flashcards: GeneratedContent['flashcards'] = [];
  const mcqs: GeneratedContent['mcqs'] = [];
  const fillBlanks: GeneratedContent['fillBlanks'] = [];
  const shortAnswers: GeneratedContent['shortAnswers'] = [];
  
  for (let i = 0; i < sentences.length && flashcards.length < targets.flashcards; i++) {
    const sentence = sentences[i];
    const words = extractImportantWords(sentence);
    
    if (words.length > 0) {
      flashcards.push({
        question: buildFallbackQuestion(sentence, words),
        answer: sentence
      });
    }
  }
  
  for (let i = 0; i < sentences.length && fillBlanks.length < targets.fillBlanks; i++) {
    const sentence = sentences[i];
    const words = extractImportantWords(sentence);
    
    if (words.length > 0) {
      const wordToRemove = [...words].sort((a, b) => b.length - a.length)[0];
      const blanked = sentence.replace(new RegExp(`\\b${escapeRegex(wordToRemove)}\\b`, 'i'), '_____');
      
      if (blanked !== sentence) {
        fillBlanks.push({
          sentence: blanked,
          answer: wordToRemove,
          explanation: `This term is central to the idea expressed in the original sentence: ${sentence}`
        });
      }
    }
  }
  
  for (let i = 0; i < sentences.length && mcqs.length < targets.mcqs; i++) {
    const sentence = sentences[i];
    const words = extractImportantWords(sentence);
    
    if (words.length >= 2) {
      const correctWord = words[0];
      const wrongOptions = optionPool
        .filter((word) => normalizeText(word) !== normalizeText(correctWord))
        .slice(0, 3);
      while (wrongOptions.length < 3) wrongOptions.push(`Option ${wrongOptions.length + 1}`);
      
      const options = [correctWord, ...wrongOptions];
      for (let j = options.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [options[j], options[k]] = [options[k], options[j]];
      }
      
      mcqs.push({
        question: `Which term best completes this statement from the source?`,
        options,
        correctIndex: options.indexOf(correctWord),
        explanation: sentence
      });
    }
  }
  
  for (let i = 0; i < sentences.length && shortAnswers.length < targets.shortAnswers; i++) {
    const sentence = sentences[i];
    const words = extractImportantWords(sentence);
    if (words.length > 0) {
      shortAnswers.push({
        question: `How would you explain ${pickKeyPhrase(words)} based on this material?`,
        suggestedAnswer: sentence
      });
    }
  }
  
  return trimGeneratedContent({ flashcards, mcqs, fillBlanks, shortAnswers }, targets);
}

// ============================================================================
// Main Processing Function
// ============================================================================

export async function processChunk(
  text: string,
  chunkIndex: number,
  totalChunks: number,
  onProgress?: (text: string) => void,
  options: ProcessChunkOptions = {}
): Promise<GeneratedContent> {
  console.log(`[AIAdapter] Processing chunk ${chunkIndex + 1}/${totalChunks} with ${currentConfig.provider}`);
  
  if (text.trim().length < 50) {
    console.log('[AIAdapter] Text too short, returning empty result');
    return { flashcards: [], mcqs: [], fillBlanks: [], shortAnswers: [] };
  }

  const targets = getGenerationTargets(text, totalChunks);
  const prompt = getStudyMaterialsPrompt(text, chunkIndex, totalChunks, targets);

  if (!options.skipAvailabilityCheck) {
    const isAvailable = await checkProviderStatus();
    if (!isAvailable) {
      throw new Error(`${currentConfig.provider} is not available. Check connection or API key.`);
    }
  }

  try {
    const response = await callAI(prompt, onProgress);
    const parsed = trimGeneratedContent(parseAIResponse(response), targets);
    
    const totalItems = parsed.flashcards.length + parsed.mcqs.length + 
                       parsed.fillBlanks.length + parsed.shortAnswers.length;
    
    if (totalItems > 0) {
      console.log(`[AIAdapter] Successfully generated ${totalItems} items`);
      return parsed;
    }
    
    console.log('[AIAdapter] No items parsed, using fallback');
    return generateFallbackContent(text, targets);
    
  } catch (error) {
    console.error('[AIAdapter] Error:', error);
    console.log('[AIAdapter] Falling back to local content generator');
    return generateFallbackContent(text, targets);
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
