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

// System prompt for intelligent study material generation
const SYLLABUS_SYSTEM_PROMPT = `You are an expert university professor and educational content creator with 20+ years of experience. Your job is to help students truly UNDERSTAND and MASTER topics, not just memorize facts.

CRITICAL RULES:
1. If the content is just a TOPIC NAME or SHORT PHRASE (like "Photosynthesis" or "World War 2"), you MUST use your knowledge to create comprehensive study materials about that topic
2. Research and include REAL facts, dates, names, formulas, processes, and detailed explanations
3. Questions should test UNDERSTANDING, not just recall
4. All answers must be EDUCATIONAL and DETAILED (minimum 2-3 sentences)
5. MCQ wrong options must be PLAUSIBLE (not obviously wrong)
6. Every question should teach something valuable

QUESTION TYPES TO GENERATE:

FLASHCARDS - Create these types:
- "What is X?" → Full definition with context
- "Explain the process of X" → Step-by-step breakdown
- "What are the key characteristics of X?" → List with explanations
- "Compare X and Y" → Detailed comparison
- "What is the significance/importance of X?" → Why it matters
- "What causes X?" / "What are the effects of X?" → Cause-effect relationships

MCQs - Test different cognitive levels:
- Knowledge: "Which of the following is true about X?"
- Comprehension: "What does X primarily demonstrate?"
- Application: "In which scenario would X be most applicable?"
- Analysis: "What is the main difference between X and Y?"
- Evaluation: "Which factor is MOST important in X?"

FILL-IN-BLANKS - Focus on:
- Key terminology and definitions
- Important names, dates, numbers
- Formulas and equations
- Cause-effect relationships

SHORT ANSWER - Ask for:
- Explanations of processes
- Analysis of relationships
- Evaluation of significance
- Real-world applications`;

// Prompt template for generating study materials
function getStudyMaterialsPrompt(text: string): string {
  const userInstructions = getCustomInstructions();
  const additionalContext = userInstructions ? `\n\nUSER'S SPECIAL INSTRUCTIONS: ${userInstructions}` : '';
  
  return `${SYLLABUS_SYSTEM_PROMPT}${additionalContext}

TOPIC/CONTENT TO STUDY:
"""
${text}
"""

INSTRUCTIONS:
1. If the above is just a topic name, USE YOUR KNOWLEDGE to create comprehensive study materials
2. Cover ALL aspects: definitions, processes, history, applications, examples, formulas (if applicable)
3. Make questions that would appear in actual exams
4. Ensure answers are COMPLETE and EDUCATIONAL

Generate study materials as a JSON object:
{
  "flashcards": [
    {"question": "What is [concept]?", "answer": "Detailed 2-3 sentence answer with examples..."},
    {"question": "Explain the process of [X]", "answer": "Step 1: ... Step 2: ... Step 3: ..."},
    {"question": "Why is [X] important?", "answer": "Explanation of significance..."}
  ],
  "mcqs": [
    {
      "question": "Clear question testing understanding?",
      "options": ["Correct answer (detailed)", "Plausible wrong option 1", "Plausible wrong option 2", "Plausible wrong option 3"],
      "correctIndex": 0,
      "explanation": "The answer is A because... This is important because..."
    }
  ],
  "fillBlanks": [
    {"sentence": "The process of _____ converts sunlight into chemical energy in plants.", "answer": "photosynthesis", "explanation": "Photosynthesis is the process by which plants use sunlight, water, and CO2 to produce glucose and oxygen."}
  ],
  "shortAnswers": [
    {"question": "Explain in detail how [process] works and give a real-world example.", "suggestedAnswer": "Comprehensive 3-4 sentence model answer..."}
  ]
}

GENERATE EXACTLY:
- 20 high-quality flashcards (covering definitions, processes, comparisons, significance)
- 10 challenging MCQs (with plausible distractors and detailed explanations)
- 10 fill-in-the-blanks (for key terms, names, numbers, formulas - include explanation for each)
- 6 short answer questions (requiring deeper analysis)

OUTPUT: Return ONLY valid JSON. No markdown, no explanations, just the JSON object.`;
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
        num_predict: 8192,  // Increased for more content
        num_ctx: 4096,      // Context window
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
        } catch {
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
        num_predict: 8192,  // Increased for more content
        num_ctx: 4096,
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
  console.log('[Fallback] Generating content locally - comprehensive mode');
  
  const sentences = extractSentences(text);
  const flashcards: GeneratedContent['flashcards'] = [];
  const mcqs: GeneratedContent['mcqs'] = [];
  const fillBlanks: GeneratedContent['fillBlanks'] = [];
  const shortAnswers: GeneratedContent['shortAnswers'] = [];
  
  // Generate MORE flashcards from sentences
  for (let i = 0; i < sentences.length && flashcards.length < 25; i++) {
    const sentence = sentences[i];
    const words = extractImportantWords(sentence);
    
    if (words.length > 0) {
      // Create multiple types of flashcards per sentence
      flashcards.push({
        question: `What do you know about: ${words.slice(0, 2).join(', ')}?`,
        answer: sentence
      });
      
      if (words.length >= 2 && flashcards.length < 25) {
        flashcards.push({
          question: `Define or explain: ${words[0]}`,
          answer: sentence
        });
      }
    }
  }
  
  // Generate MORE fill-in-blanks
  for (let i = 0; i < sentences.length && fillBlanks.length < 15; i++) {
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
  
  // Generate MCQs from sentences with important words
  for (let i = 0; i < sentences.length && mcqs.length < 10; i++) {
    const sentence = sentences[i];
    const words = extractImportantWords(sentence);
    
    if (words.length >= 4) {
      const correctWord = words[0];
      const wrongOptions = words.slice(1, 4);
      
      while (wrongOptions.length < 3) {
        wrongOptions.push(`Option ${wrongOptions.length + 1}`);
      }
      
      const options = [correctWord, ...wrongOptions];
      // Shuffle options
      for (let j = options.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [options[j], options[k]] = [options[k], options[j]];
      }
      
      mcqs.push({
        question: `Which term is most relevant to: "${sentence.substring(0, 60)}..."?`,
        options: options,
        correctIndex: options.indexOf(correctWord),
        explanation: sentence
      });
    }
  }
  
  // Generate MORE short answers
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
