// Mount/lifecycle adapter: lets a live RichTextEditor stand in for the plain textareas
// the card reconcilers used to render. Each instance is stashed on its host (`_rte`).

import { RichTextEditor, defaultMarks, figureTokenRule } from '../editor/richText/index.ts';
import type { EditorSchema } from '../editor/richText/index.ts';
import { buildFigureLookups } from '../figureTokens.ts';
import type { FigureLookups } from '../figureTokens.ts';
import type { KeyStore, Figure } from '../store';

interface RteHost extends HTMLElement { _rte?: RichTextEditor; }

export interface RichTextFieldOptions {
    schema: EditorSchema;
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
}

export function mountRichTextField(host: HTMLElement, opts: RichTextFieldOptions): RichTextEditor {
    const editor = new RichTextEditor(host, {
        schema: opts.schema,
        value: opts.value,
        placeholder: opts.placeholder,
        onChange: opts.onChange,
    });
    (host as RteHost)._rte = editor;
    if (opts.schema.tokens.length > 0) host.dataset.rteFigures = 'true';
    return editor;
}

export function getFieldEditor(host: HTMLElement | null): RichTextEditor | undefined {
    return host ? (host as RteHost)._rte : undefined;
}

// Skips the focused editor (it's the source of truth) and one with an uncommitted
// pending edit — otherwise a refresh racing the editor's rAF commit could drop a
// just-typed character by rewriting the DOM with a momentarily-stale store value.
export function syncRichTextField(host: HTMLElement, value: string): void {
    const rte = (host as RteHost)._rte;
    if (!rte) return;
    if (document.activeElement === host || rte.hasPendingEdit()) return;
    rte.setValue(value);
}

export function destroyRichTextFieldsIn(root: HTMLElement): void {
    const hosts: HTMLElement[] = [...root.querySelectorAll<HTMLElement>('.rte-host')];
    if (root.matches?.('.rte-host')) hosts.push(root);
    for (const h of hosts) {
        const rte = (h as RteHost)._rte;
        if (rte) {
            rte.destroy();
            delete (h as RteHost)._rte;
        }
    }
}

// Cached by array reference: every store mutation replaces `state.figures` with a new
// array, so an unchanged reference means lookups are still valid — avoids rebuilding
// on every chip re-render (the token rule's getter runs per chip per keystroke).
let cachedFigures: readonly Figure[] | null = null;
let cachedLookups: FigureLookups | null = null;
function liveFigureLookups(store: KeyStore): FigureLookups {
    const figures = store.getFigures();
    if (figures !== cachedFigures) {
        cachedFigures = figures;
        cachedLookups = buildFigureLookups(figures);
    }
    return cachedLookups!;
}

export function figureFieldSchema(store: KeyStore): EditorSchema {
    return { marks: defaultMarks, tokens: [figureTokenRule(() => liveFigureLookups(store))] };
}

export function markOnlyFieldSchema(): EditorSchema {
    return { marks: defaultMarks, tokens: [] };
}

/** Synchronizes every mounted editor below `root` before the document is persisted. */
export function flushRichTextFieldsIn(root: ParentNode): void {
    for (const host of root.querySelectorAll<HTMLElement>('.rte-host')) {
        (host as RteHost)._rte?.flushPendingEdit();
    }
}
