// figureOps.ts
// Pure figure-collection transforms extracted from KeyStore. Plain add/update/
// reorder/delete go through collectionOps; this module holds the one figure-
// specific transform: ordering figures by the sequence they are first referenced
// in the key. Pure — the store wrapper handles checkpointing and assignment.

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

    // Cleanup Sweep: Append any figures that aren't referenced anywhere to the end
    for (const fig of figures) {
        if (!seenFigureIds.has(fig.id)) {
            orderedFigures.push(fig);
        }
    }

    return orderedFigures;
}
