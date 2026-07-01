// plainTextExporter.ts
import type { KeyStore } from '../store';
import { showToast } from '../uiRenderer.ts';
import { resolveDestination, triggerFileDownload, buildIdToIndexMap, buildFigureIdToDisplayNumMap, sanitizeFilename, buildCoupletLeads, buildBackReferenceMap, buildTaxaContext
} from '../utils.ts';
import type { LeadFormat, NameDisplayMode } from '../utils.ts';

/**
 * Compiles the dichotomous key into a tab-separated plain-text document,
 * fully resolving embedded figure references and appending a metadata block.
 */
export function exportKeyToPlainText(store: KeyStore, leadFormat: LeadFormat, showBackReference: boolean, nameMode: NameDisplayMode): void {
    try {
        const key = store.getKey();
        const figures = store.getFigures();

        const idToIndexMap = buildIdToIndexMap(key);
        const idToDisplayNum = buildFigureIdToDisplayNumMap(figures);
        const backRefMap = showBackReference ? buildBackReferenceMap(key) : null;
        const taxa = store.getTaxa();
        const taxaCtx = buildTaxaContext(taxa, nameMode);
        
        let content = '';

        // --- KEY TITLE ---
        content += `${store.getTitle()}\n\n`;

        // --- DICHOTOMOUS KEY COUPLETS ---
        if (key.length === 0) {
            content += `[The identification key is currently empty. Add key steps in the editor to populate this document.]\n\n`;
        }

        key.forEach((c, index) => {
            const currentDisplayNum = index + 1;

            // Resolve destinations (taxon name, step number, or '...' when empty)
            const dest1 = resolveDestination(c.branch1, idToIndexMap, taxaCtx).printText;
            const dest2 = resolveDestination(c.branch2, idToIndexMap, taxaCtx).printText;

            // Resolve figure shorthand macros (e.g. converting [figID: 101] to [fig: 1])
            const alt1Text = store.resolveTextReferences(c.alt1, idToDisplayNum) || '___';
            const alt2Text = store.resolveTextReferences(c.alt2, idToDisplayNum) || '___';

            // Append lines to document
            const { lead1, lead2 } = buildCoupletLeads(leadFormat, currentDisplayNum, backRefMap?.get(c.id));
            content += `${lead1}\t${alt1Text}\t${dest1}\n`;
            content += `${lead2}\t${alt2Text}\t${dest2}\n\n`;
        });

        // --- TAXA CHAPTERS ---
        // One block per taxon record, in panel order. Empty fields are omitted so a
        // sparsely-filled taxon stays compact.
        if (taxa.length > 0) {
            content += `========================================\n`;
            content += `TAXA\n`;
            content += `========================================\n\n`;

            taxa.forEach((taxon, index) => {
                const displayNum = index + 1;
                const heading = taxon.scientificName || 'Untitled taxon';
                content += `${displayNum}. ${heading}${taxon.auctor ? ' ' + taxon.auctor : ''}\n`;

                if (taxon.vernacularName) content += `  Vernacular name: ${taxon.vernacularName}\n`;
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
        triggerFileDownload(content, sanitizeFilename(store.getTitle(), '.txt'), 'text/plain;charset=utf-8;');
        
    } catch (error) {
        console.error('Plain Text Export system failure:', error);
        showToast('❌ An unexpected error disrupted the plain text document generation pipeline.', 'error');
    }
}