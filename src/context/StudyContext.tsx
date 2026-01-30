import React, { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import type { StudyBank, ProcessingStatus, Flashcard, MCQ, FillInBlank, ShortAnswer, ChunkResult } from '../types';
import { 
  loadStudyBanks, 
  loadStudyBanksSync, 
  saveStudyBanks, 
  saveStudyBankIncremental, 
  deleteStudyBank as deleteFromStorage,
  generateId 
} from '../utils/storage';

interface StudyState {
  studyBanks: StudyBank[];
  activeBank: StudyBank | null;
  processingStatus: ProcessingStatus;
  isHydrated: boolean; // Track if initial data has been loaded
}

type StudyAction =
  | { type: 'LOAD_BANKS'; payload: StudyBank[] }
  | { type: 'ADD_BANK'; payload: StudyBank }
  | { type: 'UPDATE_BANK'; payload: StudyBank }
  | { type: 'DELETE_BANK'; payload: string }
  | { type: 'SET_ACTIVE_BANK'; payload: StudyBank | null }
  | { type: 'SET_PROCESSING_STATUS'; payload: ProcessingStatus }
  | { type: 'APPEND_CHUNK_RESULTS'; payload: { bankId: string; chunkIndex: number; results: ChunkResult } }
  | { type: 'FINISH_PROCESSING'; payload: string }
  | { type: 'SET_HYDRATED' };

// Load initial state synchronously for immediate display
const loadInitialState = (): StudyState => {
  const banks = loadStudyBanksSync();
  // Reset any stuck processing states
  const cleanedBanks = banks.map(bank => ({
    ...bank,
    isProcessing: false, // Reset processing flag on load
  }));
  return {
    studyBanks: cleanedBanks,
    activeBank: cleanedBanks.length > 0 ? cleanedBanks[0] : null, // Auto-select first bank
    processingStatus: {
      isProcessing: false,
      currentChunk: 0,
      totalChunks: 0,
      message: '',
    },
    isHydrated: banks.length > 0, // Already hydrated if we have local data
  };
};

const initialState: StudyState = loadInitialState();

function studyReducer(state: StudyState, action: StudyAction): StudyState {
  switch (action.type) {
    case 'LOAD_BANKS':
      return { 
        ...state, 
        studyBanks: action.payload, 
        isHydrated: true,
        // Auto-select first bank if no active bank
        activeBank: state.activeBank || (action.payload.length > 0 ? action.payload[0] : null),
      };
    
    case 'SET_HYDRATED':
      return { ...state, isHydrated: true };
    
    case 'ADD_BANK':
      return { 
        ...state, 
        studyBanks: [...state.studyBanks, action.payload],
        activeBank: action.payload, // Auto-select the newly created bank
      };
    
    case 'UPDATE_BANK': {
      const updatedBanks = state.studyBanks.map(bank =>
        bank.id === action.payload.id ? action.payload : bank
      );
      return {
        ...state,
        studyBanks: updatedBanks,
        activeBank: state.activeBank?.id === action.payload.id ? action.payload : state.activeBank,
      };
    }
    
    case 'DELETE_BANK': {
      const filteredBanks = state.studyBanks.filter(bank => bank.id !== action.payload);
      return {
        ...state,
        studyBanks: filteredBanks,
        activeBank: state.activeBank?.id === action.payload ? null : state.activeBank,
      };
    }
    
    case 'SET_ACTIVE_BANK':
      return { ...state, activeBank: action.payload };
    
    case 'SET_PROCESSING_STATUS':
      return { ...state, processingStatus: action.payload };
    
    case 'APPEND_CHUNK_RESULTS': {
      const { bankId, chunkIndex, results } = action.payload;
      const bankIndex = state.studyBanks.findIndex(b => b.id === bankId);
      
      if (bankIndex === -1) return state;
      
      const bank = state.studyBanks[bankIndex];
      
      // Add IDs and chunk index to results
      const newFlashcards: Flashcard[] = results.flashcards.map((f) => ({
        ...f,
        id: generateId(),
        chunkIndex,
      }));
      
      const newMcqs: MCQ[] = results.mcqs.map((m) => ({
        ...m,
        id: generateId(),
        chunkIndex,
      }));
      
      const newFillBlanks: FillInBlank[] = results.fillBlanks.map((f) => ({
        ...f,
        id: generateId(),
        chunkIndex,
      }));
      
      const newShortAnswers: ShortAnswer[] = results.shortAnswers.map((s) => ({
        ...s,
        id: generateId(),
        chunkIndex,
      }));
      
      const updatedBank: StudyBank = {
        ...bank,
        flashcards: [...bank.flashcards, ...newFlashcards],
        mcqs: [...bank.mcqs, ...newMcqs],
        fillBlanks: [...bank.fillBlanks, ...newFillBlanks],
        shortAnswers: [...bank.shortAnswers, ...newShortAnswers],
        processedChunks: chunkIndex + 1,
      };
      
      const newBanks = [...state.studyBanks];
      newBanks[bankIndex] = updatedBank;
      
      return {
        ...state,
        studyBanks: newBanks,
        activeBank: state.activeBank?.id === bankId ? updatedBank : state.activeBank,
      };
    }
    
    case 'FINISH_PROCESSING': {
      const bankId = action.payload;
      const bankIndex = state.studyBanks.findIndex(b => b.id === bankId);
      
      if (bankIndex === -1) {
        return {
          ...state,
          processingStatus: { isProcessing: false, currentChunk: 0, totalChunks: 0, message: '' },
        };
      }
      
      const bank = state.studyBanks[bankIndex];
      const updatedBank = { ...bank, isProcessing: false };
      const newBanks = [...state.studyBanks];
      newBanks[bankIndex] = updatedBank;
      
      return {
        ...state,
        studyBanks: newBanks,
        activeBank: state.activeBank?.id === bankId ? updatedBank : state.activeBank,
        processingStatus: { isProcessing: false, currentChunk: 0, totalChunks: 0, message: '' },
      };
    }
    
    default:
      return state;
  }
}

interface StudyContextType extends StudyState {
  dispatch: React.Dispatch<StudyAction>;
  createStudyBank: (fileName: string, totalChunks: number) => StudyBank;
  appendChunkResults: (bankId: string, chunkIndex: number, results: ChunkResult) => void;
  setProcessingStatus: (status: ProcessingStatus) => void;
  finishProcessing: (bankId: string) => void;
  deleteBank: (bankId: string) => Promise<void>;
}

const StudyContext = createContext<StudyContextType | undefined>(undefined);

export function StudyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(studyReducer, initialState);
  
  // Load banks from IndexedDB on mount (async, for any data not in localStorage)
  useEffect(() => {
    const loadAsync = async () => {
      try {
        const banks = await loadStudyBanks();
        // Reset any stuck processing states
        const cleanedBanks = banks.map(bank => ({
          ...bank,
          isProcessing: false,
        }));
        // Only update if we got more data from IndexedDB than localStorage
        if (banks.length > state.studyBanks.length) {
          dispatch({ type: 'LOAD_BANKS', payload: cleanedBanks });
        } else {
          dispatch({ type: 'SET_HYDRATED' });
        }
      } catch (error) {
        console.error('Failed to load from IndexedDB:', error);
        dispatch({ type: 'SET_HYDRATED' });
      }
    };
    
    loadAsync();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Auto-save banks to storage whenever they change (debounced)
  useEffect(() => {
    if (!state.isHydrated) return; // Don't save until initial load is complete
    
    const saveAsync = async () => {
      try {
        await saveStudyBanks(state.studyBanks);
      } catch (error) {
        console.error('Failed to save study banks:', error);
      }
    };
    
    // Debounce saves to avoid excessive writes during rapid updates
    const timeoutId = setTimeout(saveAsync, 300);
    return () => clearTimeout(timeoutId);
  }, [state.studyBanks, state.isHydrated]);
  
  // Incremental save when a bank is being processed
  useEffect(() => {
    if (!state.processingStatus.isProcessing) return;
    
    // Find the bank being processed and save it incrementally
    const processingBank = state.studyBanks.find(b => b.isProcessing);
    if (processingBank) {
      saveStudyBankIncremental(processingBank).catch(error => {
        console.error('Failed to save incrementally:', error);
      });
    }
  }, [state.studyBanks, state.processingStatus.currentChunk, state.processingStatus.isProcessing]);
  
  const createStudyBank = useCallback((fileName: string, totalChunks: number): StudyBank => {
    const bank: StudyBank = {
      id: generateId(fileName), // Use filename-based ID
      fileName,
      createdAt: new Date().toISOString(),
      totalChunks,
      processedChunks: 0,
      flashcards: [],
      mcqs: [],
      fillBlanks: [],
      shortAnswers: [],
      isProcessing: true,
    };
    
    dispatch({ type: 'ADD_BANK', payload: bank });
    dispatch({ type: 'SET_ACTIVE_BANK', payload: bank });
    
    // Immediately save to storage
    saveStudyBankIncremental(bank).catch(console.error);
    
    return bank;
  }, []);
  
  const appendChunkResults = useCallback((bankId: string, chunkIndex: number, results: ChunkResult) => {
    dispatch({ type: 'APPEND_CHUNK_RESULTS', payload: { bankId, chunkIndex, results } });
  }, []);
  
  const setProcessingStatus = useCallback((status: ProcessingStatus) => {
    dispatch({ type: 'SET_PROCESSING_STATUS', payload: status });
  }, []);
  
  const finishProcessing = useCallback((bankId: string) => {
    dispatch({ type: 'FINISH_PROCESSING', payload: bankId });
  }, []);
  
  const deleteBank = useCallback(async (bankId: string) => {
    dispatch({ type: 'DELETE_BANK', payload: bankId });
    await deleteFromStorage(bankId);
  }, []);
  
  return (
    <StudyContext.Provider
      value={{
        ...state,
        dispatch,
        createStudyBank,
        appendChunkResults,
        setProcessingStatus,
        finishProcessing,
        deleteBank,
      }}
    >
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const context = useContext(StudyContext);
  if (!context) {
    throw new Error('useStudy must be used within a StudyProvider');
  }
  return context;
}
