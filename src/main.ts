// main.ts

import './style.css';
import { KeyStore } from './store.ts';
import { UIStateStore } from './uiState.ts';
import { initializeShell, applyPanelVisibility, renderEditorCards, renderPrintView, renderMenu, renderFigures } from './uiRenderer.ts';
import { setupGlobalListeners, setupKeyboardShortcuts } from './eventController.ts';

// Baseline fallback blueprint structure
const fallbackData = [
    { id: 101, alt1: "Has feathers [figID: 101]", alt2: "Lacks feathers", link1: 0, link2: 102, taxa1: "Bird", taxa2: "" },
    { id: 102, alt1: "Has fur [figID: 102]", alt2: "Scales or bare skin", link1: 0, link2: 103, taxa1: "Mammal", taxa2: "" },
    { id: 103, alt1: "Has scales [figID: 103]", alt2: "Skin is smooth and moist", link1: 0, link2: 0, taxa1: "Reptile2", taxa2: "Amphibian" }
] as const;

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
    let loadSuccess = false;

    if (lastViewedProject && lastViewedProject !== 'Untitled Key') {
        try {
            // Attempt to load the exact project last opened/viewed by the user
            loadSuccess = await store.loadProject(lastViewedProject);
        } catch (loadError) {
            console.error(`Failed to restore active project session "${lastViewedProject}":`, loadError);
        }
    }

    // 3. Fallback tracking: If there is no session history, or the target project was deleted, build the fallback canvas
    if (!loadSuccess) {
        console.log("🌱 No active database workspace recovered. Hydrating baseline sample template.");
        await store.loadFromStorage([...fallbackData], [...fallbackFigures]);
        
        // Ensure "Untitled Key" is written as the base tracking context title
        store.setProjectName("Untitled Key");
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
