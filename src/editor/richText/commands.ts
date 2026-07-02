// editor/richText/commands.ts
// Editing commands as pure string transforms over (value, selection). Keeping them
// pure means the toolbar buttons and keyboard shortcuts share one code path, and the
// logic is trivially testable without a DOM. Each returns the new source and the new
// selection (in source-offset space) for the caller to render + restore.

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
    start: number;          // index of the opening delimiter
    end: number;            // index just past the closing delimiter
    contentStart: number;
    contentEnd: number;
}

/** Every span of `mark` in `value`, paired with the same rules as the tokenizer
 *  (a longer same-char run — e.g. the `**` of bold — is never an italic delimiter). */
function findSpans(value: string, mark: InlineMark): MarkSpan[] {
    const { open, close } = mark;
    const singleChar = open === close && open.length === 1;
    const spans: MarkSpan[] = [];
    let i = 0;
    while (i < value.length) {
        if (singleChar && value[i] === open) {
            // Skip longer same-char runs: they belong to another mark (bold's `**`).
            let runEnd = i;
            while (runEnd + 1 < value.length && value[runEnd + 1] === open) runEnd++;
            if (runEnd > i) {
                i = runEnd + 1;
                continue;
            }
        }
        if (value.startsWith(open, i)) {
            const contentStart = i + open.length;
            const closeIdx = findClose(value, contentStart, open, close);
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

/**
 * Toggles a mark over the current selection, span-aware:
 *  - Selection (or caret) inside a single marked span → unwrap that whole span.
 *  - Collapsed caret in plain text → insert an empty delimiter pair, caret between.
 *  - Otherwise → wrap: the selection is unioned with every span it touches, this
 *    mark's delimiters inside the union are stripped, and the union is wrapped once —
 *    so partial overlaps and multi-span selections merge into one contiguous run
 *    instead of producing nested or interleaved delimiters.
 */
export function toggleMark(value: string, sel: Selection, mark: InlineMark): CommandResult {
    const { open, close } = mark;
    const { start, end } = sel;
    const spans = findSpans(value, mark);

    // Unwrap: the selection lies within one marked span (delimiters included).
    const covering = spans.find(s => start >= s.start && end <= s.end);
    if (covering) {
        const inner = value.slice(covering.contentStart, covering.contentEnd);
        const next = value.slice(0, covering.start) + inner + value.slice(covering.end);
        // Shift into content coords, clamping positions that sat inside a delimiter.
        const map = (p: number) =>
            Math.min(Math.max(p - open.length, covering.start), covering.start + inner.length);
        return { value: next, selection: { start: map(start), end: map(end) } };
    }

    // Collapsed caret in plain text: empty pair with the caret between the markers.
    if (start === end) {
        const next = value.slice(0, start) + open + close + value.slice(end);
        const caret = start + open.length;
        return { value: next, selection: { start: caret, end: caret } };
    }

    // Wrap: union the selection with every touched span, strip this mark's delimiters
    // inside the union, and wrap the result once.
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

    // Map an original position into the new string, accounting for removed delimiter
    // chunks before it (positions inside a removed chunk clamp to the chunk start).
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

/** Replaces the selection with raw source text (a token, pasted text…), caret after. */
export function insertToken(value: string, sel: Selection, src: string): CommandResult {
    const { start, end } = sel;
    const next = value.slice(0, start) + src + value.slice(end);
    const caret = start + src.length;
    return { value: next, selection: { start: caret, end: caret } };
}
