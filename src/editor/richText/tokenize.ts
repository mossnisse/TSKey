// Source string -> Atom tree. Tokens are atomic but a mark may still span one
// (`**bold [fig: 1] text**`): token chars are masked to ' ' in a parallel string so
// mark delimiters are matched against the mask, then atoms are emitted from the real
// value with tokens spliced back in.

import type { EditorSchema, InlineMark } from './schema.ts';

export interface TextAtom {
    kind: 'text';
    value: string;
}

export interface MarkAtom {
    kind: 'mark';
    mark: InlineMark;
    children: Atom[];
}

export interface TokenAtom {
    kind: 'token';
    src: string;
    html: string;
    className: string;
}

export type Atom = TextAtom | MarkAtom | TokenAtom;

interface Hit {
    start: number;
    end: number;
    atom: TokenAtom;
}

// For a single-char symmetric delimiter, a longer same-char run belongs to another
// mark (bold's `**`), so a *paired* run and its mate are skipped; an unpaired longer
// run has no mate, so its first char closes us (keeps `*a*` + another `*` as italic).
export function findClose(text: string, from: number, open: string, close: string, end: number = text.length): number {
    if (open === close && close.length === 1) {
        const c = close;
        let insideLongRun = false;
        let j = from;
        while (j < end) {
            if (text[j] !== c) { j++; continue; }
            let runEnd = j;
            while (runEnd + 1 < end && text[runEnd + 1] === c) runEnd++;
            if (runEnd === j) return j;
            if (insideLongRun) {
                insideLongRun = false;
            } else {
                const pat = c.repeat(runEnd - j + 1);
                const mate = text.indexOf(pat, runEnd + 1);
                if (mate !== -1 && mate + pat.length <= end) {
                    insideLongRun = true;
                } else {
                    return j;
                }
            }
            j = runEnd + 1;
        }
        return -1;
    }
    const idx = text.indexOf(close, from);
    return idx !== -1 && idx + close.length <= end ? idx : -1;
}

function emitText(atoms: Atom[], value: string, hitByStart: Map<number, Hit>, lo: number, hi: number): void {
    let textStart = lo;
    let i = lo;
    while (i < hi) {
        const hit = hitByStart.get(i);
        if (hit && hit.end <= hi) {
            if (i > textStart) atoms.push({ kind: 'text', value: value.slice(textStart, i) });
            atoms.push(hit.atom);
            i = hit.end;
            textStart = i;
        } else {
            i++;
        }
    }
    if (hi > textStart) atoms.push({ kind: 'text', value: value.slice(textStart, hi) });
}

// When symmetric marks share a delimiter character (`**` and `*`), a run such as
// `***text***` uses the outer mark at the edges and leaves one character pair for
// the nested mark. `findClose` finds the first `**`, so shift past that inner close.
function adjustCloseForSharedRun(text: string, contentStart: number, closeIdx: number, mark: InlineMark, end: number): number {
    const { open, close } = mark;
    if (open !== close || open.length < 2 || ![...open].every(ch => ch === open[0])) return closeIdx;

    const char = open[0];
    let openingExtra = 0;
    while (contentStart + openingExtra < end && text[contentStart + openingExtra] === char) openingExtra++;
    if (openingExtra === 0) return closeIdx;

    let closingRunLength = 0;
    while (closeIdx + closingRunLength < end && text[closeIdx + closingRunLength] === char) closingRunLength++;
    return closingRunLength >= close.length + openingExtra ? closeIdx + openingExtra : closeIdx;
}

function parseMarks(
    value: string,
    masked: string,
    ordered: InlineMark[],
    hitByStart: Map<number, Hit>,
    lo: number,
    hi: number,
    atoms: Atom[],
): void {
    let i = lo;
    let bufStart = lo;
    const flush = (end: number) => {
        if (end > bufStart) emitText(atoms, value, hitByStart, bufStart, end);
    };

    while (i < hi) {
        let matched = false;
        for (const mark of ordered) {
            if (i + mark.open.length > hi || !masked.startsWith(mark.open, i)) continue;
            const contentStart = i + mark.open.length;
            let closeIdx = findClose(masked, contentStart, mark.open, mark.close, hi);
            if (closeIdx <= contentStart) continue;
            closeIdx = adjustCloseForSharedRun(masked, contentStart, closeIdx, mark, hi);
            flush(i);
            const children: Atom[] = [];
            parseMarks(value, masked, ordered, hitByStart, contentStart, closeIdx, children);
            atoms.push({ kind: 'mark', mark, children });
            i = closeIdx + mark.close.length;
            bufStart = i;
            matched = true;
            break;
        }
        if (!matched) i++;
    }
    flush(hi);
}

// Resolves overlaps greedily by earliest start (ties: longest match) so e.g. a
// `[figID: 5]` is one atom, never split. `editingCaret` (a collapsed caret offset)
// suppresses the token whose interior the caret sits in, so it stays as editable
// source text instead of collapsing into an atomic chip that ejects the caret.
function collectHits(value: string, schema: EditorSchema, editingCaret?: number | null): Hit[] {
    const rawHits: Hit[] = [];
    for (const token of schema.tokens) {
        const flags = token.pattern.flags.includes('g') ? token.pattern.flags : token.pattern.flags + 'g';
        const re = new RegExp(token.pattern.source, flags);
        let m: RegExpExecArray | null;
        while ((m = re.exec(value)) !== null) {
            if (m[0] === '') { re.lastIndex++; continue; }
            const { html, className } = token.render(m);
            rawHits.push({ start: m.index, end: m.index + m[0].length, atom: { kind: 'token', src: m[0], html, className } });
        }
    }
    rawHits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    const hits: Hit[] = [];
    let claimed = 0;
    for (const hit of rawHits) {
        if (hit.start < claimed) continue;
        if (editingCaret != null && hit.start < editingCaret && editingCaret < hit.end) continue;
        hits.push(hit);
        claimed = hit.end;
    }
    return hits;
}

/**
 * The source span of a token whose interior strictly contains `caret`, or null.
 * Lets the editor detect when the caret leaves a token being edited so it can
 * re-lock into a chip. Boundary positions (caret == start/end) count as outside.
 */
export function tokenSpanAt(value: string, schema: EditorSchema, caret: number): { start: number; end: number } | null {
    for (const hit of collectHits(value, schema)) {
        if (hit.start < caret && caret < hit.end) return { start: hit.start, end: hit.end };
    }
    return null;
}

// Blanks token spans to spaces (length-preserving) so mark delimiters never match inside one.
function buildMask(value: string, hits: readonly Hit[]): string {
    if (hits.length === 0) return value;
    const chars = value.split('');
    for (const hit of hits) {
        for (let k = hit.start; k < hit.end; k++) chars[k] = ' ';
    }
    return chars.join('');
}

// Shared with commands.ts so mark toggling uses the same masking as the tokenizer.
export function maskTokens(value: string, schema: EditorSchema): string {
    return buildMask(value, collectHits(value, schema));
}

export function tokenize(value: string, schema: EditorSchema, editingCaret?: number | null): Atom[] {
    if (!value) return [];

    const hits = collectHits(value, schema, editingCaret);
    const masked = buildMask(value, hits);
    const hitByStart = new Map<number, Hit>(hits.map(h => [h.start, h]));

    const ordered = [...schema.marks].sort((a, b) => b.open.length - a.open.length);
    const atoms: Atom[] = [];
    parseMarks(value, masked, ordered, hitByStart, 0, value.length, atoms);
    return atoms;
}
