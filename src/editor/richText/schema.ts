// editor/richText/schema.ts
// The editor is configured by a *schema*: a set of inline "marks" (paired markdown
// delimiters that wrap content — bold/italic/sub/sup) and "tokens" (atomic, regex-
// matched inline units rendered as non-editable chips — e.g. figure references).
// Nothing in the core editor is hard-coded to a particular mark or token; new
// styling/highlighting is added by extending the arrays a schema exposes.

import { escapeHTML } from '../../utils.ts';
import { figIdTokenRegex, figRawTokenRegex } from '../../figureTokens.ts';
import type { FigureLookups } from '../../figureTokens.ts';
import { resolveRawFigValue } from '../../keyDocumentModel.ts';

/** A paired-delimiter inline style. `open`/`close` are the markdown markers that live
 *  in the source string but are hidden in the hybrid render; `tag` is the element the
 *  content renders into. `shortcut` is the single key for Ctrl/Cmd+<key>. */
export interface InlineMark {
    name: string;
    open: string;
    close: string;
    tag: string;
    className?: string;
    shortcut?: string;
}

/** What a token rule produces for one match: the inner HTML of the chip (already
 *  escaped) and its CSS class. The chip's *source* is the raw matched text (`m[0]`). */
export interface TokenRender {
    html: string;
    className: string;
}

/** An atomic, non-editable inline unit matched by a global regex. */
export interface InlineToken {
    name: string;
    /** MUST be constructed with the global flag; the tokenizer relies on `lastIndex`. */
    pattern: RegExp;
    render: (match: RegExpExecArray) => TokenRender;
}

export interface EditorSchema {
    marks: InlineMark[];
    tokens: InlineToken[];
}

/** The four built-in text styles. Ordering is irrelevant here; the tokenizer sorts by
 *  delimiter length so `**` (bold) is always tried before `*` (italic). */
export const defaultMarks: InlineMark[] = [
    { name: 'bold', open: '**', close: '**', tag: 'strong', shortcut: 'b' },
    { name: 'italic', open: '*', close: '*', tag: 'em', shortcut: 'i' },
    { name: 'subscript', open: '~', close: '~', tag: 'sub' },
    { name: 'superscript', open: '^', close: '^', tag: 'sup' },
];

/**
 * Builds the figure-reference token rule. Reuses the two canonical token regexes from
 * figureTokens.ts, combined into one alternation (group 1 = stored `[figID: N]` id,
 * group 2 = raw `[fig: value]`), and resolves raw values through the same
 * `resolveRawFigValue` the document model / exporters use — so the editor's chips can
 * never drift from what the published output shows. Pass the project's lookups (from
 * `buildFigureLookups`); when omitted, every token renders as unresolved.
 */
export function figureTokenRule(lookups?: FigureLookups): InlineToken {
    const pattern = new RegExp(`${figIdTokenRegex().source}|${figRawTokenRegex().source}`, 'gi');
    return {
        name: 'figure',
        pattern,
        render: (m) => {
            let displayNum: number | undefined;
            if (lookups) {
                if (m[1] !== undefined) {
                    displayNum = lookups.idToDisplayNum.get(parseInt(m[1], 10));
                } else {
                    const value = (m[2] ?? '').trim();
                    // displayNumToFig.size === figures.length (display numbers are the
                    // 1..N array positions), which is the figureCount the exporters use;
                    // idToDisplayNum.size would undercount if two figures shared an id.
                    displayNum = resolveRawFigValue(value, lookups, lookups.displayNumToFig.size)?.displayNum;
                }
            }
            if (displayNum !== undefined) {
                return { html: escapeHTML(`(Fig. ${displayNum})`), className: 'tsk-chip' };
            }
            // Unresolved / in-progress reference: show the raw token, flagged broken.
            return { html: escapeHTML(m[0]), className: 'tsk-chip tsk-chip-broken' };
        },
    };
}
