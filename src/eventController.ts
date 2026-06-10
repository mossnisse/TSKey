// eventController.ts

import type { KeyStore, Couplet } from './store.ts';
import { renderPrintView, showToast } from './uiRenderer.ts';
import { IS_MAC } from './utils.ts';
import { exportKeyToHTML } from './exporters/htmlExporter.ts';
import { exportKeyToLaTeX } from './exporters/latexExporter.ts';
import { exportKeyToPlainText } from './exporters/plainTextExporter.ts';
import { exportKeyToJSON } from './exporters/jsonExporter.ts';

const DEBOUNCE_TYPING_MS = 800;
const AUTO_SCROLL_THRESHOLD_PX = 80;
const AUTO_SCROLL_SPEED_PX = 15;

let refreshScheduled = false;

/**
 * Wraps a synchronous render call in a performance-friendly animation frame.
 */
function batchedRefresh(refreshFn: () => void) {
    if (refreshScheduled) return;
    refreshScheduled = true;

    requestAnimationFrame(() => {
        refreshFn();
        refreshScheduled = false;
    });
}

/**
 * Centralized Delegated Events Router Engine.
 * Wires behavioral controls directly onto DOM structural layouts.
 */
export function setupGlobalListeners(store: KeyStore, refreshAll: () => void) {
    const container = document.querySelector('#editor-container') as HTMLElement;
    if (!container) return;

    let typingSessionActive = false;
    let currentEditingFieldKey: string | null = null; // Tracks exactly which card + field is active
    let typingTimeoutId: number | null = null;        // Holds the debounce timer reference
    let activeDropCard: HTMLElement | null = null;
    let activeDropClass: 'drag-drop-above' | 'drag-drop-below' | null = null;
    let activeDropRect: DOMRect | null = null;        // Cached bounding metrics to prevent layout thrashing


    const controller = new AbortController();
    const { signal } = controller;

    container.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;

        // If the user clicked the editor background layout area itself, drop focus
        if (target.id === 'editor-container' || target.classList.contains('editor-workspace')) {
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

    // CONSOLIDATED INPUT ROUTER (Handles Undo Debouncing + Link Validation)
    container.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        if (!target.classList.contains('input-sync')) return;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));
        const field = target.getAttribute('data-field')!;
        const key = store.getKey();
        const fieldKey = `${id}-${field}`;
        store.setActiveCard(id);

        // Undo History Checkpoint Manager
        if (!typingSessionActive || currentEditingFieldKey !== fieldKey) {
            store.commitHistoryCheckpoint(); // Save state BEFORE these new edits apply
            typingSessionActive = true;
            currentEditingFieldKey = fieldKey;
        }

        // Clear previous timer to extend the active typing chunk
        if (typingTimeoutId !== null) {
            clearTimeout(typingTimeoutId);
        }

        // If user stops typing for 800ms, trigger full re-evaluation of structural warnings safely
        typingTimeoutId = window.setTimeout(() => {
            typingSessionActive = false;
            typingTimeoutId = null;
            batchedRefresh(refreshAll);
        }, DEBOUNCE_TYPING_MS);

        let updatePayload: Partial<Omit<Couplet, 'id'>> = {};

        if (field === 'dest1' || field === 'dest2') {
            const linkField = field === 'dest1' ? 'link1' : 'link2';
            const taxaField = field === 'dest1' ? 'taxa1' : 'taxa2';
            const valStr = target.value.trim();

            if (/^\d+$/.test(valStr)) {

                // Input is purely numerical: Treat as a Goto Step
                const num = parseInt(valStr, 10);

                if (num > 0 && num <= key.length) {
                    const targetCard = key[num - 1];
                    updatePayload[linkField] = targetCard.id;
                    updatePayload[taxaField] = '';
                    target.classList.remove('input-error');
                } else {
                    // Unresolved link: Zero out ID link, store invalid value placeholder
                    updatePayload[linkField] = 0;
                    updatePayload[taxaField] = valStr;
                    target.classList.add('input-error');
                }
            } else {
                // Input contains text: Treat as a Taxon
                updatePayload[linkField] = 0;
                updatePayload[taxaField] = valStr;
                target.classList.remove('input-error');
            }
        } else {
            updatePayload[field as keyof Omit<Couplet, 'id'>] = target.value as never;
        }

        store.updateCouplet(id, updatePayload);
        renderPrintView(store);
    }, { signal });

    // Centralized Drag and Form Text Highlight Mitigation
    container.addEventListener('focusin', (e) => {
        const target = e.target as HTMLElement;

        if (target.matches('input, textarea')) {
            const card = target.closest('.key-card') as HTMLElement;
            if (!card) return;
            card.draggable = false;

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
    container.addEventListener('focusout', (e: FocusEvent) => {
        const target = e.target as HTMLElement;

        if (target.matches('input, textarea')) {
            const card = target.closest('.key-card') as HTMLElement;
            if (card) card.draggable = true;

            // Construct the unique identifier for this specific field
            const id = card ? Number(card.getAttribute('data-id')) : null;
            const field = target.getAttribute('data-field');
            const fieldKey = id && field ? `${id}-${field}` : null;

            // Verify if focus is genuinely leaving the active field session.
            // This completely immunizes the handler against programmatic DOM re-render loops.
            const isActualSessionEnd = currentEditingFieldKey !== null && currentEditingFieldKey === fieldKey;

            // Only run side-effects and teardowns if this is a genuine session end
            if (isActualSessionEnd) {
                // Clear session tracking variables safely inside the guard
                typingSessionActive = false;
                currentEditingFieldKey = null;

                // Clear any pending debounce timers
                if (typingTimeoutId !== null) {
                    clearTimeout(typingTimeoutId);
                    typingTimeoutId = null;
                }

                // Inform the data layer to drop active card context
                store.clearActiveCard();

                // Trigger the warning toast if the field has an unresolved destination
                if (target.classList.contains('input-error') && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && card) {
                    const invalidVal = target.value;
                    showToast(`⚠️ Destination "${invalidVal}" is unresolved. Saved as text context.`, "error");
                }

                // Evaluate next target context defensively (ensuring target is an Element node)
                const destination = e.relatedTarget as HTMLElement | null;
                const isClickingControl = destination instanceof Element && (
                    destination.closest('.key-card') ||
                    destination.closest('.app-menu-bar') ||
                    destination.closest('#add-couplet-btn') || // Safe lookup for children/spans inside the button
                    destination.closest('#control-panel-modal')
                );

                // Defer layout updates only if the user isn't interacting with app controls
                if (!isClickingControl) {
                    batchedRefresh(refreshAll);
                }
            }
        }
    }, { signal });

    // Dialog elements queries
    const modalShortcuts = document.getElementById('modal-shortcuts') as HTMLElement;
    const modalOptions = document.getElementById('modal-options') as HTMLElement;
    const modalAbout = document.getElementById('modal-about') as HTMLElement;

    // --- DIALOG MODAL OPEN TRIGGERS ---
    document.getElementById('cmd-open-shortcuts')?.addEventListener('click', () => {
        modalShortcuts.style.display = 'flex';
    }, { signal });
    document.getElementById('cmd-open-options')?.addEventListener('click', () => {
        modalOptions.style.display = 'flex';
    }, { signal });
    document.getElementById('cmd-open-about')?.addEventListener('click', () => {
        modalAbout.style.display = 'flex';
    }, { signal });

    // --- DIALOG MODAL CLOSE TRIGGERS ---
    document.getElementById('modal-shortcuts-close')?.addEventListener('click', () => {
        modalShortcuts.style.display = 'none';
    }, { signal });
    document.getElementById('modal-options-close')?.addEventListener('click', () => {
        modalOptions.style.display = 'none';
    }, { signal });
    document.getElementById('modal-about-close')?.addEventListener('click', () => {
        modalAbout.style.display = 'none';
    }, { signal });

    // Centralized HTML5 Drag-and-Drop Operations
    container.addEventListener('dragstart', (e) => {
        const target = e.target as HTMLElement;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));
        store.startDragging(id);
        card.classList.remove('is-hovered', 'is-active');
        requestAnimationFrame(() => {
            card.style.opacity = '0.4';
        });
    }, { signal });

    const clearDropMarkers = () => {
        if (activeDropCard) {
            activeDropCard.classList.remove('drag-drop-above', 'drag-drop-below');
            activeDropCard = null;
            activeDropClass = null;
            activeDropRect = null; // Purge layout metric cache
        }
    };

    container.addEventListener('dragend', (e) => {
        const target = e.target as HTMLElement;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        card.style.opacity = '1';
        store.stopDragging();
        clearDropMarkers();
    }, { signal });

    container.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();

        // --- EDGE AUTO-SCROLL LOGIC ---

        if (e.clientY < AUTO_SCROLL_THRESHOLD_PX) {
            // Cursor is near the top of the viewport
            window.scrollBy(0, -AUTO_SCROLL_SPEED_PX);
        } else if (window.innerHeight - e.clientY < AUTO_SCROLL_THRESHOLD_PX) {
            // Cursor is near the bottom of the viewport
            window.scrollBy(0, AUTO_SCROLL_SPEED_PX);
        }
        updateTargetTrackers(e.clientY, e.target as HTMLElement);
    }, { signal });

    container.addEventListener('dragleave', (e: DragEvent) => {
        const target = e.relatedTarget as HTMLElement;
        if (!target || !container.contains(target)) {
            clearDropMarkers();
        }
    }, { signal });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;
        const coupletId = Number(card.getAttribute('data-id'));
        if (store.draggedId === null || store.draggedId === coupletId) return;

        // Unified source of truth: Read directly from the target card's layout classes
        const position: 'above' | 'below' = card.classList.contains('drag-drop-above') ? 'above' : 'below';

        store.reorderCouplets(store.draggedId, coupletId, position);
        batchedRefresh(refreshAll);
    }, { signal });

    const updateTargetTrackers = (clientY: number, cardEl: HTMLElement) => {
        const actualCard = cardEl.classList.contains('key-card') ? cardEl : cardEl.closest('.key-card') as HTMLElement;

        if (!actualCard) {
            clearDropMarkers();
            return;
        }

        // Cache the bounding client rect ONLY when entering a new card context
        if (activeDropCard !== actualCard || !activeDropRect) {
            activeDropRect = actualCard.getBoundingClientRect();
        }

        const relativeMouseY = clientY - activeDropRect.top;
        const currentClass = relativeMouseY < activeDropRect.height / 2 ? 'drag-drop-above' : 'drag-drop-below';

        // Only update the DOM if the target layout or position state actually altered
        if (activeDropCard !== actualCard || activeDropClass !== currentClass) {
            const rectToKeep = activeDropCard === actualCard ? activeDropRect : null;

            clearDropMarkers(); // Safe cleanup

            actualCard.classList.add(currentClass);
            activeDropCard = actualCard;
            activeDropClass = currentClass;

            // Preserve current metrics or safely compute for next state transitions
            activeDropRect = rectToKeep || actualCard.getBoundingClientRect();
        }
    };


    // ==========================================
    // MENU BAR ACTION DISPATCHERS
    // ==========================================

    // --- FILE MENU ACTION BINDINGS ---
    document.querySelector('#cmd-save')?.addEventListener('click', () => {
        try {
            // Simple, clean state instruction
            store.saveToStorage();
            showToast("💾 Changes saved to Browser Local Storage!", "success");
            batchedRefresh(refreshAll);
        } catch (error: any) {
            console.error("Save Operation Failed: ", error);
            let userMessage = "Failed to save data. An unknown error occurred.";
            if (error.name === 'QuotaExceededError' || error.code === 22) {
                userMessage = "⚠️ Save Failed: Browser Local Storage is completely full! Please free up space or export your key as a JSON file.";
            } else if (error.message) {
                userMessage = `⚠️ Save Failed: ${error.message}`;
            }
            alert(userMessage);
        }
    }, { signal });

    document.querySelector('#cmd-export-json')?.addEventListener('click', () => {
        exportKeyToJSON(store);
    }, { signal });

    const hiddenInput = document.querySelector('#file-import-hidden') as HTMLInputElement;

    document.querySelector('#cmd-trigger-import')?.addEventListener('click', () => {
        hiddenInput?.click();
    }, { signal });

    hiddenInput?.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
            const fileText = await file.text();
            const rawData = JSON.parse(fileText);
            const importResult = store.importJsonData(rawData);

            if (!importResult.success) {
                alert(`Failed to import JSON schema:\n• ${importResult.errors.join('\n• ')}`);
                return;
            }

            showToast("Key configuration data imported successfully!", "success");
            batchedRefresh(refreshAll);
        } catch (err) {
            alert("Malformed JSON structure: Unable to parse file stream.");
        } finally {
            if (hiddenInput) hiddenInput.value = '';
        }
    }, { signal });

    document.querySelector('#cmd-export-text')?.addEventListener('click', () => exportKeyToPlainText(store), { signal });
    document.querySelector('#cmd-export-html')?.addEventListener('click', () => exportKeyToHTML(store), { signal });
    document.querySelector('#cmd-export-latex')?.addEventListener('click', () => exportKeyToLaTeX(store), { signal });

    // --- EDIT MENU ACTION BINDINGS ---
    document.querySelector('#cmd-undo')?.addEventListener('click', () => {
        if (store.undo()) batchedRefresh(refreshAll);
    }, { signal });

    document.querySelector('#cmd-redo')?.addEventListener('click', () => {
        if (store.redo()) batchedRefresh(refreshAll);
    }, { signal });

    document.querySelector('#cmd-cut')?.addEventListener('click', () => {
        const selectedCount = store.getSelectedIds().size;
        if (selectedCount > 0) {
            if (confirm(`Confirm cutting ${selectedCount} highlighted step(s) to clipboard?`)) {
                store.cutSelectedCards();
                showToast(`Cut ${selectedCount} step(s) to clipboard.`, 'success');
                batchedRefresh(refreshAll);
            }
        }
    }, { signal });

    document.querySelector('#cmd-copy')?.addEventListener('click', () => {
        const selectedCount = store.getSelectedIds().size;
        if (selectedCount > 0) {
            store.copySelectedCards();
            showToast(`Copied ${selectedCount} step(s) to clipboard.`, 'success');
            batchedRefresh(refreshAll);
        }
    }, { signal });

    document.querySelector('#cmd-paste-above')?.addEventListener('click', () => {
        executePaste(store, refreshAll, 'above');
    }, { signal });

    document.querySelector('#cmd-paste-below')?.addEventListener('click', () => {
        executePaste(store, refreshAll, 'below');
    }, { signal });

    document.querySelector('#cmd-delete')?.addEventListener('click', () => {
        const selectedCount = store.getSelectedIds().size;
        if (selectedCount > 0) {
            if (confirm("Confirm removing highlighted key steps?")) {
                store.deleteSelected();
                showToast(`Deleted ${selectedCount} step(s).`, 'success');
                batchedRefresh(refreshAll);
            }
        }
    }, { signal });

    document.querySelector('#cmd-swap')?.addEventListener('click', () => {
        if (store.getSelectedIds().size > 0) {
            if (store.swapSelectedCouplets()) {
                showToast("Swapped choice configurations.", "success");
                batchedRefresh(refreshAll);
            }
        }
    }, { signal });

    // Handles both the application layout button and Edit Menu item mappings safely
    const triggerAppendAction = () => createNewCoupletWithFocus(store, refreshAll);
    document.querySelector('#cmd-add')?.addEventListener('click', triggerAppendAction, { signal });
    document.querySelector('#add-couplet-btn')?.addEventListener('click', triggerAppendAction, { signal });

    document.querySelector('#cmd-clear')?.addEventListener('click', () => {
        store.clearSelection();
        batchedRefresh(refreshAll);
    }, { signal });

    // --- TOOLS MENU ACTION BINDINGS ---
    document.querySelector('#cmd-reorder')?.addEventListener('click', () => {
        store.autoOrder();
        showToast("Key steps reordered with shorter branches first!", "success");
        batchedRefresh(refreshAll);
    }, { signal });

    return () => {
        controller.abort(); // Cleans up all secondary global listeners safely
    };
}

/**
 * Desktop Command Shortcut Interceptor Engine.
 */
export function setupKeyboardShortcuts(store: KeyStore, refreshAll: () => void) {
    const handleKeyDown = (e: KeyboardEvent) => {
        const hasModifier = IS_MAC ? e.metaKey : e.ctrlKey;
        const activeElement = document.activeElement;
        const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.hasAttribute('contenteditable')
        );

        // DUAL-CONTEXT CRITICAL COMMANDS
        if (hasModifier && e.key.toLowerCase() === 's') {
            e.preventDefault();
            document.querySelector<HTMLButtonElement>('#cmd-save')?.click();
            return;
        }

        // CANVAS CONTEXT COMMANDS (Only if NOT typing)
        if (!isTyping) {
            // insert a new couplet when canvas is active
            if (e.altKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-add')?.click();
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                store.selectAll();
                batchedRefresh(refreshAll);
                return;
            }

            // swap alternatives on selected card(s)
            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-swap')?.click();
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    document.querySelector<HTMLButtonElement>('#cmd-redo')?.click();
                } else {
                    document.querySelector<HTMLButtonElement>('#cmd-undo')?.click();
                }
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-redo')?.click();
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-delete')?.click();
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                const openModal = document.querySelector('.modal-overlay[style*="display: flex"]') as HTMLElement | null;

                // closes dialogs
                if (openModal) {
                    openModal.style.display = 'none';
                    return;
                }

                document.querySelector<HTMLButtonElement>('#cmd-clear')?.click();
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-copy')?.click();
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'x') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-cut')?.click();
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                // e.shiftKey determines the direction natively
                const position = e.shiftKey ? 'above' : 'below';
                executePaste(store, refreshAll, position);
                return;
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
}

/**
 * Shared helper utility to cleanly insert a couplet and transfer user focus.
 */
function createNewCoupletWithFocus(store: KeyStore, refreshAll: () => void) {
    const newId = store.addCouplet();
    refreshAll();

    // Query DOM layout context to automatically transfer focus to the new card's first field
    const newCard = document.querySelector(`.key-card[data-id="${newId}"]`);
    const textarea = newCard?.querySelector('textarea[data-field="alt1"]') as HTMLTextAreaElement | null;

    if (textarea) {
        textarea.focus();
    }
}

function executePaste(store: KeyStore, refreshAll: () => void, position: 'above' | 'below') {
    let targetId: number | undefined = undefined;
    const selectedArray = Array.from(store.getSelectedIds());
    const key = store.getKey();

    if (selectedArray.length > 0) {
        // If cards are selected, anchor to the boundaries of the selection block
        targetId = position === 'below'
            ? selectedArray[selectedArray.length - 1]
            : selectedArray[0];
    } else if (key.length > 0) {
        // Fallback: If nothing is selected, target the absolute boundaries of the list
        targetId = position === 'above'
            ? key[0].id
            : key[key.length - 1].id;
    }

    // If the key is completely empty (key.length === 0), targetId remains undefined,
    // which allows the store to initialize the first cards normally.
    if (store.pasteCards(targetId, position)) {
        // Dynamically tailor the feedback toast so the user knows exactly where it landed
        const locationText = selectedArray.length > 0
            ? `${position} selection`
            : (position === 'above' ? 'at the beginning' : 'at the end');

        showToast(`Pasted steps ${locationText}.`, "success");
        batchedRefresh(refreshAll);
    }
}