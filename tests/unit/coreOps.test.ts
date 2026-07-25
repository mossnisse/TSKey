import { describe, expect, it } from 'vitest';
import { deleteEntities, nextEntityId, reorderEntity, updateEntity } from '../../src/store/collectionOps.ts';
import { Selection } from '../../src/store/selection.ts';
import {
    addCouplet,
    autoOrderCouplets,
    cutCouplets,
    deleteCouplets,
    pasteCouplets,
    reorderCouplets,
    swapCouplets,
} from '../../src/store/coupletOps.ts';
import {
    createTaxon,
    deleteTaxaAndSever,
    findTaxonByAnyName,
    referencedTaxonIds,
    relinkDraftsToExisting,
    resolveDrafts,
    sanitizeTaxa,
    sortTaxaByName,
    taxonMatchesQuery,
} from '../../src/store/taxonOps.ts';
import {
    decodeTextReferencesForEditor,
    encodeFigureTokens,
    orderFiguresByReference,
    resolveTextReferences,
} from '../../src/store/figureOps.ts';
import { computePathFromRoot, computeReachableNodes, diagnoseKey } from '../../src/store/keyStore.ts';
import { buildFigureLookups, resolveRawFigValue } from '../../src/figureTokens.ts';
import { couplet, figure, taxon } from '../helpers/factories.ts';

describe('collection and selection helpers', () => {
    it('updates, removes, reorders, and allocates without mutating the input', () => {
        const input = [{ id: 2, name: 'b' }, { id: 7, name: 'g' }];
        expect(nextEntityId(input)).toBe(8);
        expect(updateEntity(input, 2, { name: 'B' })).toEqual([{ id: 2, name: 'B' }, { id: 7, name: 'g' }]);
        expect(updateEntity(input, 99, { name: 'x' })).toBeNull();
        expect(deleteEntities(input, new Set([2]))).toEqual([{ id: 7, name: 'g' }]);
        expect(reorderEntity(input, 0, 1).map(item => item.id)).toEqual([7, 2]);
        expect(input.map(item => item.id)).toEqual([2, 7]);
    });

    it('supports exclusive and additive selection', () => {
        const selection = new Selection();
        selection.toggle(1, false);
        selection.toggle(2, true);
        selection.toggle(1, true);
        expect([...selection.get()]).toEqual([2]);
        selection.replace([4, 5]);
        expect(selection.size).toBe(2);
        selection.clear();
        expect(selection.size).toBe(0);
    });
});

describe('couplet transforms', () => {
    it('adds a step, resolves waiting links, and uses the next permanent id', () => {
        const key = [
            couplet(5, { branch1: { kind: 'unresolved', couplet: 2 }, branch2: { kind: 'taxonDraft', name: 'End' } }),
        ];
        const result = addCouplet(key);
        expect(result.newId).toBe(6);
        expect(result.key[0].branch1).toEqual({ kind: 'linked', targetId: 6 });
        expect(result.key[1].id).toBe(6);
    });

    it('cuts and pastes a linked group while restoring incoming links', () => {
        const key = [
            couplet(1, { branch1: { kind: 'linked', targetId: 2 } }),
            couplet(2, { branch1: { kind: 'linked', targetId: 3 } }),
            couplet(3),
        ];
        const cut = cutCouplets(key, new Set([2, 3]));
        expect(cut.key[0].branch1.kind).toBe('empty');
        const pasted = pasteCouplets(cut.key, key.slice(1), 1, 'below', true, cut.severedLinks);
        expect(pasted.newIds).toEqual([2, 3]);
        expect(pasted.key[0].branch1).toEqual({ kind: 'linked', targetId: 2 });
        expect(pasted.key[1].branch1).toEqual({ kind: 'linked', targetId: 3 });
    });

    it('deletes inbound links, swaps selected alternatives, and reorders safely', () => {
        const key = [
            couplet(1, { alt1: 'left', alt2: 'right', branch1: { kind: 'linked', targetId: 2 } }),
            couplet(2),
            couplet(3),
        ];
        expect(deleteCouplets(key, new Set([2]))[0].branch1.kind).toBe('empty');
        expect(swapCouplets(key, new Set([1])).key[0].alt1).toBe('right');
        expect(reorderCouplets(key, 3, 1, 'above')?.map(item => item.id)).toEqual([3, 1, 2]);
        expect(reorderCouplets(key, 1, 1, 'above')).toBeNull();
    });

    it('places terminal alternatives first and traverses cycles once', () => {
        const key = [
            couplet(1, {
                alt1: 'continue',
                alt2: 'terminal',
                branch1: { kind: 'linked', targetId: 2 },
                branch2: { kind: 'taxonDraft', name: 'Species' },
            }),
            couplet(2, { branch1: { kind: 'linked', targetId: 1 } }),
        ];
        const ordered = autoOrderCouplets(key);
        expect(ordered.map(item => item.id)).toEqual([1, 2]);
        expect(ordered[0].alt1).toBe('terminal');
    });
});

describe('taxa and figure transforms', () => {
    it('sanitizes taxa, resolves drafts, relinks by either name, and severs deletions', () => {
        const clean = sanitizeTaxa([
            { id: 4, scientificName: 'Bufo bufo', vernacularName: 'Common toad', synonyms: [1, 'Toad'], confusables: [{ name: 'Other', distinction: 7 }] },
            { id: 4, scientificName: 'duplicate' },
            { id: -1, scientificName: 'bad' },
        ]);
        expect(clean).toHaveLength(1);
        expect(clean[0].synonyms).toEqual(['Toad']);
        expect(findTaxonByAnyName(clean, 'common TOAD')?.id).toBe(4);

        const key = [couplet(1, { branch1: { kind: 'taxonDraft', name: 'Bufo bufo' } })];
        const resolved = resolveDrafts(key, clean);
        expect(resolved.key[0].branch1).toEqual({ kind: 'taxon', taxonId: 4 });
        expect(relinkDraftsToExisting(key, clean).key[0].branch1).toEqual({ kind: 'taxon', taxonId: 4 });
        expect(deleteTaxaAndSever(resolved.key, new Set([4])).key[0].branch1.kind).toBe('empty');
    });

    it('sorts taxa by the selected display name', () => {
        const taxa = [
            taxon(1, { scientificName: 'Zeta', vernacularName: 'Ant' }),
            taxon(2, { scientificName: 'Alpha', vernacularName: 'Yak' }),
        ];
        expect(sortTaxaByName(taxa, 'scientific').map(item => item.id)).toEqual([2, 1]);
        expect(sortTaxaByName(taxa, 'vernacular').map(item => item.id)).toEqual([1, 2]);
        expect(createTaxon(3, '  Species 3  ').scientificName).toBe('Species 3');
    });

    it('flags taxa no lead points at, and filters by either name or a synonym', () => {
        const key = [
            couplet(1, { branch1: { kind: 'taxon', taxonId: 1 }, branch2: { kind: 'taxonDraft', name: 'Species 2' } }),
        ];
        // A draft is a typed name with no record yet, so it must not count as a reference.
        expect(referencedTaxonIds(key)).toEqual(new Set([1]));

        const newt = taxon(3, {
            scientificName: 'Lissotriton vulgaris',
            vernacularName: 'Smooth newt',
            synonyms: ['Triturus vulgaris'],
        });
        expect(taxonMatchesQuery(newt, 'lissotriton')).toBe(true);
        expect(taxonMatchesQuery(newt, 'SMOOTH')).toBe(true);
        // Looking a species up by the name it used to carry is the point of synonyms.
        expect(taxonMatchesQuery(newt, 'triturus')).toBe(true);
        expect(taxonMatchesQuery(newt, 'bufo')).toBe(false);
        expect(taxonMatchesQuery(newt, '   ')).toBe(true);
    });

    it('encodes, decodes, resolves, and orders stable figure references', () => {
        const figures = [figure(10, { filename: 'alpha.jpg' }), figure(20, { filename: 'beta.jpg' })];
        expect(encodeFigureTokens('See [fig: 2] and [fig: ALPHA.JPG].', figures))
            .toBe('See [figID: 20] and [figID: 10].');
        expect(decodeTextReferencesForEditor('[figID: 20] [figID: 99]', figures))
            .toBe('[fig: 2] [figID: 99]');
        const map = new Map([[10, 1], [20, 2]]);
        expect(resolveTextReferences('[figID: 20] [fig: missing]', figures, map))
            .toBe('(Fig. 2) [Broken Fig: missing]');
        const ordered = orderFiguresByReference(figures, [couplet(1, { alt1: '[figID: 20]' })]);
        expect(ordered.map(item => item.id)).toEqual([20, 10]);
        expect(resolveRawFigValue('alpha.jpg', buildFigureLookups(figures), figures.length)).toEqual({ figId: 10, displayNum: 1 });
    });
});

describe('graph analysis and diagnostics', () => {
    const key = [
        couplet(1, { branch1: { kind: 'linked', targetId: 2 }, branch2: { kind: 'taxonDraft', name: 'End' } }),
        couplet(2, { branch1: { kind: 'linked', targetId: 1 }, branch2: { kind: 'linked', targetId: 99 }, alt1: '[figID: 9]' }),
        couplet(3),
    ];

    it('handles paths, cycles, and unreachable targets', () => {
        expect([...computeReachableNodes(key)]).toEqual([1, 2, 99]);
        expect(computePathFromRoot(key, 2)).toMatchObject({ reachable: true, steps: [{ id: 1, choice: 'a' }, { id: 2 }] });
        expect(computePathFromRoot(key, 3)).toEqual({ reachable: false, steps: [] });
    });

    it('reports broken links, missing figures, and isolated steps', () => {
        const diagnostics = diagnoseKey(key, []);
        expect(diagnostics.get(2)?.map(item => item.message).join(' ')).toMatch(/invalid|missing or deleted figure/i);
        expect(diagnostics.get(3)?.map(item => item.message).join(' ')).toMatch(/unreachable/i);
    });
});
