import type { Flashcard, MCQ, FillInBlank, ShortAnswer } from '../types';

const GEMINI_API_KEY = 'AIzaSyCJTsUyUOdwF1w-XxRuexRDHk52Xfk381g';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-2.0-flash';

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

function generateSystemPrompt(): string {
  const basePrompt = 'You are an expert educational content creator. Generate comprehensive study materials including flashcards, MCQs, fill-in-blanks, and short answer questions. Extract ALL key concepts and create varied difficulty levels.';
  
  const userInstructions = getCustomInstructions();
  if (userInstructions.trim()) {
    return basePrompt + ' Additional instructions: ' + userInstructions;
  }
  return basePrompt;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message: string;
  };
}

interface GeneratedContent {
  flashcards: Omit<Flashcard, 'id' | 'chunkIndex'>[];
  mcqs: Omit<MCQ, 'id' | 'chunkIndex'>[];
  fillBlanks: Omit<FillInBlank, 'id' | 'chunkIndex'>[];
  shortAnswers: Omit<ShortAnswer, 'id' | 'chunkIndex'>[];
}

async function callGeminiAPI(prompt: string): Promise<string> {
  const url = GEMINI_BASE_URL + '/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      }
    }),
  });

  const data: GeminiResponse = await response.json();
  
  if (data.error) {
    throw new Error('Gemini API Error: ' + data.error.message);
  }
  
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No response from Gemini API');
  }
  
  return text;
}

interface ParsedFlashcard {
  question?: string;
  answer?: string;
}

interface ParsedMCQ {
  question?: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
}

interface ParsedFillBlank {
  sentence?: string;
  answer?: string;
}

interface ParsedShortAnswer {
  question?: string;
  suggestedAnswer?: string;
}

function parseGeminiResponse(response: string): GeneratedContent {
  const result: GeneratedContent = {
    flashcards: [],
    mcqs: [],
    fillBlanks: [],
    shortAnswers: []
  };

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (Array.isArray(parsed.flashcards)) {
        result.flashcards = parsed.flashcards
          .map((f: ParsedFlashcard) => ({
            question: f.question || '',
            answer: f.answer || ''
          }))
          .filter((f: {question: string; answer: string}) => f.question && f.answer);
      }
      
      if (Array.isArray(parsed.mcqs)) {
        result.mcqs = parsed.mcqs
          .map((m: ParsedMCQ) => ({
            question: m.question || '',
            options: m.options || [],
            correctIndex: m.correctIndex ?? 0,
            explanation: m.explanation || ''
          }))
          .filter((m: {question: string; options: string[]}) => m.question && m.options.length >= 2);
      }
      
      if (Array.isArray(parsed.fillBlanks)) {
        result.fillBlanks = parsed.fillBlanks
          .map((f: ParsedFillBlank) => ({
            sentence: f.sentence || '',
            answer: f.answer || ''
          }))
          .filter((f: {sentence: string; answer: string}) => f.sentence && f.answer);
      }
      
      if (Array.isArray(parsed.shortAnswers)) {
        result.shortAnswers = parsed.shortAnswers
          .map((s: ParsedShortAnswer) => ({
            question: s.question || '',
            suggestedAnswer: s.suggestedAnswer || ''
          }))
          .filter((s: {question: string}) => s.question);
      }
    }
  } catch (e) {
    console.error('Error parsing Gemini response:', e);
  }

  return result;
}

function extractSentences(text: string): string[] {
  // More lenient sentence extraction
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Split on sentence endings
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 600);
  
  // If no good sentences found, split by newlines or periods
  if (sentences.length === 0) {
    return cleaned
      .split(/[.\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
  }
  
  return sentences;
}

function extractKeyTerms(text: string): Array<{term: string; context: string}> {
  const results: Array<{term: string; context: string}> = [];
  
  // Pattern: "X is Y" or "X are Y" (case insensitive)
  const isPatterns = text.match(/([A-Za-z][a-zA-Z\s]{1,40})\s+(is|are|was|were)\s+([^.!?]{5,200})/gi);
  if (isPatterns) {
    for (const match of isPatterns) {
      const parts = match.match(/([A-Za-z][a-zA-Z\s]{1,40})\s+(is|are|was|were)\s+(.+)/i);
      if (parts) {
        results.push({ term: parts[1].trim(), context: parts[3].trim() });
      }
    }
  }
  
  // Pattern: "X refers to Y" or "X means Y"
  const refersPatterns = text.match(/([A-Za-z][a-zA-Z\s]{1,40})\s+(refers?\s+to|means|denotes|represents)\s+([^.!?]{5,200})/gi);
  if (refersPatterns) {
    for (const match of refersPatterns) {
      const parts = match.match(/([A-Za-z][a-zA-Z\s]{1,40})\s+(?:refers?\s+to|means|denotes|represents)\s+(.+)/i);
      if (parts) {
        results.push({ term: parts[1].trim(), context: parts[2].trim() });
      }
    }
  }
  
  // Pattern: "The X" at start of sentence followed by description
  const thePatterns = text.match(/(?:^|[.!?]\s+)The\s+([A-Za-z][a-zA-Z\s]{1,30})\s+([^.!?]{10,200})/gi);
  if (thePatterns) {
    for (const match of thePatterns) {
      const parts = match.match(/The\s+([A-Za-z][a-zA-Z\s]{1,30})\s+(.+)/i);
      if (parts) {
        results.push({ term: parts[1].trim(), context: parts[2].trim() });
      }
    }
  }
  
  return results;
}

function extractFacts(text: string): string[] {
  const facts: string[] = [];
  const sentences = extractSentences(text);
  
  for (const sentence of sentences) {
    if (
      /\d+/.test(sentence) ||
      /percent|%/i.test(sentence) ||
      /discovered|invented|founded|created|developed/i.test(sentence) ||
      /consists? of|composed? of/i.test(sentence) ||
      /important|significant|crucial|essential/i.test(sentence) ||
      /causes?|results? in|leads? to/i.test(sentence) ||
      /first|largest|smallest|most|least/i.test(sentence)
    ) {
      facts.push(sentence);
    }
  }
  
  return [...new Set(facts)].slice(0, 50);
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
  
  const words = sentence
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word.toLowerCase()));
  
  // Return longer words or capitalized words first
  return words.filter(word => /^[A-Z]/.test(word) || word.length > 4);
}

function generateLocalFlashcards(text: string): Omit<Flashcard, 'id' | 'chunkIndex'>[] {
  const flashcards: Omit<Flashcard, 'id' | 'chunkIndex'>[] = [];
  const keyTerms = extractKeyTerms(text);
  const sentences = extractSentences(text);
  
  console.log('[LocalGen] Sentences found:', sentences.length);
  console.log('[LocalGen] Key terms found:', keyTerms.length);
  
  // From key terms (definitions)
  for (let i = 0; i < keyTerms.length && flashcards.length < 30; i++) {
    const { term, context } = keyTerms[i];
    flashcards.push({
      question: 'What is ' + term + '?',
      answer: term + ' ' + context
    });
  }
  
  // From facts
  const facts = extractFacts(text);
  console.log('[LocalGen] Facts found:', facts.length);
  
  for (let i = 0; i < facts.length && flashcards.length < 50; i++) {
    const fact = facts[i];
    const importantWords = extractImportantWords(fact);
    
    if (importantWords.length > 0) {
      const keyWord = importantWords[0];
      flashcards.push({
        question: 'What do you know about ' + keyWord + '?',
        answer: fact
      });
    }
  }
  
  // From general sentences - more lenient
  for (let i = 0; i < sentences.length && flashcards.length < 60; i++) {
    const sentence = sentences[i];
    if (sentence.length > 20) {
      const words = extractImportantWords(sentence);
      if (words.length >= 1) {
        flashcards.push({
          question: 'Explain: ' + words.slice(0, 3).join(', '),
          answer: sentence
        });
      } else {
        // Fallback: just use the first few words as the question
        const firstWords = sentence.split(/\s+/).slice(0, 4).join(' ');
        flashcards.push({
          question: 'Complete this: ' + firstWords + '...',
          answer: sentence
        });
      }
    }
  }
  
  // GUARANTEED FALLBACK: If still no flashcards, create from raw text
  if (flashcards.length === 0 && text.length > 50) {
    console.log('[LocalGen] Using guaranteed fallback');
    const chunks = text.match(/.{50,200}[.!?\s]|.{50,200}$/g) || [text.substring(0, 200)];
    for (let i = 0; i < Math.min(chunks.length, 10); i++) {
      const chunk = chunks[i].trim();
      if (chunk.length > 20) {
        flashcards.push({
          question: 'Review this content (#' + (i + 1) + ')',
          answer: chunk
        });
      }
    }
  }
  
  console.log('[LocalGen] Total flashcards generated:', flashcards.length);
  return flashcards;
}

function generateLocalMCQs(text: string): Omit<MCQ, 'id' | 'chunkIndex'>[] {
  const mcqs: Omit<MCQ, 'id' | 'chunkIndex'>[] = [];
  const facts = extractFacts(text);
  const keyTerms = extractKeyTerms(text);
  
  for (let i = 0; i < keyTerms.length - 3 && mcqs.length < 20; i++) {
    const correct = keyTerms[i];
    const distractors = keyTerms
      .filter((_, idx) => idx !== i)
      .slice(0, 3)
      .map(k => k.context.substring(0, 100));
    
    if (distractors.length >= 3) {
      const correctOption = correct.context.substring(0, 100);
      const options = [correctOption, ...distractors];
      
      for (let j = options.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [options[j], options[k]] = [options[k], options[j]];
      }
      
      mcqs.push({
        question: 'What is ' + correct.term + '?',
        options: options,
        correctIndex: options.indexOf(correctOption),
        explanation: correct.term + ' is ' + correct.context
      });
    }
  }
  
  for (const fact of facts) {
    if (mcqs.length >= 30) break;
    
    const numberMatch = fact.match(/(\d+(?:\.\d+)?)\s*(%|percent|years?|days?)?/i);
    if (numberMatch) {
      const correctNum = parseFloat(numberMatch[1]);
      const unit = numberMatch[2] || '';
      
      const wrongNums = [
        Math.round(correctNum * 0.5),
        Math.round(correctNum * 1.5),
        Math.round(correctNum * 2)
      ].filter(n => n !== correctNum && n > 0);
      
      if (wrongNums.length >= 3) {
        const correctOption = String(correctNum) + (unit ? ' ' + unit : '');
        const options = [
          correctOption,
          String(wrongNums[0]) + (unit ? ' ' + unit : ''),
          String(wrongNums[1]) + (unit ? ' ' + unit : ''),
          String(wrongNums[2]) + (unit ? ' ' + unit : '')
        ];
        
        for (let j = options.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [options[j], options[k]] = [options[k], options[j]];
        }
        
        const question = fact.replace(numberMatch[0], '_____');
        
        mcqs.push({
          question: 'Fill in the blank: ' + question,
          options: options,
          correctIndex: options.indexOf(correctOption),
          explanation: fact
        });
      }
    }
  }
  
  return mcqs;
}

function generateLocalFillBlanks(text: string): Omit<FillInBlank, 'id' | 'chunkIndex'>[] {
  const fillBlanks: Omit<FillInBlank, 'id' | 'chunkIndex'>[] = [];
  const sentences = extractSentences(text);
  
  for (const sentence of sentences) {
    if (fillBlanks.length >= 30) break;
    
    const importantWords = extractImportantWords(sentence);
    if (importantWords.length > 0) {
      const wordToRemove = importantWords[Math.floor(Math.random() * Math.min(3, importantWords.length))];
      const regex = new RegExp('\\b' + wordToRemove + '\\b', 'i');
      const blankedSentence = sentence.replace(regex, '_____');
      
      if (blankedSentence !== sentence) {
        fillBlanks.push({
          sentence: blankedSentence,
          answer: wordToRemove
        });
      }
    }
  }
  
  // Fallback: create fill-blanks from any word > 5 chars
  if (fillBlanks.length === 0) {
    for (const sentence of sentences.slice(0, 15)) {
      const words = sentence.split(/\s+/).filter(w => w.length > 5);
      if (words.length > 0) {
        const wordToRemove = words[0];
        const blanked = sentence.replace(wordToRemove, '_____');
        if (blanked !== sentence) {
          fillBlanks.push({
            sentence: blanked,
            answer: wordToRemove
          });
        }
      }
    }
  }
  
  console.log('[LocalGen] Fill blanks generated:', fillBlanks.length);
  return fillBlanks;
}

function generateLocalShortAnswers(text: string): Omit<ShortAnswer, 'id' | 'chunkIndex'>[] {
  const questions: Omit<ShortAnswer, 'id' | 'chunkIndex'>[] = [];
  const keyTerms = extractKeyTerms(text);
  const facts = extractFacts(text);
  const sentences = extractSentences(text);
  
  for (const { term, context } of keyTerms) {
    if (questions.length >= 10) break;
    
    questions.push({
      question: 'Explain what ' + term + ' is and why it is important.',
      suggestedAnswer: term + ' ' + context
    });
  }
  
  for (const fact of facts) {
    if (questions.length >= 15) break;
    
    if (/causes?|results? in|leads? to|because/i.test(fact)) {
      questions.push({
        question: 'Explain the cause and effect relationship: ' + fact.substring(0, 100),
        suggestedAnswer: fact
      });
    }
  }
  
  const importantSentences = facts.slice(0, 5);
  for (const sentence of importantSentences) {
    if (questions.length >= 20) break;
    
    questions.push({
      question: 'Discuss: ' + sentence.substring(0, 150),
      suggestedAnswer: sentence
    });
  }
  
  // Fallback: create questions from any sentence
  if (questions.length === 0) {
    for (let i = 0; i < Math.min(sentences.length, 10); i++) {
      const sentence = sentences[i];
      questions.push({
        question: 'Summarize and explain: ' + sentence.substring(0, 80) + '...',
        suggestedAnswer: sentence
      });
    }
  }
  
  console.log('[LocalGen] Short answers generated:', questions.length);
  return questions;
}

function generateLocalContent(text: string): GeneratedContent {
  console.log('=== Using local content generator ===');
  console.log('Text length:', text.length);
  console.log('First 200 chars:', text.substring(0, 200));
  
  const result = {
    flashcards: generateLocalFlashcards(text),
    mcqs: generateLocalMCQs(text),
    fillBlanks: generateLocalFillBlanks(text),
    shortAnswers: generateLocalShortAnswers(text)
  };
  
  console.log('=== Local generation complete ===');
  console.log('Results:', {
    flashcards: result.flashcards.length,
    mcqs: result.mcqs.length,
    fillBlanks: result.fillBlanks.length,
    shortAnswers: result.shortAnswers.length
  });
  
  return result;
}

export async function processChunk(
  text: string,
  _chunkIndex: number,
  _totalChunks: number
): Promise<GeneratedContent> {
  if (text.trim().length < 100) {
    console.log('Text too short, using local generator');
    return generateLocalContent(text);
  }

  const prompt = generateSystemPrompt() + '\n\nCONTENT:\n' + text + '\n\nReturn JSON:\n{"flashcards":[{"question":"","answer":""}],"mcqs":[{"question":"","options":["A","B","C","D"],"correctIndex":0,"explanation":""}],"fillBlanks":[{"sentence":"_____","answer":""}],"shortAnswers":[{"question":"","suggestedAnswer":""}]}';

  try {
    console.log('Calling Gemini API...');
    const response = await callGeminiAPI(prompt);
    const parsed = parseGeminiResponse(response);
    
    const totalItems = parsed.flashcards.length + parsed.mcqs.length + 
                       parsed.fillBlanks.length + parsed.shortAnswers.length;
    
    if (totalItems > 0) {
      console.log('Gemini API returned ' + totalItems + ' items');
      return parsed;
    }
    
    console.log('Gemini response parsing yielded no items, using local generator');
    return generateLocalContent(text);
    
  } catch (error) {
    console.error('Gemini API error:', error);
    console.log('Falling back to local content generator');
    return generateLocalContent(text);
  }
}
