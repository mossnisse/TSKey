// uiRenderer.ts
import type { KeyStore } from './store.ts';
import { escapeHTML, getStepNumberById } from './utils.ts';

// ==========================================
// CORE LAYOUT HELPERS
// ==========================================

/** Helper to target and patch changing attributes safely without dropping cursor focus */
function syncField(parent: HTMLElement, selector: string, value: string, maxAttr?: string) {
    const el = parent.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    if (!el) return;

    if (maxAttr && el.getAttribute('max') !== maxAttr) {
        el.setAttribute('max', maxAttr);
    }
    // Only alter value directly if field is not actively chosen by user text insertion
    if (document.activeElement !== el && el.value !== value) {
        el.value = value;
    }
}

// ==========================================
// RENDERING PIPELINES
// ==========================================

/**
 * Renders the structural core layout app shell. 
 * Should only be fired ONCE during application initialization bootstrap.
 */
export function initializeShell(appDiv: HTMLDivElement) {
    appDiv.innerHTML = `
    <div class="app-shell">
      <div class="sticky-toolbar">
        <button id="cmd-undo" class="btn btn-secondary">↩️ Undo</button>
        <button id="cmd-redo" class="btn btn-secondary">↪️ Redo</button>
        <span class="toolbar-divider"></span>
        
        <button id="cmd-save" class="btn-save">💾 Save Memory</button>
        <button id="cmd-export-json" class="btn btn-secondary">📥 Export JSON</button>
        <button id="cmd-trigger-import" class="btn btn-secondary">📤 Import JSON</button>
        <input type="file" id="file-import-hidden" accept=".json" style="display: none;" />
        
        <span class="toolbar-divider"></span>
        
        <button id="cmd-reorder" class="btn btn-primary">🔄 Auto-Order Couplets</button>
        <button id="cmd-delete-selected" class="btn btn-danger">🗑️ Delete Selected (0)</button>
        <button id="cmd-clear-selection" class="btn btn-outline">Clear Selection</button>
        
        <span class="toolbar-spacer"></span>
        
        <select id="export-format-selector" class="select-input">
          <option value="">-- Export Target Format --</option>
          <option value="text">Plain Text (.txt)</option>
          <option value="html">Structured HTML/CSS</option>
          <option value="latex">Academic LaTeX Document</option>
          <option value="lucid">Lucid Key Exchange Interchange</option>
        </select>
      </div>
    
      <div class="main-layout">
        <div class="editor-column">
          <h2 class="heading-editor">Key Node Canvas</h2>
          <div id="editor-container"></div>
          <button id="add-couplet-btn" class="btn-add-block">+ Add New Step Block</button>
        </div>

        <div class="print-column">
          <h2>Live Publication Render</h2>
          <hr class="hr-print" />
          <div id="print-view-container" class="print-grid"></div>
        </div>
      </div>
    </div>
    `;
}

/**
 * High-Performance Incremental DOM Reconciliation.
 * Updates parameters, positions, and errors safely on existing elements without full teardown sweeps.
 */
export function renderEditorCards(store: KeyStore) {
    const container = document.querySelector('#editor-container');
    if (!container) return;

    const key = store.getKey();
    const selectedIds = store.getSelectedIds();
    const activeDiagnostics = store.runDiagnostics();

    const deleteBtn = document.querySelector('#cmd-delete-selected') as HTMLButtonElement;
    if (deleteBtn) deleteBtn.textContent = `🗑️ Delete Selected (${selectedIds.length})`;

    const idToIndexMap = new Map<number, number>();
    const inboundLinksMap = new Map<number, string[]>();
    const selectedIdsSet = new Set(selectedIds);

    key.forEach((couplet, idx) => {
        idToIndexMap.set(couplet.id, idx);
    });

    key.forEach((searchNode, searchIdx) => {
        if (searchNode.link1) {
            if (!inboundLinksMap.has(searchNode.link1)) inboundLinksMap.set(searchNode.link1, []);
            inboundLinksMap.get(searchNode.link1)!.push(`#${searchIdx + 1}a`);
        }
        if (searchNode.link2) {
            if (!inboundLinksMap.has(searchNode.link2)) inboundLinksMap.set(searchNode.link2, []);
            inboundLinksMap.get(searchNode.link2)!.push(`#${searchIdx + 1}b`);
        }
    });

    const existingCards = Array.from(container.querySelectorAll('.key-card')) as HTMLElement[];
    const existingMap = new Map<number, HTMLElement>();
    existingCards.forEach(card => {
        const id = Number(card.getAttribute('data-id'));
        existingMap.set(id, card);
    });

    key.forEach((couplet, index) => {
        const displayNum = index + 1;
        const isSelected = selectedIdsSet.has(couplet.id);

        const inboundLinks = inboundLinksMap.get(couplet.id) || [];
        const idx1 = couplet.link1 ? idToIndexMap.get(couplet.link1) : undefined;
        const idx2 = couplet.link2 ? idToIndexMap.get(couplet.link2) : undefined;

        const viewLink1 = idx1 !== undefined ? (idx1 + 1).toString() : '';
        const viewLink2 = idx2 !== undefined ? (idx2 + 1).toString() : '';

        const cardErrors = activeDiagnostics.get(couplet.id) || [];
        const hasErrors = cardErrors.some(e => e.severity === 'error');

        const badgeClass = inboundLinks.length ? 'badge badge-linked' : (index === 0 ? 'badge badge-linked' : 'badge badge-isolated');
        const badgeLabel = inboundLinks.length ? `Linked from: ${inboundLinks.map(escapeHTML).join(', ')}` : (index === 0 ? '🏁 Root Node' : '⚠️ Isolated Node');

        let warningInnerHtml = '';
        cardErrors.forEach(err => {
            const modifierClass = err.severity === 'error' ? 'error-text' : 'warning-text';
            warningInnerHtml += `<span class="${modifierClass}">⚠️ ${err.message}</span>`;
        });

        const warningBlockHtml = cardErrors.length > 0
            ? `<div class="warning-block">${warningInnerHtml}</div>`
            : '';

        let card = existingMap.get(couplet.id);
        if (card) {
            existingMap.delete(couplet.id);

            card.className = 'key-card';
            if (isSelected) card.classList.add('is-selected');
            if (hasErrors) card.classList.add('has-errors');

            const titleEl = card.querySelector('.card-title');
            if (titleEl && titleEl.textContent !== `Step #${displayNum}`) {
                titleEl.textContent = `Step #${displayNum}`;
            }

            const badgeEl = card.querySelector('.badge');
            if (badgeEl) {
                badgeEl.className = badgeClass;
                if (badgeEl.textContent !== badgeLabel) badgeEl.textContent = badgeLabel;
            }

            syncField(card, 'textarea[data-field="alt1"]', couplet.alt1);
            syncField(card, 'input[data-field="taxa1"]', couplet.taxa1);
            syncField(card, 'input[data-field="link1"]', viewLink1, key.length.toString());

            syncField(card, 'textarea[data-field="alt2"]', couplet.alt2);
            syncField(card, 'input[data-field="taxa2"]', couplet.taxa2);
            syncField(card, 'input[data-field="link2"]', viewLink2, key.length.toString());

            const currentWarningBlock = card.querySelector('.warning-block');
            if (cardErrors.length > 0) {
                if (currentWarningBlock) {
                    // Direct comparison with no .replace() hacks required
                    if (currentWarningBlock.innerHTML !== warningInnerHtml) {
                        currentWarningBlock.innerHTML = warningInnerHtml;
                    }
                } else {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = warningBlockHtml;
                    card.appendChild(tempDiv.firstElementChild!);
                }
            } else if (currentWarningBlock) {
                currentWarningBlock.remove();
            }

            container.appendChild(card);
        } else {
            card = document.createElement('div');
            card.draggable = true;
            card.setAttribute('data-id', couplet.id.toString());
            card.className = 'key-card';
            if (isSelected) card.classList.add('is-selected');
            if (hasErrors) card.classList.add('has-errors');

            card.innerHTML = `
                <div class="card-header">
                  <div class="card-header-left">
                    <h4 class="card-title">Step #${displayNum}</h4>
                    <span class="${badgeClass}">${badgeLabel}</span>
                  </div>
                  <span class="drag-handle">☰</span>
                </div>
                
                <div class="card-row">
                  <textarea class="input-sync card-textarea" data-field="alt1" placeholder="Enter diagnostic trait details...">${escapeHTML(couplet.alt1)}</textarea>
                  <div class="card-meta-pane">
                    <label class="meta-label">Leads to: 
                      <input type="text" class="input-sync input-taxa" data-field="taxa1" placeholder="Taxon name" value="${escapeHTML(couplet.taxa1)}" />
                    </label>
                    <label class="meta-label">Goto step: 
                      <input type="number" class="input-sync input-goto" data-field="link1" min="1" max="${key.length}" placeholder="#" value="${viewLink1 || ''}" />
                    </label>
                  </div>
                </div>

                <div class="card-row">
                  <textarea class="input-sync card-textarea" data-field="alt2" placeholder="Enter contrast alternative description...">${escapeHTML(couplet.alt2)}</textarea>
                  <div class="card-meta-pane">
                    <label class="meta-label">Leads to: 
                      <input type="text" class="input-sync input-taxa" data-field="taxa2" placeholder="Taxon name" value="${escapeHTML(couplet.taxa2)}" />
                    </label>
                    <label class="meta-label">Goto Step: 
                      <input type="number" class="input-sync input-goto" data-field="link2" min="1" max="${key.length}" placeholder="#" value="${viewLink2 || ''}" />
                    </label>
                  </div>
                </div>
                
                ${warningBlockHtml}
            `;
            container.appendChild(card);
        }
    });

    existingMap.forEach(card => card.remove());
}

/**
 * Renders the passive publication presentation view structure.
 */

/*
export function renderPrintView(store: KeyStore) {
    const container = document.querySelector('#print-view-container');
    if (!container) return;

    const key = store.getKey();
    let htmlContent = '';

    key.forEach((c, index) => {
        const currentDisplayNum = index + 1;
        const step1Dest = getStepNumberById(key, c.link1);
        const step2Dest = getStepNumberById(key, c.link2);

        const end1 = c.taxa1 ? `<strong class="print-dest-taxon">${escapeHTML(c.taxa1)}</strong>` : (c.link1 ? `<strong class="print-dest-strong">${step1Dest}</strong>` : '<span>...</span>');
        const end2 = c.taxa2 ? `<strong class="print-dest-taxon">${escapeHTML(c.taxa2)}</strong>` : (c.link2 ? `<strong class="print-dest-strong">${step2Dest}</strong>` : '<span>...</span>');

        htmlContent += `
            <div class="print-step-num">${currentDisplayNum}.</div>
            <div class="print-row">
              <span class="print-text">${escapeHTML(c.alt1) || '___'}</span>
              <span class="print-dots"></span>
              <span class="print-dest">${end1}</span>
            </div>
            <div class="print-dash">—</div>
            <div class="print-row">
              <span class="print-text">${escapeHTML(c.alt2) || '___'}</span>
              <span class="print-dots"></span>
              <span class="print-dest">${end2}</span>
            </div>
            <div class="print-spacer"></div>
        `;
    });

    container.innerHTML = htmlContent;
}*/

export function renderPrintView(store: KeyStore) {
    const container = document.querySelector('#print-view-container');
    if (!container) return;

    const key = store.getKey();

    // Map existing DOM blocks currently residing on the preview canvas
    const existingBlocks = Array.from(container.querySelectorAll('.print-step-block')) as HTMLElement[];
    const existingMap = new Map<number, HTMLElement>();
    existingBlocks.forEach(block => {
        const id = Number(block.getAttribute('data-id'));
        existingMap.set(id, block);
    });

    // Reconcile or build blocks based on current KeyStore sequence state
    key.forEach((c, index) => {
        const currentDisplayNum = index + 1;
        const step1Dest = getStepNumberById(key, c.link1);
        const step2Dest = getStepNumberById(key, c.link2);

        const end1 = c.taxa1
            ? `<strong class="print-dest-taxon">${escapeHTML(c.taxa1)}</strong>`
            : (c.link1 ? `<strong class="print-dest-strong">${step1Dest}</strong>` : '<span>...</span>');

        const end2 = c.taxa2
            ? `<strong class="print-dest-taxon">${escapeHTML(c.taxa2)}</strong>`
            : (c.link2 ? `<strong class="print-dest-strong">${step2Dest}</strong>` : '<span>...</span>');

        const val1 = escapeHTML(c.alt1) || '___';
        const val2 = escapeHTML(c.alt2) || '___';

        let block = existingMap.get(c.id);

        if (block) {
            // Element exists: pull from map to protect it from deletion sweep
            existingMap.delete(c.id);

            // 1. Sync Step Index Label
            const stepNumEl = block.querySelector('.print-step-num');
            if (stepNumEl && stepNumEl.textContent !== `${currentDisplayNum}.`) {
                stepNumEl.textContent = `${currentDisplayNum}.`;
            }

            // 2. Sync Choice A Text and Destination
            const txt1 = block.querySelector('.print-row[data-choice="1"] .print-text');
            if (txt1 && txt1.textContent !== val1) txt1.textContent = val1;

            const dest1 = block.querySelector('.print-row[data-choice="1"] .print-dest');
            if (dest1 && dest1.innerHTML !== end1) dest1.innerHTML = end1;

            // 3. Sync Choice B Text and Destination
            const txt2 = block.querySelector('.print-row[data-choice="2"] .print-text');
            if (txt2 && txt2.textContent !== val2) txt2.textContent = val2;

            const dest2 = block.querySelector('.print-row[data-choice="2"] .print-dest');
            if (dest2 && dest2.innerHTML !== end2) dest2.innerHTML = end2;

            // Re-append existing block to update position order instantly 
            container.appendChild(block);

        } else {
            // Element does not exist: perform isolated node construction
            block = document.createElement('div');
            block.className = 'print-step-block';
            block.setAttribute('data-id', c.id.toString());

            // 💡 CRITICAL: display: contents shields this element from grid metrics calculations, 
            // forcing children to cleanly drop directly into the root .print-grid alignment engine.
            block.style.display = 'contents';

            block.innerHTML = `
                <div class="print-step-num">${currentDisplayNum}.</div>
                <div class="print-row" data-choice="1">
                  <span class="print-text">${val1}</span>
                  <span class="print-dots"></span>
                  <span class="print-dest">${end1}</span>
                </div>
                <div class="print-dash">—</div>
                <div class="print-row" data-choice="2">
                  <span class="print-text">${val2}</span>
                  <span class="print-dots"></span>
                  <span class="print-dest">${end2}</span>
                </div>
                <div class="print-spacer"></div>
            `;
            container.appendChild(block);
        }
    });

    // Cleanup: Remove step nodes that are no longer part of active state configurations
    existingMap.forEach(block => block.remove());
}

/**
 * Spawns an asynchronous, non-blocking notification banner.
 */
export function showToast(message: string, type: 'success' | 'error' = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Completely clean up the DOM node after its fade-out animation finishes
    setTimeout(() => {
        toast.remove();
        if (container && container.childElementCount === 0) {
            container.remove();
        }
    }, 3000);
}