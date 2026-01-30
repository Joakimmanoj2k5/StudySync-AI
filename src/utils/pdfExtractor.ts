/**
 * PDF Text Extraction Utility with OCR Support
 * Uses PDF.js for text extraction and Tesseract.js for image OCR
 */

import * as pdfjsLib from 'pdfjs-dist';
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Tesseract from 'tesseract.js';

// Set up the PDF.js worker using Vite's asset handling
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfjsWorker;
console.log('[PDF.js] Version:', pdfjsLib.version);
console.log('[PDF.js] Worker URL:', PdfjsWorker);

export interface ExtractionProgress {
  currentPage: number;
  totalPages: number;
  percentage: number;
  status?: string;
}

export interface ExtractionResult {
  text: string;
  pageCount: number;
  metadata?: {
    title?: string;
    author?: string;
  };
  ocrUsed?: boolean;
}

// Minimum text length to consider a page as having meaningful text
const MIN_TEXT_LENGTH = 50;

/**
 * Renders a PDF page to a canvas and returns image data for OCR
 */
async function renderPageToImage(page: pdfjsLib.PDFPageProxy, scale: number = 2.0): Promise<string> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  await page.render({
    canvasContext: context,
    viewport: viewport,
    canvas: canvas,
  } as any).promise;
  
  return canvas.toDataURL('image/png');
}

/**
 * Performs OCR on an image using Tesseract.js
 */
async function performOCR(imageData: string, pageNum: number): Promise<string> {
  console.log(`[OCR] Starting OCR for page ${pageNum}...`);
  
  try {
    const result = await Tesseract.recognize(imageData, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[OCR] Page ${pageNum}: ${Math.round((m.progress || 0) * 100)}%`);
        }
      },
    });
    
    const text = result.data.text.trim();
    console.log(`[OCR] Page ${pageNum} complete, extracted ${text.length} chars`);
    return text;
  } catch (error) {
    console.error(`[OCR] Error on page ${pageNum}:`, error);
    return '';
  }
}

/**
 * Extracts text from a PDF file with OCR fallback for images/scanned pages
 * @param file - The PDF file to extract text from
 * @param onProgress - Optional callback for progress updates
 */
export async function extractTextFromPDF(
  file: File,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<ExtractionResult> {
  console.log('[PDF Extractor] Starting extraction for:', file.name);
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    console.log('[PDF Extractor] File loaded, size:', arrayBuffer.byteLength);
    
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log('[PDF Extractor] PDF loaded, pages:', pdf.numPages);
    
    const totalPages = pdf.numPages;
    const textParts: string[] = [];
    let ocrUsed = false;
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (onProgress) {
        onProgress({
          currentPage: pageNum,
          totalPages,
          percentage: Math.round((pageNum / totalPages) * 100),
          status: `Extracting page ${pageNum}...`,
        });
      }
      
      const page = await pdf.getPage(pageNum);
      
      // First, try to extract text directly
      const textContent = await page.getTextContent();
      let pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .trim();
      
      console.log(`[PDF Extractor] Page ${pageNum}/${totalPages} text extracted: ${pageText.length} chars`);
      
      // If text is too short, the page might be scanned/image-based - use OCR
      if (pageText.length < MIN_TEXT_LENGTH) {
        console.log(`[PDF Extractor] Page ${pageNum} has minimal text, attempting OCR...`);
        
        if (onProgress) {
          onProgress({
            currentPage: pageNum,
            totalPages,
            percentage: Math.round((pageNum / totalPages) * 100),
            status: `OCR processing page ${pageNum}...`,
          });
        }
        
        const imageData = await renderPageToImage(page);
        const ocrText = await performOCR(imageData, pageNum);
        
        if (ocrText.length > pageText.length) {
          pageText = ocrText;
          ocrUsed = true;
          console.log(`[PDF Extractor] Page ${pageNum} OCR successful: ${ocrText.length} chars`);
        }
      }
      
      textParts.push(pageText);
    }
    
    // Get metadata if available
    let metadata: ExtractionResult['metadata'] = {};
    try {
      const metadataObj = await pdf.getMetadata();
      if (metadataObj?.info) {
        const info = metadataObj.info as any;
        metadata = {
          title: info.Title,
          author: info.Author,
        };
      }
    } catch {
      // Metadata extraction failed, continue without it
    }
    
    const fullText = textParts.join('\n\n');
    console.log('[PDF Extractor] Extraction complete, total chars:', fullText.length);
    console.log('[PDF Extractor] OCR was used:', ocrUsed);
    
    return {
      text: fullText,
      pageCount: totalPages,
      metadata,
      ocrUsed,
    };
  } catch (error) {
    console.error('[PDF Extractor] Error:', error);
    throw error;
  }
}

/**
 * Extracts text from an image file using OCR
 */
export async function extractTextFromImage(
  file: File,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<ExtractionResult> {
  console.log('[Image Extractor] Starting OCR for:', file.name);
  
  if (onProgress) {
    onProgress({
      currentPage: 1,
      totalPages: 1,
      percentage: 0,
      status: 'Starting OCR...',
    });
  }
  
  try {
    const imageUrl = URL.createObjectURL(file);
    
    const result = await Tesseract.recognize(imageUrl, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress({
            currentPage: 1,
            totalPages: 1,
            percentage: Math.round((m.progress || 0) * 100),
            status: `OCR: ${Math.round((m.progress || 0) * 100)}%`,
          });
        }
      },
    });
    
    URL.revokeObjectURL(imageUrl);
    
    const text = result.data.text.trim();
    console.log('[Image Extractor] OCR complete, extracted:', text.length, 'chars');
    
    if (onProgress) {
      onProgress({
        currentPage: 1,
        totalPages: 1,
        percentage: 100,
        status: 'Complete',
      });
    }
    
    return {
      text,
      pageCount: 1,
      ocrUsed: true,
    };
  } catch (error) {
    console.error('[Image Extractor] Error:', error);
    throw new Error('Failed to extract text from image. Please ensure the image is clear and contains readable text.');
  }
}

/**
 * Extracts text from a plain text file
 */
export async function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(text);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Main extraction function that handles PDFs, images, and text files
 */
export async function extractText(
  file: File,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<ExtractionResult> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  console.log('[Extractor] Processing file:', fileName, 'Type:', fileType);
  
  // Handle PDF files
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return extractTextFromPDF(file, onProgress);
  }
  
  // Handle image files (for OCR)
  if (
    fileType.startsWith('image/') ||
    fileName.endsWith('.png') ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.webp') ||
    fileName.endsWith('.bmp') ||
    fileName.endsWith('.gif')
  ) {
    return extractTextFromImage(file, onProgress);
  }
  
  // Handle text-based files
  if (
    fileType.startsWith('text/') ||
    fileName.endsWith('.txt') ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.markdown')
  ) {
    const text = await extractTextFromFile(file);
    
    if (onProgress) {
      onProgress({ currentPage: 1, totalPages: 1, percentage: 100 });
    }
    
    return {
      text,
      pageCount: 1,
    };
  }
  
  throw new Error(`Unsupported file type: ${fileType || fileName}`);
}
