// main.ts
import './style.css'; // INJECT GLOBAL PROJECT STYLES
import { KeyStore } from './store.ts';
import { initializeShell, renderEditorCards, renderPrintView } from './uiRenderer.ts';
import { setupGlobalListeners, setupKeyboardShortcuts} from './eventController.ts'
import { isValidCoupletArray } from './utils.ts';

const fallbackData = [
    { id: 101, alt1: "Has feathers", alt2: "Lacks feathers", link1: 0, link2: 102, taxa1: "Bird", taxa2: "" },
    { id: 102, alt1: "Has fur", alt2: "Scales or bare skin", link1: 0, link2: 103, taxa1: "Mammal", taxa2: "" },
    { id: 103, alt1: "Has scales", alt2: "Skin is smooth and moist", link1: 0, link2: 0, taxa1: "Reptile2", taxa2: "Amphibian" }
];

let initialData = fallbackData;
try {
    const rawStorage = localStorage.getItem('dichotomous_key');
    if (rawStorage) {
        const parsed = JSON.parse(rawStorage);
        // Using the single unified validation check
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
const appContainer = document.querySelector<HTMLDivElement>('#app')!;

const refreshAll = () => {
    renderEditorCards(store);
    renderPrintView(store);

    const saveBtn = document.querySelector<HTMLButtonElement>('#cmd-save');
    if (saveBtn) {
        if (store.hasUnsavedChanges()) {
            saveBtn.innerHTML = '💾 Save Memory *';
            saveBtn.classList.add('is-unsaved');
        } else {
            saveBtn.innerHTML = '💾 Save Memory';
            saveBtn.classList.remove('is-unsaved');
        }
    }

    // Consolidated Button presentation state updates
    const deleteBtn = document.querySelector<HTMLButtonElement>('#cmd-delete-selected');
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

initializeShell(appContainer);
setupGlobalListeners(store, refreshAll);
setupKeyboardShortcuts(store, refreshAll);
refreshAll();