/**
 * Enhanced Storage System for StudySync AI
 * Features:
 * - IndexedDB for large data with localStorage fallback
 * - Incremental auto-save during processing
 * - Unique IDs based on filename + timestamp
 * - Crash recovery (partial data preservation)
 */

import type { StudyBank } from '../types';

const STORAGE_KEY = 'studysync_study_banks';
const DB_NAME = 'StudySyncDB';
const DB_VERSION = 1;
const STORE_NAME = 'studyBanks';

// ============================================
// IndexedDB Implementation
// ============================================

let dbInstance: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store for study banks
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('fileName', 'fileName', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

async function saveToIndexedDB(banks: StudyBank[]): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Clear existing and add all banks
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });
    
    for (const bank of banks) {
      store.put(bank);
    }
    
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn('IndexedDB save failed, falling back to localStorage:', error);
    saveToLocalStorage(banks);
  }
}

async function loadFromIndexedDB(): Promise<StudyBank[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('IndexedDB load failed, falling back to localStorage:', error);
    return loadFromLocalStorage();
  }
}

async function saveSingleBankToIndexedDB(bank: StudyBank): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.put(bank);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('IndexedDB single save failed:', error);
    // For single bank updates, we need to update the full localStorage
    const banks = loadFromLocalStorage();
    const index = banks.findIndex(b => b.id === bank.id);
    if (index >= 0) {
      banks[index] = bank;
    } else {
      banks.push(bank);
    }
    saveToLocalStorage(banks);
  }
}

async function deleteBankFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('IndexedDB delete failed:', error);
  }
}

// ============================================
// LocalStorage Fallback Implementation
// ============================================

function saveToLocalStorage(banks: StudyBank[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(banks));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    // If localStorage is full, try to save without raw text
    try {
      const minimalBanks = banks.map(bank => ({
        ...bank,
        rawText: undefined,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalBanks));
    } catch {
      console.error('Failed to save minimal data to localStorage');
    }
  }
}

function loadFromLocalStorage(): StudyBank[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
  }
  return [];
}

// ============================================
// Public API - Main Functions
// ============================================

/**
 * Save all study banks (uses IndexedDB with localStorage fallback)
 */
export async function saveStudyBanks(banks: StudyBank[]): Promise<void> {
  // Save to both for redundancy
  await saveToIndexedDB(banks);
  saveToLocalStorage(banks);
}

/**
 * Load all study banks (tries IndexedDB first, then localStorage)
 */
export async function loadStudyBanks(): Promise<StudyBank[]> {
  try {
    // Try IndexedDB first
    const idbBanks = await loadFromIndexedDB();
    if (idbBanks.length > 0) {
      return idbBanks;
    }
    
    // Fall back to localStorage
    const localBanks = loadFromLocalStorage();
    
    // If we found data in localStorage but not IndexedDB, migrate it
    if (localBanks.length > 0) {
      await saveToIndexedDB(localBanks);
    }
    
    return localBanks;
  } catch {
    return loadFromLocalStorage();
  }
}

/**
 * Synchronously load study banks (for initial state)
 * Uses localStorage for immediate access
 */
export function loadStudyBanksSync(): StudyBank[] {
  return loadFromLocalStorage();
}

/**
 * Save a single study bank incrementally (for auto-save during processing)
 */
export async function saveStudyBankIncremental(bank: StudyBank): Promise<void> {
  await saveSingleBankToIndexedDB(bank);
  
  // Also update localStorage for redundancy
  const banks = loadFromLocalStorage();
  const index = banks.findIndex(b => b.id === bank.id);
  if (index >= 0) {
    banks[index] = bank;
  } else {
    banks.push(bank);
  }
  saveToLocalStorage(banks);
}

/**
 * Delete a study bank
 */
export async function deleteStudyBank(id: string): Promise<void> {
  await deleteBankFromIndexedDB(id);
  
  const banks = loadFromLocalStorage();
  const filtered = banks.filter(b => b.id !== id);
  saveToLocalStorage(filtered);
}

/**
 * Update a study bank
 */
export async function updateStudyBank(bank: StudyBank): Promise<void> {
  await saveStudyBankIncremental(bank);
}

/**
 * Generate unique ID based on filename and timestamp
 */
export function generateId(fileName?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  
  if (fileName) {
    // Create a slug from filename
    const slug = fileName
      .toLowerCase()
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dash
      .replace(/^-+|-+$/g, '') // Trim dashes
      .substring(0, 20); // Limit length
    
    return `${slug}-${timestamp}-${random}`;
  }
  
  return `${timestamp}-${random}`;
}

/**
 * Check if there's existing data in storage
 */
export function hasExistingData(): boolean {
  const data = loadFromLocalStorage();
  return data.length > 0;
}

/**
 * Get storage statistics
 */
export function getStorageStats(): { 
  bankCount: number; 
  totalFlashcards: number; 
  totalMcqs: number;
  totalFillBlanks: number;
  totalShortAnswers: number;
  estimatedSize: string;
} {
  const banks = loadFromLocalStorage();
  
  let totalFlashcards = 0;
  let totalMcqs = 0;
  let totalFillBlanks = 0;
  let totalShortAnswers = 0;
  
  banks.forEach(bank => {
    totalFlashcards += bank.flashcards.length;
    totalMcqs += bank.mcqs.length;
    totalFillBlanks += bank.fillBlanks.length;
    totalShortAnswers += bank.shortAnswers.length;
  });
  
  // Estimate storage size
  const dataStr = localStorage.getItem(STORAGE_KEY) || '';
  const sizeInBytes = new Blob([dataStr]).size;
  const sizeInKB = sizeInBytes / 1024;
  const estimatedSize = sizeInKB > 1024 
    ? `${(sizeInKB / 1024).toFixed(2)} MB` 
    : `${sizeInKB.toFixed(2)} KB`;
  
  return {
    bankCount: banks.length,
    totalFlashcards,
    totalMcqs,
    totalFillBlanks,
    totalShortAnswers,
    estimatedSize,
  };
}

/**
 * Export all data as JSON (for backup)
 */
export function exportAllData(): string {
  const banks = loadFromLocalStorage();
  return JSON.stringify(banks, null, 2);
}

/**
 * Import data from JSON (for restore)
 */
export async function importData(jsonString: string): Promise<StudyBank[]> {
  const banks = JSON.parse(jsonString) as StudyBank[];
  await saveStudyBanks(banks);
  return banks;
}

/**
 * Clear all stored data
 */
export async function clearAllData(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
  } catch (error) {
    console.warn('Failed to clear IndexedDB:', error);
  }
}
