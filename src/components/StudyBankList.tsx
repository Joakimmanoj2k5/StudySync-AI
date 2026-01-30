import { motion } from 'framer-motion';
import { Trash2, Calendar, FileText, BookOpen, HelpCircle, PenLine, ListChecks, Database, AlertCircle } from 'lucide-react';
import { Button, Card, Progress } from '@/components/ui';
import { useStudy } from '@/context/StudyContext';
import type { StudyBank } from '@/types';

interface StudyBankListProps {
  onSelect: (bank: StudyBank) => void;
}

export function StudyBankList({ onSelect }: StudyBankListProps) {
  const { studyBanks, activeBank, deleteBank, isHydrated } = useStudy();
  
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this study bank? This action cannot be undone.')) {
      await deleteBank(id);
    }
  };
  
  // Show loading state while hydrating
  if (!isHydrated) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="h-5 w-5 text-primary animate-pulse" />
          <span className="text-sm text-muted-foreground">Loading saved collections...</span>
        </div>
        <div className="space-y-2">
          <div className="h-20 rounded-lg bg-muted animate-pulse" />
          <div className="h-20 rounded-lg bg-muted animate-pulse" />
        </div>
      </Card>
    );
  }
  
  if (studyBanks.length === 0) {
    return (
      <Card className="p-8 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Study Banks Yet</h3>
        <p className="text-muted-foreground text-sm">
          Upload a document to create your first study bank.
          <br />
          <span className="text-xs mt-1 block text-muted-foreground/70">
            Your data is saved locally and persists across sessions.
          </span>
        </p>
      </Card>
    );
  }
  
  // Sort banks: processing first, then by date (newest first)
  const sortedBanks = [...studyBanks].sort((a, b) => {
    if (a.isProcessing && !b.isProcessing) return -1;
    if (!a.isProcessing && b.isProcessing) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Database className="h-4 w-4" />
          Saved Collections
        </h3>
        <span className="text-xs text-muted-foreground">
          {studyBanks.length} {studyBanks.length === 1 ? 'set' : 'sets'}
        </span>
      </div>
      
      <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto pr-1">
        {sortedBanks.map((bank, index) => {
          const isActive = activeBank?.id === bank.id;
          const totalItems = bank.flashcards.length + bank.mcqs.length + bank.fillBlanks.length + bank.shortAnswers.length;
          const progressPercent = bank.totalChunks > 0 
            ? Math.round((bank.processedChunks / bank.totalChunks) * 100) 
            : 0;
          const isIncomplete = bank.isProcessing || (bank.processedChunks < bank.totalChunks && bank.totalChunks > 0);
          
          return (
            <motion.div
              key={bank.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={`p-4 cursor-pointer transition-all duration-200 hover:border-primary/50 ${
                  isActive ? 'border-primary bg-primary/5' : ''
                } ${isIncomplete ? 'border-warning/30' : ''}`}
                onClick={() => onSelect(bank)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${isIncomplete ? 'bg-warning/10' : 'bg-secondary'}`}>
                      <FileText className={`h-4 w-4 ${isIncomplete ? 'text-warning' : 'text-primary'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium line-clamp-1 text-sm">{bank.fileName}</h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span>{new Date(bank.createdAt).toLocaleDateString()}</span>
                        {totalItems > 0 && (
                          <>
                            <span>•</span>
                            <span>{totalItems} items</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={(e) => handleDelete(e, bank.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Progress for incomplete banks */}
                {isIncomplete && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-warning flex items-center gap-1">
                        {bank.isProcessing ? (
                          <>
                            <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3" />
                            Incomplete
                          </>
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {bank.processedChunks}/{bank.totalChunks} chunks
                      </span>
                    </div>
                    <Progress value={progressPercent} className="h-1.5" />
                  </div>
                )}
                
                {/* Stats - only show if has content */}
                {totalItems > 0 && !isIncomplete && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <div className="flex items-center gap-1.5 text-xs" title="Flashcards">
                      <BookOpen className="h-3 w-3 text-primary" />
                      <span>{bank.flashcards.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs" title="MCQs">
                      <HelpCircle className="h-3 w-3 text-accent" />
                      <span>{bank.mcqs.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs" title="Fill in the blanks">
                      <ListChecks className="h-3 w-3 text-success" />
                      <span>{bank.fillBlanks.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs" title="Short answers">
                      <PenLine className="h-3 w-3 text-warning" />
                      <span>{bank.shortAnswers.length}</span>
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
