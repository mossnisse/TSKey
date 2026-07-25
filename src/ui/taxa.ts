// ui/taxa.ts
// Incremental reconciler for the Taxa panel — one editable "chapter" card per taxon
// record, mirroring the figure-panel reconciler. Multi-line fields (synonyms,
// confusables) are serialized to text here; events/taxaEvents.ts parses them back.
import type { KeyStore, Taxon, ConfusableSpecies } from '../store';
import { referencedTaxonIds, taxonMatchesQuery } from '../store';
import type { UIStateStore } from '../uiState.ts';
import type { NameDisplayMode } from '../utils.ts';
import { displayTaxonName } from '../utils.ts';
import { syncField, reconcileCards } from './shared.ts';
import { mountRichTextField, syncRichTextField, destroyRichTextFieldsIn, figureFieldSchema, getFieldEditor } from './richTextField.ts';
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
            <button type="button" class="taxon-disclosure" aria-expanded="false" aria-label="Show taxon details">
                <span class="taxon-caret" aria-hidden="true">▾</span>
            </button>
            <span class="taxon-card-title"></span>
            <span class="taxon-roster-name">
                <span class="taxon-roster-primary"></span>
                <span class="taxon-roster-secondary"></span>
            </span>
            <span class="taxon-flags"></span>
        </div>
        <div class="taxon-card-body">
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
        </div>
    `;
}

/** The two names shown on a collapsed roster row: the display-mode name first, the
 *  other one muted after it. `primaryIsScientific` drives the italics. */
interface RosterLabel {
    primary: string;
    secondary: string;
    primaryIsScientific: boolean;
}

function rosterLabel(taxon: Taxon, mode: NameDisplayMode): RosterLabel {
    const sci = taxon.scientificName.trim();
    const ver = taxon.vernacularName.trim();
    // displayTaxonName falls back to the other name, so a taxon with only one of the
    // two still leads with a real label — and the fallback decides the italics.
    const primary = displayTaxonName(taxon, mode);
    const primaryIsScientific = primary !== '' && primary === sci;
    const other = primaryIsScientific ? ver : sci;
    return { primary, secondary: other === primary ? '' : other, primaryIsScientific };
}

/**
 * Status flags for a roster row. Only *gaps* get a dot — a clean row stays clean, so
 * problems pop out of a long list instead of being lost among "everything is fine"
 * markers.
 */
function flagsHtml(taxon: Taxon, isUnused: boolean): string {
    let html = '';
    if (isUnused) {
        html += `<span class="taxon-flag is-unused" role="img" title="Not referenced by any key step"`
            + ` aria-label="Not referenced by any key step"></span>`;
    }
    if (taxon.description.trim() === '') {
        html += `<span class="taxon-flag is-undescribed" role="img" title="No description written yet"`
            + ` aria-label="No description written yet"></span>`;
    }
    return html;
}

/** Everything a card needs that isn't on the taxon record itself. */
interface TaxonCardContext {
    displayNum: number;
    mode: NameDisplayMode;
    isUnused: boolean;
    store: KeyStore;
}

/** Patches a card's roster row and fields from a taxon record, skipping any field
 *  being edited. */
function syncTaxonCard(card: HTMLElement, taxon: Taxon, ctx: TaxonCardContext) {
    const { displayNum, mode, isUnused, store } = ctx;

    const titleEl = card.querySelector('.taxon-card-title');
    const title = `${displayNum}.`;
    if (titleEl && titleEl.textContent !== title) titleEl.textContent = title;

    const label = rosterLabel(taxon, mode);
    const primaryEl = card.querySelector('.taxon-roster-primary') as HTMLElement | null;
    if (primaryEl) {
        // A brand-new taxon has no name yet, but its row still needs to be findable.
        const text = label.primary || 'Unnamed taxon';
        if (primaryEl.textContent !== text) primaryEl.textContent = text;
        primaryEl.classList.toggle('is-scientific', label.primaryIsScientific);
        primaryEl.classList.toggle('is-unnamed', label.primary === '');
    }
    const secondaryEl = card.querySelector('.taxon-roster-secondary') as HTMLElement | null;
    if (secondaryEl) {
        if (secondaryEl.textContent !== label.secondary) secondaryEl.textContent = label.secondary;
        // When the roster leads with the vernacular, the trailing name is the binomial.
        secondaryEl.classList.toggle('is-scientific', !label.primaryIsScientific && label.secondary !== '');
    }

    const flagsEl = card.querySelector('.taxon-flags') as HTMLElement | null;
    const flags = flagsHtml(taxon, isUnused);
    if (flagsEl && flagsEl.innerHTML !== flags) flagsEl.innerHTML = flags;

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

function createTaxonCard(taxon: Taxon, mode: NameDisplayMode): HTMLElement {
    const block = document.createElement('div');
    block.className = 'taxon-card is-collapsed';
    block.setAttribute('data-id', taxon.id.toString());
    block.draggable = true;
    block.innerHTML = taxonCardMarkup(mode);
    return block;
}

/**
 * Mounts the description editor the first time its card is expanded, and leaves it
 * mounted afterwards. A collapsed card never pays for a RichTextEditor instance, so
 * the cost of a large roster tracks the taxa actually opened rather than the taxa
 * that exist — the part that folding alone would not have fixed.
 */
function ensureDescriptionEditor(
    block: HTMLElement,
    taxon: Taxon,
    store: KeyStore,
    uiState: UIStateStore,
    refreshAll: () => void,
): void {
    const descHost = block.querySelector('.rte-host[data-field="description"]') as HTMLElement | null;
    if (!descHost || getFieldEditor(descHost)) return;

    mountRichTextField(descHost, {
        schema: figureFieldSchema(store),
        value: store.decodeTextReferencesForEditor(taxon.description),
        placeholder: 'Diagnostic description — supports **bold**, *italic*, and [fig: 1]…',
        onChange: v => commitTaxonRichField(store, uiState, refreshAll, taxon.id, 'description', v),
    });
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
    const allTaxa = store.getTaxa();
    const usedIds = referencedTaxonIds(store.getKey());

    // Numbering follows each record's real position in the collection, so filtering
    // the roster never renumbers the taxa behind it.
    const displayNums = new Map(allTaxa.map((t, i) => [t.id, i + 1]));

    const query = uiState.taxaFilterQuery;
    const isFiltering = query.trim() !== '';
    const filterInput = document.getElementById('taxa-filter') as HTMLInputElement | null;
    if (filterInput && filterInput.value !== query) filterInput.value = query;

    const visible = isFiltering ? allTaxa.filter(t => taxonMatchesQuery(t, query)) : allTaxa;

    reconcileCards<Taxon>({
        container,
        items: visible,
        getId: t => t.id,
        create: taxon => createTaxonCard(taxon, mode),
        update: (block, taxon) => {
            const expanded = uiState.isTaxonExpanded(taxon.id);
            block.classList.toggle('is-collapsed', !expanded);
            const toggle = block.querySelector('.taxon-disclosure');
            if (toggle) {
                toggle.setAttribute('aria-expanded', String(expanded));
                toggle.setAttribute('aria-label', expanded ? 'Hide taxon details' : 'Show taxon details');
            }
            if (expanded) ensureDescriptionEditor(block, taxon, store, uiState, refreshAll);

            block.classList.toggle('is-selected', selectedIds.has(taxon.id));
            syncTaxonCard(block, taxon, {
                displayNum: displayNums.get(taxon.id) ?? 0,
                mode,
                isUnused: !usedIds.has(taxon.id),
                store,
            });
        },
        onRemove: destroyRichTextFieldsIn,
    });

    // Filtering hides records rather than deleting them — say so, or a shrunken list
    // reads as data loss.
    const countEl = document.getElementById('taxa-filter-count');
    if (countEl) {
        const text = isFiltering ? `${visible.length} of ${allTaxa.length}` : '';
        if (countEl.textContent !== text) countEl.textContent = text;
    }
    document.getElementById('taxa-empty-notice')
        ?.classList.toggle('is-hidden', !(isFiltering && visible.length === 0));
}
