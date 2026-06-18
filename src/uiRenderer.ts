// uiRenderer.ts
import { KeyStore, APP_NAME, APP_VERSION } from './store.ts';
import { UIStateStore } from './uiState.ts';
import { escapeHTML, buildIdToIndexMap, resolveDestination, IS_MAC, buildFigureIdToDisplayNumMap } from './utils.ts';
import { workspaceStorage, activeObjectURLs } from './db.ts';

// ==========================================
// CORE LAYOUT HELPERS
// ==========================================

let pendingFigureRefresh: number | null = null;

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
      <div class="app-menu-bar" role="menubar" aria-label="Application Menu">

        <div class="menu-item" role="none">
          <button id="menu-file-trigger" class="menu-trigger" 
                  role="menuitem" 
                  aria-haspopup="menu" 
                  aria-expanded="false">File</button>
          
          <div class="menu-dropdown" role="menu" aria-labelledby="menu-file-trigger">
            <button id="cmd-new" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📄 New Key</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘⌥N' : 'Ctrl+Alt+N'}</span>
            </button>
            <button id="cmd-open-dialog" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📂 Open Key Workspace...</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘O' : 'Ctrl+O'}</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-save" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>💾 Save</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘S' : 'Ctrl+S'}</span>
            </button>
            <button id="cmd-save-as" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>💾 Save As...</span>
              <span class="menu-shortcut">${IS_MAC ? '⇧⌘S' : 'Ctrl+Shift+S'}</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-trigger-import" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📤 Import Native File (.tskey)...</span>
            </button>
            <button id="cmd-export-json" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📥 Export Native File (.tskey)</span>
            </button>
            <div class="menu-divider"></div>
            <button id="cmd-import-text" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📋 Import from Plain Text...</span>
            </button>
            <button id="cmd-export-text" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📄 Export to Plain Text (.txt)</span>
            </button>
            <button id="cmd-export-html" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🌐 Export to Web Page (.html)</span>
            </button>
            <button id="cmd-export-latex" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔏 Export to LaTeX Document (.tex)</span>
            </button>
          </div>
        </div>

        <div class="menu-item" role="none">
          <button class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">Edit</button>
          <div class="menu-dropdown" role="menu">
            <button id="cmd-undo" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔄 Undo</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘Z' : 'Ctrl+Z'}</span>
            </button>
            <button id="cmd-redo" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔁 Redo</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘Y / ⌘⇧Z' : 'Ctrl+Y / Ctrl+Shift+Z'}</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-cut" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>✂️ Cut Selected Cards</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘X' : 'Ctrl+X'}</span>
            </button>
            <button id="cmd-copy" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📋 Copy Selected Cards</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘C' : 'Ctrl+C'}</span>
            </button>
            <button id="cmd-paste-below" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📥 Paste steps below selection</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘V' : 'Ctrl+V'}</span>
            </button>
            <button id="cmd-paste-above" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📥 Paste above selections</span>
              <span class="menu-shortcut">${IS_MAC ? 'Shift+⌘V' : 'Shift+Ctrl+V'}</span>
            </button>
            <button id="cmd-delete" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🗑️ Delete Selected Cards</span>
              <span class="menu-shortcut">Delete</span>
            </button>
            <button id="cmd-swap" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔄 Swap place for Alternatives</span>
              <span class="menu-shortcut">${IS_MAC ? 'Option+S' : 'Alt+S'}</span>
            </button>
            <button id="cmd-add" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>➕ Append New Step</span>
              <span class="menu-shortcut">Alt+N</span>
            </button>
            <button id="cmd-clear" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🧼 Clear Selections</span>
              <span class="menu-shortcut">Esc</span>
            </button>
            <button id="cmd-select-all" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>☑️ Select all steps</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘A' : 'Ctrl+A'}</span>
            </button>
          </div>
        </div>

        <div class="menu-item" role="none">
          <button class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">View</button>
          <div class="menu-dropdown" role="menu">
            <button id="cmd-toggle-figures" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🖼️ Hide Figures Panel</span>
              <span class="menu-shortcut">Ctrl+Shift+F</span>
            </button>
            <button id="cmd-toggle-images" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🖼️ Hide Images in Figures Panel</span>
            </button>
            <button id="cmd-toggle-print" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🖨️ Hide Print Preview</span>
              <span class="menu-shortcut">Ctrl+Shift+P</span>
            </button>
          </div>
        </div>

        <div class="menu-item" role="none">
          <button class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">Tools</button>
          <div class="menu-dropdown" role="menu">
            <button id="cmd-reorder-couplets" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔄 Order Steps</span>
            </button>
            <button id="cmd-reorder-figures" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔄 Order Figures</span>
            </button>
          </div>
        </div>

        <div class="menu-item" role="none">
          <button class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">Window</button>
          <div class="menu-dropdown" role="menu">
            <button id="cmd-open-shortcuts" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>⌨️ Keyboard Shortcuts...</span>
            </button>
            <button id="cmd-open-options" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔧 Options & Settings...</span>
            </button>
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-open-about" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>ℹ️ About ${APP_NAME}...</span>
            </button>
          </div>
        </div>

        <div class="menu-title-container" style="margin-left: auto; display: flex; align-items: center; padding-right: 12px;">
          <label for="key-title-input" style="color: #fff; font-size: 12px; margin-right: 8px; font-weight: 500;">Title:</label>
          <input 
            type="text" 
            id="key-title-input" 
            class="key-title-input" 
            placeholder="Untitled Key"
           style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); color: black; padding: 4px 8px; border-radius: 4px; font-size: 13px; width: 220px;" 
        />
    </div>

        <input type="file" id="file-import-hidden" accept=".tskey,.json" />
      </div>
    
      <div class="main-layout">
        <div class="editor-column">
          <h2>Key Editor: <span id="active-project-title">Untitled Key</span></h2>
          <div id="editor-container"></div>
          <button id="add-couplet-btn" class="btn-add-block">+ Add New Step Block (Alt+N)</button>
        </div>

        <div class="figure-column">
          <h2>Figure References</h2>
          <div id="figure-container"></div>
          <button id="add-figure-btn" class="btn-add-block">+ Add New Figure Attachment</button>
        </div>

        <div class="print-column">
          <h2>Live Publication View</h2>
          <hr class="hr-print" />
          <div id="print-view-container" class="print-grid"></div>
        </div>
       
      </div>
    </div>

    <div id="modal-open-project" class="modal-overlay" style="display: none;">
      <div class="modal-window" style="max-width: 520px;">
        <div class="modal-header">
          <h3>📂 Open Key Workspace</h3>
          <button id="modal-project-close" class="modal-close-x">&times;</button>
        </div>
        <div class="modal-body">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <span style="font-size: 13px; color: var(--color-text-muted);">Stored browser keys:</span>
            <button id="btn-hub-import" class="btn btn-secondary" style="font-size: 12px; padding: 4px 10px;">+ Import File</button>
          </div>
          <div id="project-hub-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; padding-right: 4px;">
             </div>
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
              <tr><td>Create Brand New Project Workspace</td><td><code>${IS_MAC ? '⌘ + Option + N' : 'Ctrl + Alt + N'}</code></td></tr>
              <tr><td>Open Local Workspace Hub Window</td><td><code>${IS_MAC ? '⌘ + O' : 'Ctrl + O'}</code></td></tr>
              <tr><td>Save Current Key changes</td><td><code>${IS_MAC ? '⌘ + S' : 'Ctrl + S'}</code></td></tr>
              <tr><td>Save Current Key under alternative title</td><td><code>Shift + ${IS_MAC ? '⌘ + S' : 'Ctrl + S'}</code></td></tr>
              <tr><td>Select All Step Cards</td><td><code>${IS_MAC ? '⌘ + A' : 'Ctrl + A'}</code></td></tr>
              <tr><td>Cut Selected Step Cards</td><td><code>${IS_MAC ? '⌘ + X' : 'Ctrl + X'}</code></td></tr>
              <tr><td>Copy Selected Step Cards</td><td><code>${IS_MAC ? '⌘ + C' : 'Ctrl + C'}</code></td></tr>
              <tr><td>Paste Step Cards Below selected steps</td><td><code>${IS_MAC ? '⌘ + V' : 'Ctrl + V'}</code></td></tr>
              <tr><td>Paste Step Cards Above selected steps</td><td><code>Shift + ${IS_MAC ? 'Shift + ⌘ + V' : 'Shift + Ctrl + V'}</code></td></tr>
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

    <div id="plain-text-import-view" class="fullscreen-view" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="pt-import-title-label" tabindex="-1">
      <div class="fullscreen-view-header">
        <h3 id="pt-import-title-label">📋 Import Key from Plain Text</h3>
        <button id="pt-import-close" class="modal-close-x" aria-label="Close import view">&times;</button>
      </div>

      <div class="import-options-bar" role="group" aria-label="Parsing options">
        <span class="import-options-title">Parsing options</span>
        <label class="import-option"><input type="checkbox" id="pt-opt-join" checked /> Join wrapped lines</label>
        <label class="import-option"><input type="checkbox" id="pt-opt-dehyphen" checked /> De-hyphenate breaks</label>
        <label class="import-option"><input type="checkbox" id="pt-opt-ws" checked /> Spaces/Tab separator</label>
        <label class="import-option"><input type="checkbox" id="pt-opt-lettered" checked /> Lettered (1a/1b)</label>
        <label class="import-option"><input type="checkbox" id="pt-opt-dash" checked /> Dash second line</label>
        <label class="import-option"><input type="checkbox" id="pt-opt-fill" checked /> Fill missing couplets</label>
        <label class="import-option import-option-num">Min leader dots
          <input type="number" id="pt-opt-min-dots" min="2" max="10" step="1" value="3" />
        </label>
      </div>

      <div class="fullscreen-view-body import-view-body">
        <section class="import-input-pane">
          <div class="import-pane-toolbar">
            <label for="pt-import-source" class="import-pane-label">Paste your key, or load a text file</label>
            <div class="import-toolbar-actions">
              <button id="pt-import-load-file" class="btn btn-secondary">📂 Load .txt File...</button>
              <button id="pt-import-clear" class="btn btn-outline">Clear</button>
            </div>
          </div>
          <textarea id="pt-import-source" class="import-source-textarea" spellcheck="false"
            placeholder="1.&#9;Has feathers&#9;Bird&#10;&#8212;&#9;Lacks feathers&#9;2&#10;&#10;2.&#9;Has fur&#9;Mammal&#10;&#8212;&#9;Has scales&#9;Reptile"></textarea>
          <input type="file" id="pt-import-file-hidden" accept=".txt,text/plain" style="display: none;" />
          <p class="import-hint">
            Paste a key in almost any layout. Each step starts with a number (<code>1</code>, <code>1.</code>, <code>1a</code>/<code>1b</code>)
            and the second alternative may start with a dash (<code>-</code> <code>–</code> <code>—</code>). The destination — a step number
            or a taxon name — is whatever follows a dotted leader (<code>……</code>), a tab, or wide spacing at the end of the lead.
            Lines wrapped across a page (common in PDFs) are stitched back together. Tune the options above and watch the preview.
            The result is best-effort and may need a little manual cleanup.
          </p>
        </section>

        <section class="import-preview-pane">
          <div class="import-pane-toolbar">
            <span class="import-pane-label">Preview</span>
            <span id="pt-import-status" class="import-status"></span>
          </div>
          <div id="pt-import-preview" class="import-preview-content"></div>
        </section>
      </div>

      <div class="fullscreen-view-footer">
        <label class="import-title-field">
          Import as:
          <input type="text" id="pt-import-title" placeholder="Imported Key" />
        </label>
        <div class="import-footer-actions">
          <button id="pt-import-cancel" class="btn btn-secondary">Cancel</button>
          <button id="pt-import-confirm" class="btn btn-primary" disabled>Import into Workspace</button>
        </div>
      </div>
    </div>
    `;
}

/**
 * Syncs DOM panel visibility classes FROM UIStateStore — the single source of truth.
 * Must be called at the top of every refreshAll() cycle, before any render function.
 */
export function applyPanelVisibility(uiState: UIStateStore): void {
    document.querySelector('.figure-column')?.classList.toggle('is-hidden', uiState.isFiguresHidden);
    document.querySelector('.print-column')?.classList.toggle('is-hidden', uiState.isPrintHidden);
}

/**
 * Synchronizes real-time application context for the Menu, disable/enables them.
 */
export function renderMenu(store: KeyStore, uiState: UIStateStore) {
    const menuBar = document.querySelector('.app-menu-bar');
    if (!menuBar) return;

    const getBtn = (id: string) => document.getElementById(id) as HTMLButtonElement | null;

    const selectedCoupletCount = store.getSelectedCoupletIds().size;
    const selectedFigureCount = store.getSelectedFigureIds().size;
    const hasSelection = selectedCoupletCount > 0 || selectedFigureCount > 0;
    const hasCoupletSelection = selectedCoupletCount > 0;
    const hasKeyElements = store.getKey().length > 0;
    const hasClipboard = store.hasClipboardData();

    // Contextual Sync for current key title & modification indicators
    const currentTitle = store.getProjectName();
    const isUnsaved = store.hasUnsavedChanges();
    const formattedTitleText = `${currentTitle}${isUnsaved ? ' *' : ''}`;

    document.title = `${formattedTitleText} - ${APP_NAME}`;
    const headerTitleEl = document.getElementById('active-project-title');
    if (headerTitleEl && headerTitleEl.textContent !== formattedTitleText) {
        headerTitleEl.textContent = formattedTitleText;
    }

    // File Submenu Action items
    const saveBtn = getBtn('cmd-save');
    const expJsonBtn = getBtn('cmd-export-json');
    const expTextBtn = getBtn('cmd-export-text');
    const expHtmlBtn = getBtn('cmd-export-html');
    const expLatexBtn = getBtn('cmd-export-latex');

    // Edit Submenu Action items
    const undoBtn = getBtn('cmd-undo');
    const redoBtn = getBtn('cmd-redo');
    const cutBtn = getBtn('cmd-cut');
    const copyBtn = getBtn('cmd-copy');
    const pasteBtnBelow = getBtn('cmd-paste-below');
    const pasteBtnAbove = getBtn('cmd-paste-above');
    const deleteBtn = getBtn('cmd-delete');
    const swapBtn = getBtn('cmd-swap');
    const clearBtn = getBtn('cmd-clear');

    // Tools Submenu Action items
    const reorderBtn = getBtn('cmd-reorder-couplets');

    if (saveBtn) {
        saveBtn.classList.toggle('has-unsaved-changes', isUnsaved);
    }

    if (expJsonBtn) expJsonBtn.disabled = !hasKeyElements;
    if (expTextBtn) expTextBtn.disabled = !hasKeyElements;
    if (expHtmlBtn) expHtmlBtn.disabled = !hasKeyElements;
    if (expLatexBtn) expLatexBtn.disabled = !hasKeyElements;

    if (undoBtn) undoBtn.disabled = !store.canUndo;
    if (redoBtn) redoBtn.disabled = !store.canRedo;

    if (cutBtn) cutBtn.disabled = !hasCoupletSelection;
    if (copyBtn) copyBtn.disabled = !hasCoupletSelection;
    if (deleteBtn) deleteBtn.disabled = !hasSelection;
    if (swapBtn) swapBtn.disabled = !hasCoupletSelection;
    if (clearBtn) clearBtn.disabled = !hasSelection;

    if (pasteBtnBelow) pasteBtnBelow.disabled = !hasClipboard;
    if (pasteBtnAbove) pasteBtnAbove.disabled = !hasClipboard;

    if (reorderBtn) reorderBtn.disabled = !hasKeyElements;

    // View submenus
    const toggleFiguresBtn = getBtn('cmd-toggle-figures');
    const toggleImagesBtn = getBtn('cmd-toggle-images');
    const togglePrintBtn = getBtn('cmd-toggle-print');

    if (toggleFiguresBtn) {
        const label = toggleFiguresBtn.querySelector('span');
        if (label) {
            label.textContent = uiState.isFiguresHidden ? '🖼️ Show Figures Panel' : '🖼️ Hide Figures Panel';
        }
    }

    if (toggleImagesBtn) {
        const label = toggleImagesBtn.querySelector('span');
        if (label) {
            label.textContent = uiState.isImagesHidden ? '🖼️ Show Images in Figures Panel' : '🖼️ Hide Images in Figures Panel';
        }
    }

    if (togglePrintBtn) {
        const label = togglePrintBtn.querySelector('span');
        if (label) {
            label.textContent = uiState.isPrintHidden ? '🖨️ Show Print Preview' : '🖨️ Hide Print Preview';
        }
    }

    // update key title from the menu bar #key-title-input
    // where should it be in the code?
    const appShell = document.querySelector('.app-shell') as HTMLElement;
    if (appShell) {
        syncField(appShell, '#key-title-input', store.getTitle());
    }
}

/**
 * Populates and updates rows inside the asynchronous Project Hub Modal view template.
 */
export function renderProjectHubList(projects: Array<{ name: string; lastModified: number }>, currentProjectName: string) {
    const container = document.getElementById('project-hub-list');
    if (!container) return;

    if (projects.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--color-text-muted); padding: 24px 12px; font-size: 13px; border: 1px dashed var(--color-border); border-radius: var(--radius-md);">
                No keys saved inside local browser memory yet.
            </div>`;
        return;
    }

    container.innerHTML = projects.map(proj => {
        const isCurrent = proj.name === currentProjectName;
        const dateString = new Date(proj.lastModified).toLocaleString();

        return `
            <div class="project-hub-item" data-name="${escapeHTML(proj.name)}" 
                 style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; 
                        border: 1px solid ${isCurrent ? 'var(--color-primary)' : 'var(--color-border-light)'}; 
                        background: ${isCurrent ? 'var(--color-primary-light)' : 'var(--color-bg)'}; 
                        border-radius: var(--radius-md); transition: var(--transition-base);">
                <div class="hub-item-clickable-zone" data-action="load" data-name="${escapeHTML(proj.name)}"
                     style="cursor: pointer; flex: 1; display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-weight: ${isCurrent ? '700' : '500'}; color: var(--color-text); font-size: 14px;">
                        ${escapeHTML(proj.name)} ${isCurrent ? '<small style="color: var(--color-primary); margin-left: 4px; font-weight: normal;">(active)</small>' : ''}
                    </span>
                    <span style="font-size: 11px; color: var(--color-text-muted);">Last saved: ${dateString}</span>
                </div>
                <button class="btn-hub-delete" data-action="delete" data-name="${escapeHTML(proj.name)}" 
                        style="background: transparent; border: none; color: var(--color-text-muted); 
                               cursor: pointer; font-size: 18px; padding: 4px 8px; line-height: 1; 
                               border-radius: var(--radius-sm); transition: var(--transition-base);" 
                        title="Delete from local database"
                        onmouseover="this.style.color='var(--color-danger)';this.style.backgroundColor='var(--color-danger-light)'"
                        onmouseout="this.style.color='var(--color-text-muted)';this.style.backgroundColor='transparent'">&times;</button>
            </div>
        `;
    }).join('');
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
        const dest1 = resolveDestination(couplet.branch1, idToIndexMap);
        const dest2 = resolveDestination(couplet.branch2, idToIndexMap);
        const cardErrors = activeDiagnostics.get(couplet.id) || [];
        const computedTitle = `${displayNum}.`;
        const badgeClass = inboundLinks.length ? 'badge badge-linked' : (index === 0 ? 'badge badge-linked' : 'badge badge-isolated');
        const badgeLabel = inboundLinks.length ? `← ${inboundLinks.join(', ')}` : (index === 0 ? '🏁 root' : '⚠️ isolated');

        let warningInnerHtml = '';
        cardErrors.forEach(err => {
            const modifierClass = err.severity === 'error' ? 'error-text' : 'warning-text';
            warningInnerHtml += `<div class="${modifierClass}">⚠️ ${escapeHTML(err.message)}</div>`;
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

            card.innerHTML = `
                <div class="card-header">
                  <div class="card-header-left">
                    <h4 class="card-title">${computedTitle}</h4>
                    <span class="${badgeClass}">${badgeLabel}</span>
                  </div>
                  <span class="drag-handle">☰</span>
                </div>
                <div class="card-row">
                  <textarea class="input-sync card-textarea" data-field="alt1" placeholder="Enter diagnostic trait details...">${escapeHTML(store.decodeTextReferencesForEditor(couplet.alt1))}</textarea>
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

export function renderFigures(store: KeyStore, uiState: UIStateStore, refreshAll: () => void) {
    if (uiState.isFiguresHidden) return;

    const container = document.getElementById('figure-container');
    if (!container) return;

    const figures = store.getFigures();

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
            block.draggable = true;
            block.innerHTML = `
                <div class="figure-card-header">
                    <span class="figure-card-title">${displayNum}.</span>
                </div>
                
                <div class="figure-preview-wrapper">
                    <img class="figure-preview-img" alt="Figure view" style="display: none;" />
                    <div class="figure-upload-overlay">
                        <button type="button" class="btn-trigger-upload">Choose Image</button>
                        <button type="button" class="btn-remove-image" style="display: none;">Remove Image</button>
                        <input type="file" class="hidden-file-picker" accept="image/*" style="display: none;" />
                    </div>
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
            const labelEl = block.querySelector('.figure-card-title');
            if (labelEl) labelEl.textContent = `${displayNum}.`;
            existingMap.delete(fig.id);
        }

        if (container.children[index] !== block) {
            container.insertBefore(block, container.children[index] || null);
        }
        block.classList.toggle('is-selected', isSelected);

        const previewWrapper = block.querySelector('.figure-preview-wrapper') as HTMLElement;
        const previewImg = block.querySelector('.figure-preview-img') as HTMLImageElement;

        if (uiState.isImagesHidden) {
            if (previewWrapper) previewWrapper.style.display = 'none';
            if (previewImg) previewImg.style.display = 'none';
        } else {
            if (previewWrapper) previewWrapper.style.display = '';

            const cachedUrl = activeObjectURLs.get(fig.id);
            const removeBtn = block.querySelector('.btn-remove-image') as HTMLButtonElement | null;

            if (cachedUrl) {
                if (previewImg.src !== cachedUrl) {
                    previewImg.src = cachedUrl;
                }
                previewImg.style.display = 'block';
                if (removeBtn) removeBtn.style.display = 'inline-block';
            } else {
                if (!previewImg.hasAttribute('data-loading-state')) {
                    previewImg.setAttribute('data-loading-state', 'pending');

                    workspaceStorage.getFigureBinary(store.getProjectName(), fig.id).then(blob => {
                        previewImg.removeAttribute('data-loading-state');
                        if (blob) {
                            const newUrl = URL.createObjectURL(blob);
                            activeObjectURLs.set(fig.id, newUrl);
                            if (pendingFigureRefresh === null) {
                                pendingFigureRefresh = requestAnimationFrame(() => {
                                    pendingFigureRefresh = null;
                                    refreshAll();
                                });
                            }
                        } else {
                            previewImg.style.display = 'none';
                            if (removeBtn) removeBtn.style.display = 'none';
                        }
                    }).catch((err) => {
                        console.error("Failed to load binary thumbnail:", err);
                        previewImg.removeAttribute('data-loading-state');
                        if (removeBtn) removeBtn.style.display = 'none';
                    });
                }
            }
        }

        const fileInput = block.querySelector('.figure-input-filename') as HTMLInputElement;
        if (fileInput && document.activeElement !== fileInput && fileInput.value !== fig.filename) {
            fileInput.value = fig.filename;
        }

        const captionInput = block.querySelector('.figure-input-caption') as HTMLTextAreaElement;
        if (captionInput && document.activeElement !== captionInput && captionInput.value !== fig.caption) {
            captionInput.value = fig.caption;
        }
    });

    existingMap.forEach(block => block.remove());
    const currentFigIds = new Set(figures.map(f => f.id));

    for (const [id, url] of activeObjectURLs.entries()) {
        if (!currentFigIds.has(id)) {
            URL.revokeObjectURL(url);
            activeObjectURLs.delete(id);
        }
    }
}

/**
 * Renders the passive publication presentation view structure.
 */
export function renderPrintView(store: KeyStore, uiState: UIStateStore) {
    if (uiState.isPrintHidden) return;

    const container = document.getElementById('print-view-container');
    if (!container) return;

    const key = store.getKey();
    const idToIndexMap = buildIdToIndexMap(key);
    const figDisplayMap = buildFigureIdToDisplayNumMap(store.getFigures());

    const existingBlocks = Array.from(container.querySelectorAll('.print-step-block')) as HTMLElement[];
    const existingMap = new Map<number, HTMLElement>();

    existingBlocks.forEach(block => {
        const idAttr = block.getAttribute('data-id');
        if (idAttr) existingMap.set(Number(idAttr), block);
    });

    key.forEach((c, index) => {
        const currentDisplayNum = index + 1;

        const dest1 = resolveDestination(c.branch1, idToIndexMap);
        const dest2 = resolveDestination(c.branch2, idToIndexMap);

        const val1 = store.resolveTextReferences(c.alt1, figDisplayMap) || '___';
        const val2 = store.resolveTextReferences(c.alt2, figDisplayMap) || '___';

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

            block.innerHTML = `
                 <div class="print-step-num"></div>
                <div class="print-row" data-choice="1">
                  <span class="print-text"></span>
                  <span class="print-dest"></span>
                </div>
                <div class="print-dash">—</div>
                <div class="print-row" data-choice="2">
                  <span class="print-text"></span>
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

    setTimeout(() => {
        toast.remove();
        if (container && container.childElementCount === 0) {
            container.remove();
        }
    }, 3000);
}