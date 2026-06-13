// eventController.ts
import type { KeyStore, Couplet } from './store.ts';
import type { UIStateStore } from './uiState.ts';
import { showToast } from './uiRenderer.ts';
import { IS_MAC, resolveDestination, parseDestinationInput, buildIdToIndexMap } from './utils.ts';
import { exportKeyToHTML } from './exporters/htmlExporter.ts';
import { exportKeyToLaTeX } from './exporters/latexExporter.ts';
import { exportKeyToPlainText } from './exporters/plainTextExporter.ts';
import { exportKeyToJSON } from './exporters/jsonExporter.ts';

const DEBOUNCE_TYPING_MS = 800;
const AUTO_SCROLL_THRESHOLD_PX = 80;
const AUTO_SCROLL_SPEED_PX = 15;

let refreshScheduled = false;

/**
 * Makes so it's never more than one refresh per frame.
 */
function batchedRefresh(refreshFn: () => void) {
    if (refreshScheduled) return;
    refreshScheduled = true;

    requestAnimationFrame(() => {
        refreshFn();
        refreshScheduled = false;
    });
}

export function setupGlobalListeners(store: KeyStore, uiState: UIStateStore, refreshAll: () => void) {
    const keyContainer = document.querySelector('#editor-container') as HTMLElement;
    if (!keyContainer) return () => { };

    let activeDropCard: HTMLElement | null = null;
    let activeDropClass: 'drag-drop-above' | 'drag-drop-below' | null = null;
    let activeDropRect: DOMRect | null = null;        // Cached bounding metrics to prevent layout thrashing
    let cachedScrollY = 0;

    const controller = new AbortController();
    const { signal } = controller;

    keyContainer.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;

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

    const addFigureBtn = document.getElementById('add-figure-btn');
    if (addFigureBtn) {
        addFigureBtn.addEventListener('click', () => {
            store.addFigure("", "");
            batchedRefresh(refreshAll);
        }, { signal });
    }

    // CONSOLIDATED INPUT ROUTER (Handles Undo Debouncing + Link Validation)
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
        let updatePayload: Partial<Omit<Couplet, 'id'>> = {};
        const currentValue = target.value;

        if (field === 'dest1' || field === 'dest2') {
            const linkField = field === 'dest1' ? 'link1' : 'link2';
            const taxaField = field === 'dest1' ? 'taxa1' : 'taxa2';

            // We parse using the current snapshot of the key array
            const parsed = parseDestinationInput(currentValue, store.getKey());
            updatePayload[linkField] = parsed.link;
            updatePayload[taxaField] = parsed.taxa;
        } else {
            updatePayload[field as keyof Omit<Couplet, 'id'>] = currentValue as never;
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
                    const link = field === 'dest1' ? currentCouplet.link1 : currentCouplet.link2;
                    const taxa = field === 'dest1' ? currentCouplet.taxa1 : currentCouplet.taxa2;

                    const idToIndexMap = buildIdToIndexMap(updatedKey);
                    const resolution = resolveDestination(link, taxa, idToIndexMap);

                    target.classList.toggle('input-error', resolution.isUnresolved);
                }
            }

            batchedRefresh(refreshAll);
        });
    }, { signal });

    // --- Figures bindings ---
    const figureContainer = document.getElementById('figure-container');

    if (figureContainer) {
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
                        destination.closest('#add-figure-btn') ||
                        destination.closest('#control-panel-modal')
                    );

                    // Force an immediate structural refresh unless clicking an active app controller
                    if (!isClickingControl) {
                        batchedRefresh(refreshAll);
                    }
                });
            }
        }, { signal });
    }

    // Centralized Drag and Form Text Highlight Mitigation
    keyContainer.addEventListener('focusin', (e) => {
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
                    showToast(`⚠️ Destination "${invalidVal}" is unresolved. Saved as text context.`, "error");
                }

                // Evaluate next target context defensively (ensuring target is an Element node)
                const destination = e.relatedTarget as HTMLElement | null;
                const isClickingControl = destination instanceof Element && (
                    destination.closest('.key-card') ||
                    destination.closest('.app-menu-bar') ||
                    destination.closest('#add-couplet-btn') || 
                    destination.closest('#control-panel-modal')
                );

                if (!isClickingControl) {
                    batchedRefresh(refreshAll);
                }
            });
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
    keyContainer.addEventListener('dragstart', (e) => {
        const target = e.target as HTMLElement;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));
        store.startDraggingCouplet(id);
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
            activeDropRect = null;
        }
    };

    keyContainer.addEventListener('dragend', (e) => {
        const target = e.target as HTMLElement;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        card.style.opacity = '1';
        store.stopDraggingCouplet();
        clearDropMarkers();
    }, { signal });

    keyContainer.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();

        if (e.clientY < AUTO_SCROLL_THRESHOLD_PX) {
            window.scrollBy(0, -AUTO_SCROLL_SPEED_PX);
        } else if (window.innerHeight - e.clientY < AUTO_SCROLL_THRESHOLD_PX) {
            window.scrollBy(0, AUTO_SCROLL_SPEED_PX);
        }
        updateTargetTrackers(e.clientY, e.target as HTMLElement);
    }, { signal });

    keyContainer.addEventListener('dragleave', (e: DragEvent) => {
        const target = e.relatedTarget as HTMLElement;
        if (!target || !keyContainer.contains(target)) {
            clearDropMarkers();
        }
    }, { signal });

    keyContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;
        const coupletId = Number(card.getAttribute('data-id'));
        if (store.draggedCoupletId === null || store.draggedCoupletId === coupletId) return;

        const position: 'above' | 'below' = card.classList.contains('drag-drop-above') ? 'above' : 'below';

        store.reorderCouplets(store.draggedCoupletId, coupletId, position);
        batchedRefresh(refreshAll);
    }, { signal });

    const updateTargetTrackers = (clientY: number, cardEl: HTMLElement) => {
        const actualCard = cardEl.classList.contains('key-card') ? cardEl : cardEl.closest('.key-card') as HTMLElement;

        if (!actualCard) {
            clearDropMarkers();
            return;
        }

        const currentScrollY = window.scrollY;

        if (activeDropCard !== actualCard || !activeDropRect || cachedScrollY !== currentScrollY) {
            activeDropRect = actualCard.getBoundingClientRect();
            cachedScrollY = currentScrollY;
        }

        const relativeMouseY = clientY - activeDropRect.top;
        const currentClass = relativeMouseY < activeDropRect.height / 2 ? 'drag-drop-above' : 'drag-drop-below';

        if (activeDropCard !== actualCard || activeDropClass !== currentClass) {
            const rectToPreserve = activeDropRect;

            clearDropMarkers();

            actualCard.classList.add(currentClass);
            activeDropCard = actualCard;
            activeDropClass = currentClass;
            activeDropRect = rectToPreserve;
        }
    };

    // --- FILE MENU ACTION BINDINGS ---
    document.querySelector('#cmd-save')?.addEventListener('click', () => {
        try {
            store.saveToStorage();
            showToast("💾 Changes saved to Browser Local Storage!", "success");
            batchedRefresh(refreshAll);
        } catch (error: unknown) {
            console.error("Save Operation Failed: ", error);
            let userMessage = "Failed to save data. An unknown error occurred.";

            if (error instanceof Error) {
                const code = 'code' in error ? (error as { code?: unknown }).code : undefined;

                if (error.name === 'QuotaExceededError' || code === 22) {
                    userMessage = "⚠️ Save Failed: Browser Local Storage is completely full! Please free up space or export your key as a JSON file.";
                } else {
                    userMessage = `⚠️ Save Failed: ${error.message}`;
                }
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
        const selectedCount = store.getSelectedCoupletIds().size;
        if (selectedCount > 0) {
            if (confirm(`Confirm cutting ${selectedCount} highlighted step(s) to clipboard?`)) {
                store.cutSelectedCouplets();
                showToast(`Cut ${selectedCount} step(s) to clipboard.`, 'success');
                batchedRefresh(refreshAll);
            }
        }
    }, { signal });

    document.querySelector('#cmd-copy')?.addEventListener('click', () => {
        const selectedCount = store.getSelectedCoupletIds().size;
        if (selectedCount > 0) {
            store.copySelectedCouplets();
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
        const selectedKeyCount = store.getSelectedCoupletIds().size;
        const selectedFigCount = store.getSelectedFigureIds().size;
        if (selectedKeyCount > 0) {
            if (confirm("Confirm removing highlighted key steps?")) {
                store.deleteSelectedCouplets();
                showToast(`Deleted ${selectedKeyCount} step(s).`, 'success');
                batchedRefresh(refreshAll);
            }
        }
        if (selectedFigCount > 0) {
            if (confirm("Confirm removing highlighted figures?")) {
                store.deleteSelectedFigures();
                showToast(`Deleted ${selectedFigCount} figure(s).`, 'success');
                batchedRefresh(refreshAll);
            }
        }
    }, { signal });

    document.querySelector('#cmd-swap')?.addEventListener('click', () => {
        if (store.getSelectedCoupletIds().size > 0) {
            if (store.swapSelectedCouplets()) {
                showToast("Swapped choice configurations.", "success");
                batchedRefresh(refreshAll);
            }
        }
    }, { signal });

    const triggerAppendAction = () => createNewCoupletWithFocus(store, refreshAll);
    document.querySelector('#cmd-add')?.addEventListener('click', triggerAppendAction, { signal });
    document.querySelector('#add-couplet-btn')?.addEventListener('click', triggerAppendAction, { signal });

    document.querySelector('#cmd-clear')?.addEventListener('click', () => {
        store.clearSelection();
        store.clearFigureSelection();
        batchedRefresh(refreshAll);
    }, { signal });

    document.querySelector('#cmd-select-all')?.addEventListener('click', () => {
        store.selectAll();
        batchedRefresh(refreshAll);
    }, { signal });

    // --- View Menu action bindings ---
    document.querySelector('#cmd-toggle-figures')?.addEventListener('click', () => {
        uiState.toggleFigures();
        batchedRefresh(refreshAll);
    }, { signal });

    document.querySelector('#cmd-toggle-print')?.addEventListener('click', () => {
        uiState.togglePrint();
        batchedRefresh(refreshAll);
    }, { signal });

    // --- TOOLS MENU ACTION BINDINGS ---
    document.querySelector('#cmd-reorder-couplets')?.addEventListener('click', () => {
        store.autoOrderCouplets();
        showToast("Key steps reordered with shorter branches first!", "success");
        batchedRefresh(refreshAll);
    }, { signal });

    document.querySelector('#cmd-reorder-figures')?.addEventListener('click', () => {
        store.autoOrderFigures();
        showToast("Figures reordered to match key reference order!", "success");
        batchedRefresh(refreshAll);
    }, { signal });

    // menu navigation
    const menuBar = document.querySelector('.app-menu-bar') as HTMLElement;
    if (menuBar) {
        const getTriggers = () => Array.from(menuBar.querySelectorAll('.menu-trigger')) as HTMLButtonElement[];

        const getDropdownActions = (trigger: HTMLButtonElement) => {
            const dropdown = trigger.nextElementSibling;
            if (!dropdown) return [];
            return Array.from(dropdown.querySelectorAll('.dropdown-action:not(:disabled)')) as HTMLButtonElement[];
        };

        const closeAllMenus = () => {
            getTriggers().forEach(t => t.setAttribute('aria-expanded', 'false'));
        };

        menuBar.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const trigger = target.closest('.menu-trigger') as HTMLButtonElement | null;

            if (trigger) {
                e.stopPropagation();
                const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
                closeAllMenus();
                trigger.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
            }
        }, { signal });

        document.addEventListener('click', () => closeAllMenus(), { signal });

        menuBar.addEventListener('keydown', (e) => {
            const activeEl = document.activeElement as HTMLButtonElement;
            if (!activeEl) return;

            const isTrigger = activeEl.classList.contains('menu-trigger');
            const isAction = activeEl.classList.contains('dropdown-action');

            if (!isTrigger && !isAction) return;

            const triggers = getTriggers();
            const currentTrigger = isTrigger ? activeEl : (activeEl.closest('.menu-item')?.querySelector('.menu-trigger') as HTMLButtonElement);
            const actions = getDropdownActions(currentTrigger);
            const triggerIndex = triggers.indexOf(currentTrigger);
            const actionIndex = actions.indexOf(activeEl);

            switch (e.key) {
                case 'ArrowRight':
                    e.preventDefault();
                    const nextTrigger = triggers[(triggerIndex + 1) % triggers.length];
                    const wasExpandedRight = currentTrigger.getAttribute('aria-expanded') === 'true';
                    closeAllMenus();
                    nextTrigger.focus();
                    if (wasExpandedRight) {
                        nextTrigger.setAttribute('aria-expanded', 'true');
                    }
                    break;

                case 'ArrowLeft':
                    e.preventDefault();
                    const prevTrigger = triggers[(triggerIndex - 1 + triggers.length) % triggers.length];
                    const wasExpandedLeft = currentTrigger.getAttribute('aria-expanded') === 'true';
                    closeAllMenus();
                    prevTrigger.focus();
                    if (wasExpandedLeft) {
                        prevTrigger.setAttribute('aria-expanded', 'true');
                    }
                    break;

                case 'ArrowDown':
                    e.preventDefault();
                    if (isTrigger) {
                        currentTrigger.setAttribute('aria-expanded', 'true');
                        if (actions.length > 0) actions[0].focus();
                    } else if (isAction && actions.length > 0) {
                        const nextAction = actions[(actionIndex + 1) % actions.length];
                        nextAction.focus();
                    }
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    if (isAction && actions.length > 0) {
                        const prevAction = actions[(actionIndex - 1 + actions.length) % actions.length];
                        prevAction.focus();
                    }
                    break;

                case 'Escape':
                    e.preventDefault();
                    closeAllMenus();
                    currentTrigger.focus();
                    break;

                case 'Enter':
                case ' ':
                    if (isTrigger) {
                        e.preventDefault();
                        const isExpanded = currentTrigger.getAttribute('aria-expanded') === 'true';
                        currentTrigger.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
                        if (!isExpanded && actions.length > 0) {
                            setTimeout(() => actions[0].focus(), 10);
                        }
                    }
                    break;
            }
        }, { signal });
    }

    return () => {
        controller.abort();
    };
}

/**
 * Desktop Command Shortcut Interceptor Engine.
 */
export function setupKeyboardShortcuts(store: KeyStore, refreshAll: () => void) {
    const handleKeyDown = (e: KeyboardEvent) => {
        const activeModal = document.querySelector('.modal-overlay[style*="display: flex"]') as HTMLElement | null;
        if (activeModal) {
            if (e.key === 'Escape') {
                activeModal.style.display = 'none';
                e.preventDefault();
                return;
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                return;
            }
        }
        const hasModifier = IS_MAC ? e.metaKey : e.ctrlKey;
        const activeElement = document.activeElement;
        const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.hasAttribute('contenteditable')
        );

        if (hasModifier && e.key.toLowerCase() === 's') {
            e.preventDefault();
            document.querySelector<HTMLButtonElement>('#cmd-save')?.click();
            return;
        }

        if (!isTyping) {
            if (e.altKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-add')?.click();
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-select-all')?.click();
                return;
            }

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
                const position = e.shiftKey ? 'above' : 'below';
                executePaste(store, refreshAll, position);
                return;
            }

            if (hasModifier && e.shiftKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-toggle-figures')?.click();
                return;
            }

            if (hasModifier && e.shiftKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-toggle-print')?.click();
                return;
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
}

function createNewCoupletWithFocus(store: KeyStore, refreshAll: () => void) {
    const newId = store.addCouplet();
    refreshAll();

    const newCard = document.querySelector(`.key-card[data-id="${newId}"]`);
    const textarea = newCard?.querySelector('textarea[data-field="alt1"]') as HTMLTextAreaElement | null;

    if (textarea) {
        textarea.focus();
    }
}

function executePaste(store: KeyStore, refreshAll: () => void, position: 'above' | 'below') {
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