// htmlExporter.ts
import type { KeyStore } from '../store.ts';
import { escapeHTML, buildIdToIndexMap, getStepNumberById, triggerFileDownload } from '../utils.ts';
import { showToast } from '../uiRenderer.ts';

/**
 * Compiles the current KeyStore state into a single standalone static HTML document.
 * Guarantees that couplet sets never break across page boundaries during printing.
 */
export function exportKeyToHTML(store: KeyStore): void {
    try {
        const key = store.getKey();
        const idToIndexMap = buildIdToIndexMap(key);
        
        let gridContent = '';

        key.forEach((c, index) => {
            const currentDisplayNum = index + 1;
            const step1Dest = getStepNumberById(idToIndexMap, c.link1);
            const step2Dest = getStepNumberById(idToIndexMap, c.link2);

            // Guard against "INVALID ID" leaking into the clean document text if data shifts slightly
            const end1 = c.taxa1
                ? `<strong class="print-dest-taxon">${escapeHTML(c.taxa1)}</strong>`
                : (c.link1 && step1Dest !== 'INVALID ID' 
                    ? `<strong class="print-dest-strong">${step1Dest}</strong>` 
                    : '<span>...</span>');

            const end2 = c.taxa2
                ? `<strong class="print-dest-taxon">${escapeHTML(c.taxa2)}</strong>`
                : (c.link2 && step2Dest !== 'INVALID ID' 
                    ? `<strong class="print-dest-strong">${step2Dest}</strong>` 
                    : '<span>...</span>');

            // Encapsulate each individual step inside its own unbreakable container
            gridContent += `
            <div class="print-couplet">
                <div class="print-step-num">${currentDisplayNum}.</div>
                <div class="print-row">
                  <span class="print-text">${escapeHTML(c.alt1) || '___'}</span>
                  <span class="print-dots"></span>
                  <span class="print-dest">${end1}</span>
                </div>
                <div class="print-dash">—</div>
                <div class="print-row">
                  <span class="print-text">${escapeHTML(c.alt2) || '___'}</span>
                  <span class="print-dots"></span>
                  <span class="print-dest">${end2}</span>
                </div>
            </div>
            `;
        });

        const htmlDocument = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Exported Dichotomous Key</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    
    /* Global container holding all the key steps */
    .print-key-container { 
      display: flex; 
      flex-direction: column; 
      gap: 16px; /* Clean layout separation between individual steps */
    }
    
    /* Structural parent for a single couplet block. 
       This forces Choice A and Choice B to stick together across pages. */
    .print-couplet { 
      display: grid; 
      grid-template-columns: 2.5rem 1fr; 
      gap: 6px 10px; 
      align-items: end; 
      break-inside: avoid; 
      page-break-inside: avoid; 
    }
    
    .print-step-num { font-weight: bold; align-self: start; }
    .print-row { display: flex; justify-content: space-between; align-items: end; width: 100%; }
    .print-text { flex-shrink: 1; text-align: left; white-space: pre-wrap; }
    .print-dots { flex-grow: 1; border-bottom: 1px dotted #000000; margin: 0 8px 4px 8px; }
    .print-dest { flex-shrink: 0; white-space: nowrap; }
    .print-dest-strong { font-weight: bold; }
    .print-dest-taxon { font-weight: bold; font-style: italic; }
    .print-dash { font-weight: bold; text-align: center; align-self: start; }
    
    @media print {
      body { padding: 0; margin: 0; }
      .print-couplet { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="print-key-container">
    ${gridContent}
  </div>
</body>
</html>`;

        triggerFileDownload(htmlDocument, 'dichotomous_key_publication.html', 'text/html;charset=utf-8;');
        
    } catch (error) {
        console.error('HTML Export system failure:', error);
        showToast('❌ An unexpected error disrupted the HTML file compilation pipeline.', 'error');
    }
}