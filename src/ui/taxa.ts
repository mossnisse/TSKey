// ui/taxa.ts
// Incremental reconciler for the Taxa panel — one editable "chapter" card per taxon
// record, mirroring the figure-panel reconciler. Multi-line fields (synonyms,
// confusables) are serialized to text here; events/taxaEvents.ts parses them back.
import type { KeyStore, Taxon, ConfusableSpecies } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { syncField } from './shared.ts';

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

function taxonCardMarkup(): string {
    return `
        <div class="taxon-card-header">
            <span class="taxon-card-title"></span>
        </div>
        <div class="taxon-field-row">
            <label>Scientific name:</label>
            <input type="text" class="input-sync taxon-input" data-field="scientificName" />
        </div>
        <div class="taxon-field-row">
            <label>Auctor:</label>
            <input type="text" class="input-sync taxon-input" data-field="auctor" />
        </div>
        <div class="taxon-field-row">
            <label>Vernacular name:</label>
            <input type="text" class="input-sync taxon-input" data-field="vernacularName" placeholder="Vernacular name" />
        </div>
        <div class="taxon-field-row">
            <label>Synonyms (one per line):</label>
            <textarea class="input-sync taxon-textarea" data-field="synonyms" rows="2"></textarea>
        </div>
        <div class="taxon-field-row">
            <label>Description:</label>
            <textarea class="input-sync taxon-textarea" data-field="description" rows="3"></textarea>
        </div>
        <div class="taxon-field-row">
            <label>Biology:</label>
            <textarea class="input-sync taxon-textarea" data-field="biology" rows="3"></textarea>
        </div>
        <div class="taxon-field-row">
            <label>Distribution:</label>
            <textarea class="input-sync taxon-textarea" data-field="distribution" rows="2"></textarea>
        </div>
        <div class="taxon-field-row">
            <label>Confusable species (name | how to distinguish, one per line):</label>
            <textarea class="input-sync taxon-textarea" data-field="confusables" rows="3"></textarea>
        </div>
    `;
}

/** Patches a card's fields from a taxon record, skipping any field being edited. */
function syncTaxonCard(card: HTMLElement, taxon: Taxon, displayNum: number) {
    const titleEl = card.querySelector('.taxon-card-title');
    const title = `${displayNum}.`;
    if (titleEl && titleEl.textContent !== title) titleEl.textContent = title;

    syncField(card, 'input[data-field="scientificName"]', taxon.scientificName);
    syncField(card, 'input[data-field="auctor"]', taxon.auctor);
    syncField(card, 'input[data-field="vernacularName"]', taxon.vernacularName);
    syncField(card, 'textarea[data-field="synonyms"]', synonymsToText(taxon.synonyms));
    syncField(card, 'textarea[data-field="description"]', taxon.description);
    syncField(card, 'textarea[data-field="biology"]', taxon.biology);
    syncField(card, 'textarea[data-field="distribution"]', taxon.distribution);
    syncField(card, 'textarea[data-field="confusables"]', confusablesToText(taxon.confusables));
}

export function renderTaxa(store: KeyStore, uiState: UIStateStore) {
    if (uiState.isTaxaHidden) return;

    const container = document.getElementById('taxa-container');
    if (!container) return;

    const taxa = store.getTaxa();
    const selectedIds = store.getSelectedTaxonIds();

    const existingBlocks = Array.from(container.children) as HTMLElement[];
    const existingMap = new Map<number, HTMLElement>();
    existingBlocks.forEach(block => {
        const id = Number(block.getAttribute('data-id'));
        if (!isNaN(id)) existingMap.set(id, block);
    });

    taxa.forEach((taxon, index) => {
        const displayNum = index + 1;
        let block = existingMap.get(taxon.id);

        if (!block) {
            block = document.createElement('div');
            block.className = 'taxon-card';
            block.setAttribute('data-id', taxon.id.toString());
            block.draggable = true;
            block.innerHTML = taxonCardMarkup();
        } else {
            existingMap.delete(taxon.id);
        }

        if (container.children[index] !== block) {
            container.insertBefore(block, container.children[index] || null);
        }

        block.classList.toggle('is-selected', selectedIds.has(taxon.id));
        syncTaxonCard(block, taxon, displayNum);
    });

    existingMap.forEach(block => block.remove());
}