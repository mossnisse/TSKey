// main.ts

import { KeyStore } from './store.ts';
import { initializeShell, renderEditorCards, renderPrintView } from './uiRenderer.ts';

// Initialize state store from storage or fallbacks
const initialData = JSON.parse(localStorage.getItem('dichotomous_key') || 'null') || [
    { id: 101, alt1: "Has feathers", alt2: "Lacks feathers", link1: 0, link2: 102, taxa1: "Bird", taxa2: "" },
    { id: 102, alt1: "Has fur", alt2: "Scales or bare skin", link1: 0, link2: 103, taxa1: "Mammal", taxa2: "" },
    { id: 103, alt1: "Has scales", alt2: "Skin is smooth and moist", link1: 0, link2: 0, taxa1: "Reptile2", taxa2: "Amphibian" }
];

const store = new KeyStore(initialData);
const appContainer = document.querySelector<HTMLDivElement>('#app')!;

// Define the comprehensive visual refresh handler loops
const refreshAll = () => {
    renderEditorCards(store, refreshAll);
    renderPrintView(store);
};

// Bootstrap application runtime instance
initializeShell(appContainer, store, refreshAll);
refreshAll();