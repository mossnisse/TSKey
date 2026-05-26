// main.ts
import { KeyStore, type Couplet  } from './store.ts';
import { initializeShell, renderEditorCards, renderPrintView } from './uiRenderer.ts';

// Initialize state store from storage or fallbacks
const fallbackData = [
    { id: 101, alt1: "Has feathers", alt2: "Lacks feathers", link1: 0, link2: 102, taxa1: "Bird", taxa2: "" },
    { id: 102, alt1: "Has fur", alt2: "Scales or bare skin", link1: 0, link2: 103, taxa1: "Mammal", taxa2: "" },
    { id: 103, alt1: "Has scales", alt2: "Skin is smooth and moist", link1: 0, link2: 0, taxa1: "Reptile2", taxa2: "Amphibian" }
];

let initialData: Couplet[];
try {
    initialData = JSON.parse(localStorage.getItem('dichotomous_key') || 'null') || fallbackData;
} catch {
    console.warn('Corrupted localStorage data. Loading defaults.');
    initialData = fallbackData;
}

const store = new KeyStore(initialData);
const appContainer = document.querySelector<HTMLDivElement>('#app')!;

// Define the comprehensive visual refresh handler loops
const refreshAll = () => {
    renderEditorCards(store, refreshAll);
    renderPrintView(store);

    const saveBtn = document.querySelector<HTMLButtonElement>('#cmd-save');
    if (saveBtn) {
        if (store.hasUnsavedChanges()) {
            saveBtn.innerHTML = '💾 Save Memory *';
            saveBtn.style.background = '#eab308'; // Warning amber/yellow color
        } else {
            saveBtn.innerHTML = '💾 Save Memory';
            saveBtn.style.background = '#22c55e'; // Clean success green color
        }
    }
};

window.addEventListener('beforeunload', (event) => {
    if (store.hasUnsavedChanges()) {
        // Triggers the standard system dialogue box 
        event.preventDefault();
    }
});

// Bootstrap application runtime instance
initializeShell(appContainer, store, refreshAll);
refreshAll();