import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Brain,
  FileQuestion,
  GraduationCap,
  Sparkles,
  Download,
  TrendingUp,
  Zap,
  Layers3,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent, Card, Progress, Button } from '@/components/ui';
import { FileUpload } from './FileUpload';
import { FlashcardView } from './FlashcardView';
import { QuizView } from './QuizView';
import { ExamView } from './ExamView';
import { StudyBankList } from './StudyBankList';
import { CustomInstructions } from './CustomInstructions';
import { AIProviderStatus } from './AIProviderStatus';
import { ProgressDashboard } from './ProgressDashboard';
import { useStudy } from '@/context/useStudy';
import { exportToPDF } from '@/utils/exportPDF';
import type { StudyBank } from '@/types';

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export function Dashboard() {
  const { activeBank, dispatch, processingStatus } = useStudy();
  const [activeTab, setActiveTab] = useState('flashcards');
  const [showProgress, setShowProgress] = useState(false);

  const handleSelectBank = (bank: StudyBank) => {
    dispatch({ type: 'SET_ACTIVE_BANK', payload: bank });
    setShowProgress(false);
  };

  const handleExportPDF = () => {
    if (activeBank) {
      exportToPDF(activeBank, { showAnswers: true });
    }
  };

  const totalItems = activeBank
    ? activeBank.flashcards.length + activeBank.mcqs.length + activeBank.fillBlanks.length + activeBank.shortAnswers.length
    : 0;

  return (
    <div className="min-h-screen bg-background bg-animated template-grid-bg relative overflow-x-hidden">
      <div className="bg-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <header className="sticky top-0 z-50 glass border-b border-border/60">
        <div className="mx-auto max-w-7xl px-3 sm:px-6">
          <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:py-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-primary to-accent p-2.5 pulse-glow">
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight gradient-text neon-text">LearnAI</h1>
                <p className="text-xs text-muted-foreground">Build smart study packs from your notes</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Button
                variant={showProgress ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setShowProgress(!showProgress)}
                className="btn-shine w-full sm:w-auto"
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                <span className="sm:hidden">Stats</span>
                <span className="hidden sm:inline">Progress</span>
              </Button>
              {activeBank && (
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="btn-shine w-full sm:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  <span className="sm:hidden">Export</span>
                  <span className="hidden sm:inline">Export PDF</span>
                </Button>
              )}
              <div className="col-span-2 sm:col-span-1">
                <AIProviderStatus />
              </div>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {processingStatus.isProcessing && (
          <motion.div
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            className="relative z-40 border-b border-primary/25 bg-primary/10"
          >
            <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <Sparkles className="h-4 w-4 text-primary animate-sparkle" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{processingStatus.message}</p>
                  <Progress
                    value={processingStatus.totalChunks > 0 ? (processingStatus.currentChunk / processingStatus.totalChunks) * 100 : 0}
                    className="mt-2 h-2 progress-glow"
                  />
                </div>
                <span className="text-[11px] text-muted-foreground sm:text-sm">
                  {processingStatus.currentChunk}/{processingStatus.totalChunks}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 mx-auto max-w-7xl px-3 py-5 sm:px-6 lg:py-8">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 rounded-2xl border border-border/70 bg-card/70 p-4 backdrop-blur-md sm:mb-6 sm:p-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Zap className="h-3.5 w-3.5" />
                Study workspace
              </p>
              <h2 className="text-xl font-semibold tracking-tight break-words sm:text-3xl">
                {activeBank ? activeBank.fileName : 'Upload notes and generate a focused study bank'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                {activeBank
                  ? `${totalItems} study items generated across flashcards, quiz, and exam mode.`
                  : 'Drop a chapter PDF or clean notes. Timetable/schedule files are automatically detected and blocked.'}
              </p>
            </div>
            {activeBank && (
              <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:min-w-[320px] sm:grid-cols-3">
                <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-center">
                  <p className="text-xs text-muted-foreground">Flashcards</p>
                  <p className="text-lg font-semibold text-primary">{activeBank.flashcards.length}</p>
                </div>
                <div className="rounded-xl border border-accent/20 bg-accent/10 px-3 py-2 text-center">
                  <p className="text-xs text-muted-foreground">Quiz</p>
                  <p className="text-lg font-semibold text-accent">{activeBank.mcqs.length + activeBank.fillBlanks.length}</p>
                </div>
                <div className="rounded-xl border border-success/20 bg-success/10 px-3 py-2 text-center">
                  <p className="text-xs text-muted-foreground">Exam</p>
                  <p className="text-lg font-semibold text-success">{activeBank.shortAnswers.length}</p>
                </div>
              </div>
            )}
          </div>
        </motion.section>

        <div className="grid gap-6 lg:grid-cols-[330px,1fr]">
          <motion.aside variants={cardVariants} initial="hidden" animate="visible" className="space-y-5 lg:sticky lg:top-24 lg:h-fit">
            <FileUpload />
            <CustomInstructions />
            <StudyBankList onSelect={handleSelectBank} />
          </motion.aside>

          <motion.section variants={cardVariants} initial="hidden" animate="visible" className="space-y-5">
            {showProgress ? (
              <ProgressDashboard />
            ) : activeBank ? (
              <>
                <Card className="p-2.5 sm:p-4">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3 gap-1 bg-secondary/60 p-1">
                      <TabsTrigger value="flashcards" className="gap-1 px-2 py-2 text-[11px] sm:gap-2 sm:px-4 sm:text-sm">
                        <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Flashcards</span>
                        <span className="sm:hidden">Cards</span>
                      </TabsTrigger>
                      <TabsTrigger value="quiz" className="gap-1 px-2 py-2 text-[11px] sm:gap-2 sm:px-4 sm:text-sm">
                        <FileQuestion className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Quiz
                      </TabsTrigger>
                      <TabsTrigger value="exam" className="gap-1 px-2 py-2 text-[11px] sm:gap-2 sm:px-4 sm:text-sm">
                        <GraduationCap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        Exam
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="flashcards" className="mt-4">
                      <FlashcardView flashcards={activeBank.flashcards} bankId={activeBank.id} bankName={activeBank.fileName} />
                    </TabsContent>

                    <TabsContent value="quiz" className="mt-4">
                      <QuizView
                        mcqs={activeBank.mcqs}
                        fillBlanks={activeBank.fillBlanks}
                        bankId={activeBank.id}
                        bankName={activeBank.fileName}
                      />
                    </TabsContent>

                    <TabsContent value="exam" className="mt-4">
                      <ExamView questions={activeBank.shortAnswers} />
                    </TabsContent>
                  </Tabs>
                </Card>
              </>
            ) : (
              <Card className="p-6 sm:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                    <Layers3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Start With A Source File</h3>
                    <p className="text-sm text-muted-foreground">Choose clean notes for best output quality.</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                    <BookOpen className="mb-2 h-5 w-5 text-primary" />
                    <p className="text-sm font-medium">Flashcards</p>
                    <p className="text-xs text-muted-foreground">Rapid memory review</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                    <FileQuestion className="mb-2 h-5 w-5 text-accent" />
                    <p className="text-sm font-medium">Instant Quiz</p>
                    <p className="text-xs text-muted-foreground">MCQ + fill blanks</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                    <GraduationCap className="mb-2 h-5 w-5 text-success" />
                    <p className="text-sm font-medium">Exam Practice</p>
                    <p className="text-xs text-muted-foreground">Long-form answers</p>
                  </div>
                </div>
              </Card>
            )}
          </motion.section>
        </div>
      </main>

      <footer className="relative z-10 mt-10 border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-5 text-center text-sm text-muted-foreground sm:px-6">
          <span className="gradient-text font-semibold">LearnAI</span> | AI Study Workspace
        </div>
      </footer>
    </div>
  );
}
