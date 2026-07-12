// The source string is the single source of truth; the contenteditable DOM is a
// disposable projection re-rendered on every edit. Enter/paste/drop are intercepted and
// routed through source-string splices so the browser never plants foreign DOM structure.

import type { EditorSchema, InlineMark } from './schema.ts';
import { tokenize, maskTokens } from './tokenize.ts';
import { renderAtoms } from './render.ts';
import { serialize, captureRange, setSelection, sourceRangeOfNode } from './caret.ts';
import { toggleMark, insertToken } from './commands.ts';
import type { Selection } from './commands.ts';

export interface RichTextEditorOptions {
    schema: EditorSchema;
    value?: string;
    placeholder?: string;
    onChange?: (value: string) => void;
}

type ChangeHandler = (value: string) => void;

// The one in-flight drag, shared across ALL editor instances so a drop in one editor
// can complete a cross-editor move by removing the dragged span from the editor the
// drag started in. `text` is the source slice the span held at dragstart; a drop
// re-verifies it before removing anything, so a record stranded by an interrupted
// drag (dragend can be lost when a re-render detaches the drag source mid-drag)
// degrades to a plain insert instead of deleting unrelated content.
interface ActiveDrag {
    editor: RichTextEditor;
    sel: Selection;
    text: string;
}
let activeDrag: ActiveDrag | null = null;

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
    // Explicitly accept dragenter/dragover for drags that started in one of our
    // editors. Left to itself, the browser intersects effectAllowed with an operation
    // it picks for the target, and for element drags (a bare chip) over editable
    // content Chromium can pick 'copy' — which a 'move'-only drag doesn't satisfy, so
    // the drop is refused outright (no-drop cursor, drop never fires). External drags
    // (text from another app) keep the native editable handling.
    private readonly onDragOver = (e: DragEvent) => {
        if (!activeDrag) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    };
    // The browser's default drag payload is the RENDERED text (Selection.toString()
    // even omits contenteditable=false chips entirely), so an uncorrected drop would
    // re-insert display text and destroy the dragged tokens. Every drag that starts
    // here instead carries its SOURCE slice and records what it dragged in activeDrag.
    private readonly onDragStart = (e: DragEvent) => {
        const target = e.target instanceof Element ? e.target : null;
        const chipEl = target?.closest('[data-src]') as HTMLElement | null;
        const chip = chipEl && chipEl !== this.host && this.host.contains(chipEl) ? chipEl : null;
        const chipSpan = chip ? sourceRangeOfNode(this.host, chip) : null;
        const sel = captureRange(this.host);

        // A drag grabbed by a chip that sits INSIDE a marked selection drags the whole
        // selection (that's what the browser picked up), not just the chip.
        const selDrag = sel && sel.end > sel.start
            && (!chipSpan || (chipSpan.start >= sel.start && chipSpan.end <= sel.end));
        const span = selDrag ? sel : chipSpan;
        if (!span) {
            activeDrag = null;
            return;
        }
        const text = selDrag ? this.getValue().slice(span.start, span.end) : (chip!.dataset.src ?? '');
        if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', text);
            // Keep 'move' (and for selections the browser's own default, also move):
            // 'copyMove' would flip the spec's default dragover dropEffect to 'copy',
            // showing a copy cursor over drop targets.
            if (!selDrag) e.dataTransfer.effectAllowed = 'move';
        }
        activeDrag = { editor: this, sel: span, text };
    };
    private readonly onDragEnd = () => {
        activeDrag = null;
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
        host.addEventListener('dragenter', this.onDragOver);
        host.addEventListener('dragover', this.onDragOver);
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
        if (activeDrag?.editor === this) activeDrag = null;
        if (this.rafId !== null) cancelAnimationFrame(this.rafId);
        this.host.removeEventListener('input', this.onInput);
        this.host.removeEventListener('keydown', this.onKeydown);
        this.host.removeEventListener('paste', this.onPaste);
        this.host.removeEventListener('drop', this.onDrop);
        this.host.removeEventListener('dragenter', this.onDragOver);
        this.host.removeEventListener('dragover', this.onDragOver);
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
        const dt = e.dataTransfer;
        const drag = activeDrag;
        activeDrag = null;
        // Our own record carries the same payload as text/plain — fall back to it in
        // case a drag store delivers the data blank.
        const text = (dt?.getData('text/plain') ?? '') || (drag?.text ?? '');
        if (!text) return;
        // A drag that started in one of our editors is always a MOVE. (Don't read
        // dt.dropEffect to detect Ctrl-copy: at drop time it merely echoes the
        // dragover default, which is 'copy' for several effectAllowed values.)
        const source = drag && drag.sel.end > drag.sel.start ? drag : null;
        // The move is performed here in source space; reporting 'move' back would ALSO
        // trigger the browser's own dragend deletion of the dragged selection.
        if (drag && dt) dt.dropEffect = 'copy';
        const range = this.caretRangeAtPoint(e.clientX, e.clientY);
        if (range && this.host.contains(range.startContainer)) {
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
        this.host.focus();
        // A drag from another editor completes as a move by removing the dragged span
        // there; one from this editor is removed inside the same splice, shifting the
        // drop position past the removal. Drags from outside the app just insert.
        if (source && source.editor !== this) {
            source.editor.removeSpan(source.sel, source.text);
        }
        this.applyCommand(sel => {
            let value = this.value;
            let at = sel.start;
            if (source && source.editor === this
                && value.slice(source.sel.start, source.sel.end) === source.text) {
                value = value.slice(0, source.sel.start) + value.slice(source.sel.end);
                if (at >= source.sel.end) at -= source.sel.end - source.sel.start;
                else if (at > source.sel.start) at = source.sel.start; // dropped onto itself
            }
            const caret = at + text.length;
            return {
                value: value.slice(0, at) + text + value.slice(at),
                selection: { start: caret, end: caret },
            };
        });
    }

    /** Completes a cross-editor move on the drag's SOURCE editor: removes the dragged
     *  span without touching focus or the document selection (both belong to the drop
     *  target). Skips silently unless the span still holds exactly the dragged text. */
    private removeSpan(sel: Selection, expected: string): void {
        this.flushPendingRerender();
        if (this.value.slice(sel.start, sel.end) !== expected) return;
        this.value = this.value.slice(0, sel.start) + this.value.slice(sel.end);
        this.render();
        this.emitChange();
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