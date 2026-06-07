// uiRenderer.ts
import type { KeyStore } from './store.ts';
import { escapeHTML, getStepNumberById, buildIdToIndexMap } from './utils.ts';

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

    const idToIndexMap = buildIdToIndexMap(key);
    const inboundLinksMap = store.generateInboundLinksMap();

    const existingCards = Array.from(container.querySelectorAll('.key-card')) as HTMLElement[];
    const existingMap = new Map<number, HTMLElement>();
    existingCards.forEach(card => {
        const id = Number(card.getAttribute('data-id'));
        existingMap.set(id, card);
    });

    key.forEach((couplet, index) => {
        const displayNum = index + 1;
        const isSelected = selectedIds.has(couplet.id);
        //const cardClass = isSelected ? 'editor-card is-selected' : 'editor-card';

        const inboundLinks = inboundLinksMap.get(couplet.id) || [];
        const idx1 = couplet.link1 ? idToIndexMap.get(couplet.link1) : undefined;
        const idx2 = couplet.link2 ? idToIndexMap.get(couplet.link2) : undefined;

        const viewLink1 = idx1 !== undefined ? (idx1 + 1).toString() : '';
        const viewLink2 = idx2 !== undefined ? (idx2 + 1).toString() : '';

        const cardErrors = activeDiagnostics.get(couplet.id) || [];
        const hasErrors = cardErrors.some(e => e.severity === 'error');

        // Centralized UI text bindings to prevent DOM reconciler mismatches
        const computedTitle = `${displayNum}.`;
        const badgeClass = inboundLinks.length ? 'badge badge-linked' : (index === 0 ? 'badge badge-linked' : 'badge badge-isolated');
        const badgeLabel = inboundLinks.length ? `← ${inboundLinks.join(', ')}` : (index === 0 ? '🏁 root' : '⚠️ isolated');

        let warningInnerHtml = '';
        cardErrors.forEach(err => {
            const modifierClass = err.severity === 'error' ? 'error-text' : 'warning-text';
            warningInnerHtml += `<span class="${modifierClass}">⚠️ ${err.message}</span>`;
        });

        const warningBlockHtml = cardErrors.length > 0 ? `<div class="warning-block">${warningInnerHtml}</div>` : '';

        let card = existingMap.get(couplet.id);
        if (card) {
            existingMap.delete(couplet.id);

            card.classList.toggle('is-selected', isSelected);
            card.classList.toggle('has-errors', hasErrors);

            // Flawless reconciliation matching via variables
            const titleEl = card.querySelector('.card-title');
            if (titleEl && titleEl.textContent !== computedTitle) {
                titleEl.textContent = computedTitle;
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
                    if (currentWarningBlock.innerHTML !== warningInnerHtml) currentWarningBlock.innerHTML = warningInnerHtml;
                } else {
                    card.insertAdjacentHTML('beforeend', warningBlockHtml);
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
                    <h4 class="card-title">${computedTitle}</h4>
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

export function renderPrintView(store: KeyStore) {
    const container = document.querySelector('#print-view-container');
    if (!container) return;

    const key = store.getKey();
    const idToIndexMap = buildIdToIndexMap(key);

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
        const step1Dest = getStepNumberById(idToIndexMap, c.link1);
        const step2Dest = getStepNumberById(idToIndexMap, c.link2);

        // Compute styling metadata instead of storing HTML markup raw strings
        const dest1Info = c.taxa1
            ? { text: c.taxa1, className: 'print-dest-taxon' }
            : (c.link1 ? { text: step1Dest, className: 'print-dest-strong' } : { text: '...', className: '' });

        const dest2Info = c.taxa2
            ? { text: c.taxa2, className: 'print-dest-taxon' }
            : (c.link2 ? { text: step2Dest, className: 'print-dest-strong' } : { text: '...', className: '' });

        const val1 = c.alt1 || '___';
        const val2 = c.alt2 || '___';

        let block = existingMap.get(c.id);

        if (block) {
            // Element exists: pull from map to protect it from deletion sweep
            existingMap.delete(c.id);

            // Sync Step Index Label
            const stepNumEl = block.querySelector('.print-step-num');
            if (stepNumEl && stepNumEl.textContent !== `${currentDisplayNum}.`) {
                stepNumEl.textContent = `${currentDisplayNum}.`;
            }

            // Sync Choice A Text
            const txt1 = block.querySelector('.print-row[data-choice="1"] .print-text');
            if (txt1 && txt1.textContent !== val1) txt1.textContent = val1;

            // Safe, consistent updates for Destination A
            const dest1 = block.querySelector('.print-row[data-choice="1"] .print-dest');
            if (dest1) {
                if (dest1.textContent !== dest1Info.text) dest1.textContent = dest1Info.text;
                if (dest1.className !== `print-dest ${dest1Info.className}`.trim()) {
                    dest1.className = `print-dest ${dest1Info.className}`.trim();
                }
            }

            // Sync Choice B Text
            const txt2 = block.querySelector('.print-row[data-choice="2"] .print-text');
            if (txt2 && txt2.textContent !== val2) txt2.textContent = val2;

            // Safe, consistent updates for Destination B
            const dest2 = block.querySelector('.print-row[data-choice="2"] .print-dest');
            if (dest2) {
                if (dest2.textContent !== dest2Info.text) dest2.textContent = dest2Info.text;
                if (dest2.className !== `print-dest ${dest2Info.className}`.trim()) {
                    dest2.className = `print-dest ${dest2Info.className}`.trim();
                }
            }

            // Re-append existing block to update position order instantly 
            container.appendChild(block);

        } else {
            // Element does not exist: perform isolated node construction
            block = document.createElement('div');
            block.className = 'print-step-block';
            block.setAttribute('data-id', c.id.toString());
            block.style.display = 'contents';

            // Initial building template. No user variables are injected via innerHTML template strings.
            // This isolates structural configuration setup away from dynamic mutation strings.
            block.innerHTML = `
                <div class="print-step-num"></div>
                <div class="print-row" data-choice="1">
                  <span class="print-text"></span>
                  <span class="print-dots"></span>
                  <span class="print-dest"></span>
                </div>
                <div class="print-dash">—</div>
                <div class="print-row" data-choice="2">
                  <span class="print-text"></span>
                  <span class="print-dots"></span>
                  <span class="print-dest"></span>
                </div>
                <div class="print-spacer"></div>
            `;

            // Natively assign text and classes using strict DOM mutations
            block.querySelector('.print-step-num')!.textContent = `${currentDisplayNum}.`;

            block.querySelector('.print-row[data-choice="1"] .print-text')!.textContent = val1;
            const dest1 = block.querySelector('.print-row[data-choice="1"] .print-dest')!;
            dest1.textContent = dest1Info.text;
            if (dest1Info.className) dest1.classList.add(dest1Info.className);

            block.querySelector('.print-row[data-choice="2"] .print-text')!.textContent = val2;
            const dest2 = block.querySelector('.print-row[data-choice="2"] .print-dest')!;
            dest2.textContent = dest2Info.text;
            if (dest2Info.className) dest2.classList.add(dest2Info.className);

            container.appendChild(block);
        }
    });

    existingMap.forEach(block => block.remove());
}

/**
 * Spawns an asynchronous, non-blocking notification banner.
 */
export function showToast(message: string, type: 'success' | 'error' = 'success') {
    let container = document.querySelector('.toast-container') as HTMLDivElement;

    // If the wrapper container doesn't exist, build it and register the live region defaults
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';

        // 'aria-live="polite"' acts as a safe catch-all wrapper context
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');

        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Assign semantic ARIA alert states based on the priority of the notification
    if (type === 'error') {
        // Errors require an assertive interruption profile
        toast.setAttribute('role', 'alert');
    } else {
        // Success states use standard status messaging profiles
        toast.setAttribute('role', 'status');
    }

    container.appendChild(toast);

    // Completely clean up the DOM node after its fade-out animation finishes
    setTimeout(() => {
        toast.remove();
        if (container && container.childElementCount === 0) {
            container.remove();
        }
    }, 3000);
}