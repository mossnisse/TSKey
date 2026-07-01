// events/taxaEvents.ts
// Taxa panel events (add, edit, selection, drag-and-drop reordering), mirroring the
// figure panel. Multi-line fields (synonyms, confusables) are parsed from text back
// into their structured form here; ui/taxa.ts serializes them for display.
import type { KeyStore, Taxon, ConfusableSpecies } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { batchedRefresh, DEBOUNCE_TYPING_MS, setupCardDragReorder } from './shared.ts';

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
    document.getElementById('add-taxon-btn')?.addEventListener('click', () => {
        store.addTaxon('');
        batchedRefresh(refreshAll);
    }, { signal });

    const container = document.getElementById('taxa-container');
    if (!container) return;

    container.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        if (!target.classList.contains('input-sync')) return;
        const card = target.closest('.taxon-card') as HTMLElement;
        if (!card) return;

        const taxonId = Number(card.getAttribute('data-id'));
        const field = target.getAttribute('data-field')!;
        const fieldKey = `taxon-${taxonId}-${field}`;

        uiState.typing.taxa.start(fieldKey, () => store.endTypingSession());

        const update = buildFieldUpdate(field, target.value);
        if (update) store.updateTaxon(taxonId, update);

        uiState.typing.taxa.extendTimeout(DEBOUNCE_TYPING_MS, () => {
            batchedRefresh(refreshAll);
        });
    }, { signal });

    container.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;

        // Clicking the panel background clears the taxon selection.
        if (target === container) {
            store.clearTaxonSelection();
            batchedRefresh(refreshAll);
            return;
        }

        const card = target.closest('.taxon-card') as HTMLElement;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));
        const multiSelect = e.ctrlKey || e.metaKey || e.shiftKey;

        // Clicking into a field selects the card (without stealing the click) only
        // when it isn't already selected, mirroring the figure panel.
        if (target.closest('input, textarea')) {
            if (!card.classList.contains('is-selected')) {
                store.toggleTaxonSelection(id, multiSelect);
                batchedRefresh(refreshAll);
            }
            return;
        }

        store.toggleTaxonSelection(id, multiSelect);
        batchedRefresh(refreshAll);
    }, { signal });

    container.addEventListener('focusout', (e: FocusEvent) => {
        const target = e.target as HTMLElement;
        if (!target.matches('input, textarea')) return;

        const card = target.closest('.taxon-card') as HTMLElement;
        if (!card) return;

        const taxonId = Number(card.getAttribute('data-id'));
        const field = target.getAttribute('data-field');
        const fieldKey = taxonId && field ? `taxon-${taxonId}-${field}` : null;

        uiState.typing.taxa.end(fieldKey, () => {
            const destination = e.relatedTarget as HTMLElement | null;
            const isClickingControl = destination instanceof Element && (
                destination.closest('.taxon-card') ||
                destination.closest('.app-menu-bar') ||
                destination.closest('#add-taxon-btn')
            );
            if (!isClickingControl) batchedRefresh(refreshAll);
        });
    }, { signal });

    // Taxa track their own drag id locally; reorderTaxa takes array indices, so the
    // drop handler converts the above/below position into a target index.
    let draggedTaxonId: number | null = null;
    setupCardDragReorder({
        container,
        cardSelector: '.taxon-card',
        getDraggedId: () => draggedTaxonId,
        setDraggedId: (id) => { draggedTaxonId = id; },
        signal,
        onDrop: (draggedId, targetId, position) => {
            const taxa = store.getTaxa();
            const srcIdx = taxa.findIndex(t => t.id === draggedId);
            let targetIdx = taxa.findIndex(t => t.id === targetId);
            if (srcIdx === -1 || targetIdx === -1) return;

            if (position === 'below') {
                targetIdx = srcIdx < targetIdx ? targetIdx : targetIdx + 1;
            } else {
                targetIdx = srcIdx < targetIdx ? targetIdx - 1 : targetIdx;
            }

            if (srcIdx !== targetIdx) {
                store.reorderTaxa(srcIdx, targetIdx);
                batchedRefresh(refreshAll);
            }
        },
    });
}
