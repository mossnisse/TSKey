// eventController.ts
// Thin orchestrator: wires the event modules in events/ behind a single
// AbortController so the whole app's listeners tear down together. Each module owns
// one area (couplets, figures, dialogs, menus, navigation). The keyboard-shortcut
// setup is re-exported so main.ts keeps importing both from here.
import type { KeyStore } from './store';
import type { UIStateStore } from './uiState.ts';
import { setupPlainTextImporter } from './importers/plainTextImporter.ts';
import {
    setupTitleEditing,
    setupCoupletSelection,
    setupCoupletInput,
    setupCoupletFocus,
    setupCoupletDragAndDrop,
} from './events/coupletEvents.ts';
import { setupFigurePanel, setupFigureReference } from './events/figureEvents.ts';
import { setupTaxaPanel } from './events/taxaEvents.ts';
import { setupDialogs } from './events/dialogs.ts';
import { setupFileMenu, setupEditMenu, setupMenuBarNavigation } from './events/menuEvents.ts';
import { setupNavigationClicks, setupContextMenu } from './events/navigationEvents.ts';

export { setupKeyboardShortcuts } from './events/keyboardShortcuts.ts';

export function setupGlobalListeners(store: KeyStore, uiState: UIStateStore, refreshAll: () => void) {
    const keyContainer = document.querySelector('#editor-container') as HTMLElement;
    if (!keyContainer) return () => { };

    const controller = new AbortController();
    const { signal } = controller;

    setupPlainTextImporter(store, uiState, refreshAll, signal);
    setupTitleEditing(store, refreshAll, signal);
    setupCoupletSelection(keyContainer, store, refreshAll, signal);
    setupCoupletInput(keyContainer, store, uiState, refreshAll, signal);
    setupCoupletFocus(keyContainer, store, uiState, refreshAll, signal);
    setupCoupletDragAndDrop(keyContainer, store, refreshAll, signal);
    setupFigurePanel(store, uiState, refreshAll, signal);
    setupTaxaPanel(store, uiState, refreshAll, signal);
    setupDialogs(store, uiState, refreshAll, signal);
    setupFileMenu(store, uiState, refreshAll, signal);
    setupEditMenu(store, uiState, refreshAll, signal);
    setupFigureReference(keyContainer, signal);
    setupNavigationClicks(store, uiState, signal);
    setupContextMenu(store, refreshAll, signal);
    setupMenuBarNavigation(signal);

    return () => {
        controller.abort();
    };
}