// events/figureEvents.ts
// Figure panel events (add, edit, image upload/removal, drag-and-drop) and the
// figure-reference insertion tool. `isFigureTextarea` and `insertFigureReference`
// are also used by the keyboard shortcut (Alt+F).
import type { KeyStore } from '../store.ts';
import type { UIStateStore } from '../uiState.ts';
import { batchedRefresh, DEBOUNCE_TYPING_MS, AUTO_SCROLL_THRESHOLD_PX, AUTO_SCROLL_SPEED_PX } from './shared.ts';
import { showToast } from '../uiRenderer.ts';
import { workspaceStorage, activeObjectURLs } from '../db.ts';

// Figure-reference insertion (key editor alt1/alt2 text only).
const FIG_REF_TOKEN = '[fig: ]';
const FIG_REF_CARET_OFFSET = '[fig: '.length; // caret lands just after the colon+space

// The alt1/alt2 textarea (and caret) most recently edited, so the menu item can
// target it even though clicking the menu blurs the textarea.
let lastFigureField: { el: HTMLTextAreaElement; start: number; end: number } | null = null;

/** True only for the key editor's alt1/alt2 description textareas, where figure refs live. */
export function isFigureTextarea(el: EventTarget | null): el is HTMLTextAreaElement {
    return el instanceof HTMLTextAreaElement
        && (el.dataset.field === 'alt1' || el.dataset.field === 'alt2')
        && el.closest('.key-card') !== null;
}

/** Resolves the textarea to insert into: the focused one, else the last one edited. */
function resolveFigureTarget(): { el: HTMLTextAreaElement; start: number; end: number } | null {
    const active = document.activeElement;
    if (isFigureTextarea(active)) {
        return { el: active, start: active.selectionStart ?? 0, end: active.selectionEnd ?? 0 };
    }
    if (lastFigureField && document.body.contains(lastFigureField.el)) {
        return lastFigureField;
    }
    return null;
}

/**
 * Inserts a "[fig: ]" reference skeleton at the caret/selection of a key-step
 * textarea and parks the caret just after the colon, ready for a figure number.
 * Dispatches `input` so the store syncs and the edit is captured for undo.
 */
export function insertFigureReference(el: HTMLTextAreaElement, start: number, end: number): void {
    const value = el.value;
    const from = Math.min(Math.max(start, 0), value.length);
    const to = Math.min(Math.max(end, from), value.length);

    el.value = value.slice(0, from) + FIG_REF_TOKEN + value.slice(to);

    const caret = from + FIG_REF_CARET_OFFSET;
    el.focus();
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Figure panel: add button, text fields, image upload/removal, and figure drag-and-drop. */
export function setupFigurePanel(store: KeyStore, uiState: UIStateStore, refreshAll: () => void, signal: AbortSignal) {
    const addFigureBtn = document.getElementById('add-figure-btn');
    if (addFigureBtn) {
        addFigureBtn.addEventListener('click', () => {
            store.addFigure("", "");
            batchedRefresh(refreshAll);
        }, { signal });
    }

    const figureContainer = document.getElementById('figure-container');
    if (!figureContainer) return;

    figureContainer.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;

        // Ensure we are interacting with a bound sync field
        if (!target.classList.contains('input-sync')) return;

        const figureCard = target.closest('.figure-card') as HTMLElement;
        if (!figureCard) return;

        const figId = Number(figureCard.getAttribute('data-id'));
        const field = target.getAttribute('data-field') as 'filename' | 'caption';
        const fieldKey = `fig-${figId}-${field}`;

        // Manage debounce typing timelines (Figures Context)
        uiState.typing.figures.start(fieldKey, () => {
            store.endTypingSession(); // commit any lingering state frame
        });

        // Construct the partial Figure update object dynamically
        const fields = { [field]: target.value };

        // Dispatch the update to your KeyStore instance
        store.updateFigure(figId, fields);

        // Debounce structural refreshes to avoid dropping the typing caret position
        uiState.typing.figures.extendTimeout(DEBOUNCE_TYPING_MS, () => {
            batchedRefresh(refreshAll); // Batch updates safely via requestAnimationFrame
        });
    }, { signal });

    figureContainer.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;

        if (target.classList.contains('btn-trigger-upload')) {
            const card = target.closest('.figure-card') as HTMLElement;
            const truePicker = card?.querySelector('.hidden-file-picker') as HTMLInputElement;
            truePicker?.click();
            return;
        }

        if (target.classList.contains('btn-remove-image')) {
            const card = target.closest('.figure-card') as HTMLElement;
            if (!card) return;
            const figId = Number(card.getAttribute('data-id'));

            // Stage the deletion instead of immediate DB mutation
            workspaceStorage.deleteFigureBinary(figId);

            const oldUrl = activeObjectURLs.get(figId);
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            activeObjectURLs.delete(figId);

            store.updateFigure(figId, { filename: '' });
            batchedRefresh(refreshAll);
            return;
        }

        // Clear selection if clicking the background layout area of the figure panel itself
        if (target === figureContainer) {
            store.clearFigureSelection();
            batchedRefresh(refreshAll);
            return;
        }

        const figureCard = target.closest('.figure-card') as HTMLElement;
        if (!figureCard) return;

        const id = Number(figureCard.getAttribute('data-id'));
        const multiSelect = e.ctrlKey || e.metaKey || e.shiftKey;

        // Check if the user clicked directly inside a form control
        const isTextInput = target.closest('input, textarea');

        if (isTextInput) {
            const isAlreadySelected = figureCard.classList.contains('is-selected');
            if (!isAlreadySelected) {
                store.toggleFigureSelection(id, multiSelect);
                batchedRefresh(refreshAll);
            }
            return;
        }

        store.toggleFigureSelection(id, multiSelect);
        batchedRefresh(refreshAll);
    }, { signal });

    figureContainer.addEventListener('focusout', (e: FocusEvent) => {
        const target = e.target as HTMLElement;

        if (target.matches('input, textarea')) {
            const figureCard = target.closest('.figure-card') as HTMLElement;
            if (!figureCard) return;

            const figId = Number(figureCard.getAttribute('data-id'));
            const field = target.getAttribute('data-field');
            const fieldKey = figId && field ? `fig-${figId}-${field}` : null;

            // Verify if focus is genuinely leaving this active figure field session
            uiState.typing.figures.end(fieldKey, () => {
                // Evaluate next focus target context defensively
                const destination = e.relatedTarget as HTMLElement | null;
                const isClickingControl = destination instanceof Element && (
                    destination.closest('.figure-card') ||
                    destination.closest('.key-card') ||
                    destination.closest('.app-menu-bar') ||
                    destination.closest('#add-figure-btn')
                );

                // Force an immediate structural refresh unless clicking an active app controller
                if (!isClickingControl) {
                    batchedRefresh(refreshAll);
                }
            });
        }
    }, { signal });

    // Intercept binary mutations when the operating system file picker dismisses
    figureContainer.addEventListener('change', async (e) => {
        const target = e.target as HTMLInputElement;
        if (target.classList.contains('hidden-file-picker')) {
            const file = target.files?.[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                showToast('⚠️ Only image files are supported.', 'error');
                target.value = '';
                return;
            }

            const card = target.closest('.figure-card') as HTMLElement;
            const figId = Number(card?.getAttribute('data-id'));
            if (isNaN(figId)) return;

            // Commit binary stream payload directly into client IndexedDB space
            workspaceStorage.uploadFigureBinary(figId, file);

            // Evict and clean stale historical URL footprints from browser system memory
            const oldUrl = activeObjectURLs.get(figId);
            if (oldUrl) URL.revokeObjectURL(oldUrl);

            // Populate the sync cache directory immediately using raw object bindings
            const freshUrl = URL.createObjectURL(file);
            activeObjectURLs.set(figId, freshUrl);
            store.updateFigure(figId, { filename: file.name });
            target.value = '';

            batchedRefresh(refreshAll);
        }
    }, { signal });

    setupFigureDragAndDrop(figureContainer, store, refreshAll, signal);
}

/** HTML5 drag-and-drop reordering for figure cards, with edge auto-scroll. */
function setupFigureDragAndDrop(figureContainer: HTMLElement, store: KeyStore, refreshAll: () => void, signal: AbortSignal) {
    let draggedFigId: number | null = null;
    let activeFigDropCard: HTMLElement | null = null;
    let activeFigDropClass: 'drag-drop-above' | 'drag-drop-below' | null = null;
    let activeFigDropRect: DOMRect | null = null;
    let cachedFigScrollY = 0;

    const clearFigDropMarkers = () => {
        if (activeFigDropCard) {
            activeFigDropCard.classList.remove('drag-drop-above', 'drag-drop-below');
            activeFigDropCard = null;
            activeFigDropClass = null;
            activeFigDropRect = null;
        }
    };

    const updateFigTargetTrackers = (clientY: number, cardEl: HTMLElement) => {
        const actualCard = cardEl.closest('.figure-card') as HTMLElement;
        if (!actualCard) {
            clearFigDropMarkers();
            return;
        }

        const currentScrollY = figureContainer.scrollTop;

        if (activeFigDropCard !== actualCard || !activeFigDropRect || cachedFigScrollY !== currentScrollY) {
            activeFigDropRect = actualCard.getBoundingClientRect();
            cachedFigScrollY = currentScrollY;
        }

        const relativeMouseY = clientY - activeFigDropRect.top;
        const currentClass = relativeMouseY < activeFigDropRect.height / 2 ? 'drag-drop-above' : 'drag-drop-below';

        if (activeFigDropCard !== actualCard || activeFigDropClass !== currentClass) {
            const rectToPreserve = activeFigDropRect;
            clearFigDropMarkers();
            actualCard.classList.add(currentClass);
            activeFigDropCard = actualCard;
            activeFigDropClass = currentClass;
            activeFigDropRect = rectToPreserve;
        }
    };

    figureContainer.addEventListener('dragstart', (e) => {
        const target = e.target as HTMLElement;
        const card = target.closest('.figure-card') as HTMLElement;
        if (!card) return;

        draggedFigId = Number(card.getAttribute('data-id'));
        requestAnimationFrame(() => {
            card.style.opacity = '0.4';
        });
    }, { signal });

    figureContainer.addEventListener('dragend', (e) => {
        const target = e.target as HTMLElement;
        const card = target.closest('.figure-card') as HTMLElement;
        if (card) card.style.opacity = '1';
        draggedFigId = null;
        clearFigDropMarkers();
    }, { signal });

    figureContainer.addEventListener('dragover', (e: DragEvent) => {
        if (draggedFigId === null) return;
        e.preventDefault();

        // Edge-scrolling logic targeting the figure container specifically
        const containerRect = figureContainer.getBoundingClientRect();

        if (e.clientY - containerRect.top < AUTO_SCROLL_THRESHOLD_PX) {
            figureContainer.scrollBy(0, -AUTO_SCROLL_SPEED_PX);
        } else if (containerRect.bottom - e.clientY < AUTO_SCROLL_THRESHOLD_PX) {
            figureContainer.scrollBy(0, AUTO_SCROLL_SPEED_PX);
        }

        updateFigTargetTrackers(e.clientY, e.target as HTMLElement);
    }, { signal });

    figureContainer.addEventListener('dragleave', (e: DragEvent) => {
        const target = e.relatedTarget as HTMLElement;
        if (!target || !figureContainer.contains(target)) {
            clearFigDropMarkers();
        }
    }, { signal });

    figureContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const card = target.closest('.figure-card') as HTMLElement;

        if (!card || draggedFigId === null) return;

        const targetFigId = Number(card.getAttribute('data-id'));
        if (draggedFigId === targetFigId) return;

        const position = card.classList.contains('drag-drop-above') ? 'above' : 'below';

        const figures = store.getFigures();
        const srcIdx = figures.findIndex(f => f.id === draggedFigId);
        let targetIdx = figures.findIndex(f => f.id === targetFigId);

        if (srcIdx === -1 || targetIdx === -1) return;

        // Shift index logic based on array splicing behavior
        if (position === 'below') {
            targetIdx = srcIdx < targetIdx ? targetIdx : targetIdx + 1;
        } else {
            targetIdx = srcIdx < targetIdx ? targetIdx - 1 : targetIdx;
        }

        if (srcIdx !== targetIdx) {
            store.reorderFigures(srcIdx, targetIdx);
            batchedRefresh(refreshAll);
        }
    }, { signal });
}

/**
 * Figure-reference tool: remembers the last alt1/alt2 caret (so the menu item can
 * target it after the click steals focus) and wires the Insert Figure Reference
 * menu command. The keyboard shortcut (Alt+F) lives in keyboardShortcuts.ts.
 */
export function setupFigureReference(keyContainer: HTMLElement, signal: AbortSignal) {
    // Keep the last alt1/alt2 caret fresh from any interaction, so the menu item can
    // target it after the click moves focus away (focusout alone is unreliable, and
    // never fires for keyboard-only callers).
    const captureCaret = (e: Event) => {
        if (isFigureTextarea(e.target)) {
            const t = e.target as HTMLTextAreaElement;
            lastFigureField = { el: t, start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0 };
        }
    };
    (['focusout', 'keyup', 'mouseup', 'input', 'select'] as const).forEach(type =>
        keyContainer.addEventListener(type, captureCaret, { signal })
    );

    document.querySelector('#cmd-insert-figref')?.addEventListener('click', () => {
        const target = resolveFigureTarget();
        if (!target) {
            showToast('Click into a key step description first, then insert a figure reference.', 'error');
            return;
        }
        insertFigureReference(target.el, target.start, target.end);
    }, { signal });
}
