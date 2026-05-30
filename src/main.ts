// main.ts
import './style.css'; // INJECT GLOBAL PROJECT STYLES
import { KeyStore, type Couplet  } from './store.ts';
import { initializeShell, renderEditorCards, renderPrintView } from './uiRenderer.ts';
import { setupGlobalListeners, setupKeyboardShortcuts} from './eventController.ts'

const fallbackData = [
    { id: 101, alt1: "Has feathers", alt2: "Lacks feathers", link1: 0, link2: 102, taxa1: "Bird", taxa2: "" },
    { id: 102, alt1: "Has fur", alt2: "Scales or bare skin", link1: 0, link2: 103, taxa1: "Mammal", taxa2: "" },
    { id: 103, alt1: "Has scales", alt2: "Skin is smooth and moist", link1: 0, link2: 0, taxa1: "Reptile2", taxa2: "Amphibian" }
];

function isValidCoupletArray(data: any): data is Couplet[] {
    if (!Array.isArray(data)) return false;
    
    return data.every(item => 
        item &&
        typeof item === 'object' &&
        typeof item.id === 'number' &&
        typeof item.alt1 === 'string' &&
        typeof item.alt2 === 'string' &&
        typeof item.link1 === 'number' &&
        typeof item.link2 === 'number' &&
        typeof item.taxa1 === 'string' &&
        typeof item.taxa2 === 'string'
    );
}

let initialData: Couplet[];
try {
    const rawStorage = localStorage.getItem('dichotomous_key');
    const parsedData = rawStorage ? JSON.parse(rawStorage) : null;
    
    // Explicitly validate the schema structure before accepting it
    if (parsedData && isValidCoupletArray(parsedData)) {
        initialData = parsedData;
    } else {
        if (rawStorage) {
            console.warn('Invalid data schema detected in localStorage. Loading defaults.');
        }
        initialData = fallbackData;
    }
} catch {
    console.warn('Corrupted localStorage JSON format. Loading defaults.');
    initialData = fallbackData;
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
            saveBtn.classList.add('is-unsaved'); // Activates amber alerting state via CSS
        } else {
            saveBtn.innerHTML = '💾 Save Memory';
            saveBtn.classList.remove('is-unsaved'); // Resets to baseline operational green
        }
    }

    const deleteBtn = document.querySelector<HTMLButtonElement>('#cmd-delete-selected');
    if (deleteBtn) {
        const hasSelection = store.getSelectedIds().length > 0;
        deleteBtn.disabled = !hasSelection;
    }
};

window.addEventListener('beforeunload', (event) => {
    if (store.hasUnsavedChanges()) {
        event.preventDefault();
    }
});

initializeShell(appContainer);
setupGlobalListeners(store, refreshAll);
setupKeyboardShortcuts(store, refreshAll);
refreshAll();