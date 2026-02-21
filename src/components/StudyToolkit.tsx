import { useEffect, useMemo, useState } from 'react';
import { Timer, Target, NotebookPen, Play, Pause, RotateCcw } from 'lucide-react';
import { Card, Button, Progress } from '@/components/ui';
import { getTodayStats } from '@/utils/progress';

const STORAGE_KEYS = {
  minutes: 'learnai_focus_minutes',
  sessions: 'learnai_focus_sessions',
  goal: 'learnai_daily_goal',
  notes: 'learnai_quick_notes',
} as const;

function loadNumber(key: string, fallback: number): number {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function StudyToolkit() {
  const [focusMinutes, setFocusMinutes] = useState(() => loadNumber(STORAGE_KEYS.minutes, 25));
  const [secondsLeft, setSecondsLeft] = useState(() => loadNumber(STORAGE_KEYS.minutes, 25) * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(() => loadNumber(STORAGE_KEYS.sessions, 0));
  const [dailyGoal, setDailyGoal] = useState(() => loadNumber(STORAGE_KEYS.goal, 20));
  const [quickNotes, setQuickNotes] = useState(() => localStorage.getItem(STORAGE_KEYS.notes) || '');

  const todayStats = getTodayStats();
  const progressValue = Math.min(100, Math.round((todayStats.cardsStudied / dailyGoal) * 100));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.minutes, String(focusMinutes));
  }, [focusMinutes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sessions, String(sessionsCompleted));
  }, [sessionsCompleted]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.goal, String(dailyGoal));
  }, [dailyGoal]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.notes, quickNotes);
  }, [quickNotes]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setIsRunning(false);
          setSessionsCompleted((count) => count + 1);
          return focusMinutes * 60;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning, focusMinutes]);

  const formattedTime = useMemo(() => {
    const mins = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
    const secs = (secondsLeft % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }, [secondsLeft]);

  const resetTimer = () => {
    setIsRunning(false);
    setSecondsLeft(focusMinutes * 60);
  };

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Timer className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Study Toolkit</h3>
          <p className="text-xs text-muted-foreground">Focus timer + daily goals + quick notes</p>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-secondary/40 p-3">
        <p className="mb-2 text-xs text-muted-foreground">Focus session</p>
        <p className="text-3xl font-semibold tracking-tight">{formattedTime}</p>
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={() => setIsRunning((state) => !state)} className="h-8 px-3">
            {isRunning ? <Pause className="mr-1 h-3.5 w-3.5" /> : <Play className="mr-1 h-3.5 w-3.5" />}
            {isRunning ? 'Pause' : 'Start'}
          </Button>
          <Button variant="outline" size="sm" onClick={resetTimer} className="h-8 px-3">
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Reset
          </Button>
          <select
            value={focusMinutes}
            onChange={(e) => {
              const next = Number(e.target.value);
              setFocusMinutes(next);
              setSecondsLeft(next * 60);
              setIsRunning(false);
            }}
            className="ml-auto rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            <option value={15}>15m</option>
            <option value={25}>25m</option>
            <option value={40}>40m</option>
          </select>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Completed sessions: {sessionsCompleted}</p>
      </div>

      <div className="rounded-xl border border-border/70 bg-secondary/40 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <p className="text-xs text-muted-foreground">Daily cards goal</p>
        </div>
        <div className="mb-2 flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={dailyGoal}
            onChange={(e) => setDailyGoal(Math.max(1, Number(e.target.value) || 1))}
            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          <span className="text-xs text-muted-foreground">{todayStats.cardsStudied} studied today</span>
        </div>
        <Progress value={progressValue} className="h-2" />
      </div>

      <div className="rounded-xl border border-border/70 bg-secondary/40 p-3">
        <div className="mb-2 flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-primary" />
          <p className="text-xs text-muted-foreground">Quick notes</p>
        </div>
        <textarea
          value={quickNotes}
          onChange={(e) => setQuickNotes(e.target.value)}
          rows={4}
          placeholder="Write key formulas, weak areas, and what to revise next..."
          className="w-full resize-none rounded-md border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </Card>
  );
}
