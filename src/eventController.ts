// eventController.ts

import type { KeyStore, Couplet } from './store.ts';
import { renderPrintView, showToast } from './uiRenderer.ts';
import { triggerFileDownload, IS_MAC } from './utils.ts';
import { exportKeyToHTML } from './exporters/htmlExporter.ts';
import { exportKeyToLaTeX } from './exporters/latexExporter.ts';
import { exportKeyToPlainText } from './exporters/plainTextExporter.ts';

/**
 * Centralized Delegated Events Router Engine.
 * Wires behavioral controls directly onto DOM structural layouts.
 */
export function setupGlobalListeners(store: KeyStore, refreshAll: () => void) {
    const container = document.querySelector('#editor-container') as HTMLElement;
    if (!container) return;

    let isDragging = false;
    let typingSessionActive = false;
    let currentEditingFieldKey: string | null = null; // Tracks exactly which card + field is active
    let typingTimeoutId: number | null = null;        // Holds the debounce timer reference
    let activeDropCard: HTMLElement | null = null;
    let activeDropClass: 'drag-drop-above' | 'drag-drop-below' | null = null;

    const controller = new AbortController();
    const { signal } = controller;

    container.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;

        // If the user clicked the editor background layout area itself, drop focus
        if (target.id === 'editor-container' || target.classList.contains('editor-workspace')) {
            store.clearSelection();
            refreshAll();
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
        refreshAll();
    }, { signal });

    // don't work, the browser probably don't dispatch any even to intercept
    window.addEventListener('wheel', (e: WheelEvent) => {
        if (isDragging) {
            // Depending on your CSS layout, you might need to target '#editor-container' or '.app-shell' 
            // instead of window if your app has an internal scrollable div.
            window.scrollBy({
                top: e.deltaY,
                left: e.deltaX,
                behavior: 'auto' // 'auto' ensures immediate response without smoothing lag during drag
            });
        }
    }, { passive: true });

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
            refreshAll(); // Safely reconciles dynamic card errors/badges while retaining cursor focus
        }, 800);

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

            // CRITICAL GUARD: Verify if focus is genuinely leaving the active field session.
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
                    destination.closest('.sticky-toolbar') ||
                    destination.closest('#add-couplet-btn') || // Safe lookup for children/spans inside the button
                    destination.closest('#control-panel-modal')
                );

                // Defer layout updates only if the user isn't interacting with app controls
                if (!isClickingControl) {
                    setTimeout(refreshAll, 0);
                }
            }
        }
    }, { signal });

    // UNIFIED CONTROL PANEL INTERACTION HANDLERS
    const modal = document.querySelector('#control-panel-modal') as HTMLElement;

    document.querySelector('#cmd-open-panel')?.addEventListener('click', () => {
        if (modal) modal.style.display = 'flex';
    }, { signal });

    const closeModal = () => { if (modal) modal.style.display = 'none'; };
    document.querySelector('#modal-close-btn')?.addEventListener('click', closeModal, { signal });

    // Close modal if user clicks outside the modal content container
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    }, { signal });

    // Tab Switching Sub-Router Engine
    const tabButtons = document.querySelectorAll('.modal-tabs .tab-btn');
    const tabContents = document.querySelectorAll('.modal-body .tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => (c as HTMLElement).style.display = 'none');
            btn.classList.add('active');
            const targetContent = document.getElementById(targetTab!) as HTMLElement;
            if (targetContent) targetContent.style.display = 'block';
        }, { signal });
    });

    // Centralized HTML5 Drag-and-Drop Operations
    container.addEventListener('dragstart', (e) => {
        isDragging = true;
        const target = e.target as HTMLElement;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));
        store.startDragging(id);
        card.classList.remove('is-hovered', 'is-active');
        card.style.opacity = '0.4';
    }, { signal });

    const clearDropMarkers = () => {
        if (activeDropCard) {
            activeDropCard.classList.remove('drag-drop-above', 'drag-drop-below');
            activeDropCard = null;
            activeDropClass = null;
        }
    };

    container.addEventListener('dragend', (e) => {
        isDragging = false;
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
        const scrollThreshold = 60; // Distance from edge in pixels to trigger scroll
        const scrollSpeed = 15;     // How fast to scroll

        if (e.clientY < scrollThreshold) {
            // Cursor is near the top of the viewport
            window.scrollBy(0, -scrollSpeed);
        } else if (window.innerHeight - e.clientY < scrollThreshold) {
            // Cursor is near the bottom of the viewport
            window.scrollBy(0, scrollSpeed);
        }
        updateTargetTrackers(e.clientX, e.clientY, e.target as HTMLElement);
    }, { signal });

    container.addEventListener('dragleave', (e: DragEvent) => {
        const target = e.relatedTarget as HTMLElement;
        if (!target || !container.contains(target)) {
            clearDropMarkers();
        }
    }, { signal });

    container.addEventListener('drop', (e) => {
        isDragging = false;
        e.preventDefault();
        const target = e.target as HTMLElement;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;
        const coupletId = Number(card.getAttribute('data-id'));
        if (store.draggedId === null || store.draggedId === coupletId) return;

        // Unified source of truth: Read directly from the target card's layout classes
        const position: 'above' | 'below' = card.classList.contains('drag-drop-above') ? 'above' : 'below';

        store.reorderCouplets(store.draggedId, coupletId, position);
        refreshAll();
    }, { signal });

    const updateTargetTrackers = (clientX: number, clientY: number, targetElement: HTMLElement) => {
        const cardEl = targetElement.closest('.key-card') as HTMLElement;

        if (!cardEl) {
            clearDropMarkers();
            return;
        }

        const rect = cardEl.getBoundingClientRect();
        const relativeMouseY = clientY - rect.top;
        const currentClass = relativeMouseY < rect.height / 2 ? 'drag-drop-above' : 'drag-drop-below';

        // Only touch the DOM if the target card or position state actually changed!
        if (activeDropCard !== cardEl || activeDropClass !== currentClass) {
            clearDropMarkers(); // Clear the old one
            cardEl.classList.add(currentClass);
            activeDropCard = cardEl;
            activeDropClass = currentClass;
        }
    };

    // MOUSE TRACKER FOR PASTE ROUTING
    container.addEventListener('mousemove', (e: MouseEvent) => {
        if (e.buttons === 0) {
            // Short-circuit immediately if there's nothing to paste
            if (!store.hasClipboardData()) {
                clearDropMarkers();
                return;
            }

            const target = e.target as HTMLElement;
            if (target.closest('.key-card')) {
                updateTargetTrackers(e.clientX, e.clientY, target);
            } else {
                clearDropMarkers();
            }
        }
    }, { signal });

    container.addEventListener('mouseleave', () => {
        clearDropMarkers();
    }, { signal });

    // ==========================================
    // STANDALONE TOOLBAR ACTIONS
    // ==========================================

    document.querySelector('#cmd-save')?.addEventListener('click', () => {
        try {
            // Simple, clean state instruction
            store.saveToStorage();
            showToast("💾 Changes saved to Browser Local Storage!", "success");
            refreshAll();

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
        const content = JSON.stringify(store.getKey(), null, 2);
        triggerFileDownload(content, 'dichotomous_key_export.json', 'application/json');
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
            refreshAll();
        } catch (err) {
            alert("Malformed JSON structure: Unable to parse file stream.");
        } finally {
            if (hiddenInput) hiddenInput.value = '';
        }
    }, { signal });

    document.querySelector('#cmd-reorder')?.addEventListener('click', () => {
        store.autoOrder();
        showToast("Key steps reordered with shorter branches first!", "success");
        refreshAll();
    }, { signal });

    document.querySelector('#add-couplet-btn')?.addEventListener('click', () => {
        createNewCoupletWithFocus(store, refreshAll);
    }, { signal });

    document.querySelector('#export-format-selector')?.addEventListener('change', (e) => {
        const selectEl = e.target as HTMLSelectElement;
        const format = selectEl.value;
        if (!format) return;

        if (format === 'text') {
            exportKeyToPlainText(store);
        } else if (format === 'html') {
            exportKeyToHTML(store);
        } else if (format === 'latex') {
            exportKeyToLaTeX(store);
        } else {
            alert(`Export not implemented for: [${format.toUpperCase()}].`);
        }
        selectEl.value = "";
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
                createNewCoupletWithFocus(store, refreshAll);
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                store.selectAll();
                refreshAll();
                return;
            }

            // swap alternatives on selected card(s)
            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (store.getSelectedIds().size > 0) {
                    const success = store.swapSelectedCouplets();

                    if (success) {
                        showToast("Swapped choice configurations.", "success");
                        refreshAll();
                    }
                }
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    if (store.redo()) refreshAll();
                } else {
                    if (store.undo()) refreshAll();
                }
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                if (store.redo()) refreshAll();
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (store.getSelectedIds().size > 0) {
                    e.preventDefault();
                    if (store.getSelectedIds().size === 0) return;

                    if (confirm("Confirm removing highlighted key steps?")) {
                        store.deleteSelected();
                        refreshAll();
                    }
                }
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();

                // Natively look up the modal element safely to eliminate scope constraints

                const modalElement = document.querySelector('#control-panel-modal') as HTMLElement | null;

                if (modalElement && modalElement.style.display !== 'none') {
                    modalElement.style.display = 'none';
                    return;
                }

                store.clearSelection();
                refreshAll();
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                if (store.getSelectedIds().size > 0) {
                    store.copySelectedCards();
                    showToast(`Copied ${store.getSelectedIds().size} step(s) to clipboard.`, 'success');
                }
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'x') {
                e.preventDefault();
                const selectedCount = store.getSelectedIds().size;

                if (selectedCount > 0) {
                    if (confirm(`Confirm cutting ${selectedCount} highlighted step(s) to clipboard?`)) {
                        // Change these two lines:
                        store.cutSelectedCards();

                        showToast(`Cut ${selectedCount} step(s) to clipboard.`, 'success');
                        refreshAll();
                    }
                }
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'v') {
                e.preventDefault();

                let targetId: number | undefined = undefined;
                let position: 'above' | 'below' = 'below';

                const hoverMarker = document.querySelector('.drag-drop-above, .drag-drop-below') as HTMLElement;
                const hoverCard = hoverMarker?.closest('.key-card') as HTMLElement;

                if (hoverCard) {
                    targetId = Number(hoverCard.getAttribute('data-id'));
                    position = hoverMarker.classList.contains('drag-drop-above') ? 'above' : 'below';
                } else {
                    const selectedArray = Array.from(store.getSelectedIds());
                    targetId = selectedArray.length > 0 ? selectedArray[selectedArray.length - 1] : undefined;
                }

                if (store.pasteCards(targetId, position)) {
                    showToast("Pasted steps from clipboard.", "success");
                    refreshAll();
                }
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