// editor/richText/tokenize.ts
// Pure transform: source string -> flat/nested Atom tree, driven by a schema.
//
// Tokens are atomic and take precedence, but a mark may still SPAN a token
// (`**bold [fig: 1] text**` is one bold run wrapping text + a chip + text). To make
// both true at once, token characters are masked to ' ' in a parallel string;
// mark delimiters are matched against that mask (so a delimiter can never be found
// inside a token, and a token never breaks a delimiter pair), while the atoms are
// emitted from the real value with tokens spliced back in. Unbalanced or still-being-
// typed delimiters (no matching close) stay literal text — so `**bold` reads as plain
// text until the closing `**` is typed, then collapses into a bold atom.

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
    src: string;        // the raw matched source (chip round-trips to exactly this)
    html: string;
    className: string;
}

export type Atom = TextAtom | MarkAtom | TokenAtom;

interface Hit {
    start: number;
    end: number;
    atom: TokenAtom;
}

/** Finds the index of a mark's closing delimiter in [from, end), or -1.
 *  For a single-char symmetric delimiter (italic `*`, `~`, `^`) a longer run of the
 *  same char is another mark's delimiter (e.g. bold's `**`), so a *paired* run and its
 *  mate are skipped over — but an unpaired longer run has no mate to close, so its
 *  first char serves as our closer (typing `*a*` then another `*` keeps the italic
 *  alive instead of collapsing the whole span back to literal text). */
export function findClose(text: string, from: number, open: string, close: string, end: number = text.length): number {
    if (open === close && close.length === 1) {
        const c = close;
        let insideLongRun = false;   // between a skipped longer run and its mate
        let j = from;
        while (j < end) {
            if (text[j] !== c) { j++; continue; }
            let runEnd = j;
            while (runEnd + 1 < end && text[runEnd + 1] === c) runEnd++;
            if (runEnd === j) return j;                    // isolated single char
            if (insideLongRun) {
                insideLongRun = false;                     // the mate: skip it too
            } else {
                const pat = c.repeat(runEnd - j + 1);
                const mate = text.indexOf(pat, runEnd + 1);
                if (mate !== -1 && mate + pat.length <= end) {
                    insideLongRun = true;                  // paired: skip both runs
                } else {
                    return j;                              // unpaired: first char closes us
                }
            }
            j = runEnd + 1;
        }
        return -1;
    }
    const idx = text.indexOf(close, from);
    return idx !== -1 && idx + close.length <= end ? idx : -1;
}

/** Emits value[lo, hi) as text atoms, splicing back any tokens that start within it. */
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

/** Recursive-descent parse of marks over value[lo, hi), matching delimiters against
 *  the token-masked string and extracting tokens into the emitted text. */
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
            const closeIdx = findClose(masked, contentStart, mark.open, mark.close, hi);
            if (closeIdx <= contentStart) continue; // no close, or empty content
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

/** Collects every non-overlapping token hit, resolving overlaps greedily by earliest
 *  start (ties: longest match), so a `[figID: 5]` is one atom, never split. */
function collectHits(value: string, schema: EditorSchema): Hit[] {
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
        if (hit.start < claimed) continue; // overlapped by an earlier-claimed token
        hits.push(hit);
        claimed = hit.end;
    }
    return hits;
}

/** Blanks token spans to spaces (a non-delimiter, length-preserving char) so mark
 *  delimiters can't be matched inside a token, and a token between two delimiters
 *  never breaks the pair. Offsets stay 1:1 with `value`. */
function buildMask(value: string, hits: readonly Hit[]): string {
    if (hits.length === 0) return value;
    const chars = value.split('');
    for (const hit of hits) {
        for (let k = hit.start; k < hit.end; k++) chars[k] = ' ';
    }
    return chars.join('');
}

/** The token-masked view of `value` (see buildMask). Shared with commands.ts so mark
 *  toggling detects delimiters against exactly the same masking the tokenizer uses. */
export function maskTokens(value: string, schema: EditorSchema): string {
    return buildMask(value, collectHits(value, schema));
}

/** Source string -> Atom tree: collect tokens, mask them, then parse marks around them. */
export function tokenize(value: string, schema: EditorSchema): Atom[] {
    if (!value) return [];

    const hits = collectHits(value, schema);
    const masked = buildMask(value, hits);
    const hitByStart = new Map<number, Hit>(hits.map(h => [h.start, h]));

    // Longer openers first so `**` wins over `*`.
    const ordered = [...schema.marks].sort((a, b) => b.open.length - a.open.length);
    const atoms: Atom[] = [];
    parseMarks(value, masked, ordered, hitByStart, 0, value.length, atoms);
    return atoms;
}
