/**
 * Favorites/Starred Questions System for LearnAI
 * Allows users to star questions for later review
 */

export interface StarredItem {
  id: string;
  bankId: string;
  bankName: string;
  type: 'flashcard' | 'mcq' | 'fillblank' | 'exam';
  question: string;
  answer: string;
  options?: string[];
  dateAdded: string;
}

const FAVORITES_KEY = 'learnai_favorites';

export function getFavorites(): StarredItem[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load favorites:', e);
  }
  return [];
}

export function saveFavorites(favorites: StarredItem[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (e) {
    console.error('Failed to save favorites:', e);
  }
}

export function addToFavorites(item: Omit<StarredItem, 'id' | 'dateAdded'>): StarredItem[] {
  const favorites = getFavorites();
  
  // Check if already exists (by question text)
  const exists = favorites.some(f => f.question === item.question && f.bankId === item.bankId);
  if (exists) {
    return favorites;
  }
  
  const newItem: StarredItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    dateAdded: new Date().toISOString()
  };
  
  const updated = [newItem, ...favorites];
  saveFavorites(updated);
  return updated;
}

export function removeFromFavorites(question: string, bankId: string): StarredItem[] {
  const favorites = getFavorites();
  const updated = favorites.filter(f => !(f.question === question && f.bankId === bankId));
  saveFavorites(updated);
  return updated;
}

export function isFavorite(question: string, bankId: string): boolean {
  const favorites = getFavorites();
  return favorites.some(f => f.question === question && f.bankId === bankId);
}

export function toggleFavorite(item: Omit<StarredItem, 'id' | 'dateAdded'>): { favorites: StarredItem[]; isNowFavorite: boolean } {
  if (isFavorite(item.question, item.bankId)) {
    return {
      favorites: removeFromFavorites(item.question, item.bankId),
      isNowFavorite: false
    };
  } else {
    return {
      favorites: addToFavorites(item),
      isNowFavorite: true
    };
  }
}

export function getFavoritesByBank(bankId: string): StarredItem[] {
  return getFavorites().filter(f => f.bankId === bankId);
}

export function getFavoritesByType(type: StarredItem['type']): StarredItem[] {
  return getFavorites().filter(f => f.type === type);
}
