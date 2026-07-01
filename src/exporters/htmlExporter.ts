import type { KeyStore } from '../store';
import { escapeHTML, buildIdToIndexMap, buildFigureIdToDisplayNumMap, triggerFileDownload, resolveDestination, sanitizeFilename, buildCoupletLeads, buildBackReferenceMap, buildTaxaContext } from '../utils.ts';
import type { DestinationResolution, LeadFormat, NameDisplayMode } from '../utils.ts';
import { showToast } from '../uiRenderer.ts';
import { workspaceStorage, blobToBase64 } from '../store';

function destinationToHtml(dest: DestinationResolution): string {
    const escaped = escapeHTML(dest.printText);
    // A linked taxon and a not-yet-created draft both export as the taxon name.
    if (dest.printClass === 'print-dest-taxon' || dest.printClass === 'print-dest-taxon-unlinked') {
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
export async function exportKeyToHTML(store: KeyStore, leadFormat: LeadFormat, showBackReference: boolean, nameMode: NameDisplayMode): Promise<void> {
    try {
        const projectUid = store.getActiveProjectUid();
        const key = store.getKey();
        const figures = store.getFigures();
        const title = store.getTitle();
        const idToIndexMap = buildIdToIndexMap(key);
        const idToDisplayNum = buildFigureIdToDisplayNumMap(figures);
        const backRefMap = showBackReference ? buildBackReferenceMap(key) : null;
        const taxa = store.getTaxa();
        const taxaCtx = buildTaxaContext(taxa, nameMode);

        // COMPILE GLOBAL FIGURES PANEL SIDEBAR (CONCURRENT PIPELINE)
        const figureCards = await Promise.all(
            figures.map(async (fig, index) => {
                const displayNum = index + 1;
                let imgTag = '';

                try {
                    const blob = await workspaceStorage.getFigureBinary(projectUid, fig.id);
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
        if (key.length === 0) {
            keyColumnMarkup = `<p class="print-empty-notice">[The identification key is currently empty. Add couplets in the editor to populate this document.]</p>`;
        }
        for (let index = 0; index < key.length; index++) {
            const c = key[index];
            const currentDisplayNum = index + 1;

            const dest1 = resolveDestination(c.branch1, idToIndexMap, taxaCtx);
            const dest2 = resolveDestination(c.branch2, idToIndexMap, taxaCtx);

            const end1 = destinationToHtml(dest1);
            const end2 = destinationToHtml(dest2);

            const alt1 = store.resolveTextReferences(c.alt1, idToDisplayNum) || '___';
            const alt2 = store.resolveTextReferences(c.alt2, idToDisplayNum) || '___';

            const { lead1, lead2 } = buildCoupletLeads(leadFormat, currentDisplayNum, backRefMap?.get(c.id));

            keyColumnMarkup += `
            <div class="print-couplet" role="group" aria-label="Couplet ${currentDisplayNum}">
                <div class="print-step-num">${escapeHTML(lead1)}</div>
                <div class="print-row">
                  <span class="print-text">${escapeHTML(alt1)}</span>
                  <span class="print-dest">${end1}</span>
                </div>
                <div class="print-dash">${escapeHTML(lead2)}</div>
                <div class="print-row">
                  <span class="print-text">${escapeHTML(alt2)}</span>
                  <span class="print-dest">${end2}</span>
                </div>
            </div>
            `;
        }

        // COMPILE TAXA CHAPTERS — one block per taxon, in panel order; empty fields omitted.
        let taxaMarkup = '';
        if (taxa.length > 0) {
            const nl2br = (s: string) => escapeHTML(s).replace(/\n/g, '<br>');
            const field = (label: string, valueHtml: string) =>
                `<p class="print-taxon-field"><strong>${label}:</strong> ${valueHtml}</p>`;

            const entries = taxa.map(taxon => {
                const sci = escapeHTML(taxon.scientificName || 'Untitled taxon');
                const auctor = taxon.auctor ? ` <span class="print-taxon-auctor">${escapeHTML(taxon.auctor)}</span>` : '';
                let block = `<div class="print-taxon"><h3 class="print-taxon-name"><em>${sci}</em>${auctor}</h3>`;

                if (taxon.vernacularName) block += `<p class="print-taxon-field">${escapeHTML(taxon.vernacularName)}</p>`;
                if (taxon.synonyms.length > 0) block += field('Synonyms', taxon.synonyms.map(s => `<em>${escapeHTML(s)}</em>`).join('; '));
                if (taxon.description) block += field('Description', nl2br(taxon.description));
                if (taxon.biology) block += field('Biology', nl2br(taxon.biology));
                if (taxon.distribution) block += field('Distribution', nl2br(taxon.distribution));
                if (taxon.confusables.length > 0) {
                    const items = taxon.confusables
                        .map(c => `<li><em>${escapeHTML(c.name)}</em>${c.distinction ? ` — ${escapeHTML(c.distinction)}` : ''}</li>`)
                        .join('');
                    block += `<div class="print-taxon-field"><strong>Confusable species:</strong><ul class="print-confusables">${items}</ul></div>`;
                }

                return block + `</div>`;
            }).join('');

            taxaMarkup = `<h2 class="print-taxa-heading">Taxa</h2>${entries}`;
        }

        // GENERATE TARGET DOCUMENT STRUCTURE
        const hasFiguresClass = figures.length > 0 ? ' layout-has-figures' : '';
        const htmlDocument = buildHTMLBoilerplate(title, keyColumnMarkup, taxaMarkup, figuresColumnMarkup, hasFiguresClass, leadFormat);

        triggerFileDownload(htmlDocument, sanitizeFilename(title, '.html'), 'text/html;charset=utf-8;');

    } catch (error) {
        console.error('HTML Export layout compilation system failure:', error);
        showToast('❌ An unexpected error disrupted the HTML file compilation pipeline.', 'error');
    }
}

/**
 * Isolated template wrapper providing core layout scaffolding styles.
 */
function buildHTMLBoilerplate(title: string, keyContent: string, taxaContent: string, figuresContent: string, layoutClass: string, leadFormat: LeadFormat): string {
    const safeTitle = escapeHTML(title);
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
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
    /* Lettered/minimal leads read better flush-left, aligned under the step number. */
    .print-page-layout[data-lead-format="lettered"] .print-dash,
    .print-page-layout[data-lead-format="minimal"] .print-dash { text-align: left; }
    
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
    
    .print-doc-title { font-family: serif; font-size: 22px; font-weight: bold; text-align: center; margin: 0 0 16px 0; color: var(--color-text); }
    .print-empty-notice { font-style: italic; color: var(--color-text-muted); text-align: center; }

    .print-dest-strong { font-weight: bold; color: var(--color-text); }
    .print-dest-taxon { font-weight: bold; font-style: italic; color: var(--color-text); }
    .error-text { font-weight: bold; color: #ef4444; }

    /* TAXA CHAPTERS */
    .print-taxa-heading { font-family: serif; font-size: 20px; font-weight: bold; margin: 24px 0 12px; padding-top: 16px; border-top: 1px solid var(--color-border); }
    .print-taxon { margin-bottom: 16px; break-inside: avoid; page-break-inside: avoid; }
    .print-taxon-name { font-family: serif; font-size: 20px; margin: 0 0 4px 0; }
    .print-taxon-auctor { font-weight: normal; font-size: 0.6em; color: var(--color-text-muted); }
    .print-taxon-field { margin: 2px 0; font-size: 14px; line-height: 1.5; }
    .print-confusables { margin: 2px 0; padding-left: 20px; }

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
  <div class="print-page-layout${layoutClass}" data-lead-format="${leadFormat}">
    <div class="print-key-column">
      <div class="print-key-container">
        <h1 class="print-doc-title">${safeTitle}</h1>
        ${keyContent}
        ${taxaContent}
      </div>
    </div>
    <div class="print-figures-column">
      ${figuresContent}
    </div>
  </div>
</body>
</html>`;
}