// changeEmitter.ts
// The notification primitive shared by the two stores (KeyStore, UIStateStore).
// Before this existed, every caller that mutated a store had to remember to ask for a
// re-render afterwards, and `refreshAll` was threaded through the signature of nearly
// every event module to make that possible. A store now announces its own changes and
// the composition root (main.ts) decides what to do about them.

/**
 * What kind of change happened, because the two are re-rendered on different clocks:
 *
 *   structural — anything a subscriber should react to now: adds, deletes, reorders,
 *                undo/redo, project loads, selection changes.
 *   typing     — a field edit inside an in-progress typing burst. Panels debounce
 *                these themselves (see DEBOUNCE_TYPING_MS) and refresh once the
 *                typing settles, so a re-rendering subscriber must ignore them or it
 *                re-renders the whole app on every keystroke.
 */
export type ChangeKind = 'structural' | 'typing';

export type ChangeListener = (kind: ChangeKind) => void;

export class ChangeEmitter {
    private listeners = new Set<ChangeListener>();

    /** Registers a listener; the returned function removes it again. */
    public subscribe(listener: ChangeListener): () => void {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    /** Iterates a copy, so a listener may unsubscribe (or subscribe) while running. */
    public emit(kind: ChangeKind): void {
        for (const listener of [...this.listeners]) listener(kind);
    }
}
