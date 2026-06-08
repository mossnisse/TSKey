// uiRenderer.ts
import type { KeyStore } from './store.ts';
import { escapeHTML, buildIdToIndexMap, isUnresolvedLink, IS_MAC } from './utils.ts';

// ==========================================
// CORE LAYOUT HELPERS
// ==========================================

/** Helper to target and patch changing attributes safely without dropping cursor focus */
function syncField(parent: HTMLElement, selector: string, value: string, forceUpdate = false): HTMLInputElement | HTMLTextAreaElement | null {
    const el = parent.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    if (!el) return null;

    // Guard focus state so typing isn't interrupted during incremental DOM loops
    if ((forceUpdate || document.activeElement !== el) && el.value !== value) {
        el.value = value;
    }
    return el;
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
        <button id="cmd-undo" class="btn btn-secondary">↩️ Undo (${IS_MAC ? '⌘Z' : 'Ctrl+Z'})</button>
        <button id="cmd-redo" class="btn btn-secondary">↪️ Redo (${IS_MAC ? '⌘Y' : 'Ctrl+Y'})</button>
        <span class="toolbar-divider"></span>
        
        <button id="cmd-save" class="btn-save">💾 Save Memory (${IS_MAC ? '⌘S' : 'Ctrl+S'})</button>
        <button id="cmd-export-json" class="btn btn-secondary">📥 Export JSON</button>
        <button id="cmd-trigger-import" class="btn btn-secondary">📤 Import JSON</button>
        <input type="file" id="file-import-hidden" accept=".json" style="display: none;" />
        
        <span class="toolbar-divider"></span>
        
        <button id="cmd-reorder" class="btn btn-primary">🔄 Auto-Order Couplets</button>
        <button id="cmd-delete-selected" class="btn btn-danger">🗑️ Delete (Del)</button>
        <button id="cmd-clear-selection" class="btn btn-outline">Clear Selection (Esc)</button>
        
        <span class="toolbar-spacer"></span>
        
        <!-- NEW: Unified Entry Point Button -->
        <button id="cmd-open-panel" class="btn btn-primary" style="background: var(--color-text);">⚙️ App Panel</button>
        
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
          <button id="add-couplet-btn" class="btn-add-block">+ Add New Step Block (Alt+N)</button>
        </div>

        <div class="print-column">
          <h2>Live Publication Render</h2>
          <hr class="hr-print" />
          <div id="print-view-container" class="print-grid"></div>
        </div>
      </div>
    </div>

    <!-- NEW: Unified Control Panel Modal Container -->
    <div id="control-panel-modal" class="modal-overlay" style="display: none;">
      <div class="modal-window">
        <div class="modal-header">
          <h3>⚙️ Application Control Center</h3>
          <button id="modal-close-btn" class="modal-close-x">&times;</button>
        </div>
        <div class="modal-tabs">
          <button class="tab-btn active" data-tab="tab-shortcuts">⌨️ Keyboard Shortcuts</button>
          <button class="tab-btn" data-tab="tab-options">🔧 Options & Settings</button>
          <button class="tab-btn" data-tab="tab-about">ℹ️ About</button>
        </div>
        <div class="modal-body">
          <!-- Shortcuts Tab -->
          <div id="tab-shortcuts" class="tab-content active-content">
            <table class="shortcuts-table">
              <thead>
                <tr><th>Action</th><th>Shortcut Command</th></tr>
              </thead>
              <tbody>
                <tr><td>Select All Step Cards</td><td><code>${IS_MAC ? '⌘ + A' : 'Ctrl + A'}</code></td></tr>
                <tr><td>Cut Selected Step Cards</td><td><code>${IS_MAC ? '⌘ + X' : 'Ctrl + X'}</code></td></tr>
                <tr><td>Copy Selected Step Cards</td><td><code>${IS_MAC ? '⌘ + C' : 'Ctrl + C'}</code></td></tr>
                <tr><td>Paste Step Cards Below</td><td><code>${IS_MAC ? '⌘ + V' : 'Ctrl + V'}</code></td></tr>
                <tr><td>Append New Step Card</td><td><code>Alt + N</code> (Option + N)</td></tr>
                <tr><td>Swap Alternative Rows</td><td><code>Alt + S</code> (Option + S)</td></tr>
                <tr><td>Undo Last Action</td><td><code>${IS_MAC ? '⌘ + Z' : 'Ctrl + Z'}</code></td></tr>
                <tr><td>Redo Action</td><td><code>${IS_MAC ? '⌘ + Y' : 'Ctrl + Y'}</code></td></tr>
                <tr><td>Delete Selected step cards</td><td><code>Delete</code> / <code>Backspace</code></td></tr>
                <tr><td>Deselect all step cards</td><td><code>Escape</code></td></tr>
              </tbody>
            </table>
          </div>
          
          <!-- Options Tab -->
          <div id="tab-options" class="tab-content" style="display: none;">
            <div class="settings-group">
              <h4>System Memory Rules</h4>
              <label class="setting-item">
                <input type="checkbox" id="setting-autosave" checked />
                <span>Enable Browser LocalStorage Sync Engine</span>
              </label>
              <p style="font-size: 12px; color: var(--color-text-muted); margin-left: 24px;">
                Forces state configurations to continuously synchronize natively.
              </p>
            </div>
          </div>
          
          <!-- About Tab -->
          <div id="tab-about" class="tab-content" style="display: none;">
            <h4>TSKey an Dichotomous Key Editor</h4>
            <p><strong>Version:</strong> 0.0.1-Alpha (2026 Engine Core)</p>
            <p>An editor for writing classical Dichotomous keys to identify biologicals taxa on morphological traits.</p>
            <p>Writen by Nils Ericson 2026 under the zlib license</p>
          </div>
        </div>
      </div>
    </div>
    `;
}

/**
 * Synchronizes dynamic interactive state adjustments directly onto toolbar button layouts.
 */
export function renderToolbar(store: KeyStore) {
    const deleteBtn = document.querySelector('#cmd-delete-selected') as HTMLButtonElement;
    const clearBtn = document.querySelector('#cmd-clear-selection') as HTMLButtonElement;
    const saveBtn = document.querySelector('#cmd-save') as HTMLButtonElement;

    if (!deleteBtn) return;

    // Fetch selection tracking indicators from the state model
    const selectedCount = store.getSelectedIds().size;

    // Dynamic Selection Management Adjustments
    deleteBtn.textContent = `🗑️ Delete Selected (${selectedCount})`;
    deleteBtn.disabled = selectedCount === 0;

    if (clearBtn) {
        clearBtn.disabled = selectedCount === 0;
    }

    // Memory Save Visual Indicator Optimization
    if (saveBtn) {
        // Toggle a special CSS class if there are active, uncommitted changes sitting in memory
        saveBtn.classList.toggle('has-unsaved-changes', store.hasUnsavedChanges());
    }
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

        const inboundLinks = inboundLinksMap.get(couplet.id) || [];
        // Account for broken links where an internal ID exists but the target step was deleted --
        const idx1 = couplet.link1 ? idToIndexMap.get(couplet.link1) : undefined;
        const idx2 = couplet.link2 ? idToIndexMap.get(couplet.link2) : undefined;

        // If link exists but index doesn't, show the taxa string or fallback to '?' so it doesn't clear the DOM field
        const dest1Val = couplet.link1
            ? (idx1 !== undefined ? (idx1 + 1).toString() : (couplet.taxa1 || '?'))
            : couplet.taxa1;

        const dest2Val = couplet.link2
            ? (idx2 !== undefined ? (idx2 + 1).toString() : (couplet.taxa2 || '?'))
            : couplet.taxa2;

        // Mark broken link pointers OR raw unresolved numeric strings as input errors
        const isUnresolved1 = isUnresolvedLink(couplet.link1, couplet.taxa1, idToIndexMap);
        const isUnresolved2 = isUnresolvedLink(couplet.link2, couplet.taxa2, idToIndexMap);

        const cardErrors = activeDiagnostics.get(couplet.id) || [];

        // Centralized UI text bindings to prevent DOM reconciler mismatches
        const computedTitle = `${displayNum}.`;
        const badgeClass = inboundLinks.length ? 'badge badge-linked' : (index === 0 ? 'badge badge-linked' : 'badge badge-isolated');
        const badgeLabel = inboundLinks.length ? `← ${inboundLinks.join(', ')}` : (index === 0 ? '🏁 root' : '⚠️ isolated');

        let warningInnerHtml = '';
        cardErrors.forEach(err => {
            const modifierClass = err.severity === 'error' ? 'error-text' : 'warning-text';
            // Use escapeHTML to immunize arbitrary message data strings
            warningInnerHtml += `<span class="${modifierClass}">⚠️ ${escapeHTML(err.message)}</span>`;
        });

        const warningBlockHtml = cardErrors.length > 0 ? `<div class="warning-block">${warningInnerHtml}</div>` : '';

        let card = existingMap.get(couplet.id);
        if (card) {
            existingMap.delete(couplet.id);

            card.classList.toggle('is-selected', isSelected);

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
            const dest1El = syncField(card, 'input[data-field="dest1"]', dest1Val);
            dest1El?.classList.toggle('input-error', isUnresolved1);

            syncField(card, 'textarea[data-field="alt2"]', couplet.alt2);
            const dest2El = syncField(card, 'input[data-field="dest2"]', dest2Val);
            dest2El?.classList.toggle('input-error', isUnresolved2);

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
                    <label class="meta-label">→
                      <input type="text" class="input-sync input-destination ${isUnresolved1 ? 'input-error' : ''}" data-field="dest1" placeholder="Taxon or Step #" value="${escapeHTML(dest1Val)}" />
                    </label>
                  </div>
                </div>
                <div class="card-row">
                  <textarea class="input-sync card-textarea" data-field="alt2" placeholder="Enter contrast alternative description...">${escapeHTML(couplet.alt2)}</textarea>
                  <div class="card-meta-pane">
                    <label class="meta-label">→
                      <input type="text" class="input-sync input-destination ${isUnresolved2 ? 'input-error' : ''}" data-field="dest2" placeholder="Taxon or Step #" value="${escapeHTML(dest2Val)}" />
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

/**
 * Renders the passive publication presentation view structure.
 */
export function renderPrintView(store: KeyStore) {
    const container = document.querySelector('#print-view-container');
    if (!container) return;

    const key = store.getKey();
    const idToIndexMap = buildIdToIndexMap(key);

    const existingBlocks = Array.from(container.querySelectorAll('.print-step-block')) as HTMLElement[];
    const existingMap = new Map<number, HTMLElement>();
    existingBlocks.forEach(block => {
        const id = Number(block.getAttribute('data-id'));
        existingMap.set(id, block);
    });

    key.forEach((c, index) => {
        const currentDisplayNum = index + 1;
        // -- FIX: Ensure print layout matches editor view broken-link detection contracts --
        const idx1 = c.link1 ? idToIndexMap.get(c.link1) : undefined;
        const idx2 = c.link2 ? idToIndexMap.get(c.link2) : undefined;

        const isUnresolved1 = isUnresolvedLink(c.link1, c.taxa1, idToIndexMap);
        const isUnresolved2 = isUnresolvedLink(c.link2, c.taxa2, idToIndexMap);

        const dest1Info = isUnresolved1
            ? { text: c.taxa1 || '?', className: 'error-text' }
            : (c.taxa1
                ? { text: c.taxa1, className: 'print-dest-taxon' }
                : (c.link1 && idx1 !== undefined ? { text: (idx1 + 1).toString(), className: 'print-dest-strong' } : { text: '...', className: '' }));

        const dest2Info = isUnresolved2
            ? { text: c.taxa2 || '?', className: 'error-text' }
            : (c.taxa2
                ? { text: c.taxa2, className: 'print-dest-taxon' }
                : (c.link2 && idx2 !== undefined ? { text: (idx2 + 1).toString(), className: 'print-dest-strong' } : { text: '...', className: '' }));

        const val1 = c.alt1 || '___';
        const val2 = c.alt2 || '___';

        let block = existingMap.get(c.id);

        if (block) {
            existingMap.delete(c.id);

            const stepNumEl = block.querySelector('.print-step-num');
            if (stepNumEl && stepNumEl.textContent !== `${currentDisplayNum}.`) {
                stepNumEl.textContent = `${currentDisplayNum}.`;
            }

            const txt1 = block.querySelector('.print-row[data-choice="1"] .print-text');
            if (txt1 && txt1.textContent !== val1) txt1.textContent = val1;

            const dest1 = block.querySelector('.print-row[data-choice="1"] .print-dest');
            if (dest1) {
                if (dest1.textContent !== dest1Info.text) dest1.textContent = dest1Info.text;
                if (dest1.className !== `print-dest ${dest1Info.className}`.trim()) {
                    dest1.className = `print-dest ${dest1Info.className}`.trim();
                }
            }

            const txt2 = block.querySelector('.print-row[data-choice="2"] .print-text');
            if (txt2 && txt2.textContent !== val2) txt2.textContent = val2;

            const dest2 = block.querySelector('.print-row[data-choice="2"] .print-dest');
            if (dest2) {
                if (dest2.textContent !== dest2Info.text) dest2.textContent = dest2Info.text;
                if (dest2.className !== `print-dest ${dest2Info.className}`.trim()) {
                    dest2.className = `print-dest ${dest2Info.className}`.trim();
                }
            }

            container.appendChild(block);
        } else {
            block = document.createElement('div');
            block.className = 'print-step-block';
            block.setAttribute('data-id', c.id.toString());
            block.style.display = 'contents';

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

            const stepNumEl = block.querySelector('.print-step-num');
            if (stepNumEl) stepNumEl.textContent = `${currentDisplayNum}.`;

            const txt1 = block.querySelector('.print-row[data-choice="1"] .print-text');
            if (txt1) txt1.textContent = val1;

            const dest1 = block.querySelector('.print-row[data-choice="1"] .print-dest');
            if (dest1) {
                dest1.textContent = dest1Info.text;
                if (dest1Info.className) dest1.className = `print-dest ${dest1Info.className}`.trim();
            }

            const txt2 = block.querySelector('.print-row[data-choice="2"] .print-text');
            if (txt2) txt2.textContent = val2;

            const dest2 = block.querySelector('.print-row[data-choice="2"] .print-dest');
            if (dest2) {
                dest2.textContent = dest2Info.text;
                if (dest2Info.className) dest2.className = `print-dest ${dest2Info.className}`.trim();
            }

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