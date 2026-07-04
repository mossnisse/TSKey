// Editing commands as pure string transforms over (value, selection), so the toolbar
// and keyboard shortcuts share one code path with no DOM dependency.

import type { InlineMark } from './schema.ts';
import { findClose } from './tokenize.ts';

export interface Selection {
    start: number;
    end: number;
}

export interface CommandResult {
    value: string;
    selection: Selection;
}

interface MarkSpan {
    start: number;
    end: number;
    contentStart: number;
    contentEnd: number;
}

// Delimiters are detected against `masked` (the token-masked source, so a delimiter char
// inside a `[fig: ...]` token isn't mistaken for real) but indices apply equally to `value`.
function findSpans(masked: string, mark: InlineMark): MarkSpan[] {
    const { open, close } = mark;
    const singleChar = open === close && open.length === 1;
    const spans: MarkSpan[] = [];
    let i = 0;
    while (i < masked.length) {
        if (singleChar && masked[i] === open) {
            // Skip longer same-char runs: they belong to another mark (bold's `**`).
            let runEnd = i;
            while (runEnd + 1 < masked.length && masked[runEnd + 1] === open) runEnd++;
            if (runEnd > i) {
                i = runEnd + 1;
                continue;
            }
        }
        if (masked.startsWith(open, i)) {
            const contentStart = i + open.length;
            const closeIdx = findClose(masked, contentStart, open, close);
            if (closeIdx > contentStart) {
                spans.push({ start: i, end: closeIdx + close.length, contentStart, contentEnd: closeIdx });
                i = closeIdx + close.length;
                continue;
            }
        }
        i++;
    }
    return spans;
}

/** Toggles a mark: unwraps if the selection is inside one marked span, inserts an
 *  empty pair for a collapsed caret in plain text, otherwise wraps the union of every
 *  touched span so overlapping selections merge into one run. */
export function toggleMark(value: string, sel: Selection, mark: InlineMark, masked: string = value): CommandResult {
    const { open, close } = mark;
    const { start, end } = sel;
    const spans = findSpans(masked, mark);

    // A collapsed caret must be strictly inside the span (not adjacent to its
    // delimiters) to unwrap; a range must touch actual content, not just a delimiter glyph.
    const covering = start === end
        ? spans.find(s => start > s.start && start < s.end)
        : spans.find(s => start >= s.start && end <= s.end && start < s.contentEnd && end > s.contentStart);
    if (covering) {
        const inner = value.slice(covering.contentStart, covering.contentEnd);
        const next = value.slice(0, covering.start) + inner + value.slice(covering.end);
        const map = (p: number) =>
            Math.min(Math.max(p - open.length, covering.start), covering.start + inner.length);
        return { value: next, selection: { start: map(start), end: map(end) } };
    }

    if (start === end) {
        const next = value.slice(0, start) + open + close + value.slice(end);
        const caret = start + open.length;
        return { value: next, selection: { start: caret, end: caret } };
    }

    const touched = spans.filter(s => s.start < end && start < s.end);
    const uStart = Math.min(start, ...touched.map(s => s.start));
    const uEnd = Math.max(end, ...touched.map(s => s.end));
    const chunks = touched
        .flatMap(s => [{ at: s.start, len: open.length }, { at: s.contentEnd, len: close.length }])
        .sort((a, b) => a.at - b.at);

    let inner = '';
    let cursor = uStart;
    for (const ch of chunks) {
        inner += value.slice(cursor, ch.at);
        cursor = ch.at + ch.len;
    }
    inner += value.slice(cursor, uEnd);
    const next = value.slice(0, uStart) + open + inner + close + value.slice(uEnd);

    // Positions inside a removed delimiter chunk clamp to the chunk's start.
    const map = (p: number) => {
        let removed = 0;
        for (const ch of chunks) {
            if (p >= ch.at + ch.len) removed += ch.len;
            else if (p > ch.at) { removed += p - ch.at; break; }
            else break;
        }
        return uStart + open.length + (p - uStart - removed);
    };
    return { value: next, selection: { start: map(start), end: map(end) } };
}

export function insertToken(value: string, sel: Selection, src: string): CommandResult {
    const { start, end } = sel;
    const next = value.slice(0, start) + src + value.slice(end);
    const caret = start + src.length;
    return { value: next, selection: { start: caret, end: caret } };
}