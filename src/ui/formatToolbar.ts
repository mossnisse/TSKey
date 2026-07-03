// ui/formatToolbar.ts
// A single floating formatting toolbar shared by every mounted rich-text field. It
// appears above a non-empty selection inside any `.rte-host` and offers bold/italic/
// subscript/superscript (and, for figure-aware fields, an insert-figure button that
// opens the figure picker). Modeled on popover.ts, but two things differ by necessity:
// its buttons use mousedown+preventDefault so clicking one never blurs the editor (the
// selection must survive), and it persists across clicks — dismissing only when the
// selection collapses / leaves an editor, on Escape, or on teardown.

import type { KeyStore } from '../store';
import { getFieldEditor } from './richTextField.ts';
import { openFigureReferencePicker } from '../events/figureEvents.ts';

const MARK_BUTTONS: ReadonlyArray<{ mark: string; title: string; html: string }> = [
    { mark: 'bold', title: 'Bold (Ctrl/Cmd+B)', html: '<b>B</b>' },
    { mark: 'italic', title: 'Italic (Ctrl/Cmd+I)', html: '<i>I</i>' },
    { mark: 'subscript', title: 'Subscript', html: 'x<sub>2</sub>' },
    { mark: 'superscript', title: 'Superscript', html: 'x<sup>2</sup>' },
];

let toolbar: HTMLElement | null = null;
let currentHost: HTMLElement | null = null;
let rafId: number | null = null;
let pickerStore: KeyStore | null = null;
let pickerSignal: AbortSignal | null = null;

/** The `.rte-host` a node lives in, or null. */
function closestHost(node: Node | null): HTMLElement | null {
    if (!node) return null;
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    return (el?.closest('.rte-host') as HTMLElement | null) ?? null;
}

/** The single editor host a non-empty selection sits entirely within, or null. */
function hostFromSelection(): HTMLElement | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const anchorHost = closestHost(sel.anchorNode);
    if (!anchorHost || anchorHost !== closestHost(sel.focusNode)) return null;
    return anchorHost;
}

function build(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'format-toolbar';
    el.setAttribute('role', 'toolbar');
    el.style.display = 'none';
    el.innerHTML =
        MARK_BUTTONS.map(b => `<button type="button" data-mark="${b.mark}" title="${b.title}">${b.html}</button>`).join('') +
        `<button type="button" data-fig title="Insert figure reference (Alt+F)">Fig</button>`;

    // Never blur the editor: a toolbar mousedown must not steal the selection.
    el.addEventListener('mousedown', e => e.preventDefault());

    el.addEventListener('click', e => {
        const btn = (e.target as HTMLElement).closest('button');
        if (!btn || !currentHost) return;
        const mark = btn.getAttribute('data-mark');
        if (mark) {
            getFieldEditor(currentHost)?.toggleMark(mark);
        } else if (btn.hasAttribute('data-fig') && pickerStore && pickerSignal) {
            // The editor still holds focus + selection (mousedown was prevented), so the
            // picker resolves this field as its target and inserts at the live caret.
            const r = el.getBoundingClientRect();
            openFigureReferencePicker(pickerStore, r.left, r.bottom + 4, pickerSignal);
        }
    });
    return el;
}

function hide(): void {
    if (toolbar) toolbar.style.display = 'none';
    currentHost = null;
}

function reposition(): void {
    rafId = null;
    const host = hostFromSelection();
    if (!host) { hide(); return; }
    currentHost = host;

    if (!toolbar) {
        toolbar = build();
        document.body.appendChild(toolbar);
    }
    const figBtn = toolbar.querySelector('[data-fig]') as HTMLElement;
    figBtn.style.display = host.dataset.rteFigures === 'true' ? '' : 'none';

    // Show (hidden) to measure, then place above the selection, flipping below when the
    // top would clip, and clamping horizontally into the viewport.
    toolbar.style.display = 'flex';
    toolbar.style.visibility = 'hidden';
    const rect = window.getSelection()!.getRangeAt(0).getBoundingClientRect();
    const tb = toolbar.getBoundingClientRect();
    let top = rect.top - tb.height - 8;
    if (top < 4) top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - tb.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tb.width - 8));
    toolbar.style.top = `${top}px`;
    toolbar.style.left = `${left}px`;
    toolbar.style.visibility = 'visible';
}

function schedule(): void {
    if (rafId === null) rafId = requestAnimationFrame(reposition);
}

/** Wires the shared selection toolbar for the app's lifetime. */
export function setupFormatToolbar(store: KeyStore, signal: AbortSignal): void {
    pickerStore = store;
    pickerSignal = signal;

    document.addEventListener('selectionchange', schedule, { signal });
    window.addEventListener('scroll', schedule, { signal, capture: true });
    window.addEventListener('resize', schedule, { signal });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); }, { signal });

    signal.addEventListener('abort', () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = null;
        toolbar?.remove();
        toolbar = null;
        currentHost = null;
        pickerStore = null;
        pickerSignal = null;
    });
}
