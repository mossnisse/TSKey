// events/taxaEvents.ts
// Taxa panel events (add, edit, selection, drag-and-drop reordering), mirroring the
// figure panel. Multi-line fields (synonyms, confusables) are parsed from text back
// into their structured form here; ui/taxa.ts serializes them for display.
import type { KeyStore, Taxon, ConfusableSpecies } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { setupEntityPanel } from './entityPanel.ts';
import { batchedRefresh, DEBOUNCE_TYPING_MS } from './shared.ts';

/** Plain string fields editable directly as input/textarea values. The `description`
 *  field is edited in a mounted rich-text editor (see ui/taxa.ts + commitTaxonRichField),
 *  so it is committed there rather than through the delegated input path. */
const SIMPLE_FIELDS = new Set<keyof Taxon>(['scientificName', 'auctor', 'vernacularName', 'description', 'biology', 'distribution']);

/** Encodes any complete [fig: N] tokens in a taxon's description to stable [figID: N]. */
export function encodeTaxonDescription(store: KeyStore, id: number): void {
    const taxon = store.getTaxa().find(t => t.id === id);
    if (!taxon) return;
    const encoded = store.encodeFigureTokens(taxon.description);
    if (encoded !== taxon.description) store.updateTaxon(id, { description: encoded });
}

/**
 * Commits a rich-text description edit: immediate store sync + undo checkpoint, then a
 * debounced figure-token encode, draft relink, and refresh. Wired to the mounted
 * editor's onChange; blur-time encoding runs via the panel's settleField hook.
 */
export function commitTaxonRichField(
    store: KeyStore,
    uiState: UIStateStore,
    refreshAll: () => void,
    id: number,
    field: 'description',
    value: string,
) {
    const fieldKey = `taxon-${id}-${field}`;
    uiState.typing.taxa.start(fieldKey, () => store.endTypingSession());
    store.updateTaxon(id, { [field]: value } as Partial<Omit<Taxon, 'id'>>);

    uiState.typing.taxa.extendTimeout(DEBOUNCE_TYPING_MS, () => {
        encodeTaxonDescription(store, id);
        store.relinkTaxonDrafts();
        batchedRefresh(refreshAll);
    });
}

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
        // Encode the description's figure tokens on blur (the debounce is cancelled when
        // focus leaves the field, so this guarantees a stable [figID: N] gets stored).
        settleField: (id, field) => { if (field === 'description') encodeTaxonDescription(store, id); },
        keepFocusWithin: ['#add-taxon-btn', '.format-toolbar'],
    });
}
