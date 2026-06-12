// main.ts - Updated application bootstrap routine

import './style.css'; 
import { KeyStore } from './store.ts';
// Added renderFigures to the import statement
import { initializeShell, renderEditorCards, renderPrintView, renderMenu, renderFigures } from './uiRenderer.ts';
import { setupGlobalListeners, setupKeyboardShortcuts } from './eventController.ts';

// Baseline fallback blueprint structure
const fallbackData = [
    { id: 101, alt1: "Has feathers", alt2: "Lacks feathers", link1: 0, link2: 102, taxa1: "Bird", taxa2: "" },
    { id: 102, alt1: "Has fur", alt2: "Scales or bare skin", link1: 0, link2: 103, taxa1: "Mammal", taxa2: "" },
    { id: 103, alt1: "Has scales", alt2: "Skin is smooth and moist", link1: 0, link2: 0, taxa1: "Reptile2", taxa2: "Amphibian" }
] as const;

const fallbackFigures = [
    { id: 101, filename: "testImage1.jpg", caption: "Test image1" },
    { id: 102, filename: "testImage2.jpg", caption: "Test image2" },
    { id: 103, filename: "testImage3.jpg", caption: "Test image3" }
];

// Defensive Shell Target Validation
const appContainer = document.querySelector<HTMLDivElement>('#app');
if (!appContainer) {
    throw new Error("Application bootstrap failed: DOM target element '#app' was not found.");
}

// Initialize Core State Tree Engine with initial baseline fallback figures
const store = new KeyStore([], []);
store.loadFromStorage([...fallbackData], [...fallbackFigures]);

// Centralized View State Re-evaluation Coordinator Loop
const refreshAll = () => {
    renderMenu(store);
    renderEditorCards(store);
    renderPrintView(store);
    renderFigures(store); // Added to the refresh painter cycle loop
};

// Unsaved Progress Page Discard Guard Listener
window.addEventListener('beforeunload', (event) => {
    if (store.hasUnsavedChanges()) {
        event.preventDefault();
        event.returnValue = '';
    }
});

// Assemble Interactive Frame Environments Context
initializeShell(appContainer);
setupGlobalListeners(store, refreshAll);
setupKeyboardShortcuts(store, refreshAll);

// Initial UI Paint Sweep
refreshAll();