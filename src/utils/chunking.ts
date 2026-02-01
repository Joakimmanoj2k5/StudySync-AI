/**
 * Text Chunking Utility for StudySync AI
 * Splits large text into manageable chunks with overlap for context preservation
 */

export interface ChunkOptions {
  chunkSize: number;      // Target words per chunk (default: 1500)
  overlapSize: number;    // Words to overlap between chunks (default: 200)
}

export interface TextChunk {
  index: number;
  text: string;
  wordCount: number;
  startWord: number;
  endWord: number;
}

const DEFAULT_OPTIONS: ChunkOptions = {
  chunkSize: 800,      // Reduced for more thorough processing per chunk
  overlapSize: 100,    // Smaller overlap
};

/**
 * Splits text into words while preserving sentence boundaries where possible
 */
function tokenizeText(text: string): string[] {
  // Clean the text - remove excessive whitespace, normalize line breaks
  const cleanedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  
  // Split into words
  return cleanedText.split(/\s+/).filter(word => word.length > 0);
}

/**
 * Finds the best split point near the target index
 * Prefers splitting at sentence endings (., !, ?)
 */
function findBestSplitPoint(words: string[], targetIndex: number, searchRange: number = 50): number {
  const minIndex = Math.max(0, targetIndex - searchRange);
  const maxIndex = Math.min(words.length - 1, targetIndex + searchRange);
  
  // Look for sentence endings near the target
  for (let i = targetIndex; i <= maxIndex; i++) {
    const word = words[i];
    if (word && /[.!?]$/.test(word)) {
      return i + 1;
    }
  }
  
  // Look backwards if no sentence ending found ahead
  for (let i = targetIndex - 1; i >= minIndex; i--) {
    const word = words[i];
    if (word && /[.!?]$/.test(word)) {
      return i + 1;
    }
  }
  
  // Fall back to target index
  return targetIndex;
}

/**
 * Main chunking function - splits text into overlapping chunks
 * @param text - The full text to chunk
 * @param options - Chunking configuration
 * @returns Array of text chunks with metadata
 */
export function chunkText(text: string, options: Partial<ChunkOptions> = {}): TextChunk[] {
  const { chunkSize, overlapSize } = { ...DEFAULT_OPTIONS, ...options };
  
  const words = tokenizeText(text);
  const totalWords = words.length;
  
  if (totalWords === 0) {
    return [];
  }
  
  // If text is smaller than chunk size, return as single chunk
  if (totalWords <= chunkSize) {
    return [{
      index: 0,
      text: words.join(' '),
      wordCount: totalWords,
      startWord: 0,
      endWord: totalWords - 1,
    }];
  }
  
  const chunks: TextChunk[] = [];
  let currentStart = 0;
  let chunkIndex = 0;
  
  while (currentStart < totalWords) {
    // Calculate the ideal end position
    let idealEnd = currentStart + chunkSize;
    
    // If this would be the last chunk, just take everything remaining
    if (idealEnd >= totalWords) {
      const chunkWords = words.slice(currentStart);
      chunks.push({
        index: chunkIndex,
        text: chunkWords.join(' '),
        wordCount: chunkWords.length,
        startWord: currentStart,
        endWord: totalWords - 1,
      });
      break;
    }
    
    // Find the best split point near the ideal end
    const actualEnd = findBestSplitPoint(words, idealEnd);
    
    // Extract the chunk
    const chunkWords = words.slice(currentStart, actualEnd);
    chunks.push({
      index: chunkIndex,
      text: chunkWords.join(' '),
      wordCount: chunkWords.length,
      startWord: currentStart,
      endWord: actualEnd - 1,
    });
    
    // Move to next chunk with overlap
    currentStart = actualEnd - overlapSize;
    
    // Ensure we're always making progress
    if (currentStart <= chunks[chunks.length - 1].startWord) {
      currentStart = actualEnd;
    }
    
    chunkIndex++;
  }
  
  return chunks;
}

/**
 * Estimates the number of chunks that will be generated
 */
export function estimateChunkCount(text: string, options: Partial<ChunkOptions> = {}): number {
  const { chunkSize, overlapSize } = { ...DEFAULT_OPTIONS, ...options };
  const words = tokenizeText(text);
  const totalWords = words.length;
  
  if (totalWords <= chunkSize) {
    return 1;
  }
  
  const effectiveChunkSize = chunkSize - overlapSize;
  return Math.ceil((totalWords - overlapSize) / effectiveChunkSize);
}

/**
 * Gets the total word count of a text
 */
export function getWordCount(text: string): number {
  return tokenizeText(text).length;
}

/**
 * Creates a summary of chunk statistics
 */
export function getChunkingStats(chunks: TextChunk[]) {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      totalWords: 0,
      avgWordsPerChunk: 0,
      minWordsInChunk: 0,
      maxWordsInChunk: 0,
    };
  }
  
  const wordCounts = chunks.map(c => c.wordCount);
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);
  
  return {
    totalChunks: chunks.length,
    totalWords,
    avgWordsPerChunk: Math.round(totalWords / chunks.length),
    minWordsInChunk: Math.min(...wordCounts),
    maxWordsInChunk: Math.max(...wordCounts),
  };
}
