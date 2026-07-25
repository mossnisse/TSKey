// Vitest runs in Node; the application intentionally does not include Node globals in its TypeScript config.
// @ts-expect-error Node's filesystem API is available to the test runner.
import { existsSync, readFileSync } from 'node:fs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import { parsePlainTextKey } from '../../src/importers/plainTextImporter.ts';
import {
    findRepeatedFurniture,
    findSharedColumnGutter,
    reconstructPage,
    type PositionedPage,
} from '../../src/importers/pdf/layout.ts';
import { textItemToPositionedSpan } from '../../src/importers/pdf/pdfTextLayer.ts';
import { detectKeyRegions, selectPreferredKeyRegion } from '../../src/importers/pdf/segment.ts';

// The fixture is a published article, so it is gitignored rather than committed.
// The suite runs for whoever has the PDF locally and skips itself everywhere else
// (a fresh clone, CI) instead of failing the whole run on a missing file.
const FIXTURE_PDF = 'test_document/Ericson & Hellqvist 2015.pdf';

describe.skipIf(!existsSync(FIXTURE_PDF))('PDF importer illustrated-key regression', () => {
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

    it('keeps the 47-couplet key continuous while excluding figure captions', async () => {
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
        const sharedColumnGutter = findSharedColumnGutter(physicalPages);
        const pages = physicalPages.map(page => {
            const reconstructed = reconstructPage(page.spans, {
                pageNum: page.pageNum,
                repeatedFurniture: furniture,
                columnGutter: sharedColumnGutter ?? undefined,
            });
            return { pageNum: page.pageNum, text: reconstructed.text, lines: reconstructed.positionedLines };
        });
        const regions = detectKeyRegions(pages);
        const region = regions.find(candidate => candidate.startPage === 2 && candidate.endPage === 8);

        expect(region).toBeDefined();
        expect(region?.leads).toHaveLength(94);
        expect(selectPreferredKeyRegion(regions)).toBe(region);
        expect(region?.text).not.toMatch(/\bFigur\s+\d+\./u);
        const parsed = parsePlainTextKey(region!.text);
        expect(parsed.errors).toEqual([]);
        expect(parsed.stepCount).toBe(47);
        expect(parsed.couplets.every(couplet => couplet.alt1 && couplet.alt2)).toBe(true);
        expect(parsed.couplets[0].branch1).toEqual({ kind: 'linked', targetId: 2 });
        expect(parsed.couplets[0].branch2).toEqual({ kind: 'linked', targetId: 33 });
        expect(parsed.couplets[22].branch1).toEqual({ kind: 'linked', targetId: 24 });
        expect(parsed.couplets[22].branch2).toEqual({ kind: 'linked', targetId: 25 });
        expect(parsed.couplets[30].branch2).toEqual({ kind: 'linked', targetId: 32 });
        expect(parsed.couplets[46].branch1).toEqual({ kind: 'taxonDraft', name: 'Elaphropeza (Hyb.)' });
        expect(parsed.couplets[46].branch2).toEqual({ kind: 'taxonDraft', name: 'Drapetis (Hyb.)' });
    }, 30_000);
});
