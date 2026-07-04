// The editor is configured by a *schema*: inline "marks" (paired markdown delimiters
// like bold/italic) and "tokens" (atomic regex-matched chips like figure references).

import { escapeHTML } from '../../utils.ts';
import { figIdTokenRegex, figRawTokenRegex, resolveRawFigValue } from '../../figureTokens.ts';
import type { FigureLookups } from '../../figureTokens.ts';

export interface InlineMark {
    name: string;
    open: string;
    close: string;
    tag: string;
    className?: string;
    shortcut?: string;
}

export interface TokenRender {
    html: string;
    className: string;
}

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

// Ordering here is irrelevant; the tokenizer sorts by delimiter length so `**` (bold)
// is always tried before `*` (italic).
export const defaultMarks: InlineMark[] = [
    { name: 'bold', open: '**', close: '**', tag: 'strong', shortcut: 'b' },
    { name: 'italic', open: '*', close: '*', tag: 'em', shortcut: 'i' },
    { name: 'subscript', open: '~', close: '~', tag: 'sub' },
    { name: 'superscript', open: '^', close: '^', tag: 'sup' },
];

// Pass lookups as a getter (re-read every render) so a live editor's chips renumber
// on figure reorder without re-mounting.
export function figureTokenRule(lookups?: FigureLookups | (() => FigureLookups)): InlineToken {
    const pattern = new RegExp(`${figIdTokenRegex().source}|${figRawTokenRegex().source}`, 'gi');
    const getLookups = typeof lookups === 'function' ? lookups : () => lookups;
    return {
        name: 'figure',
        pattern,
        render: (m) => {
            let displayNum: number | undefined;
            const lookups = getLookups();
            if (lookups) {
                if (m[1] !== undefined) {
                    displayNum = lookups.idToDisplayNum.get(parseInt(m[1], 10));
                } else {
                    const value = (m[2] ?? '').trim();
                    // displayNumToFig.size matches the exporters' figureCount; idToDisplayNum
                    // would undercount if two figures shared an id.
                    displayNum = resolveRawFigValue(value, lookups, lookups.displayNumToFig.size)?.displayNum;
                }
            }
            if (displayNum !== undefined) {
                return { html: escapeHTML(`(Fig. ${displayNum})`), className: 'tsk-chip' };
            }
            return { html: escapeHTML(m[0]), className: 'tsk-chip tsk-chip-broken' };
        },
    };
}