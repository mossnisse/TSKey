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
    return num; // Returns the intended user-facing step number temporary slot
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
    <div style="font-family: sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
      
      <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; display: flex; gap: 10px; align-items: center; border: 1px solid #e2e8f0; flex-wrap: wrap;">
        <button id="cmd-undo" style="padding: 6px 12px; cursor: pointer;">↩️ Undo</button>
        <button id="cmd-redo" style="padding: 6px 12px; cursor: pointer;">↪️ Redo</button>
        <span style="border-left: 1px solid #ccc; height: 20px; margin: 0 5px;"></span>
        
        <button id="cmd-save" style="padding: 6px 12px; cursor: pointer; font-weight: bold; background:#22c55e; color:white; border:none; border-radius:4px;">💾 Save Memory</button>
        <button id="cmd-export-json" style="padding: 6px 12px; cursor: pointer;">📥 Export JSON</button>
        <button id="cmd-trigger-import" style="padding: 6px 12px; cursor: pointer;">📤 Import JSON</button>
        <input type="file" id="file-import-hidden" accept=".json" style="display: none;" />
        
        <span style="border-left: 1px solid #ccc; height: 20px; margin: 0 5px;"></span>
        
        <button id="cmd-reorder" style="padding: 6px 12px; cursor: pointer; background: #4f46e5; color: white; border: none; border-radius: 4px;">🔄 Auto-Order Couplets</button>
        <button id="cmd-delete-selected" style="padding: 6px 12px; cursor: pointer; color: white; background: #dc3545; border: none; border-radius: 4px;">🗑️ Delete Selected</button>
        <button id="cmd-clear-selection" style="padding: 6px 12px; cursor: pointer; background: transparent; border: 1px solid #ccc; border-radius: 4px;">Clear Selection</button>
        
        <span style="flex-grow: 1;"></span>
        
        <select id="export-format-selector" style="padding: 6px; border-radius: 4px; border: 1px solid #ccc;">
          <option value="">-- Export Target Format --</option>
          <option value="text">Plain Text (.txt)</option>
          <option value="html">Structured HTML/CSS</option>
          <option value="latex">Academic LaTeX Document</option>
          <option value="lucid">Lucid Key Exchange Interchange</option>
        </select>
      </div>
    
      <div style="display: flex; gap: 20px; align-items: start;">
        <div style="flex: 1.2;">
          <h2 style="margin-top: 0; color: #1e293b;">Key Node Canvas</h2>
          <div id="editor-container"></div>
          <button id="add-couplet-btn" style="margin-top: 15px; padding: 12px 20px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 6px; font-weight: bold; width: 100%;">+ Add New Step Block</button>
        </div>

        <div style="flex: 0.8; padding: 25px; border-radius: 8px; border: 1px solid #000; position: sticky; top: 20px; max-height: 85vh; overflow-y: auto; background: #fff; color: #000;">
          <h2 style="margin-top: 0; color: #000;">Live Publication Render</h2>
          <hr style="border: 0; border-top: 1px solid #000; margin-bottom: 20px;" />
          <div id="print-view-container" style="line-height: 1.8; font-family: serif; font-size: 15px; color: #000;"></div>
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

    container.innerHTML = '';
    const key = store.getKey();
    const selectedIds = store.getSelectedIds();
    const activeDiagnostics = store.runDiagnostics();

    // Update dynamic selection badge quantities inside toolbar components
    const deleteBtn = document.querySelector('#cmd-delete-selected') as HTMLButtonElement;
    if (deleteBtn) deleteBtn.textContent = `🗑️ Delete Selected (${selectedIds.length})`;

    key.forEach((couplet, index) => {
        const isSelected = selectedIds.includes(couplet.id);
        const displayNum = index + 1;
        const card = document.createElement('div');

        card.draggable = true;
        card.setAttribute('data-id', couplet.id.toString());

        // Process runtime reverse tracing routes
        const inboundLinks: string[] = [];
        key.forEach((searchNode, searchIdx) => {
            if (searchNode.link1 === couplet.id) inboundLinks.push(`#${searchIdx + 1}a`);
            if (searchNode.link2 === couplet.id) inboundLinks.push(`#${searchIdx + 1}b`);
        });

        const cardErrors = activeDiagnostics.get(couplet.id) || [];
        const hasErrors = cardErrors.some(e => e.severity === 'error');

        card.style.cssText = `
            border: ${isSelected ? '2px solid #007bff' : (hasErrors ? '2px dashed #ef4444' : '1px solid #cbd5e1')}; 
            padding: 16px; 
            margin-bottom: 16px; 
            border-radius: 8px; 
            background: ${isSelected ? '#f0f7ff' : '#ffffff'}; 
            cursor: grab; 
            position: relative;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        `;

        const viewLink1 = couplet.link1 ? key.findIndex(c => c.id === couplet.link1) + 1 : '';
        const viewLink2 = couplet.link2 ? key.findIndex(c => c.id === couplet.link2) + 1 : '';

        let warningBlockHtml = '';
        if (cardErrors.length > 0) {
            warningBlockHtml = `<div style="margin-top: 10px; padding: 8px; background: #fff7ed; border-left: 3px solid #f97316; border-radius: 4px; font-size:12px; color: #c2410c; display:flex; flex-direction:column; gap:2px;">`;
            cardErrors.forEach(err => {
                const color = err.severity === 'error' ? '#dc2626' : '#c2410c';
                warningBlockHtml += `<span style="color: ${color}">⚠️ ${err.message}</span>`;
            });
            warningBlockHtml += `</div>`;
        }

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; user-select: none;">
              <div style="display:flex; align-items:center; gap: 10px;">
                <h4 style="margin: 0; color: #1e293b; font-size: 15px;">Step #${displayNum}</h4>
                <span style="font-size: 11px; background: ${inboundLinks.length ? '#e0f2fe' : '#fee2e2'}; padding: 2px 6px; border-radius: 4px; color: ${inboundLinks.length ? '#0369a1' : '#991b1b'}; font-weight: 500;">
                  ${inboundLinks.length ? `Linked from: ${inboundLinks.map(escapeHTML).join(', ')}` : (index === 0 ? '🏁 Root Node' : '⚠️ Isolated Node')}
                </span>
              </div>
              <span style="font-size: 18px; color: #94a3b8; cursor: grab;">☰</span>
            </div>
            
            <div style="margin-bottom: 14px; display: flex; gap: 12px; align-items: stretch;">
              <textarea class="input-sync" data-field="alt1" placeholder="Enter diagnostic trait details..." style="flex: 1; min-height: 50px; font-family: sans-serif; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; resize: vertical; font-size:14px; line-height:1.4;">${escapeHTML(couplet.alt1)}</textarea>
              <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center; font-size: 12px; min-width: 220px; border-left: 1px solid #e2e8f0; padding-left: 12px; background:#fafafa; border-radius:0 6px 6px 0;">
                <label style="display: flex; justify-content: space-between; align-items: center;">Leads to: 
                  <input type="text" class="input-sync" data-field="taxa1" placeholder="Taxon name" value="${escapeHTML(couplet.taxa1)}" style="width: 110px; padding: 3px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" />
                </label>
                <label style="display: flex; justify-content: space-between; align-items: center;">Goto step: 
                  <input type="number" class="input-sync" data-field="link1" min="1" max="${key.length}" placeholder="#" value="${viewLink1 || ''}" style="width: 55px; padding: 3px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" />
                </label>
              </div>
            </div>

            <div style="display: flex; gap: 12px; align-items: stretch;">
              <textarea class="input-sync" data-field="alt2" placeholder="Enter contrast alternative description..." style="flex: 1; min-height: 50px; font-family: sans-serif; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; resize: vertical; font-size:14px; line-height:1.4;">${escapeHTML(couplet.alt2)}</textarea>
              <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center; font-size: 12px; min-width: 220px; border-left: 1px solid #e2e8f0; padding-left: 12px; background:#fafafa; border-radius:0 6px 6px 0;">
                <label style="display: flex; justify-content: space-between; align-items: center;">Leads to Taxa: 
                  <input type="text" class="input-sync" data-field="taxa2" placeholder="Taxon name" value="${escapeHTML(couplet.taxa2)}" style="width: 110px; padding: 3px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" />
                </label>
                <label style="display: flex; justify-content: space-between; align-items: center;">Goto Step: 
                  <input type="number" class="input-sync" data-field="link2" min="1" max="${key.length}" placeholder="#" value="${viewLink2 || ''}" style="width: 55px; padding: 3px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" />
                </label>
              </div>
            </div>
            
            ${warningBlockHtml}
        `;

        // Selection Toggle Event
        card.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('input, textarea, button, select')) return; // Avoid breaking inner focus handles

            const isMulti = e.ctrlKey || e.metaKey;
            store.toggleSelection(couplet.id, isMulti);
            refreshAll();
        });

        // Decoupled Input Synchronizers (Maintains cursor positions perfectly)
        card.querySelectorAll('.input-sync').forEach(element => {
            const el = element as HTMLInputElement | HTMLTextAreaElement;
            const field = el.getAttribute('data-field')!;
            
            // Track typing state to prevent flooding the history stack
            let typingSessionActive = false;

            // FIX 1: Prevent parent drag-and-drop mechanics from hijacking the mouse caret text placement
            el.addEventListener('mousedown', () => { 
                card.draggable = false; 
            });
            el.addEventListener('mouseenter', () => { 
                card.draggable = false; 
            });
            el.addEventListener('mouseleave', () => { 
                if (store.draggedId === null) card.draggable = true; 
            });

            el.addEventListener('input', () => {
                // FIX 2: Capture the pristine state BEFORE the very first keystroke modifies it
                if (!typingSessionActive) {
                    store.commitHistoryCheckpoint();
                    typingSessionActive = true;
                }

                let value: any = el.value;
                
                if (field === 'link1' || field === 'link2') {
                    const stepNum = parseLinkInput(value, key.length);
                    value = stepNum > 0 ? key[stepNum - 1].id : 0;
                } else {
                    value = el.value;
                }
                
                store.updateCouplet(couplet.id, { [field]: value });
                renderPrintView(store); // Instantly updates presentation engine side view only
            });

            el.addEventListener('blur', () => {
                // Restore card drag privileges and reset typing session flags
                card.draggable = true;
                typingSessionActive = false;
                // FIX: Defer refresh to the next event loop tick.
                // This gives the browser time to fire the "click" event on your buttons
                // BEFORE the DOM tree gets torn down and rebuilt.
                setTimeout(() => {
                    refreshAll(); // Full visual pass updates step labels & warning badges safely
                }, 0);
            });
        });

        // Native Drag & Drop Implementation Pipeline
        card.addEventListener('dragstart', () => { store.draggedId = couplet.id; card.style.opacity = '0.4'; });
        card.addEventListener('dragend', () => { card.style.opacity = '1'; store.draggedId = null; });
        card.addEventListener('dragover', (e) => e.preventDefault());
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            if (store.draggedId === null || store.draggedId === couplet.id) return;
            store.reorderCouplets(store.draggedId, couplet.id);
            refreshAll();
        });

        container.appendChild(card);
    });
}

/**
 * Renders the passive publication presentation.
 */
export function renderPrintView(store: KeyStore) {
    const container = document.querySelector('#print-view-container');
    if (!container) return;

    const key = store.getKey();
    let htmlContent = `<div style="display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; align-items: end; color: #000;">`;

    key.forEach((c, index) => {
        const currentDisplayNum = index + 1;
        const step1Dest = getStepNumberById(key, c.link1);
        const step2Dest = getStepNumberById(key, c.link2);

        const end1 = c.taxa1 ? `<strong style="font-style: italic;">${escapeHTML(c.taxa1)}</strong>` : (c.link1 ? `<strong>${step1Dest}</strong>` : '<span>...</span>');
        const end2 = c.taxa2 ? `<strong style="font-style: italic;">${escapeHTML(c.taxa2)}</strong>` : (c.link2 ? `<strong>${step2Dest}</strong>` : '<span>...</span>');

        htmlContent += `
            <div style="font-weight: bold; align-self: start; color: #000;">${currentDisplayNum}.</div>
            <div style="display: flex; justify-content: space-between; align-items: end; width: 100%;">
              <span style="flex-shrink: 1; text-align: left; white-space: pre-wrap;">${escapeHTML(c.alt1) || '___'}</span>
              <span style="flex-grow: 1; border-bottom: 1px dotted #000; margin: 0 8px 4px 8px;"></span>
              <span style="flex-shrink: 0; white-space: nowrap;">${end1}</span>
            </div>
            <div style="font-weight: bold; text-align: center; align-self: start; color: #000;">—</div>
            <div style="display: flex; justify-content: space-between; align-items: end; width: 100%;">
              <span style="flex-shrink: 1; text-align: left; white-space: pre-wrap;">${escapeHTML(c.alt2) || '___'}</span>
              <span style="flex-shrink: 1; border-bottom: 1px dotted #000; margin: 0 8px 4px 8px;"></span>
              <span style="flex-shrink: 0; white-space: nowrap;">${end2}</span>
            </div>
            <div style="grid-column: span 2; height: 8px;"></div>
        `;
    });

    htmlContent += `</div>`;
    container.innerHTML = htmlContent;
}

// ==========================================
// CENTRALIZED COMPONENT HOOK INTERFACES
// ==========================================

function setupGlobalListeners(store: KeyStore, refreshAll: () => void) {
    // History Actions
    document.querySelector('#cmd-undo')?.addEventListener('click', () => { if (store.undo()) refreshAll(); });
    document.querySelector('#cmd-redo')?.addEventListener('click', () => { if (store.redo()) refreshAll(); });

    // Local Storage Drivers
    document.querySelector('#cmd-save')?.addEventListener('click', () => {
        localStorage.setItem('dichotomous_key', JSON.stringify(store.getKey()));
        alert("Saved successfully to local engine database!");
    });

    // JSON Data Export Pipeliners
    document.querySelector('#cmd-export-json')?.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(store.getKey(), null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", "dichotomous_key_export.json");
        dlAnchor.click();
    });

    // JSON Data Import Router Drivers
    const hiddenInput = document.querySelector('#file-import-hidden') as HTMLInputElement;
    document.querySelector('#cmd-trigger-import')?.addEventListener('click', () => hiddenInput?.click());
    hiddenInput?.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (Array.isArray(parsed)) {
                    store.replaceKeyData(parsed);
                    refreshAll();
                    alert("Key data parsed and injected successfully!");
                }
            } catch {
                alert("Error: Invalid schema JSON file structured parameters.");
            }
        };
        reader.readAsText(file);
    });

    // Node Operations
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

    // Format Stubs
    document.querySelector('#export-format-selector')?.addEventListener('change', (e) => {
        const format = (e.target as HTMLSelectElement).value;
        if (!format) return;
        alert(`Format conversion engine initiated for: [${format.toUpperCase()}].`);
        (e.target as HTMLSelectElement).value = "";
    });
}