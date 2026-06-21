// ui/editorCards.ts
// Incremental reconciler for the key-editor cards: patches titles, badges (with
// Ctrl-click parent links), field values, the link-highlight classes, and diagnostics
// without tearing down focused fields.
import type { KeyStore } from '../store.ts';
import { escapeHTML, buildIdToIndexMap, resolveDestination, branchTarget } from '../utils.ts';
import { syncField } from './shared.ts';

/**
 * High-Performance Incremental DOM Reconciliation.
 * Updates parameters, positions, and errors safely on existing elements without full teardown sweeps.
 */
export function renderEditorCards(store: KeyStore) {
    const container = document.getElementById('editor-container');
    if (!container) return;

    const key = store.getKey();
    const selectedIds = store.getSelectedCoupletIds();
    const activeDiagnostics = store.runDiagnostics();

    const idToIndexMap = buildIdToIndexMap(key);
    const inboundLinksMap = store.generateInboundLinksMap();

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

    const existingCards = Array.from(container.querySelectorAll('.key-card')) as HTMLElement[];
    const existingMap = new Map<number, HTMLElement>();

    existingCards.forEach(card => {
        const idAttr = card.getAttribute('data-id');
        if (idAttr) existingMap.set(Number(idAttr), card);
    });

    key.forEach((couplet, index) => {
        const displayNum = index + 1;
        const isSelected = selectedIds.has(couplet.id);
        const inboundLinks = inboundLinksMap.get(couplet.id) || [];
        const dest1 = resolveDestination(couplet.branch1, idToIndexMap);
        const dest2 = resolveDestination(couplet.branch2, idToIndexMap);
        const cardErrors = activeDiagnostics.get(couplet.id) || [];
        const computedTitle = `${displayNum}.`;
        const badgeClass = inboundLinks.length ? 'badge badge-linked' : (index === 0 ? 'badge badge-linked' : 'badge badge-isolated');
        // Each inbound label ("1b") becomes a Ctrl/Cmd+click target back to that parent
        // step. The label's leading number is the parent's 1-based step number.
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
        const warningBlockHtml = cardErrors.length > 0 ? `<div class="warning-block">${warningInnerHtml}</div>` : '';

        const isLinkOut = couplet.id !== focusId && linkOutIds.has(couplet.id);
        const isLinkIn = couplet.id !== focusId && linkInIds.has(couplet.id);

        let card = existingMap.get(couplet.id);
        if (card) {
            existingMap.delete(couplet.id);
            card.classList.toggle('is-selected', isSelected);
            card.classList.toggle('is-link-out', isLinkOut);
            card.classList.toggle('is-link-in', isLinkIn);

            const titleEl = card.querySelector('.card-title');
            if (titleEl && titleEl.textContent !== computedTitle) titleEl.textContent = computedTitle;

            const badgeEl = card.querySelector('.badge');
            if (badgeEl) {
                badgeEl.className = badgeClass;
                if (badgeEl.innerHTML !== badgeHtml) badgeEl.innerHTML = badgeHtml;
            }

            syncField(card, 'textarea[data-field="alt1"]', store.decodeTextReferencesForEditor(couplet.alt1));
            const dest1El = syncField(card, 'input[data-field="dest1"]', dest1.inputValue);
            dest1El?.classList.toggle('input-error', dest1.isUnresolved);

            syncField(card, 'textarea[data-field="alt2"]', store.decodeTextReferencesForEditor(couplet.alt2));
            const dest2El = syncField(card, 'input[data-field="dest2"]', dest2.inputValue);
            dest2El?.classList.toggle('input-error', dest2.isUnresolved);

            const currentWarningBlock = card.querySelector('.warning-block');
            if (cardErrors.length > 0) {
                if (currentWarningBlock) {
                    if (currentWarningBlock.innerHTML !== warningInnerHtml) currentWarningBlock.innerHTML = warningInnerHtml;
                } else {
                    card.insertAdjacentHTML('beforeend', warningBlockHtml);
                }
            } else if (currentWarningBlock) {
                currentWarningBlock.remove();
            }

            if (container.children[index] !== card) {
                container.insertBefore(card, container.children[index] || null);
            }
        } else {
            card = document.createElement('div');
            card.draggable = true;
            card.setAttribute('data-id', couplet.id.toString());
            card.className = 'key-card';
            if (isSelected) card.classList.add('is-selected');
            if (isLinkOut) card.classList.add('is-link-out');
            if (isLinkIn) card.classList.add('is-link-in');

            card.innerHTML = `
                <div class="card-header">
                  <div class="card-header-left">
                    <h4 class="card-title">${computedTitle}</h4>
                    <span class="${badgeClass}">${badgeHtml}</span>
                  </div>
                  <span class="drag-handle">☰</span>
                </div>
                <div class="card-row">
                  <textarea class="input-sync card-textarea" data-field="alt1" placeholder="Enter diagnostic trait details [fig: 1]...">${escapeHTML(store.decodeTextReferencesForEditor(couplet.alt1))}</textarea>
                  <div class="card-meta-pane">
                    <label class="meta-label">→
                      <input type="text" class="input-sync input-destination ${dest1.isUnresolved ? 'input-error' : ''}" data-field="dest1" placeholder="Taxon or Step #" value="${escapeHTML(dest1.inputValue)}" />
                    </label>
                  </div>
                </div>
                <div class="card-row">
                  <textarea class="input-sync card-textarea" data-field="alt2" placeholder="Enter contrast alternative description...">${escapeHTML(store.decodeTextReferencesForEditor(couplet.alt2))}</textarea>
                  <div class="card-meta-pane">
                    <label class="meta-label">→
                      <input type="text" class="input-sync input-destination ${dest2.isUnresolved ? 'input-error' : ''}" data-field="dest2" placeholder="Taxon or Step #" value="${escapeHTML(dest2.inputValue)}" />
                    </label>
                  </div>
                </div>
                ${warningBlockHtml}
            `;
            container.insertBefore(card, container.children[index] || null);
        }
    });

    existingMap.forEach(card => card.remove());
}