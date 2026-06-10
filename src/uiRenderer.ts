// uiRenderer.ts
import { KeyStore, APP_NAME, APP_VERSION } from './store.ts';
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
 * Renders the structural core layout app shell using discrete dialog layouts.
 * Fired once during initialization bootstrap.
 */
export function initializeShell(appDiv: HTMLDivElement) {
    appDiv.innerHTML = `
    <div class="app-shell">
      <div class="app-menu-bar">
        
        <div class="menu-item">
          <button class="menu-trigger">File</button>
          <div class="menu-dropdown">
            <button id="cmd-save" class="dropdown-action">
              <span>💾 Save to local Browser Memory</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘S' : 'Ctrl+S'}</span>
            </button>
            <div class="menu-divider"></div>
            <button id="cmd-trigger-import" class="dropdown-action">
              <span>📤 Import JSON Dataset...</span>
            </button>
            <button id="cmd-export-json" class="dropdown-action">
              <span>📥 Export Native JSON File...</span>
            </button>
            <div class="menu-divider"></div>
            <button id="cmd-export-text" class="dropdown-action">
              <span>📄 Export Publication Plain Text (.txt)</span>
            </button>
            <button id="cmd-export-html" class="dropdown-action">
              <span>🌐 Export Publication Web Page (.html)</span>
            </button>
            <button id="cmd-export-latex" class="dropdown-action">
              <span>🔏 Export LaTeX Document (.tex)</span>
            </button>
          </div>
        </div>

        <div class="menu-item">
          <button class="menu-trigger">Edit</button>
          <div class="menu-dropdown">
            <button id="cmd-undo" class="dropdown-action">
              <span>🔄 Undo</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘Z' : 'Ctrl+Z'}</span>
            </button>
            <button id="cmd-redo" class="dropdown-action">
              <span>🔁 Redo</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘Y' : 'Ctrl+Y'}</span>
            </button>
            <div class="menu-divider"></div>
            <button id="cmd-cut" class="dropdown-action">
              <span>✂️ Cut Selected Cards</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘X' : 'Ctrl+X'}</span>
            </button>
            <button id="cmd-copy" class="dropdown-action">
              <span>📋 Copy Selected Cards</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘C' : 'Ctrl+C'}</span>
            </button>
            <button id="cmd-paste" class="dropdown-action">
              <span>📥 Paste Clipboard Contents</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘V' : 'Ctrl+V'}</span>
            </button>
            <button id="cmd-delete" class="dropdown-action">
              <span>🗑️ Delete Selected Cards</span>
              <span class="menu-shortcut">Delete</span>
            </button>
            <button id="cmd-swap" class="dropdown-action">
              <span>🔄 Swap Alternatives</span>
              <span class="menu-shortcut">${IS_MAC ? 'Option+S' : 'Alt+S'}</span>
            </button>
            <button id="cmd-add" class="dropdown-action">
              <span>➕ Append New Step Card</span>
              <span class="menu-shortcut">Alt+N</span>
            </button>
            <button id="cmd-clear" class="dropdown-action">
              <span>🧼 Clear Selections</span>
              <span class="menu-shortcut">Esc</span>
            </button>
          </div>
        </div>

        <div class="menu-item">
          <button class="menu-trigger">Tools</button>
          <div class="menu-dropdown">
            <button id="cmd-reorder" class="dropdown-action">
              <span>🔄 Order Steps</span>
            </button>
          </div>
        </div>

        <div class="menu-item">
          <button class="menu-trigger">Window</button>
          <div class="menu-dropdown">
            <button id="cmd-open-shortcuts" class="dropdown-action">
              <span>⌨️ Keyboard Shortcuts...</span>
            </button>
            <button id="cmd-open-options" class="dropdown-action">
              <span>🔧 Options & Settings...</span>
            </button>
            <div class="menu-divider"></div>
            <button id="cmd-open-about" class="dropdown-action">
              <span>ℹ️ About ${APP_NAME}...</span>
            </button>
          </div>
        </div>

        <input type="file" id="file-import-hidden" accept=".json" style="display: none;" />
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

    <div id="modal-shortcuts" class="modal-overlay" style="display: none;">
      <div class="modal-window">
        <div class="modal-header">
          <h3>⌨️ Keyboard Shortcuts Reference</h3>
          <button id="modal-shortcuts-close" class="modal-close-x">&times;</button>
        </div>
        <div class="modal-body">
          <table class="shortcuts-table">
            <thead>
              <tr><th>Action</th><th>Shortcut Command</th></tr>
            </thead>
            <tbody>
              <tr><td>Select All Step Cards</td><td><code>${IS_MAC ? '⌘ + A' : 'Ctrl + A'}</code></td></tr>
              <tr><td>Cut Selected Step Cards</td><td><code>${IS_MAC ? '⌘ + X' : 'Ctrl + X'}</code></td></tr>
              <tr><td>Copy Selected Step Cards</td><td><code>${IS_MAC ? '⌘ + C' : 'Ctrl + C'}</code></td></tr>
              <tr><td>Paste Step Cards Below</td><td><code>${IS_MAC ? '⌘ + V' : 'Ctrl + V'}</code></td></tr>
              <tr><td>Append New Step Card</td><td><code>Alt + N</code></td></tr>
              <tr><td>Swap Alternative Rows</td><td><code>Alt + S</code></td></tr>
              <tr><td>Undo Last Action</td><td><code>${IS_MAC ? '⌘ + Z' : 'Ctrl + Z'}</code></td></tr>
              <tr><td>Redo Action</td><td><code>${IS_MAC ? '⌘ + Y' : 'Ctrl + Y'}</code></td></tr>
              <tr><td>Delete Selected step cards</td><td><code>Delete</code> / <code>Backspace</code></td></tr>
              <tr><td>Deselect all step cards</td><td><code>Escape</code></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="modal-options" class="modal-overlay" style="display: none;">
      <div class="modal-window">
        <div class="modal-header">
          <h3>🔧 Options & Settings</h3>
          <button id="modal-options-close" class="modal-close-x">&times;</button>
        </div>
        <div class="modal-body">
          <div class="settings-group">
            <h4>System Memory Rules</h4>
            <h4>View</h4>
          </div>
        </div>
      </div>
    </div>

    <div id="modal-about" class="modal-overlay" style="display: none;">
      <div class="modal-window" style="max-width: 400px;">
        <div class="modal-header">
          <h3>ℹ️ About Application</h3>
          <button id="modal-about-close" class="modal-close-x">&times;</button>
        </div>
        <div class="modal-body" style="text-align: center; padding: 20px 10px;">
          <h4 style="font-size: 18px; margin-bottom: 4px;">${APP_NAME}</h4>
          <p style="color: var(--color-text-muted); font-size: 13px; margin-bottom: 16px;">
            Version ${APP_VERSION} (2026 Engine Core)
          </p>
          <p style="font-size: 13px; line-height: 1.5; margin-bottom: 16px;">
            An interactive editor for writing classical biological dichotomous keys used to identify biological taxonomic units on morphological characters.
          </p>
          <div class="menu-divider" style="margin: 16px 0;"></div>
          <p style="font-size: 11px; color: var(--color-text-muted);">
            Written by Nils Ericson 2026<br>Released under the zlib license
          </p>
        </div>
      </div>
    </div>
    `;
}

/**
 * Synchronizes real-time application context, selection caches, history timelines, 
 * and clipboard state parameters directly into the desktop drop-down menu actions.
 */
export function renderMenu(store: KeyStore) {
    // Collect Context metrics from the App State Model
    const selectedCount = store.getSelectedIds().size;
    const hasSelection = selectedCount > 0;
    const hasKeyElements = store.getKey().length > 0;
    const hasClipboard = store.hasClipboardData();

    // Query Menu Items safely using exact structural IDs
    const saveBtn = document.querySelector('#cmd-save') as HTMLButtonElement | null;
    
    // Export Commands
    const expJsonBtn = document.querySelector('#cmd-export-json') as HTMLButtonElement | null;
    const expTextBtn = document.querySelector('#cmd-export-text') as HTMLButtonElement | null;
    const expHtmlBtn = document.querySelector('#cmd-export-html') as HTMLButtonElement | null;
    const expLatexBtn = document.querySelector('#cmd-export-latex') as HTMLButtonElement | null;

    // History Timeline Engine Actions
    const undoBtn = document.querySelector('#cmd-undo') as HTMLButtonElement | null;
    const redoBtn = document.querySelector('#cmd-redo') as HTMLButtonElement | null;

    // Selection/Card Specific Operations
    const cutBtn = document.querySelector('#cmd-cut') as HTMLButtonElement | null;
    const copyBtn = document.querySelector('#cmd-copy') as HTMLButtonElement | null;
    const pasteBtn = document.querySelector('#cmd-paste') as HTMLButtonElement | null;
    const deleteBtn = document.querySelector('#cmd-delete') as HTMLButtonElement | null;
    const swapBtn = document.querySelector('#cmd-swap') as HTMLButtonElement | null;
    const clearBtn = document.querySelector('#cmd-clear') as HTMLButtonElement | null;

    // Automation Systems
    const reorderBtn = document.querySelector('#cmd-reorder') as HTMLButtonElement | null;

    // Mutate UI elements according to live state rules safely
    if (saveBtn) {
        // Highlight when browser local storage synchronization requirements are uncommitted
        saveBtn.classList.toggle('has-unsaved-changes', store.hasUnsavedChanges());
    }

    // Export capabilities are locked out if the workspace canvas contains zero cards
    if (expJsonBtn) expJsonBtn.disabled = !hasKeyElements;
    if (expTextBtn) expTextBtn.disabled = !hasKeyElements;
    if (expHtmlBtn) expHtmlBtn.disabled = !hasKeyElements;
    if (expLatexBtn) expLatexBtn.disabled = !hasKeyElements;

    // Direct History Stack checks using our newly added KeyStore properties
    if (undoBtn) undoBtn.disabled = !store.canUndo;
    if (redoBtn) redoBtn.disabled = !store.canRedo;

    // Clipboard and mutating commands require active item context selection pool bindings
    if (cutBtn) cutBtn.disabled = !hasSelection;
    if (copyBtn) copyBtn.disabled = !hasSelection;
    if (deleteBtn) {
        deleteBtn.disabled = !hasSelection;
        deleteBtn.innerHTML = `<span>🗑️ Delete Selected Cards</span><span class="menu-shortcut">Delete</span>`;
    }
    if (swapBtn) {
        swapBtn.disabled = !hasSelection;
    }
    if (clearBtn) {
        clearBtn.disabled = !hasSelection;
    }

    // Paste is unblocked only if memory buffer houses matching structural configurations
    if (pasteBtn) pasteBtn.disabled = !hasClipboard;

    // Algorithmic optimization tool mapping rules
    if (reorderBtn) reorderBtn.disabled = !hasKeyElements;
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

            if (container.children[index] !== block) {
                container.insertBefore(block, container.children[index] || null);
            }
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