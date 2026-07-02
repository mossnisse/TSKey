// editor/richText/tokenize.ts
// Pure transform: source string -> flat/nested Atom tree, driven by a schema.
//
// Two passes, tokens before marks:
//   1. Tokens are atomic and take precedence. The whole string is split on token
//      matches into alternating literal runs and token atoms.
//   2. Each literal run is parsed for nested marks (recursive descent). Unbalanced or
//      still-being-typed delimiters (no matching close in the run) stay literal text —
//      this is what lets `**bold` read as plain text until the closing `**` is typed,
//      then collapse into a bold atom.

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

/** Finds the index of a mark's closing delimiter at or after `from`, or -1.
 *  For a single-char symmetric delimiter (italic `*`, `~`, `^`) a longer run of the
 *  same char is another mark's delimiter (e.g. bold's `**`), so a *paired* run and its
 *  mate are skipped over — but an unpaired longer run has no mate to close, so its
 *  first char serves as our closer (typing `*a*` then another `*` keeps the italic
 *  alive instead of collapsing the whole span back to literal text). */
export function findClose(text: string, from: number, open: string, close: string): number {
    if (open === close && close.length === 1) {
        const c = close;
        let insideLongRun = false;   // between a skipped longer run and its mate
        let j = from;
        while (j < text.length) {
            if (text[j] !== c) { j++; continue; }
            let runEnd = j;
            while (runEnd + 1 < text.length && text[runEnd + 1] === c) runEnd++;
            if (runEnd === j) return j;                    // isolated single char
            if (insideLongRun) {
                insideLongRun = false;                     // the mate: skip it too
            } else if (text.indexOf(c.repeat(runEnd - j + 1), runEnd + 1) !== -1) {
                insideLongRun = true;                      // paired: skip both runs
            } else {
                return j;                                  // unpaired: first char closes us
            }
            j = runEnd + 1;
        }
        return -1;
    }
    return text.indexOf(close, from);
}

/** Recursive-descent parse of marks within a single literal run (no tokens inside). */
function parseMarks(text: string, marks: InlineMark[]): Atom[] {
    // Longer openers first so `**` wins over `*`.
    const ordered = [...marks].sort((a, b) => b.open.length - a.open.length);
    const atoms: Atom[] = [];
    let buffer = '';
    let i = 0;

    const flush = () => {
        if (buffer) {
            atoms.push({ kind: 'text', value: buffer });
            buffer = '';
        }
    };

    while (i < text.length) {
        let matched = false;
        for (const mark of ordered) {
            if (!text.startsWith(mark.open, i)) continue;
            const contentStart = i + mark.open.length;
            const closeIdx = findClose(text, contentStart, mark.open, mark.close);
            if (closeIdx === -1 || closeIdx === contentStart) continue; // no close, or empty
            flush();
            const inner = text.slice(contentStart, closeIdx);
            atoms.push({ kind: 'mark', mark, children: parseMarks(inner, marks) });
            i = closeIdx + mark.close.length;
            matched = true;
            break;
        }
        if (!matched) {
            buffer += text[i];
            i++;
        }
    }
    flush();
    return atoms;
}

/** Splits `value` into token atoms and literal runs, then parses marks in each run. */
export function tokenize(value: string, schema: EditorSchema): Atom[] {
    if (!value) return [];

    // Collect every token match across all token rules, then resolve overlaps by
    // earliest start (ties: longest match), so a `[figID: 5]` is one atom, never split.
    interface Hit { start: number; end: number; atom: TokenAtom; }
    const hits: Hit[] = [];
    for (const token of schema.tokens) {
        const re = new RegExp(token.pattern.source, token.pattern.flags.includes('g') ? token.pattern.flags : token.pattern.flags + 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(value)) !== null) {
            if (m[0] === '') { re.lastIndex++; continue; }
            const { html, className } = token.render(m);
            hits.push({ start: m.index, end: m.index + m[0].length, atom: { kind: 'token', src: m[0], html, className } });
        }
    }
    hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    const atoms: Atom[] = [];
    let cursor = 0;
    for (const hit of hits) {
        if (hit.start < cursor) continue; // overlapped by an earlier-claimed token
        if (hit.start > cursor) atoms.push(...parseMarks(value.slice(cursor, hit.start), schema.marks));
        atoms.push(hit.atom);
        cursor = hit.end;
    }
    if (cursor < value.length) atoms.push(...parseMarks(value.slice(cursor), schema.marks));
    return atoms;
}
