import type { KeyStore } from '../../store';
import type { UIStateStore } from '../../uiState.ts';
import { showToast } from '../../uiRenderer.ts';
import { escapeHTML } from '../../utils.ts';
import { commitParsedKey } from '../importCommit.ts';
import { renderImportPreview } from '../importPreview.ts';
import { getKeyDialect, listKeyDialects } from '../keyDialect.ts';
import {
    DEFAULT_PARSE_OPTIONS,
    parsePlainTextKey,
    type PlainTextParseOptions,
    type PlainTextParseResult,
} from '../plainTextImporter.ts';
import { closePdfSession, inspectPdf, processSelectedPages, rebuildSelectedPages, reOcrPage } from './extract.ts';
import { detectKeyRegions, selectPreferredKeyRegion } from './segment.ts';
import { getStoredOcrLanguage, languageCodeFromFilename, listStoredOcrLanguages, saveOcrLanguage } from './ocrLanguageStore.ts';
import { parsePageRange } from './pageRange.ts';
import { effectivePageText, type ExtractionProgress, type KeyRegion, type PdfSession, type StoredOcrLanguage } from './pdfTypes.ts';

const VIEW_ID = 'pdf-import-view';
const MAX_LANGUAGE_FILE_BYTES = 100 * 1024 * 1024;

let session: PdfSession | null = null;
let selectedPages: number[] = [];
let selectedPageNum = 0;
let regions: KeyRegion[] = [];
let latestResult: PlainTextParseResult | null = null;
let operationController: AbortController | null = null;
let generation = 0;
let busy = false;
let autoSelectDetectedRegion = true;
const languages = new Map<string, StoredOcrLanguage>();

function getEl<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

function isOpen(): boolean {
    const view = getEl<HTMLElement>(VIEW_ID);
    return !!view && view.style.display !== 'none';
}

function abortOperation(): void {
    operationController?.abort();
    operationController = null;
}

function startOperation(): AbortSignal {
    abortOperation();
    operationController = new AbortController();
    return operationController.signal;
}

function setBusy(value: boolean): void {
    busy = value;
    ['pdf-import-load-file', 'pdf-import-process', 'pdf-import-force', 'pdf-import-language', 'pdf-import-load-language', 'pdf-import-range']
        .forEach(id => {
            const control = getEl<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>(id);
            if (control) control.disabled = value;
        });
    getEl<HTMLElement>('pdf-import-progress-wrap')?.classList.toggle('is-active', value);
    renderPageList();
    showSelectedPage();
}

function updateProgress(progress: ExtractionProgress): void {
    const bar = getEl<HTMLProgressElement>('pdf-import-progress');
    const label = getEl<HTMLElement>('pdf-import-progress-label');
    if (bar) {
        bar.max = 1;
        const pageBase = progress.total > 0 ? Math.max(0, progress.current - 1) / progress.total : 0;
        // Render/OCR batches report per-page fractions; offset them by the pages
        // already finished so the bar never jumps backwards mid-batch.
        bar.value = (progress.phase === 'ocr' || progress.phase === 'render') && progress.total > 0
            ? Math.min(1, pageBase + progress.fraction / progress.total)
            : progress.fraction;
    }
    if (label) label.textContent = progress.message;
}

function resetProgress(message = ''): void {
    const bar = getEl<HTMLProgressElement>('pdf-import-progress');
    if (bar) bar.value = 0;
    const label = getEl<HTMLElement>('pdf-import-progress-label');
    if (label) label.textContent = message;
}

function gatherOptions(prefix: 'pt' | 'pdf' = 'pdf'): PlainTextParseOptions {
    const checked = (suffix: string, fallback: boolean): boolean => {
        const input = getEl<HTMLInputElement>(`${prefix}-opt-${suffix}`);
        return input?.checked ?? fallback;
    };
    const dots = Number(getEl<HTMLInputElement>(`${prefix}-opt-min-dots`)?.value);
    return {
        minLeaderDots: Number.isFinite(dots) && dots >= 2 ? dots : DEFAULT_PARSE_OPTIONS.minLeaderDots,
        useWhitespaceSeparator: checked('ws', DEFAULT_PARSE_OPTIONS.useWhitespaceSeparator),
        joinWrappedLines: checked('join', DEFAULT_PARSE_OPTIONS.joinWrappedLines),
        dehyphenate: checked('dehyphen', DEFAULT_PARSE_OPTIONS.dehyphenate),
        recognizeLetteredCouplets: checked('lettered', DEFAULT_PARSE_OPTIONS.recognizeLetteredCouplets),
        recognizeDashSecondLead: checked('dash', DEFAULT_PARSE_OPTIONS.recognizeDashSecondLead),
        recognizeBackReferences: checked('backref', DEFAULT_PARSE_OPTIONS.recognizeBackReferences),
        fillMissingCouplets: checked('fill', DEFAULT_PARSE_OPTIONS.fillMissingCouplets),
    };
}

function pageStatusLabel(pageNum: number): string {
    const page = session?.pages[pageNum - 1];
    if (!page) return '';
    let label: string;
    switch (page.status) {
        case 'inspecting': label = 'Inspecting'; break;
        case 'text': label = 'Text layer'; break;
        case 'needs-ocr': label = 'Needs OCR'; break;
        case 'ocr': label = `OCR · ${Math.round(page.confidence ?? 0)}%`; break;
        case 'failed': label = 'OCR failed'; break;
    }
    const edited = page.editedText === undefined ? label : `${label} · Edited`;
    return page.warning ? `${edited} · ⚠` : edited;
}

function renderPageList(): void {
    const container = getEl<HTMLElement>('pdf-import-pages');
    if (!container) return;
    if (!session) {
        container.innerHTML = '<div class="pdf-pages-empty">Load a PDF to inspect its pages.</div>';
        return;
    }
    const selected = new Set(selectedPages);
    container.innerHTML = session.pages.map(page => {
        const active = page.pageNum === selectedPageNum ? ' is-active' : '';
        const included = selected.has(page.pageNum) ? ' is-included' : '';
        const warning = page.warning ? ` title="${escapeHTML(page.warning)}"` : '';
        return `<div class="pdf-page-row${active}${included}" data-page="${page.pageNum}"${warning}>
            <button type="button" class="pdf-page-select" data-action="select-page" data-page="${page.pageNum}">
                <span>Page ${page.pageNum}</span>
                <span class="pdf-page-method pdf-page-method-${page.status}">${escapeHTML(pageStatusLabel(page.pageNum))}</span>
            </button>
            <button type="button" class="btn btn-outline pdf-page-reocr" data-action="reocr" data-page="${page.pageNum}"${busy ? ' disabled' : ''}>Re-OCR</button>
        </div>`;
    }).join('');
}

function showSelectedPage(): void {
    const editor = getEl<HTMLTextAreaElement>('pdf-import-page-text');
    const label = getEl<HTMLElement>('pdf-import-page-label');
    const page = session?.pages[selectedPageNum - 1];
    if (editor) {
        editor.disabled = busy || !page;
        editor.value = page ? effectivePageText(page) : '';
        editor.placeholder = page ? 'No text was extracted from this page.' : 'Select a page to review its text.';
    }
    if (label) label.textContent = page ? `Extracted text · page ${page.pageNum}` : 'Extracted page text';
}

function fullSelectedText(): string {
    if (!session) return '';
    return selectedPages
        .map(pageNum => session!.pages[pageNum - 1])
        .filter(Boolean)
        .map(effectivePageText)
        .filter(text => text.trim())
        .join('\n\n');
}

function selectedRegionText(): string {
    const select = getEl<HTMLSelectElement>('pdf-import-region');
    const id = select?.value || 'full';
    return id === 'full' ? fullSelectedText() : regions.find(region => region.id === id)?.text ?? fullSelectedText();
}

function refreshPreview(): void {
    const preview = getEl<HTMLElement>('pdf-import-preview');
    const status = getEl<HTMLElement>('pdf-import-status');
    const confirmButton = getEl<HTMLButtonElement>('pdf-import-confirm');
    if (!preview) return;
    const source = selectedRegionText();
    if (!source.trim()) {
        latestResult = null;
        preview.innerHTML = '<div class="import-preview-empty">Process pages to see a parsed key preview.</div>';
        if (status) status.textContent = '';
        if (confirmButton) confirmButton.disabled = true;
        return;
    }
    const dialectId = getEl<HTMLSelectElement>('pdf-import-dialect')?.value || 'linear';
    const result = getKeyDialect(dialectId)?.parse(source, gatherOptions())
        ?? parsePlainTextKey(source, gatherOptions());
    latestResult = result;
    const canImport = result.couplets.length > 0 && result.errors.length === 0;
    if (confirmButton) confirmButton.disabled = !canImport;
    if (status) {
        status.textContent = result.errors.length ? '⚠️ Could not parse' : `✓ ${result.stepCount} step(s)`;
        status.className = `import-status ${result.errors.length ? 'import-status-error' : 'import-status-ok'}`;
    }
    preview.innerHTML = renderImportPreview(result);
}

function refreshRegions(): void {
    const select = getEl<HTMLSelectElement>('pdf-import-region');
    const previous = select?.value || 'full';
    if (!session) {
        regions = [];
    } else {
        const hasManualEdits = selectedPages.some(pageNum => session!.pages[pageNum - 1].editedText !== undefined);
        regions = detectKeyRegions(selectedPages.map(pageNum => ({
            pageNum,
            text: effectivePageText(session!.pages[pageNum - 1]),
            lines: hasManualEdits ? undefined : session!.pages[pageNum - 1].positionedLines,
        })));
    }
    if (select) {
        select.replaceChildren();
        const full = document.createElement('option');
        full.value = 'full';
        full.textContent = 'Full selected pages';
        select.append(full);
        regions.forEach(region => {
            const option = document.createElement('option');
            option.value = region.id;
            option.textContent = region.label;
            select.append(option);
        });
        const previousExists = previous !== 'full'
            && [...select.options].some(option => option.value === previous);
        const bestRegion = selectPreferredKeyRegion(regions);
        select.value = previousExists
            ? previous
            : autoSelectDetectedRegion && bestRegion
                ? bestRegion.id
                : 'full';
    }
    refreshPreview();
}

function applyRangeFromInput(showError = true): boolean {
    if (!session) return false;
    const input = getEl<HTMLInputElement>('pdf-import-range');
    const result = parsePageRange(input?.value ?? '', session.pageCount);
    const error = getEl<HTMLElement>('pdf-import-range-error');
    if (error) error.textContent = showError ? result.error ?? '' : '';
    if (result.error) return false;
    selectedPages = result.pages;
    if (!selectedPages.includes(selectedPageNum)) selectedPageNum = selectedPages[0] ?? 0;
    renderPageList();
    showSelectedPage();
    return true;
}

async function selectedLanguage(): Promise<StoredOcrLanguage | 'eng'> {
    const code = getEl<HTMLSelectElement>('pdf-import-language')?.value || 'eng';
    if (code === 'eng') return 'eng';
    const cached = languages.get(code) ?? await getStoredOcrLanguage(code);
    if (!cached) throw new Error(`OCR language "${code}" is no longer available.`);
    languages.set(code, cached);
    return cached;
}

async function refreshLanguageSelect(preferred = 'eng'): Promise<void> {
    const select = getEl<HTMLSelectElement>('pdf-import-language');
    if (!select) return;
    const records = await listStoredOcrLanguages();
    languages.clear();
    records.forEach(record => languages.set(record.code, record));
    select.replaceChildren();
    const english = document.createElement('option');
    english.value = 'eng';
    english.textContent = 'English (bundled)';
    select.append(english);
    records.forEach(record => {
        const option = document.createElement('option');
        option.value = record.code;
        option.textContent = `${record.code} (${record.filename})`;
        select.append(option);
    });
    select.value = [...select.options].some(option => option.value === preferred) ? preferred : 'eng';
}

async function cleanupSession(): Promise<void> {
    abortOperation();
    const old = session;
    session = null;
    selectedPages = [];
    selectedPageNum = 0;
    regions = [];
    latestResult = null;
    autoSelectDetectedRegion = true;
    await closePdfSession(old);
}

export function openPdfImportDialog(): void {
    const view = getEl<HTMLElement>(VIEW_ID);
    if (!view) return;
    view.style.display = 'flex';
    getEl<HTMLButtonElement>('pdf-import-load-file')?.focus();
    void refreshLanguageSelect().catch(error => console.warn('Could not list OCR languages:', error));
}

export function closePdfImportDialog(): void {
    generation++;
    const view = getEl<HTMLElement>(VIEW_ID);
    if (view) view.style.display = 'none';
    void cleanupSession().finally(() => {
        renderPageList();
        showSelectedPage();
        refreshRegions();
        resetProgress();
        setBusy(false);
    });
}

export function setupPdfImporter(
    store: KeyStore,
    uiState: UIStateStore,
    refreshAll: () => void,
    signal: AbortSignal,
): void {
    const fileInput = getEl<HTMLInputElement>('pdf-import-file-hidden');
    const languageInput = getEl<HTMLInputElement>('pdf-import-language-hidden');
    const pageEditor = getEl<HTMLTextAreaElement>('pdf-import-page-text');
    const dialectSelect = getEl<HTMLSelectElement>('pdf-import-dialect');
    if (dialectSelect) {
        dialectSelect.replaceChildren(...listKeyDialects().map(dialect => {
            const option = document.createElement('option');
            option.value = dialect.id;
            option.textContent = dialect.label;
            return option;
        }));
        dialectSelect.value = 'linear';
    }

    getEl('pdf-import-load-file')?.addEventListener('click', () => fileInput?.click(), { signal });
    fileInput?.addEventListener('change', async event => {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        const currentGeneration = ++generation;
        await cleanupSession();
        const operationSignal = startOperation();
        setBusy(true);
        resetProgress(`Reading ${file.name}`);
        try {
            const bytes = await file.arrayBuffer();
            const inspected = await inspectPdf(bytes, operationSignal, updateProgress);
            if (generation !== currentGeneration || operationSignal.aborted) {
                await closePdfSession(inspected);
                return;
            }
            session = inspected;
            autoSelectDetectedRegion = true;
            selectedPages = inspected.pages.map(page => page.pageNum);
            selectedPageNum = selectedPages[0] ?? 0;
            const range = getEl<HTMLInputElement>('pdf-import-range');
            if (range) range.value = inspected.pageCount === 1 ? '1' : `1-${inspected.pageCount}`;
            const title = getEl<HTMLInputElement>('pdf-import-title');
            if (title) title.value = inspected.title || file.name.replace(/\.pdf$/i, '').trim();
            renderPageList();
            showSelectedPage();
            refreshRegions();
            resetProgress(`Inspected ${inspected.pageCount} page(s). Choose a range, then process pages.`);
        } catch (error) {
            if (!operationSignal.aborted) {
                console.error('Could not inspect PDF:', error);
                showToast('⚠️ Could not open or inspect the selected PDF.', 'error');
                resetProgress('PDF inspection failed.');
            }
        } finally {
            if (generation === currentGeneration) setBusy(false);
        }
    }, { signal });

    getEl('pdf-import-process')?.addEventListener('click', async () => {
        if (!session || !applyRangeFromInput()) return;
        const forceOcr = getEl<HTMLInputElement>('pdf-import-force')?.checked ?? false;
        const editedPages = forceOcr
            ? selectedPages.filter(pageNum => session?.pages[pageNum - 1].editedText !== undefined)
            : [];
        if (editedPages.length && !confirm(
            `Force OCR will replace manual edits on ${editedPages.length} selected page(s). Continue?`,
        )) return;
        const operationSignal = startOperation();
        setBusy(true);
        try {
            await processSelectedPages(session, selectedPages, {
                removeFurniture: getEl<HTMLInputElement>('pdf-import-furniture')?.checked ?? true,
                forceOcr,
                language: await selectedLanguage(),
            }, operationSignal, updateProgress);
            renderPageList();
            showSelectedPage();
            refreshRegions();
            resetProgress('Selected pages are ready for review.');
        } catch (error) {
            if (!operationSignal.aborted) {
                console.error('PDF page processing failed:', error);
                showToast('⚠️ Could not finish processing the selected pages.', 'error');
            }
        } finally {
            setBusy(false);
        }
    }, { signal });

    getEl('pdf-import-pages')?.addEventListener('click', async event => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
        if (!button || !session) return;
        const pageNum = Number(button.dataset.page);
        if (!Number.isInteger(pageNum)) return;
        if (button.dataset.action === 'select-page') {
            selectedPageNum = pageNum;
            renderPageList();
            showSelectedPage();
            return;
        }
        if (busy) return;
        const page = session.pages[pageNum - 1];
        if (page.editedText !== undefined && !confirm(`Page ${pageNum} has manual edits. Replace them with a new OCR result?`)) return;
        const operationSignal = startOperation();
        setBusy(true);
        try {
            await reOcrPage(
                session,
                pageNum,
                await selectedLanguage(),
                getEl<HTMLInputElement>('pdf-import-furniture')?.checked ?? true,
                operationSignal,
                updateProgress,
                selectedPages,
            );
            selectedPageNum = pageNum;
            renderPageList();
            showSelectedPage();
            refreshRegions();
            resetProgress(`Page ${pageNum} was re-OCRed.`);
        } catch (error) {
            if (!operationSignal.aborted) {
                console.error(`Could not re-OCR page ${pageNum}:`, error);
                showToast(`⚠️ Could not re-OCR page ${pageNum}; its previous text was kept.`, 'error');
            }
        } finally {
            setBusy(false);
        }
    }, { signal });

    pageEditor?.addEventListener('input', () => {
        const page = session?.pages[selectedPageNum - 1];
        if (!page) return;
        page.editedText = pageEditor.value === page.generatedText ? undefined : pageEditor.value;
        renderPageList();
        refreshRegions();
    }, { signal });

    getEl<HTMLInputElement>('pdf-import-range')?.addEventListener('change', () => {
        if (busy) return;
        if (applyRangeFromInput()) {
            autoSelectDetectedRegion = true;
            refreshRegions();
        }
    }, { signal });

    getEl<HTMLInputElement>('pdf-import-furniture')?.addEventListener('change', () => {
        if (busy || !session || !selectedPages.length) return;
        rebuildSelectedPages(
            session,
            selectedPages,
            getEl<HTMLInputElement>('pdf-import-furniture')?.checked ?? true,
        );
        showSelectedPage();
        refreshRegions();
    }, { signal });

    getEl('pdf-import-load-language')?.addEventListener('click', () => languageInput?.click(), { signal });
    languageInput?.addEventListener('change', async event => {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        const code = languageCodeFromFilename(file.name);
        if (!code) {
            showToast('⚠️ Language files must be named CODE.traineddata or CODE.traineddata.gz.', 'error');
            return;
        }
        if (file.size === 0 || file.size > MAX_LANGUAGE_FILE_BYTES) {
            showToast('⚠️ The OCR language file is empty or larger than 100 MB.', 'error');
            return;
        }
        if (languages.has(code) && !confirm(`Replace the stored "${code}" OCR language?`)) return;
        try {
            const record: StoredOcrLanguage = {
                code,
                filename: file.name,
                bytes: await file.arrayBuffer(),
                addedAt: Date.now(),
            };
            await saveOcrLanguage(record);
            await refreshLanguageSelect(code);
            showToast(`✓ Loaded local OCR language "${code}".`, 'success');
        } catch (error) {
            console.error('Could not store OCR language:', error);
            showToast('⚠️ Could not store the OCR language file.', 'error');
        }
    }, { signal });

    getEl('pdf-import-region')?.addEventListener('change', () => {
        autoSelectDetectedRegion = false;
        refreshPreview();
    }, { signal });

    ['pdf-import-dialect', 'pdf-opt-min-dots', 'pdf-opt-ws', 'pdf-opt-join',
        'pdf-opt-dehyphen', 'pdf-opt-lettered', 'pdf-opt-dash', 'pdf-opt-backref', 'pdf-opt-fill']
        .forEach(id => {
            const el = getEl(id);
            // One event per control: 'input' for live text entry, 'change' for
            // checkboxes/selects (which would otherwise fire both and re-parse twice).
            const isTextEntry = el instanceof HTMLInputElement && el.type !== 'checkbox';
            el?.addEventListener(isTextEntry ? 'input' : 'change', refreshPreview, { signal });
        });

    getEl('pdf-import-confirm')?.addEventListener('click', async () => {
        if (!latestResult) return;
        const outcome = await commitParsedKey({
            store,
            uiState,
            refreshAll,
            result: latestResult,
            title: getEl<HTMLInputElement>('pdf-import-title')?.value || 'Imported Key',
            sourceLabel: 'PDF',
        });
        if (outcome === 'saved' || outcome === 'imported-unsaved') closePdfImportDialog();
    }, { signal });

    getEl('pdf-import-close')?.addEventListener('click', closePdfImportDialog, { signal });
    getEl('pdf-import-cancel')?.addEventListener('click', closePdfImportDialog, { signal });
    getEl(VIEW_ID)?.addEventListener('keydown', event => {
        if ((event as KeyboardEvent).key === 'Escape' && isOpen()) {
            event.stopPropagation();
            closePdfImportDialog();
        }
    }, { signal });
    signal.addEventListener('abort', () => {
        generation++;
        void cleanupSession();
    }, { once: true });
}
