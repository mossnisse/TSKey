import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';

export interface PositionedSpan {
    text: string;
    /** Normalized, top-origin page coordinates in the range 0..1. */
    x: number;
    y: number;
    width: number;
    height: number;
    fontHeight: number;
    /** Normalized top-origin baseline; OCR uses an estimated baseline. */
    baseline?: number;
    fontName?: string;
    fontFamily?: string;
    direction?: string;
    hasEol?: boolean;
    source?: 'text' | 'ocr';
    confidence?: number;
}

export interface PositionedLineGap {
    afterSpan: number;
    x: number;
    width: number;
    emWidth: number;
    rightX: number;
    leftText: string;
    rightText: string;
}

/** A physical line that retains the geometry used to reconstruct it. */
export interface PositionedLine {
    id: string;
    pageNum: number;
    lineIndex: number;
    columnIndex: number;
    text: string;
    spans: PositionedSpan[];
    gaps: PositionedLineGap[];
    x: number;
    y: number;
    width: number;
    height: number;
    baseline: number;
    fontHeight: number;
    fontFamilies: string[];
    confidence?: number;
    synthetic?: boolean;
}

/** A reconstructed key lead, before it is converted to parser input. */
export interface LogicalKeyLead {
    id: string;
    coupletNum: number;
    kind: 'first' | 'second';
    markerText: string;
    description: string;
    destination: string;
    canonicalText: string;
    startPage: number;
    endPage: number;
    startLine: number;
    endLine: number;
    x: number;
    y: number;
    fontHeight: number;
    confidence?: number;
    lines: PositionedLine[];
}

export type PdfPageStatus = 'inspecting' | 'text' | 'needs-ocr' | 'ocr' | 'failed';

export interface PdfPageState {
    pageNum: number;
    status: PdfPageStatus;
    sourceSpans: PositionedSpan[];
    positionedLines?: PositionedLine[];
    generatedText: string;
    editedText?: string;
    ocrLanguage?: string;
    confidence?: number;
    warning?: string;
}

export interface KeyRegion {
    id: string;
    label: string;
    startPage: number;
    endPage: number;
    startLine: number;
    endLine: number;
    confidence: number;
    text: string;
    leads?: LogicalKeyLead[];
}

export type ExtractionPhase = 'inspect' | 'render' | 'ocr';

export interface ExtractionProgress {
    phase: ExtractionPhase;
    page: number;
    current: number;
    total: number;
    fraction: number;
    message: string;
}

export type ExtractionProgressHandler = (progress: ExtractionProgress) => void;

export interface PdfSession {
    document: PDFDocumentProxy;
    loadingTask: PDFDocumentLoadingTask;
    pageCount: number;
    title: string;
    pages: PdfPageState[];
}

export interface StoredOcrLanguage {
    code: string;
    filename: string;
    bytes: ArrayBuffer;
    addedAt: number;
}

export interface ProcessPdfOptions {
    removeFurniture: boolean;
    forceOcr: boolean;
    language: StoredOcrLanguage | 'eng';
}

export function effectivePageText(page: PdfPageState): string {
    return page.editedText ?? page.generatedText;
}
