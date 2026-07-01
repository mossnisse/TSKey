// figureOps.ts
// Pure figure-collection transforms extracted from KeyStore. Plain add/update/
// reorder/delete go through collectionOps; this module holds the figure-specific
// transforms: ordering by first reference, and converting between the editor's
// user-facing figure tokens and the stable stored tokens, plus the publication-view
// resolver. Every function is pure — the store wrapper handles checkpointing.
//
// See figureTokens.ts for the two token forms ([figID: N] stored, [fig: value]
// raw/unresolved).

import type { Couplet, Figure } from './keyStore.ts';
import { figIdTokenRegex, figRawTokenRegex, buildFigureLookups } from '../figureTokens.ts';

/**
 * Returns the figures reordered to match the order in which they are first
 * referenced while scanning the key top-to-bottom (both alternatives and any
 * terminal taxon text). Figures referenced nowhere are appended, in their
 * existing order, after the referenced ones.
 */
export function orderFiguresByReference(figures: readonly Figure[], key: readonly Couplet[]): Figure[] {
    const { idToFig, displayNumToFig, filenameToFig } = buildFigureLookups(figures);

    const orderedFigures: Figure[] = [];
    const seenFigureIds = new Set<number>();

    // Scan couplets sequentially in their current key order. Figure tokens live in
    // the two alternative descriptions; taxon branches are id references with no
    // inline text to scan.
    for (const couplet of key) {
        const fieldsToScan = [couplet.alt1, couplet.alt2];

        for (const text of fieldsToScan) {
            if (!text) continue;

            let match: RegExpExecArray | null;

            // Stored references [figID: N] — value is always an internal figure ID
            const idTokenRegex = figIdTokenRegex();
            while ((match = idTokenRegex.exec(text)) !== null) {
                const id = parseInt(match[1].trim(), 10);
                const matchedFig = idToFig.get(id);
                if (matchedFig && !seenFigureIds.has(matchedFig.id)) {
                    seenFigureIds.add(matchedFig.id);
                    orderedFigures.push(matchedFig);
                }
            }

            // Unresolved references [fig: VALUE] — numeric = 1-based display number, text = filename
            const rawTokenRegex = figRawTokenRegex();
            while ((match = rawTokenRegex.exec(text)) !== null) {
                const trimmedValue = match[1].trim();
                let matchedFig: Figure | undefined = undefined;

                const displayNum = parseInt(trimmedValue, 10);
                if (!isNaN(displayNum) && String(displayNum) === trimmedValue && displayNumToFig.has(displayNum)) {
                    matchedFig = displayNumToFig.get(displayNum);
                } else {
                    const lowercaseFilename = trimmedValue.toLowerCase();
                    if (filenameToFig.has(lowercaseFilename)) {
                        matchedFig = filenameToFig.get(lowercaseFilename);
                    }
                }

                if (matchedFig && !seenFigureIds.has(matchedFig.id)) {
                    seenFigureIds.add(matchedFig.id);
                    orderedFigures.push(matchedFig);
                }
            }
        }
    }

    // Append any figures that aren't referenced anywhere to the end.
    for (const fig of figures) {
        if (!seenFigureIds.has(fig.id)) {
            orderedFigures.push(fig);
        }
    }

    return orderedFigures;
}

/**
 * Resolves stored [figID: N] and raw [fig: value] tokens into "(Fig. n)"
 * publication text. `idToDisplayNum` maps internal figure ids to their current
 * 1-based display numbers (supplied by the caller so the same map can be reused
 * across a render pass).
 */
export function resolveTextReferences(
    text: string,
    figures: readonly Figure[],
    idToDisplayNum: Map<number, number>
): string {
    if (!text) return text;

    const figureCount = figures.length;
    const { filenameToFig } = buildFigureLookups(figures);

    // Stored references [figID: N] — value is always an internal figure id.
    text = text.replace(figIdTokenRegex(), (_match, value) => {
        const id = parseInt(value.trim(), 10);
        const displayNum = idToDisplayNum.get(id);
        return displayNum !== undefined
            ? `(Fig. ${displayNum})`
            : `[Broken Fig: ID ${id}]`;
    });

    // Unresolved references [fig: value] — numeric = 1-based display number, text = filename.
    text = text.replace(figRawTokenRegex(), (_match, value) => {
        const trimmedValue = value.trim();

        const displayNum = parseInt(trimmedValue, 10);
        if (!isNaN(displayNum) && String(displayNum) === trimmedValue && displayNum >= 1 && displayNum <= figureCount) {
            return `(Fig. ${displayNum})`;
        }

        const fig = filenameToFig.get(trimmedValue.toLowerCase());
        if (fig) {
            const fileDisplayNum = idToDisplayNum.get(fig.id);
            if (fileDisplayNum !== undefined) return `(Fig. ${fileDisplayNum})`;
        }

        return `[Broken Fig: ${trimmedValue}]`;
    });

    return text;
}

/**
 * Converts user-written [fig: N] (display number) or [fig: filename.jpg] tokens
 * into stable internal storage tokens [figID: N] that survive figure reordering.
 * Incomplete or unresolvable tokens are left unchanged.
 */
export function encodeFigureTokens(text: string, figures: readonly Figure[]): string {
    if (!text) return '';

    const { displayNumToFig, filenameToFig } = buildFigureLookups(figures);

    return text.replace(figRawTokenRegex(), (match, value) => {
        const trimmed = value.trim();

        // Try as a 1-based display number (the primary user-facing format)
        const displayNum = parseInt(trimmed, 10);
        if (!isNaN(displayNum) && String(displayNum) === trimmed && displayNumToFig.has(displayNum)) {
            return `[figID: ${displayNumToFig.get(displayNum)!.id}]`;
        }

        // Try as a filename (case-insensitive)
        const fig = filenameToFig.get(trimmed.toLowerCase());
        if (fig) {
            return `[figID: ${fig.id}]`;
        }

        // Cannot resolve — keep the original token so the user sees the problem
        return match;
    });
}

/**
 * Converts stored [figID: N] tokens back to user-readable [fig: N] display numbers
 * for rendering inside editor textareas. The display number reflects the figure's
 * current position and automatically updates when figures are reordered.
 */
export function decodeTextReferencesForEditor(text: string, figures: readonly Figure[]): string {
    if (!text) return '';

    const { idToDisplayNum } = buildFigureLookups(figures);

    return text.replace(figIdTokenRegex(), (match, value) => {
        const id = parseInt(value.trim(), 10);
        const displayNum = idToDisplayNum.get(id);
        return displayNum !== undefined
            ? `[fig: ${displayNum}]`
            : match; // Keep broken token visible so the user knows it needs attention
    });
}
