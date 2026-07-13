import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from '../../src/editor/richText/RichTextEditor.ts';
import { captureRange, serialize, setSelection, sourceRangeOfNode } from '../../src/editor/richText/caret.ts';
import { insertToken, toggleMark } from '../../src/editor/richText/commands.ts';
import { defaultMarks, figureTokenRule } from '../../src/editor/richText/schema.ts';
import { maskTokens, tokenize, tokenSpanAt } from '../../src/editor/richText/tokenize.ts';
import type { EditorSchema } from '../../src/editor/richText/schema.ts';
import { buildFigureLookups } from '../../src/figureTokens.ts';
import { figure } from '../helpers/factories.ts';

const markSchema: EditorSchema = { marks: defaultMarks, tokens: [] };
const figureSchema: EditorSchema = {
    marks: defaultMarks,
    tokens: [figureTokenRule(buildFigureLookups([figure(10)]))],
};

class TestDataTransfer {
    effectAllowed = 'uninitialized';
    dropEffect = 'none';
    private readonly data = new Map<string, string>();

    setData(type: string, value: string): void {
        this.data.set(type, value);
    }

    getData(type: string): string {
        return this.data.get(type) ?? '';
    }

    get types(): readonly string[] {
        return [...this.data.keys()];
    }
}

function dragEvent(type: string, dataTransfer: TestDataTransfer): DragEvent {
    const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperties(event, {
        dataTransfer: { value: dataTransfer },
        clientX: { value: 0 },
        clientY: { value: 0 },
    });
    return event;
}

function host(className = ''): HTMLElement {
    const element = document.createElement('div');
    element.className = className;
    document.body.appendChild(element);
    return element;
}

function setDropCaret(root: HTMLElement, offset: number): void {
    Object.defineProperty(document, 'caretRangeFromPoint', {
        configurable: true,
        value: () => {
            const range = document.createRange();
            range.setStart(root.firstChild ?? root, offset);
            range.collapse(true);
            return range;
        },
    });
}

describe('rich-text pure transforms', () => {
    it('inserts text over a selection and positions the caret after it', () => {
        expect(insertToken('abcdef', { start: 2, end: 4 }, 'XY')).toEqual({
            value: 'abXYef',
            selection: { start: 4, end: 4 },
        });
    });

    it('wraps, unwraps, and merges a bold selection', () => {
        const bold = defaultMarks.find(mark => mark.name === 'bold')!;
        expect(toggleMark('word', { start: 0, end: 4 }, bold).value).toBe('**word**');
        expect(toggleMark('**word**', { start: 3, end: 5 }, bold).value).toBe('word');
        expect(toggleMark('**one** two', { start: 2, end: 11 }, bold).value).toBe('**one two**');
    });

    it('combines bold and italic without exposing their shared asterisk delimiters', () => {
        const bold = defaultMarks.find(mark => mark.name === 'bold')!;
        const italic = defaultMarks.find(mark => mark.name === 'italic')!;
        const boldResult = toggleMark('word', { start: 0, end: 4 }, bold);
        const combined = toggleMark(boldResult.value, boldResult.selection, italic);

        expect(combined.value).toBe('***word***');
        expect(tokenize(combined.value, markSchema)).toMatchObject([
            {
                kind: 'mark',
                mark: { name: 'bold' },
                children: [{ kind: 'mark', mark: { name: 'italic' }, children: [{ kind: 'text', value: 'word' }] }],
            },
        ]);
        expect(toggleMark(combined.value, combined.selection, italic).value).toBe('**word**');
    });

    it('tokenizes marks and masks delimiter characters inside figure tokens', () => {
        const source = '**Bold** [fig: figure-1.jpg]';
        const atoms = tokenize(source, figureSchema);
        expect(atoms.some(atom => atom.kind === 'mark')).toBe(true);
        expect(atoms.some(atom => atom.kind === 'token' && atom.src === '[fig: figure-1.jpg]')).toBe(true);
        expect(maskTokens('[fig: **not bold**]', figureSchema)).not.toContain('**not bold**');
    });

    it('keeps a token as editable text while a caret sits inside its span', () => {
        const isToken = (src: string, caret?: number): boolean =>
            tokenize(src, figureSchema, caret).some(atom => atom.kind === 'token');
        // Caret strictly inside (between the digit and the closing bracket) -> raw text.
        expect(isToken('[fig: 1]', 7)).toBe(false);
        // Caret at either boundary, or none, chips as usual.
        expect(isToken('[fig: 1]', 8)).toBe(true);
        expect(isToken('[fig: 1]', 0)).toBe(true);
        expect(isToken('[fig: 1]')).toBe(true);
        expect(tokenSpanAt('[fig: 1]', figureSchema, 7)).toEqual({ start: 0, end: 8 });
        expect(tokenSpanAt('[fig: 1]', figureSchema, 8)).toBeNull();
    });
});

describe('caret/source mapping', () => {
    it('serializes source delimiters and atomic chip values', () => {
        const root = host();
        root.innerHTML = '<strong data-open="**" data-close="**">Bold</strong><span data-src="[fig: 1]">Fig. 1</span>';
        expect(serialize(root)).toBe('**Bold**[fig: 1]');
        const chip = root.querySelector('[data-src]')!;
        expect(sourceRangeOfNode(root, chip)).toEqual({ start: 8, end: 16 });
    });

    it('round-trips a selection around marked text', () => {
        const root = host();
        root.innerHTML = '<strong data-open="**" data-close="**">Bold</strong> tail';
        setSelection(root, 2, 6);
        expect(captureRange(root)).toEqual({ start: 2, end: 6 });
    });
});

describe('RichTextEditor DOM lifecycle', () => {
    it('inverts chips intersected by the current text selection', () => {
        const root = host();
        const editor = new RichTextEditor(root, { schema: figureSchema, value: 'A[fig: 1]B' });
        const chip = root.querySelector<HTMLElement>('.tsk-chip')!;

        setSelection(root, 0, editor.getValue().length);
        document.dispatchEvent(new Event('selectionchange'));
        expect(chip.classList.contains('tsk-chip-selected')).toBe(true);

        setSelection(root, 0, 1);
        document.dispatchEvent(new Event('selectionchange'));
        expect(chip.classList.contains('tsk-chip-selected')).toBe(false);
        editor.destroy();
    });

    it('flushes a pending animation-frame edit synchronously', () => {
        const onChange = vi.fn();
        const root = host('rte-host');
        const editor = new RichTextEditor(root, { schema: markSchema, value: 'old', onChange });
        root.textContent = 'new value';
        root.dispatchEvent(new InputEvent('input', { bubbles: true }));

        expect(editor.hasPendingEdit()).toBe(true);
        editor.flushPendingEdit();

        expect(editor.getValue()).toBe('new value');
        expect(editor.hasPendingEdit()).toBe(false);
        expect(onChange).toHaveBeenLastCalledWith('new value');
        editor.destroy();
    });

    it('commits the live IME DOM without replacing it mid-composition', () => {
        const onChange = vi.fn();
        const root = host();
        const editor = new RichTextEditor(root, { schema: markSchema, value: '', onChange });
        root.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        root.textContent = 'å';

        editor.flushPendingEdit();

        expect(root.textContent).toBe('å');
        expect(editor.getValue()).toBe('å');
        expect(onChange).toHaveBeenCalledWith('å');
        editor.destroy();
    });

    it('moves selected source text between editors exactly once', () => {
        const sourceHost = host();
        const targetHost = host();
        const sourceChange = vi.fn();
        const targetChange = vi.fn();
        const source = new RichTextEditor(sourceHost, { schema: markSchema, value: 'abc', onChange: sourceChange });
        const target = new RichTextEditor(targetHost, { schema: markSchema, value: 'XYZ', onChange: targetChange });
        const transfer = new TestDataTransfer();

        setSelection(sourceHost, 0, 3);
        sourceHost.dispatchEvent(dragEvent('dragstart', transfer));
        setDropCaret(targetHost, 1);
        targetHost.dispatchEvent(dragEvent('drop', transfer));

        expect(source.getValue()).toBe('');
        expect(target.getValue()).toBe('XabcYZ');
        expect(sourceChange).toHaveBeenCalledTimes(1);
        expect(targetChange).toHaveBeenCalledTimes(1);
        source.destroy();
        target.destroy();
    });

    it('moves a figure chip using its source token rather than display text', () => {
        const sourceHost = host();
        const targetHost = host();
        const source = new RichTextEditor(sourceHost, { schema: figureSchema, value: 'A[fig: 1]B' });
        const target = new RichTextEditor(targetHost, { schema: figureSchema, value: 'XY' });
        const transfer = new TestDataTransfer();
        const chip = sourceHost.querySelector<HTMLElement>('[data-src]')!;

        chip.dispatchEvent(dragEvent('dragstart', transfer));
        setDropCaret(targetHost, 1);
        targetHost.dispatchEvent(dragEvent('drop', transfer));

        expect(source.getValue()).toBe('AB');
        expect(target.getValue()).toBe('X[fig: 1]Y');
        expect(transfer.getData('text/plain')).toBe('[fig: 1]');
        source.destroy();
        target.destroy();
    });

    it('treats an external drop as an insert when an earlier internal drag went stale', () => {
        const sourceHost = host();
        const targetHost = host();
        const source = new RichTextEditor(sourceHost, { schema: markSchema, value: 'abc' });
        const target = new RichTextEditor(targetHost, { schema: markSchema, value: 'XYZ' });
        const interruptedTransfer = new TestDataTransfer();

        setSelection(sourceHost, 0, 3);
        sourceHost.dispatchEvent(dragEvent('dragstart', interruptedTransfer));

        // Simulate the acknowledged lost-dragend case followed by an unrelated OS drag.
        const externalTransfer = new TestDataTransfer();
        externalTransfer.setData('text/plain', 'Q');
        setDropCaret(targetHost, 1);
        targetHost.dispatchEvent(dragEvent('drop', externalTransfer));

        expect(source.getValue()).toBe('abc');
        expect(target.getValue()).toBe('XQYZ');
        source.destroy();
        target.destroy();
    });

    it('refreshes token rendering when external lookup state changes without a source change', () => {
        const root = host();
        let label = 'Old label';
        const dynamicSchema: EditorSchema = {
            marks: [],
            tokens: [{
                name: 'dynamic',
                pattern: /\[dynamic\]/g,
                render: () => ({ html: label, className: 'tsk-chip' }),
            }],
        };
        const editor = new RichTextEditor(root, { schema: dynamicSchema, value: '[dynamic]' });
        expect(root.textContent).toBe('Old label');

        label = 'New label';
        editor.setValue('[dynamic]');

        expect(root.textContent).toBe('New label');
        editor.destroy();
    });

    it('lets a two-digit figure reference be typed inside existing brackets', () => {
        const root = host('rte-host');
        // "[fig:]" is not a token yet (the value capture needs a non-bracket char).
        const editor = new RichTextEditor(root, { schema: figureSchema, value: '[fig:]' });
        expect(root.querySelector('[data-src]')).toBeNull();

        // Type "1" just before the closing bracket: DOM becomes "[fig:1]", caret after the 1.
        root.textContent = '[fig:1]';
        setSelection(root, 6, 6);
        root.dispatchEvent(new InputEvent('input', { bubbles: true }));
        editor.flushPendingEdit();

        // The token must stay editable (no chip) with the caret still inside it.
        expect(root.querySelector('[data-src]')).toBeNull();
        expect(editor.getValue()).toBe('[fig:1]');
        expect(captureRange(root)).toEqual({ start: 6, end: 6 });

        // Now the second digit lands inside, forming a real two-digit reference.
        root.textContent = '[fig:12]';
        setSelection(root, 7, 7);
        root.dispatchEvent(new InputEvent('input', { bubbles: true }));
        editor.flushPendingEdit();

        expect(editor.getValue()).toBe('[fig:12]');
        expect(root.querySelector('[data-src]')).toBeNull();
        editor.destroy();
    });

    it('re-locks the reference into a chip once the caret leaves it', () => {
        const root = host('rte-host');
        const editor = new RichTextEditor(root, { schema: figureSchema, value: '[fig:]' });
        root.textContent = '[fig:10]';
        setSelection(root, 7, 7);
        root.dispatchEvent(new InputEvent('input', { bubbles: true }));
        editor.flushPendingEdit();
        expect(root.querySelector('[data-src]')).toBeNull();

        // Move the caret past the closing bracket (an arrow key fires no input event).
        setSelection(root, 8, 8);
        document.dispatchEvent(new Event('selectionchange'));
        editor.flushPendingEdit();

        const chip = root.querySelector('[data-src]');
        expect(chip).not.toBeNull();
        expect(chip!.getAttribute('data-src')).toBe('[fig:10]');
        expect(editor.getValue()).toBe('[fig:10]');
        editor.destroy();
    });
});
