// ui/printView.ts
// Renders the live publication view via the shared reconciler. Figure tokens become
// clickable `(Fig. N)` citations carrying the figure id for Ctrl/Cmd+click navigation.
import type { KeyStore } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { escapeHTML } from '../utils.ts';
import type { DestinationResolution } from '../utils.ts';
import { buildKeyDocumentModel, renderAltSegments, htmlMark } from '../keyDocumentModel.ts';
import type { AltSegmentRenderer, RenderableCouplet } from '../keyDocumentModel.ts';
import { reconcileCards } from './shared.ts';

function figRefSpan(figId: number, displayNum: number): string {
    return `<span class="fig-ref" data-fig-id="${figId}">(Fig. ${displayNum})</span>`;
}

/**
 * Renders a resolved alternative for the publication view: literal text is escaped,
 * each resolved figure token becomes a clickable `(Fig. N)` citation carrying the
 * figure's internal id (`data-fig-id`) for Ctrl/Cmd+click navigation, and any
 * unresolvable token stays red and inert.
 */
const PRINT_ALT: AltSegmentRenderer = {
    text: escapeHTML,
    fig: seg => figRefSpan(seg.figId, seg.displayNum),
    brokenFig: seg => `<span class="error-text">[Fig: ${escapeHTML(seg.label)}]</span>`,
    mark: htmlMark,
};

/** Empty step-block skeleton; the update pass fills in leads, text, and destinations. */
function createStepBlock(c: RenderableCouplet): HTMLElement {
    const block = document.createElement('div');
    block.className = 'print-step-block';
    block.setAttribute('data-id', c.id.toString());
    block.innerHTML = `
      <div class="print-step-num"></div>
        <div class="print-row" data-choice="1">
          <span class="print-text"></span>
          <span class="print-dest"></span>
        </div>
        <div class="print-dash"></div>
        <div class="print-row" data-choice="2">
          <span class="print-text"></span>
          <span class="print-dest"></span>
        </div>
      <div class="print-spacer"></div>
    `;
    return block;
}

/** Patches one choice's destination text + class inside a step block. */
function patchDest(block: HTMLElement, choice: '1' | '2', dest: DestinationResolution) {
    const el = block.querySelector(`.print-row[data-choice="${choice}"] .print-dest`);
    if (!el) return;
    if (el.textContent !== dest.printText) el.textContent = dest.printText;
    const expectedClass = `print-dest ${dest.printClass}`.trim();
    if (el.className !== expectedClass) el.className = expectedClass;
}

/** Patches one choice's alternative-text HTML inside a step block. */
function patchText(block: HTMLElement, choice: '1' | '2', html: string) {
    const el = block.querySelector(`.print-row[data-choice="${choice}"] .print-text`);
    if (el && el.innerHTML !== html) el.innerHTML = html;
}

/**
 * Renders the passive publication presentation view structure.
 */
export function renderPrintView(store: KeyStore, uiState: UIStateStore) {
    if (uiState.isPrintHidden) return;

    const container = document.getElementById('print-view-container');
    if (!container) return;

    const model = buildKeyDocumentModel(store, {
        leadFormat: uiState.leadFormat,
        showBackReference: uiState.showBackReference,
        nameMode: uiState.nameDisplayMode,
    });

    // Drives the dash-alignment rule for lettered/minimal styles (see style.css).
    container.dataset.leadFormat = uiState.leadFormat;

    reconcileCards<RenderableCouplet>({
        container,
        items: model.couplets,
        getId: c => c.id,
        create: createStepBlock,
        update: (block, c) => {
            const stepNumEl = block.querySelector('.print-step-num');
            if (stepNumEl && stepNumEl.textContent !== c.lead1) stepNumEl.textContent = c.lead1;

            const dashEl = block.querySelector('.print-dash');
            if (dashEl && dashEl.textContent !== c.lead2) dashEl.textContent = c.lead2;

            patchText(block, '1', renderAltSegments(c.alt1, PRINT_ALT) || '___');
            patchDest(block, '1', c.dest1);
            patchText(block, '2', renderAltSegments(c.alt2, PRINT_ALT) || '___');
            patchDest(block, '2', c.dest2);
        },
    });
}
