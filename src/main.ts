// main.ts
import './style.css'; 
import { KeyStore } from './store.ts';
import { initializeShell, renderEditorCards, renderPrintView, renderMenu } from './uiRenderer.ts';
import { setupGlobalListeners, setupKeyboardShortcuts } from './eventController.ts';

// Baseline fallback blueprint structure
const fallbackData = [
    { id: 101, alt1: "Has feathers", alt2: "Lacks feathers", link1: 0, link2: 102, taxa1: "Bird", taxa2: "" },
    { id: 102, alt1: "Has fur", alt2: "Scales or bare skin", link1: 0, link2: 103, taxa1: "Mammal", taxa2: "" },
    { id: 103, alt1: "Has scales", alt2: "Skin is smooth and moist", link1: 0, link2: 0, taxa1: "Reptile2", taxa2: "Amphibian" }
] as const;

// Defensive Shell Target Validation
const appContainer = document.querySelector<HTMLDivElement>('#app');
if (!appContainer) {
    throw new Error("Application bootstrap failed: DOM target element '#app' was not found.");
}

// Initialize Core State Tree Engine
const store = new KeyStore([]); 

// Spreads fallback data to keep the original immutable list un-mutated.
store.loadFromStorage([...fallbackData]); 

// Centralized View State Re-evaluation Coordinator Loop
const refreshAll = () => {
    renderMenu(store);
    renderEditorCards(store);
    renderPrintView(store);
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