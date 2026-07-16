import { describe, expect, it } from 'vitest';
import { getKeyDialect, listKeyDialects, registerKeyDialect } from '../../src/importers/keyDialect.ts';
import { DEFAULT_PARSE_OPTIONS, parsePlainTextKey } from '../../src/importers/plainTextImporter.ts';
import { reconstructPage } from '../../src/importers/pdf/layout.ts';
import {
    getStoredOcrLanguage,
    languageCodeFromFilename,
    listStoredOcrLanguages,
    saveOcrLanguage,
} from '../../src/importers/pdf/ocrLanguageStore.ts';
import { detectKeyRegions, scoreCoupletLikeness, selectPreferredKeyRegion } from '../../src/importers/pdf/segment.ts';
import type { KeyRegion, PositionedSpan } from '../../src/importers/pdf/pdfTypes.ts';

function positioned(text: string, x: number, y: number, width: number): PositionedSpan {
    return { text, x, y, width, height: 0.02, fontHeight: 0.02, baseline: y + 0.017 };
}

describe('key dialect registry', () => {
    it('registers the existing parser as linear without changing its result', () => {
        const raw = '1. Has wings ..... Species one\n— Lacks wings ..... Species two';
        const dialectResult = getKeyDialect('linear')?.parse(raw, DEFAULT_PARSE_OPTIONS);
        expect(dialectResult).toEqual(parsePlainTextKey(raw, DEFAULT_PARSE_OPTIONS));
        expect(listKeyDialects().some(dialect => dialect.id === 'linear')).toBe(true);
    });

    it('registers and replaces a dialect by stable id', () => {
        registerKeyDialect({ id: 'test-dialect', label: 'First', parse: parsePlainTextKey });
        registerKeyDialect({ id: 'test-dialect', label: 'Replacement', parse: parsePlainTextKey });
        expect(getKeyDialect('test-dialect')?.label).toBe('Replacement');
        expect(listKeyDialects().filter(item => item.id === 'test-dialect')).toHaveLength(1);
    });
});

describe('PDF key-region detection', () => {
    it('scores marker, separator, and destination-like lines as key content', () => {
        expect(scoreCoupletLikeness('1. Has wings ..... 2')).toBeGreaterThanOrEqual(3);
        expect(scoreCoupletLikeness('ordinary explanatory prose')).toBeLessThan(3);
    });

    it('keeps separately detected dense key regions independent', () => {
        const filler = Array.from({ length: 8 }, (_, index) => `Long explanatory paragraph ${index}.`).join('\n');
        const regions = detectKeyRegions([{
            pageNum: 1,
            text: [
                'Introductory prose',
                '1. A ..... 2',
                '— B ..... Species one',
                '2. C ..... Species two',
                '— D ..... Species three',
                filler,
                '10. E ..... 11',
                '— F ..... Species four',
                '11. G ..... Species five',
                '— H ..... Species six',
            ].join('\n'),
        }]);
        expect(regions).toHaveLength(2);
        expect(regions[0].text).toContain('1. A');
        expect(regions[1].text).toContain('10. E');
    });

    it('splits adjacent keys when first-lead numbering restarts', () => {
        const regions = detectKeyRegions([{
            pageNum: 4,
            text: [
                '1. A ..... 2',
                '— B ..... Species one',
                '2. C ..... Species two',
                '— D ..... Species three',
                '1. E ..... 2',
                '— F ..... Species four',
                '2. G ..... Species five',
                '— H ..... Species six',
            ].join('\n'),
        }]);
        expect(regions).toHaveLength(2);
        expect(regions[0].text).toContain('1. A');
        expect(regions[1].text).toContain('1. E');
    });

    it('joins a lead and its dotted destination across a page boundary', () => {
        const firstPage = reconstructPage([
            positioned('1.', 0.08, 0.78, 0.025),
            positioned('Long diagnostic description', 0.14, 0.78, 0.3),
        ], { pageNum: 1, removeFurniture: false });
        const secondPage = reconstructPage([
            positioned('continued', 0.14, 0.1, 0.09),
            positioned('.....', 0.62, 0.1, 0.08),
            positioned('Species one', 0.75, 0.1, 0.12),
            positioned('—', 0.08, 0.16, 0.025),
            positioned('Other description', 0.14, 0.16, 0.18),
            positioned('.....', 0.62, 0.16, 0.08),
            positioned('Species two', 0.75, 0.16, 0.12),
        ], { pageNum: 2, removeFurniture: false });
        const regions = detectKeyRegions([
            { pageNum: 1, text: firstPage.text, lines: firstPage.positionedLines },
            { pageNum: 2, text: secondPage.text, lines: secondPage.positionedLines },
        ]);
        expect(regions).toHaveLength(1);
        const parsed = parsePlainTextKey(regions[0].text);
        expect(parsed.couplets[0].alt1).toBe('Long diagnostic description continued');
        expect(parsed.couplets[0].branch1).toEqual({ kind: 'taxonDraft', name: 'Species one' });
        expect(parsed.couplets[0].branch2).toEqual({ kind: 'taxonDraft', name: 'Species two' });
    });

    it('prefers a substantially larger region when confidence is effectively tied', () => {
        const small = { id: 'small', confidence: 0.99, leads: [{}, {}] } as KeyRegion;
        const substantial = {
            id: 'large',
            confidence: 0.98,
            leads: Array.from({ length: 20 }, () => ({})),
        } as KeyRegion;
        expect(selectPreferredKeyRegion([small, substantial])).toBe(substantial);
        expect(selectPreferredKeyRegion([
            { ...substantial, confidence: 0.9 },
            small,
        ])).toBe(small);
    });
});

describe('custom OCR language persistence', () => {
    it('derives safe language codes from traineddata filenames', () => {
        expect(languageCodeFromFilename('SWE.traineddata')).toBe('swe');
        expect(languageCodeFromFilename('deu_frak.traineddata.gz')).toBe('deu_frak');
        expect(languageCodeFromFilename('../bad.bin')).toBeNull();
    });

    it('stores uploaded language bytes in the separate IndexedDB database', async () => {
        await saveOcrLanguage({
            code: 'swe',
            filename: 'swe.traineddata.gz',
            bytes: new Uint8Array([1, 2, 3]).buffer,
            addedAt: 123,
        });
        const stored = await getStoredOcrLanguage('swe');
        expect(stored?.filename).toBe('swe.traineddata.gz');
        expect([...new Uint8Array(stored!.bytes)]).toEqual([1, 2, 3]);
        expect((await listStoredOcrLanguages()).map(item => item.code)).toEqual(['swe']);
    });
});
