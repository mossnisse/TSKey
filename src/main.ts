// main.ts - Updated application bootstrap routine with lifecycle controls

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

// Defensive Shell Target Validation
const appContainer = document.querySelector<HTMLDivElement>('#app');
if (!appContainer) {
    throw new Error("Application bootstrap failed: DOM target element '#app' was not found.");
}

// Initialize Core State Tree Engine with initial baseline fallback figures
const store = new KeyStore([], []);
store.loadFromStorage([...fallbackData], [...fallbackFigures]);

// Initialize UI Preference State — panel visibility, persisted to localStorage
const uiState = new UIStateStore();

// Centralized View State Re-evaluation Coordinator Loop
const refreshAll = () => {
    applyPanelVisibility(uiState); // Sync DOM classes FROM state — never the other way around
    renderMenu(store, uiState);
    renderEditorCards(store);
    renderPrintView(store, uiState);
    renderFigures(store, uiState);
};

// Track all cleanups needed if the app unmounts or reloads via HMR
const cleanups: Array<() => void> = [];

// Unsaved Progress Page Discard Guard Listener
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (store.hasUnsavedChanges()) {
        event.preventDefault();
        event.returnValue = '';
    }
};
window.addEventListener('beforeunload', handleBeforeUnload);
cleanups.push(() => window.removeEventListener('beforeunload', handleBeforeUnload));

// Assemble Interactive Frame Environments Context
initializeShell(appContainer);

// FIX: Capture and store the cleanup tokens
const destroyGlobalListeners = setupGlobalListeners(store, uiState, refreshAll);
const destroyKeyboardShortcuts = setupKeyboardShortcuts(store, refreshAll);

cleanups.push(destroyGlobalListeners);
cleanups.push(destroyKeyboardShortcuts);

refreshAll();
