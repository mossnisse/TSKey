// eventController.ts
import type { KeyStore } from './store.ts';
import { renderPrintView, showToast } from './uiRenderer.ts';
import { getStepNumberById } from './utils.ts';
import { exportKeyToHTML } from './htmlExporter.ts';
import { exportKeyToLaTeX } from './latexExporter.ts';


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
    const container = document.querySelector('#editor-container');
    if (!container) return;

    let typingSessionActive = false;

    // Centralized Multi-Selection Router Click
    container.addEventListener('click', (evt: Event) => {
        const e = evt as MouseEvent;
        const target = e.target as HTMLElement;
        if (target.closest('input, textarea, button, select')) return;

        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));
        const isMulti = e.ctrlKey || e.metaKey;

        store.toggleSelection(id, isMulti);
        refreshAll();
    });

    // Centralized Input Streaming Optimization Router
    container.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        if (!target.classList.contains('input-sync')) return;

        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));
        const field = target.getAttribute('data-field')!;
        const key = store.getKey();

        store.setActiveCard(id);

        if (!typingSessionActive) {
            store.commitHistoryCheckpoint();
            typingSessionActive = true;
        }

        /*
        let value: any = target.value;
        if (field === 'link1' || field === 'link2') {
            const stepNum = parseLinkInput(value, key.length);
            value = stepNum > 0 ? key[stepNum - 1].id : 0;
        }*/

        let value: any = target.value;
        if (field === 'link1' || field === 'link2') {
            const num = parseInt(value) || 0;

            // Check if the user typed an explicit out-of-bounds number
            if (value !== '' && (num <= 0 || num > key.length)) {
                target.classList.add('input-error'); // Flag visual error
                value = 0; // Fallback back-end state safely to 0
            } else {
                target.classList.remove('input-error');
                const stepNum = parseLinkInput(value, key.length);
                value = stepNum > 0 ? key[stepNum - 1].id : 0;
            }
        }

        store.updateCouplet(id, { [field]: value });
        renderPrintView(store); // Fast, single-column incremental updates on input events
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
    container.addEventListener('focusout', (e) => {
        const target = e.target as HTMLElement;
        if (target.matches('input, textarea')) {
            const card = target.closest('.key-card') as HTMLElement;
            if (card) card.draggable = true;

            typingSessionActive = false;

            // 💡 Catch invalid link entry right before refreshAll() clears it
            if (target.classList.contains('input-error') && target instanceof HTMLInputElement) {
                const invalidVal = target.value;
                showToast(`⚠️ Step "${invalidVal}" does not exist yet. Link reset to unassigned.`, "error");
                target.classList.remove('input-error');
            }

            setTimeout(() => {
                if (card && !card.contains(document.activeElement)) {
                    store.clearActiveCard();
                    refreshAll();
                }
            }, 0);
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
    });

    container.addEventListener('dragover', (e) => e.preventDefault());

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
        const blob = new Blob([JSON.stringify(store.getKey(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", url);
        dlAnchor.setAttribute("download", "dichotomous_key_export.json");
        dlAnchor.click();
        URL.revokeObjectURL(url);
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
            const importResult = store.importJsonData(rawData);

            if (!importResult.success) {
                alert(`Failed to import JSON schema:\n• ${importResult.errors.join('\\n• ')}`);
                return;
            }
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
        if (store.getSelectedIds().length === 0) return;
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
            const key = store.getKey();
            let textContent = '';

            key.forEach((c, index) => {
                const currentDisplayNum = index + 1;

                const step1Dest = getStepNumberById(key, c.link1);
                const step2Dest = getStepNumberById(key, c.link2);

                const end1 = c.taxa1 ? c.taxa1 : (c.link1 ? step1Dest : '...');
                const end2 = c.taxa2 ? c.taxa2 : (c.link2 ? step2Dest : '...');

                const alt1Text = c.alt1 || '___';
                const alt2Text = c.alt2 || '___';

                textContent += `${currentDisplayNum}.\t${alt1Text}\t${end1}\n`;
                textContent += `—\t${alt2Text}\t${end2}\n\n`;
            });

            const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const dlAnchor = document.createElement('a');

            dlAnchor.setAttribute("href", url);
            dlAnchor.setAttribute("download", "dichotomous_key_render.txt");
            dlAnchor.click();

            URL.revokeObjectURL(url);
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
        const isMac = (navigator as any).userAgentData?.platform === 'macOS';
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
                if (store.getSelectedIds().length > 0) {
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
        }
    });
}