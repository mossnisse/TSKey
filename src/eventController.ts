// eventController.ts
import type { KeyStore, Couplet } from './store.ts';
import type { UIStateStore } from './uiState.ts';
import { showToast, renderProjectHubList } from './uiRenderer.ts';
import { IS_MAC, resolveDestination, parseDestinationInput, buildIdToIndexMap } from './utils.ts';
import { workspaceStorage, activeObjectURLs } from './db.ts';
import { exportKeyToHTML } from './exporters/htmlExporter.ts';
import { exportKeyToLaTeX } from './exporters/latexExporter.ts';
import { exportKeyToPlainText } from './exporters/plainTextExporter.ts';
import { exportKeyToJSON } from './exporters/jsonExporter.ts';
import { setupPlainTextImporter, openPlainTextImportDialog } from './importers/plainTextImporter.ts';

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
        
        refreshScheduled = false;
        refreshFn();
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

    // Wire the plain-text import dialog (markup lives in initializeShell).
    setupPlainTextImporter(store, uiState, refreshAll, signal);

    // Helper to refresh and populate rows inside the workspace project selector hub
    async function refreshHubView() {
        const currentTitle = store.getProjectName();
        const projects = await workspaceStorage.getProjectList();
        renderProjectHubList(projects, currentTitle);
    }

    const titleInput = document.getElementById('key-title-input') as HTMLInputElement | null;
    if (titleInput) {
        titleInput.addEventListener('blur', () => {
            store.endTypingSession();

            const newTitle = titleInput.value.trim();
            if (!newTitle) {
                titleInput.value = store.getProjectName();
                return;
            }

            store.setTitle(newTitle);
            batchedRefresh(refreshAll);
        }, { signal });
    }

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
        type CoupletStringField = 'alt1' | 'alt2';

        if (field === 'dest1' || field === 'dest2') {
            const branchField = field === 'dest1' ? 'branch1' : 'branch2';

            // We parse using the current snapshot of the key array
            updatePayload[branchField] = parseDestinationInput(currentValue, store.getKey());
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

        // --- FIGURE DRAG AND DROP ENGINE ---
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
            card.classList.remove('is-hovered', 'is-active');
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
    const modalProjectHub = document.getElementById('modal-open-project') as HTMLElement;

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

    document.getElementById('cmd-open-dialog')?.addEventListener('click', async () => {
        if (modalProjectHub) {
            modalProjectHub.style.display = 'flex';
            await refreshHubView();
        }
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
    document.getElementById('modal-project-close')?.addEventListener('click', () => {
        if (modalProjectHub) modalProjectHub.style.display = 'none';
    }, { signal });

    // --- PROJECT WORKSPACE HUB ROW ACTIONS ---
    document.getElementById('project-hub-list')?.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const clickableZone = target.closest('.hub-item-clickable-zone') as HTMLElement | null;
        const deleteBtn = target.closest('.btn-hub-delete') as HTMLElement | null;

        // PATHWAY A: LOAD WORKSPACE
        if (clickableZone) {
            const projectName = clickableZone.getAttribute('data-name');
            if (!projectName) return;

            if (store.hasUnsavedChanges()) {
                if (!confirm("Your current key has unsaved tracking changes. Are you sure you want to discard them to switch workspaces?")) {
                    return;
                }
            }

            try {
                // Project-switch teardown (revoke object-URLs + drop staged uploads)
                // is handled inside store.loadProject → workspaceStorage.loadProject.
                await store.loadProject(projectName);

                if (modalProjectHub) modalProjectHub.style.display = 'none';
                showToast(`📂 Swapped to workspace: "${projectName}"`, "success");
                batchedRefresh(refreshAll);
            } catch (error) {
                console.error("Failed to load workspace safely:", error);
                showToast("⚠️ Could not open selected project database entries.", "error");
            }
            return;
        }

        // PATHWAY B: DELETE WORKSPACE
        if (deleteBtn) {
            e.stopPropagation();
            const projectName = deleteBtn.getAttribute('data-name');
            if (!projectName) return;

            const confirmMsg = `Are you sure you want to permanently delete the workspace "${projectName}"?\nThis wipes it from your browser database.`;
            if (confirm(confirmMsg)) {
                try {
                    await workspaceStorage.deleteProject(projectName);
                    showToast(`🗑️ Workspace "${projectName}" deleted.`, "success");

                    const currentOpenName = store.getProjectName();

                    if (currentOpenName === projectName) {
                        // createNewProject resets the image cache internally.
                        await store.createNewProject('Untitled Key');
                        await store.saveToStorage(); // Persist baseline
                    }

                    await refreshHubView();
                    batchedRefresh(refreshAll);
                } catch (error) {
                    console.error("Failed to execute database deletion sequence:", error);
                    showToast("⚠️ Failed to delete workspace from database.", "error");
                }
            }
        }
    }, { signal });

    document.getElementById('btn-hub-import')?.addEventListener('click', () => {
        const hiddenInput = document.querySelector('#file-import-hidden') as HTMLInputElement;
        hiddenInput?.click();
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

    // Moved before dragover so the reference is declared before the closure that uses it.
    const updateTargetTrackers = (clientY: number, cardEl: HTMLElement) => {
        const actualCard = cardEl.closest('.key-card') as HTMLElement;

        if (!actualCard) {
            clearDropMarkers();
            return;
        }

        const currentScrollY = keyContainer.scrollTop;

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

    keyContainer.addEventListener('dragend', (e) => {
        const target = e.target as HTMLElement;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        card.style.opacity = '1';
        store.stopDraggingCouplet();
        clearDropMarkers();
    }, { signal });

    keyContainer.addEventListener('dragover', (e: DragEvent) => {
        if (store.draggedCoupletId === null) return;
        e.preventDefault();

        const containerRect = keyContainer.getBoundingClientRect();

        if (e.clientY - containerRect.top < AUTO_SCROLL_THRESHOLD_PX) {
            keyContainer.scrollBy(0, -AUTO_SCROLL_SPEED_PX);
        } else if (containerRect.bottom - e.clientY < AUTO_SCROLL_THRESHOLD_PX) {
            keyContainer.scrollBy(0, AUTO_SCROLL_SPEED_PX);
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

    // --- NEW TRADITIONAL WORKFLOW FILE ACTIONS ---
    document.querySelector('#cmd-new')?.addEventListener('click', async () => {
        if (store.hasUnsavedChanges()) {
            if (!confirm("You have unsaved workspace changes. Discard and make a brand new project memory space?")) {
                return;
            }
        }

        const titleInput = prompt("Enter name/title for the new key:", "Untitled Key");
        if (titleInput === null) return; // User cancelled prompt

        const chosenTitle = titleInput.trim() || "Untitled Key";

        try {
            const projectList = await workspaceStorage.getProjectList();
            const exists = projectList.some(p => p.name.toLowerCase() === chosenTitle.toLowerCase());
            if (exists) {
                const confirmOverwrite = confirm(`A project named "${chosenTitle}" already exists. Do you want to wipe it out and start fresh?`);
                if (!confirmOverwrite) return;
            }

            // createNewProject resets the image cache internally.
            await store.createNewProject(chosenTitle);
            await store.saveToStorage();

            showToast(`📄 New workspace "${chosenTitle}" initiated!`, "success");
            batchedRefresh(refreshAll);
        } catch (error) {
            console.error("Failed to initialize a new project workspace safely: ", error);
            showToast("⚠️ Could not initialize database workspace entries.", "error");
        }
    }, { signal });

    document.querySelector('#cmd-save-as')?.addEventListener('click', async () => {
        const originalTitle = store.getProjectName();
        const titleInput = prompt("Save current configuration under a new title:", originalTitle);
        if (titleInput === null) return;

        const chosenTitle = titleInput.trim();
        if (!chosenTitle) {
            showToast("⚠️ Invalid project title.", "error");
            return;
        }

        try {
            const projectList = await workspaceStorage.getProjectList();
            const exists = projectList.some(p => p.name.toLowerCase() === chosenTitle.toLowerCase());
            if (exists) {
                const confirmOverwrite = confirm(`A project named "${chosenTitle}" already exists. Do you want to overwrite it?`);
                if (!confirmOverwrite) return;
            }

            // Use the new explicit Save As method
            await store.saveAsProject(chosenTitle);

            showToast(`💾 Saved workspace as "${chosenTitle}"`, "success");
            batchedRefresh(refreshAll);
        } catch (error) {
            showToast("⚠️ Save As operation failed.", "error");
        }
    }, { signal });

    document.querySelector('#cmd-save')?.addEventListener('click', async () => {
        const oldTitle = store.getPersistedTitle();
        const newTitle = store.getProjectName(); // Extracted from memory state

        try {
            // SCENARIO A: The user renamed the project in the UI input before clicking save
            if (oldTitle && oldTitle !== newTitle) {
                const projectList = await workspaceStorage.getProjectList();
                const exists = projectList.some(p => p.name.toLowerCase() === newTitle.toLowerCase());
                if (exists) {
                    const overwrite = confirm(`A project named "${newTitle}" already exists. Overwrite it?`);
                    if (!overwrite) return;
                }
            }

            await store.saveToStorage();

            if (oldTitle && oldTitle !== newTitle) {
                showToast(`💾 Renamed and saved workspace as "${newTitle}"`, "success");
            } else {
                showToast("💾 Changes saved successfully!", "success");
            }

            batchedRefresh(refreshAll);
        } catch (error) {
            console.error("Atomic save/rename failed:", error);

            // Controller Rollback: If store.saveToStorage failed during a rename operation, 
            // make sure the store is reverted back to its true persisted title name.
            if (oldTitle && oldTitle !== newTitle) {
                store.setProjectName(oldTitle);
            }

            showToast("⚠️ Save failed. Your changes were kept in memory.", "error");
        }
    }, { signal });

    document.querySelector('#cmd-export-json')?.addEventListener('click', () => {
        exportKeyToJSON(store);
    }, { signal });

    const hiddenInput = document.querySelector('#file-import-hidden') as HTMLInputElement;

    let isImporting = false;

    hiddenInput?.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        // Keep track of original title in case we need to roll back on an error
        const originalTitle = store.getPersistedTitle();

        try {
            isImporting = true;

            const fileText = await file.text();
            const rawData = JSON.parse(fileText);

            let targetName = 'Untitled Imported Key';
            if (rawData && typeof rawData.title === 'string' && rawData.title.trim()) {
                targetName = rawData.title.trim();
            } else if (file.name) {
                targetName = file.name.replace(/\.tskey$/i, '').trim();
            }

            const projectList = await workspaceStorage.getProjectList();
            const exists = projectList.some(p => p.name.toLowerCase() === targetName.toLowerCase());
            if (exists) {
                const overwrite = confirm(`A local project named "${targetName}" already exists. Do you want to completely overwrite it with this import file?`);
                if (!overwrite) {
                    if (hiddenInput) hiddenInput.value = '';
                    return;
                }
            }

            const importResult = store.importJsonData(rawData);
            if (!importResult.success) {
                alert(`Failed to import JSON schema:\n• ${importResult.errors.join('\n• ')}`);
                if (hiddenInput) hiddenInput.value = '';
                return;
            }

            // store.importJsonData already reset the image cache; stage the import's
            // own figure binaries below.
            store.setProjectName(targetName);

            const failedFigureIds: number[] = [];
            if (importResult.importedFigures && importResult.importedFigures.length > 0) {
                for (const fig of importResult.importedFigures) {
                    if (fig.binaryData) {
                        try {
                            const response = await fetch(fig.binaryData);
                            const blob = await response.blob();

                            workspaceStorage.uploadFigureBinary(fig.id, blob);

                            const oldUrl = activeObjectURLs.get(fig.id);
                            if (oldUrl) URL.revokeObjectURL(oldUrl);

                            const freshUrl = URL.createObjectURL(blob);
                            activeObjectURLs.set(fig.id, freshUrl);
                        } catch (err) {
                            console.error(`Failed to parse binary data for figure ${fig.id}:`, err);
                            failedFigureIds.push(fig.id);
                        }
                    }
                }
            }

            await store.saveToStorage();

            if (failedFigureIds.length === 0) {
                showToast(`📥 Imported workspace "${targetName}" successfully!`, "success");
            } else {
                showToast(`⚠️ Workspace imported, but ${failedFigureIds.length} image(s) failed.`, "error");
                alert(
                    `Workspace "${targetName}" was loaded, but the following figure IDs encountered binary errors or corruption and could not be recovered:\n\n` +
                    `• Figure ID(s): ${failedFigureIds.join(', ')}\n\n` +
                    `Please try re-uploading these specific images in the editor.`
                );
            }

            if (modalProjectHub && modalProjectHub.style.display === 'flex') {
                if (typeof refreshHubView === 'function') {
                    await refreshHubView();
                }
            }

            batchedRefresh(refreshAll);
        } catch (err) {
            console.error("Import processing error:", err);

            // ROLLBACK: Revert the title state if mutation halfway broke down
            if (originalTitle) {
                store.setProjectName(originalTitle);
            }
            workspaceStorage.clearStagedChanges();

            alert("Malformed JSON structure: Unable to parse file stream.");
        } finally {
            isImporting = false;
            if (hiddenInput) hiddenInput.value = '';
        }
    }, { signal });

    document.querySelector('#cmd-trigger-import')?.addEventListener('click', () => {
        if (isImporting) {
            showToast("⚠️ An import is currently in progress. Please wait.", "error");
            return;
        }
        hiddenInput?.click();
    }, { signal });

    document.querySelector('#cmd-import-text')?.addEventListener('click', () => {
        if (isImporting) {
            showToast("⚠️ An import is currently in progress. Please wait.", "error");
            return;
        }
        openPlainTextImportDialog();
    }, { signal });

    document.querySelector('#cmd-export-text')?.addEventListener('click', () => exportKeyToPlainText(store), { signal });
    document.querySelector('#cmd-export-html')?.addEventListener('click', () => exportKeyToHTML(store), { signal });
    document.querySelector('#cmd-export-latex')?.addEventListener('click', () => exportKeyToLaTeX(store), { signal });

    // --- EDIT MENU ACTION BINDINGS ---
    document.querySelector('#cmd-undo')?.addEventListener('click', () => {
        uiState.typing.couplets.clearTimer();
        uiState.typing.figures.clearTimer();
        if (store.undo()) batchedRefresh(refreshAll);
    }, { signal });

    document.querySelector('#cmd-redo')?.addEventListener('click', () => {
        uiState.typing.couplets.clearTimer();
        uiState.typing.figures.clearTimer();
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
                const figIdsToDelete = new Set(store.getSelectedFigureIds());
                store.deleteSelectedFigures();
                figIdsToDelete.forEach(id => {
                    // Stage the deletion
                    workspaceStorage.deleteFigureBinary(id);

                    const url = activeObjectURLs.get(id);
                    if (url) URL.revokeObjectURL(url);
                    activeObjectURLs.delete(id);
                });
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

    document.querySelector('#cmd-toggle-images')?.addEventListener('click', () => {
        uiState.toggleImages();
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
                case 'ArrowRight': {
                    e.preventDefault();
                    if (triggers.length === 0) return;
                    const nextTrigger = triggers[(triggerIndex + 1) % triggers.length];
                    const wasExpandedRight = currentTrigger?.getAttribute('aria-expanded') === 'true';
                    closeAllMenus();
                    nextTrigger.focus();
                    if (wasExpandedRight) {
                        nextTrigger.setAttribute('aria-expanded', 'true');
                    }
                    break;
                }
                case 'ArrowLeft': {
                    e.preventDefault();
                    if (triggers.length === 0) return;
                    const prevTrigger = triggers[(triggerIndex - 1 + triggers.length) % triggers.length];
                    const wasExpandedLeft = currentTrigger?.getAttribute('aria-expanded') === 'true';
                    closeAllMenus();
                    prevTrigger.focus();
                    if (wasExpandedLeft) {
                        prevTrigger.setAttribute('aria-expanded', 'true');
                    }
                    break;
                }
                case 'ArrowDown': {
                    e.preventDefault();
                    if (isTrigger && currentTrigger) {
                        currentTrigger.setAttribute('aria-expanded', 'true');
                        if (actions.length > 0) actions[0].focus();
                    } else if (isAction && actions.length > 0) {
                        const nextAction = actions[(actionIndex + 1) % actions.length];
                        nextAction.focus();
                    }
                    break;
                }
                case 'ArrowUp': {
                    e.preventDefault();
                    if (isAction && actions.length > 0) {
                        const prevAction = actions[(actionIndex - 1 + actions.length) % actions.length];
                        prevAction.focus();
                    }
                    break;
                }
                case 'Escape': {
                    e.preventDefault();
                    closeAllMenus();
                    currentTrigger?.focus();
                    break;
                }
                case 'Enter':
                case ' ': {
                    if (isTrigger && currentTrigger) {
                        e.preventDefault();
                        const isExpanded = currentTrigger.getAttribute('aria-expanded') === 'true';
                        currentTrigger.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
                        if (!isExpanded && actions.length > 0) {
                            setTimeout(() => actions[0].focus(), 10);
                        }
                    }
                    break;
                }
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
        const modals = document.querySelectorAll('.modal-overlay');
        const activeModal = Array.from(modals).find(
            el => (el as HTMLElement).style.display === 'flex'
        ) as HTMLElement | null;

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

        // Global lifecycle overrides (Available even when focus sits inside active text fields)
        if (hasModifier && e.key.toLowerCase() === 's') {
            e.preventDefault();
            if (e.shiftKey) {
                document.querySelector<HTMLButtonElement>('#cmd-save-as')?.click();
            } else {
                document.querySelector<HTMLButtonElement>('#cmd-save')?.click();
            }
            return;
        }

        if (hasModifier && e.key.toLowerCase() === 'o') {
            e.preventDefault();
            document.querySelector<HTMLButtonElement>('#cmd-open-dialog')?.click();
            return;
        }

        if (hasModifier && e.altKey && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            document.querySelector<HTMLButtonElement>('#cmd-new')?.click();
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