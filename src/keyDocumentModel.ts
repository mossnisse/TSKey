// keyDocumentModel.ts
// The single resolved view of a key, shared by the live publication view and every
// exporter (plain text, HTML, LaTeX). buildKeyDocumentModel() does the whole
// traversal once — leads, destinations, and figure-token resolution — and returns a
// presentation-free data structure. Each consumer becomes a thin *formatter*:
// it renders the alternative segments and destinations with its own escaping/markup
// via renderAltSegments(), and never re-walks the key or re-implements token lookup.

import type { KeyStore, Figure, Taxon } from './store';
import {
    buildIdToIndexMap,
    buildBackReferenceMap,
    buildTaxaContext,
    buildCoupletLeads,
    resolveDestination,
} from './utils.ts';
import type { DestinationResolution, LeadFormat, NameDisplayMode } from './utils.ts';
import { buildFigureLookups, figIdTokenRegex, figRawTokenRegex, resolveRawFigValue } from './figureTokens.ts';
import type { FigureLookups } from './figureTokens.ts';
import { tokenize } from './editor/richText/tokenize.ts';
import type { Atom } from './editor/richText/tokenize.ts';
import { defaultMarks } from './editor/richText/schema.ts';
import type { EditorSchema, InlineToken } from './editor/richText/schema.ts';

// ==========================================
// ALTERNATIVE TEXT SEGMENTS
// ==========================================
//
// A couplet alternative is resolved into a flat stream of segments: literal text,
// a resolved figure citation, or an unresolvable ("broken") figure token. Both
// stored [figID: N] and raw [fig: value] token forms (see figureTokens.ts) collapse
// into these — once resolved, a formatter no longer cares which form it came from.

export interface TextSegment {
    kind: 'text';
    value: string;
}

export interface FigSegment {
    kind: 'fig';
    figId: number;
    displayNum: number;
}

export interface BrokenFigSegment {
    kind: 'brokenFig';
    label: string;             // "ID 5" for a stored token, or the raw value for a raw one
}

export interface MarkSegment {
    kind: 'mark';
    markName: string;
    children: AltSegment[];
}

export type AltSegment = TextSegment | FigSegment | BrokenFigSegment | MarkSegment;

/** Per-kind renderers a formatter supplies to turn segments into its output string. */
export interface AltSegmentRenderer {
    text: (value: string) => string;
    fig: (seg: FigSegment) => string;
    brokenFig: (seg: BrokenFigSegment) => string;
    mark: (markName: string, inner: string) => string;
}

// defaultMarks flows one way (schema.ts no longer imports back from this module), so
// this can be read at module-init without a circular-import TDZ.
const markHtmlTagMap = new Map(defaultMarks.map(m => [m.name, m.tag]));

export function htmlMark(markName: string, inner: string): string {
    const tag = markHtmlTagMap.get(markName);
    return tag ? `<${tag}>${inner}</${tag}>` : inner;
}

export function renderAltSegments(segments: readonly AltSegment[], r: AltSegmentRenderer): string {
    let out = '';
    for (const seg of segments) {
        if (seg.kind === 'text') out += r.text(seg.value);
        else if (seg.kind === 'fig') out += r.fig(seg);
        else if (seg.kind === 'brokenFig') out += r.brokenFig(seg);
        else out += r.mark(seg.markName, renderAltSegments(seg.children, r));
    }
    return out;
}

// The chip HTML is irrelevant here — the model reads the atom's raw src and resolves
// it itself — so render() returns an empty shell.
function modelFigureTokenRule(): InlineToken {
    const pattern = new RegExp(`${figIdTokenRegex().source}|${figRawTokenRegex().source}`, 'gi');
    return { name: 'figure', pattern, render: () => ({ html: '', className: '' }) };
}

function resolveFigureToken(src: string, lookups: FigureLookups, figureCount: number): AltSegment {
    const idMatch = /\[figID:\s*(\d+)\s*\]/i.exec(src);
    if (idMatch) {
        // Stored [figID: N] — N is an internal figure id.
        const figId = parseInt(idMatch[1], 10);
        const displayNum = lookups.idToDisplayNum.get(figId);
        return displayNum !== undefined
            ? { kind: 'fig', figId, displayNum }
            : { kind: 'brokenFig', label: `ID ${figId}` };
    }
    // Raw [fig: value] — a 1-based display number or a filename.
    const rawMatch = /\[fig:\s*([^\]]+?)\s*\]/i.exec(src);
    const value = (rawMatch?.[1] ?? '').trim();
    const resolved = resolveRawFigValue(value, lookups, figureCount);
    return resolved
        ? { kind: 'fig', figId: resolved.figId, displayNum: resolved.displayNum }
        : { kind: 'brokenFig', label: value };
}

function atomsToSegments(atoms: readonly Atom[], lookups: FigureLookups, figureCount: number): AltSegment[] {
    const segments: AltSegment[] = [];
    for (const atom of atoms) {
        if (atom.kind === 'text') {
            segments.push({ kind: 'text', value: atom.value });
        } else if (atom.kind === 'mark') {
            segments.push({ kind: 'mark', markName: atom.mark.name, children: atomsToSegments(atom.children, lookups, figureCount) });
        } else {
            segments.push(resolveFigureToken(atom.src, lookups, figureCount));
        }
    }
    return segments;
}

function segmentsFrom(rawText: string, lookups: FigureLookups, figureCount: number, withFigures: boolean): AltSegment[] {
    if (!rawText) return [];
    const schema: EditorSchema = { marks: defaultMarks, tokens: withFigures ? [modelFigureTokenRule()] : [] };
    return atomsToSegments(tokenize(rawText, schema), lookups, figureCount);
}

// Driven by the same editor tokenizer that renders the live editor, so marks and
// figure citations can never drift between editing, the live view, and exports.
export function parseRichText(rawText: string, figures?: readonly Figure[]): AltSegment[] {
    const withFigures = figures !== undefined;
    return segmentsFrom(rawText, buildFigureLookups(withFigures ? figures : []), figures?.length ?? 0, withFigures);
}

export function renderRichText(rawText: string, r: AltSegmentRenderer, figures?: readonly Figure[]): string {
    return renderAltSegments(parseRichText(rawText, figures), r);
}

const PLAIN_TEXT_RENDERER: AltSegmentRenderer = {
    text: value => value,
    fig: seg => `(Fig. ${seg.displayNum})`,
    brokenFig: seg => `[Broken Fig: ${seg.label}]`,
    mark: (_name, inner) => inner,
};
export function renderPlainText(rawText: string, figures?: readonly Figure[]): string {
    return renderRichText(rawText, PLAIN_TEXT_RENDERER, figures);
}

// ==========================================
// DOCUMENT MODEL
// ==========================================

export interface RenderableCouplet {
    id: number;
    displayNum: number;                 // 1-based
    lead1: string;                      // labelling marker for the first alternative
    lead2: string;                      // labelling marker for the second alternative
    alt1: AltSegment[];
    alt2: AltSegment[];
    dest1: DestinationResolution;
    dest2: DestinationResolution;
}

export interface KeyDocumentModel {
    title: string;
    isEmpty: boolean;                   // true when the key has no couplets
    couplets: RenderableCouplet[];
    taxa: readonly Taxon[];             // pass-through (formatters lay out fields); see buildTaxonExportNames
    figures: readonly Figure[];         // pass-through; display number is 1-based array position
}

export interface DocumentModelOptions {
    leadFormat: LeadFormat;
    showBackReference: boolean;
    nameMode: NameDisplayMode;
}

/** One name line in a taxon's export block. */
export interface TaxonNameLine {
    name: string;
    isScientific: boolean;  // scientific names are italicised in rich formats (HTML/LaTeX)
    auctor: string;         // rendered after the name; only ever set on the scientific line
}

/**
 * The ordered names for a taxon's export block: the heading (the primary name for
 * the display mode) plus an optional labelled second row for the other name. The
 * auctor always rides with the scientific name — never after the vernacular name —
 * so vernacular mode leads with a bare vernacular heading and puts the scientific
 * name + auctor on the second row.
 */
export interface TaxonExportNames {
    heading: TaxonNameLine;
    secondary: (TaxonNameLine & { label: string }) | null;
}

export function buildTaxonExportNames(taxon: Taxon, mode: NameDisplayMode): TaxonExportNames {
    const sci = taxon.scientificName.trim();
    const vern = taxon.vernacularName.trim();
    const auctor = taxon.auctor.trim();

    const scientificLine: TaxonNameLine = { name: sci, isScientific: true, auctor };
    const vernacularLine: TaxonNameLine = { name: vern, isScientific: false, auctor: '' };

    // Vernacular leads only when a vernacular name exists; the scientific name (with
    // its auctor) then becomes the second row.
    if (mode === 'vernacular' && vern) {
        return {
            heading: vernacularLine,
            secondary: sci ? { ...scientificLine, label: 'Scientific name' } : null,
        };
    }

    // Scientific leads (also the fallback when vernacular mode has no vernacular name).
    if (sci) {
        return {
            heading: scientificLine,
            secondary: vern ? { ...vernacularLine, label: 'Vernacular name' } : null,
        };
    }

    // Only a vernacular name, or nothing at all.
    return {
        heading: vern ? vernacularLine : { name: 'Untitled taxon', isScientific: false, auctor: '' },
        secondary: null,
    };
}

/**
 * Resolves the live store into a KeyDocumentModel: one traversal that builds every
 * lookup map, resolves each couplet's leads / destinations / figure tokens, and
 * hands back a presentation-free structure for the view and exporters to format.
 */
export function buildKeyDocumentModel(store: KeyStore, opts: DocumentModelOptions): KeyDocumentModel {
    const key = store.getKey();
    const figures = store.getFigures();
    const taxa = store.getTaxa();

    const idToIndexMap = buildIdToIndexMap(key);
    const lookups = buildFigureLookups(figures);
    const figureCount = figures.length;
    const backRefMap = opts.showBackReference ? buildBackReferenceMap(key) : null;
    const taxaCtx = buildTaxaContext(taxa, opts.nameMode);

    const couplets: RenderableCouplet[] = key.map((c, index) => {
        const displayNum = index + 1;
        const { lead1, lead2 } = buildCoupletLeads(opts.leadFormat, displayNum, backRefMap?.get(c.id));
        return {
            id: c.id,
            displayNum,
            lead1,
            lead2,
            alt1: segmentsFrom(c.alt1, lookups, figureCount, true),
            alt2: segmentsFrom(c.alt2, lookups, figureCount, true),
            dest1: resolveDestination(c.branch1, idToIndexMap, taxaCtx),
            dest2: resolveDestination(c.branch2, idToIndexMap, taxaCtx),
        };
    });

    return {
        title: store.getTitle(),
        isEmpty: key.length === 0,
        couplets,
        taxa,
        figures,
    };
}