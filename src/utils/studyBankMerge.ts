import type { ChunkResult, FillInBlank, Flashcard, MCQ, ShortAnswer, StudyBank } from '../types';

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

function toFlashcards(
  existing: Flashcard[],
  incoming: ChunkResult['flashcards'],
  chunkIndex: number,
  createId: () => string
): Flashcard[] {
  const existingKeys = new Set(existing.map((item) => normalizeText(item.question)));

  return uniqueBySignature(incoming, (item) => normalizeText(item.question))
    .filter((item) => item.question.trim().length > 10 && item.answer.trim().length > 10)
    .filter((item) => !existingKeys.has(normalizeText(item.question)))
    .map((item) => ({
      ...item,
      id: createId(),
      chunkIndex,
    }));
}

function toMcqs(
  existing: MCQ[],
  incoming: ChunkResult['mcqs'],
  chunkIndex: number,
  createId: () => string
): MCQ[] {
  const existingKeys = new Set(existing.map((item) => normalizeText(item.question)));

  return uniqueBySignature(incoming, (item) => normalizeText(item.question))
    .filter((item) => item.question.trim().length > 10 && item.options.length >= 2)
    .filter((item) => !existingKeys.has(normalizeText(item.question)))
    .map((item) => ({
      ...item,
      id: createId(),
      chunkIndex,
    }));
}

function toFillBlanks(
  existing: FillInBlank[],
  incoming: ChunkResult['fillBlanks'],
  chunkIndex: number,
  createId: () => string
): FillInBlank[] {
  const existingKeys = new Set(existing.map((item) => normalizeText(item.sentence)));

  return uniqueBySignature(incoming, (item) => normalizeText(item.sentence))
    .filter((item) => item.sentence.trim().length > 10 && item.answer.trim().length > 1)
    .filter((item) => !existingKeys.has(normalizeText(item.sentence)))
    .map((item) => ({
      ...item,
      id: createId(),
      chunkIndex,
    }));
}

function toShortAnswers(
  existing: ShortAnswer[],
  incoming: ChunkResult['shortAnswers'],
  chunkIndex: number,
  createId: () => string
): ShortAnswer[] {
  const existingKeys = new Set(existing.map((item) => normalizeText(item.question)));

  return uniqueBySignature(incoming, (item) => normalizeText(item.question))
    .filter((item) => item.question.trim().length > 10 && item.suggestedAnswer.trim().length > 10)
    .filter((item) => !existingKeys.has(normalizeText(item.question)))
    .map((item) => ({
      ...item,
      id: createId(),
      chunkIndex,
    }));
}

export function appendChunkResultsToBank(
  bank: StudyBank,
  chunkIndex: number,
  results: ChunkResult,
  createId: () => string
): StudyBank {
  const newFlashcards = toFlashcards(bank.flashcards, results.flashcards, chunkIndex, createId);
  const newMcqs = toMcqs(bank.mcqs, results.mcqs, chunkIndex, createId);
  const newFillBlanks = toFillBlanks(bank.fillBlanks, results.fillBlanks, chunkIndex, createId);
  const newShortAnswers = toShortAnswers(bank.shortAnswers, results.shortAnswers, chunkIndex, createId);

  return {
    ...bank,
    flashcards: [...bank.flashcards, ...newFlashcards],
    mcqs: [...bank.mcqs, ...newMcqs],
    fillBlanks: [...bank.fillBlanks, ...newFillBlanks],
    shortAnswers: [...bank.shortAnswers, ...newShortAnswers],
    processedChunks: Math.max(bank.processedChunks, chunkIndex + 1),
  };
}
