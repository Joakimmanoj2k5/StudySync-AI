import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, Loader2, Sparkles } from 'lucide-react';
import { Button, Card, Progress } from '@/components/ui';
import { useStudy } from '@/context/useStudy';
import { extractText, type ExtractionProgress } from '@/utils/pdfExtractor';
import { chunkText, getChunkingStats } from '@/utils/chunking';
import { checkProviderStatus, getConfig, processChunk } from '@/utils/aiProcessor';

interface TimetableDetectionResult {
  isLikelyTimetable: boolean;
  confidence: 'low' | 'medium' | 'high';
  structuredLineCount: number;
}

function detectTimetableContent(text: string): TimetableDetectionResult {
  const normalized = text.toLowerCase();
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const strongSignals = [
    'exam timetable',
    'exam schedule',
    'class timetable',
    'time table',
    'schedule of examinations',
  ];
  const supportSignals = [
    'timetable',
    'slot',
    'venue',
    'room no',
    'room number',
    'exam hall',
    'reporting time',
  ];

  const strongSignalCount = strongSignals.filter((signal) => normalized.includes(signal)).length;
  const supportSignalCount = supportSignals.filter((signal) => normalized.includes(signal)).length;
  const dayMatches = (normalized.match(/\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g) || []).length;
  const dateMatches = (normalized.match(/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/g) || []).length;
  const timeMatches = (normalized.match(/\b\d{1,2}:\d{2}\s?(am|pm)?\b/g) || []).length;

  const structuredLineCount = lines.filter((line) => {
    const wordCount = line.split(/\s+/).filter(Boolean).length;
    if (wordCount > 18) return false;

    let structureSignals = 0;
    if (/\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(line)) structureSignals += 1;
    if (/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/.test(line)) structureSignals += 1;
    if (/\b\d{1,2}:\d{2}\s?(am|pm)?\b/i.test(line)) structureSignals += 1;
    if (/\b(venue|room|hall|slot|session)\b/i.test(line)) structureSignals += 1;

    return structureSignals >= 2;
  }).length;

  const hasDenseSchedulePattern = dayMatches >= 3 && dateMatches >= 2 && timeMatches >= 2;
  const isHighConfidence = strongSignalCount >= 1 && (structuredLineCount >= 2 || hasDenseSchedulePattern);
  const isMediumConfidence = !isHighConfidence && supportSignalCount >= 2 && structuredLineCount >= 3 && dayMatches >= 2;

  if (isHighConfidence) {
    return { isLikelyTimetable: true, confidence: 'high', structuredLineCount };
  }

  if (isMediumConfidence) {
    return { isLikelyTimetable: true, confidence: 'medium', structuredLineCount };
  }

  return { isLikelyTimetable: false, confidence: 'low', structuredLineCount };
}

export function FileUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractionProgress, setExtractionProgress] = useState<ExtractionProgress | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { createStudyBank, appendChunkResults, setProcessingStatus, finishProcessing, processingStatus } = useStudy();
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndSetFile(file);
    }
  }, []);
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    if (file) {
      validateAndSetFile(file);
    }
  }, []);
  
  const validateAndSetFile = (file: File) => {
    const validTypes = [
      'application/pdf', 
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 
      'text/markdown',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/bmp',
      'image/gif',
    ];
    const validExtensions = ['.pdf', '.ppt', '.pptx', '.txt', '.md', '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'];
    
    const hasValidType = validTypes.includes(file.type) || file.type.startsWith('image/');
    const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!hasValidType && !hasValidExtension) {
      setError('Please upload a PDF, PowerPoint, text file, or image');
      return;
    }
    
    setSelectedFile(file);
  };
  
  const processFile = async () => {
    if (!selectedFile) return;
    
    setIsExtracting(true);
    setError(null);
    
    try {
      console.log('[FileUpload] Starting to process file:', selectedFile.name);
      
      // Step 1: Extract text from file
      console.log('[FileUpload] Step 1: Extracting text...');
      const result = await extractText(selectedFile, setExtractionProgress);
      console.log('[FileUpload] Text extracted, length:', result.text.length);
      
      if (!result.text || result.text.trim().length === 0) {
        throw new Error('No text content could be extracted from the file. The file might be empty or image-based.');
      }

      const timetableDetection = detectTimetableContent(result.text);
      if (timetableDetection.isLikelyTimetable) {
        const continueAnyway = window.confirm(
          timetableDetection.confidence === 'high'
            ? 'This file strongly resembles a timetable or schedule. Press OK to continue anyway, or Cancel to choose a different file.'
            : 'Parts of this file look schedule-like. Press OK to continue anyway if this is actually your notes.'
        );

        if (!continueAnyway) {
          throw new Error('Upload cancelled because the file looked like a timetable or schedule.');
        }
      }
      
      // Step 2: Chunk the text
      console.log('[FileUpload] Step 2: Chunking text...');
      const chunks = chunkText(result.text);
      const stats = getChunkingStats(chunks);
      console.log('[FileUpload] Chunks created:', stats);
      
      if (chunks.length === 0) {
        throw new Error('No content could be extracted from the file');
      }

      const { provider } = getConfig();
      const providerAvailable = await checkProviderStatus(provider);
      if (!providerAvailable) {
        const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
        throw new Error(`${providerLabel} is unavailable right now. Switch providers or fix the current provider before generating questions.`);
      }
      
      // Step 3: Create study bank and start processing
      console.log('[FileUpload] Step 3: Creating study bank...');
      const bank = createStudyBank(selectedFile.name, stats.totalChunks);
      console.log('[FileUpload] Study bank created:', bank.id);
      
      setProcessingStatus({
        isProcessing: true,
        currentChunk: 0,
        totalChunks: stats.totalChunks,
        message: 'Starting AI analysis...',
      });
      
      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Step 4: Process each chunk
      console.log('[FileUpload] Step 4: Processing chunks...');
      for (let i = 0; i < chunks.length; i++) {
        console.log(`[FileUpload] Processing chunk ${i + 1}/${chunks.length}...`);
        
        setProcessingStatus({
          isProcessing: true,
          currentChunk: i + 1,
          totalChunks: stats.totalChunks,
          message: `Analyzing chunk ${i + 1} of ${stats.totalChunks}...`,
        });
        
        // Allow UI to update before processing
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const chunkResult = await processChunk(chunks[i].text, i, chunks.length, undefined, {
          skipAvailabilityCheck: true,
        });
        console.log(`[FileUpload] Chunk ${i + 1} result:`, {
          flashcards: chunkResult.flashcards.length,
          mcqs: chunkResult.mcqs.length,
          fillBlanks: chunkResult.fillBlanks.length,
          shortAnswers: chunkResult.shortAnswers.length,
        });
        
        appendChunkResults(bank.id, i, chunkResult);
        
        // Delay between chunks to avoid rate limiting and allow UI updates
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log('[FileUpload] Processing complete!');
      finishProcessing(bank.id);
      setSelectedFile(null);
      
    } catch (err) {
      console.error('[FileUpload] Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while processing the file');
      // Reset processing status on error
      setProcessingStatus({
        isProcessing: false,
        currentChunk: 0,
        totalChunks: 0,
        message: '',
      });
    } finally {
      setIsExtracting(false);
      setExtractionProgress(null);
    }
  };
  
  const removeFile = () => {
    setSelectedFile(null);
    setError(null);
  };
  
  const isProcessing = isExtracting || processingStatus.isProcessing;
  
  return (
    <Card className="relative overflow-hidden card-glow">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <div className="relative p-4 sm:p-6">
        <div className="mb-5 flex items-center gap-3 sm:mb-6">
          <motion.div 
            className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20"
            whileHover={{ scale: 1.1, rotate: 5 }}
          >
            <Upload className="h-5 w-5 text-primary" />
          </motion.div>
          <div>
            <h2 className="text-lg font-semibold gradient-text">Upload Study Material</h2>
            <p className="text-sm text-muted-foreground">PDF, PPT/PPTX, images, or text files supported</p>
          </div>
        </div>
        
        <AnimatePresence mode="wait">
          {!selectedFile && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  upload-zone relative cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-all duration-300 sm:p-8
                  ${isDragging 
                    ? 'drag-over border-primary bg-primary/10 scale-[1.02]' 
                    : 'border-primary/30 hover:border-primary/60 hover:bg-secondary/30'
                  }
                `}
              >
                <input
                  type="file"
                  accept=".pdf,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,.bmp,.gif,image/*"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                <motion.div
                  animate={{ y: isDragging ? -8 : 0, scale: isDragging ? 1.05 : 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="flex flex-col items-center gap-4"
                >
                  <motion.div 
                    className="p-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/20"
                    animate={{ rotate: isDragging ? 10 : 0 }}
                  >
                    <FileText className="h-8 w-8 text-primary" />
                  </motion.div>
                  <div>
                    <p className="text-base font-medium sm:text-lg">
                      {isDragging ? '✨ Drop your file here' : 'Drag & drop your file here'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      or <span className="text-primary font-medium">click to browse</span>
                    </p>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
          
          {selectedFile && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="rounded-lg bg-secondary/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={removeFile}>
                  <X className="h-4 w-4" />
                </Button>
                </div>
              </div>
              
              <Button onClick={processFile} className="w-full" size="lg">
                <Sparkles className="h-4 w-4" />
                Generate Study Materials
              </Button>
            </motion.div>
          )}
          
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="text-center py-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                <p className="font-medium">
                  {extractionProgress 
                    ? (extractionProgress.status || `Extracting text... Page ${extractionProgress.currentPage} of ${extractionProgress.totalPages}`)
                    : processingStatus.message
                  }
                </p>
                {extractionProgress?.status?.includes('OCR') && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Using OCR for scanned/image content
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {extractionProgress 
                      ? `${extractionProgress.percentage}%`
                      : processingStatus.totalChunks > 0 
                        ? `${Math.round((processingStatus.currentChunk / processingStatus.totalChunks) * 100)}%`
                        : '0%'
                    }
                  </span>
                </div>
                <Progress 
                  value={
                    extractionProgress 
                      ? extractionProgress.percentage
                      : processingStatus.totalChunks > 0 
                        ? (processingStatus.currentChunk / processingStatus.totalChunks) * 100
                        : 0
                  } 
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
          >
            {error}
          </motion.div>
        )}
      </div>
    </Card>
  );
}
