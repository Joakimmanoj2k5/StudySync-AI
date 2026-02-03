import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, ChevronRight, RotateCcw, Trophy, ClipboardList, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Card, Progress } from '@/components/ui';
import type { MCQ, FillInBlank } from '@/types';
import { cn } from '@/lib/utils';

interface QuizViewProps {
  mcqs: MCQ[];
  fillBlanks: FillInBlank[];
}

type QuizItem = (MCQ & { type: 'mcq' }) | (FillInBlank & { type: 'fillBlank' });

interface AnswerRecord {
  question: QuizItem;
  userAnswer: number | string;
  isCorrect: boolean;
}

export function QuizView({ mcqs, fillBlanks }: QuizViewProps) {
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [fillBlankInput, setFillBlankInput] = useState('');
  const [answeredQuestions, setAnsweredQuestions] = useState<boolean[]>([]);
  const [shuffledQuestions, setShuffledQuestions] = useState<QuizItem[]>([]);
  const [answerHistory, setAnswerHistory] = useState<AnswerRecord[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [expandedReview, setExpandedReview] = useState<Set<number>>(new Set());
  
  // Initialize questions when props change
  useEffect(() => {
    const combined: QuizItem[] = [
      ...mcqs.map(q => ({ ...q, type: 'mcq' as const })),
      ...fillBlanks.map(q => ({ ...q, type: 'fillBlank' as const })),
    ];
    // Shuffle on initial load
    const shuffled = [...combined].sort(() => Math.random() - 0.5);
    setShuffledQuestions(shuffled);
    setQuizStarted(false);
    setCurrentIndex(0);
    setScore(0);
  }, [mcqs, fillBlanks]);
  
  const allQuestions = shuffledQuestions;
  
  if (allQuestions.length === 0) {
    return (
      <Card className="p-12 text-center">
        <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Quiz Questions Yet</h3>
        <p className="text-muted-foreground">
          Upload a document to generate quiz questions
        </p>
      </Card>
    );
  }
  
  const currentQuestion = allQuestions[currentIndex];
  
  // Safety check
  if (!currentQuestion && allQuestions.length > 0) {
    return (
      <Card className="p-12 text-center">
        <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Loading Quiz...</h3>
      </Card>
    );
  }
  
  const handleStartQuiz = () => {
    setQuizStarted(true);
    setCurrentIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setQuizComplete(false);
    setFillBlankInput('');
    setAnsweredQuestions(new Array(allQuestions.length).fill(false));
    setAnswerHistory([]);
    setShowReview(false);
  };
  
  const handleSelectAnswer = (answer: number | string) => {
    if (showResult) return;
    setSelectedAnswer(answer);
  };
  
  const handleSubmitAnswer = () => {
    if (selectedAnswer === null && fillBlankInput === '') return;
    
    let isCorrect = false;
    const userAnswer = currentQuestion.type === 'mcq' ? selectedAnswer : fillBlankInput;
    
    if (currentQuestion.type === 'mcq') {
      isCorrect = selectedAnswer === currentQuestion.correctIndex;
    } else {
      isCorrect = fillBlankInput.toLowerCase().trim() === currentQuestion.answer.toLowerCase().trim();
    }
    
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
    
    const newAnswered = [...answeredQuestions];
    newAnswered[currentIndex] = isCorrect;
    setAnsweredQuestions(newAnswered);
    
    // Track answer history
    setAnswerHistory(prev => [...prev, {
      question: currentQuestion,
      userAnswer: userAnswer!,
      isCorrect
    }]);
    
    setShowResult(true);
  };
  
  const handleNext = () => {
    if (currentIndex + 1 >= allQuestions.length) {
      setQuizComplete(true);
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setFillBlankInput('');
    }
  };
  
  const scorePercentage = Math.round((score / allQuestions.length) * 100);
  
  // Quiz start screen
  if (!quizStarted) {
    return (
      <Card className="p-8 text-center">
        <div className="max-w-md mx-auto">
          <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-6">
            <ClipboardList className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Quiz Mode</h2>
          <p className="text-muted-foreground mb-6">
            Test your knowledge with {mcqs.length} MCQs and {fillBlanks.length} fill-in-the-blank questions.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-secondary">
              <p className="text-2xl font-bold text-primary">{mcqs.length}</p>
              <p className="text-sm text-muted-foreground">MCQs</p>
            </div>
            <div className="p-4 rounded-lg bg-secondary">
              <p className="text-2xl font-bold text-accent">{fillBlanks.length}</p>
              <p className="text-sm text-muted-foreground">Fill Blanks</p>
            </div>
          </div>
          <Button onClick={handleStartQuiz} size="lg" className="w-full">
            Start Quiz
          </Button>
        </div>
      </Card>
    );
  }
  
  // Quiz complete screen
  if (quizComplete) {
    const toggleReviewItem = (index: number) => {
      setExpandedReview(prev => {
        const newSet = new Set(prev);
        if (newSet.has(index)) {
          newSet.delete(index);
        } else {
          newSet.add(index);
        }
        return newSet;
      });
    };

    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md mx-auto"
          >
            <div className="p-4 rounded-full bg-success/10 w-fit mx-auto mb-6">
              <Trophy className="h-10 w-10 text-success" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
            <p className="text-muted-foreground mb-6">
              You've finished all the questions
            </p>
            
            <div className="relative w-32 h-32 mx-auto mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${scorePercentage * 3.52} 352`}
                  className="text-success transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold">{scorePercentage}%</span>
              </div>
            </div>
            
            <p className="text-lg mb-6">
              You scored <span className="font-bold text-success">{score}</span> out of{' '}
              <span className="font-bold">{allQuestions.length}</span>
            </p>
            
            <div className="flex gap-3 justify-center">
              <Button onClick={handleStartQuiz} size="lg">
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => setShowReview(!showReview)}
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                {showReview ? 'Hide Review' : 'Review Answers'}
              </Button>
            </div>
          </motion.div>
        </Card>

        {/* Review Section */}
        <AnimatePresence>
          {showReview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Review All Questions with Explanations
              </h3>
              
              {answerHistory.map((record, index) => (
                <Card key={index} className="overflow-hidden">
                  <button
                    onClick={() => toggleReviewItem(index)}
                    className="w-full p-4 flex items-start justify-between text-left hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium flex-shrink-0",
                        record.isCorrect 
                          ? "bg-success/10 text-success" 
                          : "bg-destructive/10 text-destructive"
                      )}>
                        {record.isCorrect ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </span>
                      <div>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium mr-2",
                          record.question.type === 'mcq' 
                            ? "bg-primary/10 text-primary" 
                            : "bg-accent/10 text-accent"
                        )}>
                          {record.question.type === 'mcq' ? 'MCQ' : 'Fill Blank'}
                        </span>
                        <p className="font-medium mt-1 line-clamp-2">
                          {record.question.type === 'mcq' 
                            ? record.question.question 
                            : record.question.sentence}
                        </p>
                      </div>
                    </div>
                    {expandedReview.has(index) ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                    )}
                  </button>
                  
                  <AnimatePresence>
                    {expandedReview.has(index) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-4 pb-4 space-y-3"
                      >
                        {/* Your Answer */}
                        <div className={cn(
                          "p-3 rounded-lg",
                          record.isCorrect ? "bg-success/10" : "bg-destructive/10"
                        )}>
                          <p className="text-sm font-medium mb-1">Your Answer:</p>
                          <p className={cn(
                            "text-sm",
                            record.isCorrect ? "text-success" : "text-destructive"
                          )}>
                            {record.question.type === 'mcq' 
                              ? record.question.options[record.userAnswer as number]
                              : record.userAnswer}
                          </p>
                        </div>
                        
                        {/* Correct Answer */}
                        {!record.isCorrect && (
                          <div className="p-3 rounded-lg bg-success/10">
                            <p className="text-sm font-medium mb-1">Correct Answer:</p>
                            <p className="text-sm text-success">
                              {record.question.type === 'mcq' 
                                ? record.question.options[record.question.correctIndex]
                                : record.question.answer}
                            </p>
                          </div>
                        )}
                        
                        {/* Explanation */}
                        {record.question.type === 'mcq' && record.question.explanation && (
                          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                            <p className="text-sm font-medium mb-1 flex items-center gap-2">
                              <Lightbulb className="h-4 w-4 text-primary" />
                              Explanation:
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {record.question.explanation}
                            </p>
                          </div>
                        )}
                        
                        {record.question.type === 'fillBlank' && record.question.explanation && (
                          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                            <p className="text-sm font-medium mb-1 flex items-center gap-2">
                              <Lightbulb className="h-4 w-4 text-primary" />
                              Explanation:
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {record.question.explanation}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Question {currentIndex + 1} of {allQuestions.length}
          </span>
          <span className="font-medium text-success">Score: {score}</span>
        </div>
        <Progress value={((currentIndex + 1) / allQuestions.length) * 100} />
      </div>
      
      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className={cn(
                "px-2 py-1 rounded-md text-xs font-medium",
                currentQuestion.type === 'mcq' 
                  ? "bg-primary/10 text-primary" 
                  : "bg-accent/10 text-accent"
              )}>
                {currentQuestion.type === 'mcq' ? 'Multiple Choice' : 'Fill in the Blank'}
              </span>
            </div>
            
            <h3 className="text-xl font-medium mb-6">
              {currentQuestion.type === 'mcq' 
                ? currentQuestion.question 
                : currentQuestion.sentence.replace('___', '_____')}
            </h3>
            
            {currentQuestion.type === 'mcq' ? (
              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectAnswer(index)}
                    disabled={showResult}
                    className={cn(
                      "w-full p-4 rounded-lg text-left transition-all duration-200 border",
                      selectedAnswer === index && !showResult && "border-primary bg-primary/10",
                      showResult && index === currentQuestion.correctIndex && "border-success bg-success/10",
                      showResult && selectedAnswer === index && index !== currentQuestion.correctIndex && "border-destructive bg-destructive/10",
                      !showResult && selectedAnswer !== index && "border-border hover:border-primary/50 hover:bg-secondary/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option}</span>
                      {showResult && index === currentQuestion.correctIndex && (
                        <CheckCircle className="h-5 w-5 text-success" />
                      )}
                      {showResult && selectedAnswer === index && index !== currentQuestion.correctIndex && (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  type="text"
                  value={fillBlankInput}
                  onChange={(e) => setFillBlankInput(e.target.value)}
                  disabled={showResult}
                  placeholder="Type your answer..."
                  className={cn(
                    "w-full p-4 rounded-lg border bg-transparent transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary",
                    showResult && fillBlankInput.toLowerCase().trim() === currentQuestion.answer.toLowerCase().trim() && "border-success",
                    showResult && fillBlankInput.toLowerCase().trim() !== currentQuestion.answer.toLowerCase().trim() && "border-destructive"
                  )}
                />
                {showResult && (
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Correct answer: </span>
                      <span className="font-medium text-success">{currentQuestion.answer}</span>
                    </p>
                    {currentQuestion.explanation && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-lg bg-primary/10 border border-primary/20"
                      >
                        <p className="text-sm font-medium mb-1 flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-primary" />
                          Explanation:
                        </p>
                        <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {showResult && currentQuestion.type === 'mcq' && currentQuestion.explanation && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20"
              >
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Explanation:
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{currentQuestion.explanation}</p>
              </motion.div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>
      
      {/* Actions */}
      <div className="flex justify-end gap-3">
        {!showResult ? (
          <Button 
            onClick={handleSubmitAnswer}
            disabled={selectedAnswer === null && fillBlankInput === ''}
          >
            Submit Answer
          </Button>
        ) : (
          <Button onClick={handleNext}>
            {currentIndex + 1 >= allQuestions.length ? 'See Results' : 'Next Question'}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
