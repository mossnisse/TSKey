// Vitest runs in Node; the application intentionally does not include Node globals in its TypeScript config.
// @ts-expect-error Node's filesystem API is available to the test runner.
import { existsSync, readFileSync } from 'node:fs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parsePlainTextKey } from '../../src/importers/plainTextImporter.ts';
import { findRepeatedFurniture, reconstructPage, type PositionedPage } from '../../src/importers/pdf/layout.ts';
import { textItemToPositionedSpan } from '../../src/importers/pdf/pdfTextLayer.ts';
import { detectKeyRegions, selectPreferredKeyRegion } from '../../src/importers/pdf/segment.ts';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';

// The fixture is a published article, so it is gitignored rather than committed.
// The suite runs for whoever has the PDF locally and skips itself everywhere else
// (a fresh clone, CI) instead of failing the whole run on a missing file.
const FIXTURE_PDF = 'test_document/Lonsdale at al 2010 Phylogenetic analysis of the druid flies (Diptera Schizophora Clusiidae) based on mophological and molecular data.pdf';

describe.skipIf(!existsSync(FIXTURE_PDF))('PDF importer OCR-damaged text-layer regression', () => {
    let document: PDFDocumentProxy;
    let loadingTask: PDFDocumentLoadingTask;

    beforeAll(async () => {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const bytes = new Uint8Array(readFileSync(FIXTURE_PDF));
        loadingTask = pdfjs.getDocument({ data: bytes, disableFontFace: true });
        document = await loadingTask.promise;
    }, 30_000);

    afterAll(async () => {
        await loadingTask?.destroy();
    });

    it('finds the complete 12-couplet key despite damaged dash glyphs and irregular baselines', async () => {
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

        const furniture = findRepeatedFurniture(physicalPages);
        const pages = physicalPages.map(page => {
            const reconstructed = reconstructPage(page.spans, {
                pageNum: page.pageNum,
                repeatedFurniture: furniture,
            });
            return { pageNum: page.pageNum, text: reconstructed.text, lines: reconstructed.positionedLines };
        });
        const regions = detectKeyRegions(pages);
        const region = regions.find(candidate => candidate.startPage === 35 && candidate.endPage === 39);

        expect(region).toBeDefined();
        expect(region?.leads).toHaveLength(24);
        expect(selectPreferredKeyRegion(regions)).toBe(region);
        const parsed = parsePlainTextKey(region!.text);
        expect(parsed.errors).toEqual([]);
        expect(parsed.stepCount).toBe(12);
        expect(parsed.couplets.every(couplet => couplet.alt1 && couplet.alt2)).toBe(true);
        expect(parsed.couplets[0].branch1).toEqual({ kind: 'linked', targetId: 2 });
        expect(parsed.couplets[0].branch2).toEqual({ kind: 'linked', targetId: 5 });
        expect(parsed.couplets[6].branch1).toEqual({ kind: 'linked', targetId: 8 });
        expect(parsed.couplets[7].branch2).toEqual({ kind: 'linked', targetId: 9 });
        expect(parsed.couplets[8].alt1).toContain('Neotropical, Nearctic');
        expect(parsed.couplets[8].branch1).toEqual({ kind: 'taxonDraft', name: 'Sobarocephala Czerny' });
        expect(parsed.couplets[8].branch2).toEqual({ kind: 'taxonDraft', name: 'Procerosoma Lonsdale & Marshall' });

        const page38Lines = pages[37].lines ?? [];
        expect(page38Lines.some(line => /M1\+2 ratio/u.test(line.text))).toBe(true);
        expect(page38Lines.some(line => /R1 (?:setose|bare)/u.test(line.text))).toBe(true);
        expect(page38Lines.some(line => /^(?:1|1\+2)$/u.test(line.text))).toBe(false);
    }, 30_000);
});
