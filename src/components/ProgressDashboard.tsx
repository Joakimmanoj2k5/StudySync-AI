import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Flame, Clock, Target, TrendingUp, BookOpen, Calendar, Star } from 'lucide-react';
import { Card } from '@/components/ui';
import { getProgress, getRecentSessions, getTodayStats, formatTime, type UserProgress, type StudySession } from '@/utils/progress';
import { getFavorites, type StarredItem } from '@/utils/favorites';

export function ProgressDashboard() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [recentSessions, setRecentSessions] = useState<StudySession[]>([]);
  const [todayStats, setTodayStats] = useState({ cardsStudied: 0, quizzesTaken: 0, correctRate: 0 });
  const [favorites, setFavorites] = useState<StarredItem[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'history' | 'favorites'>('stats');
  
  useEffect(() => {
    setProgress(getProgress());
    setRecentSessions(getRecentSessions(20));
    setTodayStats(getTodayStats());
    setFavorites(getFavorites());
  }, []);
  
  if (!progress) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-pulse">Loading progress...</div>
      </Card>
    );
  }
  
  const tabs = [
    { id: 'stats', label: 'Statistics', icon: TrendingUp },
    { id: 'history', label: 'History', icon: Calendar },
    { id: 'favorites', label: 'Starred', icon: Star },
  ] as const;
  
  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{progress.currentStreak}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <BookOpen className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{progress.totalCardsStudied}</p>
                <p className="text-xs text-muted-foreground">Cards Studied</p>
              </div>
            </div>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Target className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{progress.totalQuizzesTaken}</p>
                <p className="text-xs text-muted-foreground">Quizzes Taken</p>
              </div>
            </div>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatTime(progress.totalTimeSpent)}</p>
                <p className="text-xs text-muted-foreground">Total Time</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
      
      {/* Today's Progress */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Today's Progress
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-4 rounded-lg bg-secondary">
            <p className="text-3xl font-bold text-primary">{todayStats.cardsStudied}</p>
            <p className="text-sm text-muted-foreground">Cards</p>
          </div>
          <div className="p-4 rounded-lg bg-secondary">
            <p className="text-3xl font-bold text-accent">{todayStats.quizzesTaken}</p>
            <p className="text-sm text-muted-foreground">Quizzes</p>
          </div>
          <div className="p-4 rounded-lg bg-secondary">
            <p className="text-3xl font-bold text-success">{todayStats.correctRate}%</p>
            <p className="text-sm text-muted-foreground">Accuracy</p>
          </div>
        </div>
      </Card>
      
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.id === 'favorites' && favorites.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                {favorites.length}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      {activeTab === 'stats' && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Lifetime Statistics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Longest Streak</span>
              <span className="font-semibold">{progress.longestStreak} days</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Total Correct Answers</span>
              <span className="font-semibold">{progress.totalCorrectAnswers}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Overall Accuracy</span>
              <span className="font-semibold">
                {progress.totalCardsStudied > 0 
                  ? Math.round((progress.totalCorrectAnswers / progress.totalCardsStudied) * 100) 
                  : 0}%
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Study Sessions</span>
              <span className="font-semibold">{progress.sessions.length}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Last Study Date</span>
              <span className="font-semibold">
                {progress.lastStudyDate || 'Never'}
              </span>
            </div>
          </div>
        </Card>
      )}
      
      {activeTab === 'history' && (
        <div className="space-y-3">
          {recentSessions.length === 0 ? (
            <Card className="p-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No study sessions yet</p>
              <p className="text-sm text-muted-foreground">Start studying to see your history!</p>
            </Card>
          ) : (
            recentSessions.map(session => (
              <Card key={session.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      session.type === 'flashcards' ? 'bg-blue-500/10' : 
                      session.type === 'quiz' ? 'bg-green-500/10' : 'bg-purple-500/10'
                    }`}>
                      {session.type === 'flashcards' ? (
                        <BookOpen className={`h-4 w-4 text-blue-500`} />
                      ) : (
                        <Target className={`h-4 w-4 ${session.type === 'quiz' ? 'text-green-500' : 'text-purple-500'}`} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{session.bankName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.date).toLocaleDateString()} • {formatTime(session.timeSpent)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-success">
                      {session.correctAnswers}/{session.totalQuestions}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round((session.correctAnswers / session.totalQuestions) * 100)}%
                    </p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
      
      {activeTab === 'favorites' && (
        <div className="space-y-3">
          {favorites.length === 0 ? (
            <Card className="p-8 text-center">
              <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No starred questions yet</p>
              <p className="text-sm text-muted-foreground">Star questions during study to review them later!</p>
            </Card>
          ) : (
            favorites.map(item => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                        item.type === 'flashcard' ? 'bg-blue-500/10 text-blue-500' :
                        item.type === 'mcq' ? 'bg-green-500/10 text-green-500' :
                        'bg-purple-500/10 text-purple-500'
                      }`}>
                        {item.type}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {item.bankName}
                      </span>
                    </div>
                    <p className="font-medium text-sm mb-1">{item.question}</p>
                    <p className="text-sm text-success">Answer: {item.answer}</p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
