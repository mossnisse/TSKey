import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { findRepeatedFurniture, findSharedColumnGutter, reconstructPage } from './layout.ts';
import { disposeOcrWorker, recognizeCanvas } from './ocr.ts';
import { textItemToPositionedSpan } from './pdfTextLayer.ts';
import { assessTextQuality } from './textQuality.ts';
import type {
    ExtractionProgressHandler,
    PdfPageState,
    PdfSession,
    ProcessPdfOptions,
    StoredOcrLanguage,
} from './pdfTypes.ts';

const OCR_DPI = 300;
const PDF_DPI = 72;
const MAX_OCR_PIXELS = 16_000_000;

function abortError(): DOMException {
    return new DOMException('PDF import was cancelled.', 'AbortError');
}

function ensureNotAborted(signal: AbortSignal): void {
    if (signal.aborted) throw abortError();
}

function report(
    onProgress: ExtractionProgressHandler | undefined,
    phase: 'inspect' | 'render' | 'ocr',
    page: number,
    current: number,
    total: number,
    fraction: number,
    message: string,
): void {
    onProgress?.({ phase, page, current, total, fraction, message });
}

function applyLayout(session: PdfSession, pageNumbers: readonly number[], removeFurniture: boolean): void {
    const selected = pageNumbers
        .map(pageNum => session.pages[pageNum - 1])
        .filter((page): page is PdfPageState => !!page)
        .map(page => ({ pageNum: page.pageNum, spans: page.sourceSpans }));
    const furniture = removeFurniture ? findRepeatedFurniture(selected) : new Set<string>();
    const sharedColumnGutter = findSharedColumnGutter(selected);
    for (const pageNum of pageNumbers) {
        const page = session.pages[pageNum - 1];
        if (!page || page.status === 'failed' || page.editedText !== undefined || !page.sourceSpans.length) continue;
        const reconstructed = reconstructPage(page.sourceSpans, {
            pageNum,
            removeFurniture,
            repeatedFurniture: furniture,
            columnGutter: sharedColumnGutter ?? undefined,
        });
        page.generatedText = reconstructed.text;
        page.positionedLines = reconstructed.positionedLines;
        page.warning = reconstructed.warnings.join(' ') || undefined;
    }
}

/** Regenerates extracted page text from existing spans without loading OCR. Manual edits are untouched. */
export function rebuildSelectedPages(
    session: PdfSession,
    pageNumbers: readonly number[],
    removeFurniture: boolean,
): void {
    applyLayout(session, pageNumbers, removeFurniture);
}

/** Loads a PDF and inspects embedded text on every page without starting OCR. */
export async function inspectPdf(
    bytes: ArrayBuffer,
    signal: AbortSignal,
    onProgress?: ExtractionProgressHandler,
): Promise<PdfSession> {
    ensureNotAborted(signal);
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const base = `${import.meta.env.BASE_URL}vendor/pdfjs/`;
    const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(bytes),
        cMapUrl: `${base}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${base}standard_fonts/`,
        wasmUrl: `${base}wasm/`,
        iccUrl: `${base}iccs/`,
    });
    const abortLoading = () => { void loadingTask.destroy(); };
    signal.addEventListener('abort', abortLoading, { once: true });
    loadingTask.onPassword = (updatePassword: (password: string) => void, reason: number): void => {
        const password = prompt(reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD
            ? 'That password was incorrect. Enter the PDF password:'
            : 'This PDF is password-protected. Enter its password:');
        if (password === null) void loadingTask.destroy();
        else updatePassword(password);
    };

    try {
        const document = await loadingTask.promise;
        const metadata = await document.getMetadata().catch(() => null);
        const info = metadata?.info as { Title?: unknown } | undefined;
        const title = typeof info?.Title === 'string' ? info.Title.trim() : '';
        const pages: PdfPageState[] = [];
        for (let pageNum = 1; pageNum <= document.numPages; pageNum++) {
            ensureNotAborted(signal);
            report(onProgress, 'inspect', pageNum, pageNum, document.numPages, (pageNum - 1) / document.numPages, `Inspecting page ${pageNum}`);
            const page = await document.getPage(pageNum);
            try {
                const viewport = page.getViewport({ scale: 1 });
                const content = await page.getTextContent();
                const spans = content.items
                    .filter((item): item is TextItem => 'str' in item && !!item.str.trim())
                    .map(item => textItemToPositionedSpan(
                        item,
                        viewport,
                        pdfjs.Util.transform,
                        content.styles[item.fontName],
                    ));
                const reconstructed = reconstructPage(spans, { pageNum, removeFurniture: false });
                const quality = assessTextQuality(reconstructed.text);
                pages.push({
                    pageNum,
                    status: quality.usable ? 'text' : 'needs-ocr',
                    sourceSpans: spans,
                    positionedLines: reconstructed.positionedLines,
                    generatedText: reconstructed.text,
                    warning: reconstructed.warnings.join(' ') || undefined,
                });
            } finally {
                page.cleanup();
            }
        }
        const session: PdfSession = {
            document,
            loadingTask,
            pageCount: document.numPages,
            title,
            pages,
        };
        applyLayout(session, pages.map(page => page.pageNum), true);
        report(onProgress, 'inspect', document.numPages, document.numPages, document.numPages, 1, 'PDF inspection complete');
        return session;
    } catch (error) {
        await loadingTask.destroy().catch(() => undefined);
        if (signal.aborted) throw abortError();
        throw error;
    } finally {
        signal.removeEventListener('abort', abortLoading);
    }
}

async function renderAndOcrPage(
    session: PdfSession,
    pageNum: number,
    language: StoredOcrLanguage | 'eng',
    signal: AbortSignal,
    onProgress?: ExtractionProgressHandler,
    ordinal = 1,
    total = 1,
): Promise<void> {
    ensureNotAborted(signal);
    const page = await session.document.getPage(pageNum);
    let canvas: HTMLCanvasElement | null = null;
    try {
        const baseViewport = page.getViewport({ scale: OCR_DPI / PDF_DPI });
        const pixels = baseViewport.width * baseViewport.height;
        const scaleAdjustment = pixels > MAX_OCR_PIXELS ? Math.sqrt(MAX_OCR_PIXELS / pixels) : 1;
        const viewport = page.getViewport({ scale: (OCR_DPI / PDF_DPI) * scaleAdjustment });
        canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('The browser could not create a page canvas for OCR.');
        report(onProgress, 'render', pageNum, ordinal, total, 0, `Rendering page ${pageNum}`);
        const renderTask = page.render({ canvasContext: context, viewport, canvas });
        const cancelRender = () => renderTask.cancel();
        signal.addEventListener('abort', cancelRender, { once: true });
        try {
            await renderTask.promise;
        } finally {
            signal.removeEventListener('abort', cancelRender);
        }
        ensureNotAborted(signal);
        report(onProgress, 'ocr', pageNum, ordinal, total, 0, `Recognizing page ${pageNum}`);
        const cancelOcr = () => { void disposeOcrWorker(); };
        signal.addEventListener('abort', cancelOcr, { once: true });
        let result;
        try {
            result = await recognizeCanvas(canvas, language, onProgress, pageNum, ordinal, total);
        } finally {
            signal.removeEventListener('abort', cancelOcr);
        }
        ensureNotAborted(signal);
        const state = session.pages[pageNum - 1];
        state.sourceSpans = result.spans;
        state.positionedLines = undefined;
        state.generatedText = result.text;
        state.editedText = undefined;
        state.status = 'ocr';
        state.ocrLanguage = result.language;
        state.confidence = result.confidence;
        state.warning = undefined;
    } finally {
        if (canvas) {
            canvas.width = 1;
            canvas.height = 1;
            canvas.remove();
        }
        page.cleanup();
    }
}

/** OCRs only unusable selected pages unless forceOcr is enabled. */
export async function processSelectedPages(
    session: PdfSession,
    pageNumbers: readonly number[],
    options: ProcessPdfOptions,
    signal: AbortSignal,
    onProgress?: ExtractionProgressHandler,
): Promise<void> {
    const targets = pageNumbers.filter(pageNum => {
        const page = session.pages[pageNum - 1];
        return !!page && (options.forceOcr
            || (page.editedText === undefined && (page.status === 'needs-ocr' || page.status === 'failed')));
    });
    for (let index = 0; index < targets.length; index++) {
        const pageNum = targets[index];
        const state = session.pages[pageNum - 1];
        try {
            await renderAndOcrPage(session, pageNum, options.language, signal, onProgress, index + 1, targets.length);
        } catch (error) {
            if (signal.aborted) throw abortError();
            console.error(`OCR failed for PDF page ${pageNum}:`, error);
            state.status = 'failed';
            state.warning = error instanceof Error ? error.message : String(error);
        }
    }
    applyLayout(session, pageNumbers, options.removeFurniture);
}

/** Forces a fresh OCR result for one page, preserving the prior result if OCR fails. */
export async function reOcrPage(
    session: PdfSession,
    pageNum: number,
    language: StoredOcrLanguage | 'eng',
    removeFurniture: boolean,
    signal: AbortSignal,
    onProgress?: ExtractionProgressHandler,
    layoutPageNumbers: readonly number[] = session.pages.map(page => page.pageNum),
): Promise<void> {
    const current = session.pages[pageNum - 1];
    if (!current) throw new Error(`Page ${pageNum} does not exist.`);
    const snapshot = { ...current, sourceSpans: [...current.sourceSpans] };
    try {
        await renderAndOcrPage(session, pageNum, language, signal, onProgress);
        applyLayout(session, layoutPageNumbers, removeFurniture);
    } catch (error) {
        Object.assign(current, snapshot);
        throw error;
    }
}

export async function closePdfSession(session: PdfSession | null): Promise<void> {
    await disposeOcrWorker();
    if (!session) return;
    await session.loadingTask.destroy().catch(() => undefined);
}
