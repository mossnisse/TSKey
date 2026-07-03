// ui/shared.ts
// Small DOM helpers shared across the ui/ renderers: the id-keyed card reconciler,
// syncing a field's value without clobbering an in-progress edit, and spawning toast
// notifications.

/** Patches a field's value without clobbering an in-progress edit (skips the focused element). */
export function syncField(parent: HTMLElement, selector: string, value: string, forceUpdate = false): HTMLInputElement | HTMLTextAreaElement | null {
    const el = parent.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    if (!el) return null;

    if ((forceUpdate || document.activeElement !== el) && el.value !== value) {
        el.value = value;
    }
    return el;
}

export interface ReconcileOptions<T> {
    /** The element whose children mirror `items`, one card per item. */
    container: HTMLElement;
    /** The data to render, in the order the cards should appear. */
    items: readonly T[];
    /** The item's stable id; must equal the `data-id` set on its card by `create`. */
    getId: (item: T) => number;
    /** Builds a fresh card skeleton (must set `data-id`); dynamic state is applied by `update`. */
    create: (item: T, index: number) => HTMLElement;
    /** Applies dynamic state; runs for both new and reused cards so the two paths never drift. */
    update?: (el: HTMLElement, item: T, index: number) => void;
    /** Called with each card that is about to be removed (no longer in `items`), before
     *  it leaves the DOM — used to tear down per-card resources (e.g. mounted editors). */
    onRemove?: (el: HTMLElement) => void;
}

/**
 * Incrementally reconciles a container's children against `items`, keyed by id
 * (each card carries its id on `data-id`). Existing cards are reused and moved into
 * order, missing ones are created, and leftover ones are removed — replacing the
 * hand-rolled diff loop that every card renderer used to repeat. Because `update`
 * runs on freshly created cards too, `create` only needs to build a static skeleton.
 */
export function reconcileCards<T>(opts: ReconcileOptions<T>): void {
    const { container, items, getId, create, update, onRemove } = opts;

    const existing = new Map<number, HTMLElement>();
    for (const child of Array.from(container.children) as HTMLElement[]) {
        const idAttr = child.getAttribute('data-id');
        if (idAttr === null) continue;            // no data-id → not a reconciled card
        const id = Number(idAttr);
        if (!Number.isNaN(id)) existing.set(id, child);
    }

    items.forEach((item, index) => {
        const id = getId(item);
        let el = existing.get(id);
        if (el) {
            existing.delete(id);
        } else {
            el = create(item, index);
        }
        if (container.children[index] !== el) {
            container.insertBefore(el, container.children[index] ?? null);
        }
        update?.(el, item, index);
    });

    existing.forEach(el => {
        onRemove?.(el);
        el.remove();
    });
}

/**
 * Spawns an asynchronous, non-blocking notification banner.
 */
export function showToast(message: string, type: 'success' | 'error' = 'success') {
    let container = document.querySelector('.toast-container') as HTMLDivElement;

    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    if (type === 'error') {
        toast.setAttribute('role', 'alert');
    } else {
        toast.setAttribute('role', 'status');
    }

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
        if (container && container.childElementCount === 0) {
            container.remove();
        }
    }, 3000);
}