// ui/shell.ts
// The one-time application shell HTML (menu bar, three-column layout, modals, and the
// plain-text import view) plus the panel-visibility sync.
import { APP_NAME, APP_VERSION } from '../store.ts';
import type { UIStateStore } from '../uiState.ts';
import { IS_MAC } from '../utils.ts';

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
          <button id="menu-edit-trigger" class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">Edit</button>
          <div class="menu-dropdown" role="menu" aria-labelledby="menu-edit-trigger">
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
              <span>✂️ Cut Selected Steps</span>
              <span class="menu-shortcut">${IS_MAC ? '⌘X' : 'Ctrl+X'}</span>
            </button>
            <button id="cmd-copy" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>📋 Copy Selected Steps</span>
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
              <span>🗑️ Delete Selected steps and figures</span>
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
            <div class="menu-divider" role="separator"></div>
            <button id="cmd-insert-figref" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🖼️ Insert Figure Reference</span>
              <span class="menu-shortcut">${IS_MAC ? 'Option+F' : 'Alt+F'}</span>
            </button>
            <div class="menu-divider" role="separator"></div>
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
          <button id="menu-view-trigger" class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">View</button>
          <div class="menu-dropdown" role="menu" aria-labelledby="menu-view-trigger">
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
          <button id="menu-tools-trigger" class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">Tools</button>
          <div class="menu-dropdown" role="menu" aria-labelledby="menu-tools-trigger">
            <button id="cmd-reorder-couplets" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔄 Order Steps</span>
            </button>
            <button id="cmd-reorder-figures" class="dropdown-action" role="menuitem" tabindex="-1">
              <span>🔄 Order Figures</span>
            </button>
          </div>
        </div>

        <div class="menu-item" role="none">
          <button id="menu-window-trigger" class="menu-trigger" role="menuitem" aria-haspopup="menu" aria-expanded="false">Window</button>
          <div class="menu-dropdown" role="menu" aria-labelledby="menu-window-trigger">
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

        <div class="menu-title-container">
          <label for="key-title-input" class="menu-title-label">Title:</label>
          <input type="text" id="key-title-input" class="key-title-input" placeholder="Untitled Key" />
        </div>

        <input type="file" id="file-import-hidden" accept=".tskey,.json" />
      </div>

      <div class="main-layout">
        <div class="editor-column">
          <h2>Key Editor: <span id="active-project-title">Untitled Key</span></h2>
          <div id="editor-container"></div>
          <button id="add-couplet-btn" class="btn-add-block">+ Add New Step (Alt+N)</button>
        </div>

        <div class="figure-column">
          <h2>Figure References</h2>
          <div id="figure-container"></div>
          <button id="add-figure-btn" class="btn-add-block">+ Add New Figure</button>
        </div>

        <div class="print-column">
          <h2>Live Publication View</h2>
          <hr class="hr-print" />
          <div id="print-view-container" class="print-grid"></div>
        </div>

      </div>
    </div>

    <div id="modal-open-project" class="modal-overlay" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-open-project-title">
      <div class="modal-window hub-modal-window">
        <div class="modal-header">
          <h3 id="modal-open-project-title">📂 Open Key Workspace</h3>
          <button id="modal-project-close" class="modal-close-x">&times;</button>
        </div>
        <div class="modal-body">
          <div class="hub-toolbar">
            <span class="hub-toolbar-label">Stored browser keys:</span>
            <button id="btn-hub-import" class="btn btn-secondary btn-hub-import">+ Import File</button>
          </div>
          <div id="project-hub-list"></div>
        </div>
      </div>
    </div>

    <div id="modal-shortcuts" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-shortcuts-title">
      <div class="modal-window">
        <div class="modal-header">
          <h3 id="modal-shortcuts-title">⌨️ Keyboard Shortcuts</h3>
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
              <tr><td>Select All Key  Steps</td><td><code>${IS_MAC ? '⌘ + A' : 'Ctrl + A'}</code></td></tr>
              <tr><td>Cut Selected Key Step</td><td><code>${IS_MAC ? '⌘ + X' : 'Ctrl + X'}</code></td></tr>
              <tr><td>Copy Selected Key Steps</td><td><code>${IS_MAC ? '⌘ + C' : 'Ctrl + C'}</code></td></tr>
              <tr><td>Paste Key Step Below selected steps</td><td><code>${IS_MAC ? '⌘ + V' : 'Ctrl + V'}</code></td></tr>
              <tr><td>Paste Key Step Above selected steps</td><td><code>Shift + ${IS_MAC ? 'Shift + ⌘ + V' : 'Shift + Ctrl + V'}</code></td></tr>
              <tr><td>Append New Key Step</td><td><code>Alt + N</code></td></tr>
              <tr><td>Insert figure reference <code>[fig: ]</code> (while editing a step's text)</td><td><code>${IS_MAC ? 'Option + F' : 'Alt + F'}</code></td></tr>
              <tr><td>Swap Alternative Rows in selected key steps</td><td><code>Alt + S</code></td></tr>
              <tr><td>Undo Last Action</td><td><code>${IS_MAC ? '⌘ + Z' : 'Ctrl + Z'}</code></td></tr>
              <tr><td>Redo Action</td><td><code>${IS_MAC ? '⌘ + Y' : 'Ctrl + Y'}</code></td></tr>
              <tr><td>Delete Selected Key Steps</td><td><code>Delete</code> / <code>Backspace</code></td></tr>
              <tr><td>Deselect all key step and figure references</td><td><code>Escape</code></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="modal-options" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-options-title">
      <div class="modal-window">
        <div class="modal-header">
          <h3 id="modal-options-title">🔧 Options & Settings</h3>
          <button id="modal-options-close" class="modal-close-x">&times;</button>
        </div>
        <div class="modal-body">
          <div class="settings-group">
            <h4>Key labelling format</h4>
            <p class="settings-hint">Choose how the two alternatives of every step are labelled. This applies to the Live Publication View and to the plain-text, HTML, and LaTeX exports.</p>
            <div class="settings-options" id="opt-lead-format" role="radiogroup" aria-label="Key labelling format">
              <label class="settings-option">
                <input type="radio" name="lead-format" value="classic" />
                <span class="settings-option-main">
                  <span class="settings-option-title">Number &amp; em-dash</span>
                  <span class="settings-option-sample"><span>1.</span>diagnose … Homo habilis<br><span>—</span>diagnose … 2</span>
                </span>
              </label>
              <label class="settings-option">
                <input type="radio" name="lead-format" value="lettered" />
                <span class="settings-option-main">
                  <span class="settings-option-title">Lettered</span>
                  <span class="settings-option-sample"><span>1a</span>diagnose … Homo habilis<br><span>1b</span>diagnose … 2</span>
                </span>
              </label>
              <label class="settings-option">
                <input type="radio" name="lead-format" value="minimal" />
                <span class="settings-option-main">
                  <span class="settings-option-title">Number &amp; hyphen</span>
                  <span class="settings-option-sample"><span>1</span>diagnose … Homo habilis<br><span>-</span>diagnose … 2</span>
                </span>
              </label>
            </div>

            <label class="setting-item settings-checkbox">
              <input type="checkbox" id="opt-backref" />
              <span class="settings-option-main">
                <span class="settings-option-title">Show back-reference</span>
                <span class="settings-hint settings-checkbox-hint">Append the step this couplet is reached from, in parentheses — e.g. <strong>2&nbsp;(1)</strong>. Handy for navigating a printed key upwards.</span>
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div id="modal-about" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-about-title">
      <div class="modal-window about-modal-window">
        <div class="modal-header">
          <h3 id="modal-about-title">ℹ️ About</h3>
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
        <label class="import-option"><input type="checkbox" id="pt-opt-fill" checked /> Fill missing key steps</label>
        <label class="import-option import-option-num">Min leader dots
          <input type="number" id="pt-opt-min-dots" min="2" max="10" step="1" value="3" />
        </label>
      </div>

      <div class="fullscreen-view-body import-view-body">
        <section class="import-input-pane">
          <div class="import-pane-toolbar">
            <label for="pt-import-source" class="import-pane-label">Paste your key, or load a text file</label>
            <div class="import-toolbar-actions">
              <label class="import-encoding-field" for="pt-import-encoding">Encoding
                <select id="pt-import-encoding">
                  <option value="auto" selected>Auto-detect</option>
                  <option value="utf-8">UTF-8</option>
                  <option value="utf-16le">UTF-16 LE</option>
                  <option value="utf-16be">UTF-16 BE</option>
                  <option value="windows-1252">Windows-1252 / Latin-1</option>
                </select>
              </label>
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
            File encoding is auto-detected (UTF-8, UTF-16, and legacy Windows-1252/Latin-1); pick it manually if accented characters look wrong.
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
