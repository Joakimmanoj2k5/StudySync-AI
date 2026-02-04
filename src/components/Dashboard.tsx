import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Brain, FileQuestion, GraduationCap, Sparkles } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent, Card, Progress } from '@/components/ui';
import { FileUpload } from './FileUpload';
import { FlashcardView } from './FlashcardView';
import { QuizView } from './QuizView';
import { ExamView } from './ExamView';
import { StudyBankList } from './StudyBankList';
import { CustomInstructions } from './CustomInstructions';
import { AIProviderStatus } from './AIProviderStatus';
import { useStudy } from '@/context/StudyContext';
import type { StudyBank } from '@/types';

export function Dashboard() {
  const { activeBank, dispatch, processingStatus } = useStudy();
  const [activeTab, setActiveTab] = useState('flashcards');
  
  const handleSelectBank = (bank: StudyBank) => {
    dispatch({ type: 'SET_ACTIVE_BANK', payload: bank });
  };
  
  const totalItems = activeBank 
    ? activeBank.flashcards.length + activeBank.mcqs.length + activeBank.fillBlanks.length + activeBank.shortAnswers.length
    : 0;
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">StudySync AI</h1>
                <p className="text-xs text-muted-foreground">AI-Powered Study Materials</p>
              </div>
            </div>
            <AIProviderStatus />
          </div>
        </div>
      </header>
      
      {/* Processing Banner */}
      {processingStatus.isProcessing && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-primary/10 border-b border-primary/20"
        >
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-4">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              <div className="flex-1">
                <p className="text-sm font-medium">{processingStatus.message}</p>
                <Progress 
                  value={processingStatus.totalChunks > 0 
                    ? (processingStatus.currentChunk / processingStatus.totalChunks) * 100 
                    : 0}
                  className="mt-2 h-2"
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {processingStatus.currentChunk} / {processingStatus.totalChunks}
              </span>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[350px,1fr] gap-8">
          {/* Sidebar */}
          <aside className="space-y-6">
            <FileUpload />
            <CustomInstructions />
            <StudyBankList onSelect={handleSelectBank} />
          </aside>
          
          {/* Content Area */}
          <div className="space-y-6">
            {activeBank ? (
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
                  <div className="grid grid-cols-4 gap-4 mt-6">
                    <button 
                      onClick={() => setActiveTab('flashcards')}
                      className={`p-4 rounded-lg bg-secondary/50 text-left transition-all hover:bg-secondary/80 hover:scale-105 ${activeTab === 'flashcards' ? 'ring-2 ring-primary' : ''}`}
                    >
                      <div className="flex items-center gap-2 text-primary mb-2">
                        <BookOpen className="h-4 w-4" />
                        <span className="text-xs font-medium">Flashcards</span>
                      </div>
                      <p className="text-2xl font-bold">{activeBank.flashcards.length}</p>
                    </button>
                    <button 
                      onClick={() => setActiveTab('quiz')}
                      className={`p-4 rounded-lg bg-secondary/50 text-left transition-all hover:bg-secondary/80 hover:scale-105 ${activeTab === 'quiz' ? 'ring-2 ring-accent' : ''}`}
                    >
                      <div className="flex items-center gap-2 text-accent mb-2">
                        <FileQuestion className="h-4 w-4" />
                        <span className="text-xs font-medium">MCQs</span>
                      </div>
                      <p className="text-2xl font-bold">{activeBank.mcqs.length}</p>
                    </button>
                    <button 
                      onClick={() => setActiveTab('quiz')}
                      className={`p-4 rounded-lg bg-secondary/50 text-left transition-all hover:bg-secondary/80 hover:scale-105 ${activeTab === 'quiz' ? 'ring-2 ring-success' : ''}`}
                    >
                      <div className="flex items-center gap-2 text-success mb-2">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-xs font-medium">Fill Blanks</span>
                      </div>
                      <p className="text-2xl font-bold">{activeBank.fillBlanks.length}</p>
                    </button>
                    <button 
                      onClick={() => setActiveTab('exam')}
                      className={`p-4 rounded-lg bg-secondary/50 text-left transition-all hover:bg-secondary/80 hover:scale-105 ${activeTab === 'exam' ? 'ring-2 ring-warning' : ''}`}
                    >
                      <div className="flex items-center gap-2 text-warning mb-2">
                        <GraduationCap className="h-4 w-4" />
                        <span className="text-xs font-medium">Short Answer</span>
                      </div>
                      <p className="text-2xl font-bold">{activeBank.shortAnswers.length}</p>
                    </button>
                  </div>
                </Card>
                
                {/* Study Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="flashcards" className="gap-2">
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
                    <FlashcardView flashcards={activeBank.flashcards} />
                  </TabsContent>
                  
                  <TabsContent value="quiz">
                    <QuizView mcqs={activeBank.mcqs} fillBlanks={activeBank.fillBlanks} />
                  </TabsContent>
                  
                  <TabsContent value="exam">
                    <ExamView questions={activeBank.shortAnswers} />
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <Card className="p-12 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-6">
                    <GraduationCap className="h-12 w-12 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Welcome to StudySync AI</h2>
                  <p className="text-muted-foreground max-w-md mx-auto mb-8">
                    Upload a PDF or text file to generate unlimited flashcards, quizzes, and exam questions using AI.
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <BookOpen className="h-6 w-6 text-primary mx-auto mb-2" />
                      <p className="text-sm font-medium">Flashcards</p>
                      <p className="text-xs text-muted-foreground">Flip & memorize</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <FileQuestion className="h-6 w-6 text-accent mx-auto mb-2" />
                      <p className="text-sm font-medium">Quiz Mode</p>
                      <p className="text-xs text-muted-foreground">Test yourself</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/50">
                      <GraduationCap className="h-6 w-6 text-success mx-auto mb-2" />
                      <p className="text-sm font-medium">Exam Mode</p>
                      <p className="text-xs text-muted-foreground">Written practice</p>
                    </div>
                  </div>
                </motion.div>
              </Card>
            )}
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border/50 mt-12">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            Powered by Local Ollama + Llama 3.2 • 
            <span className="gradient-text font-medium ml-1">StudySync AI</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
