import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Save, Trash2 } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { getCustomInstructions, setCustomInstructions } from '@/utils/aiProcessor';

export function CustomInstructions() {
  // Initialize state directly from storage
  const initialInstructions = useMemo(() => getCustomInstructions(), []);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [saved, setSaved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const handleSave = () => {
    setCustomInstructions(instructions);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  
  const handleClear = () => {
    setInstructions('');
    setCustomInstructions('');
  };
  
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 pointer-events-none" />
      
      <div className="relative p-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <MessageSquare className="h-4 w-4 text-accent" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold">Custom Instructions</h3>
              <p className="text-xs text-muted-foreground">
                {instructions ? 'Instructions set' : 'Add study preferences'}
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </button>
        
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 space-y-3"
          >
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Example instructions:
• Focus on exam-style questions
• Include formulas and derivations
• Add practical examples
• Emphasize key dates and events
• Create comparison questions
• Include diagram-based questions"
              className="w-full h-32 p-3 text-sm bg-secondary/50 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            
            <div className="flex gap-2">
              <Button 
                onClick={handleSave} 
                size="sm" 
                className="flex-1"
                variant={saved ? 'default' : 'outline'}
              >
                <Save className="h-3 w-3 mr-1" />
                {saved ? 'Saved!' : 'Save'}
              </Button>
              <Button 
                onClick={handleClear} 
                size="sm" 
                variant="ghost"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground">
              These instructions will be included when generating study materials from your uploads.
            </p>
          </motion.div>
        )}
      </div>
    </Card>
  );
}
