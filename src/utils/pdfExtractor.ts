/**
 * PDF Text Extraction Utility with OCR Support
 * Loads PDF/OCR dependencies lazily to keep initial bundle size smaller.
 */

import type { PDFPageProxy, TextItem } from 'pdfjs-dist/types/src/display/api';
import JSZip from 'jszip';

const DEBUG_EXTRACTOR = import.meta.env.DEV;
const debugLog = (...args: unknown[]) => {
  if (DEBUG_EXTRACTOR) console.log(...args);
};

type PdfJsLib = typeof import('pdfjs-dist');
type TesseractLib = typeof import('tesseract.js');

let pdfJsLibPromise: Promise<PdfJsLib> | null = null;
let tesseractPromise: Promise<TesseractLib> | null = null;

async function getPdfJsLib(): Promise<PdfJsLib> {
  if (!pdfJsLibPromise) {
    pdfJsLibPromise = (async () => {
      const [{ default: workerUrl }, pdfjsLib] = await Promise.all([
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        import('pdfjs-dist'),
      ]);
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      debugLog('[PDF.js] Version:', pdfjsLib.version);
      return pdfjsLib;
    })();
  }
  return pdfJsLibPromise;
}

async function getTesseract(): Promise<TesseractLib> {
  if (!tesseractPromise) {
    tesseractPromise = import('tesseract.js');
  }
  return tesseractPromise;
}

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
async function renderPageToImage(page: PDFPageProxy, scale: number = 2.0): Promise<string> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  await page.render({
    canvasContext: context,
    viewport: viewport,
    canvas: canvas,
  } as Parameters<typeof page.render>[0]).promise;
  
  return canvas.toDataURL('image/png');
}

/**
 * Performs OCR on an image using Tesseract.js
 */
async function performOCR(imageData: string, pageNum: number): Promise<string> {
  debugLog(`[OCR] Starting OCR for page ${pageNum}...`);
  
  try {
    const Tesseract = await getTesseract();
    const result = await Tesseract.recognize(imageData, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          debugLog(`[OCR] Page ${pageNum}: ${Math.round((m.progress || 0) * 100)}%`);
        }
      },
    });
    
    const text = result.data.text.trim();
    debugLog(`[OCR] Page ${pageNum} complete, extracted ${text.length} chars`);
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
  debugLog('[PDF Extractor] Starting extraction for:', file.name);
  
  try {
    const pdfjsLib = await getPdfJsLib();
    const arrayBuffer = await file.arrayBuffer();
    debugLog('[PDF Extractor] File loaded, size:', arrayBuffer.byteLength);
    
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    debugLog('[PDF Extractor] PDF loaded, pages:', pdf.numPages);
    
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
        .filter((item): item is TextItem => 'str' in item)
        .map((item) => item.str)
        .join(' ')
        .trim();
      
      debugLog(`[PDF Extractor] Page ${pageNum}/${totalPages} text extracted: ${pageText.length} chars`);
      
      // If text is too short, the page might be scanned/image-based - use OCR
      if (pageText.length < MIN_TEXT_LENGTH) {
        debugLog(`[PDF Extractor] Page ${pageNum} has minimal text, attempting OCR...`);
        
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
          debugLog(`[PDF Extractor] Page ${pageNum} OCR successful: ${ocrText.length} chars`);
        }
      }
      
      textParts.push(pageText);
    }
    
    // Get metadata if available
    let metadata: ExtractionResult['metadata'] = {};
    try {
      const metadataObj = await pdf.getMetadata();
      if (metadataObj?.info) {
        const info = metadataObj.info as Record<string, string>;
        metadata = {
          title: info.Title,
          author: info.Author,
        };
      }
    } catch {
      // Metadata extraction failed, continue without it
    }
    
    const fullText = textParts.join('\n\n');
    debugLog('[PDF Extractor] Extraction complete, total chars:', fullText.length);
    debugLog('[PDF Extractor] OCR was used:', ocrUsed);
    
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
  debugLog('[Image Extractor] Starting OCR for:', file.name);
  
  if (onProgress) {
    onProgress({
      currentPage: 1,
      totalPages: 1,
      percentage: 0,
      status: 'Starting OCR...',
    });
  }
  
  try {
    const Tesseract = await getTesseract();
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
    debugLog('[Image Extractor] OCR complete, extracted:', text.length, 'chars');
    
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

function extractReadableTextFromBinary(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder('latin1');
  const raw = decoder.decode(new Uint8Array(buffer));
  const normalized = raw.replace(/[^\x20-\x7E\r\n]+/g, ' ');
  const chunks = normalized.match(/[A-Za-z][A-Za-z0-9 ,.;:()\-_/]{4,}/g) || [];
  const deduped = Array.from(new Set(chunks.map((chunk) => chunk.trim()))).filter((chunk) => chunk.length > 4 && chunk.length < 240);
  return deduped.join('\n');
}

/**
 * Extract text from .pptx by reading slide XMLs inside the zip.
 * For legacy .ppt, fallback to binary text extraction.
 */
export async function extractTextFromPowerPoint(
  file: File,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<ExtractionResult> {
  const fileName = file.name.toLowerCase();
  const isPptx =
    fileName.endsWith('.pptx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

  if (!isPptx) {
    const legacyBuffer = await file.arrayBuffer();
    const legacyText = extractReadableTextFromBinary(legacyBuffer);
    if (legacyText.trim().length < 120) {
      throw new Error('Legacy .ppt extraction is limited. Please re-save as .pptx for reliable text extraction.');
    }

    if (onProgress) {
      onProgress({ currentPage: 1, totalPages: 1, percentage: 100, status: 'Extracted legacy .ppt content' });
    }

    return {
      text: legacyText,
      pageCount: 1,
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const parser = new DOMParser();

  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/i)?.[1] || '0');
      const nb = Number(b.match(/slide(\d+)\.xml/i)?.[1] || '0');
      return na - nb;
    });

  if (slidePaths.length === 0) {
    throw new Error('No slides found in this .pptx file.');
  }

  const slideTexts: string[] = [];
  for (let i = 0; i < slidePaths.length; i++) {
    const path = slidePaths[i];
    if (onProgress) {
      onProgress({
        currentPage: i + 1,
        totalPages: slidePaths.length,
        percentage: Math.round(((i + 1) / slidePaths.length) * 100),
        status: `Reading slide ${i + 1}...`,
      });
    }

    const xml = await zip.file(path)?.async('text');
    if (!xml) continue;

    const doc = parser.parseFromString(xml, 'application/xml');
    const textNodes = Array.from(doc.getElementsByTagName('a:t'));
    const text = textNodes.map((node) => node.textContent?.trim() || '').filter(Boolean).join(' ');
    if (text) {
      slideTexts.push(`Slide ${i + 1}:\n${text}`);
    }
  }

  const finalText = slideTexts.join('\n\n');
  if (!finalText.trim()) {
    throw new Error('Could not extract readable text from this .pptx file.');
  }

  return {
    text: finalText,
    pageCount: slidePaths.length,
  };
}

/**
 * Main extraction function that handles PDFs, PPT/PPTX, images, and text files
 */
export async function extractText(
  file: File,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<ExtractionResult> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  debugLog('[Extractor] Processing file:', fileName, 'Type:', fileType);
  
  // Handle PDF files
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return extractTextFromPDF(file, onProgress);
  }

  // Handle PowerPoint files
  if (
    fileType === 'application/vnd.ms-powerpoint' ||
    fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    fileName.endsWith('.ppt') ||
    fileName.endsWith('.pptx')
  ) {
    return extractTextFromPowerPoint(file, onProgress);
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
