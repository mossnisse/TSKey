// uiRenderer.ts
import { KeyStore, APP_NAME, APP_VERSION } from './store.ts';
import { escapeHTML, buildIdToIndexMap, resolveDestination, IS_MAC } from './utils.ts';

// ==========================================
// CORE LAYOUT HELPERS
// ==========================================

/** Helper to target and patch changing attributes safely without dropping cursor focus */
function syncField(parent: HTMLElement, selector: string, value: string, forceUpdate = false): HTMLInputElement | HTMLTextAreaElement | null {
    const el = parent.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    if (!el) return null;

    if ((forceUpdate || document.activeElement !== el) && el.value !== value) {
        el.value = value;
    }
    return el;
}

// ==========================================
// RENDERING PIPELINES
// ==========================================

/**
 * Renders the structural core layout app shell. Fired once during initialization bootstrap.
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
              <span>📄 Export to Plain Text file(.txt)</span>
            </button>
            <button id="cmd-export-html" class="dropdown-action">
              <span>🌐 Export to Web Page (.html)</span>
            </button>
            <button id="cmd-export-latex" class="dropdown-action">
              <span>🔏 Export to LaTeX Document (.tex)</span>
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
            <button id="cmd-paste-below" class="dropdown-action">
              <span>📥 Paste steps below selection</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘V' : 'Ctrl+V'}</span>
            </button>
            <button id="cmd-paste-above" class="dropdown-action">
              <span>📥 Paste above selections</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘V' : 'Shift+Ctrl+V'}</span>
            </button>
            <button id="cmd-delete" class="dropdown-action">
              <span>🗑️ Delete Selected Cards</span>
              <span class="menu-shortcut">Delete</span>
            </button>
            <button id="cmd-swap" class="dropdown-action">
              <span>🔄 Swap place for Alternatives</span>
              <span class="menu-shortcut">${IS_MAC ? 'Option+S' : 'Alt+S'}</span>
            </button>
            <button id="cmd-add" class="dropdown-action">
              <span>➕ Append New Step</span>
              <span class="menu-shortcut">Alt+N</span>
            </button>
            <button id="cmd-clear" class="dropdown-action">
              <span>🧼 Clear Selections</span>
              <span class="menu-shortcut">Esc</span>
            </button>
            <button id="cmd-select-all" class="dropdown-action">
              <span>☑️ Select all steps</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘A' : 'Ctrl+A'}</span>
            </button>
          </div>
        </div>

        <div class="menu-item">
          <button class="menu-trigger">View</button>
          <div class="menu-dropdown">
            <button id="cmd-toggle-figures" class="dropdown-action">
              <span>🖼️ Hide Figures Panel</span>
              <span class="menu-shortcut">Ctrl+Shift+F</span>
            </button>
            <button id="cmd-toggle-print" class="dropdown-action">
              <span>🖨️ Hide Print Preview</span>
              <span class="menu-shortcut">Ctrl+Shift+P</span>
            </button>
          </div>
        </div>

        <div class="menu-item">
          <button class="menu-trigger">Tools</button>
          <div class="menu-dropdown">
            <button id="cmd-reorder-couplets" class="dropdown-action">
              <span>🔄 Order Steps</span>
            </button>
            <button id="cmd-reorder-figures" class="dropdown-action">
              <span>🔄 Order Figures</span>
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

        <input type="file" id="file-import-hidden" accept=".json" />
      </div>
    
      <div class="main-layout">
        <div class="editor-column">
          <h2 class="heading-editor">Key Node Canvas</h2>
          <div id="editor-container"></div>
          <button id="add-couplet-btn" class="btn-add-block">+ Add New Step Block (Alt+N)</button>
        </div>

        <div class="figure-column">
          <h2>Figures Reference Library</h2>
          <div id="figure-container"></div>
          <button id="add-figure-btn" class="btn-add-block">+ Add New Figure Attachment</button>
        </div>

        <div class="print-column">
          <h2>Live Publication Render</h2>
          <hr class="hr-print" />
          <div id="print-view-container" class="print-grid"></div>
        </div>
       
      </div>
    </div>

    <div id="modal-shortcuts" class="modal-overlay">
      <div class="modal-window">
        <div class="modal-header">
          <h3>⌨️ Keyboard Shortcuts</h3>
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
              <tr><td>Paste Step Cards Below selected steps</td><td><code>${IS_MAC ? '⌘ + V' : 'Ctrl + V'}</code></td></tr>
              <tr><td>Paste Step Cards Above selected steps</td><td><code>${IS_MAC ? 'Shift + ⌘ + V' : 'Shift + Ctrl + V'}</code></td></tr>
              <tr><td>Append New Step Card</td><td><code>Alt + N</code></td></tr>
              <tr><td>Swap Alternative Rows in selected steps</td><td><code>Alt + S</code></td></tr>
              <tr><td>Undo Last Action</td><td><code>${IS_MAC ? '⌘ + Z' : 'Ctrl + Z'}</code></td></tr>
              <tr><td>Redo Action</td><td><code>${IS_MAC ? '⌘ + Y' : 'Ctrl + Y'}</code></td></tr>
              <tr><td>Delete Selected step cards</td><td><code>Delete</code> / <code>Backspace</code></td></tr>
              <tr><td>Deselect all step cards</td><td><code>Escape</code></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="modal-options" class="modal-overlay">
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

    <div id="modal-about" class="modal-overlay">
      <div class="modal-window about-modal-window">
        <div class="modal-header">
          <h3>ℹ️ About</h3>
          <button id="modal-about-close" class="modal-close-x">&times;</button>
        </div>
        <div class="modal-body about-modal-body">
          <h4 class="about-title">${APP_NAME}</h4>
          <p class="about-version">
            Version ${APP_VERSION} (2026 Engine Core)
          </p>
          <p class="about-description">
            An interactive editor for writing classical biological dichotomous keys used to identify biological taxonomic units on morphological characters.
          </p>
          <div class="menu-divider about-divider"></div>
          <p class="about-credits">
            Written by Nils Ericson 2026<br>Released under the zlib license
          </p>
        </div>
      </div>
    </div>
    `;
}

/**
 * Synchronizes real-time application context for the Menu, disable/enables them.
 */
export function renderMenu(store: KeyStore) {
    const menuBar = document.querySelector('.app-menu-bar');
    if (!menuBar) return;

    const getBtn = (id: string) => document.getElementById(id) as HTMLButtonElement | null;

    const selectedCoupletCount = store.getSelectedCoupletIds().size;
    const selectedFigureCount = store.getSelectedFigureIds().size;
    const hasSelection = selectedCoupletCount > 0 || selectedFigureCount > 0;
    const hasKeyElements = store.getKey().length > 0;
    const hasClipboard = store.hasClipboardData();

    // File submenu
    const saveBtn = getBtn('cmd-save');
    const expJsonBtn = getBtn('cmd-export-json');
    const expTextBtn = getBtn('cmd-export-text');
    const expHtmlBtn = getBtn('cmd-export-html');
    const expLatexBtn = getBtn('cmd-export-latex');

    // Edit submenu
    const undoBtn = getBtn('cmd-undo');
    const redoBtn = getBtn('cmd-redo');
    const cutBtn = getBtn('cmd-cut');
    const copyBtn = getBtn('cmd-copy');
    const pasteBtnBelow = getBtn('cmd-paste-below');
    const pasteBtnAbove = getBtn('cmd-paste-above');
    const deleteBtn = getBtn('cmd-delete');
    const swapBtn = getBtn('cmd-swap');
    const clearBtn = getBtn('cmd-clear');

    // Tools submenu
    const reorderBtn = getBtn('cmd-reorder-couplets');

    // Mutate UI elements according to live state rules safely
    if (saveBtn) {
        saveBtn.classList.toggle('has-unsaved-changes', store.hasUnsavedChanges());
    }

    if (expJsonBtn) expJsonBtn.disabled = !hasKeyElements;
    if (expTextBtn) expTextBtn.disabled = !hasKeyElements;
    if (expHtmlBtn) expHtmlBtn.disabled = !hasKeyElements;
    if (expLatexBtn) expLatexBtn.disabled = !hasKeyElements;

    if (undoBtn) undoBtn.disabled = !store.canUndo;
    if (redoBtn) redoBtn.disabled = !store.canRedo;

    if (cutBtn) cutBtn.disabled = !hasSelection;
    if (copyBtn) copyBtn.disabled = !hasSelection;
    if (deleteBtn) {
        deleteBtn.disabled = !hasSelection;
    }
    if (swapBtn) {
        swapBtn.disabled = !hasSelection;
    }
    if (clearBtn) {
        clearBtn.disabled = !hasSelection;
    }

    if (pasteBtnBelow) pasteBtnBelow.disabled = !hasClipboard;
    if (pasteBtnAbove) pasteBtnAbove.disabled = !hasClipboard;

    if (reorderBtn) reorderBtn.disabled = !hasKeyElements;

    // view menu synchronization 
    // also hides and shows the actuall panels, so in the wrong place
    const toggleFiguresBtn = getBtn('cmd-toggle-figures');
    const togglePrintBtn = getBtn('cmd-toggle-print');
    const figureColumn = document.querySelector('.figure-column');
    const printColumn = document.querySelector('.print-column');

    if (toggleFiguresBtn && figureColumn) {
        const isHidden = figureColumn.classList.contains('is-hidden');
        const label = toggleFiguresBtn.querySelector('span');
        if (label) {
            label.textContent = isHidden ? '🖼️ Show Figures Panel' : '🖼️ Hide Figures Panel';
        }
    }

    if (togglePrintBtn && printColumn) {
        const isHidden = printColumn.classList.contains('is-hidden');
        const label = togglePrintBtn.querySelector('span');
        if (label) {
            label.textContent = isHidden ? '🖨️ Show Print Preview' : '🖨️ Hide Print Preview';
        }
    }
}

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
        const dest1 = resolveDestination(couplet.link1, couplet.taxa1, idToIndexMap);
        const dest2 = resolveDestination(couplet.link2, couplet.taxa2, idToIndexMap);
        const cardErrors = activeDiagnostics.get(couplet.id) || [];
        const computedTitle = `${displayNum}.`;
        const badgeClass = inboundLinks.length ? 'badge badge-linked' : (index === 0 ? 'badge badge-linked' : 'badge badge-isolated');
        const badgeLabel = inboundLinks.length ? `← ${inboundLinks.join(', ')}` : (index === 0 ? '🏁 root' : '⚠️ isolated');

        let warningInnerHtml = '';
        cardErrors.forEach(err => {
            const modifierClass = err.severity === 'error' ? 'error-text' : 'warning-text';
            warningInnerHtml += `<span class="${modifierClass}">⚠️ ${escapeHTML(err.message)}</span>`;
        });
        const warningBlockHtml = cardErrors.length > 0 ? `<div class="warning-block">${warningInnerHtml}</div>` : '';

        let card = existingMap.get(couplet.id);
        if (card) {
            existingMap.delete(couplet.id);
            card.classList.toggle('is-selected', isSelected);

            const titleEl = card.querySelector('.card-title');
            if (titleEl && titleEl.textContent !== computedTitle) titleEl.textContent = computedTitle;

            const badgeEl = card.querySelector('.badge');
            if (badgeEl) {
                badgeEl.className = badgeClass;
                if (badgeEl.textContent !== badgeLabel) badgeEl.textContent = badgeLabel;
            }

            syncField(card, 'textarea[data-field="alt1"]', couplet.alt1);
            const dest1El = syncField(card, 'input[data-field="dest1"]', dest1.inputValue);
            dest1El?.classList.toggle('input-error', dest1.isUnresolved);

            syncField(card, 'textarea[data-field="alt2"]', couplet.alt2);
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
                      <input type="text" class="input-sync input-destination ${dest1.isUnresolved ? 'input-error' : ''}" data-field="dest1" placeholder="Taxon or Step #" value="${escapeHTML(dest1.inputValue)}" />
                    </label>
                  </div>
                </div>
                <div class="card-row">
                  <textarea class="input-sync card-textarea" data-field="alt2" placeholder="Enter contrast alternative description...">${escapeHTML(couplet.alt2)}</textarea>
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

export function renderFigures(store: KeyStore) {
    const column = document.querySelector('.figure-column');
    if (!column || column.classList.contains('is-hidden')) return;

    const container = document.getElementById('figure-container');
    if (!container) return;

    const figures = store.getFigures();

    // Map existing DOM child blocks securely to optimize focus states
    const existingBlocks = Array.from(container.children) as HTMLElement[];
    const existingMap = new Map<number, HTMLElement>();
    existingBlocks.forEach(block => {
        const id = Number(block.getAttribute('data-id'));
        if (!isNaN(id)) existingMap.set(id, block);
    });

    figures.forEach((fig, index) => {
        const displayNum = index + 1;
        const isSelected = store.getSelectedFigureIds().has(fig.id);
        let block = existingMap.get(fig.id);

        if (!block) {
            block = document.createElement('div');
            block.className = 'figure-card';
            block.setAttribute('data-id', fig.id.toString());
            block.innerHTML = `
                <div class="figure-card-header">
                    <span class="figure-label">Figure ${displayNum}.</span>
                    <span class="figure-id-tag"><code> ID: ${fig.id}</code></span>
                </div>
                <div class="figure-field-row">
                    <label>Filename:</label>
                    <input type="text" class="input-sync figure-input-filename" data-field="filename" />
                </div>
                <div class="figure-field-row">
                    <label>Caption:</label>
                    <textarea class="input-sync figure-input-caption" data-field="caption" rows="2"></textarea>
                </div>
            `;
        } else {
            // Update sequence tracking configurations
            const labelEl = block.querySelector('.figure-label');
            // Added trailing period back to keep the format identical to the initial render template
            if (labelEl) labelEl.textContent = `Figure ${displayNum}.`;
            existingMap.delete(fig.id);
        }

        container.appendChild(block);
        block.classList.toggle('is-selected', isSelected);

        // Sync form element content safely without dropping typing caret locations
        const fileInput = block.querySelector('.figure-input-filename') as HTMLInputElement;
        if (fileInput && document.activeElement !== fileInput && fileInput.value !== fig.filename) {
            fileInput.value = fig.filename;
        }

        const captionInput = block.querySelector('.figure-input-caption') as HTMLTextAreaElement;
        if (captionInput && document.activeElement !== captionInput && captionInput.value !== fig.caption) {
            captionInput.value = fig.caption;
        }
    });

    // Clean up residual elements safely from deletion sweeps
    existingMap.forEach(block => block.remove());
}

/**
 * Renders the passive publication presentation view structure.
 */
export function renderPrintView(store: KeyStore) {
    const column = document.querySelector('.print-column');
    if (!column || column.classList.contains('is-hidden')) return;
    
    const container = document.getElementById('print-view-container');
    if (!container) return;

    const key = store.getKey();
    const idToIndexMap = buildIdToIndexMap(key);

    const existingBlocks = Array.from(container.querySelectorAll('.print-step-block')) as HTMLElement[];
    const existingMap = new Map<number, HTMLElement>();

    existingBlocks.forEach(block => {
        const idAttr = block.getAttribute('data-id');
        if (idAttr) existingMap.set(Number(idAttr), block);
    });

    key.forEach((c, index) => {
        const currentDisplayNum = index + 1;

        const dest1 = resolveDestination(c.link1, c.taxa1, idToIndexMap);
        const dest2 = resolveDestination(c.link2, c.taxa2, idToIndexMap);

        const val1 = store.resolveTextReferences(c.alt1) || '___';
        const val2 = store.resolveTextReferences(c.alt2) || '___';

        let block = existingMap.get(c.id);

        if (block) {
            existingMap.delete(c.id);

            const stepNumEl = block.querySelector('.print-step-num');
            if (stepNumEl && stepNumEl.textContent !== `${currentDisplayNum}.`) {
                stepNumEl.textContent = `${currentDisplayNum}.`;
            }

            const txt1 = block.querySelector('.print-row[data-choice="1"] .print-text');
            if (txt1 && txt1.textContent !== val1) txt1.textContent = val1;

            const dest1El = block.querySelector('.print-row[data-choice="1"] .print-dest');
            if (dest1El) {
                if (dest1El.textContent !== dest1.printText) dest1El.textContent = dest1.printText;
                const expectedClass = `print-dest ${dest1.printClass}`.trim();
                if (dest1El.className !== expectedClass) dest1El.className = expectedClass;
            }

            const txt2 = block.querySelector('.print-row[data-choice="2"] .print-text');
            if (txt2 && txt2.textContent !== val2) txt2.textContent = val2;

            const dest2El = block.querySelector('.print-row[data-choice="2"] .print-dest');
            if (dest2El) {
                if (dest2El.textContent !== dest2.printText) dest2El.textContent = dest2.printText;
                const expectedClass = `print-dest ${dest2.printClass}`.trim();
                if (dest2El.className !== expectedClass) dest2El.className = expectedClass;
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

            const dest1El = block.querySelector('.print-row[data-choice="1"] .print-dest');
            if (dest1El) {
                dest1El.textContent = dest1.printText;
                if (dest1.printClass) dest1El.className = `print-dest ${dest1.printClass}`.trim();
            }

            const txt2 = block.querySelector('.print-row[data-choice="2"] .print-text');
            if (txt2) txt2.textContent = val2;

            const dest2El = block.querySelector('.print-row[data-choice="2"] .print-dest');
            if (dest2El) {
                dest2El.textContent = dest2.printText;
                if (dest2.printClass) dest2El.className = `print-dest ${dest2.printClass}`.trim();
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

        container.setAttribute('aria-live', 'polite');

        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    if (type === 'error') {
        toast.setAttribute('role', 'alert');
    } else {
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