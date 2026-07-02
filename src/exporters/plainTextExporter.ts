// plainTextExporter.ts
import type { KeyStore } from '../store';
import { showToast } from '../uiRenderer.ts';
import { triggerFileDownload, sanitizeFilename } from '../utils.ts';
import type { LeadFormat, NameDisplayMode } from '../utils.ts';
import { buildKeyDocumentModel, renderAltSegments, buildTaxonExportNames } from '../keyDocumentModel.ts';
import type { AltSegmentRenderer, TaxonNameLine } from '../keyDocumentModel.ts';

// Figure tokens resolve to plain "(Fig. N)"; unresolvable ones stay visible as
// "[Broken Fig: …]" so the omission is obvious in the exported text.
const PLAIN_ALT: AltSegmentRenderer = {
    text: value => value,
    fig: seg => `(Fig. ${seg.displayNum})`,
    brokenFig: seg => `[Broken Fig: ${seg.label}]`,
};

/**
 * Compiles the dichotomous key into a tab-separated plain-text document,
 * fully resolving embedded figure references and appending a metadata block.
 */
export function exportKeyToPlainText(store: KeyStore, leadFormat: LeadFormat, showBackReference: boolean, nameMode: NameDisplayMode): void {
    try {
        const model = buildKeyDocumentModel(store, { leadFormat, showBackReference, nameMode });
        const { taxa, figures } = model;

        let content = '';

        // --- KEY TITLE ---
        content += `${model.title}\n\n`;

        // --- DICHOTOMOUS KEY COUPLETS ---
        if (model.isEmpty) {
            content += `[The identification key is currently empty. Add key steps in the editor to populate this document.]\n\n`;
        }

        model.couplets.forEach(c => {
            const alt1Text = renderAltSegments(c.alt1, PLAIN_ALT) || '___';
            const alt2Text = renderAltSegments(c.alt2, PLAIN_ALT) || '___';

            content += `${c.lead1}\t${alt1Text}\t${c.dest1.printText}\n`;
            content += `${c.lead2}\t${alt2Text}\t${c.dest2.printText}\n\n`;
        });

        // --- TAXA CHAPTERS ---
        // One block per taxon record, in panel order. Empty fields are omitted so a
        // sparsely-filled taxon stays compact.
        if (taxa.length > 0) {
            content += `========================================\n`;
            content += `TAXA\n`;
            content += `========================================\n\n`;

            const withAuctor = (line: TaxonNameLine) => line.auctor ? `${line.name} ${line.auctor}` : line.name;

            taxa.forEach((taxon, index) => {
                const displayNum = index + 1;
                const names = buildTaxonExportNames(taxon, nameMode);

                content += `${displayNum}. ${withAuctor(names.heading)}\n`;
                if (names.secondary) content += `  ${names.secondary.label}: ${withAuctor(names.secondary)}\n`;

                if (taxon.synonyms.length > 0) content += `  Synonyms: ${taxon.synonyms.join('; ')}\n`;
                if (taxon.description) content += `  Description: ${taxon.description}\n`;
                if (taxon.biology) content += `  Biology: ${taxon.biology}\n`;
                if (taxon.distribution) content += `  Distribution: ${taxon.distribution}\n`;
                if (taxon.confusables.length > 0) {
                    content += `  Confusable species:\n`;
                    taxon.confusables.forEach(c => {
                        content += `    - ${c.name}${c.distinction ? ` — ${c.distinction}` : ''}\n`;
                    });
                }

                content += `\n`;
            });
        }

        // --- FIGURES DATA METADATA APPENDIX ---
        if (figures.length > 0) {
            content += `========================================\n`;
            content += `FIGURES DATA\n`;
            content += `========================================\n\n`;

            figures.forEach((fig, index) => {
                const displayNum = index + 1;
                const filename = fig.filename || 'Untitled File';
                const caption = fig.caption || 'No caption provided.';

                content += `Figure #${displayNum}\n`;
                content += `  Filename: ${filename}\n`;
                content += `  Caption:  ${caption}\n\n`;
            });
        }

        // Forward to the unified browser file system download thread
        triggerFileDownload(content, sanitizeFilename(model.title, '.txt'), 'text/plain;charset=utf-8;');

    } catch (error) {
        console.error('Plain Text Export system failure:', error);
        showToast('❌ An unexpected error disrupted the plain text document generation pipeline.', 'error');
    }
}
