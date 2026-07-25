// main.ts

import './style.css';
import './editor/richText/richText.css';
import { KeyStore } from './store';
import type { Couplet, Taxon } from './store';
import { UIStateStore } from './uiState.ts';
import type { ChangeKind } from './changeEmitter.ts';
import { batchedRefresh } from './events/shared.ts';
import { initializeShell, applyPanelVisibility, renderEditorCards, renderPrintView, renderMenu, renderFigures, renderTaxa } from './uiRenderer.ts';
import { setupPlainTextImporter } from './importers/plainTextImporter.ts';
import { setupPdfImporter } from './importers/pdf/pdfImporter.ts';
import {
    setupTitleEditing,
    setupCoupletSelection,
    setupCoupletInput,
    setupCoupletFocus,
    setupCoupletDragAndDrop,
} from './events/coupletEvents.ts';
import { setupDestinationCombobox } from './events/destinationCombobox.ts';
import { setupFigurePanel, setupFigureReference } from './events/figureEvents.ts';
import { setupTaxaPanel } from './events/taxaEvents.ts';
import { setupDialogs } from './events/dialogs.ts';
import { setupFileMenu, setupEditMenu, setupMenuBarNavigation, setupPanelCollapse } from './events/menuEvents.ts';
import { setupNavigationClicks, setupContextMenu } from './events/navigationEvents.ts';
import { setupKeyboardShortcuts } from './events/keyboardShortcuts.ts';
import { setupFormatToolbar } from './ui/formatToolbar.ts';

// Baseline fallback blueprint structure: a small, real species-level key (four
// common European amphibians) so the sample workspace demonstrates the editor the
// way it is actually used — binomials with their auctor, vernacular names, and
// morphological couplets. Taxon ends are seeded as drafts whose names match the
// fallbackTaxa records below, so loadFromStorage resolves them into linked cards.
const fallbackData: Couplet[] = [
    { id: 101, alt1: "Skin dry and warty, with a prominent parotoid gland behind each eye [figID: 101]", alt2: "Skin smooth and moist, without parotoid glands", branch1: { kind: 'taxonDraft', name: "Bufo bufo" }, branch2: { kind: 'linked', targetId: 102 } },
    { id: 102, alt1: "Tail retained in the adult; body slender and lizard-like [figID: 102]", alt2: "Tail absent in the adult; hind limbs long and adapted for jumping", branch1: { kind: 'taxonDraft', name: "Lissotriton vulgaris" }, branch2: { kind: 'linked', targetId: 103 } },
    { id: 103, alt1: "A dark temporal patch runs from the eye across the ear-drum; dorsum brown to reddish [figID: 103]", alt2: "Temporal patch absent; dorsum usually green, often with a pale vertebral stripe", branch1: { kind: 'taxonDraft', name: "Rana temporaria" }, branch2: { kind: 'taxonDraft', name: "Pelophylax lessonae" } }
];

const fallbackFigures = [
    { id: 101, filename: "parotoid-gland.jpg", caption: "Parotoid gland behind the eye of Bufo bufo" },
    { id: 102, filename: "newt-tail.jpg", caption: "Adult Lissotriton vulgaris, tail retained" },
    { id: 103, filename: "temporal-patch.jpg", caption: "Dark temporal patch of Rana temporaria" }
];

// Auctor follows the zoological convention: parentheses when the species has been
// moved out of the genus it was originally described in, none when it has not.
const fallbackTaxa: Taxon[] = [
    { id: 201, scientificName: "Bufo bufo", auctor: "(Linnaeus, 1758)", vernacularName: "Common toad", synonyms: ["Rana bufo Linnaeus, 1758"], description: '', biology: '', distribution: '', confusables: [] },
    { id: 202, scientificName: "Lissotriton vulgaris", auctor: "(Linnaeus, 1758)", vernacularName: "Smooth newt", synonyms: ["Triturus vulgaris (Linnaeus, 1758)"], description: '', biology: '', distribution: '', confusables: [] },
    { id: 203, scientificName: "Rana temporaria", auctor: "Linnaeus, 1758", vernacularName: "Common frog", synonyms: [], description: '', biology: '', distribution: '', confusables: [] },
    { id: 204, scientificName: "Pelophylax lessonae", auctor: "(Camerano, 1882)", vernacularName: "Pool frog", synonyms: ["Rana lessonae Camerano, 1882"], description: '', biology: '', distribution: '', confusables: [] }
];

/**
 * Wires every event module in events/ behind a single AbortController so the
 * whole app's listeners tear down together. Each module owns one area (couplets,
 * figures, dialogs, menus, navigation).
 */
function setupGlobalListeners(store: KeyStore, uiState: UIStateStore, refreshAll: () => void) {
    const keyContainer = document.querySelector('#editor-container') as HTMLElement;
    if (!keyContainer) return () => { };

    const controller = new AbortController();
    const { signal } = controller;

    setupPlainTextImporter(store, uiState, refreshAll, signal);
    setupPdfImporter(store, uiState, refreshAll, signal);
    setupTitleEditing(store, signal);
    setupCoupletSelection(keyContainer, store, refreshAll, signal);
    setupCoupletInput(keyContainer, store, uiState, refreshAll, signal);
    setupDestinationCombobox(keyContainer, store, uiState, signal);
    setupCoupletFocus(keyContainer, store, uiState, refreshAll, signal);
    setupCoupletDragAndDrop(keyContainer, store, signal);
    setupFigurePanel(store, uiState, refreshAll, signal);
    setupTaxaPanel(store, uiState, refreshAll, signal);
    setupDialogs(store, uiState, signal);
    setupFileMenu(store, uiState, signal);
    setupEditMenu(store, uiState, refreshAll, signal);
    setupFigureReference(store, signal);
    setupFormatToolbar(store, signal);
    setupNavigationClicks(store, uiState, signal);
    setupContextMenu(store, signal);
    setupMenuBarNavigation(signal);
    setupPanelCollapse(uiState, signal);

    return () => {
        controller.abort();
    };
}

async function bootstrapApp() {
    const appContainer = document.querySelector<HTMLDivElement>('#app');
    if (!appContainer) {
        throw new Error("Application bootstrap failed: DOM target element '#app' was not found.");
    }

    const uiState = new UIStateStore();
    const lastViewedProject = uiState.activeProjectTitle;

    const store = new KeyStore([], []);

    store.setProjectPersistedListener(title => uiState.setActiveProjectTitle(title));

    let loadSuccess = false;

    if (lastViewedProject && lastViewedProject !== 'Untitled Key') {
        try {
            // Attempt to load the exact project last opened/viewed by the user
            loadSuccess = await store.loadProject(lastViewedProject);
        } catch (loadError) {
            console.error(`Failed to restore active project session "${lastViewedProject}":`, loadError);
        }
    }

    // Fallback tracking: If there is no session history, or the target project was deleted, build the fallback canvas
    if (!loadSuccess) {
        console.log("🌱 No active database workspace recovered. Hydrating baseline sample template.");
        await store.loadFromStorage([...fallbackData], [...fallbackFigures], "Untitled Key", [...fallbackTaxa]);
        uiState.setActiveProjectTitle("Untitled Key");
    }

    const refreshAll = () => {
        applyPanelVisibility(uiState);
        renderMenu(store, uiState);
        renderEditorCards(store, uiState, refreshAll);
        renderPrintView(store, uiState);
        renderFigures(store, uiState, refreshAll);
        renderTaxa(store, uiState, refreshAll);
    };

    const cleanups: Array<() => void> = [];

    // The one place a change becomes a render. Both stores announce their own
    // mutations, so no event handler has to remember to ask for a refresh —
    // batchedRefresh coalesces a burst of changes into a single frame. Typing
    // changes are skipped: the panels debounce those and refresh once editing
    // settles, so the app doesn't re-render on every keystroke.
    const renderOnChange = (kind: ChangeKind) => {
        if (kind !== 'typing') batchedRefresh(refreshAll);
    };
    cleanups.push(store.subscribe(renderOnChange));
    cleanups.push(uiState.subscribe(renderOnChange));

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        if (store.hasUnsavedChanges()) {
            event.preventDefault();
            event.returnValue = '';
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    cleanups.push(() => window.removeEventListener('beforeunload', handleBeforeUnload));

    initializeShell(appContainer);

    const destroyGlobalListeners = setupGlobalListeners(store, uiState, refreshAll);
    const destroyKeyboardShortcuts = setupKeyboardShortcuts(store);

    cleanups.push(destroyGlobalListeners);
    cleanups.push(destroyKeyboardShortcuts);

    refreshAll();
}

bootstrapApp().catch((error) => {
    // Without this the app silently stays blank (e.g. IndexedDB blocked by an
    // older tab) with only an unhandled-rejection entry in the console.
    console.error('Application bootstrap failed:', error);
    const app = document.querySelector<HTMLDivElement>('#app');
    if (app) {
        const note = document.createElement('p');
        note.className = 'bootstrap-error';
        note.textContent = '⚠️ TSKey could not start: '
            + (error instanceof Error ? error.message : String(error))
            + ' — close other TSKey tabs and reload.';
        app.replaceChildren(note);
    }
});
