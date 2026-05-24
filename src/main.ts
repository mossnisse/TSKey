interface Couplet {
  id: number;    // Permanent internal unique ID
  alt1: string;
  alt2: string;
  link1: number; // Links to the internal ID of another couplet
  link2: number; 
  taxa1: string; 
  taxa2: string;
}

interface KeyValidationError {
  severity: 'warning' | 'error';
  message: string;
}

let selectedIds: number[] = [];
let draggedId: number | null = null;

// Global state initialization
let myDichotomousKey: Couplet[] = JSON.parse(localStorage.getItem('dichotomous_key') || 'null') || [
  { id: 101, alt1: "Has feathers", alt2: "Lacks feathers", link1: 0, link2: 102, taxa1: "Bird", taxa2: "" },
  { id: 102, alt1: "Has fur", alt2: "Scales or bare skin", link1: 0, link2: 103, taxa1: "Mammal", taxa2: "" },
  { id: 103, alt1: "Has scales", alt2: "Skin is smooth and moist", link1: 0, link2: 0, taxa1: "Reptile", taxa2: "Amphibian" }
];

const appDiv = document.querySelector<HTMLDivElement>('#app');

// ==========================================
// CORE HELPERS & TRANSLATION LAYERS
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

function getStepNumberById(targetId: number): string {
  if (targetId === 0) return '0';
  const index = myDichotomousKey.findIndex(c => c.id === targetId);
  return index !== -1 ? (index + 1).toString() : 'INVALID ID';
}

function parseLinkInput(val: string): number {
  const num = parseInt(val) || 0;
  if (num <= 0 || num > myDichotomousKey.length) return 0;
  return myDichotomousKey[num - 1].id;
}

// ==========================================
// REAL-TIME STRUCTURAL LINTING ENGINE
// ==========================================

function runKeyDiagnostics(): Map<number, KeyValidationError[]> {
  const diagnostics = new Map<number, KeyValidationError[]>();
  
  // Build a fast reachability map starting from Step 1 (Index 0)
  const reachableNodes = new Set<number>();
  if (myDichotomousKey.length > 0) {
    const processQueue = [myDichotomousKey[0].id];
    while (processQueue.length > 0) {
      const activeId = processQueue.shift()!;
      if (!reachableNodes.has(activeId)) {
        reachableNodes.add(activeId);
        const match = myDichotomousKey.find(c => c.id === activeId);
        if (match) {
          if (match.link1) processQueue.push(match.link1);
          if (match.link2) processQueue.push(match.link2);
        }
      }
    }
  }

  // NEW: Pre-calculate unique parent steps pointing to each node
  const inboundParentMap = new Map<number, Set<number>>();
  myDichotomousKey.forEach(c => {
    if (c.link1) {
      if (!inboundParentMap.has(c.link1)) inboundParentMap.set(c.link1, new Set());
      inboundParentMap.get(c.link1)!.add(c.id);
    }
    if (c.link2) {
      if (!inboundParentMap.has(c.link2)) inboundParentMap.set(c.link2, new Set());
      inboundParentMap.get(c.link2)!.add(c.id);
    }
  });

  // Process rules for each card instance
  myDichotomousKey.forEach((c, index) => {
    const issues: KeyValidationError[] = [];

    // Rule Reachability check (Orphans)
    if (index > 0 && !reachableNodes.has(c.id)) {
      issues.push({ severity: 'warning', message: 'Orphaned: This step is unreachable from Couplet #1.' });
    }

    // Rule Self-references
    if (c.link1 === c.id) issues.push({ severity: 'error', message: 'Choice A loops directly into its own card.' });
    if (c.link2 === c.id) issues.push({ severity: 'error', message: 'Choice B loops directly into its own card.' });

    // Rule Missing/Broken Links
    if (c.link1 && !myDichotomousKey.some(x => x.id === c.link1)) issues.push({ severity: 'error', message: 'Choice A points to an invalid or deleted step.' });
    if (c.link2 && !myDichotomousKey.some(x => x.id === c.link2)) issues.push({ severity: 'error', message: 'Choice B points to an invalid or deleted step.' });

    // Rule Dead-Ends (Both outputs empty)
    if (!c.taxa1 && !c.link1) issues.push({ severity: 'warning', message: 'Choice A is incomplete. Assign a Taxa or destination step.' });
    if (!c.taxa2 && !c.link2) issues.push({ severity: 'warning', message: 'Choice B is incomplete. Assign a Taxa or destination step.' });

    // Rule Dual-Assignment Hint Warning
    if (c.taxa1 && c.link1) issues.push({ severity: 'warning', message: 'Choice A contains both Taxa and a Goto jump (Hint Mode activated).' });
    if (c.taxa2 && c.link2) issues.push({ severity: 'warning', message: 'Choice B contains both Taxa and a Goto jump (Hint Mode activated).' });

    // Convergence Rule Check (Multiple inbound parent paths)
    const uniqueParents = inboundParentMap.get(c.id);
    if (uniqueParents && uniqueParents.size > 1) {
      // Map parent internal IDs back to user-friendly UI step numbers (#1, #2, etc.)
      const parentStepLabels: string[] = [];
      uniqueParents.forEach(parentId => {
        const parentIdx = myDichotomousKey.findIndex(x => x.id === parentId);
        if (parentIdx !== -1) {
          parentStepLabels.push(`#${parentIdx + 1}`);
        }
      });
      
      issues.push({ 
        severity: 'warning', 
        message: `Convergence: Multiple separate steps (${parentStepLabels.join(', ')}) link here. Dichotomous keys should ideally have only one entry path.` 
      });
    }

    if (issues.length > 0) diagnostics.set(c.id, issues);
  });

  return diagnostics;
}

// ==========================================
// CORE LAYOUT RENDERING ENGINE
// ==========================================

function renderApp() {
  if (!appDiv) return;

  appDiv.innerHTML = `
    <div style="font-family: sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">

      <div style="padding: 12px; background: #f8f9fa; border-radius: 8px; display: flex; gap: 10px; align-items: center; border: 1px solid #e2e8f0; flex-wrap: wrap;">
        <button id="cmd-save" style="padding: 6px 12px; cursor: pointer; font-weight: bold; background:#22c55e; color:white; border:none; border-radius:4px;">💾 Save Memory</button>
        <button id="cmd-export-json" style="padding: 6px 12px; cursor: pointer;">📥 Export JSON</button>
        <button id="cmd-trigger-import" style="padding: 6px 12px; cursor: pointer;">📤 Import JSON</button>
        <input type="file" id="file-import-hidden" accept=".json" style="display: none;" />
        
        <span style="border-left: 1px solid #ccc; height: 20px; margin: 0 5px;"></span>
        
        <button id="cmd-reorder" style="padding: 6px 12px; cursor: pointer; background: #4f46e5; color: white; border: none; border-radius: 4px;">🔄 Auto-Order Couplets</button>
        <button id="cmd-delete-selected" style="padding: 6px 12px; cursor: pointer; color: white; background: #dc3545; border: none; border-radius: 4px;">🗑️ Delete Selected (${selectedIds.length})</button>
        
        <span style="flex-grow: 1;"></span>
        
        <select id="export-format-selector" style="padding: 6px; border-radius: 4px; border: 1px solid #ccc;">
          <option value="">-- Export Target Format --</option>
          <option value="text">Plain Text (.txt)</option>
          <option value="html">Structured HTML/CSS</option>
          <option value="latex">Academic LaTeX Document</option>
          <option value="lucid">Lucid Key Exchange Interchange</option>
        </select>
        <button id="cmd-clear-selection" style="padding: 6px 12px; cursor: pointer; background: transparent; border: 1px solid #ccc; border-radius: 4px;">Clear Selection</button>
      </div>
    
      <div style="flex: 1.2;">
        <h2 style="margin-top: 0; color: #1e293b;">Key Node Canvas</h2>
        <div id="editor-container"></div>
        <button id="add-couplet-btn" style="margin-top: 15px; padding: 12px 20px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 6px; font-weight: bold; width: 100%;">+ Add New Step Block</button>
      </div>

      <div style="flex: 0.8; padding: 25px; border-radius: 8px; border: 1px solid; position: sticky; top: 20px; max-height: 85vh; overflow-y: auto;">
        <h2 style="margin-top: 0;">Live Publication Render</h2>
        <hr style="border: 0; border-top: 1px solid; margin-bottom: 20px;" />
        <div id="print-view-container" style="line-height: 1.8; font-family: monospace; font-size: 15px;"></div>
      </div>
    </div>
  `;

  renderEditorFields();
  renderPrintView();
  setupGlobalEvents();
}

function renderEditorFields() {
    const container = document.querySelector('#editor-container');
  if (!container) return;

  const activeDiagnostics = runKeyDiagnostics();

  myDichotomousKey.forEach((couplet, index) => {
    const isSelected = selectedIds.includes(couplet.id);
    const displayNum = index + 1;
    const card = document.createElement('div');
    
    card.draggable = true;
    card.setAttribute('data-id', couplet.id.toString());
    
    // Evaluate Back-Reference Connections mapping runtime
    const inboundLinks: string[] = [];
    myDichotomousKey.forEach((searchNode, searchIdx) => {
      if (searchNode.link1 === couplet.id) inboundLinks.push(`#${searchIdx + 1}a`);
      if (searchNode.link2 === couplet.id) inboundLinks.push(`#${searchIdx + 1}b`);
    });

    // Check Lint errors attached to this specific card instance
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
    
    const viewLink1 = couplet.link1 ? myDichotomousKey.findIndex(c => c.id === couplet.link1) + 1 : '';
    const viewLink2 = couplet.link2 ? myDichotomousKey.findIndex(c => c.id === couplet.link2) + 1 : '';

    // Generate diagnostic badge HTML template layout block
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
    <textarea data-id="${couplet.id}" data-field="alt1" placeholder="Enter diagnostic trait details..." style="flex: 1; min-height: 50px; font-family: sans-serif; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; resize: vertical; font-size:14px; line-height:1.4;">${escapeHTML(couplet.alt1)}</textarea>
    
    <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center; font-size: 12px; min-width: 220px; border-left: 1px solid #e2e8f0; padding-left: 12px; background:#fafafa; border-radius:0 6px 6px 0;">
      <label style="display: flex; justify-content: space-between; align-items: center;">
        Leads to: 
        <input type="text" placeholder="Taxon name" value="${escapeHTML(couplet.taxa1)}" data-id="${couplet.id}" data-field="taxa1" style="width: 110px; padding: 3px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" />
      </label>
      <label style="display: flex; justify-content: space-between; align-items: center;">
        Goto step: 
        <input type="number" min="1" max="${myDichotomousKey.length}" placeholder="#" value="${viewLink1 || ''}" data-id="${couplet.id}" data-field="link1" style="width: 55px; padding: 3px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" />
      </label>
    </div>
  </div>

  <div style="display: flex; gap: 12px; align-items: stretch;">
    <textarea data-id="${couplet.id}" data-field="alt2" placeholder="Enter contrast alternative description..." style="flex: 1; min-height: 50px; font-family: sans-serif; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; resize: vertical; font-size:14px; line-height:1.4;">${escapeHTML(couplet.alt2)}</textarea>
    
    <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center; font-size: 12px; min-width: 220px; border-left: 1px solid #e2e8f0; padding-left: 12px; background:#fafafa; border-radius:0 6px 6px 0;">
      <label style="display: flex; justify-content: space-between; align-items: center;">
        Leads to Taxa: 
        <input type="text" placeholder="Taxon name" value="${escapeHTML(couplet.taxa2)}" data-id="${couplet.id}" data-field="taxa2" style="width: 110px; padding: 3px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" />
      </label>
      <label style="display: flex; justify-content: space-between; align-items: center;">
        Goto Step: 
        <input type="number" min="1" max="${myDichotomousKey.length}" placeholder="#" value="${viewLink2 || ''}" data-id="${couplet.id}" data-field="link2" style="width: 55px; padding: 3px 6px; border: 1px solid #cbd5e1; border-radius: 4px;" />
      </label>
    </div>
  </div>
  
  ${warningBlockHtml}
`;

    card.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, button, select')) return;
      
      if (e.ctrlKey || e.metaKey) {
        if (isSelected) selectedIds = selectedIds.filter(id => id !== couplet.id);
        else selectedIds.push(couplet.id);
      } else {
        selectedIds = [couplet.id];
      }
      renderApp();
    });

    // Native Drag and Drop Implementations
    card.addEventListener('dragstart', () => { draggedId = couplet.id; card.style.opacity = '0.4'; });
    card.addEventListener('dragend', () => { card.style.opacity = '1'; draggedId = null; });
    card.addEventListener('dragover', (e) => e.preventDefault());
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      if (draggedId === null || draggedId === couplet.id) return;
      const draggedIndex = myDichotomousKey.findIndex(c => c.id === draggedId);
      const targetIndex = myDichotomousKey.findIndex(c => c.id === couplet.id);
      const [removed] = myDichotomousKey.splice(draggedIndex, 1);
      myDichotomousKey.splice(targetIndex, 0, removed);
      renderApp();
    });

    container.appendChild(card);
  });
}

function renderPrintView() {
  const container = document.querySelector('#print-view-container');
  if (!container) return;

  let htmlContent = `<div style="display: grid; grid-template-columns: auto 1fr; gap: 8px 12px; align-items: end;">`;

  myDichotomousKey.forEach((c, index) => {
  const currentDisplayNum = index + 1;
  const step1Dest = getStepNumberById(c.link1);
  const step2Dest = getStepNumberById(c.link2);

  const end1 = c.taxa1 ? `<strong style="font-style: italic;">${escapeHTML(c.taxa1)}</strong>` : (c.link1 ? `<strong>${step1Dest}</strong>` : '<span>...</span>');
  const end2 = c.taxa2 ? `<strong style="font-style: italic;">${escapeHTML(c.taxa2)}</strong>` : (c.link2 ? `<strong>${step2Dest}</strong>` : '<span>...</span>');

  htmlContent += `
    <div style="font-weight: bold; align-self: start;">${currentDisplayNum}.</div>
    <div style="display: flex; justify-content: space-between; align-items: end; width: 100%;">
      <span style="flex-shrink: 1; text-align: left; white-space: pre-wrap;">${escapeHTML(c.alt1) || '___'}</span>
      <span style="flex-grow: 1; border-bottom: 1px dotted; margin: 0 8px 4px 8px;"></span>
      <span style="flex-shrink: 0; white-space: nowrap;">${end1}</span>
    </div>
    <div style="font-weight: bold; text-align: center; align-self: start;">—</div>
    <div style="display: flex; justify-content: space-between; align-items: end; width: 100%;">
      <span style="flex-shrink: 1; text-align: left; white-space: pre-wrap;">${escapeHTML(c.alt2) || '___'}</span>
      <span style="flex-grow: 1; border-bottom: 1px dotted; margin: 0 8px 4px 8px;"></span>
      <span style="flex-shrink: 0; white-space: nowrap;">${end2}</span>
    </div>
    <div style="grid-column: span 2; height: 8px;"></div>
  `;
});

  htmlContent += `</div>`;
  container.innerHTML = htmlContent;
}

// ==========================================
// CENTRALIZED DATA PROCESSING HUB
// ==========================================

function setupGlobalEvents() {
  const container = document.querySelector('#editor-container');
  if (!container) return;

  // Real-time decoupled typing inputs captures
  container.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!target) return;

    const id = parseInt(target.getAttribute('data-id') || '0');
    const field = target.getAttribute('data-field') as keyof Couplet;
    const couplet = myDichotomousKey.find(c => c.id === id);
    
    if (couplet && field) {
      if (field === 'link1' || field === 'link2') {
        couplet[field] = parseLinkInput(target.value);
      } else {
        (couplet[field] as string) = target.value;
      }
      // Re-run minimal visual print updates to avoid refreshing fields and breaking cursor focus
      renderPrintView();
    }
  });

  // Local Storage Save Command
  document.querySelector('#cmd-save')?.addEventListener('click', () => {
    localStorage.setItem('dichotomous_key', JSON.stringify(myDichotomousKey));
    alert("💾 Saved successfully to local browser engine database memory!");
  });

  // JSON Downloader Engine Action
  document.querySelector('#cmd-export-json')?.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(myDichotomousKey, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "dichotomous_key_export.json");
    dlAnchorElem.click();
  });

  // JSON Import Trigger Action Routing
  const hiddenImportInput = document.querySelector('#file-import-hidden') as HTMLInputElement;
  document.querySelector('#cmd-trigger-import')?.addEventListener('click', () => hiddenImportInput?.click());
  hiddenImportInput?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsedData = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsedData)) {
          myDichotomousKey = parsedData;
          selectedIds = [];
          renderApp();
          alert("📤 Key data imported from JSON successfully!");
        }
      } catch (err) {
        alert("❌ Error: Invalid JSON File schema uploaded.");
      }
    };
    reader.readAsText(file);
  });

  // Multi-Selection Controls
  document.querySelector('#cmd-clear-selection')?.addEventListener('click', () => {
    selectedIds = [];
    renderApp();
  });

  document.querySelector('#cmd-delete-selected')?.addEventListener('click', () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Confirm removing the ${selectedIds.length} checked node configurations?`)) {
      myDichotomousKey = myDichotomousKey.filter(c => !selectedIds.includes(c.id));
      selectedIds = [];
      renderApp();
    }
  });

  // BFS Array Item Level-Order Re-ordering Command
  document.querySelector('#cmd-reorder')?.addEventListener('click', () => {
    if (myDichotomousKey.length === 0) return;

    // Calculate entry parent bounds to find the true root node
    const incomingCounts = new Map<number, number>();
    myDichotomousKey.forEach(c => {
        if (c.link1) incomingCounts.set(c.link1, (incomingCounts.get(c.link1) || 0) + 1);
        if (c.link2) incomingCounts.set(c.link2, (incomingCounts.get(c.link2) || 0) + 1);
    });

    let root = myDichotomousKey.find(c => !incomingCounts.has(c.id));
    let rootId = root ? root.id : myDichotomousKey[0].id;

    const visited = new Set<number>();
    const orderedCouplets: Couplet[] = [];
    
    // Queue initialization for Level-Order BFS traversal
    const queue: number[] = [rootId];

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (currentId === 0 || visited.has(currentId)) continue;

        const couplet = myDichotomousKey.find(c => c.id === currentId);
        if (!couplet) continue;

        visited.add(currentId);
        orderedCouplets.push(couplet);

        // Queue choice branches safely to ensure adjacent pairs stay grouped
        if (couplet.link1 && couplet.link1 !== 0 && !visited.has(couplet.link1)) {
        queue.push(couplet.link1);
        }
        if (couplet.link2 && couplet.link2 !== 0 && !visited.has(couplet.link2)) {
        queue.push(couplet.link2);
        }
    }

    // Clean Sweep isolated detached components/orphans to avoid data loss
    myDichotomousKey.forEach(c => {
        if (!visited.has(c.id)) {
        const orphanQueue = [c.id];
        while (orphanQueue.length > 0) {
            const orphanId = orphanQueue.shift()!;
            if (orphanId === 0 || visited.has(orphanId)) continue;

            const orphanCouplet = myDichotomousKey.find(x => x.id === orphanId);
            if (!orphanCouplet) continue;

            visited.add(orphanId);
            orderedCouplets.push(orphanCouplet);

            if (orphanCouplet.link1 && !visited.has(orphanCouplet.link1)) orphanQueue.push(orphanCouplet.link1);
            if (orphanCouplet.link2 && !visited.has(orphanCouplet.link2)) orphanQueue.push(orphanCouplet.link2);
        }
        }
    });

    // Commit reorganizations directly back into state engine
    myDichotomousKey = orderedCouplets;
    alert("🔄 Memory positions re-indexed sequentially using BFS sibling grouping!");
    renderApp();
  });

  // Dynamic Content Export Pipeline Router Stub
  document.querySelector('#export-format-selector')?.addEventListener('change', (e) => {
    const format = (e.target as HTMLSelectElement).value;
    if (!format) return;
    alert(`Export Processing Module initialized for: [${format.toUpperCase()}].\nReady to link with target document download drivers.`);
    (e.target as HTMLSelectElement).value = ""; // Reset selector dropdown UI
  });

  // New Node Injection Engine Action
  const addBtn = document.querySelector('#add-couplet-btn');
  addBtn?.replaceWith(addBtn.cloneNode(true)); // Clear listeners safely
  document.querySelector('#add-couplet-btn')?.addEventListener('click', () => {
    const maxId = myDichotomousKey && Array.isArray(myDichotomousKey)
    ? myDichotomousKey.reduce((currentMax, couplet) => {
      const validId = Number(couplet?.id);
      return !isNaN(validId) ? Math.max(currentMax, validId) : currentMax;
    }, 100)
    : 100;

    const nextInternalId = maxId + 1;
    myDichotomousKey.push({ id: nextInternalId, alt1: "", alt2: "", link1: 0, link2: 0, taxa1: "", taxa2: "" });
    renderApp(); 
  });
}

// Start environment bootstrap
renderApp();