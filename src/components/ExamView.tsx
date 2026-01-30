import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, CheckCircle, Eye, EyeOff, FileQuestion, Send } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import type { ShortAnswer } from '@/types';
import { cn } from '@/lib/utils';

interface ExamViewProps {
  questions: ShortAnswer[];
}

interface AnswerState {
  userAnswer: string;
  showSuggested: boolean;
  isSubmitted: boolean;
}

export function ExamView({ questions }: ExamViewProps) {
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [examMode, setExamMode] = useState(false);
  
  if (questions.length === 0) {
    return (
      <Card className="p-12 text-center">
        <FileQuestion className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Exam Questions Yet</h3>
        <p className="text-muted-foreground">
          Upload a document to generate short answer questions
        </p>
      </Card>
    );
  }
  
  const toggleQuestion = (id: string) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  
  const updateAnswer = (id: string, userAnswer: string) => {
    setAnswers(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        userAnswer,
        showSuggested: false,
        isSubmitted: false,
      },
    }));
  };
  
  const submitAnswer = (id: string) => {
    setAnswers(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        isSubmitted: true,
      },
    }));
  };
  
  const toggleSuggestedAnswer = (id: string) => {
    setAnswers(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        showSuggested: !prev[id]?.showSuggested,
      },
    }));
  };
  
  const submittedCount = Object.values(answers).filter(a => a.isSubmitted).length;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Written Exam</h2>
          <p className="text-sm text-muted-foreground">
            {questions.length} questions • {submittedCount} answered
          </p>
        </div>
        <Button
          variant={examMode ? "default" : "outline"}
          onClick={() => setExamMode(!examMode)}
        >
          {examMode ? (
            <>
              <Eye className="h-4 w-4 mr-2" />
              Practice Mode
            </>
          ) : (
            <>
              <EyeOff className="h-4 w-4 mr-2" />
              Exam Mode
            </>
          )}
        </Button>
      </div>
      
      {/* Questions List */}
      <div className="space-y-4">
        {questions.map((question, index) => {
          const answer = answers[question.id] || { userAnswer: '', showSuggested: false, isSubmitted: false };
          const isExpanded = expandedQuestions.has(question.id);
          
          return (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="overflow-hidden">
                {/* Question Header */}
                <button
                  onClick={() => toggleQuestion(question.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
                      answer.isSubmitted 
                        ? "bg-success/10 text-success" 
                        : "bg-primary/10 text-primary"
                    )}>
                      {answer.isSubmitted ? <CheckCircle className="h-4 w-4" /> : index + 1}
                    </span>
                    <span className="font-medium line-clamp-1">{question.question}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                
                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-4 pb-4 space-y-4">
                        {/* Full Question */}
                        <div className="p-4 rounded-lg bg-secondary/50">
                          <p className="text-sm text-muted-foreground mb-1">Question:</p>
                          <p>{question.question}</p>
                        </div>
                        
                        {/* Answer Input */}
                        <div className="space-y-2">
                          <label className="text-sm text-muted-foreground">Your Answer:</label>
                          <textarea
                            value={answer.userAnswer}
                            onChange={(e) => updateAnswer(question.id, e.target.value)}
                            placeholder="Type your answer here..."
                            rows={4}
                            className="w-full p-4 rounded-lg border border-border bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                          />
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center justify-between">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleSuggestedAnswer(question.id)}
                            disabled={examMode && !answer.isSubmitted}
                          >
                            {answer.showSuggested ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Hide Answer
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                {examMode ? 'Show Answer' : 'Suggested Answer'}
                              </>
                            )}
                          </Button>
                          
                          <Button
                            size="sm"
                            onClick={() => submitAnswer(question.id)}
                            disabled={!answer.userAnswer.trim() || answer.isSubmitted}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {answer.isSubmitted ? 'Submitted' : 'Submit'}
                          </Button>
                        </div>
                        
                        {/* Suggested Answer */}
                        <AnimatePresence>
                          {answer.showSuggested && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="p-4 rounded-lg bg-success/10 border border-success/20"
                            >
                              <p className="text-sm text-success mb-1 font-medium">Suggested Answer:</p>
                              <p className="text-sm">{question.suggestedAnswer}</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
