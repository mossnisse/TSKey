// events/entityPanel.ts
// Shared wiring for an id-keyed entity card panel (figures, taxa, and future entity
// types): the add button, debounced field editing, click selection, focus-settle
// refresh, and drag-and-drop reordering. A panel supplies only its store hooks and a
// few entity-specific bits. Panels with extra interactions (the figure panel's image
// upload/lightbox) layer them on via the `extraClick` hook and their own listeners.

import type { TypingSession } from '../uiState.ts';
import { batchedRefresh, DEBOUNCE_TYPING_MS, setupCardDragReorder } from './shared.ts';

export interface EntityPanelConfig {
    /** The scrollable list element that owns the cards. */
    container: HTMLElement;
    /** Selector for a card within the container (each carries a numeric data-id). */
    cardSelector: string;
    /** The panel's "add" button, if present. */
    addButton: HTMLElement | null;
    /** Prefix for the per-field typing-session key, e.g. 'taxon' -> `taxon-3-name`. */
    fieldKeyPrefix: string;
    /** The typing session that debounces this panel's edits. */
    typing: TypingSession;
    signal: AbortSignal;
    refreshAll: () => void;

    /** Adds a new entity (the factory refreshes afterwards). */
    onAdd: () => void;
    /** Ends the current typing session / commits the pending history frame. */
    endTypingSession: () => void;
    /** Builds the partial update for an edited field, or null to ignore the field. */
    buildUpdate: (field: string, value: string) => object | null;
    /** Applies a field update to the entity. */
    applyUpdate: (id: number, update: object) => void;
    toggleSelection: (id: number, multiSelect: boolean) => void;
    clearSelection: () => void;
    /** The current entities in order (for converting a drop position to an index). */
    getItems: () => readonly { id: number }[];
    reorder: (srcIdx: number, targetIdx: number) => void;

    /**
     * Optional: runs when a field edit settles (typing pause / blur). Returns whether
     * it changed something outside this panel that warrants a refresh even if focus
     * moved to another panel control (e.g. taxa relinking a lead's draft).
     */
    onSettle?: () => boolean;
    /** Optional: handle a click before selection logic; return true if it was handled. */
    extraClick?: (target: HTMLElement, e: MouseEvent) => boolean;
    /**
     * Extra selectors (besides the card and the menu bar) that count as "clicking a
     * control" on focusout, so leaving a field for one of them doesn't force a refresh.
     */
    keepFocusWithin?: string[];
}

/** Converts an above/below drop onto `targetIdx` into the destination array index. */
export function resolveDropIndex(srcIdx: number, targetIdx: number, position: 'above' | 'below'): number {
    if (position === 'below') return srcIdx < targetIdx ? targetIdx : targetIdx + 1;
    return srcIdx < targetIdx ? targetIdx - 1 : targetIdx;
}

export function setupEntityPanel(config: EntityPanelConfig): void {
    const {
        container, cardSelector, addButton, fieldKeyPrefix, typing, signal, refreshAll,
        onAdd, endTypingSession, buildUpdate, applyUpdate, toggleSelection, clearSelection,
        getItems, reorder, onSettle, extraClick, keepFocusWithin = [],
    } = config;

    addButton?.addEventListener('click', () => {
        onAdd();
        batchedRefresh(refreshAll);
    }, { signal });

    // --- Field editing (immediate store sync, debounced structural refresh) ---
    container.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        if (!target.classList.contains('input-sync')) return;
        const card = target.closest(cardSelector) as HTMLElement | null;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));
        const field = target.getAttribute('data-field')!;
        const fieldKey = `${fieldKeyPrefix}-${id}-${field}`;

        typing.start(fieldKey, endTypingSession);

        const update = buildUpdate(field, target.value);
        if (update) applyUpdate(id, update);

        typing.extendTimeout(DEBOUNCE_TYPING_MS, () => {
            onSettle?.();
            batchedRefresh(refreshAll);
        });
    }, { signal });

    // --- Selection (after any panel-specific click handling) ---
    container.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (extraClick?.(target, e)) return;

        // Clicking the panel background clears the selection.
        if (target === container) {
            clearSelection();
            batchedRefresh(refreshAll);
            return;
        }

        const card = target.closest(cardSelector) as HTMLElement | null;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));
        const multiSelect = e.ctrlKey || e.metaKey || e.shiftKey;

        // Clicking into a field selects the card (without stealing the click) only
        // when it isn't already selected.
        if (target.closest('input, textarea')) {
            if (!card.classList.contains('is-selected')) {
                toggleSelection(id, multiSelect);
                batchedRefresh(refreshAll);
            }
            return;
        }

        toggleSelection(id, multiSelect);
        batchedRefresh(refreshAll);
    }, { signal });

    // --- Focus-settle refresh ---
    container.addEventListener('focusout', (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (!target.matches('input, textarea')) return;
        const card = target.closest(cardSelector) as HTMLElement | null;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));
        const field = target.getAttribute('data-field');
        const fieldKey = id && field ? `${fieldKeyPrefix}-${id}-${field}` : null;

        typing.end(fieldKey, () => {
            const settled = onSettle?.() ?? false;

            const destination = e.relatedTarget as HTMLElement | null;
            const keepSelectors = [cardSelector, '.app-menu-bar', ...keepFocusWithin];
            const isClickingControl = destination instanceof Element
                && keepSelectors.some(sel => destination.closest(sel));

            // Refresh when the edit changed external state, or focus left this panel's controls.
            if (settled || !isClickingControl) batchedRefresh(refreshAll);
        });
    }, { signal });

    // --- Drag-and-drop reordering (converts the above/below drop to an array index) ---
    let draggedId: number | null = null;
    setupCardDragReorder({
        container,
        cardSelector,
        getDraggedId: () => draggedId,
        setDraggedId: (id) => { draggedId = id; },
        signal,
        onDrop: (dragged, targetId, position) => {
            const items = getItems();
            const srcIdx = items.findIndex(i => i.id === dragged);
            const targetIdx = items.findIndex(i => i.id === targetId);
            if (srcIdx === -1 || targetIdx === -1) return;

            const destIdx = resolveDropIndex(srcIdx, targetIdx, position);
            if (srcIdx !== destIdx) {
                reorder(srcIdx, destIdx);
                batchedRefresh(refreshAll);
            }
        },
    });
}
