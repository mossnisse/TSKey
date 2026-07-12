// Atom tree -> HTML for the contenteditable projection. Marks render as their visual
// tag with delimiters hidden in data-open/data-close; tokens render as atomic chips
// carrying data-src — caret.ts reconstructs the hidden source purely from these attrs.

import { escapeHTML } from '../../utils.ts';
import type { Atom } from './tokenize.ts';

export function renderAtoms(atoms: readonly Atom[]): string {
    let html = '';
    for (const atom of atoms) {
        if (atom.kind === 'text') {
            html += escapeHTML(atom.value);
        } else if (atom.kind === 'token') {
            html += `<span class="${escapeHTML(atom.className)}" contenteditable="false" draggable="true" data-src="${escapeHTML(atom.src)}">${atom.html}</span>`;
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