// events/taxaEvents.ts
// Taxa panel events (add, edit, selection, drag-and-drop reordering), mirroring the
// figure panel. Multi-line fields (synonyms, confusables) are parsed from text back
// into their structured form here; ui/taxa.ts serializes them for display.
import type { KeyStore, Taxon, ConfusableSpecies } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { setupEntityPanel } from './entityPanel.ts';

/** Plain string fields editable directly as input/textarea values. */
const SIMPLE_FIELDS = new Set<keyof Taxon>(['scientificName', 'auctor', 'vernacularName', 'description', 'biology', 'distribution']);

/** One synonym per line; blank lines dropped. */
function textToSynonyms(text: string): string[] {
    return text.split('\n').map(s => s.trim()).filter(s => s !== '');
}

/** Each line "name | how to distinguish" (the bar and distinction are optional). */
function textToConfusables(text: string): ConfusableSpecies[] {
    return text.split('\n')
        .map(line => {
            const barIndex = line.indexOf('|');
            const name = (barIndex === -1 ? line : line.slice(0, barIndex)).trim();
            const distinction = barIndex === -1 ? '' : line.slice(barIndex + 1).trim();
            return { name, distinction };
        })
        .filter(c => c.name !== '' || c.distinction !== '');
}

/** Builds the partial taxon update for an edited field, or null for an unknown field. */
function buildFieldUpdate(field: string, value: string): Partial<Omit<Taxon, 'id'>> | null {
    if (SIMPLE_FIELDS.has(field as keyof Taxon)) {
        return { [field]: value } as Partial<Omit<Taxon, 'id'>>;
    }
    if (field === 'synonyms') return { synonyms: textToSynonyms(value) };
    if (field === 'confusables') return { confusables: textToConfusables(value) };
    return null;
}

/** Taxa panel: add button, field editing, selection, and drag-and-drop reordering. */
export function setupTaxaPanel(store: KeyStore, uiState: UIStateStore, refreshAll: () => void, signal: AbortSignal) {
    const container = document.getElementById('taxa-container');
    if (!container) return;

    setupEntityPanel({
        container,
        cardSelector: '.taxon-card',
        addButton: document.getElementById('add-taxon-btn'),
        fieldKeyPrefix: 'taxon',
        typing: uiState.typing.taxa,
        signal,
        refreshAll,
        onAdd: () => store.addTaxon(''),
        endTypingSession: () => store.endTypingSession(),
        buildUpdate: buildFieldUpdate,
        applyUpdate: (id, update) => store.updateTaxon(id, update as Partial<Omit<Taxon, 'id'>>),
        toggleSelection: (id, multi) => store.toggleTaxonSelection(id, multi),
        clearSelection: () => store.clearTaxonSelection(),
        getItems: () => store.getTaxa(),
        reorder: (src, tgt) => store.reorderTaxa(src, tgt),
        // A settled name edit may make a lead's draft match this taxon — link it.
        onSettle: () => store.relinkTaxonDrafts(),
        keepFocusWithin: ['#add-taxon-btn'],
    });
}
