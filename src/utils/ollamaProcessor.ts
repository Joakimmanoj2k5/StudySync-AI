/**
 * Ollama Local AI Processor for StudySync
 * Connects to locally running Ollama with llama3.2 model
 */

import type { Flashcard, MCQ, FillInBlank, ShortAnswer } from '../types';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'llama3.2';

// Custom instructions from user
let customInstructions = '';

export function setCustomInstructions(instructions: string): void {
  customInstructions = instructions;
  localStorage.setItem('studysync_custom_instructions', instructions);
}

export function getCustomInstructions(): string {
  if (!customInstructions) {
    customInstructions = localStorage.getItem('studysync_custom_instructions') || '';
  }
  return customInstructions;
}

// System prompt for syllabus auto-filler
const SYLLABUS_SYSTEM_PROMPT = `You are a Senior Academic Researcher. I will provide a syllabus topic or study material. If I do not provide detailed notes, research your internal knowledge to generate a comprehensive detailed study guide including:
1. Key Definitions - Define all important terms
2. Core Theories - Explain the fundamental concepts and theories
3. A Practical Example - Provide real-world applications
Format the output as clear, well-structured text.`;

// Prompt template for generating study materials
function getStudyMaterialsPrompt(text: string): string {
  const userInstructions = getCustomInstructions();
  const additionalContext = userInstructions ? `\n\nAdditional Instructions: ${userInstructions}` : '';
  
  return `${SYLLABUS_SYSTEM_PROMPT}${additionalContext}

Based on the following content, generate comprehensive study materials in JSON format.

CONTENT:
${text}

Generate the following in valid JSON format (no markdown, just raw JSON):
{
  "flashcards": [
    {"question": "Clear question about key concept", "answer": "Detailed answer with explanation"}
  ],
  "mcqs": [
    {
      "question": "Question testing understanding",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct"
    }
  ],
  "fillBlanks": [
    {"sentence": "A sentence with _____ for important term", "answer": "missing word"}
  ],
  "shortAnswers": [
    {"question": "Thought-provoking question", "suggestedAnswer": "Model answer"}
  ]
}

Generate at least:
- 5 flashcards covering key concepts
- 3 MCQs with explanations
- 3 fill-in-the-blanks for important terms
- 2 short answer questions

Return ONLY valid JSON, no other text.`;
}

interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

interface GeneratedContent {
  flashcards: Omit<Flashcard, 'id' | 'chunkIndex'>[];
  mcqs: Omit<MCQ, 'id' | 'chunkIndex'>[];
  fillBlanks: Omit<FillInBlank, 'id' | 'chunkIndex'>[];
  shortAnswers: Omit<ShortAnswer, 'id' | 'chunkIndex'>[];
}

// Stream handler for Ollama responses
async function streamOllamaResponse(
  prompt: string,
  onProgress?: (text: string) => void
): Promise<string> {
  console.log('[Ollama] Starting stream request...');
  
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: prompt,
      stream: true,
      format: 'json',
      options: {
        temperature: 0.7,
        num_predict: 4096,
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('No response body from Ollama');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('[Ollama] Stream complete');
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const parsed: OllamaResponse = JSON.parse(line);
          fullResponse += parsed.response;
          
          if (onProgress) {
            onProgress(fullResponse);
          }
          
          if (parsed.done) {
            console.log('[Ollama] Response marked as done');
          }
        } catch (e) {
          // Skip malformed JSON chunks
          console.warn('[Ollama] Skipping malformed chunk:', line);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullResponse;
}

// Non-streaming fallback
async function callOllamaAPI(prompt: string): Promise<string> {
  console.log('[Ollama] Making non-streaming request...');
  
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: prompt,
      stream: false,
      format: 'json',
      options: {
        temperature: 0.7,
        num_predict: 4096,
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.response;
}

// Parse the JSON response from Ollama
function parseOllamaResponse(response: string): GeneratedContent {
  const result: GeneratedContent = {
    flashcards: [],
    mcqs: [],
    fillBlanks: [],
    shortAnswers: []
  };

  try {
    // Try to extract JSON from the response
    let jsonStr = response.trim();
    
    // Remove markdown code blocks if present
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Find JSON object
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
          .map((f: { sentence: string; answer: string }) => ({
            sentence: f.sentence,
            answer: f.answer
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
      
      console.log('[Ollama] Parsed results:', {
        flashcards: result.flashcards.length,
        mcqs: result.mcqs.length,
        fillBlanks: result.fillBlanks.length,
        shortAnswers: result.shortAnswers.length
      });
    }
  } catch (e) {
    console.error('[Ollama] Error parsing response:', e);
    console.log('[Ollama] Raw response:', response.substring(0, 500));
  }

  return result;
}

// Split text into chunks of approximately N words
export function splitIntoChunks(text: string, maxWords: number = 1000): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += maxWords) {
    const chunk = words.slice(i, i + maxWords).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
  }
  
  console.log(`[Ollama] Split text into ${chunks.length} chunks of ~${maxWords} words each`);
  return chunks;
}

// Check if Ollama is running
export async function checkOllamaStatus(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Main processing function
export async function processChunk(
  text: string,
  chunkIndex: number,
  totalChunks: number,
  onProgress?: (text: string) => void
): Promise<GeneratedContent> {
  console.log(`[Ollama] Processing chunk ${chunkIndex + 1}/${totalChunks}`);
  
  // Check if text is too short
  if (text.trim().length < 50) {
    console.log('[Ollama] Text too short, returning empty result');
    return {
      flashcards: [],
      mcqs: [],
      fillBlanks: [],
      shortAnswers: []
    };
  }

  const prompt = getStudyMaterialsPrompt(text);

  try {
    // Check if Ollama is running
    const isRunning = await checkOllamaStatus();
    if (!isRunning) {
      throw new Error('Ollama is not running. Please start Ollama with: ollama serve');
    }

    // Use streaming for real-time updates
    let response: string;
    if (onProgress) {
      response = await streamOllamaResponse(prompt, onProgress);
    } else {
      response = await callOllamaAPI(prompt);
    }
    
    const parsed = parseOllamaResponse(response);
    
    // Check if we got any results
    const totalItems = parsed.flashcards.length + parsed.mcqs.length + 
                       parsed.fillBlanks.length + parsed.shortAnswers.length;
    
    if (totalItems > 0) {
      console.log(`[Ollama] Successfully generated ${totalItems} items`);
      return parsed;
    }
    
    console.log('[Ollama] No items parsed, using fallback generator');
    return generateFallbackContent(text);
    
  } catch (error) {
    console.error('[Ollama] Error:', error);
    
    // Provide helpful error message
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('[Ollama] Connection failed. Make sure Ollama is running with: ollama serve');
      console.error('[Ollama] Also ensure OLLAMA_ORIGINS is set to allow browser connections');
    }
    
    console.log('[Ollama] Falling back to local content generator');
    return generateFallbackContent(text);
  }
}

// ============================================================================
// FALLBACK LOCAL GENERATOR (when Ollama is unavailable)
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
  
  if (sentences.length === 0) {
    return cleaned
      .split(/[.\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
  }
  
  return sentences;
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
  console.log('[Fallback] Generating content locally');
  
  const sentences = extractSentences(text);
  const flashcards: GeneratedContent['flashcards'] = [];
  const mcqs: GeneratedContent['mcqs'] = [];
  const fillBlanks: GeneratedContent['fillBlanks'] = [];
  const shortAnswers: GeneratedContent['shortAnswers'] = [];
  
  // Generate flashcards from sentences
  for (let i = 0; i < Math.min(sentences.length, 10); i++) {
    const sentence = sentences[i];
    const words = extractImportantWords(sentence);
    
    if (words.length > 0) {
      flashcards.push({
        question: `Explain: ${words.slice(0, 3).join(', ')}`,
        answer: sentence
      });
    }
  }
  
  // Generate fill-in-blanks
  for (let i = 0; i < Math.min(sentences.length, 5); i++) {
    const sentence = sentences[i];
    const words = extractImportantWords(sentence);
    
    if (words.length > 0) {
      const wordToRemove = words[Math.floor(Math.random() * Math.min(3, words.length))];
      const blanked = sentence.replace(new RegExp(`\\b${wordToRemove}\\b`, 'i'), '_____');
      
      if (blanked !== sentence) {
        fillBlanks.push({
          sentence: blanked,
          answer: wordToRemove
        });
      }
    }
  }
  
  // Generate short answers
  for (let i = 0; i < Math.min(sentences.length, 3); i++) {
    const sentence = sentences[i];
    shortAnswers.push({
      question: `Summarize and explain: ${sentence.substring(0, 80)}...`,
      suggestedAnswer: sentence
    });
  }
  
  console.log('[Fallback] Generated:', {
    flashcards: flashcards.length,
    mcqs: mcqs.length,
    fillBlanks: fillBlanks.length,
    shortAnswers: shortAnswers.length
  });
  
  return { flashcards, mcqs, fillBlanks, shortAnswers };
}

// Export for backwards compatibility
export { checkOllamaStatus as checkConnection };
