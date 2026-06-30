// events/coupletEvents.ts
// Editor key-card events: title rename, selection, text input, focus, and
// drag-and-drop reordering — plus the paste / append-step helpers shared with the
// menu and keyboard handlers.
import type { KeyStore, Couplet } from '../store.ts';
import type { UIStateStore } from '../uiState.ts';
import { batchedRefresh, DEBOUNCE_TYPING_MS, setupCardDragReorder } from './shared.ts';
import { resolveDestination, parseDestinationInput, buildIdToIndexMap } from '../utils.ts';
import { findTaxonByName } from '../taxonOps.ts';
import { showToast } from '../uiRenderer.ts';

// The key-card whose field last gained focus — so the link highlight only refreshes
// when focus moves to a different card, not when tabbing between a card's two fields.
let lastFocusedCardId: number | null = null;

/** Title input: commit a trimmed rename on blur, reverting to the current name if blank. */
export function setupTitleEditing(store: KeyStore, refreshAll: () => void, signal: AbortSignal) {
    const titleInput = document.getElementById('key-title-input') as HTMLInputElement | null;
    if (!titleInput) return;

    titleInput.addEventListener('blur', () => {
        store.endTypingSession();

        const newTitle = titleInput.value.trim();
        if (!newTitle) {
            titleInput.value = store.getTitle();
            return;
        }

        store.setTitle(newTitle);
        batchedRefresh(refreshAll);
    }, { signal });
}

/** Card selection clicks (with Ctrl/Cmd/Shift multi-select) and background-click clearing. */
export function setupCoupletSelection(keyContainer: HTMLElement, store: KeyStore, refreshAll: () => void, signal: AbortSignal) {
    keyContainer.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;

        // Inline "＋ taxon": create the Taxa card for this lead's typed name and link it.
        const createBtn = target.closest('.btn-create-taxon') as HTMLElement | null;
        if (createBtn) {
            const card = createBtn.closest('.key-card') as HTMLElement | null;
            const forField = createBtn.getAttribute('data-for');
            if (card && (forField === 'dest1' || forField === 'dest2')) {
                const coupletId = Number(card.getAttribute('data-id'));
                const branchField = forField === 'dest1' ? 'branch1' : 'branch2';
                store.createTaxonForBranch(coupletId, branchField);
                batchedRefresh(refreshAll);
            }
            return;
        }

        // If the user clicked the editor background layout area itself, drop focus
        if (target.id === 'editor-container') {
            store.clearSelection();
            batchedRefresh(refreshAll);
            return;
        }

        // Prevent card selection if the user is interacting with text inputs or textareas
        if (target.closest('input, textarea')) return;

        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;
        const id = Number(card.getAttribute('data-id'));

        // Enable multi-select when holding Control, Command (Mac), or Shift keys
        const multiSelect = e.ctrlKey || e.metaKey || e.shiftKey;

        store.toggleSelection(id, multiSelect);
        batchedRefresh(refreshAll);
    }, { signal });
}

/**
 * Consolidated couplet input router: immediate store sync, undo debouncing,
 * figure-token encoding, and destination link validation.
 */
export function setupCoupletInput(keyContainer: HTMLElement, store: KeyStore, uiState: UIStateStore, refreshAll: () => void, signal: AbortSignal) {
    keyContainer.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        if (!target.classList.contains('input-sync')) return;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));
        const field = target.getAttribute('data-field')!;
        const fieldKey = `${id}-${field}`;
        store.setActiveCouplet(id);

        // Undo History Checkpoint Manager (Couplets Context)
        uiState.typing.couplets.start(fieldKey, () => {
            store.endTypingSession();
        });

        // Synchronize the text change immediately to the store without waiting
        const updatePayload: Partial<Omit<Couplet, 'id'>> = {};
        const currentValue = target.value;
        type CoupletStringField = 'alt1' | 'alt2';

        if (field === 'dest1' || field === 'dest2') {
            const branchField = field === 'dest1' ? 'branch1' : 'branch2';

            // We parse using the current snapshot of the key array
            let branch = parseDestinationInput(currentValue, store.getKey());
            // Link to an existing taxon live as the typed name matches one (reliable,
            // no timer); a non-matching name stays a draft until the user clicks create.
            if (branch.kind === 'taxonDraft') {
                const match = findTaxonByName(store.getTaxa(), branch.name);
                if (match) branch = { kind: 'taxon', taxonId: match.id };
            }
            updatePayload[branchField] = branch;
        } else {
            updatePayload[field as CoupletStringField] = currentValue;
        }

        store.updateCouplet(id, updatePayload);

        // If user stops typing for 800ms, trigger heavy map lookups & structural warnings
        uiState.typing.couplets.extendTimeout(DEBOUNCE_TYPING_MS, () => {
            // Encode any complete [fig: N] or [fig: filename] tokens to stable [figID: N] format.
            if (field !== 'dest1' && field !== 'dest2') {
                const currentCouplet = store.getKey().find(c => c.id === id);
                if (currentCouplet) {
                    const rawValue = currentCouplet[field as keyof Omit<Couplet, 'id'>] as string;
                    const encodedValue = store.encodeFigureTokens(rawValue);
                    if (encodedValue !== rawValue) {
                        store.updateCouplet(id, { [field]: encodedValue } as Partial<Omit<Couplet, 'id'>>);
                    }
                }
            }

            // Perform link validation safely inside the debounce window
            if (field === 'dest1' || field === 'dest2') {
                const updatedKey = store.getKey();
                const currentCouplet = updatedKey.find(c => c.id === id);

                if (currentCouplet) {
                    const branch = field === 'dest1' ? currentCouplet.branch1 : currentCouplet.branch2;

                    const idToIndexMap = buildIdToIndexMap(updatedKey);
                    const resolution = resolveDestination(branch, idToIndexMap);

                    target.classList.toggle('input-error', resolution.isUnresolved);
                }
            }

            batchedRefresh(refreshAll);
        });
    }, { signal });
}

/**
 * Couplet field focus handling: disables card dragging while editing, auto-selects
 * destination inputs, drives the link highlight, and on focusout commits figure
 * tokens + flags bad destinations.
 */
export function setupCoupletFocus(keyContainer: HTMLElement, store: KeyStore, uiState: UIStateStore, refreshAll: () => void, signal: AbortSignal) {
    // Centralized Drag and Form Text Highlight Mitigation
    keyContainer.addEventListener('focusin', (e) => {
        const target = e.target as HTMLElement;

        if (target.matches('input, textarea')) {
            const card = target.closest('.key-card') as HTMLElement;
            if (!card) return;
            card.draggable = false;

            // Mark this step active and refresh the link highlight, but only when
            // focus actually moved to a different card (not field-to-field).
            const cardId = Number(card.getAttribute('data-id'));
            store.setActiveCouplet(cardId);
            if (cardId !== lastFocusedCardId) {
                lastFocusedCardId = cardId;
                batchedRefresh(refreshAll);
            }

            if (target.classList.contains('input-destination') && target instanceof HTMLInputElement) {
                queueMicrotask(() => {
                    if (document.activeElement === target) {
                        target.select();
                    }
                });
            }
        }
    }, { signal });

    // Centralized Serialization Execution Focusout
    keyContainer.addEventListener('focusout', (e: FocusEvent) => {
        const target = e.target as HTMLElement;

        if (target.matches('input, textarea')) {
            const card = target.closest('.key-card') as HTMLElement;
            if (card) card.draggable = true;

            // Construct the unique identifier for this specific field
            const id = card ? Number(card.getAttribute('data-id')) : null;
            const field = target.getAttribute('data-field');
            const fieldKey = id && field ? `${id}-${field}` : null;

            // Verify if focus is genuinely leaving the active field session.
            uiState.typing.couplets.end(fieldKey, () => {
                store.clearActiveCouplet();

                // Encode any [fig: N] tokens that the debounce may not have reached
                if (field && field !== 'dest1' && field !== 'dest2' && id !== null) {
                    const currentCouplet = store.getKey().find(c => c.id === id);
                    if (currentCouplet) {
                        const rawValue = currentCouplet[field as keyof Omit<Couplet, 'id'>] as string;
                        const encodedValue = store.encodeFigureTokens(rawValue);
                        if (encodedValue !== rawValue) {
                            store.updateCouplet(id, { [field]: encodedValue } as Partial<Omit<Couplet, 'id'>>);
                        }
                    }
                }

                // Trigger the warning toast if the field has an unresolved destination
                if (target.classList.contains('input-error') && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && card) {
                    const invalidVal = target.value;
                    showToast(`⚠️ Step "${invalidVal}" doesn't exist yet — kept as a pending link.`, "error");
                }

                // Evaluate next target context defensively (ensuring target is an Element node)
                const destination = e.relatedTarget as HTMLElement | null;
                const movingToCard = destination instanceof Element && destination.closest('.key-card');
                const isClickingControl = movingToCard || (destination instanceof Element && (
                    destination.closest('.app-menu-bar') ||
                    destination.closest('#add-couplet-btn')
                ));

                // Once focus leaves the cards, forget the last card so re-focusing it
                // re-asserts its link highlight.
                if (!movingToCard) lastFocusedCardId = null;

                if (!isClickingControl) {
                    batchedRefresh(refreshAll);
                }
            });
        }
    }, { signal });
}

/** HTML5 drag-and-drop reordering for couplet cards, with edge auto-scroll. */
export function setupCoupletDragAndDrop(keyContainer: HTMLElement, store: KeyStore, refreshAll: () => void, signal: AbortSignal) {
    setupCardDragReorder({
        container: keyContainer,
        cardSelector: '.key-card',
        getDraggedId: () => store.draggedCoupletId,
        setDraggedId: (id) => id === null ? store.stopDraggingCouplet() : store.startDraggingCouplet(id),
        signal,
        onDrop: (draggedId, targetId, position) => {
            store.reorderCouplets(draggedId, targetId, position);
            batchedRefresh(refreshAll);
        },
    });
}

/** Appends a new step and focuses its first description field. */
export function createNewCoupletWithFocus(store: KeyStore, refreshAll: () => void) {
    const newId = store.addCouplet();
    refreshAll();

    const newCard = document.querySelector(`.key-card[data-id="${newId}"]`);
    const textarea = newCard?.querySelector('textarea[data-field="alt1"]') as HTMLTextAreaElement | null;

    if (textarea) {
        textarea.focus();
    }
}

/** Pastes clipboard steps relative to the current selection (or the key ends). */
export function executePaste(store: KeyStore, refreshAll: () => void, position: 'above' | 'below') {
    let targetId: number | undefined = undefined;
    const selectedIds = store.getSelectedCoupletIds();
    const key = store.getKey();

    const visibleSelection = key.filter(couplet => selectedIds.has(couplet.id));

    if (visibleSelection.length > 0) {
        targetId = position === 'below'
            ? visibleSelection[visibleSelection.length - 1].id
            : visibleSelection[0].id;
    } else if (key.length > 0) {
        targetId = position === 'above'
            ? key[0].id
            : key[key.length - 1].id;
    }

    if (store.pasteCouplets(targetId, position)) {
        const locationText = visibleSelection.length > 0
            ? `${position} selection`
            : (position === 'above' ? 'at the beginning' : 'at the end');

        showToast(`Pasted steps ${locationText}.`, "success");
        batchedRefresh(refreshAll);
    }
}