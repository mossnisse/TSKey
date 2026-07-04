// ui/taxa.ts
// Incremental reconciler for the Taxa panel — one editable "chapter" card per taxon
// record, mirroring the figure-panel reconciler. Multi-line fields (synonyms,
// confusables) are serialized to text here; events/taxaEvents.ts parses them back.
import type { KeyStore, Taxon, ConfusableSpecies } from '../store';
import type { UIStateStore } from '../uiState.ts';
import type { NameDisplayMode } from '../utils.ts';
import { syncField, reconcileCards } from './shared.ts';
import { mountRichTextField, syncRichTextField, destroyRichTextFieldsIn, figureFieldSchema } from './richTextField.ts';
import { commitTaxonRichField } from '../events/taxaEvents.ts';

/** One synonym per line. */
export function synonymsToText(synonyms: readonly string[]): string {
    return synonyms.join('\n');
}

/** One confusable per line as "name | how to distinguish" (the bar is optional). */
export function confusablesToText(confusables: readonly ConfusableSpecies[]): string {
    return confusables
        .map(c => (c.distinction ? `${c.name} | ${c.distinction}` : c.name))
        .join('\n');
}

const SCIENTIFIC_NAME_ROW = `
        <div class="taxon-field-row">
            <label>Scientific name:</label>
            <input type="text" class="input-sync taxon-input" data-field="scientificName" aria-label="Scientific name" />
        </div>`;
const AUCTOR_ROW = `
        <div class="taxon-field-row">
            <label>Auctor:</label>
            <input type="text" class="input-sync taxon-input" data-field="auctor" aria-label="Author citation (auctor)" />
        </div>`;
const VERNACULAR_NAME_ROW = `
        <div class="taxon-field-row">
            <label>Vernacular name:</label>
            <input type="text" class="input-sync taxon-input" data-field="vernacularName" placeholder="Vernacular name" aria-label="Vernacular name" />
        </div>`;

/**
 * The card markup, with the name field for the current display mode first. The
 * scientific name keeps its auctor immediately after it (the authority cites the
 * scientific name), so vernacular mode leads with the vernacular row, then the
 * scientific + auctor pair.
 */
function taxonCardMarkup(mode: NameDisplayMode): string {
    const nameRows = mode === 'vernacular'
        ? VERNACULAR_NAME_ROW + SCIENTIFIC_NAME_ROW + AUCTOR_ROW
        : SCIENTIFIC_NAME_ROW + AUCTOR_ROW + VERNACULAR_NAME_ROW;

    return `
        <div class="taxon-card-header">
            <span class="taxon-card-title"></span>
        </div>
        ${nameRows}
        <div class="taxon-field-row">
            <label>Synonyms (one per line):</label>
            <textarea class="input-sync taxon-textarea" data-field="synonyms" rows="2" aria-label="Synonyms, one per line"></textarea>
        </div>
        <div class="taxon-field-row">
            <label>Description:</label>
            <div class="rte-host taxon-rte" data-field="description" aria-label="Taxon description"></div>
        </div>
        <div class="taxon-field-row">
            <label>Biology:</label>
            <textarea class="input-sync taxon-textarea" data-field="biology" rows="3" aria-label="Biology"></textarea>
        </div>
        <div class="taxon-field-row">
            <label>Distribution:</label>
            <textarea class="input-sync taxon-textarea" data-field="distribution" rows="2" aria-label="Distribution"></textarea>
        </div>
        <div class="taxon-field-row">
            <label>Confusable species (name | how to distinguish, one per line):</label>
            <textarea class="input-sync taxon-textarea" data-field="confusables" rows="3" aria-label="Confusable species, one per line"></textarea>
        </div>
    `;
}

/** Patches a card's fields from a taxon record, skipping any field being edited. */
function syncTaxonCard(card: HTMLElement, taxon: Taxon, displayNum: number, store: KeyStore) {
    const titleEl = card.querySelector('.taxon-card-title');
    const title = `${displayNum}.`;
    if (titleEl && titleEl.textContent !== title) titleEl.textContent = title;

    syncField(card, 'input[data-field="scientificName"]', taxon.scientificName);
    syncField(card, 'input[data-field="auctor"]', taxon.auctor);
    syncField(card, 'input[data-field="vernacularName"]', taxon.vernacularName);
    syncField(card, 'textarea[data-field="synonyms"]', synonymsToText(taxon.synonyms));
    const descHost = card.querySelector('.rte-host[data-field="description"]') as HTMLElement | null;
    if (descHost) syncRichTextField(descHost, store.decodeTextReferencesForEditor(taxon.description));
    syncField(card, 'textarea[data-field="biology"]', taxon.biology);
    syncField(card, 'textarea[data-field="distribution"]', taxon.distribution);
    syncField(card, 'textarea[data-field="confusables"]', confusablesToText(taxon.confusables));
}

function createTaxonCard(taxon: Taxon, mode: NameDisplayMode, store: KeyStore, uiState: UIStateStore, refreshAll: () => void): HTMLElement {
    const block = document.createElement('div');
    block.className = 'taxon-card';
    block.setAttribute('data-id', taxon.id.toString());
    block.draggable = true;
    block.innerHTML = taxonCardMarkup(mode);

    const descHost = block.querySelector('.rte-host[data-field="description"]') as HTMLElement | null;
    if (descHost) {
        mountRichTextField(descHost, {
            schema: figureFieldSchema(store),
            value: store.decodeTextReferencesForEditor(taxon.description),
            placeholder: 'Diagnostic description — supports **bold**, *italic*, and [fig: 1]…',
            onChange: v => commitTaxonRichField(store, uiState, refreshAll, taxon.id, 'description', v),
        });
    }
    return block;
}

export function renderTaxa(store: KeyStore, uiState: UIStateStore, refreshAll: () => void) {
    if (uiState.isTaxaHidden) return;

    const container = document.getElementById('taxa-container');
    if (!container) return;

    const mode = uiState.nameDisplayMode;
    // Name-field order depends on the display setting; drop cards to rebuild on change.
    if (container.dataset.nameMode !== mode) {
        destroyRichTextFieldsIn(container);
        container.replaceChildren();
        container.dataset.nameMode = mode;
    }

    const selectedIds = store.getSelectedTaxonIds();

    reconcileCards<Taxon>({
        container,
        items: store.getTaxa(),
        getId: t => t.id,
        create: taxon => createTaxonCard(taxon, mode, store, uiState, refreshAll),
        update: (block, taxon, index) => {
            block.classList.toggle('is-selected', selectedIds.has(taxon.id));
            syncTaxonCard(block, taxon, index + 1, store);
        },
        onRemove: destroyRichTextFieldsIn,
    });
}