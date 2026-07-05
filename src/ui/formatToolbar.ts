// A single floating formatting toolbar shared by every mounted rich-text field. Modeled
// on popover.ts, but its buttons use mousedown+preventDefault so clicking one never
// blurs the editor / collapses the selection.

import type { KeyStore } from '../store';
import { getFieldEditor } from './richTextField.ts';
import { defaultMarks } from '../editor/richText/index.ts';
import { openFigureReferencePicker } from '../events/figureEvents.ts';

const MARK_BUTTONS: ReadonlyArray<{ mark: string; title: string; html: string }> = [
    { mark: 'bold', title: 'Bold (Ctrl/Cmd+B)', html: '<b>B</b>' },
    { mark: 'italic', title: 'Italic (Ctrl/Cmd+I)', html: '<i>I</i>' },
    { mark: 'subscript', title: 'Subscript', html: 'x<sub>2</sub>' },
    { mark: 'superscript', title: 'Superscript', html: 'x<sup>2</sup>' },
];

const TAG_TO_MARK = new Map(defaultMarks.map(m => [m.tag.toUpperCase(), m.name]));

function activeMarksForSelection(host: HTMLElement): Set<string> {
    const active = new Set<string>();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return active;
    let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
    while (node && node !== host) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (el.dataset.open !== undefined) {
                const mark = TAG_TO_MARK.get(el.tagName);
                if (mark) active.add(mark);
            }
        }
        node = node.parentNode;
    }
    return active;
}

let toolbar: HTMLElement | null = null;
let currentHost: HTMLElement | null = null;
let rafId: number | null = null;
let pickerStore: KeyStore | null = null;
let pickerSignal: AbortSignal | null = null;

function closestHost(node: Node | null): HTMLElement | null {
    if (!node) return null;
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    return (el?.closest('.rte-host') as HTMLElement | null) ?? null;
}

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
        MARK_BUTTONS.map(b => `<button type="button" data-mark="${b.mark}" title="${b.title}" aria-pressed="false">${b.html}</button>`).join('') +
        `<button type="button" data-fig title="Insert figure reference (Alt+F)">Fig</button>`;

    el.addEventListener('mousedown', e => e.preventDefault());

    el.addEventListener('click', e => {
        const btn = (e.target as HTMLElement).closest('button');
        if (!btn || !currentHost) return;
        const mark = btn.getAttribute('data-mark');
        if (mark) {
            getFieldEditor(currentHost)?.toggleMark(mark);
        } else if (btn.hasAttribute('data-fig') && pickerStore && pickerSignal) {
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

    const active = activeMarksForSelection(host);
    toolbar.querySelectorAll<HTMLElement>('[data-mark]').forEach(btn => {
        const on = active.has(btn.getAttribute('data-mark')!);
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    // Measure hidden, then place above the selection (flip below if it would clip).
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