import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, ChevronLeft, ChevronRight, Shuffle, BookOpen, Star, Clock } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import type { Flashcard } from '@/types';
import { isFavorite, toggleFavorite } from '@/utils/favorites';
import { recordStudySession } from '@/utils/progress';

interface FlashcardViewProps {
  flashcards: Flashcard[];
  bankId?: string;
  bankName?: string;
}

export function FlashcardView({ flashcards, bankId = 'default', bankName = 'Study Bank' }: FlashcardViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [shuffledCards, setShuffledCards] = useState<Flashcard[]>([]);
  const [viewedCards, setViewedCards] = useState<Set<number>>(new Set([0]));
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const startTimeRef = useRef<number>(Date.now());
  
  // Use flashcards directly or shuffled version
  const cards = shuffledCards.length > 0 ? shuffledCards : flashcards;
  
  // Load favorites on mount
  useEffect(() => {
    const favSet = new Set<string>();
    flashcards.forEach(card => {
      if (isFavorite(card.question, bankId)) {
        favSet.add(card.id);
      }
    });
    setFavorites(favSet);
  }, [flashcards, bankId]);
  
  // Record study session on unmount
  useEffect(() => {
    return () => {
      if (viewedCards.size > 1) {
        const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
        recordStudySession(
          bankId,
          bankName,
          'flashcards',
          viewedCards.size,
          viewedCards.size, // All viewed cards count as "correct" for flashcards
          flashcards.length,
          timeSpent
        );
      }
    };
  }, [viewedCards.size, bankId, bankName, flashcards.length]);
  
  if (flashcards.length === 0) {
    return (
      <Card className="p-12 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Flashcards Yet</h3>
        <p className="text-muted-foreground">
          Upload a document to generate flashcards
        </p>
      </Card>
    );
  }
  
  const currentCard = cards[currentIndex] || cards[0];
  
  if (!currentCard) {
    return (
      <Card className="p-12 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Loading...</h3>
      </Card>
    );
  }
  
  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => {
        const newIndex = (prev + 1) % cards.length;
        setViewedCards(v => new Set([...v, newIndex]));
        return newIndex;
      });
    }, 150);
  };
  
  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => {
        const newIndex = (prev - 1 + cards.length) % cards.length;
        setViewedCards(v => new Set([...v, newIndex]));
        return newIndex;
      });
    }, 150);
  };
  
  const handleShuffle = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setShuffledCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setViewedCards(new Set([0]));
  };
  
  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };
  
  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = toggleFavorite({
      bankId,
      bankName,
      type: 'flashcard',
      question: currentCard.question,
      answer: currentCard.answer
    });
    
    if (result.isNowFavorite) {
      setFavorites(prev => new Set([...prev, currentCard.id]));
    } else {
      setFavorites(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentCard.id);
        return newSet;
      });
    }
  };
  
  const isCurrentFavorite = favorites.has(currentCard.id);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Card {currentIndex + 1} of {cards.length}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {viewedCards.size} studied
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleToggleFavorite}
            className={isCurrentFavorite ? 'text-yellow-500 border-yellow-500' : ''}
          >
            <Star className={`h-4 w-4 ${isCurrentFavorite ? 'fill-yellow-500' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={handleShuffle}>
            <Shuffle className="h-4 w-4 mr-2" />
            Shuffle
          </Button>
        </div>
      </div>
      
      <div className="perspective-1000">
        <motion.div
          className="relative w-full aspect-[3/2] cursor-pointer"
          onClick={handleFlip}
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 100 }}
        >
          <Card 
            className="absolute inset-0 p-8 flex flex-col items-center justify-center backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="absolute top-4 left-4 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
              Question
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={`question-\${currentIndex}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-xl font-medium text-center leading-relaxed"
              >
                {currentCard.question}
              </motion.p>
            </AnimatePresence>
            <p className="absolute bottom-4 text-sm text-muted-foreground">
              Click to reveal answer
            </p>
          </Card>
          
          <Card 
            className="absolute inset-0 p-8 flex flex-col items-center justify-center backface-hidden bg-gradient-to-br from-primary/10 to-accent/10"
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            <div className="absolute top-4 left-4 px-2 py-1 rounded-md bg-success/10 text-success text-xs font-medium">
              Answer
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={`answer-\${currentIndex}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-xl font-medium text-center leading-relaxed"
              >
                {currentCard.answer}
              </motion.p>
            </AnimatePresence>
            <p className="absolute bottom-4 text-sm text-muted-foreground">
              Click to see question
            </p>
          </Card>
        </motion.div>
      </div>
      
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="lg" onClick={handlePrev}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button variant="outline" size="lg" onClick={() => setIsFlipped(false)}>
          <RotateCcw className="h-5 w-5" />
        </Button>
        <Button variant="outline" size="lg" onClick={handleNext}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="flex justify-center gap-1.5 flex-wrap max-h-20 overflow-auto py-2">
        {cards.slice(0, 50).map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setIsFlipped(false);
              setCurrentIndex(index);
            }}
            className={`w-2 h-2 rounded-full transition-all duration-200 \${
              index === currentIndex 
                ? 'bg-primary w-4' 
                : 'bg-muted hover:bg-muted-foreground/50'
            }`}
          />
        ))}
        {cards.length > 50 && (
          <span className="text-xs text-muted-foreground ml-2">
            +{cards.length - 50} more
          </span>
        )}
      </div>
    </div>
  );
}
