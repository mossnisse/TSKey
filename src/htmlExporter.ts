// htmlExporter.ts
import type { KeyStore } from './store.ts';
import { escapeHTML, getStepNumberById } from './utils.ts';
import { showToast } from './uiRenderer.ts';

/**
 * Compiles the current KeyStore state into a single standalone static HTML document.
 * Includes semantic validation protection and bulletproof DOM safety checks.
 */
export function exportKeyToHTML(store: KeyStore): void {
    let downloadUrl: string | null = null;

    try {
        const key = store.getKey();
        let gridContent = '';

        key.forEach((c, index) => {
            const currentDisplayNum = index + 1;
            const step1Dest = getStepNumberById(key, c.link1);
            const step2Dest = getStepNumberById(key, c.link2);

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

            gridContent += `
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
            <div class="print-spacer"></div>
            `;
        });

        // (Assuming matching structured layout styles here as per your original template)
        const htmlDocument = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Exported Dichotomous Key</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .print-grid { display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; align-items: end; }
    .print-step-num { font-weight: bold; align-self: start; }
    .print-row { display: flex; justify-content: space-between; align-items: end; width: 100%; }
    .print-text { flex-shrink: 1; text-align: left; white-space: pre-wrap; }
    .print-dots { flex-grow: 1; border-bottom: 1px dotted #000000; margin: 0 8px 4px 8px; }
    .print-dest { flex-shrink: 0; white-space: nowrap; }
    .print-dest-strong { font-weight: bold; }
    .print-dest-taxon { font-weight: bold; font-style: italic; }
    .print-dash { font-weight: bold; text-align: center; align-self: start; }
    .print-spacer { grid-column: span 2; height: 8px; }
  </style>
</head>
<body>
  <div class="print-grid">
    ${gridContent}
  </div>
</body>
</html>`;

        const blob = new Blob([htmlDocument], { type: 'text/html;charset=utf-8' });
        downloadUrl = URL.createObjectURL(blob);

        // Modern browsers do NOT require an anchor element to be appended to document.body 
        // to call trigger execution routines. We instantiate and click completely in isolation.
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = 'dichotomous_key.html';
        
        link.click(); // Fires successfully without dirtying the DOM tree

        showToast('Key successfully compiled and exported!', 'success');

    } catch (error) {
        console.error('HTML Export system failure:', error);
        showToast('❌ An unexpected error disrupted the HTML file compilation pipeline.', 'error');
    } finally {
        // PREVENT MEMORY LEAKS: Revoke Object URL immediately
        if (downloadUrl) {
            URL.revokeObjectURL(downloadUrl);
        }
    }
}