// Vitest runs in Node; the application intentionally does not include Node globals in its TypeScript config.
// @ts-expect-error Node's filesystem API is available to the test runner.
import { readFileSync } from 'node:fs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parsePlainTextKey } from '../../src/importers/plainTextImporter.ts';
import { findRepeatedFurniture, reconstructPage } from '../../src/importers/pdf/layout.ts';
import { textItemToPositionedSpan } from '../../src/importers/pdf/pdfTextLayer.ts';
import { detectKeyRegions, selectPreferredKeyRegion } from '../../src/importers/pdf/segment.ts';
import type { PositionedPage } from '../../src/importers/pdf/layout.ts';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';

describe('PDF importer real-document regression', () => {
    let document: PDFDocumentProxy;
    let loadingTask: PDFDocumentLoadingTask;

    beforeAll(async () => {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const bytes = new Uint8Array(readFileSync(
            'test_document/Lonsdale & Marshall 2007 Clusiodes.pdf',
        ));
        loadingTask = pdfjs.getDocument({ data: bytes, disableFontFace: true });
        document = await loadingTask.promise;
    }, 30_000);

    afterAll(async () => {
        await loadingTask?.destroy();
    });

    it('finds and parses the 14-couplet key inside the complete 43-page article', async () => {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const physicalPages: PositionedPage[] = [];
        for (let pageNum = 1; pageNum <= document.numPages; pageNum++) {
            const page = await document.getPage(pageNum);
            try {
                const viewport = page.getViewport({ scale: 1 });
                const content = await page.getTextContent();
                physicalPages.push({
                    pageNum,
                    spans: content.items
                        .filter((item): item is TextItem => 'str' in item && !!item.str.trim())
                        .map(item => textItemToPositionedSpan(
                            item,
                            viewport,
                            pdfjs.Util.transform,
                            content.styles[item.fontName],
                        )),
                });
            } finally {
                page.cleanup();
            }
        }

        expect(document.numPages).toBe(43);
        const furniture = findRepeatedFurniture(physicalPages);
        const pages = physicalPages.map(page => {
            const reconstructed = reconstructPage(page.spans, {
                pageNum: page.pageNum,
                repeatedFurniture: furniture,
            });
            return { pageNum: page.pageNum, text: reconstructed.text, lines: reconstructed.positionedLines };
        });
        const regions = detectKeyRegions(pages);
        const genusRegion = regions.find(candidate => candidate.startPage === 2 && candidate.endPage === 3);
        const region = regions.find(candidate => candidate.startPage === 9 && candidate.endPage === 11);

        expect(genusRegion, regions.map(candidate => candidate.label).join('\n')).toBeDefined();
        expect(parsePlainTextKey(genusRegion!.text).couplets[0].branch2)
            .toEqual({ kind: 'taxonDraft', name: 'Clusiodes COQUILLETT' });
        expect(region, regions.map(candidate => candidate.label).join('\n')).toBeDefined();
        expect(selectPreferredKeyRegion(regions)).toBe(region);
        expect(region?.leads).toHaveLength(28);
        const parsed = parsePlainTextKey(region!.text);
        expect(parsed.errors).toEqual([]);
        expect(parsed.stepCount).toBe(14);
        expect(parsed.couplets.every(couplet => couplet.alt1 && couplet.alt2)).toBe(true);
        expect(parsed.couplets[0].branch1).toEqual({ kind: 'linked', targetId: 2 });
        expect(parsed.couplets[0].branch2).toEqual({ kind: 'linked', targetId: 8 });
        expect(parsed.couplets[2].branch1).toEqual({ kind: 'taxonDraft', name: 'C. verticalis (COLLIN)' });
        expect(parsed.couplets[13].branch1).toEqual({ kind: 'taxonDraft', name: 'C. apicalis (ZETTERSTEDT)' });
        expect(parsed.couplets[13].branch2).toEqual({ kind: 'taxonDraft', name: 'C. pictipes (ZETTERSTEDT)' });
    }, 30_000);
});
