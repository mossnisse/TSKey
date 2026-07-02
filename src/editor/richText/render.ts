// editor/richText/render.ts
// Pure transform: Atom tree -> HTML string for the contenteditable projection.
//
// The render is *hybrid*: marks render as their visual tag (bold looks bold) with the
// markdown delimiters hidden, and tokens render as atomic, non-editable chips. The
// caret math (caret.ts) and DOM->source read-back (serialize) reconstruct the hidden
// source purely from data-* attributes, so every element records exactly what it hides:
//   - a mark wrapper carries data-open / data-close (its hidden delimiter strings)
//   - a token chip carries data-src (its full raw source) and contenteditable="false"

import { escapeHTML } from '../../utils.ts';
import type { Atom } from './tokenize.ts';

export function renderAtoms(atoms: readonly Atom[]): string {
    let html = '';
    for (const atom of atoms) {
        if (atom.kind === 'text') {
            html += escapeHTML(atom.value);
        } else if (atom.kind === 'token') {
            html += `<span class="${escapeHTML(atom.className)}" contenteditable="false" data-src="${escapeHTML(atom.src)}">${atom.html}</span>`;
        } else {
            const { tag, open, close, className } = atom.mark;
            const cls = className ? ` class="${escapeHTML(className)}"` : '';
            html += `<${tag}${cls} data-open="${escapeHTML(open)}" data-close="${escapeHTML(close)}">`
                + renderAtoms(atom.children)
                + `</${tag}>`;
        }
    }
    return html;
}
