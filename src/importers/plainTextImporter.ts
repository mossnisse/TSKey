// plainTextImporter.ts
//
// Imports a dichotomous key from a plain-text document — the inverse of
// exporters/plainTextExporter.ts, tolerant of light hand-editing of that format.
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

import type { Branch, Couplet, Figure, KeyStore } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { showToast } from '../ui/toast.ts';
import { commitParsedKey } from './importCommit.ts';
import { renderImportPreview } from './importPreview.ts';
import { getKeyDialect, listKeyDialects, registerKeyDialect } from './keyDialect.ts';

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
    /** Recognize a leading symbol ( - – — + = • ) as the second alternative of a couplet. */
    recognizeDashSecondLead: boolean;
    /** Ignore a parenthesized back-reference after the step number, e.g. "2 (1)". */
    recognizeBackReferences: boolean;
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
    recognizeBackReferences: true,
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

export interface LeadMarker {
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
export function parseLeadMarker(line: string, opts: PlainTextParseOptions): LeadMarker | null {
    // Numbered or lettered lead: "1", "1.", "1)", "12", "1a", "1b.", etc.
    const alternativeClass = opts.recognizeLetteredCouplets
        ? "([a-bA-B'’′″])?"
        : "(['’′″])?";
    // Optional parenthesized back-reference to the parent couplet, e.g. "2 (1)".
    // Non-capturing so numbered[1..3] keep their meaning; digit-led content avoids
    // swallowing in-text parentheticals like "(Fig. 4)".
    const backRef = opts.recognizeBackReferences ? '(?:\\s*\\(\\s*\\d[\\d\\s,.–-]*\\))?' : '';
    // The marker is separated from its text by whitespace, or — when a "." ")" or
    // ":" is present — by nothing at all, which recovers tightly-set or OCR'd
    // output like "1.Wings". The letter lookahead in the no-space case keeps a
    // measurement such as "1.5 mm" from being misread as a step marker.
    const tail = `[.):]?${backRef}(?:\\s+|(?<=[.):])(?=\\p{L}))`;
    const numbered = line.match(new RegExp(`^\\s*(\\d{1,4})\\s*${alternativeClass}\\s*${tail}(\\S.*)$`, 'u'));
    if (numbered) {
        const num = parseInt(numbered[1], 10);
        const alternative = (numbered[2] || '').toLowerCase();
        const rest = numbered[3];
        if (alternative === 'b' || /['’′″]/u.test(alternative)) {
            return { kind: 'second', coupletNum: num, rest };
        }
        return { kind: 'first', coupletNum: num, rest };
    }

    if (opts.recognizeDashSecondLead) {
        // Second-alternative markers vary across published keys and OCR output:
        // hyphen/minus, en/em/figure dashes (sometimes doubled), plus (common in
        // botanical Floras), equals (a frequent mis-scan of a long dash), and a
        // replacement glyph when a PDF text layer lost the original dash. A
        // missing space is tolerated only before a letter, as with numbered leads.
        const dashed = line.match(/^\s*(?:[-–—−‒―]{1,2}|[+=\uFFFD])(?:\s+|(?=\p{L}))(\S.*)$/u);
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

// Characters OCR most often confuses with a digit. Kept deliberately small and
// high-precision; the guard in ocrNumericToken does the rest of the work.
const OCR_DIGIT_SUBSTITUTIONS: Readonly<Record<string, string>> = {
    l: '1', I: '1', '|': '1', '!': '1',
    O: '0', o: '0',
    S: '5', Z: '2', B: '8',
};

/**
 * Corrects a token that OCR mangled into a near-number back to its digits — e.g.
 * a destination link scanned as "l0" becomes "10" so it resolves instead of
 * being dropped as an unknown taxon. Returns null unless the token already
 * contains a real digit and every other character is a known digit look-alike,
 * which keeps genuine short taxon codes from being rewritten into links.
 */
export function ocrNumericToken(token: string): string | null {
    const trimmed = token.trim().replace(/\.$/u, '');
    if (!trimmed || trimmed.length > 4 || !/\d/u.test(trimmed)) return null;
    let digits = '';
    for (const char of trimmed) {
        if (/\d/u.test(char)) digits += char;
        else if (char in OCR_DIGIT_SUBSTITUTIONS) digits += OCR_DIGIT_SUBSTITUTIONS[char];
        else return null;
    }
    return /^\d{1,4}$/u.test(digits) ? digits : null;
}

/** Returns the last match of a global regex in a string, or null if none. */
function lastMatch(re: RegExp, s: string): RegExpExecArray | null {
    let last: RegExpExecArray | null = null;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) last = m;
    return last;
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
    const leader = lastMatch(new RegExp(`\\.(?:\\s?\\.){${minDots - 1},}`, 'g'), body);
    if (leader) {
        return { text: body.slice(0, leader.index), dest: body.slice(leader.index + leader[0].length) };
    }

    // 3. Wide whitespace (2+ spaces).
    if (opts.useWhitespaceSeparator) {
        const ws = lastMatch(/\s{2,}/g, body);
        if (ws) {
            return { text: body.slice(0, ws.index), dest: body.slice(ws.index + ws[0].length) };
        }
    }

    // 4. A trailing destination cue: an arrow or "go to" phrase, a bare step
    //    number, or an OCR-mangled one such as "l0" (e.g. "... inner side → 6").
    const trailing = body.match(/^(.*\S)\s+(?:→\s*|➔\s*|=>\s*|go\s+to\s+|couplet\s+)?([0-9A-Za-z|!]{1,4})\.?\s*$/iu);
    if (trailing) {
        const dest = ocrNumericToken(trailing[2]) ?? (/^\d{1,4}$/u.test(trailing[2]) ? trailing[2] : '');
        // A greedy description can keep a trailing arrow that sat before the
        // number ("… side → 6"); drop it so the cue never leaks into the text.
        if (dest) return { text: trailing[1].replace(/\s*(?:→|➔|=>)\s*$/u, '').trim(), dest };
    }

    return { text: body, dest: '' };
}

/** Classifies a raw destination string into a couplet-number link or a taxon name. */
function classifyDest(dest: string): { linkNum: number; taxa: string } {
    const trimmed = dest.trim();
    // An empty cell, the "..." placeholder, or any run of dots all mean "no destination".
    if (trimmed === '' || /^[.\s]+$/.test(trimmed)) {
        return { linkNum: 0, taxa: '' };
    }
    const numMatch = trimmed.match(/^(\d{1,4})\.?$/);
    if (numMatch) {
        return { linkNum: parseInt(numMatch[1], 10), taxa: '' };
    }
    const corrected = ocrNumericToken(trimmed);
    if (corrected) {
        return { linkNum: parseInt(corrected, 10), taxa: '' };
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
    // Emit a draft; importJsonData's migration find-or-creates the taxon record.
    return { kind: 'taxonDraft', name: trimmed };
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

        const marker = parseLeadMarker(line, opts);
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
            // Implausible link target — keep the raw number as text.
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
            if (acc.alt2 || acc.taxa2 || acc.link2) {
                warnings.push(`Couplet ${lead.num} has more than one second alternative; the later one overwrote the earlier.`);
            }
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

registerKeyDialect({
    id: 'linear',
    label: 'Linear / bracketed key',
    parse: parsePlainTextKey,
});

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
        recognizeBackReferences: checked('pt-opt-backref', DEFAULT_PARSE_OPTIONS.recognizeBackReferences),
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

    const dialectId = getEl<HTMLSelectElement>('pt-import-dialect')?.value || 'linear';
    const dialect = getKeyDialect(dialectId);
    const result = (dialect ?? getKeyDialect('linear'))?.parse(source, gatherOptions())
        ?? parsePlainTextKey(source, gatherOptions());
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

    preview.innerHTML = renderImportPreview(result);
}

/** Commits the most recent parse result into the workspace as a new project. */
async function confirmImport(store: KeyStore, uiState: UIStateStore, refreshAll: () => void): Promise<void> {
    if (!latestResult || latestResult.couplets.length === 0 || latestResult.errors.length > 0) {
        showToast('⚠️ There is nothing valid to import yet.', 'error');
        return;
    }

    const titleInput = getEl<HTMLInputElement>('pt-import-title');
    const targetName = (titleInput?.value.trim()) || 'Imported Key';

    const outcome = await commitParsedKey({
        store,
        uiState,
        refreshAll,
        result: latestResult,
        title: targetName,
        sourceLabel: 'plain text',
    });
    if (outcome === 'saved' || outcome === 'imported-unsaved') {
        closePlainTextImportDialog();
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

    const dialectSelect = getEl<HTMLSelectElement>('pt-import-dialect');
    if (dialectSelect) {
        dialectSelect.replaceChildren(...listKeyDialects().map(dialect => {
            const option = document.createElement('option');
            option.value = dialect.id;
            option.textContent = dialect.label;
            return option;
        }));
        dialectSelect.value = 'linear';
    }

    textarea?.addEventListener('input', () => {
        // Manual edits detach from the loaded file; stop re-decoding it.
        lastLoadedBuffer = null;
        refreshPreview();
    }, { signal });

    // Re-parse whenever any parsing option changes so the user can tune live.
    const optionIds = [
        'pt-opt-min-dots', 'pt-opt-ws', 'pt-opt-join', 'pt-opt-dehyphen',
        'pt-opt-lettered', 'pt-opt-dash', 'pt-opt-backref', 'pt-opt-fill', 'pt-import-dialect',
    ];
    optionIds.forEach(id => {
        const el = getEl(id);
        // Checkboxes and selects fire both 'input' and 'change'; listen to one
        // per control so each toggle re-parses once. Text entry stays live.
        const isTextEntry = el instanceof HTMLInputElement && el.type !== 'checkbox';
        el?.addEventListener(isTextEntry ? 'input' : 'change', () => refreshPreview(), { signal });
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
                titleInput.value = file.name.replace(/\.te?xt$/i, '').trim();
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
