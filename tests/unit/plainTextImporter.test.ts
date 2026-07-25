import { describe, expect, it } from 'vitest';
import { decodeBytes, encodingLabel, parsePlainTextKey } from '../../src/importers/plainTextImporter.ts';

const buffer = (bytes: number[]): ArrayBuffer => new Uint8Array(bytes).buffer;

describe('plain-text decoding', () => {
    it('detects a UTF-16 little-endian BOM', () => {
        const bytes = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]);
        const result = decodeBytes(bytes.buffer, 'auto');
        expect(result.encoding).toBe('utf-16le');
        expect(result.autoDetected).toBe(true);
        expect(result.text).toBe('AB');
    });

    it('decodes Windows-1252 punctuation explicitly', () => {
        const bytes = new Uint8Array([0x93, 0x41, 0x94]);
        expect(decodeBytes(bytes.buffer, 'windows-1252').text).toBe('“A”');
    });

    it('sniffs a UTF-8 BOM and strips it from the decoded text', () => {
        const result = decodeBytes(buffer([0xef, 0xbb, 0xbf, 0x41]), 'auto');
        expect(result.encoding).toBe('utf-8');
        expect(result.text).toBe('A');
    });

    it('reads a UTF-16 big-endian BOM and a BOM-less big-endian stream', () => {
        expect(decodeBytes(buffer([0xfe, 0xff, 0x00, 0x41, 0x00, 0x42]), 'auto'))
            .toMatchObject({ encoding: 'utf-16be', text: 'AB' });
        // No BOM: dense null bytes in the even lane reveal big-endian UTF-16.
        expect(decodeBytes(buffer([0x00, 0x41, 0x00, 0x42]), 'auto'))
            .toMatchObject({ encoding: 'utf-16be', text: 'AB' });
    });

    it('trusts valid UTF-8 and falls back to Windows-1252 on invalid bytes', () => {
        expect(decodeBytes(buffer([0x68, 0x69]), 'auto').encoding).toBe('utf-8');
        const fallback = decodeBytes(buffer([0x41, 0x93, 0x42]), 'auto');
        expect(fallback.encoding).toBe('windows-1252');
        expect(fallback.text).toBe('A“B');
    });

    it('labels every encoding choice for status messages', () => {
        expect(encodingLabel('auto')).toMatch(/auto/i);
        expect(encodingLabel('utf-16be')).toBe('UTF-16 BE');
        expect(encodingLabel('windows-1252')).toMatch(/1252/);
    });
});

describe('plain-text key parsing', () => {
    it('parses numbered and dash leads with links and terminal taxa', () => {
        const result = parsePlainTextKey(`
1. Has wings ..... 2
— Lacks wings ..... Apteryx
2a Forewing hardened ..... Coleoptera
2b Forewing membranous ..... Diptera
`);

        expect(result.errors).toEqual([]);
        expect(result.stepCount).toBe(2);
        expect(result.couplets[0].branch1).toEqual({ kind: 'linked', targetId: 2 });
        expect(result.couplets[0].branch2).toEqual({ kind: 'taxonDraft', name: 'Apteryx' });
        expect(result.couplets[1].alt1).toBe('Forewing hardened');
        expect(result.couplets[1].branch2).toEqual({ kind: 'taxonDraft', name: 'Diptera' });
    });

    it('recognizes a prime-marked second alternative used by printed keys', () => {
        const result = parsePlainTextKey('1. First ..... Species one\n1′ Second ..... Species two');
        expect(result.errors).toEqual([]);
        expect(result.couplets[0].alt1).toBe('First');
        expect(result.couplets[0].alt2).toBe('Second');
    });

    it('recognizes a plus-sign second alternative used by botanical Floras', () => {
        const result = parsePlainTextKey('1. Leaves opposite ..... 2\n+ Leaves alternate ..... Salix');
        expect(result.errors).toEqual([]);
        expect(result.couplets[0].alt1).toBe('Leaves opposite');
        expect(result.couplets[0].alt2).toBe('Leaves alternate');
        expect(result.couplets[0].branch2).toEqual({ kind: 'taxonDraft', name: 'Salix' });
    });

    it('recovers a second-lead dash lost as a PDF replacement glyph', () => {
        const result = parsePlainTextKey('1. Has wings ..... Species one\n\uFFFD Lacks wings ..... Species two');
        expect(result.errors).toEqual([]);
        expect(result.couplets[0].alt2).toBe('Lacks wings');
        expect(result.couplets[0].branch2).toEqual({ kind: 'taxonDraft', name: 'Species two' });
    });

    it('recognizes markers with no space after the period or dash', () => {
        const result = parsePlainTextKey('1.Has wings ..... 2\n—Lacks wings ..... Apteryx');
        expect(result.couplets[0].alt1).toBe('Has wings');
        expect(result.couplets[0].alt2).toBe('Lacks wings');
        expect(result.couplets[0].branch1).toEqual({ kind: 'linked', targetId: 2 });
        expect(result.couplets[0].branch2).toEqual({ kind: 'taxonDraft', name: 'Apteryx' });
    });

    it('does not mistake a leading measurement for a step marker', () => {
        const result = parsePlainTextKey('1. Wings\n1.5 mm long ..... Species one\n— Small ..... Species two');
        expect(result.stepCount).toBe(1);
        expect(result.couplets[0].alt1).toContain('1.5 mm long');
        expect(result.couplets[0].branch1).toEqual({ kind: 'taxonDraft', name: 'Species one' });
    });

    it('recovers an OCR-mangled numeric destination so its link resolves', () => {
        const result = parsePlainTextKey(`
1. Continue ..... l0
— Stop ..... Species one
10. End A ..... Species two
— End B ..... Species three
`);
        expect(result.couplets[0].branch1).toEqual({ kind: 'linked', targetId: 10 });
    });

    it('strips a trailing arrow cue from a destination', () => {
        const result = parsePlainTextKey('1. Inner side → 6\n— Outer side ..... Species one\n6. End ..... Species two\n— End2 ..... Species three');
        expect(result.couplets[0].alt1).toBe('Inner side');
        expect(result.couplets[0].branch1).toEqual({ kind: 'linked', targetId: 6 });
    });

    it('joins wrapped lines and dehyphenates split words', () => {
        const result = parsePlainTextKey(`
1. Long diag-
nostic description ..... Species one
— Other ..... Species two
`);
        expect(result.couplets[0].alt1).toBe('Long diagnostic description');
    });

    it('fills missing steps so numeric destinations resolve', () => {
        const result = parsePlainTextKey(`
1. Continue ..... 3
— Stop ..... Species one
3. End A ..... Species two
— End B ..... Species three
`);
        expect(result.couplets.map(item => item.id)).toEqual([1, 2, 3]);
        expect(result.couplets[0].branch1).toEqual({ kind: 'linked', targetId: 3 });
        expect(result.warnings.join(' ')).toMatch(/Generated 1 empty/i);
    });

    it('keeps missing destinations unresolved when gap filling is disabled', () => {
        const result = parsePlainTextKey('1. Continue ..... 3\n— Stop ..... Species', { fillMissingCouplets: false });
        expect(result.couplets[0].branch1).toEqual({ kind: 'unresolved', couplet: 3 });
    });

    it('rejects input with no recognizable leads and ignores a figures appendix', () => {
        expect(parsePlainTextKey('ordinary prose only').errors).toHaveLength(1);
        const result = parsePlainTextKey('1. A ..... Taxon A\n— B ..... Taxon B\nFIGURES DATA\n99. not a lead ..... 1');
        expect(result.stepCount).toBe(1);
    });

    it('ignores a parenthesized back-reference after the step number', () => {
        const result = parsePlainTextKey(`
1. A ..... 2
— B ..... Species one
2 (1) C ..... Species two
— D ..... Species three
`);
        expect(result.couplets[1].alt1).toBe('C');
        expect(result.stepCount).toBe(2);
    });

    it('splits on a bare trailing number when there is no leader', () => {
        const result = parsePlainTextKey(`
1. Inner side 6
— Outer side ..... Species one
6. End ..... Species two
— End2 ..... Species three
`);
        expect(result.couplets[0].branch1).toEqual({ kind: 'linked', targetId: 6 });
    });

    it('splits on a run of wide whitespace when enabled', () => {
        const result = parsePlainTextKey('1. Big wings    2\n— Small    Species');
        expect(result.couplets[0].alt1).toBe('Big wings');
        expect(result.couplets[0].branch1).toEqual({ kind: 'linked', targetId: 2 });
    });

    it('reads tab-delimited cells and the empty description/destination placeholders', () => {
        const result = parsePlainTextKey('1.\t___\t2\n—\tNo wing\t...\n2.\tEnd\tSpecies\n—\tEnd2\tSpecies two');
        expect(result.couplets[0].alt1).toBe('');
        expect(result.couplets[0].branch1).toEqual({ kind: 'linked', targetId: 2 });
        expect(result.couplets[0].branch2).toEqual({ kind: 'empty' });
    });
});

describe('plain-text parser warnings and safety limits', () => {
    it('skips step numbers above the safety ceiling', () => {
        const result = parsePlainTextKey(`
1. A ..... Species one
— B ..... Species two
600. C ..... Species three
— D ..... Species four
`);
        expect(result.stepCount).toBe(1);
        expect(result.warnings.join(' ')).toMatch(/exceeds the safety ceiling/i);
    });

    it('keeps an implausibly large destination number as taxon text', () => {
        const result = parsePlainTextKey('1. A ..... 600\n— B ..... Species');
        expect(result.couplets[0].branch1).toEqual({ kind: 'taxonDraft', name: '600' });
        expect(result.warnings.join(' ')).toMatch(/too large to be real step links/i);
    });

    it('warns when a couplet has a duplicate first alternative', () => {
        const result = parsePlainTextKey('1. A ..... Species one\n1. Duplicate ..... Species two\n— B ..... Species three');
        expect(result.couplets[0].alt1).toBe('Duplicate');
        expect(result.warnings.join(' ')).toMatch(/more than one first alternative/i);
    });

    it('warns when a couplet has a duplicate second alternative', () => {
        const result = parsePlainTextKey('1. A ..... Species one\n— B ..... Species two\n— Overwrite ..... Species three');
        expect(result.couplets[0].alt2).toBe('Overwrite');
        expect(result.warnings.join(' ')).toMatch(/more than one second alternative/i);
    });

    it('ignores a second alternative that appears before any numbered step', () => {
        const result = parsePlainTextKey('— Orphan ..... Species\n1. A ..... Species one\n— B ..... Species two');
        expect(result.warnings.join(' ')).toMatch(/before any numbered step/i);
        expect(result.couplets[0].alt1).toBe('A');
    });

    it('drops wrapped continuation lines when joining is disabled', () => {
        const result = parsePlainTextKey(
            '1. A ..... Species one\ncontinuation line\n— B ..... Species two',
            { joinWrappedLines: false },
        );
        expect(result.couplets[0].alt1).toBe('A');
        expect(result.warnings.join(' ')).toMatch(/wrapped line\(s\) were dropped/i);
    });
});
