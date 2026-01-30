// Types for StudySync AI
export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  chunkIndex: number;
}

export interface MCQ {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  chunkIndex: number;
}

export interface FillInBlank {
  id: string;
  sentence: string;
  answer: string;
  chunkIndex: number;
}

export interface ShortAnswer {
  id: string;
  question: string;
  suggestedAnswer: string;
  chunkIndex: number;
}

export interface StudyBank {
  id: string;
  fileName: string;
  createdAt: string;
  totalChunks: number;
  processedChunks: number;
  flashcards: Flashcard[];
  mcqs: MCQ[];
  fillBlanks: FillInBlank[];
  shortAnswers: ShortAnswer[];
  isProcessing: boolean;
  rawText?: string;
}

export interface ProcessingStatus {
  isProcessing: boolean;
  currentChunk: number;
  totalChunks: number;
  message: string;
}

export interface ChunkResult {
  flashcards: Omit<Flashcard, 'id' | 'chunkIndex'>[];
  mcqs: Omit<MCQ, 'id' | 'chunkIndex'>[];
  fillBlanks: Omit<FillInBlank, 'id' | 'chunkIndex'>[];
  shortAnswers: Omit<ShortAnswer, 'id' | 'chunkIndex'>[];
}

export type StudyMode = 'flashcards' | 'quiz' | 'exam';

export interface QuizState {
  currentIndex: number;
  score: number;
  answered: boolean[];
  selectedAnswers: (number | string | null)[];
  showResult: boolean;
}
