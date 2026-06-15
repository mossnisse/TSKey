import type { KeyStore } from '../store.ts';
import { escapeHTML, buildIdToIndexMap, buildFigureIdToDisplayNumMap, triggerFileDownload, resolveDestination } from '../utils.ts';
import type { DestinationResolution } from '../utils.ts';
import { showToast } from '../uiRenderer.ts';
import { figureStorage, blobToBase64 } from '../db.ts';

/**
 * Converts a DestinationResolution into the appropriate HTML fragment so the
 * exported file matches the live print-view exactly (including error styling
 * for unresolved step references).
 */
function destinationToHtml(dest: DestinationResolution): string {
    const escaped = escapeHTML(dest.printText);
    if (dest.printClass === 'print-dest-taxon') {
        return `<strong class="print-dest-taxon">${escaped}</strong>`;
    }
    if (dest.printClass === 'print-dest-strong') {
        return `<strong class="print-dest-strong">${escaped}</strong>`;
    }
    if (dest.printClass === 'error-text') {
        // Unresolved step reference — show in red, same as the live editor.
        return `<span class="error-text">${escaped}</span>`;
    }
    return `<span>${escaped}</span>`;
}

/**
 * Compiles the current KeyStore state into a single standalone static HTML document.
 */
export async function exportKeyToHTML(store: KeyStore): Promise<void> {
    try {
        const key = store.getKey();
        const figures = store.getFigures();
        const idToIndexMap = buildIdToIndexMap(key);
        const idToDisplayNum = buildFigureIdToDisplayNumMap(figures);

        // COMPILE GLOBAL FIGURES PANEL SIDEBAR (CONCURRENT PIPELINE)
        const figureCards = await Promise.all(
            figures.map(async (fig) => {
                const displayNum = idToDisplayNum.get(fig.id) || 0;
                let imgTag = '';

                try {
                    const blob = await figureStorage.getFigureBinary(fig.id);
                    if (blob) {
                        const base64Data = await blobToBase64(blob);
                        imgTag = `<img class="print-fig-img" src="${base64Data}" alt="Figure ${displayNum}" />`;
                    }
                } catch (blobError) {
                    console.warn(`Could not resolve binary payload stream for figure ID ${fig.id}:`, blobError);
                }

                const captionText = escapeHTML(fig.caption || fig.filename || 'Untitled Asset');
                return `
                    <div class="print-fig-card">
                        ${imgTag}
                        <div class="print-fig-caption">
                            <strong>Fig. ${displayNum}:</strong> ${captionText}
                        </div>
                    </div>
                `;
            })
        );
        const figuresColumnMarkup = figureCards.join('');

        // COMPILE DICHOTOMOUS KEY COUPLERS
        let keyColumnMarkup = '';
        for (let index = 0; index < key.length; index++) {
            const c = key[index];
            const currentDisplayNum = index + 1;

            const dest1 = resolveDestination(c.link1, c.taxa1, idToIndexMap);
            const dest2 = resolveDestination(c.link2, c.taxa2, idToIndexMap);

            const end1 = destinationToHtml(dest1);
            const end2 = destinationToHtml(dest2);

            const alt1 = store.resolveTextReferences(c.alt1, idToDisplayNum) || '___';
            const alt2 = store.resolveTextReferences(c.alt2, idToDisplayNum) || '___';

            keyColumnMarkup += `
            <div class="print-couplet">
                <div class="print-step-num">${currentDisplayNum}.</div>
                <div class="print-row">
                  <span class="print-text">${escapeHTML(alt1)}</span>
                  <span class="print-dots"></span>
                  <span class="print-dest">${end1}</span>
                </div>
                <div class="print-dash">—</div>
                <div class="print-row">
                  <span class="print-text">${escapeHTML(alt2)}</span>
                  <span class="print-dots"></span>
                  <span class="print-dest">${end2}</span>
                </div>
            </div>
            `;
        }

        // GENERATE TARGET DOCUMENT STRUCTURE
        const hasFiguresClass = figures.length > 0 ? ' layout-has-figures' : '';
        const htmlDocument = buildHTMLBoilerplate(keyColumnMarkup, figuresColumnMarkup, hasFiguresClass);

        triggerFileDownload(htmlDocument, 'dichotomous_key_publication.html', 'text/html;charset=utf-8;');
        
    } catch (error) {
        console.error('HTML Export layout compilation system failure:', error);
        showToast('❌ An unexpected error disrupted the HTML file compilation pipeline.', 'error');
    }
}

/**
 * Isolated template wrapper providing core layout scaffolding styles.
 */
function buildHTMLBoilerplate(keyContent: string, figuresContent: string, layoutClass: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Exported Dichotomous Key with Figures Panel</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      padding: 40px; 
      color: #0f172a; 
      line-height: 1.5; 
      background: #ffffff;
      margin: 0;
    }
    .print-page-layout { display: block; max-width: 1200px; margin: 0 auto; }
    .print-key-column { width: 100%; }
    .print-figures-column { display: none; }

    @media (min-width: 768px) {
      .print-page-layout.layout-has-figures {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: 40px;
        align-items: start;
      }
      .print-figures-column {
        display: flex;
        flex-direction: column;
        gap: 16px;
        position: sticky;
        top: 40px;
        max-height: calc(100vh - 80px);
        overflow-y: auto;
        padding-right: 8px;
      }
    }
    
    .print-key-container { 
      display: flex; 
      flex-direction: column; 
      gap: 20px; 
      background: #ffffff;
      padding: 24px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    
    .print-couplet { 
      display: grid; 
      grid-template-columns: 2.5rem 1fr; 
      gap: 6px 16px; 
      align-items: end; 
      break-inside: avoid; 
      page-break-inside: avoid; 
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 16px;
    }
    .print-couplet:last-child { border-bottom: none; padding-bottom: 0; }
    
    .print-step-num { font-weight: 700; align-self: start; font-size: 1.1rem; color: #1e293b; }
    .print-row { display: flex; justify-content: space-between; align-items: end; width: 100%; }
    .print-text { flex-shrink: 1; text-align: left; white-space: pre-wrap; }
    .print-dots { flex-grow: 1; border-bottom: 1px dotted #cbd5e1; margin: 0 10px 5px 10px; }
    .print-dest { flex-shrink: 0; white-space: nowrap; }
    .print-dest-strong { font-weight: 700; color: #0f172a; }
    .print-dest-taxon { font-weight: 700; font-style: italic; color: #4f46e5; }
    .error-text { font-weight: 700; color: #dc2626; }
    .print-dash { font-weight: 700; text-align: center; align-self: start; color: #94a3b8; }
    
    .print-fig-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .print-fig-img { display: block; max-width: 100%; max-height: 200px; object-fit: contain; border-radius: 6px; margin: 0 auto 10px auto; }
    .print-fig-caption { font-size: 1rem; color: #0f172a; line-height: 1.4; text-align: left; }
    
    @media print {
      body { padding: 0; margin: 0; background: transparent; }
      .print-page-layout.layout-has-figures { display: grid; grid-template-columns: 1fr 260px; gap: 30px; }
      .print-figures-column { max-height: none; overflow-y: visible; position: relative; top: 0; }
      .print-key-container { border: none; padding: 0; box-shadow: none; }
      .print-fig-card { box-shadow: none; border-color: #cbd5e1; }
    }
  </style>
</head>
<body>
  <div class="print-page-layout${layoutClass}">
    <div class="print-key-column">
      <div class="print-key-container">
        ${keyContent}
      </div>
    </div>
    <div class="print-figures-column">
      ${figuresContent}
    </div>
  </div>
</body>
</html>`;
}