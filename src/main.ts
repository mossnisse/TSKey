// main.ts

import './style.css';
import { KeyStore } from './store.ts';
import type { Couplet } from './store.ts';
import { UIStateStore } from './uiState.ts';
import { initializeShell, applyPanelVisibility, renderEditorCards, renderPrintView, renderMenu, renderFigures } from './uiRenderer.ts';
import { setupGlobalListeners, setupKeyboardShortcuts } from './eventController.ts';

// Baseline fallback blueprint structure
const fallbackData: Couplet[] = [
    { id: 101, alt1: "Has feathers [figID: 101]", alt2: "Lacks feathers", branch1: { kind: 'taxon', name: "Bird" }, branch2: { kind: 'linked', targetId: 102 } },
    { id: 102, alt1: "Has fur [figID: 102]", alt2: "Scales or bare skin", branch1: { kind: 'taxon', name: "Mammal" }, branch2: { kind: 'linked', targetId: 103 } },
    { id: 103, alt1: "Has scales [figID: 103]", alt2: "Skin is smooth and moist", branch1: { kind: 'taxon', name: "Reptile2" }, branch2: { kind: 'taxon', name: "Amphibian" } }
];

const fallbackFigures = [
    { id: 101, filename: "feathers.jpg", caption: "Bird feathers" },
    { id: 102, filename: "fur.jpg", caption: "Wolf fur" },
    { id: 103, filename: "Lizard.jpg", caption: "Lizard scales" }
];

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
        await store.loadFromStorage([...fallbackData], [...fallbackFigures], "Untitled Key");
        uiState.setActiveProjectTitle("Untitled Key");
    }

    const refreshAll = () => {
        applyPanelVisibility(uiState);
        renderMenu(store, uiState);
        renderEditorCards(store);
        renderPrintView(store, uiState);
        renderFigures(store, uiState, refreshAll);
    };

    const cleanups: Array<() => void> = [];

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
    const destroyKeyboardShortcuts = setupKeyboardShortcuts(store, refreshAll);

    cleanups.push(destroyGlobalListeners);
    cleanups.push(destroyKeyboardShortcuts);

    refreshAll();
}

bootstrapApp();