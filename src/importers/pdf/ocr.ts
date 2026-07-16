import type { ExtractionProgressHandler, PositionedSpan, StoredOcrLanguage } from './pdfTypes.ts';

export interface OcrWordGeometry {
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface OcrBlockGeometry {
    paragraphs: Array<{
        lines: Array<{
            words: OcrWordGeometry[];
        }>;
    }>;
}

interface OcrWorker {
    recognize(
        image: HTMLCanvasElement,
        options?: Record<string, unknown>,
        output?: Record<string, boolean>
    ): Promise<{
        data: {
            text: string;
            confidence: number;
            blocks: OcrBlockGeometry[] | null;
        };
    }>;
    setParameters(parameters: Record<string, string>): Promise<unknown>;
    terminate(): Promise<unknown>;
}

export interface OcrPageResult {
    text: string;
    spans: PositionedSpan[];
    confidence: number;
    language: string;
}

let activeWorker: OcrWorker | null = null;
let activeLanguageCode: string | null = null;
let workerPromise: Promise<OcrWorker> | null = null;
let workerGeneration = 0;
let progressContext: {
    handler?: ExtractionProgressHandler;
    page: number;
    current: number;
    total: number;
} = { page: 0, current: 0, total: 1 };

function languageCode(language: StoredOcrLanguage | 'eng'): string {
    return language === 'eng' ? 'eng' : language.code;
}

async function createOcrWorker(
    language: StoredOcrLanguage | 'eng',
): Promise<OcrWorker> {
    const tesseract = await import('tesseract.js');
    const langs = language === 'eng'
        ? 'eng'
        : [{ code: language.code, data: new Uint8Array(language.bytes) }];
    const base = `${import.meta.env.BASE_URL}vendor/tesseract`;
    const worker = await tesseract.createWorker(langs, tesseract.OEM.LSTM_ONLY, {
        workerPath: `${base}/worker.min.js`,
        corePath: `${base}/core`,
        langPath: `${base}/lang`,
        workerBlobURL: false,
        gzip: true,
        logger: message => {
            if (!progressContext.handler || typeof message.progress !== 'number') return;
            progressContext.handler({
                phase: 'ocr',
                page: progressContext.page,
                current: progressContext.current,
                total: progressContext.total,
                fraction: message.progress,
                message: `${message.status} — page ${progressContext.page}`,
            });
        },
    }) as unknown as OcrWorker;
    try {
        await worker.setParameters({
            tessedit_pageseg_mode: tesseract.PSM.SINGLE_COLUMN,
            preserve_interword_spaces: '1',
            user_defined_dpi: '300',
        });
        return worker;
    } catch (error) {
        await worker.terminate().catch(() => undefined);
        throw error;
    }
}

async function getWorker(
    language: StoredOcrLanguage | 'eng',
): Promise<OcrWorker> {
    const code = languageCode(language);
    if (activeWorker && activeLanguageCode === code) return activeWorker;
    if (workerPromise && activeLanguageCode === code) return workerPromise;
    await disposeOcrWorker();
    const generation = workerGeneration;
    activeLanguageCode = code;
    const pending = createOcrWorker(language);
    workerPromise = pending;
    try {
        const worker = await pending;
        if (generation !== workerGeneration) {
            await worker.terminate().catch(() => undefined);
            throw new DOMException('OCR was cancelled.', 'AbortError');
        }
        activeWorker = worker;
        return worker;
    } finally {
        if (workerPromise === pending) workerPromise = null;
    }
}

export async function recognizeCanvas(
    canvas: HTMLCanvasElement,
    language: StoredOcrLanguage | 'eng',
    onProgress?: ExtractionProgressHandler,
    page = 0,
    current = 1,
    total = 1,
): Promise<OcrPageResult> {
    progressContext = { handler: onProgress, page, current, total };
    const worker = await getWorker(language);
    const result = await worker.recognize(canvas, {}, { text: true, blocks: true });
    const spans = ocrBlocksToPositionedSpans(result.data.blocks ?? [], canvas.width, canvas.height);
    return {
        text: result.data.text,
        spans,
        confidence: result.data.confidence,
        language: languageCode(language),
    };
}

/** Converts Tesseract's word boxes into the same persistent coordinate model as PDF.js text. */
export function ocrBlocksToPositionedSpans(
    blocks: readonly OcrBlockGeometry[],
    canvasWidth: number,
    canvasHeight: number,
): PositionedSpan[] {
    const spans: PositionedSpan[] = [];
    const width = Math.max(canvasWidth, 1);
    const height = Math.max(canvasHeight, 1);
    for (const block of blocks) {
        for (const paragraph of block.paragraphs) {
            for (const line of paragraph.lines) {
                const words = line.words.filter(word => word.text.trim());
                for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
                    const word = words[wordIndex];
                    const box = word.bbox;
                    const wordHeight = (box.y1 - box.y0) / height;
                    spans.push({
                        text: word.text,
                        x: box.x0 / width,
                        y: box.y0 / height,
                        width: (box.x1 - box.x0) / width,
                        height: wordHeight,
                        fontHeight: wordHeight,
                        baseline: box.y1 / height,
                        direction: 'ltr',
                        hasEol: wordIndex === words.length - 1,
                        source: 'ocr',
                        confidence: word.confidence,
                    });
                }
            }
        }
    }
    return spans;
}

export async function disposeOcrWorker(): Promise<void> {
    workerGeneration++;
    const pending = workerPromise;
    workerPromise = null;
    const worker = activeWorker;
    activeWorker = null;
    activeLanguageCode = null;
    try {
        if (worker) await worker.terminate();
        else if (pending) await (await pending).terminate();
    } catch (error) {
        console.warn('Could not terminate the OCR worker cleanly:', error);
    } finally {
        activeWorker = null;
        activeLanguageCode = null;
        progressContext = { page: 0, current: 0, total: 1 };
    }
}
