// popover.ts
// A tiny, dependency-free floating popover used for the right-click path menu and
// the Ctrl+click figure preview. Only one is open at a time. It positions itself at
// (x, y) clamped to the viewport, and dismisses on outside-click / Escape / scroll /
// resize. Listeners live on a local AbortController chained to the caller's signal,
// so both close() and the global teardown clean everything up.

import { escapeHTML } from './utils.ts';

export interface PopoverItem {
    label: string;
    onSelect: () => void;
    className?: string;
}

export interface PopoverOptions {
    x: number;
    y: number;
    items: PopoverItem[];
    /** Trusted HTML rendered above the items (caller escapes any user content). */
    headerHtml?: string;
    /** Called when a `[data-step-id]` element inside the header is clicked. */
    onCrumbSelect?: (stepId: number) => void;
    /** Runs after the popover is removed (e.g. to revoke an object URL). */
    onClose?: () => void;
    signal: AbortSignal;
}

let currentClose: (() => void) | null = null;

/** Closes whatever popover is currently open, if any. */
export function closeCurrentPopover(): void {
    currentClose?.();
}

export function openPopover(opts: PopoverOptions): () => void {
    closeCurrentPopover();

    const el = document.createElement('div');
    el.className = 'popover';
    el.setAttribute('role', 'menu');

    const itemsHtml = opts.items
        .map((item, i) =>
            `<button type="button" class="popover-action ${item.className ?? ''}" data-item-index="${i}">${escapeHTML(item.label)}</button>`
        )
        .join('');
    el.innerHTML = (opts.headerHtml ?? '') + itemsHtml;

    document.body.appendChild(el);

    // Position at (x, y), clamped into the viewport.
    const margin = 8;
    const rect = el.getBoundingClientRect();
    const left = Math.max(margin, Math.min(opts.x, window.innerWidth - rect.width - margin));
    const top = Math.max(margin, Math.min(opts.y, window.innerHeight - rect.height - margin));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;

    const controller = new AbortController();
    const { signal } = controller;

    const close = () => {
        controller.abort();        // detaches every listener below
        el.remove();
        if (currentClose === close) currentClose = null;
        opts.onClose?.();
    };
    currentClose = close;

    // Dismissal triggers.
    document.addEventListener('mousedown', (e) => {
        if (!el.contains(e.target as Node)) close();
    }, { signal });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
    }, { signal });
    window.addEventListener('scroll', close, { signal, capture: true });
    window.addEventListener('resize', close, { signal });
    // Chain to the caller's lifetime so global teardown also closes us.
    opts.signal.addEventListener('abort', close, { signal });

    // Clicks inside: breadcrumb step jumps, then item actions.
    el.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;

        const crumb = target.closest<HTMLElement>('[data-step-id]');
        if (crumb && opts.onCrumbSelect) {
            const stepId = Number(crumb.getAttribute('data-step-id'));
            close();
            opts.onCrumbSelect(stepId);
            return;
        }

        const action = target.closest<HTMLElement>('[data-item-index]');
        if (action) {
            const index = Number(action.getAttribute('data-item-index'));
            const item = opts.items[index];
            close();
            item?.onSelect();
        }
    }, { signal });

    return close;
}