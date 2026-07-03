// ui/editorCards.ts
// Renders the key-editor cards via the shared reconciler: create() builds a card
// skeleton and update() patches titles, badges (with Ctrl-click parent links), field
// values, the link-highlight classes, and diagnostics — without tearing down focused
// fields.
import type { KeyStore, Couplet } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { escapeHTML, buildIdToIndexMap, resolveDestination, branchTarget, buildTaxaContext } from '../utils.ts';
import { syncField, reconcileCards } from './shared.ts';
import { mountRichTextField, syncRichTextField, destroyRichTextFieldsIn, figureFieldSchema } from './richTextField.ts';
import { commitCoupletField } from '../events/coupletEvents.ts';

const ALT_PLACEHOLDER: Record<'alt1' | 'alt2', string> = {
    alt1: 'Enter diagnostic trait details [fig: 1]...',
    alt2: 'Enter contrast alternative description...',
};

/** Mounts the alt1/alt2 rich-text editors on a fresh card, wiring each to the store. */
function mountCoupletEditors(card: HTMLElement, couplet: Couplet, store: KeyStore, uiState: UIStateStore, refreshAll: () => void) {
    (['alt1', 'alt2'] as const).forEach(field => {
        const host = card.querySelector(`.rte-host[data-field="${field}"]`) as HTMLElement | null;
        if (!host) return;
        mountRichTextField(host, {
            schema: figureFieldSchema(store),
            value: store.decodeTextReferencesForEditor(couplet[field]),
            placeholder: ALT_PLACEHOLDER[field],
            onChange: v => commitCoupletField(store, uiState, refreshAll, couplet.id, field, v),
        });
    });
}

/** Shows the inline create-taxon buttons only when that lead is an unlinked draft. */
function syncCreateTaxonBtn(card: HTMLElement, field: 'dest1' | 'dest2', isUnlinkedTaxon?: boolean) {
    const group = card.querySelector(`.create-taxon-group[data-for="${field}"]`) as HTMLElement | null;
    if (group) group.hidden = !isUnlinkedTaxon;
}

/** The pair of "create taxon with this name" buttons shown under an unlinked lead. */
function createTaxonButtons(field: 'dest1' | 'dest2'): string {
    return `
        <div class="create-taxon-group" data-for="${field}" hidden>
          <button type="button" class="btn-create-taxon" data-for="${field}" data-name-field="scientific" title="Create a taxon card with this scientific name">＋ scientific name</button>
          <button type="button" class="btn-create-taxon" data-for="${field}" data-name-field="vernacular" title="Create a taxon card with this vernacular name">＋ vernacular name</button>
        </div>`;
}

/** Static card skeleton; all dynamic values are filled in by the update pass. */
function createCard(couplet: Couplet): HTMLElement {
    const card = document.createElement('div');
    card.className = 'key-card';
    card.draggable = true;
    card.setAttribute('data-id', couplet.id.toString());
    card.innerHTML = `
        <div class="card-header">
          <div class="card-header-left">
            <h4 class="card-title"></h4>
            <span class="badge"></span>
          </div>
          <span class="drag-handle">☰</span>
        </div>
        <div class="card-row">
          <div class="rte-host card-rte" data-field="alt1"></div>
          <div class="card-meta-pane">
            <label class="meta-label">→
              <input type="text" class="input-sync input-destination" data-field="dest1" placeholder="Taxon or Step #" />
            </label>
            ${createTaxonButtons('dest1')}
          </div>
        </div>
        <div class="card-row">
          <div class="rte-host card-rte" data-field="alt2"></div>
          <div class="card-meta-pane">
            <label class="meta-label">→
              <input type="text" class="input-sync input-destination" data-field="dest2" placeholder="Taxon or Step #" />
            </label>
            ${createTaxonButtons('dest2')}
          </div>
        </div>
    `;
    return card;
}

/**
 * High-Performance Incremental DOM Reconciliation.
 * Updates parameters, positions, and errors safely on existing elements without full teardown sweeps.
 */
export function renderEditorCards(store: KeyStore, uiState: UIStateStore, refreshAll: () => void) {
    const container = document.getElementById('editor-container');
    if (!container) return;

    const key = store.getKey();
    const selectedIds = store.getSelectedCoupletIds();
    const activeDiagnostics = store.runDiagnostics();

    const idToIndexMap = buildIdToIndexMap(key);
    const inboundLinksMap = store.generateInboundLinksMap();
    // A linked lead shows the taxon name for the current display setting; typing
    // either name re-links, so the editable round-trip still works.
    const taxaCtx = buildTaxaContext(store.getTaxa(), uiState.nameDisplayMode);

    // Link highlighting: the "focus step" is the single selected card, or — when
    // nothing is selected — the step being edited. Multi-select is ambiguous → none.
    const focusId = selectedIds.size === 1
        ? [...selectedIds][0]
        : selectedIds.size === 0 ? store.getActiveCoupletId() : null;
    const linkOutIds = new Set<number>(); // steps the focus step links TO
    const linkInIds = new Set<number>();  // steps that link TO the focus step
    if (focusId !== null) {
        const focusCouplet = key.find(c => c.id === focusId);
        if (focusCouplet) {
            const t1 = branchTarget(focusCouplet.branch1);
            if (t1 !== null) linkOutIds.add(t1);
            const t2 = branchTarget(focusCouplet.branch2);
            if (t2 !== null) linkOutIds.add(t2);
        }
        key.forEach(c => {
            if (branchTarget(c.branch1) === focusId || branchTarget(c.branch2) === focusId) {
                linkInIds.add(c.id);
            }
        });
    }

    const updateCard = (card: HTMLElement, couplet: Couplet, index: number) => {
        const displayNum = index + 1;
        const inboundLinks = inboundLinksMap.get(couplet.id) || [];
        const dest1 = resolveDestination(couplet.branch1, idToIndexMap, taxaCtx);
        const dest2 = resolveDestination(couplet.branch2, idToIndexMap, taxaCtx);
        const cardErrors = activeDiagnostics.get(couplet.id) || [];
        const computedTitle = `${displayNum}.`;
        const badgeClass = inboundLinks.length ? 'badge badge-linked' : (index === 0 ? 'badge badge-linked' : 'badge badge-isolated');
        const badgeHtml = inboundLinks.length
            ? `← ${inboundLinks.map(label => {
                const parentId = key[parseInt(label, 10) - 1]?.id;
                return parentId !== undefined
                    ? `<span class="badge-link" data-step-id="${parentId}">${escapeHTML(label)}</span>`
                    : escapeHTML(label);
            }).join(', ')}`
            : (index === 0 ? '🏁 root' : '⚠️ isolated');

        let warningInnerHtml = '';
        cardErrors.forEach(err => {
            const modifierClass = err.severity === 'error' ? 'error-text' : 'warning-text';
            warningInnerHtml += `<div class="${modifierClass}">⚠️ ${escapeHTML(err.message)}</div>`;
        });

        card.classList.toggle('is-selected', selectedIds.has(couplet.id));
        card.classList.toggle('is-link-out', couplet.id !== focusId && linkOutIds.has(couplet.id));
        card.classList.toggle('is-link-in', couplet.id !== focusId && linkInIds.has(couplet.id));

        const titleEl = card.querySelector('.card-title');
        if (titleEl && titleEl.textContent !== computedTitle) titleEl.textContent = computedTitle;

        const badgeEl = card.querySelector('.badge');
        if (badgeEl) {
            if (badgeEl.className !== badgeClass) badgeEl.className = badgeClass;
            if (badgeEl.innerHTML !== badgeHtml) badgeEl.innerHTML = badgeHtml;
        }

        const alt1Host = card.querySelector('.rte-host[data-field="alt1"]') as HTMLElement | null;
        if (alt1Host) syncRichTextField(alt1Host, store.decodeTextReferencesForEditor(couplet.alt1));
        const dest1El = syncField(card, 'input[data-field="dest1"]', dest1.inputValue);
        dest1El?.classList.toggle('input-error', dest1.isUnresolved);
        dest1El?.classList.toggle('input-taxon-unlinked', !!dest1.isUnlinkedTaxon);
        syncCreateTaxonBtn(card, 'dest1', dest1.isUnlinkedTaxon);

        const alt2Host = card.querySelector('.rte-host[data-field="alt2"]') as HTMLElement | null;
        if (alt2Host) syncRichTextField(alt2Host, store.decodeTextReferencesForEditor(couplet.alt2));
        const dest2El = syncField(card, 'input[data-field="dest2"]', dest2.inputValue);
        dest2El?.classList.toggle('input-error', dest2.isUnresolved);
        dest2El?.classList.toggle('input-taxon-unlinked', !!dest2.isUnlinkedTaxon);
        syncCreateTaxonBtn(card, 'dest2', dest2.isUnlinkedTaxon);

        const currentWarningBlock = card.querySelector('.warning-block');
        if (cardErrors.length > 0) {
            if (currentWarningBlock) {
                if (currentWarningBlock.innerHTML !== warningInnerHtml) currentWarningBlock.innerHTML = warningInnerHtml;
            } else {
                card.insertAdjacentHTML('beforeend', `<div class="warning-block">${warningInnerHtml}</div>`);
            }
        } else if (currentWarningBlock) {
            currentWarningBlock.remove();
        }
    };

    reconcileCards<Couplet>({
        container,
        items: key,
        getId: c => c.id,
        create: couplet => {
            const card = createCard(couplet);
            mountCoupletEditors(card, couplet, store, uiState, refreshAll);
            return card;
        },
        update: updateCard,
        onRemove: destroyRichTextFieldsIn,
    });
}
