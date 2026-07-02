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
import { buildFigureLookups } from './figureTokens.ts';
import type { FigureLookups } from './figureTokens.ts';

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

export type AltSegment = TextSegment | FigSegment | BrokenFigSegment;

/** Per-kind renderers a formatter supplies to turn segments into its output string. */
export interface AltSegmentRenderer {
    text: (value: string) => string;
    fig: (seg: FigSegment) => string;
    brokenFig: (seg: BrokenFigSegment) => string;
}

/** Renders a resolved alternative to a string using the formatter's per-kind renderers. */
export function renderAltSegments(segments: readonly AltSegment[], r: AltSegmentRenderer): string {
    let out = '';
    for (const seg of segments) {
        if (seg.kind === 'text') out += r.text(seg.value);
        else if (seg.kind === 'fig') out += r.fig(seg);
        else out += r.brokenFig(seg);
    }
    return out;
}

// Matches both token forms in one pass: group 1 = stored id, group 2 = raw value.
const FIG_TOKEN_REGEX = /\[figID:\s*(\d+)\s*\]|\[fig:\s*([^\]]+?)\s*\]/gi;

/** Resolves a raw [fig: value] token: a 1-based display number or a filename → figure. */
function resolveRawFigValue(
    value: string,
    lookups: FigureLookups,
    figureCount: number
): { figId: number; displayNum: number } | null {
    const { displayNumToFig, filenameToFig, idToDisplayNum } = lookups;

    const asNum = parseInt(value, 10);
    if (!isNaN(asNum) && String(asNum) === value && asNum >= 1 && asNum <= figureCount) {
        const fig = displayNumToFig.get(asNum);
        if (fig) return { figId: fig.id, displayNum: asNum };
    }

    const fig = filenameToFig.get(value.toLowerCase());
    if (fig) {
        const displayNum = idToDisplayNum.get(fig.id);
        if (displayNum !== undefined) return { figId: fig.id, displayNum };
    }

    return null;
}

/** Splits an alternative's raw text into literal / resolved-figure / broken-figure segments. */
function tokenizeAlt(rawText: string, lookups: FigureLookups, figureCount: number): AltSegment[] {
    const segments: AltSegment[] = [];
    if (!rawText) return segments;

    const re = new RegExp(FIG_TOKEN_REGEX.source, FIG_TOKEN_REGEX.flags);
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(rawText)) !== null) {
        if (match.index > lastIndex) {
            segments.push({ kind: 'text', value: rawText.slice(lastIndex, match.index) });
        }
        lastIndex = match.index + match[0].length;

        if (match[1] !== undefined) {
            // Stored [figID: N] — N is an internal figure id.
            const figId = parseInt(match[1], 10);
            const displayNum = lookups.idToDisplayNum.get(figId);
            if (displayNum !== undefined) {
                segments.push({ kind: 'fig', figId, displayNum });
            } else {
                segments.push({ kind: 'brokenFig', label: `ID ${figId}` });
            }
        } else {
            // Raw [fig: value] — a 1-based display number or a filename.
            const value = (match[2] ?? '').trim();
            const resolved = resolveRawFigValue(value, lookups, figureCount);
            if (resolved) {
                segments.push({ kind: 'fig', figId: resolved.figId, displayNum: resolved.displayNum });
            } else {
                segments.push({ kind: 'brokenFig', label: value });
            }
        }
    }

    if (lastIndex < rawText.length) {
        segments.push({ kind: 'text', value: rawText.slice(lastIndex) });
    }
    return segments;
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
    taxa: readonly Taxon[];             // pass-through (formatters lay out fields); see taxonHeading
    figures: readonly Figure[];         // pass-through; display number is 1-based array position
}

export interface DocumentModelOptions {
    leadFormat: LeadFormat;
    showBackReference: boolean;
    nameMode: NameDisplayMode;
}

/** The heading a taxon shows in exports: its scientific name, or a placeholder if blank. */
export function taxonHeading(taxon: Taxon): string {
    return taxon.scientificName || 'Untitled taxon';
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
            alt1: tokenizeAlt(c.alt1, lookups, figureCount),
            alt2: tokenizeAlt(c.alt2, lookups, figureCount),
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