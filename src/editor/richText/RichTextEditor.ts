// The source string is the single source of truth; the contenteditable DOM is a
// disposable projection re-rendered on every edit. Enter/paste/drop are intercepted and
// routed through source-string splices so the browser never plants foreign DOM structure.

import type { EditorSchema, InlineMark } from './schema.ts';
import { tokenize, maskTokens } from './tokenize.ts';
import { renderAtoms } from './render.ts';
import { serialize, captureRange, setSelection } from './caret.ts';
import { toggleMark, insertToken } from './commands.ts';
import type { Selection } from './commands.ts';

export interface RichTextEditorOptions {
    schema: EditorSchema;
    value?: string;
    placeholder?: string;
    onChange?: (value: string) => void;
}

type ChangeHandler = (value: string) => void;

export class RichTextEditor {
    private readonly host: HTMLElement;
    private readonly schema: EditorSchema;
    private value: string;
    private readonly changeHandlers = new Set<ChangeHandler>();
    private rafId: number | null = null;
    private composing = false;
    private readonly onInput = () => {
        if (!this.composing) this.scheduleRerender();
    };
    private readonly onKeydown = (e: KeyboardEvent) => this.handleKeydown(e);
    private readonly onPaste = (e: ClipboardEvent) => this.handlePaste(e);
    private readonly onDrop = (e: DragEvent) => this.handleDrop(e);
    // The source selection of a text drag that started in THIS editor, so a drop
    // here is a true move (source removed) rather than a duplicating insert.
    private dragSourceSel: Selection | null = null;
    private readonly onDragStart = () => {
        this.dragSourceSel = captureRange(this.host);
    };
    private readonly onDragEnd = () => {
        this.dragSourceSel = null;
    };
    // Never re-render mid-composition: it would rip the DOM out from under the IME.
    private readonly onCompositionStart = () => {
        this.composing = true;
    };
    private readonly onCompositionEnd = () => {
        this.composing = false;
        this.scheduleRerender();
    };
    // Some browsers skip compositionend on blur mid-composition, which would leave
    // `composing` stuck true; clear it here so the editor always recovers.
    private readonly onBlur = () => {
        if (this.composing) {
            this.composing = false;
            this.scheduleRerender();
        }
    };

    constructor(host: HTMLElement, opts: RichTextEditorOptions) {
        this.host = host;
        this.schema = opts.schema;
        this.value = opts.value ?? '';

        host.classList.add('tsk-rte');
        host.setAttribute('contenteditable', 'true');
        host.setAttribute('role', 'textbox');
        host.setAttribute('aria-multiline', 'true');
        host.setAttribute('spellcheck', 'true');
        if (opts.placeholder) host.dataset.placeholder = opts.placeholder;

        if (opts.onChange) this.changeHandlers.add(opts.onChange);

        host.addEventListener('input', this.onInput);
        host.addEventListener('keydown', this.onKeydown);
        host.addEventListener('paste', this.onPaste);
        host.addEventListener('drop', this.onDrop);
        host.addEventListener('dragstart', this.onDragStart);
        host.addEventListener('dragend', this.onDragEnd);
        host.addEventListener('compositionstart', this.onCompositionStart);
        host.addEventListener('compositionend', this.onCompositionEnd);
        host.addEventListener('blur', this.onBlur);

        this.render();
    }

    // ---- public API -------------------------------------------------------

    getValue(): string {
        // While a re-render is queued, this.value is stale — read the DOM directly.
        return this.rafId !== null ? serialize(this.host) : this.value;
    }

    /** True while a DOM edit hasn't been read back into `value` yet (see syncRichTextField). */
    hasPendingEdit(): boolean {
        return this.rafId !== null;
    }

    setValue(next: string): void {
        // Don't clobber an in-progress edit: skip when this merely echoes back what's
        // already live in the DOM (e.g. a store refresh after onChange).
        if (document.activeElement === this.host && next === this.getValue()) return;

        const hadPending = this.rafId !== null;
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (next === this.value && !hadPending) return;
        this.value = next;
        this.render();
    }

    toggleMark(name: string): void {
        const mark = this.schema.marks.find(m => m.name === name);
        // Mask tokens first so a delimiter char inside a `[fig: ...]` token is never toggled.
        if (mark) this.applyCommand(sel => toggleMark(this.value, sel, mark, maskTokens(this.value, this.schema)));
    }

    /** Inserts at `at` instead of the live selection when a focus-stealing picker
     *  captured the selection before the caret position could be used. */
    insertToken(src: string, at?: Selection): void {
        this.applyCommand(sel => insertToken(this.value, at ?? sel, src));
    }

    getSelection(): Selection | null {
        return captureRange(this.host);
    }

    focus(): void {
        this.host.focus();
    }

    on(_event: 'change', handler: ChangeHandler): () => void {
        this.changeHandlers.add(handler);
        return () => this.changeHandlers.delete(handler);
    }

    destroy(): void {
        if (this.rafId !== null) cancelAnimationFrame(this.rafId);
        this.host.removeEventListener('input', this.onInput);
        this.host.removeEventListener('keydown', this.onKeydown);
        this.host.removeEventListener('paste', this.onPaste);
        this.host.removeEventListener('drop', this.onDrop);
        this.host.removeEventListener('dragstart', this.onDragStart);
        this.host.removeEventListener('dragend', this.onDragEnd);
        this.host.removeEventListener('compositionstart', this.onCompositionStart);
        this.host.removeEventListener('compositionend', this.onCompositionEnd);
        this.host.removeEventListener('blur', this.onBlur);
        this.host.removeAttribute('contenteditable');
        this.changeHandlers.clear();
    }

    // ---- internals --------------------------------------------------------

    private scheduleRerender(): void {
        if (this.rafId !== null) return;
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            this.rerenderFromDom();
        });
    }

    private rerenderFromDom(): void {
        const caret = captureRange(this.host);
        const next = serialize(this.host);
        const changed = next !== this.value;
        this.value = next;
        this.host.innerHTML = this.renderHtml();
        if (caret) setSelection(this.host, caret.start, caret.end);
        this.host.classList.toggle('tsk-rte-empty', this.value.length === 0);
        if (changed) this.emitChange();
    }

    // Trailing '\n' gets a placeholder <br> so the caret can park on the empty last
    // line; it serializes to '' so it never leaks back into the value.
    private renderHtml(): string {
        let html = renderAtoms(tokenize(this.value, this.schema));
        if (this.value.endsWith('\n')) html += '<br>';
        return html;
    }

    private flushPendingRerender(): void {
        if (this.rafId === null) return;
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
        this.rerenderFromDom();
    }

    private applyCommand(run: (sel: Selection) => { value: string; selection: Selection }): void {
        this.flushPendingRerender();
        const sel = captureRange(this.host) ?? { start: this.value.length, end: this.value.length };
        const result = run(sel);
        const changed = result.value !== this.value;
        this.value = result.value;
        this.render();
        this.focus();
        setSelection(this.host, result.selection.start, result.selection.end);
        if (changed) this.emitChange();
    }

    private render(): void {
        this.host.innerHTML = this.renderHtml();
        this.host.classList.toggle('tsk-rte-empty', this.value.length === 0);
    }

    private handleKeydown(e: KeyboardEvent): void {
        if (e.isComposing) return;

        // Intercept every Enter chord, not just the bare key: a fall-through would let
        // the browser plant a <div>/<br> the source string can't represent.
        if (e.key === 'Enter') {
            e.preventDefault();
            this.applyCommand(sel => insertToken(this.value, sel, '\n'));
            return;
        }

        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        const key = e.key.toLowerCase();
        const mark = this.schema.marks.find((m: InlineMark) => m.shortcut === key);
        if (mark) {
            e.preventDefault();
            this.toggleMark(mark.name);
        }
    }

    private handlePaste(e: ClipboardEvent): void {
        e.preventDefault();
        const text = e.clipboardData?.getData('text/plain') ?? '';
        if (!text) return;
        this.applyCommand(sel => insertToken(this.value, sel, text));
    }

    private handleDrop(e: DragEvent): void {
        e.preventDefault();
        const text = e.dataTransfer?.getData('text/plain') ?? '';
        const source = this.dragSourceSel;
        this.dragSourceSel = null;
        if (!text) return;
        const range = this.caretRangeAtPoint(e.clientX, e.clientY);
        if (range && this.host.contains(range.startContainer)) {
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
        this.host.focus();
        // A drag that started in this editor is a MOVE: remove the dragged
        // source text and shift the drop position past the removal. Drags from
        // outside (another field, another app) just insert.
        this.applyCommand(sel => {
            let value = this.value;
            let at = sel.start;
            if (source && source.end > source.start) {
                value = value.slice(0, source.start) + value.slice(source.end);
                if (at >= source.end) at -= source.end - source.start;
                else if (at > source.start) at = source.start; // dropped onto itself
            }
            const caret = at + text.length;
            return {
                value: value.slice(0, at) + text + value.slice(at),
                selection: { start: caret, end: caret },
            };
        });
    }

    // Chromium exposes caretRangeFromPoint; Firefox only caretPositionFromPoint.
    private caretRangeAtPoint(x: number, y: number): Range | null {
        const doc = document as Document & {
            caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
        };
        if (typeof doc.caretRangeFromPoint === 'function') {
            return doc.caretRangeFromPoint(x, y);
        }
        const pos = doc.caretPositionFromPoint?.(x, y);
        if (!pos) return null;
        const range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
        return range;
    }

    private emitChange(): void {
        for (const handler of this.changeHandlers) handler(this.value);
    }
}