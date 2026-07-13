// events/coupletEvents.ts
// Editor key-card events: title rename, selection, text input, focus, and
// drag-and-drop reordering — plus the paste / append-step helpers shared with the
// menu and keyboard handlers.
import type { KeyStore, Couplet } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { batchedRefresh, commitRichField, DEBOUNCE_TYPING_MS, setupCardDragReorder } from './shared.ts';
import { resolveDestination, parseDestinationInput, buildIdToIndexMap, buildTaxaContext } from '../utils.ts';
import { findTaxonByAnyName, workspaceStorage } from '../store';
import { scrollIntoViewAndFlash } from './navigationEvents.ts';
import { showToast } from '../uiRenderer.ts';

// The key-card whose field last gained focus — so the link highlight only refreshes
// when focus moves to a different card, not when tabbing between a card's two fields.
let lastFocusedCardId: number | null = null;
let pendingTitleCommit: (() => Promise<void>) | null = null;

/** Waits for the title field's blur validation/commit. Save uses this so its snapshot
 *  cannot race the asynchronous duplicate-name lookup. */
export async function commitPendingTitleEdit(): Promise<void> {
    await pendingTitleCommit?.();
}

/** Title input: commit a trimmed rename on blur or Enter, reverting to the current name if blank. */
export function setupTitleEditing(store: KeyStore, refreshAll: () => void, signal: AbortSignal) {
    const titleInput = document.getElementById('key-title-input') as HTMLInputElement | null;
    if (!titleInput) return;

    let commitPromise: Promise<void> | null = null;
    const commit = (): Promise<void> => {
        if (commitPromise) return commitPromise;
        commitPromise = (async () => {
            store.endTypingSession();

            const newTitle = titleInput.value.trim();
            if (!newTitle) {
                titleInput.value = store.getTitle();
                return;
            }

            // Reject a rename that would shadow a different saved project (the current
            // project's own persisted record doesn't count as a collision).
            const currentPersisted = store.getPersistedTitle().toLowerCase();
            const projectList = await workspaceStorage.getProjectList();
            const collides = projectList.some(p => {
                const name = p.name.toLowerCase();
                return name === newTitle.toLowerCase() && name !== currentPersisted;
            });
            if (collides) {
                showToast(`⚠️ A project named "${newTitle}" already exists. Reverted the title.`, "error");
                titleInput.value = store.getTitle();
                return;
            }

            store.setTitle(newTitle);
            batchedRefresh(refreshAll);
        })().finally(() => {
            commitPromise = null;
        });
        return commitPromise;
    };
    pendingTitleCommit = commit;
    signal.addEventListener('abort', () => {
        if (pendingTitleCommit === commit) pendingTitleCommit = null;
    }, { once: true });

    titleInput.addEventListener('blur', commit, { signal });

    // Enter commits the rename immediately instead of only on focus-out; Escape
    // abandons the edit, restoring the current title. Both then drop focus.
    titleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            titleInput.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            titleInput.value = store.getTitle();
            titleInput.blur();
        }
    }, { signal });
}

/** Encodes any complete [fig: N] tokens in a couplet alt field to stable [figID: N]. */
export function encodeCoupletField(store: KeyStore, id: number, field: 'alt1' | 'alt2'): void {
    const couplet = store.getKey().find(c => c.id === id);
    if (!couplet) return;
    const encoded = store.encodeFigureTokens(couplet[field]);
    if (encoded !== couplet[field]) {
        store.updateCouplet(id, { [field]: encoded } as Partial<Omit<Couplet, 'id'>>);
    }
}

/** Commits a rich-text alt1/alt2 edit: immediate store sync, then a debounced
 *  figure-token encode + refresh. Wired to the mounted editor's onChange. */
export function commitCoupletField(
    store: KeyStore,
    uiState: UIStateStore,
    refreshAll: () => void,
    id: number,
    field: 'alt1' | 'alt2',
    value: string,
) {
    store.setActiveCouplet(id);
    commitRichField({
        session: uiState.typing.couplets,
        fieldKey: `${id}-${field}`,
        endTypingSession: () => store.endTypingSession(),
        applyUpdate: () => store.updateCouplet(id, { [field]: value } as Partial<Omit<Couplet, 'id'>>),
        onSettle: () => encodeCoupletField(store, id, field),
        refreshAll,
    });
}

/** Card selection clicks (with Ctrl/Cmd/Shift multi-select) and background-click clearing. */
export function setupCoupletSelection(keyContainer: HTMLElement, store: KeyStore, refreshAll: () => void, signal: AbortSignal) {
    keyContainer.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;

        // Inline create buttons: turn this lead's typed name into a Taxa card and link
        // it, putting the text in the taxon's scientific or vernacular name field per
        // the button clicked.
        const createBtn = target.closest('.btn-create-taxon') as HTMLElement | null;
        if (createBtn) {
            const card = createBtn.closest('.key-card') as HTMLElement | null;
            const forField = createBtn.getAttribute('data-for');
            if (card && (forField === 'dest1' || forField === 'dest2')) {
                const coupletId = Number(card.getAttribute('data-id'));
                const branchField = forField === 'dest1' ? 'branch1' : 'branch2';
                const nameField = createBtn.getAttribute('data-name-field') === 'vernacular' ? 'vernacular' : 'scientific';
                const newTaxonId = store.createTaxonForBranch(coupletId, branchField, nameField);
                refreshAll(); // sync so the new card exists before we scroll to it
                if (newTaxonId !== null) {
                    const cardSelector = `.taxon-card[data-id="${newTaxonId}"]`;
                    scrollIntoViewAndFlash(cardSelector);
                    // Drop the user straight into the field they chose to fill it in.
                    const focusField = nameField === 'vernacular' ? 'vernacularName' : 'scientificName';
                    (document.querySelector(`${cardSelector} input[data-field="${focusField}"]`) as HTMLInputElement | null)?.focus();
                }
            }
            return;
        }

        // If the user clicked the editor background layout area itself, drop focus
        if (target.id === 'editor-container') {
            store.clearSelection();
            batchedRefresh(refreshAll);
            return;
        }

        // Prevent card selection if the user is interacting with a field (input, textarea,
        // or a mounted rich-text host).
        if (target.closest('input, textarea, .rte-host')) return;

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
 * Destination-input router for the key cards: immediate branch sync, undo
 * debouncing, and link validation. The alt1/alt2 description fields are mounted
 * rich-text editors (not `.input-sync`) and commit via commitCoupletField, so the
 * only `.input-sync` fields that reach here are the dest1/dest2 destination inputs.
 */
export function setupCoupletInput(keyContainer: HTMLElement, store: KeyStore, uiState: UIStateStore, refreshAll: () => void, signal: AbortSignal) {
    keyContainer.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        if (!target.classList.contains('input-sync')) return;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        const field = target.getAttribute('data-field')!;
        if (field !== 'dest1' && field !== 'dest2') return;

        const id = Number(card.getAttribute('data-id'));
        const fieldKey = `${id}-${field}`;
        store.setActiveCouplet(id);

        // Undo History Checkpoint Manager (Couplets Context)
        uiState.typing.couplets.start(fieldKey, () => {
            store.endTypingSession();
        });

        // Synchronize the destination change immediately to the store without waiting.
        const branchField = field === 'dest1' ? 'branch1' : 'branch2';
        // We parse using the current snapshot of the key array
        let branch = parseDestinationInput(target.value, store.getKey());
        // Link to an existing taxon live as the typed name matches one — by its
        // scientific OR vernacular name (reliable, no timer). A non-matching name
        // stays a draft until the user clicks one of the create buttons.
        if (branch.kind === 'taxonDraft') {
            const match = findTaxonByAnyName(store.getTaxa(), branch.name);
            if (match) branch = { kind: 'taxon', taxonId: match.id };
        }
        store.updateCouplet(id, { [branchField]: branch } as Partial<Omit<Couplet, 'id'>>);

        // If user stops typing for 800ms, trigger heavy map lookups & structural warnings
        uiState.typing.couplets.extendTimeout(DEBOUNCE_TYPING_MS, () => {
            // Perform link validation safely inside the debounce window
            const updatedKey = store.getKey();
            const currentCouplet = updatedKey.find(c => c.id === id);
            if (currentCouplet) {
                const idToIndexMap = buildIdToIndexMap(updatedKey);
                const taxaCtx = buildTaxaContext(store.getTaxa(), uiState.nameDisplayMode);
                const resolution = resolveDestination(currentCouplet[branchField], idToIndexMap, taxaCtx);
                target.classList.toggle('input-error', resolution.isUnresolved);
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

        if (target.matches('input, textarea, .rte-host')) {
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

        if (target.matches('input, textarea, .rte-host')) {
            const card = target.closest('.key-card') as HTMLElement;
            if (card) card.draggable = true;

            // Construct the unique identifier for this specific field
            const id = card ? Number(card.getAttribute('data-id')) : null;
            const field = target.getAttribute('data-field');
            const fieldKey = id && field ? `${id}-${field}` : null;

            // Verify if focus is genuinely leaving the active field session.
            uiState.typing.couplets.end(fieldKey, () => {
                // Encode any [fig: N] tokens that the debounce may not have reached
                if ((field === 'alt1' || field === 'alt2') && id !== null) {
                    encodeCoupletField(store, id, field);
                }
            });

            // Highlight/active-step cleanup depends on where focus went, not on
            // whether the typing session was still alive — a session that already
            // ended itself via the debounce timeout must not leave the card's
            // link highlight stuck on.
            const destination = e.relatedTarget as HTMLElement | null;
            const movingToCard = destination instanceof Element && destination.closest('.key-card');
            const isClickingControl = movingToCard || (destination instanceof Element && (
                destination.closest('.app-menu-bar') ||
                destination.closest('#add-couplet-btn')
            ));

            // Once focus leaves the cards, forget the last card so re-focusing it
            // re-asserts its link highlight, and drop the active-step marker.
            if (!movingToCard) {
                lastFocusedCardId = null;
                store.clearActiveCouplet();
            }

            if (!isClickingControl) {
                batchedRefresh(refreshAll);
            }
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
    const altHost = newCard?.querySelector('.rte-host[data-field="alt1"]') as HTMLElement | null;
    altHost?.focus();
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
