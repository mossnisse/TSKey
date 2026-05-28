import './style.css'; // INJECT GLOBAL PROJECT STYLES
import { KeyStore, type Couplet  } from './store.ts';
import { initializeShell, renderEditorCards, renderPrintView } from './uiRenderer.ts';

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

const refreshAll = () => {
    renderEditorCards(store, refreshAll);
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
};

window.addEventListener('beforeunload', (event) => {
    if (store.hasUnsavedChanges()) {
        event.preventDefault();
    }
});

initializeShell(appContainer, store, refreshAll);
refreshAll();