import './style.css'; // INJECT GLOBAL PROJECT STYLES
import { KeyStore } from './store.ts';
import { initializeShell, renderEditorCards, renderPrintView } from './uiRenderer.ts';
import { setupGlobalListeners, setupKeyboardShortcuts } from './eventController.ts';
import { isValidCoupletArray } from './utils.ts';

const STORAGE_KEY = 'dichotomous_key';

const fallbackData = [
    { id: 101, alt1: "Has feathers", alt2: "Lacks feathers", link1: 0, link2: 102, taxa1: "Bird", taxa2: "" },
    { id: 102, alt1: "Has fur", alt2: "Scales or bare skin", link1: 0, link2: 103, taxa1: "Mammal", taxa2: "" },
    { id: 103, alt1: "Has scales", alt2: "Skin is smooth and moist", link1: 0, link2: 0, taxa1: "Reptile2", taxa2: "Amphibian" }
];

let initialData = fallbackData;
try {
    const rawStorage = localStorage.getItem(STORAGE_KEY);
    if (rawStorage) {
        const parsed = JSON.parse(rawStorage);
        if (isValidCoupletArray(parsed)) {
            initialData = parsed;
        } else {
            console.warn('Invalid data schema detected in localStorage. Loading defaults.');
        }
    }
} catch {
    console.warn('Corrupted localStorage JSON format. Loading defaults.');
}

const store = new KeyStore(initialData);
const appContainer = document.querySelector<HTMLDivElement>('#app');

if (!appContainer) {
    throw new Error("Application bootstrap failed: DOM target element '#app' was not found.");
}

// Statically cache sub-element handles to keep refreshAll pipeline lightweight
let saveBtn: HTMLButtonElement | null = null;
let deleteBtn: HTMLButtonElement | null = null;

const refreshAll = () => {
    // 1. Structural rendering passes
    renderEditorCards(store);
    renderPrintView(store);

    // 2. Performance-optimized state synchronization using cached elements
    if (saveBtn) {
        const hasUnsaved = store.hasUnsavedChanges();
        saveBtn.textContent = hasUnsaved ? '💾 Save Memory *' : '💾 Save Memory';
        saveBtn.classList.toggle('is-unsaved', hasUnsaved);
    }

    if (deleteBtn) {
        const selectedCount = store.getSelectedIds().size;
        deleteBtn.disabled = selectedCount === 0;
        deleteBtn.textContent = `🗑️ Delete Selected (${selectedCount})`;
    }
};

window.addEventListener('beforeunload', (event) => {
    if (store.hasUnsavedChanges()) {
        event.preventDefault();
        event.returnValue = '';
    }
});

// Structural initialization sequence
initializeShell(appContainer);

// Query handles exactly once now that the DOM contents exist
saveBtn = document.querySelector<HTMLButtonElement>('#cmd-save');
deleteBtn = document.querySelector<HTMLButtonElement>('#cmd-delete-selected');

// Wire up event routing engines
setupGlobalListeners(store, refreshAll);
setupKeyboardShortcuts(store, refreshAll);

// Fire initial frame render layout sweep
refreshAll();