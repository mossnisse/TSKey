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
 * Selective Component Tree Replacement.
 * Updates the card items on the editor canvas panel without rebuilding the shell layout wrapper.
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

    const fragment = document.createDocumentFragment();

    key.forEach((couplet, index) => {
        const displayNum = index + 1;
        const isSelected = selectedIdsSet.has(couplet.id);

        const inboundLinks = inboundLinksMap.get(couplet.id) || [];
        const idx1 = couplet.link1 ? idToIndexMap.get(couplet.link1) : undefined;
        const idx2 = couplet.link2 ? idToIndexMap.get(couplet.link2) : undefined;

        const viewLink1 = idx1 !== undefined ? idx1 + 1 : '';
        const viewLink2 = idx2 !== undefined ? idx2 + 1 : '';

        const cardErrors = activeDiagnostics.get(couplet.id) || [];
        const hasErrors = cardErrors.some(e => e.severity === 'error');

        const card = document.createElement('div');
        card.draggable = true;
        card.setAttribute('data-id', couplet.id.toString());
        
        // Setup state-driven visual style toggles through classList API
        card.className = 'key-card';
        if (isSelected) card.classList.add('is-selected');
        if (hasErrors) card.classList.add('has-errors');

        let warningBlockHtml = '';
        if (cardErrors.length > 0) {
            warningBlockHtml = `<div class="warning-block">`;
            cardErrors.forEach(err => {
                const modifierClass = err.severity === 'error' ? 'error-text' : 'warning-text';
                warningBlockHtml += `<span class="${modifierClass}">⚠️ ${err.message}</span>`;
            });
            warningBlockHtml += `</div>`;
        }

        const badgeClass = inboundLinks.length ? 'badge badge-linked' : (index === 0 ? 'badge badge-linked' : 'badge badge-isolated');
        const badgeLabel = inboundLinks.length ? `Linked from: ${inboundLinks.map(escapeHTML).join(', ')}` : (index === 0 ? '🏁 Root Node' : '⚠️ Isolated Node');

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

        card.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('input, textarea, button, select')) return;

            const isMulti = e.ctrlKey || e.metaKey;
            store.toggleSelection(couplet.id, isMulti);
            refreshAll();
        });

        let typingSessionActive = false;

        card.querySelectorAll('.input-sync').forEach(element => {
            const el = element as HTMLInputElement | HTMLTextAreaElement;
            const field = el.getAttribute('data-field')!;

            el.addEventListener('mousedown', () => { card.draggable = false; });
            el.addEventListener('mouseenter', () => { card.draggable = false; });
            el.addEventListener('mouseleave', () => {
                if (store.draggedId === null) card.draggable = true;
            });

            el.addEventListener('input', () => {
                store.setActiveCard(couplet.id);

                if (!typingSessionActive && typeof store.commitHistoryCheckpoint === 'function') {
                    store.commitHistoryCheckpoint();
                    typingSessionActive = true;
                }

                let value: any = el.value;
                if (field === 'link1' || field === 'link2') {
                    const stepNum = parseLinkInput(value, key.length);
                    value = stepNum > 0 ? key[stepNum - 1].id : 0;
                }

                store.updateCouplet(couplet.id, { [field]: value });
                renderPrintView(store);
            });

            el.addEventListener('blur', () => {
                card.draggable = true;
                typingSessionActive = false;

                setTimeout(() => {
                    if (!card.contains(document.activeElement)) {
                        store.clearActiveCard();
                        refreshAll();
                    }
                }, 0);
            });
        });

        card.addEventListener('dragstart', () => {
            store.startDragging(couplet.id);
            card.classList.remove('is-hovered', 'is-active');
            card.style.opacity = '0.4';
        });

        card.addEventListener('dragend', () => {
            card.style.opacity = '1';
            store.stopDragging();
        });

        card.addEventListener('dragover', (e) => e.preventDefault());

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            if (store.draggedId === null || store.draggedId === couplet.id) return;
            store.reorderCouplets(store.draggedId, couplet.id);
            refreshAll();
        });

        fragment.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
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
// CENTRALIZED COMPONENT HOOK INTERFACES
// ==========================================

function setupGlobalListeners(store: KeyStore, refreshAll: () => void) {
    document.querySelector('#cmd-undo')?.addEventListener('click', () => { if (store.undo()) refreshAll(); });
    document.querySelector('#cmd-redo')?.addEventListener('click', () => { if (store.redo()) refreshAll(); });

    document.querySelector('#cmd-save')?.addEventListener('click', () => {
        localStorage.setItem('dichotomous_key', JSON.stringify(store.getKey()));
        store.markSaved();
        alert("Saved successfully to local engine database!");
        refreshAll();
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
                hiddenInput.value = '';
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