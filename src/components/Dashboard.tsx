import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Brain, FileQuestion, GraduationCap, Sparkles, Download, TrendingUp, Zap } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent, Card, Progress, Button } from '@/components/ui';
import { FileUpload } from './FileUpload';
import { FlashcardView } from './FlashcardView';
import { QuizView } from './QuizView';
import { ExamView } from './ExamView';
import { StudyBankList } from './StudyBankList';
import { CustomInstructions } from './CustomInstructions';
import { AIProviderStatus } from './AIProviderStatus';
import { ProgressDashboard } from './ProgressDashboard';
import { useStudy } from '@/context/StudyContext';
import { exportToPDF } from '@/utils/exportPDF';
import type { StudyBank } from '@/types';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
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
    <div className="min-h-screen bg-background bg-animated relative overflow-hidden">
      {/* Background Orbs */}
      <div className="bg-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent pulse-glow">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text neon-text">LearnAI</h1>
                <p className="text-xs text-muted-foreground">AI-Powered Study Materials</p>
              </div>
            </motion.div>
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowProgress(!showProgress)}
                className={`btn-shine ${showProgress ? 'text-primary' : ''}`}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Progress
              </Button>
              {activeBank && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  className="btn-shine"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              )}
              <AIProviderStatus />
            </motion.div>
          </div>
        </div>
      </header>
      
      {/* Processing Banner */}
      <AnimatePresence>
      {processingStatus.isProcessing && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="bg-primary/10 border-b border-primary/20 relative z-40"
        >
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-4">
              <Sparkles className="h-5 w-5 text-primary animate-sparkle" />
              <div className="flex-1">
                <p className="text-sm font-medium">{processingStatus.message}</p>
                <Progress 
                  value={processingStatus.totalChunks > 0 
                    ? (processingStatus.currentChunk / processingStatus.totalChunks) * 100 
                    : 0}
                  className="mt-2 h-2 progress-glow"
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {processingStatus.currentChunk} / {processingStatus.totalChunks}
              </span>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative z-10">
        <motion.div 
          className="grid lg:grid-cols-[350px,1fr] gap-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Sidebar */}
          <motion.aside className="space-y-6" variants={itemVariants}>
            <FileUpload />
            <CustomInstructions />
            <StudyBankList onSelect={handleSelectBank} />
          </motion.aside>
          
          {/* Content Area */}
          <motion.div className="space-y-6" variants={itemVariants}>
            {showProgress ? (
              <ProgressDashboard />
            ) : activeBank ? (
              <>
                {/* Bank Header */}
                <Card className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">{activeBank.fileName}</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {totalItems} study items generated
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeBank.isProcessing && (
                        <span className="flex items-center gap-2 text-sm text-primary">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          Generating...
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Stats - Clickable to switch tabs */}
                  <div className="grid grid-cols-4 gap-4 mt-6 stagger-children">
                    <button 
                      onClick={() => setActiveTab('flashcards')}
                      className={`stat-card p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 text-left border border-primary/20 ${activeTab === 'flashcards' ? 'ring-2 ring-primary glow-border' : ''}`}
                    >
                      <div className="flex items-center gap-2 text-primary mb-2">
                        <BookOpen className="h-4 w-4" />
                        <span className="text-xs font-medium">Flashcards</span>
                      </div>
                      <p className="text-2xl font-bold gradient-text">{activeBank.flashcards.length}</p>
                    </button>
                    <button 
                      onClick={() => setActiveTab('quiz')}
                      className={`stat-card p-4 rounded-lg bg-gradient-to-br from-accent/10 to-accent/5 text-left border border-accent/20 ${activeTab === 'quiz' ? 'ring-2 ring-accent glow-border' : ''}`}
                    >
                      <div className="flex items-center gap-2 text-accent mb-2">
                        <FileQuestion className="h-4 w-4" />
                        <span className="text-xs font-medium">MCQs</span>
                      </div>
                      <p className="text-2xl font-bold text-accent">{activeBank.mcqs.length}</p>
                    </button>
                    <button 
                      onClick={() => setActiveTab('quiz')}
                      className={`stat-card p-4 rounded-lg bg-gradient-to-br from-success/10 to-success/5 text-left border border-success/20 ${activeTab === 'quiz' ? 'ring-2 ring-success glow-border' : ''}`}
                    >
                      <div className="flex items-center gap-2 text-success mb-2">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-xs font-medium">Fill Blanks</span>
                      </div>
                      <p className="text-2xl font-bold text-success">{activeBank.fillBlanks.length}</p>
                    </button>
                    <button 
                      onClick={() => setActiveTab('exam')}
                      className={`stat-card p-4 rounded-lg bg-gradient-to-br from-warning/10 to-warning/5 text-left border border-warning/20 ${activeTab === 'exam' ? 'ring-2 ring-warning glow-border' : ''}`}
                    >
                      <div className="flex items-center gap-2 text-warning mb-2">
                        <GraduationCap className="h-4 w-4" />
                        <span className="text-xs font-medium">Short Answer</span>
                      </div>
                      <p className="text-2xl font-bold text-warning">{activeBank.shortAnswers.length}</p>
                    </button>
                  </div>
                </Card>
                
                {/* Study Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-3 bg-secondary/50">
                    <TabsTrigger value="flashcards" className="gap-2 data-[state=active]:bg-primary/20">
                      <BookOpen className="h-4 w-4" />
                      Flashcards
                    </TabsTrigger>
                    <TabsTrigger value="quiz" className="gap-2">
                      <FileQuestion className="h-4 w-4" />
                      Quiz Mode
                    </TabsTrigger>
                    <TabsTrigger value="exam" className="gap-2">
                      <GraduationCap className="h-4 w-4" />
                      Exam Mode
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="flashcards">
                    <FlashcardView 
                      flashcards={activeBank.flashcards} 
                      bankId={activeBank.id}
                      bankName={activeBank.fileName}
                    />
                  </TabsContent>
                  
                  <TabsContent value="quiz">
                    <QuizView 
                      mcqs={activeBank.mcqs} 
                      fillBlanks={activeBank.fillBlanks}
                      bankId={activeBank.id}
                      bankName={activeBank.fileName}
                    />
                  </TabsContent>
                  
                  <TabsContent value="exam">
                    <ExamView questions={activeBank.shortAnswers} />
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <Card className="p-12 text-center card-glow hover-lift">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <motion.div 
                    className="p-6 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 w-fit mx-auto mb-6 pulse-glow"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Zap className="h-12 w-12 text-primary" />
                  </motion.div>
                  <h2 className="text-3xl font-bold mb-4 gradient-text">Welcome to LearnAI</h2>
                  <p className="text-muted-foreground max-w-md mx-auto mb-8 text-lg">
                    Upload a PDF or text file to generate <span className="text-primary font-semibold">unlimited</span> flashcards, quizzes, and exam questions using AI.
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto stagger-children">
                    <motion.div 
                      className="p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover-lift"
                      whileHover={{ scale: 1.05 }}
                    >
                      <BookOpen className="h-8 w-8 text-primary mx-auto mb-3" />
                      <p className="text-sm font-semibold">Flashcards</p>
                      <p className="text-xs text-muted-foreground mt-1">Flip & memorize</p>
                    </motion.div>
                    <motion.div 
                      className="p-6 rounded-xl bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 hover-lift"
                      whileHover={{ scale: 1.05 }}
                    >
                      <Sparkles className="h-8 w-8 text-accent mx-auto mb-3" />
                      <p className="text-sm font-semibold">Quiz Mode</p>
                      <p className="text-xs text-muted-foreground mt-1">Test yourself</p>
                    </motion.div>
                    <motion.div 
                      className="p-6 rounded-xl bg-gradient-to-br from-success/10 to-success/5 border border-success/20 hover-lift"
                      whileHover={{ scale: 1.05 }}
                    >
                      <GraduationCap className="h-8 w-8 text-success mx-auto mb-3" />
                      <p className="text-sm font-semibold">Exam Mode</p>
                      <p className="text-xs text-muted-foreground mt-1">Written practice</p>
                    </motion.div>
                  </div>
                </motion.div>
              </Card>
            )}
          </motion.div>
        </motion.div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border/50 mt-12 relative z-10">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            <span className="gradient-text font-medium">LearnAI</span> — Free AI Study Material Generator
          </p>
        </div>
      </footer>
    </div>
  );
}
