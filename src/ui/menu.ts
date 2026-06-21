// ui/menu.ts
// Keeps the menu bar in sync with live state: enables/disables commands, updates
// toggle labels and the unsaved indicator, and mirrors the document/title fields.
import type { KeyStore } from '../store.ts';
import { APP_NAME } from '../store.ts';
import type { UIStateStore } from '../uiState.ts';
import { syncField } from './shared.ts';

/**
 * Synchronizes real-time application context for the Menu, disable/enables them.
 */
export function renderMenu(store: KeyStore, uiState: UIStateStore) {
    const menuBar = document.querySelector('.app-menu-bar');
    if (!menuBar) return;

    const getBtn = (id: string) => document.getElementById(id) as HTMLButtonElement | null;

    const selectedCoupletCount = store.getSelectedCoupletIds().size;
    const selectedFigureCount = store.getSelectedFigureIds().size;
    const hasSelection = selectedCoupletCount > 0 || selectedFigureCount > 0;
    const hasCoupletSelection = selectedCoupletCount > 0;
    const hasKeyElements = store.getKey().length > 0;
    const hasClipboard = store.hasClipboardData();

    // Contextual Sync for current key title & modification indicators
    const currentTitle = store.getProjectName();
    const isUnsaved = store.hasUnsavedChanges();
    const formattedTitleText = `${currentTitle}${isUnsaved ? ' *' : ''}`;

    document.title = `${formattedTitleText} - ${APP_NAME}`;
    const headerTitleEl = document.getElementById('active-project-title');
    if (headerTitleEl && headerTitleEl.textContent !== formattedTitleText) {
        headerTitleEl.textContent = formattedTitleText;
    }

    // File Submenu Action items
    const saveBtn = getBtn('cmd-save');
    const expJsonBtn = getBtn('cmd-export-json');
    const expTextBtn = getBtn('cmd-export-text');
    const expHtmlBtn = getBtn('cmd-export-html');
    const expLatexBtn = getBtn('cmd-export-latex');

    // Edit Submenu Action items
    const undoBtn = getBtn('cmd-undo');
    const redoBtn = getBtn('cmd-redo');
    const cutBtn = getBtn('cmd-cut');
    const copyBtn = getBtn('cmd-copy');
    const pasteBtnBelow = getBtn('cmd-paste-below');
    const pasteBtnAbove = getBtn('cmd-paste-above');
    const deleteBtn = getBtn('cmd-delete');
    const swapBtn = getBtn('cmd-swap');
    const clearBtn = getBtn('cmd-clear');

    // Tools Submenu Action items
    const reorderBtn = getBtn('cmd-reorder-couplets');
    const reorderFiguresBtn = getBtn('cmd-reorder-figures');

    if (saveBtn) {
        saveBtn.classList.toggle('has-unsaved-changes', isUnsaved);
    }

    if (expJsonBtn) expJsonBtn.disabled = !hasKeyElements;
    if (expTextBtn) expTextBtn.disabled = !hasKeyElements;
    if (expHtmlBtn) expHtmlBtn.disabled = !hasKeyElements;
    if (expLatexBtn) expLatexBtn.disabled = !hasKeyElements;

    if (undoBtn) undoBtn.disabled = !store.canUndo;
    if (redoBtn) redoBtn.disabled = !store.canRedo;

    if (cutBtn) cutBtn.disabled = !hasCoupletSelection;
    if (copyBtn) copyBtn.disabled = !hasCoupletSelection;
    if (deleteBtn) deleteBtn.disabled = !hasSelection;
    if (swapBtn) swapBtn.disabled = !hasCoupletSelection;
    if (clearBtn) clearBtn.disabled = !hasSelection;

    if (pasteBtnBelow) pasteBtnBelow.disabled = !hasClipboard;
    if (pasteBtnAbove) pasteBtnAbove.disabled = !hasClipboard;

    if (reorderBtn) reorderBtn.disabled = !hasKeyElements;
    // Ordering figures needs both a key to scan and figures to order (see autoOrderFigures).
    if (reorderFiguresBtn) reorderFiguresBtn.disabled = !hasKeyElements || store.getFigures().length === 0;

    // View submenus
    const toggleFiguresBtn = getBtn('cmd-toggle-figures');
    const toggleImagesBtn = getBtn('cmd-toggle-images');
    const togglePrintBtn = getBtn('cmd-toggle-print');

    if (toggleFiguresBtn) {
        const label = toggleFiguresBtn.querySelector('span');
        if (label) {
            label.textContent = uiState.isFiguresHidden ? '🖼️ Show Figures Panel' : '🖼️ Hide Figures Panel';
        }
    }

    if (toggleImagesBtn) {
        const label = toggleImagesBtn.querySelector('span');
        if (label) {
            label.textContent = uiState.isImagesHidden ? '🖼️ Show Images in Figures Panel' : '🖼️ Hide Images in Figures Panel';
        }
    }

    if (togglePrintBtn) {
        const label = togglePrintBtn.querySelector('span');
        if (label) {
            label.textContent = uiState.isPrintHidden ? '🖨️ Show Print Preview' : '🖨️ Hide Print Preview';
        }
    }

    // Keep the menu-bar title input in sync with the store (without stealing focus).
    const appShell = document.querySelector('.app-shell') as HTMLElement;
    if (appShell) {
        syncField(appShell, '#key-title-input', store.getTitle());
    }
}