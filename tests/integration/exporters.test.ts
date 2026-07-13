import { describe, expect, it, vi } from 'vitest';
import { exportKeyToHTML } from '../../src/exporters/htmlExporter.ts';
import { exportKeyToJSON } from '../../src/exporters/jsonExporter.ts';
import { exportKeyToLaTeX } from '../../src/exporters/latexExporter.ts';
import { exportKeyToPlainText } from '../../src/exporters/plainTextExporter.ts';
import { KeyStore } from '../../src/store/keyStore.ts';
import { couplet, taxon } from '../helpers/factories.ts';

function exportedBlob(): Blob {
    const createObjectURL = vi.mocked(URL.createObjectURL);
    const lastCall = createObjectURL.mock.calls.at(-1);
    if (!lastCall) throw new Error('Exporter did not create a download blob.');
    const value = lastCall[0];
    if (!(value instanceof Blob)) throw new Error('Exporter created a non-Blob object URL.');
    return value;
}

function blobText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
    });
}

function exportStore(): KeyStore {
    const species = taxon(7, {
        scientificName: 'Bufo bufo',
        auctor: 'Linnaeus & Co.',
        vernacularName: 'Common toad',
        synonyms: ['Rana bufo'],
        description: 'A **robust** species.',
    });
    return new KeyStore([
        couplet(1, {
            alt1: '**Bold** & <tag>',
            alt2: 'Other',
            branch1: { kind: 'taxon', taxonId: 7 },
            branch2: { kind: 'taxonDraft', name: 'Other species' },
        }),
    ], [], 'A&B Key', 100, [species]);
}

describe('document exporters', () => {
    it('exports readable plain text with marks removed and taxa appended', async () => {
        exportKeyToPlainText(exportStore(), 'lettered', false, 'scientific');
        const output = await blobText(exportedBlob());
        expect(output).toContain('A&B Key');
        expect(output).toContain('1a\tBold & <tag>\tBufo bufo');
        expect(output).toContain('TAXA');
        expect(output).toContain('Description: A robust species.');
    });

    it('escapes HTML content while retaining rich-text markup', async () => {
        await exportKeyToHTML(exportStore(), 'classic', false, 'scientific');
        const output = await blobText(exportedBlob());
        expect(output).toContain('<title>A&amp;B Key</title>');
        expect(output).toContain('<strong>Bold</strong> &amp; &lt;tag&gt;');
        expect(output).toContain('<em>Bufo bufo</em>');
        expect(output).not.toContain('<tag>');
    });

    it('escapes LaTeX control characters and emits formatting macros', async () => {
        exportKeyToLaTeX(exportStore(), 'classic', false, 'scientific');
        const output = await blobText(exportedBlob());
        expect(output).toContain('\\title{\\textbf{A\\&B Key}}');
        expect(output).toContain('\\textbf{Bold} \\& \\textless{}tag\\textgreater{}');
        expect(output).toContain('\\subsection*{\\textit{Bufo bufo}');
    });

    it('round-trips the native JSON document shape', async () => {
        await exportKeyToJSON(exportStore());
        const payload = JSON.parse(await blobText(exportedBlob())) as {
            metadata: { application: string };
            data: { title: string; key: Array<{ alt1: string }>; taxa: unknown[] };
        };
        expect(payload.metadata.application).toBe('TSKey');
        expect(payload.data.title).toBe('A&B Key');
        expect(payload.data.key[0].alt1).toBe('**Bold** & <tag>');
        expect(payload.data.taxa).toHaveLength(1);
    });
});
