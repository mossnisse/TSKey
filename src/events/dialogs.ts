// events/dialogs.ts
// Modal open/close triggers, the Options dialog controls, and the project workspace
// hub row actions (load / delete).
import type { KeyStore } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { batchedRefresh, refreshHubView } from './shared.ts';
import { showToast } from '../uiRenderer.ts';
import { isLeadFormat, isNameDisplayMode } from '../utils.ts';
import { workspaceStorage } from '../store';

/** Modal open/close triggers and the project workspace hub row actions (load / delete). */
export function setupDialogs(store: KeyStore, uiState: UIStateStore, refreshAll: () => void, signal: AbortSignal) {
    const modalShortcuts = document.getElementById('modal-shortcuts') as HTMLElement;
    const modalOptions = document.getElementById('modal-options') as HTMLElement;
    const modalAbout = document.getElementById('modal-about') as HTMLElement;
    const modalProjectHub = document.getElementById('modal-open-project') as HTMLElement;

    // --- OPTIONS: KEY LEADING FORMAT + BACK-REFERENCE + TAXON NAME DISPLAY ---
    const leadFormatGroup = document.getElementById('opt-lead-format');
    const backRefCheckbox = document.getElementById('opt-backref') as HTMLInputElement | null;
    const nameDisplayGroup = document.getElementById('opt-name-display');
    const syncOptionControls = () => {
        leadFormatGroup
            ?.querySelectorAll<HTMLInputElement>('input[name="lead-format"]')
            .forEach(radio => { radio.checked = radio.value === uiState.leadFormat; });
        if (backRefCheckbox) backRefCheckbox.checked = uiState.showBackReference;
        nameDisplayGroup
            ?.querySelectorAll<HTMLInputElement>('input[name="name-display"]')
            .forEach(radio => { radio.checked = radio.value === uiState.nameDisplayMode; });
    };
    leadFormatGroup?.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.name !== 'lead-format' || !isLeadFormat(target.value)) return;
        uiState.setLeadFormat(target.value);
        batchedRefresh(refreshAll);
    }, { signal });
    backRefCheckbox?.addEventListener('change', () => {
        uiState.setShowBackReference(backRefCheckbox.checked);
        batchedRefresh(refreshAll);
    }, { signal });
    nameDisplayGroup?.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.name !== 'name-display' || !isNameDisplayMode(target.value)) return;
        uiState.setNameDisplayMode(target.value);
        batchedRefresh(refreshAll);
    }, { signal });

    // Show a modal and move focus into it for keyboard users (Tab is then trapped
    // inside it by setupKeyboardShortcuts).
    const openModal = (modal: HTMLElement) => {
        modal.style.display = 'flex';
        modal.querySelector<HTMLElement>('button, input:not([disabled]), [tabindex]:not([tabindex="-1"])')?.focus();
    };

    // --- DIALOG MODAL OPEN TRIGGERS ---
    document.getElementById('cmd-open-shortcuts')?.addEventListener('click', () => {
        openModal(modalShortcuts);
    }, { signal });
    document.getElementById('cmd-open-options')?.addEventListener('click', () => {
        syncOptionControls();
        openModal(modalOptions);
    }, { signal });
    document.getElementById('cmd-open-about')?.addEventListener('click', () => {
        openModal(modalAbout);
    }, { signal });

    document.getElementById('cmd-open-dialog')?.addEventListener('click', async () => {
        openModal(modalProjectHub);
        await refreshHubView(store);
    }, { signal });

    // --- DIALOG MODAL CLOSE TRIGGERS ---
    // Close on the × button and on a backdrop click (a click that lands on the
    // overlay itself rather than the modal window inside it).
    const wireModalClose = (modal: HTMLElement, closeBtnId: string) => {
        document.getElementById(closeBtnId)?.addEventListener('click', () => {
            modal.style.display = 'none';
        }, { signal });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        }, { signal });
    };
    wireModalClose(modalShortcuts, 'modal-shortcuts-close');
    wireModalClose(modalOptions, 'modal-options-close');
    wireModalClose(modalAbout, 'modal-about-close');
    wireModalClose(modalProjectHub, 'modal-project-close');

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
                const loaded = await store.loadProject(projectName);
                if (!loaded) {
                    // Stale hub row (e.g. the project was deleted in another tab).
                    showToast(`⚠️ Project "${projectName}" was not found in the browser database.`, "error");
                    await refreshHubView(store);
                    return;
                }

                modalProjectHub.style.display = 'none';
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

                    // Compare against the persisted (on-disk) title, not the mutable
                    // in-memory one: an unsaved rename would otherwise hide that the project
                    // being deleted is the one currently open (deleteProject removes the
                    // record and its shared-uid figure blobs regardless).
                    const currentOpenName = store.getPersistedTitle();

                    if (currentOpenName === projectName) {
                        const remaining = await workspaceStorage.getProjectList();
                        if (remaining.length > 0) {
                            await store.loadProject(remaining[0].name);
                        } else {
                            await store.createNewProject('Untitled Key'); // persists the baseline itself
                        }
                    }

                    await refreshHubView(store);
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
}