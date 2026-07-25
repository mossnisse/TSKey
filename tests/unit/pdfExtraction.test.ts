import { describe, expect, it } from 'vitest';
import { rebuildSelectedPages } from '../../src/importers/pdf/extract.ts';
import { findRepeatedFurniture, normalizeSpan, reconstructPage } from '../../src/importers/pdf/layout.ts';
import { ocrBlocksToPositionedSpans } from '../../src/importers/pdf/ocr.ts';
import { parsePageRange } from '../../src/importers/pdf/pageRange.ts';
import { effectivePageText, type PdfPageState, type PdfSession, type PositionedSpan } from '../../src/importers/pdf/pdfTypes.ts';
import { assessTextQuality } from '../../src/importers/pdf/textQuality.ts';

function span(
    text: string,
    x: number,
    y: number,
    width = Math.max(0.02, text.length * 0.008),
    height = 0.025,
): PositionedSpan {
    return { text, x, y, width, height, fontHeight: height };
}

describe('PDF page ranges and embedded-text quality', () => {
    it('parses, sorts, and deduplicates mixed page ranges', () => {
        expect(parsePageRange('8, 1-3, 3, 10-12', 12)).toEqual({
            pages: [1, 2, 3, 8, 10, 11, 12],
            error: null,
        });
    });

    it('rejects malformed, reversed, empty, and out-of-bounds ranges', () => {
        expect(parsePageRange('', 12).error).toMatch(/at least one/i);
        expect(parsePageRange('4-2', 12).error).toMatch(/backwards/i);
        expect(parsePageRange('1, x', 12).error).toMatch(/invalid/i);
        expect(parsePageRange('13', 12).error).toMatch(/between 1 and 12/i);
    });

    it('accepts a recognized lead marker even when the page has little text', () => {
        expect(assessTextQuality('1. A ..... Taxon').usable).toBe(true);
    });

    it('requires enough printable, alphanumeric text when no lead is present', () => {
        expect(assessTextQuality('A sufficiently long page of ordinary readable prose.').usable).toBe(true);
        expect(assessTextQuality('\u0000\u0001!@#$%^&*()_+').usable).toBe(false);
    });
});

describe('positioned PDF page reconstruction', () => {
    it('clamps normalized coordinates and synthesizes a final destination tab', () => {
        expect(normalizeSpan(span('x', -0.2, 1.4, 2, -0.1))).toMatchObject({
            x: 0,
            y: 1,
            width: 1,
            height: 0,
        });
        const result = reconstructPage([
            span('1.', 0.08, 0.3, 0.02),
            span('Has wings', 0.13, 0.3, 0.1),
            span('2', 0.78, 0.3, 0.015),
        ], { removeFurniture: false });
        expect(result.text).toBe('1. Has wings\t2');
    });

    it('removes isolated margin page numbers without deleting body numbers or footnotes', () => {
        const result = reconstructPage([
            span('12', 0.48, 0.95),
            span('2', 0.8, 0.4),
            span('Small but legitimate footnote text', 0.08, 0.86, 0.23, 0.009),
        ]);
        expect(result.text).not.toMatch(/^12$/m);
        expect(result.text).toMatch(/^2$/m);
        expect(result.text).toContain('Small but legitimate footnote text');
    });

    it('removes repeated headers only when they recur on enough selected pages', () => {
        const pages = [1, 2, 3].map(pageNum => ({
            pageNum,
            spans: [span('Flora of Sweden 2026', 0.1, 0.02, 0.2), span(`Body ${pageNum}`, 0.1, 0.4, 0.1)],
        }));
        const furniture = findRepeatedFurniture(pages);
        expect(furniture.has('flora of sweden #')).toBe(true);
        expect(reconstructPage(pages[0].spans, { repeatedFurniture: furniture }).text).toBe('Body 1');
    });

    it('detects a stable gutter and reorders two-column pages by column', () => {
        const spans = [0.2, 0.3, 0.4].flatMap((y, index) => [
            span(`Left column line ${index}`, 0.05, y, 0.2),
            span(`Right column line ${index}`, 0.65, y, 0.21),
        ]);
        const result = reconstructPage(spans, { removeFurniture: false });
        expect(result.warnings.join(' ')).toMatch(/two-column/i);
        expect(result.columnCount).toBe(2);
        expect(result.text.indexOf('Left column line 2')).toBeLessThan(result.text.indexOf('Right column line 0'));
    });

    it('detects an illustrated sidebar from a stable left edge despite staggered captions', () => {
        const filler = Array.from({ length: 40 }, (_, index) =>
            span(`Left-only body line ${index}`, 0.05, 0.1 + index * 0.018, 0.42));
        const paired = [0.52, 0.58, 0.64, 0.7].flatMap((rightX, index) => [
            span(`Left key line ${index} with enough text`, 0.05, 0.82 + index * 0.025, 0.42),
            span(`Figure caption ${index} with enough text`, rightX, 0.82 + index * 0.025, 0.22),
        ]);
        const result = reconstructPage([...filler, ...paired], { removeFurniture: false });
        expect(result.columnCount).toBe(2);
        expect(result.text.indexOf('Left key line 3')).toBeLessThan(result.text.indexOf('Figure caption 0'));
    });

    it('retains baseline, font, source, and physical gap evidence on reconstructed lines', () => {
        const result = reconstructPage([{
            ...span('Diagnostic text', 0.1, 0.3, 0.15),
            baseline: 0.322,
            fontName: 'F5',
            fontFamily: 'Times',
            source: 'text',
            hasEol: true,
        }], { pageNum: 7, removeFurniture: false });
        expect(result.positionedLines[0]).toMatchObject({
            pageNum: 7,
            baseline: 0.322,
            fontFamilies: ['Times'],
        });
        expect(result.positionedLines[0].spans[0]).toMatchObject({
            fontName: 'F5',
            source: 'text',
            hasEol: true,
        });
    });

    it('keeps a shifted, smaller subscript on its surrounding text line', () => {
        const result = reconstructPage([
            { ...span('Vein R', 0.1, 0.3, 0.06, 0.02), baseline: 0.318 },
            { ...span('1', 0.158, 0.312, 0.008, 0.011), baseline: 0.324 },
            { ...span('setose', 0.17, 0.3, 0.06, 0.02), baseline: 0.318 },
        ], { removeFurniture: false });
        expect(result.positionedLines).toHaveLength(1);
        expect(result.text).toMatch(/^Vein R\s?1 setose$/u);
    });

    it('keeps OCR word coordinates, confidence, baseline, and line endings', () => {
        const spans = ocrBlocksToPositionedSpans([{
            paragraphs: [{
                lines: [{
                    words: [
                        { text: '1.', confidence: 97, bbox: { x0: 100, y0: 200, x1: 125, y1: 230 } },
                        { text: 'Wings', confidence: 88, bbox: { x0: 150, y0: 198, x1: 250, y1: 230 } },
                    ],
                }],
            }],
        }], 1000, 2000);
        expect(spans[0]).toMatchObject({
            x: 0.1,
            y: 0.1,
            baseline: 0.115,
            confidence: 97,
            source: 'ocr',
            hasEol: false,
        });
        expect(spans[1]).toMatchObject({
            baseline: 0.115,
            confidence: 88,
            source: 'ocr',
            hasEol: true,
        });
    });

    it('regenerates only generated text, leaving a manual page edit effective', () => {
        const page: PdfPageState = {
            pageNum: 1,
            status: 'text',
            sourceSpans: [span('Regenerated source', 0.1, 0.4, 0.2)],
            generatedText: 'Old generated text',
            editedText: 'Manual correction',
        };
        const fakeSession = { pages: [page] } as PdfSession;
        rebuildSelectedPages(fakeSession, [1], false);
        expect(page.generatedText).toBe('Old generated text');
        expect(effectivePageText(page)).toBe('Manual correction');
    });

    it('keeps the prior text and error message for a failed OCR page', () => {
        const page: PdfPageState = {
            pageNum: 1,
            status: 'failed',
            sourceSpans: [span('Embedded fallback', 0.1, 0.4, 0.2)],
            generatedText: 'Prior extracted text',
            warning: 'OCR engine failed',
        };
        rebuildSelectedPages({ pages: [page] } as PdfSession, [1], true);
        expect(page.generatedText).toBe('Prior extracted text');
        expect(page.warning).toBe('OCR engine failed');
    });
});
