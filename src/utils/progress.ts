/**
 * Progress Tracking System for LearnAI
 * Tracks study sessions, scores, and streaks
 */

export interface StudySession {
  id: string;
  bankId: string;
  bankName: string;
  date: string;
  type: 'flashcards' | 'quiz' | 'exam';
  cardsStudied: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpent: number; // in seconds
}

export interface UserProgress {
  totalCardsStudied: number;
  totalQuizzesTaken: number;
  totalCorrectAnswers: number;
  totalTimeSpent: number;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string | null;
  sessions: StudySession[];
}

const PROGRESS_KEY = 'learnai_progress';

const DEFAULT_PROGRESS: UserProgress = {
  totalCardsStudied: 0,
  totalQuizzesTaken: 0,
  totalCorrectAnswers: 0,
  totalTimeSpent: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastStudyDate: null,
  sessions: []
};

export function getProgress(): UserProgress {
  try {
    const stored = localStorage.getItem(PROGRESS_KEY);
    if (stored) {
      return { ...DEFAULT_PROGRESS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load progress:', e);
  }
  return DEFAULT_PROGRESS;
}

export function saveProgress(progress: UserProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('Failed to save progress:', e);
  }
}

export function updateStreak(progress: UserProgress): UserProgress {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  
  if (progress.lastStudyDate === today) {
    // Already studied today, no change
    return progress;
  } else if (progress.lastStudyDate === yesterday) {
    // Studied yesterday, increment streak
    const newStreak = progress.currentStreak + 1;
    return {
      ...progress,
      currentStreak: newStreak,
      longestStreak: Math.max(progress.longestStreak, newStreak),
      lastStudyDate: today
    };
  } else {
    // Streak broken or first time
    return {
      ...progress,
      currentStreak: 1,
      longestStreak: Math.max(progress.longestStreak, 1),
      lastStudyDate: today
    };
  }
}

export function recordStudySession(
  bankId: string,
  bankName: string,
  type: 'flashcards' | 'quiz' | 'exam',
  cardsStudied: number,
  correctAnswers: number,
  totalQuestions: number,
  timeSpent: number
): UserProgress {
  let progress = getProgress();
  
  // Update streak
  progress = updateStreak(progress);
  
  // Create session record
  const session: StudySession = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    bankId,
    bankName,
    date: new Date().toISOString(),
    type,
    cardsStudied,
    correctAnswers,
    totalQuestions,
    timeSpent
  };
  
  // Update totals
  progress.totalCardsStudied += cardsStudied;
  progress.totalCorrectAnswers += correctAnswers;
  progress.totalTimeSpent += timeSpent;
  
  if (type === 'quiz' || type === 'exam') {
    progress.totalQuizzesTaken += 1;
  }
  
  // Add session (keep last 100)
  progress.sessions = [session, ...progress.sessions].slice(0, 100);
  
  saveProgress(progress);
  return progress;
}

export function getRecentSessions(limit: number = 10): StudySession[] {
  const progress = getProgress();
  return progress.sessions.slice(0, limit);
}

export function getTodayStats(): { cardsStudied: number; quizzesTaken: number; correctRate: number } {
  const progress = getProgress();
  const today = new Date().toDateString();
  
  const todaySessions = progress.sessions.filter(
    s => new Date(s.date).toDateString() === today
  );
  
  const cardsStudied = todaySessions.reduce((sum, s) => sum + s.cardsStudied, 0);
  const quizzesTaken = todaySessions.filter(s => s.type === 'quiz' || s.type === 'exam').length;
  const totalCorrect = todaySessions.reduce((sum, s) => sum + s.correctAnswers, 0);
  const totalQuestions = todaySessions.reduce((sum, s) => sum + s.totalQuestions, 0);
  
  return {
    cardsStudied,
    quizzesTaken,
    correctRate: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0
  };
}

export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
