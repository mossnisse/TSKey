// uiRenderer.ts
import { KeyStore, type Couplet } from './store.ts';

// ==========================================
// CORE LAYOUT HELPERS
// ==========================================

function escapeHTML(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getStepNumberById(key: readonly Couplet[], targetId: number): string {
    if (targetId === 0) return '0';
    const index = key.findIndex(c => c.id === targetId);
    return index !== -1 ? (index + 1).toString() : 'INVALID ID';
}

function parseLinkInput(val: string, maxItems: number): number {
    const num = parseInt(val) || 0;
    if (num <= 0 || num > maxItems) return 0;
    return num;
}

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
export function initializeShell(appDiv: HTMLDivElement, store: KeyStore, refreshAll: () => void) {
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
        <button id="cmd-delete-selected" class="btn btn-danger">🗑️ Delete Selected</button>
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

    setupGlobalListeners(store, refreshAll);
}

/**
 * High-Performance Incremental DOM Reconciliation.
 * Updates parameters, positions, and errors safely on existing elements without full teardown sweeps.
 */
export function renderEditorCards(store: KeyStore, refreshAll: () => void) {
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

    // Hash current DOM elements attached inside container canvas map reference
    const existingCards = Array.from(container.querySelectorAll('.key-card')) as HTMLElement[];
    const existingMap = new Map<number, HTMLElement>();
    existingCards.forEach(card => {
        const id = Number(card.getAttribute('data-id'));
        existingMap.set(id, card);
    });

    // Reconcile and Sync State Items
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

        let warningBlockHtml = '';
        if (cardErrors.length > 0) {
            warningBlockHtml = `<div class="warning-block">`;
            cardErrors.forEach(err => {
                const modifierClass = err.severity === 'error' ? 'error-text' : 'warning-text';
                warningBlockHtml += `<span class="${modifierClass}">⚠️ ${err.message}</span>`;
            });
            warningBlockHtml += `</div>`;
        }

        let card = existingMap.get(couplet.id);

        if (card) {
            // Unmark from extraction checklist map
            existingMap.delete(couplet.id);

            // Mutate layout state styling boundaries seamlessly
            card.className = 'key-card';
            if (isSelected) card.classList.add('is-selected');
            if (hasErrors) card.classList.add('has-errors');

            // Targeted updates to structural elements inside card
            const titleEl = card.querySelector('.card-title');
            if (titleEl && titleEl.textContent !== `Step #${displayNum}`) {
                titleEl.textContent = `Step #${displayNum}`;
            }

            const badgeEl = card.querySelector('.badge');
            if (badgeEl) {
                badgeEl.className = badgeClass;
                if (badgeEl.textContent !== badgeLabel) badgeEl.textContent = badgeLabel;
            }

            // Sync Form fields safely
            syncField(card, 'textarea[data-field="alt1"]', couplet.alt1);
            syncField(card, 'input[data-field="taxa1"]', couplet.taxa1);
            syncField(card, 'input[data-field="link1"]', viewLink1, key.length.toString());

            syncField(card, 'textarea[data-field="alt2"]', couplet.alt2);
            syncField(card, 'input[data-field="taxa2"]', couplet.taxa2);
            syncField(card, 'input[data-field="link2"]', viewLink2, key.length.toString());

            // Sync Warning Block structure
            const currentWarningBlock = card.querySelector('.warning-block');
            if (warningBlockHtml) {
                const strippedInner = warningBlockHtml.replace('<div class="warning-block">', '').replace('</div>', '');
                if (currentWarningBlock) {
                    if (currentWarningBlock.innerHTML !== strippedInner) {
                        currentWarningBlock.innerHTML = strippedInner;
                    }
                } else {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = warningBlockHtml;
                    card.appendChild(tempDiv.firstElementChild!);
                }
            } else if (currentWarningBlock) {
                currentWarningBlock.remove();
            }

            // High Performance Node Reordering technique: appending shifts an existing element to the correct position natively
            container.appendChild(card);

        } else {
            // Instantiation pipeline fallback if element block didn't exist prior
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
                    <label class="meta-label">Leads to Taxa: 
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

    // Wipe obsolete nodes vanished from memory array matrix 
    existingMap.forEach(card => card.remove());
}

/**
 * Renders the passive publication presentation view structure.
 */
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
}

// ==========================================
// CENTRALIZED DELEGATED EVENTS ROUTER ENGINE
// ==========================================

function setupGlobalListeners(store: KeyStore, refreshAll: () => void) {
    const container = document.querySelector('#editor-container');
    if (!container) return;

    // Track state sessions inside scoped closures to isolate text stream operations
    let typingSessionActive = false;

    // Centralized Multi-Selection Router Click
    container.addEventListener('click', (evt: Event) => {
        const e = evt as MouseEvent; // Cast to MouseEvent to access modifier keys
        const target = e.target as HTMLElement;
        if (target.closest('input, textarea, button, select')) return;

        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));
        const isMulti = e.ctrlKey || e.metaKey;

        store.toggleSelection(id, isMulti);
        refreshAll();
    });

    // Centralized Input Streaming Optimization Router
    container.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        if (!target.classList.contains('input-sync')) return;

        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));
        const field = target.getAttribute('data-field')!;
        const key = store.getKey();

        store.setActiveCard(id);

        if (!typingSessionActive && typeof store.commitHistoryCheckpoint === 'function') {
            store.commitHistoryCheckpoint();
            typingSessionActive = true;
        }

        let value: any = target.value;
        if (field === 'link1' || field === 'link2') {
            const stepNum = parseLinkInput(value, key.length);
            value = stepNum > 0 ? key[stepNum - 1].id : 0;
        }

        store.updateCouplet(id, { [field]: value });
        renderPrintView(store);
    });

    // Centralized Drag and Form Text Highlight Mitigation
    container.addEventListener('focusin', (e) => {
        const target = e.target as HTMLElement;
        if (target.matches('input, textarea')) {
            const card = target.closest('.key-card') as HTMLElement;
            if (card) card.draggable = false;
        }
    });

    // Centralized Serialization Serialization Execution
    container.addEventListener('focusout', (e) => {
        const target = e.target as HTMLElement;
        if (target.matches('input, textarea')) {
            const card = target.closest('.key-card') as HTMLElement;
            if (card) card.draggable = true;

            typingSessionActive = false;

            setTimeout(() => {
                if (card && !card.contains(document.activeElement)) {
                    store.clearActiveCard();
                    refreshAll();
                }
            }, 0);
        }
    });

    // Centralized HTML5 Drag-and-Drop Operations
    container.addEventListener('dragstart', (e) => {
        const target = e.target as HTMLElement;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        const id = Number(card.getAttribute('data-id'));
        store.startDragging(id);
        card.classList.remove('is-hovered', 'is-active');
        card.style.opacity = '0.4';
    });

    container.addEventListener('dragend', (e) => {
        const target = e.target as HTMLElement;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        card.style.opacity = '1';
        store.stopDragging();
    });

    container.addEventListener('dragover', (e) => e.preventDefault());

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const card = target.closest('.key-card') as HTMLElement;
        if (!card) return;

        const coupletId = Number(card.getAttribute('data-id'));
        if (store.draggedId === null || store.draggedId === coupletId) return;

        store.reorderCouplets(store.draggedId, coupletId);
        refreshAll();
    });

    // ==========================================
    // STANDALONE TOOLBAR ACTIONS
    // ==========================================
    document.querySelector('#cmd-undo')?.addEventListener('click', () => { if (store.undo()) refreshAll(); });
    document.querySelector('#cmd-redo')?.addEventListener('click', () => { if (store.redo()) refreshAll(); });

    document.querySelector('#cmd-save')?.addEventListener('click', () => {
        try {
            const currentData = store.getKey();
            if (!Array.isArray(currentData) || currentData.length === 0) {
                throw new Error("Cannot save an empty or corrupted data structure.");
            }

            const serializedData = JSON.stringify(currentData);
            localStorage.setItem('dichotomous_key', serializedData);

            if (localStorage.getItem('dichotomous_key') !== serializedData) {
                throw new Error("Disk verification failed. Storage write mismatch.");
            }

            store.markSaved();
            alert("💾 Saved successfully to local engine database!");
            refreshAll();

        } catch (error: any) {
            console.error("Save Operation Failed: ", error);
            let userMessage = "Failed to save data. An unknown error occurred.";
            if (error.name === 'QuotaExceededError' || error.code === 22) {
                userMessage = "⚠️ Save Failed: Browser LocalStorage is completely full! Please free up space or export your key as a JSON file.";
            } else if (error.message) {
                userMessage = `⚠️ Save Failed: ${error.message}`;
            }
            alert(userMessage);
        }
    });

    document.querySelector('#cmd-export-json')?.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(store.getKey(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", url);
        dlAnchor.setAttribute("download", "dichotomous_key_export.json");
        dlAnchor.click();
        URL.revokeObjectURL(url);
    });

    const hiddenInput = document.querySelector('#file-import-hidden') as HTMLInputElement;
    document.querySelector('#cmd-trigger-import')?.addEventListener('click', () => {
        hiddenInput?.click();
    });

    hiddenInput?.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
            const fileText = await file.text();
            const rawData = JSON.parse(fileText);
            const importResult = store.importJsonData(rawData);

            if (!importResult.success) {
                alert(`Failed to import JSON schema:\n• ${importResult.errors.join('\n• ')}`);
                return;
            }
            refreshAll();
        } catch (err) {
            alert("Malformed JSON structure: Unable to parse file stream.");
        } finally {
            if (hiddenInput) hiddenInput.value = '';
        }
    });

    document.querySelector('#cmd-clear-selection')?.addEventListener('click', () => {
        store.clearSelection();
        refreshAll();
    });

    document.querySelector('#cmd-delete-selected')?.addEventListener('click', () => {
        if (store.getSelectedIds().length === 0) return;
        if (confirm("Confirm removing highlighted element blocks?")) {
            store.deleteSelected();
            refreshAll();
        }
    });

    document.querySelector('#cmd-reorder')?.addEventListener('click', () => {
        store.autoOrderBFS();
        alert("Memory re-indexed sequentially using BFS sibling grouping!");
        refreshAll();
    });

    document.querySelector('#add-couplet-btn')?.addEventListener('click', () => {
        store.addCouplet();
        refreshAll();
    });

    document.querySelector('#export-format-selector')?.addEventListener('change', (e) => {
        const format = (e.target as HTMLSelectElement).value;
        if (!format) return;
        alert(`Format conversion engine initiated for: [${format.toUpperCase()}].`);
        (e.target as HTMLSelectElement).value = "";
    });
}