import type { KeyStore } from '../store.ts';
import { escapeHTML, buildIdToIndexMap, buildFigureIdToDisplayNumMap, triggerFileDownload, resolveDestination } from '../utils.ts';
import type { DestinationResolution } from '../utils.ts';
import { showToast } from '../uiRenderer.ts';
import { figureStorage, blobToBase64 } from '../db.ts';

function destinationToHtml(dest: DestinationResolution): string {
    const escaped = escapeHTML(dest.printText);
    if (dest.printClass === 'print-dest-taxon') {
        return `<strong class="print-dest-taxon">${escaped}</strong>`;
    }
    if (dest.printClass === 'print-dest-strong') {
        return `<strong class="print-dest-strong">${escaped}</strong>`;
    }
    if (dest.printClass === 'error-text') {
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
            <div class="print-couplet" role="group" aria-label="Couplet ${currentDisplayNum}">
                <div class="print-step-num">${currentDisplayNum}.</div>
                <div class="print-row">
                  <span class="print-text">${escapeHTML(alt1)}</span>
                  <span class="print-dest">${end1}</span>
                </div>
                <div class="print-dash">—</div>
                <div class="print-row">
                  <span class="print-text">${escapeHTML(alt2)}</span>
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
    :root {
      --color-bg: #ffffff;
      --color-bg-muted: #f8fafc;
      --color-text: #0f172a;
      --color-text-muted: #475569;
      --color-border: #cbd5e1;
      --color-border-light: #e2e8f0;
      --color-primary: #4f46e5;
      --radius-md: 6px;
      --radius-lg: 8px;
    }

    html, body { 
      margin: 0;
      padding: 0;
      min-height: 100vh;
      overflow: auto;
      box-sizing: border-box;
    }

    *, *::before, *::after {
      box-sizing: inherit;
    }

    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      color: var(--color-text); 
      background: var(--color-bg-muted);
    }

    .print-page-layout { 
      max-width: 1400px; 
      margin: 0 auto; 
      padding: 24px;
      height: auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    
    .print-key-column { 
      width: 100%; 
      display: flex;
      flex-direction: column;
    }
    
    .print-figures-column { 
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    @media (min-width: 768px) {
      html, body {
        height: 100vh;
        overflow: hidden;
      }
      .print-page-layout {
        height: 100vh;
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        align-items: stretch;
      }
      .print-key-column,
      .print-figures-column {
        height: 100%;
        overflow-y: auto;
      }
    }
    
    .print-key-container { 
      flex: 1;
      display: flex; 
      flex-direction: column; 
      gap: 6px; 
      background: var(--color-bg);
      border: 1px solid var(--color-border); 
      border-radius: var(--radius-lg);
      padding: 25px;
      font-family: serif;
      font-size: 15px;
      line-height: 1.6;
    }

    @media (min-width: 768px) {
      .print-key-container {
        overflow-y: auto;
        min-height: 0;
      }
    }
    
    .print-couplet { 
      display: grid; 
      grid-template-columns: auto 1fr; 
      gap: 6px 10px; 
      align-items: start; 
      break-inside: avoid; 
      page-break-inside: avoid; 
      padding-bottom: 8px;
    }
    .print-couplet:last-child { padding-bottom: 0; }
    
    .print-step-num { font-weight: bold; color: var(--color-text); }
    .print-dash { font-weight: bold; text-align: center; color: var(--color-text); }
    
    .print-row {
      display: block; 
      width: 100%;
      position: relative;
      line-height: 1.6;
      background-image: linear-gradient(to right, var(--color-text) 33%, transparent 33%);
      background-repeat: repeat-x;
      background-position: left 0 bottom 0.35em; 
      background-size: 6px 1px;
    }
    
    .print-text {
      display: inline;                  
      white-space: pre-wrap;
      background-color: var(--color-bg);
      padding-right: 6px;
    }
    
    .print-dest {
      float: right;                     
      white-space: nowrap;
      background-color: var(--color-bg); 
      padding-left: 6px;                 
      line-height: inherit;
    }
    
    .print-dest-strong { font-weight: bold; color: var(--color-text); }
    .print-dest-taxon { font-weight: bold; font-style: italic; color: var(--color-text); }
    .error-text { font-weight: bold; color: #ef4444; }
    
    /* FIGURES SUB-ELEMENT PANELS */
    .print-fig-card {
      border: 1px solid var(--color-border-light);
      border-radius: var(--radius-md);
      padding: 16px;
      background: var(--color-bg);
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .print-fig-img { display: block; max-width: 100%; max-height: 220px; object-fit: contain; border-radius: var(--radius-md); margin: 0 auto 12px auto; }
    .print-fig-caption { font-family: sans-serif; font-size: 13px; color: var(--color-text); line-height: 1.5; text-align: left; }
    
    @media print {
      html, body { height: auto; overflow: visible; }
      body { padding: 0; margin: 0; background: transparent; }
      .print-page-layout { height: auto; padding: 0; overflow: visible; display: block; }
      .print-page-layout.layout-has-figures { display: grid; grid-template-columns: 1fr 260px; gap: 30px; height: auto; }
      .print-key-column { height: auto; overflow: visible; }
      .print-figures-column { height: auto; max-height: none; overflow-y: visible; position: relative; top: 0; }
      .print-key-container { border: none; padding: 0; box-shadow: none; height: auto; overflow: visible; }
      .print-fig-card { box-shadow: none; border-color: var(--color-border); }
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