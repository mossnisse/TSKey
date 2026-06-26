// events/menuEvents.ts
// Menu-bar command bindings: the File menu (new/save/import/export), the Edit/View/
// Tools menu actions, and menu-bar mouse + keyboard navigation.
import type { KeyStore } from '../store.ts';
import type { UIStateStore } from '../uiState.ts';
import { batchedRefresh, refreshHubView } from './shared.ts';
import { executePaste, createNewCoupletWithFocus } from './coupletEvents.ts';
import { showToast } from '../uiRenderer.ts';
import { workspaceStorage, activeObjectURLs } from '../db.ts';
import { exportKeyToHTML } from '../exporters/htmlExporter.ts';
import { exportKeyToLaTeX } from '../exporters/latexExporter.ts';
import { exportKeyToPlainText } from '../exporters/plainTextExporter.ts';
import { exportKeyToJSON } from '../exporters/jsonExporter.ts';
import { openPlainTextImportDialog } from '../importers/plainTextImporter.ts';

/** File menu: new / save / save-as / JSON+text+HTML+LaTeX export / import. */
export function setupFileMenu(store: KeyStore, uiState: UIStateStore, refreshAll: () => void, signal: AbortSignal) {
    const modalProjectHub = document.getElementById('modal-open-project') as HTMLElement;

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

            await store.createNewProject(chosenTitle); // persists the fresh workspace itself

            showToast(`📄 New workspace "${chosenTitle}" initiated!`, "success");
            batchedRefresh(refreshAll);
        } catch (error) {
            console.error("Failed to initialize a new project workspace safely: ", error);
            showToast("⚠️ Could not initialize database workspace entries.", "error");
        }
    }, { signal });

    document.querySelector('#cmd-save-as')?.addEventListener('click', async () => {
        const originalTitle = store.getTitle();
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
        const newTitle = store.getTitle(); // Extracted from memory state

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

            if (oldTitle && oldTitle !== newTitle) {
                store.setTitle(oldTitle);
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

        if (isImporting) {
            showToast("⚠️ An import is currently in progress. Please wait.", "error");
            if (hiddenInput) hiddenInput.value = '';
            return;
        }

        // Importing replaces the open key — guard unsaved work like Load/New do.
        if (store.hasUnsavedChanges()) {
            if (!confirm("You have unsaved changes in the current key. Importing will discard them. Continue?")) {
                if (hiddenInput) hiddenInput.value = '';
                return;
            }
        }

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

            store.setTitle(targetName);

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
                await refreshHubView(store);
            }

            batchedRefresh(refreshAll);
        } catch (err) {
            console.error("Import processing error:", err);

            // ROLLBACK: Revert the title state if mutation halfway broke down
            if (originalTitle) {
                store.setTitle(originalTitle);
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

    document.querySelector('#cmd-export-text')?.addEventListener('click', () => exportKeyToPlainText(store, uiState.leadFormat, uiState.showBackReference), { signal });
    document.querySelector('#cmd-export-html')?.addEventListener('click', () => exportKeyToHTML(store, uiState.leadFormat, uiState.showBackReference), { signal });
    document.querySelector('#cmd-export-latex')?.addEventListener('click', () => exportKeyToLaTeX(store, uiState.leadFormat, uiState.showBackReference), { signal });
}

/** Edit, View, and Tools menu command bindings (undo/redo, clipboard, toggles, auto-order). */
export function setupEditMenu(store: KeyStore, uiState: UIStateStore, refreshAll: () => void, signal: AbortSignal) {
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
}

/** Menu bar mouse toggling and full keyboard navigation (arrows / Enter / Escape). */
export function setupMenuBarNavigation(signal: AbortSignal) {
    const menuBar = document.querySelector('.app-menu-bar') as HTMLElement;
    if (!menuBar) return;

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