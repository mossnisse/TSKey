// ui/printView.ts
// Incremental reconciler for the live publication view. Figure tokens become
// clickable `(Fig. N)` citations carrying the figure id for Ctrl/Cmd+click navigation.
import type { KeyStore, Figure } from '../store.ts';
import type { UIStateStore } from '../uiState.ts';
import { escapeHTML, buildIdToIndexMap, resolveDestination, buildFigureIdToDisplayNumMap, buildCoupletLeads, buildBackReferenceMap, buildTaxaContext } from '../utils.ts';
import { buildFigureLookups } from '../figureTokens.ts';

const FIG_TOKEN_REGEX = /\[figID:\s*(\d+)\s*\]|\[fig:\s*([^\]]+?)\s*\]/gi;

function figRefSpan(figId: number, displayNum: number): string {
    return `<span class="fig-ref" data-fig-id="${figId}">(Fig. ${displayNum})</span>`;
}

/**
 * Renders a couplet alternative for the publication view: escapes the literal text
 * and converts each figure token into a clickable `(Fig. N)` citation that carries
 * the figure's internal id (`data-fig-id`) for Ctrl/Cmd+click navigation. Resolved
 * citations get the `.fig-ref` link style; unresolvable ones stay red and inert.
 */
function renderAltToPrintHtml(rawText: string, figures: readonly Figure[], idToDisplayNum: Map<number, number>): string {
    if (!rawText) return '';
    const { displayNumToFig, filenameToFig } = buildFigureLookups(figures);
    const figureCount = figures.length;

    let html = '';
    let lastIndex = 0;
    const re = new RegExp(FIG_TOKEN_REGEX.source, FIG_TOKEN_REGEX.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(rawText)) !== null) {
        html += escapeHTML(rawText.slice(lastIndex, match.index));
        lastIndex = match.index + match[0].length;

        if (match[1] !== undefined) {
            // [figID: N] — N is an internal figure id.
            const figId = parseInt(match[1], 10);
            const displayNum = idToDisplayNum.get(figId);
            html += displayNum !== undefined
                ? figRefSpan(figId, displayNum)
                : `<span class="error-text">[Fig: ID ${figId}]</span>`;
        } else {
            // [fig: value] — value is a 1-based display number or a filename.
            const value = (match[2] ?? '').trim();
            let resolved: { figId: number; displayNum: number } | null = null;
            const asNum = parseInt(value, 10);
            if (!isNaN(asNum) && String(asNum) === value && asNum >= 1 && asNum <= figureCount) {
                const fig = displayNumToFig.get(asNum);
                if (fig) resolved = { figId: fig.id, displayNum: asNum };
            } else {
                const fig = filenameToFig.get(value.toLowerCase());
                const displayNum = fig ? idToDisplayNum.get(fig.id) : undefined;
                if (fig && displayNum !== undefined) resolved = { figId: fig.id, displayNum };
            }
            html += resolved
                ? figRefSpan(resolved.figId, resolved.displayNum)
                : `<span class="error-text">[Fig: ${escapeHTML(value)}]</span>`;
        }
    }
    html += escapeHTML(rawText.slice(lastIndex));
    return html;
}

/**
 * Renders the passive publication presentation view structure.
 */
export function renderPrintView(store: KeyStore, uiState: UIStateStore) {
    if (uiState.isPrintHidden) return;

    const container = document.getElementById('print-view-container');
    if (!container) return;

    const key = store.getKey();
    const leadFormat = uiState.leadFormat;
    const idToIndexMap = buildIdToIndexMap(key);
    const figures = store.getFigures();
    const figDisplayMap = buildFigureIdToDisplayNumMap(figures);
    const backRefMap = uiState.showBackReference ? buildBackReferenceMap(key) : null;
    const taxaCtx = buildTaxaContext(store.getTaxa(), uiState.nameDisplayMode);

    // Drives the dash-alignment rule for lettered/minimal styles (see style.css).
    container.dataset.leadFormat = leadFormat;

    const existingBlocks = Array.from(container.querySelectorAll('.print-step-block')) as HTMLElement[];
    const existingMap = new Map<number, HTMLElement>();

    existingBlocks.forEach(block => {
        const idAttr = block.getAttribute('data-id');
        if (idAttr) existingMap.set(Number(idAttr), block);
    });

    key.forEach((c, index) => {
        const currentDisplayNum = index + 1;
        const { lead1, lead2 } = buildCoupletLeads(leadFormat, currentDisplayNum, backRefMap?.get(c.id));

        const dest1 = resolveDestination(c.branch1, idToIndexMap, taxaCtx);
        const dest2 = resolveDestination(c.branch2, idToIndexMap, taxaCtx);

        const html1 = renderAltToPrintHtml(c.alt1, figures, figDisplayMap) || '___';
        const html2 = renderAltToPrintHtml(c.alt2, figures, figDisplayMap) || '___';

        let block = existingMap.get(c.id);

        if (block) {
            existingMap.delete(c.id);

            const stepNumEl = block.querySelector('.print-step-num');
            if (stepNumEl && stepNumEl.textContent !== lead1) {
                stepNumEl.textContent = lead1;
            }

            const dashEl = block.querySelector('.print-dash');
            if (dashEl && dashEl.textContent !== lead2) {
                dashEl.textContent = lead2;
            }

            const txt1 = block.querySelector('.print-row[data-choice="1"] .print-text');
            if (txt1 && txt1.innerHTML !== html1) txt1.innerHTML = html1;

            const dest1El = block.querySelector('.print-row[data-choice="1"] .print-dest');
            if (dest1El) {
                if (dest1El.textContent !== dest1.printText) dest1El.textContent = dest1.printText;
                const expectedClass = `print-dest ${dest1.printClass}`.trim();
                if (dest1El.className !== expectedClass) dest1El.className = expectedClass;
            }

            const txt2 = block.querySelector('.print-row[data-choice="2"] .print-text');
            if (txt2 && txt2.innerHTML !== html2) txt2.innerHTML = html2;

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
                <div class="print-dash"></div>
                <div class="print-row" data-choice="2">
                  <span class="print-text"></span>
                  <span class="print-dest"></span>
                </div>
              <div class="print-spacer"></div>
            `;

            const stepNumEl = block.querySelector('.print-step-num');
            if (stepNumEl) stepNumEl.textContent = lead1;

            const dashEl = block.querySelector('.print-dash');
            if (dashEl) dashEl.textContent = lead2;

            const txt1 = block.querySelector('.print-row[data-choice="1"] .print-text');
            if (txt1) txt1.innerHTML = html1;

            const dest1El = block.querySelector('.print-row[data-choice="1"] .print-dest');
            if (dest1El) {
                dest1El.textContent = dest1.printText;
                if (dest1.printClass) dest1El.className = `print-dest ${dest1.printClass}`.trim();
            }

            const txt2 = block.querySelector('.print-row[data-choice="2"] .print-text');
            if (txt2) txt2.innerHTML = html2;

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