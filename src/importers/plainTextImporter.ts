// plainTextImporter.ts
//
// Imports a dichotomous key from a plain-text document. This is the inverse of
// exporters/plainTextExporter.ts and is tolerant of light hand-editing of that
// format. The heavy lifting lives here so the parser can grow independently of
// the event wiring in eventController.ts.
//
// Expected source layout (tab-delimited, as produced by the plain text exporter):
//
//   1.<TAB>First alternative description<TAB>Destination
//   —<TAB>Second alternative description<TAB>Destination
//   <blank line>
//   2.<TAB>...
//
// A "Destination" is either a step number (→ link) or a taxon name (→ taxa).
// "..." marks an empty destination and "___" marks an empty description.
// An optional "FIGURES DATA" appendix is parsed into figure records.

import type { Branch, Couplet, Figure, KeyStore } from '../store.ts';
import type { UIStateStore } from '../uiState.ts';
import { APP_NAME, APP_VERSION, diagnoseKey } from '../store.ts';
import { showToast } from '../uiRenderer.ts';
import { escapeHTML } from '../utils.ts';
import { workspaceStorage } from '../db.ts';

const EMPTY_DEST_TOKEN = '...';
const EMPTY_ALT_TOKEN = '___';

// ==========================================
// CHARACTER ENCODING (pure — no DOM, no store)
// ==========================================

/**
 * Encodings the file loader can decode. 'auto' sniffs a BOM, then a UTF-16
 * null-byte pattern, then validates UTF-8, finally falling back to Windows-1252
 * (a superset of Latin-1) for legacy single-byte text.
 */
export type TextEncodingChoice =
    | 'auto'
    | 'utf-8'
    | 'utf-16le'
    | 'utf-16be'
    | 'windows-1252';

export interface DecodeResult {
    text: string;
    /** The encoding actually used (the resolved label when choice was 'auto'). */
    encoding: Exclude<TextEncodingChoice, 'auto'>;
    /** True when the encoding was auto-detected rather than chosen explicitly. */
    autoDetected: boolean;
}

/** Human-readable label for an encoding, used in status messages. */
export function encodingLabel(encoding: TextEncodingChoice): string {
    switch (encoding) {
        case 'auto': return 'Auto-detect';
        case 'utf-8': return 'UTF-8';
        case 'utf-16le': return 'UTF-16 LE';
        case 'utf-16be': return 'UTF-16 BE';
        case 'windows-1252': return 'Windows-1252 / Latin-1';
    }
}

/** Detects a leading byte-order mark, if any. */
function sniffBom(bytes: Uint8Array): Exclude<TextEncodingChoice, 'auto'> | null {
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
        return 'utf-8';
    }
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
        return 'utf-16le';
    }
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
        return 'utf-16be';
    }
    return null;
}

/**
 * Best-effort encoding detection for files without a BOM. UTF-16 is recognized
 * by its dense null bytes (every ASCII char carries a zero high byte); the lane
 * the nulls fall in gives the endianness. Otherwise we trust valid UTF-8 and
 * treat anything that fails strict UTF-8 validation as legacy Windows-1252.
 */
function detectEncoding(bytes: Uint8Array): Exclude<TextEncodingChoice, 'auto'> {
    const bom = sniffBom(bytes);
    if (bom) return bom;

    const sample = Math.min(bytes.length, 4096);
    let evenNul = 0;
    let oddNul = 0;
    for (let i = 0; i < sample; i++) {
        if (bytes[i] === 0) {
            if (i % 2 === 0) evenNul++; else oddNul++;
        }
    }
    if (sample > 0 && (evenNul + oddNul) / sample > 0.2) {
        // NULs in odd lanes => low-byte-first => little-endian.
        return oddNul > evenNul ? 'utf-16le' : 'utf-16be';
    }

    try {
        new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        return 'utf-8';
    } catch {
        return 'windows-1252';
    }
}

/**
 * Decodes raw file bytes into text using the chosen encoding, resolving 'auto'
 * by sniffing. TextDecoder strips a leading BOM for the UTF labels, so the
 * returned text is clean regardless of how the file was saved.
 */
export function decodeBytes(buffer: ArrayBuffer, choice: TextEncodingChoice): DecodeResult {
    const bytes = new Uint8Array(buffer);
    const encoding = choice === 'auto' ? detectEncoding(bytes) : choice;
    const text = new TextDecoder(encoding).decode(buffer);
    return { text, encoding, autoDetected: choice === 'auto' };
}

// Safety ceiling: if numbering implies more couplets than this we assume a
// misparse rather than generating runaway empty couplets.
const MAX_COUPLET_NUMBER = 500;

export interface PlainTextParseOptions {
    /** Minimum consecutive dots that count as a dotted leader (clamped to >= 2). */
    minLeaderDots: number;
    /** Fall back to a run of 2+ spaces (or a tab) as the text/destination separator. */
    useWhitespaceSeparator: boolean;
    /** Merge un-marked physical lines into the lead they continue (PDF line wrapping). */
    joinWrappedLines: boolean;
    /** Re-join words split with a trailing hyphen at a line break ("of-\\nten" -> "often"). */
    dehyphenate: boolean;
    /** Recognize lettered couplets such as "1a" / "1b". */
    recognizeLetteredCouplets: boolean;
    /** Recognize a leading dash ( - – — ) as the second alternative of a couplet. */
    recognizeDashSecondLead: boolean;
    /** Generate empty couplets for any step numbers missing from the source. */
    fillMissingCouplets: boolean;
}

export const DEFAULT_PARSE_OPTIONS: PlainTextParseOptions = {
    minLeaderDots: 3,
    useWhitespaceSeparator: true,
    joinWrappedLines: true,
    dehyphenate: true,
    recognizeLetteredCouplets: true,
    recognizeDashSecondLead: true,
    fillMissingCouplets: true,
};

export interface PlainTextParseResult {
    couplets: Couplet[];
    figures: Figure[];
    warnings: string[];
    errors: string[];
    /** Number of couplets in the resulting key (including generated empty ones). */
    stepCount: number;
}

// ==========================================
// PARSER (pure — no DOM, no store)
// ==========================================

/** Normalizes an alternative-description cell, mapping the empty placeholder to ''. */
function cleanAltText(raw: string | undefined): string {
    const trimmed = (raw ?? '').replace(/\s+/g, ' ').trim();
    return trimmed === EMPTY_ALT_TOKEN ? '' : trimmed;
}

/**
 * Strips the optional "FIGURES DATA" appendix from the body. Figures are not
 * imported from plain text, but the appendix must not be parsed as key steps.
 */
function stripFiguresAppendix(lines: string[]): string[] {
    const figureHeaderIdx = lines.findIndex(l => l.trim().toUpperCase() === 'FIGURES DATA');
    if (figureHeaderIdx === -1) return lines;
    return lines.slice(0, figureHeaderIdx).filter(l => !/^=+$/.test(l.trim()));
}

interface LeadMarker {
    kind: 'first' | 'second';
    /** Couplet number for numbered/lettered leads; null for dash leads (use current). */
    coupletNum: number | null;
    /** Text that follows the marker on the same line. */
    rest: string;
}

/**
 * Detects whether a line opens a new lead and, if so, classifies it.
 * Returns null for continuation/plain text lines.
 */
function parseMarker(line: string, opts: PlainTextParseOptions): LeadMarker | null {
    // Numbered or lettered lead: "1", "1.", "1)", "12", "1a", "1b.", etc.
    // The marker must be followed by whitespace then text, which keeps wrapped
    // continuations like "3F) on inner side" from being mistaken for markers.
    const letterClass = opts.recognizeLetteredCouplets ? '([a-bA-B])?' : '()?';
    const numbered = line.match(new RegExp(`^\\s*(\\d{1,4})\\s*${letterClass}\\s*[.)]?\\s+(\\S.*)$`));
    if (numbered) {
        const num = parseInt(numbered[1], 10);
        const letter = (numbered[2] || '').toLowerCase();
        const rest = numbered[3];
        if (opts.recognizeLetteredCouplets && letter === 'b') {
            return { kind: 'second', coupletNum: num, rest };
        }
        // 'a' (or no letter) opens the first alternative.
        return { kind: 'first', coupletNum: num, rest };
    }

    if (opts.recognizeDashSecondLead) {
        const dashed = line.match(/^\s*[-–—]\s+(\S.*)$/);
        if (dashed) {
            return { kind: 'second', coupletNum: null, rest: dashed[1] };
        }
    }

    return null;
}

/** Joins a continuation line onto the accumulated body, optionally de-hyphenating. */
function joinContinuation(body: string, line: string, opts: PlainTextParseOptions): string {
    const left = body.replace(/\s+$/, '');
    const right = line.trim();
    if (opts.dehyphenate && /[A-Za-zÀ-ÿ]-$/.test(left)) {
        return left.slice(0, -1) + right;
    }
    return `${left} ${right}`;
}

/**
 * Splits a lead body into its description text and its raw destination, using
 * the strongest available separator: tab, then dotted leader, then wide
 * whitespace, then a trailing number.
 */
function splitBody(body: string, opts: PlainTextParseOptions): { text: string; dest: string } {
    // 1. Tab — the strongest signal (used by our own exporter).
    const tabIdx = body.lastIndexOf('\t');
    if (tabIdx !== -1) {
        return { text: body.slice(0, tabIdx), dest: body.slice(tabIdx + 1) };
    }

    // 2. Dotted leader (a run of dots, optionally single-spaced).
    const minDots = Math.max(2, Math.floor(opts.minLeaderDots) || 2);
    const leaderRe = new RegExp(`\\.(?:\\s?\\.){${minDots - 1},}`, 'g');
    let leader: RegExpExecArray | null = null;
    let m: RegExpExecArray | null;
    while ((m = leaderRe.exec(body)) !== null) leader = m;
    if (leader) {
        return { text: body.slice(0, leader.index), dest: body.slice(leader.index + leader[0].length) };
    }

    // 3. Wide whitespace (2+ spaces).
    if (opts.useWhitespaceSeparator) {
        const wsRe = /\s{2,}/g;
        let ws: RegExpExecArray | null = null;
        while ((m = wsRe.exec(body)) !== null) ws = m;
        if (ws) {
            return { text: body.slice(0, ws.index), dest: body.slice(ws.index + ws[0].length) };
        }
    }

    // 4. A bare trailing number (e.g. "... inner side 6").
    const trailing = body.match(/^(.*\S)\s+(\d{1,4})\.?\s*$/);
    if (trailing) {
        return { text: trailing[1], dest: trailing[2] };
    }

    return { text: body, dest: '' };
}

/** Classifies a raw destination string into a couplet-number link or a taxon name. */
function classifyDest(dest: string): { linkNum: number; taxa: string } {
    const trimmed = dest.trim();
    if (trimmed === '' || trimmed === EMPTY_DEST_TOKEN || /^[.\s]+$/.test(trimmed)) {
        return { linkNum: 0, taxa: '' };
    }
    const numMatch = trimmed.match(/^(\d{1,4})\.?$/);
    if (numMatch) {
        return { linkNum: parseInt(numMatch[1], 10), taxa: '' };
    }
    return { linkNum: 0, taxa: trimmed };
}

interface CoupletAccumulator {
    alt1: string; link1: number; taxa1: string;
    alt2: string; link2: number; taxa2: string;
}

function emptyAccumulator(): CoupletAccumulator {
    return { alt1: '', link1: 0, taxa1: '', alt2: '', link2: 0, taxa2: '' };
}

/**
 * Folds a parsed (link, taxa) pair into a Branch. The couplet number doubles as
 * the internal id: a numeric link resolves only if the target couplet exists,
 * otherwise it degrades to an unresolved reference so the editor flags it.
 */
function accToBranch(link: number, taxa: string, present: Set<number>): Branch {
    if (link) {
        return present.has(link)
            ? { kind: 'linked', targetId: link }
            : { kind: 'unresolved', couplet: link };
    }
    const trimmed = taxa.trim();
    if (trimmed === '') return { kind: 'empty' };
    if (/^\d+$/.test(trimmed)) return { kind: 'unresolved', couplet: parseInt(trimmed, 10) };
    return { kind: 'taxon', name: trimmed };
}

/**
 * Parses a plain-text dichotomous key into store-ready couplet records.
 *
 * Uses the couplet number as the internal id and (optionally) generates empty
 * couplets for any numbers missing from the source so destination links never
 * dangle. Tolerant of real-world keys: dot leaders, wrapped/PDF line breaks,
 * lettered (1a/1b) or dash second leads, and assorted whitespace.
 *
 * The result is best-effort — the imported key may still need manual cleanup.
 */
export function parsePlainTextKey(
    raw: string,
    options: Partial<PlainTextParseOptions> = {}
): PlainTextParseResult {
    const opts: PlainTextParseOptions = { ...DEFAULT_PARSE_OPTIONS, ...options };
    const warnings: string[] = [];
    const errors: string[] = [];

    const lines = stripFiguresAppendix((raw ?? '').replace(/\r\n?/g, '\n').split('\n'));

    // --- Pass 1: state machine collects leads, joining wrapped lines ---------
    interface Lead { num: number; isSecond: boolean; body: string; }
    const leads: Lead[] = [];
    let current: Lead | null = null;
    let lastCoupletNum = 0;
    let droppedContinuations = 0;

    const finalize = () => {
        if (current) { leads.push(current); current = null; }
    };

    for (const line of lines) {
        if (line.trim() === '') continue;

        const marker = parseMarker(line, opts);
        if (marker) {
            finalize();
            if (marker.kind === 'first') {
                lastCoupletNum = marker.coupletNum!;
                current = { num: marker.coupletNum!, isSecond: false, body: marker.rest };
            } else {
                const num = marker.coupletNum ?? lastCoupletNum;
                if (num === 0) {
                    warnings.push(`Ignored a second-alternative line before any numbered step: "${line.trim().slice(0, 50)}"`);
                    continue;
                }
                if (marker.coupletNum !== null) {
                    lastCoupletNum = marker.coupletNum;
                }
                current = { num, isSecond: true, body: marker.rest };
            }
            continue;
        }

        // Continuation / un-marked line.
        if (current && opts.joinWrappedLines) {
            current.body = joinContinuation(current.body, line, opts);
        } else if (current) {
            droppedContinuations++;
        }
        // Lines before the first marker are preamble and silently ignored.
    }
    finalize();

    if (leads.length === 0) {
        errors.push('No key steps were recognized. Each step should start with a number (e.g. "1." or "1a") or a dash for the second alternative.');
        return { couplets: [], figures: [], warnings, errors, stepCount: 0 };
    }

    if (droppedContinuations > 0) {
        warnings.push(`${droppedContinuations} wrapped line(s) were dropped because "Join wrapped lines" is off.`);
    }

    // --- Pass 2: fold leads into couplets keyed by couplet number ------------
    const byNum = new Map<number, CoupletAccumulator>();
    const ensure = (num: number): CoupletAccumulator => {
        let acc = byNum.get(num);
        if (!acc) { acc = emptyAccumulator(); byNum.set(num, acc); }
        return acc;
    };

    let maxNum = 0;
    let cappedLink = false;

    for (const lead of leads) {
        if (lead.num > MAX_COUPLET_NUMBER) {
            warnings.push(`Step number ${lead.num} exceeds the safety ceiling of ${MAX_COUPLET_NUMBER} and was skipped.`);
            continue;
        }

        maxNum = Math.max(maxNum, lead.num);
        const { text, dest } = splitBody(lead.body, opts);
        let { linkNum, taxa } = classifyDest(dest);

        if (linkNum > MAX_COUPLET_NUMBER) {
            // Implausible link target — keep the raw number as an unresolved taxon.
            taxa = String(linkNum);
            linkNum = 0;
            cappedLink = true;
        }
        maxNum = Math.max(maxNum, linkNum);

        const acc = ensure(lead.num);
        if (!lead.isSecond) {
            if (acc.alt1 || acc.taxa1 || acc.link1) {
                warnings.push(`Couplet ${lead.num} has more than one first alternative; the later one overwrote the earlier.`);
            }
            acc.alt1 = cleanAltText(text);
            acc.link1 = linkNum;
            acc.taxa1 = taxa;
        } else {
            acc.alt2 = cleanAltText(text);
            acc.link2 = linkNum;
            acc.taxa2 = taxa;
        }
    }

    if (cappedLink) {
        warnings.push('One or more destination numbers were too large to be real step links and were kept as text.');
    }

    maxNum = Math.min(maxNum, MAX_COUPLET_NUMBER);

    if (opts.fillMissingCouplets) {
        let generated = 0;
        for (let i = 1; i <= maxNum; i++) {
            if (!byNum.has(i)) { ensure(i); generated++; }
        }
        if (generated > 0) {
            warnings.push(`Generated ${generated} empty key step(s) to fill gaps so links resolve.`);
        }
    }

    const numbers = [...byNum.keys()].sort((a, b) => a - b);
    const present = new Set(numbers);

    const couplets: Couplet[] = numbers.map(num => {
        const acc = byNum.get(num)!;
        return {
            id: num,
            alt1: acc.alt1, alt2: acc.alt2,
            branch1: accToBranch(acc.link1, acc.taxa1, present),
            branch2: accToBranch(acc.link2, acc.taxa2, present),
        };
    });

    return { couplets, figures: [], warnings, errors, stepCount: couplets.length };
}

// ==========================================
// DIALOG CONTROLLER (DOM wiring)
// ==========================================

const VIEW_ID = 'plain-text-import-view';

let latestResult: PlainTextParseResult | null = null;

// Retains the most recently loaded file's bytes so the user can re-decode it
// with a different encoding without reloading from disk. Cleared once the user
// edits the textarea, so manual changes are never clobbered by a re-decode.
let lastLoadedBuffer: ArrayBuffer | null = null;

function getEl<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

/** Reads the current parser options from the dialog's controls. */
function gatherOptions(): PlainTextParseOptions {
    const checked = (id: string, fallback: boolean): boolean => {
        const el = getEl<HTMLInputElement>(id);
        return el ? el.checked : fallback;
    };
    const minDotsEl = getEl<HTMLInputElement>('pt-opt-min-dots');
    const minLeaderDots = minDotsEl && minDotsEl.value !== ''
        ? parseInt(minDotsEl.value, 10)
        : DEFAULT_PARSE_OPTIONS.minLeaderDots;

    return {
        minLeaderDots: Number.isFinite(minLeaderDots) ? minLeaderDots : DEFAULT_PARSE_OPTIONS.minLeaderDots,
        useWhitespaceSeparator: checked('pt-opt-ws', DEFAULT_PARSE_OPTIONS.useWhitespaceSeparator),
        joinWrappedLines: checked('pt-opt-join', DEFAULT_PARSE_OPTIONS.joinWrappedLines),
        dehyphenate: checked('pt-opt-dehyphen', DEFAULT_PARSE_OPTIONS.dehyphenate),
        recognizeLetteredCouplets: checked('pt-opt-lettered', DEFAULT_PARSE_OPTIONS.recognizeLetteredCouplets),
        recognizeDashSecondLead: checked('pt-opt-dash', DEFAULT_PARSE_OPTIONS.recognizeDashSecondLead),
        fillMissingCouplets: checked('pt-opt-fill', DEFAULT_PARSE_OPTIONS.fillMissingCouplets),
    };
}

/** Reads the encoding chosen in the dialog, defaulting to auto-detect. */
function getEncodingChoice(): TextEncodingChoice {
    const el = getEl<HTMLSelectElement>('pt-import-encoding');
    return (el?.value as TextEncodingChoice) || 'auto';
}

/** Opens the full-window import dialog, anchored directly under the menu bar. */
export function openPlainTextImportDialog(): void {
    const view = getEl<HTMLElement>(VIEW_ID);
    if (!view) return;

    view.style.display = 'flex';

    const textarea = getEl<HTMLTextAreaElement>('pt-import-source');
    textarea?.focus();
    refreshPreview();
}

/** Hides the import dialog. Does not mutate the workspace. */
export function closePlainTextImportDialog(): void {
    const view = getEl<HTMLElement>(VIEW_ID);
    if (view) view.style.display = 'none';
}

function isOpen(): boolean {
    const view = getEl<HTMLElement>(VIEW_ID);
    return !!view && view.style.display !== 'none';
}

/** Re-parses the current textarea content and repaints the preview pane. */
function refreshPreview(): void {
    const textarea = getEl<HTMLTextAreaElement>('pt-import-source');
    const preview = getEl<HTMLElement>('pt-import-preview');
    const status = getEl<HTMLElement>('pt-import-status');
    const confirmBtn = getEl<HTMLButtonElement>('pt-import-confirm');
    if (!textarea || !preview) return;

    const source = textarea.value;

    if (source.trim() === '') {
        latestResult = null;
        preview.innerHTML = `<div class="import-preview-empty">Paste or load a key to see a live preview here.</div>`;
        if (status) status.textContent = '';
        if (confirmBtn) confirmBtn.disabled = true;
        return;
    }

    const result = parsePlainTextKey(source, gatherOptions());
    latestResult = result;

    const canImport = result.couplets.length > 0 && result.errors.length === 0;
    if (confirmBtn) confirmBtn.disabled = !canImport;

    if (status) {
        if (result.errors.length > 0) {
            status.textContent = '⚠️ Could not parse';
            status.className = 'import-status import-status-error';
        } else {
            status.textContent = `✓ ${result.stepCount} step(s)`;
            status.className = 'import-status import-status-ok';
        }
    }

    preview.innerHTML = renderPreviewHtml(result);
}

/** Builds the preview pane markup for a parse result. */
function renderPreviewHtml(result: PlainTextParseResult): string {
    let html = '';

    if (result.errors.length > 0) {
        html += `<div class="import-messages">`;
        result.errors.forEach(err => {
            html += `<div class="import-msg import-msg-error">⛔ ${escapeHTML(err)}</div>`;
        });
        html += `</div>`;
        return html;
    }

    if (result.warnings.length > 0) {
        html += `<div class="import-messages">`;
        result.warnings.forEach(warn => {
            html += `<div class="import-msg import-msg-warning">⚠️ ${escapeHTML(warn)}</div>`;
        });
        html += `</div>`;
    }

    // Run the same diagnostics engine the live editor uses, so problems in the
    // imported key (orphaned steps, dead-end choices, convergence, unresolved
    // links/figures) surface here before the user commits the import.
    const diagnostics = diagnoseKey(result.couplets, result.figures);
    let errorCount = 0;
    let warningCount = 0;
    diagnostics.forEach(issues => issues.forEach(i => {
        if (i.severity === 'error') errorCount++; else warningCount++;
    }));

    if (errorCount > 0 || warningCount > 0) {
        const parts: string[] = [];
        if (errorCount > 0) parts.push(`${errorCount} error${errorCount === 1 ? '' : 's'}`);
        if (warningCount > 0) parts.push(`${warningCount} warning${warningCount === 1 ? '' : 's'}`);
        html += `<div class="import-diagnostics-summary">🩺 Key check: ${parts.join(', ')}. Fixable after import in the editor.</div>`;
    }

    const idToStep = new Map<number, number>();
    result.couplets.forEach((c, i) => idToStep.set(c.id, i + 1));

    const destLabel = (branch: Branch): string => {
        switch (branch.kind) {
            case 'linked': {
                const step = idToStep.get(branch.targetId);
                return step !== undefined ? `→ step ${step}` : '→ ?';
            }
            case 'unresolved':
                return `→ step ${branch.couplet}`;
            case 'taxon':
                return escapeHTML(branch.name);
            case 'empty':
                return '<span class="import-preview-muted">(empty)</span>';
        }
    };

    const diagnosticsHtml = (id: number): string => {
        const issues = diagnostics.get(id);
        if (!issues || issues.length === 0) return '';
        const rows = issues.map(issue => {
            const cls = issue.severity === 'error' ? 'error-text' : 'warning-text';
            const icon = issue.severity === 'error' ? '⛔' : '⚠️';
            return `<div class="${cls}">${icon} ${escapeHTML(issue.message)}</div>`;
        }).join('');
        return `<div class="import-preview-diagnostics warning-block">${rows}</div>`;
    };

    html += `<ol class="import-preview-list">`;
    result.couplets.forEach((c, index) => {
        const hasIssues = diagnostics.has(c.id);
        html += `
            <li class="import-preview-step${hasIssues ? ' has-issues' : ''}">
                <div class="import-preview-num">${index + 1}.</div>
                <div class="import-preview-rows">
                    <div class="import-preview-row">
                        <span class="import-preview-text">${escapeHTML(c.alt1) || '<span class="import-preview-muted">(blank)</span>'}</span>
                        <span class="import-preview-dest">${destLabel(c.branch1)}</span>
                    </div>
                    <div class="import-preview-row">
                        <span class="import-preview-text">${escapeHTML(c.alt2) || '<span class="import-preview-muted">(blank)</span>'}</span>
                        <span class="import-preview-dest">${destLabel(c.branch2)}</span>
                    </div>
                    ${diagnosticsHtml(c.id)}
                </div>
            </li>`;
    });
    html += `</ol>`;

    return html;
}

/** Commits the most recent parse result into the workspace as a new project. */
async function confirmImport(store: KeyStore, uiState: UIStateStore, refreshAll: () => void): Promise<void> {
    if (!latestResult || latestResult.couplets.length === 0 || latestResult.errors.length > 0) {
        showToast('⚠️ There is nothing valid to import yet.', 'error');
        return;
    }

    const titleInput = getEl<HTMLInputElement>('pt-import-title');
    const targetName = (titleInput?.value.trim()) || 'Imported Key';

    // Importing replaces the open key — guard unsaved work like Load/New do.
    if (store.hasUnsavedChanges()) {
        if (!confirm("You have unsaved changes in the current key. Importing will discard them. Continue?")) {
            return;
        }
    }

    const originalTitle = store.getPersistedTitle();

    try {
        const projectList = await workspaceStorage.getProjectList();
        const exists = projectList.some(p => p.name.toLowerCase() === targetName.toLowerCase());
        if (exists) {
            const overwrite = confirm(`A local project named "${targetName}" already exists. Overwrite it with this import?`);
            if (!overwrite) return;
        }

        const rawData = {
            type: APP_NAME,
            version: APP_VERSION,
            title: targetName,
            data: {
                title: targetName,
                key: latestResult.couplets,
                figures: latestResult.figures,
            },
        };

        const importResult = store.importJsonData(rawData);
        if (!importResult.success) {
            alert(`Failed to import parsed key:\n• ${importResult.errors.join('\n• ')}`);
            return;
        }

        // store.importJsonData resets the image cache internally; a plain-text import
        // brings no figures, so there's nothing further to stage here.
        store.setTitle(targetName);
        uiState.setActiveProjectTitle(targetName);

        await store.saveToStorage();

        showToast(`📥 Imported "${targetName}" from plain text (${latestResult.stepCount} step(s)).`, 'success');
        closePlainTextImportDialog();
        refreshAll();
    } catch (err) {
        console.error('Plain text import failed:', err);
        if (originalTitle) {
            store.setTitle(originalTitle);
            uiState.setActiveProjectTitle(originalTitle);
        }
        workspaceStorage.clearStagedChanges();
        showToast('⚠️ The plain text import could not be completed.', 'error');
    }
}

/**
 * Wires every interactive control inside the import dialog. Call once during
 * setupGlobalListeners and pass the shared AbortController signal so the
 * listeners are torn down with the rest of the app.
 */
export function setupPlainTextImporter(
    store: KeyStore,
    uiState: UIStateStore,
    refreshAll: () => void,
    signal: AbortSignal
): void {
    const textarea = getEl<HTMLTextAreaElement>('pt-import-source');
    const fileInput = getEl<HTMLInputElement>('pt-import-file-hidden');

    textarea?.addEventListener('input', () => {
        // Manual edits detach from the loaded file; stop re-decoding it.
        lastLoadedBuffer = null;
        refreshPreview();
    }, { signal });

    // Re-parse whenever any parsing option changes so the user can tune live.
    const optionIds = [
        'pt-opt-min-dots', 'pt-opt-ws', 'pt-opt-join', 'pt-opt-dehyphen',
        'pt-opt-lettered', 'pt-opt-dash', 'pt-opt-fill',
    ];
    optionIds.forEach(id => {
        const el = getEl(id);
        el?.addEventListener('change', () => refreshPreview(), { signal });
        el?.addEventListener('input', () => refreshPreview(), { signal });
    });

    getEl('pt-import-load-file')?.addEventListener('click', () => {
        fileInput?.click();
    }, { signal });

    fileInput?.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try {
            const buffer = await file.arrayBuffer();
            lastLoadedBuffer = buffer;
            const { text, encoding, autoDetected } = decodeBytes(buffer, getEncodingChoice());
            if (textarea) {
                textarea.value = text;
                refreshPreview();
            }
            if (autoDetected) {
                showToast(`📥 Loaded "${file.name}" — detected ${encodingLabel(encoding)} encoding.`, 'success');
            }
            // Pre-fill the title from the filename if the user hasn't set one.
            const titleInput = getEl<HTMLInputElement>('pt-import-title');
            if (titleInput && !titleInput.value.trim()) {
                titleInput.value = file.name.replace(/\.txt$/i, '').trim();
            }
        } catch (err) {
            console.error('Failed to read plain text file:', err);
            showToast('⚠️ Could not read the selected file.', 'error');
        } finally {
            (e.target as HTMLInputElement).value = '';
        }
    }, { signal });

    // Re-decode the loaded file when the encoding changes, so a mis-detected
    // file can be fixed without reloading. No-op until a file has been loaded.
    getEl<HTMLSelectElement>('pt-import-encoding')?.addEventListener('change', () => {
        if (!lastLoadedBuffer) return;
        const { text } = decodeBytes(lastLoadedBuffer, getEncodingChoice());
        if (textarea) {
            textarea.value = text;
            refreshPreview();
        }
    }, { signal });

    getEl('pt-import-clear')?.addEventListener('click', () => {
        if (textarea) textarea.value = '';
        lastLoadedBuffer = null;
        refreshPreview();
        textarea?.focus();
    }, { signal });

    getEl('pt-import-close')?.addEventListener('click', () => closePlainTextImportDialog(), { signal });
    getEl('pt-import-cancel')?.addEventListener('click', () => closePlainTextImportDialog(), { signal });

    getEl('pt-import-confirm')?.addEventListener('click', () => {
        confirmImport(store, uiState, refreshAll);
    }, { signal });

    // Close on Escape while the dialog is focused/open.
    getEl(VIEW_ID)?.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Escape' && isOpen()) {
            e.stopPropagation();
            closePlainTextImportDialog();
        }
    }, { signal });
}
