// htmlExporter.ts
import type { KeyStore } from './store.ts';
import { escapeHTML, getStepNumberById } from './uiRenderer.ts';

/**
 * Compiles the current KeyStore state into a single standalone static HTML document
 * containing embedded publication styles, then triggers a local browser download.
 */
export function exportKeyToHTML(store: KeyStore): void {
    const key = store.getKey();
    let gridContent = '';

    // Replicate structural generation loop from renderPrintView
    key.forEach((c, index) => {
        const currentDisplayNum = index + 1;
        const step1Dest = getStepNumberById(key, c.link1);
        const step2Dest = getStepNumberById(key, c.link2);

        const end1 = c.taxa1
            ? `<strong class="print-dest-taxon">${escapeHTML(c.taxa1)}</strong>`
            : (c.link1 ? `<strong class="print-dest-strong">${step1Dest}</strong>` : '<span>...</span>');

        const end2 = c.taxa2
            ? `<strong class="print-dest-taxon">${escapeHTML(c.taxa2)}</strong>`
            : (c.link2 ? `<strong class="print-dest-strong">${step2Dest}</strong>` : '<span>...</span>');

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
        <div class="print-spacer"></div>`;
    });

    // Construct the standalone HTML document with matching grid stylesheets
    const fullHtmlDocument = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exported Dichotomous Key</title>
  <style>
    /* Embedded baseline layout rules matching project architecture */
    body {
      font-family: serif;
      background: #ffffff;
      color: #000000;
      padding: 40px 24px;
      max-width: 850px;
      margin: 0 auto;
    }
    h1 {
      font-family: sans-serif;
      color: #1e293b;
      border-bottom: 2px solid #000000;
      padding-bottom: 12px;
      margin-bottom: 32px;
      font-size: 24px;
    }
    
    /* Live Publication Grid Renderer CSS Match */
    .print-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 10px;
      align-items: end;
      color: #000;
      line-height: 1.6;
      font-size: 15px;
    }
    .print-step-num {
      font-weight: bold;
      align-self: start;
      color: #000;
    }
    .print-row {
      display: flex;
      justify-content: space-between;
      align-items: end;
      width: 100%;
    }
    .print-text {
      flex-shrink: 1;
      text-align: left;
      white-space: pre-wrap;
    }
    .print-dots {
      flex-grow: 1;
      border-bottom: 1px dotted #000000;
      margin: 0 8px 4px 8px;
    }
    .print-dest {
      flex-shrink: 0;
      white-space: nowrap;
    }
    .print-dest-strong {
      font-weight: bold;
    }
    .print-dest-taxon {
      font-weight: bold;
      font-style: italic;
    }
    .print-dash {
      font-weight: bold;
      text-align: center;
      align-self: start;
      color: #000;
    }
    .print-spacer {
      grid-column: span 2;
      height: 8px;
    }
    
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-grid">
    ${gridContent}
  </div>
</body>
</html>`;

    // Initialize download pipeline via explicit data blob mapping
    const blob = new Blob([fullHtmlDocument], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = 'dichotomous_key_publication.html';

    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();

    // Memory and element garbage collection cleanup
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
}