// eventController.ts
import type { KeyStore } from './store.ts';
import { renderPrintView, showToast } from './uiRenderer.ts';
import { triggerFileDownload, isMacUser } from './utils.ts';
import { exportKeyToHTML } from './exporters/htmlExporter.ts';
import { exportKeyToLaTeX } from './exporters/latexExporter.ts';
import { exportKeyToPlainText } from './exporters/plainTextExporter.ts';

function parseLinkInput(val: string, maxItems: number): number {
    const num = parseInt(val) || 0;
    if (num <= 0 || num > maxItems) return 0;
    return num;
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

    // Track state of the insertion location
    let currentDropTargetCard: HTMLElement | null = null;
    let insertionPosition: 'above' | 'below' | null = null;

    container.addEventListener('click', (e) => {
        const mouseEvent = e as MouseEvent;
        const target = e.target as HTMLElement;

        // If the user clicked the editor background layout area itself, drop focus
        if (target.id === 'editor-container' || target.classList.contains('editor-workspace')) {
            store.clearSelection(); // ← Uniform API Call
            refreshAll();
            return;
        }

        // Prevent card selection if the user is interacting with text inputs or textareas
        if (target.closest('input, textarea')) return;

        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));

        // Enable multi-select when holding Control, Command (Mac), or Shift keys
        const multiSelect = mouseEvent.ctrlKey || mouseEvent.metaKey || mouseEvent.shiftKey;

        store.toggleSelection(id, multiSelect);
        refreshAll();
    });

    // Centralized Multi-Selection Router Click
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
        // Trigger a checkpoint ONLY if this is a fresh typing session or we jumped to a new input field
        if (!typingSessionActive || currentEditingFieldKey !== fieldKey) {
            store.commitHistoryCheckpoint(); // Save state BEFORE these new edits apply
            typingSessionActive = true;
            currentEditingFieldKey = fieldKey;
        }

        // Clear the previous timer to extend the active typing chunk
        if (typingTimeoutId !== null) {
            clearTimeout(typingTimeoutId);
        }

        // If the user stops typing for 800ms, clear the session flag.
        // The next character typed will trigger a brand new Undo checkpoint.
        typingTimeoutId = window.setTimeout(() => {
            typingSessionActive = false;
            typingTimeoutId = null;
        }, 800);

        // Input Validation & Value Extraction
        let value: string | number = target.value;
        if (field === 'link1' || field === 'link2') {
            const num = parseInt(value) || 0;

            // Check for explicit out-of-bounds numbers
            if (value !== '' && (num <= 0 || num > key.length)) {
                target.classList.add('input-error');
                value = 0; // Fallback safely to prevent graph corruption
            } else {
                target.classList.remove('input-error');
                const stepNum = parseLinkInput(value, key.length);
                value = stepNum > 0 ? key[stepNum - 1].id : 0;
            }
        }

        // State Mutation & Render
        // Update in-memory state silently, bypassing automatic history tracking
        store.updateCouplet(id, { [field]: value });
        renderPrintView(store);
    });

    // Centralized Drag and Form Text Highlight Mitigation
    container.addEventListener('focusin', (e) => {
        const target = e.target as HTMLElement;
        if (target.matches('input, textarea')) {
            const card = target.closest('.key-card') as HTMLElement;
            if (card) card.draggable = false;

            if (target.classList.contains('input-goto') && target instanceof HTMLInputElement) {
                target.select();
            }
        }
    });

    // Centralized Serialization Execution Focusout
    container.addEventListener('focusout', (evt: Event) => {
        const e = evt as FocusEvent;
        const target = e.target as HTMLElement;

        if (target.matches('input, textarea')) {
            const card = target.closest('.key-card') as HTMLElement;
            if (card) card.draggable = true;

            // HARD RESET: The user exited the current text input context.
            typingSessionActive = false;
            currentEditingFieldKey = null;
            if (typingTimeoutId !== null) {
                clearTimeout(typingTimeoutId);
                typingTimeoutId = null;
            }

            if (target.classList.contains('input-error') && target instanceof HTMLInputElement) {
                const invalidVal = target.value;
                showToast(`⚠️ Step "${invalidVal}" does not exist yet. Link reset to unassigned.`, "error");
                target.classList.remove('input-error');
            }

            store.clearActiveCard();

            const destination = e.relatedTarget as HTMLElement | null;
            // Prevent destructive DOM re-renders if jumping directly to a sister card
            if (!destination || !destination.closest('.key-card')) {
                refreshAll();
            }
        }
    });

    // Centralized HTML5 Drag-and-Drop Operations
    container.addEventListener('dragstart', (e) => {
        const target = e.target as HTMLElement;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));
        store.startDragging(id);
        card.classList.remove('is-hovered', 'is-active');
        card.style.opacity = '0.4';
    });

    container.addEventListener('dragend', (e) => {
        const target = e.target as HTMLElement;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        card.style.opacity = '1';
        store.stopDragging();
        clearDropMarkers();
    });

    // Clear marker lines across the entire container
    const clearDropMarkers = () => {
        container.querySelectorAll('.key-card').forEach(el => {
            el.classList.remove('drag-drop-above', 'drag-drop-below');
        });
    };

    container.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();

        const target = e.target as HTMLElement;
        const cardEl = target.closest('.key-card') as HTMLElement;

        if (!cardEl) {
            clearDropMarkers();
            currentDropTargetCard = null;
            insertionPosition = null;
            return;
        }

        currentDropTargetCard = cardEl;

        const rect = cardEl.getBoundingClientRect();
        const relativeMouseY = e.clientY - rect.top;

        clearDropMarkers();

        if (relativeMouseY < rect.height / 2) {
            cardEl.classList.add('drag-drop-above');
            insertionPosition = 'above';
        } else {
            cardEl.classList.add('drag-drop-below');
            insertionPosition = 'below';
        }

        // for copy/paste editor cards functionality
        updateTargetTrackers(e.clientX, e.clientY, e.target as HTMLElement);
    });

    container.addEventListener('dragleave', (e: DragEvent) => {
        // Only clear if exiting the editor window entirely
        const target = e.relatedTarget as HTMLElement;
        if (!target || !container.contains(target)) {
            clearDropMarkers();
        }
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        const coupletId = Number(card.getAttribute('data-id'));
        if (store.draggedId === null || store.draggedId === coupletId) return;

        store.reorderCouplets(store.draggedId, coupletId);
        refreshAll();
    });

    // copy paste editor cards functionality

    // --- REUSED MATHEMATICS CONTROLLER FUNCTION ---
    const updateTargetTrackers = (clientX: number, clientY: number, targetElement: HTMLElement) => {
        const cardEl = targetElement.closest('.key-card') as HTMLElement;
        if (!cardEl) {
            clearDropMarkers();
            currentDropTargetCard = null;
            insertionPosition = null;
            return;
        }

        currentDropTargetCard = cardEl;
        const rect = cardEl.getBoundingClientRect();
        const relativeMouseY = clientY - rect.top;

        clearDropMarkers();

        if (relativeMouseY < rect.height / 2) {
            cardEl.classList.add('drag-drop-above');
            insertionPosition = 'above';
        } else {
            cardEl.classList.add('drag-drop-below');
            insertionPosition = 'below';
        }
    };

    // MOUSE TRACKER FOR PASTE ROUTING
    // This watches where the cursor is, so if the user hits Ctrl+V, it uses the exact same visual target!
    container.addEventListener('mousemove', (e: MouseEvent) => {
        // Only show visual line highlights during copy-paste tracking if NOT dragging an item
        if (e.buttons === 0) {
            const target = e.target as HTMLElement;
            // Only draw line indicators if hovering near the edges of a key card and clipboard has data
            if (target.closest('.key-card') && store.hasClipboardData()) {
                updateTargetTrackers(e.clientX, e.clientY, target);
            } else {
                clearDropMarkers();
            }
        }
    });

    container.addEventListener('mouseleave', () => {
        clearDropMarkers();
    });

    // ==========================================
    // STANDALONE TOOLBAR ACTIONS
    // ==========================================
    document.querySelector('#cmd-undo')?.addEventListener('click', () => { if (store.undo()) refreshAll(); });

    document.querySelector('#cmd-redo')?.addEventListener('click', () => { if (store.redo()) refreshAll(); });

    document.querySelector('#cmd-save')?.addEventListener('click', () => {
        try {
            const currentData = store.getKey();
            if (!Array.isArray(currentData) || currentData.length === 0) {
                throw new Error("Cannot save an empty or corrupted data structure.");
            }

            const serializedData = JSON.stringify(currentData);
            localStorage.setItem('dichotomous_key', serializedData);

            store.markSaved();
            showToast("💾 Changes saved to local browser data!", "success");
            refreshAll();

        } catch (error: any) {
            console.error("Save Operation Failed: ", error);
            let userMessage = "Failed to save data. An unknown error occurred.";
            if (error.name === 'QuotaExceededError' || error.code === 22) {
                userMessage = "⚠️ Save Failed: Browser LocalStorage is completely full! Please free up space or export your key as a JSON file.";
            } else if (error.message) {
                userMessage = `⚠️ Save Failed: ${error.message}`;
            }
            alert(userMessage);
        }
    });

    document.querySelector('#cmd-export-json')?.addEventListener('click', () => {
        const content = JSON.stringify(store.getKey(), null, 2);
        triggerFileDownload(content, 'dichotomous_key_export.json', 'application/json');
    });

    const hiddenInput = document.querySelector('#file-import-hidden') as HTMLInputElement;
    document.querySelector('#cmd-trigger-import')?.addEventListener('click', () => {
        hiddenInput?.click();
    });

    hiddenInput?.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
            const fileText = await file.text();
            const rawData = JSON.parse(fileText);

            // This now returns an ImportResult object { success: boolean, errors: string[] }
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
    });

    document.querySelector('#cmd-clear-selection')?.addEventListener('click', () => {
        store.clearSelection();
        refreshAll();
    });

    document.querySelector('#cmd-delete-selected')?.addEventListener('click', () => {
        if (store.getSelectedIds().size === 0) return;

        if (confirm("Confirm removing highlighted key steps?")) {
            store.deleteSelected();
            refreshAll();
        }
    });

    document.querySelector('#cmd-reorder')?.addEventListener('click', () => {
        store.autoOrder();
        showToast("Key steps reordered with shorter branches first!", "success");
        refreshAll();
    });

    document.querySelector('#add-couplet-btn')?.addEventListener('click', () => {
        store.addCouplet();
        refreshAll();
    });

    // CONSOLIDATED FORMAT EXPORTER SWITCHBOARD
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
    });
}

/**
 * Desktop Command Shortcut Interceptor Engine.
 * Manages macro routing systems without breaking native form field manipulation.
 */
export function setupKeyboardShortcuts(store: KeyStore, refreshAll: () => void) {
    window.addEventListener('keydown', (evt: KeyboardEvent) => {
        const e = evt;
        // Cross-platform modifier detection (Command key on macOS, Control on Windows/Linux)
        const isMac = isMacUser();
        const hasModifier = isMac ? e.metaKey : e.ctrlKey;

        // Determine context state
        const activeElement = document.activeElement;
        const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.hasAttribute('contenteditable')
        );

        // ==========================================
        // DUAL-CONTEXT CRITICAL COMMANDS (Always intercept)
        // ==========================================
        if (hasModifier && e.key.toLowerCase() === 's') {
            e.preventDefault();
            document.querySelector<HTMLButtonElement>('#cmd-save')?.click();
            return;
        }

        // ==========================================
        // CANVAS CONTEXT COMMANDS (Only if NOT typing)
        // ==========================================
        if (!isTyping) {

            // Ctrl + A: Select All Cards
            if (hasModifier && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                store.selectAll();
                refreshAll();
                return;
            }

            // Ctrl + Z / Ctrl + Shift + Z: Undo & Redo Matrix
            if (hasModifier && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    if (store.redo()) refreshAll();
                } else {
                    if (store.undo()) refreshAll();
                }
                return;
            }

            // Ctrl + Y: Secondary Redo Routing (Windows Standard)
            if (hasModifier && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                if (store.redo()) refreshAll();
                return;
            }

            // Delete / Backspace: Remove Selected Card Blocks
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (store.getSelectedIds().size > 0) {
                    e.preventDefault();
                    document.querySelector<HTMLButtonElement>('#cmd-delete-selected')?.click();
                }
                return;
            }

            // Escape: Drop Active Selection Arrays
            if (e.key === 'Escape') {
                e.preventDefault();
                store.clearSelection();
                refreshAll();
                return;
            }

            // Ctrl + C / Cmd + C: Copy Selected Cards
            if (hasModifier && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                if (store.getSelectedIds().size > 0) {
                    store.copySelectedCards();
                    // We can utilize your existing Toast notification system!
                    showToast(`Copied ${store.getSelectedIds().size} step(s) to clipboard.`, 'success');
                }
                return;
            }

            // Ctrl + V / Cmd + V: Paste Cards
            if (hasModifier && e.key.toLowerCase() === 'v') {
                e.preventDefault();

                // Determine insertion context: paste below the last selected card, 
                // or safely default to the end of the list if nothing is selected.
                const selectedArray = Array.from(store.getSelectedIds());
                const targetId = selectedArray.length > 0 ? selectedArray[selectedArray.length - 1] : undefined;

                if (store.pasteCards(targetId, 'below')) {
                    showToast("Pasted steps from clipboard.", "success");
                    refreshAll();
                }
                return;
            }
        }
    });
}