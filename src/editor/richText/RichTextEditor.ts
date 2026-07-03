// editor/richText/RichTextEditor.ts
// Binds the pure pieces (tokenize -> render, caret map, commands) to a host <div>,
// turning it into a hybrid rich-text editor. The source string is the single source of
// truth; the contenteditable DOM is a disposable projection re-rendered on every edit,
// with the caret captured/restored in source-offset space around each re-render.
// Enter, paste, and drop are all intercepted and routed through plain source-string
// splices, so the browser never plants foreign structure (divs, brs, styled spans)
// that the serializer can't account for.

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
    // IME guard: never rip the DOM out from under an in-progress composition — the
    // input method targets a live text node. Re-sync once the text is committed.
    private readonly onCompositionStart = () => {
        this.composing = true;
    };
    private readonly onCompositionEnd = () => {
        this.composing = false;
        this.scheduleRerender();
    };
    // Some browsers don't fire compositionend when focus is lost mid-composition,
    // which would leave `composing` stuck true and make onInput ignore every future
    // keystroke. Clearing it on blur guarantees the editor always recovers.
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
        host.addEventListener('compositionstart', this.onCompositionStart);
        host.addEventListener('compositionend', this.onCompositionEnd);
        host.addEventListener('blur', this.onBlur);

        this.render();
    }

    // ---- public API -------------------------------------------------------

    getValue(): string {
        // A pending re-render means this.value hasn't absorbed the latest DOM edit
        // yet — read the DOM directly so callers never see a stale value.
        return this.rafId !== null ? serialize(this.host) : this.value;
    }

    setValue(next: string): void {
        // Don't clobber an in-progress edit. Like the app's syncField (ui/shared.ts),
        // which skips the focused element, a setValue that merely echoes back what the
        // user has already typed (e.g. a store refresh after onChange) must not rewrite
        // the DOM and drop the caret. getValue() reflects the live DOM when an edit is
        // pending, so this equality holds for the echo case even mid-keystroke.
        if (document.activeElement === this.host && next === this.getValue()) return;

        // Otherwise setValue is authoritative: discard any pending DOM read-back, and
        // re-render even for an equal string when a discarded edit left the DOM stale.
        const hadPending = this.rafId !== null;
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (next === this.value && !hadPending) return;
        this.value = next;
        this.render();
    }

    /** Applies a mark by name to the current selection (no-op if the name is unknown). */
    toggleMark(name: string): void {
        const mark = this.schema.marks.find(m => m.name === name);
        // Pass the token-masked source so delimiter detection matches the tokenizer's,
        // and a delimiter char inside a `[fig: ...]` token is never toggled.
        if (mark) this.applyCommand(sel => toggleMark(this.value, sel, mark, maskTokens(this.value, this.schema)));
    }

    /** Inserts a raw token source (e.g. `[fig: 1]`) at the current selection. */
    insertToken(src: string): void {
        this.applyCommand(sel => insertToken(this.value, sel, src));
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
        this.host.removeEventListener('compositionstart', this.onCompositionStart);
        this.host.removeEventListener('compositionend', this.onCompositionEnd);
        this.host.removeEventListener('blur', this.onBlur);
        this.host.removeAttribute('contenteditable');
        this.changeHandlers.clear();
    }

    // ---- internals --------------------------------------------------------

    /** Queues a DOM read-back + re-render on the next frame (one per frame at most). */
    private scheduleRerender(): void {
        if (this.rafId !== null) return;
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            this.rerenderFromDom();
        });
    }

    /** Reads the user's edit back out of the DOM, re-renders, and restores the caret. */
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

    /** The projection HTML for the current value. A trailing '\n' gets a placeholder
     *  <br> so the browser will park the caret on the empty last line; the <br>
     *  serializes to '' and has zero source length, so it never leaks into the value. */
    private renderHtml(): string {
        let html = renderAtoms(tokenize(this.value, this.schema));
        if (this.value.endsWith('\n')) html += '<br>';
        return html;
    }

    /** Runs a queued DOM read-back immediately so commands never see a stale value. */
    private flushPendingRerender(): void {
        if (this.rafId === null) return;
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
        this.rerenderFromDom();
    }

    /** Applies a pure command, then renders and restores the returned selection. */
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

        // Enter (any modifier): insert a literal '\n' into the source (rendered via
        // white-space: pre-wrap). We intercept every Enter chord — not just the bare
        // key — because a fall-through would let the browser plant a <div>/<br> the
        // source string cannot represent, and serialize() would silently drop it.
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

    /** Force plain-text paste so pasted rich content never pollutes the source string. */
    private handlePaste(e: ClipboardEvent): void {
        e.preventDefault();
        const text = e.clipboardData?.getData('text/plain') ?? '';
        if (!text) return;
        this.applyCommand(sel => insertToken(this.value, sel, text));
    }

    /** Same guard for drag-and-drop: dropped rich content is inserted as plain text. */
    private handleDrop(e: DragEvent): void {
        e.preventDefault();
        const text = e.dataTransfer?.getData('text/plain') ?? '';
        if (!text) return;
        // Land the drop at the pointer. Chromium exposes caretRangeFromPoint; Firefox
        // only caretPositionFromPoint — without this fallback a Firefox drop would land
        // at the stale previous caret instead of where the user dropped.
        const range = this.caretRangeAtPoint(e.clientX, e.clientY);
        if (range && this.host.contains(range.startContainer)) {
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
        this.host.focus();
        this.applyCommand(sel => insertToken(this.value, sel, text));
    }

    /** A collapsed Range at viewport point (x, y), across Chromium and Firefox APIs. */
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
