// figureRefs.ts
// Pure transforms between the editor's user-facing figure tokens and the stable
// stored tokens, plus the publication-view resolver. Extracted from KeyStore:
// each function depends only on the supplied figure list, so they live outside
// the store as free functions (mirroring diagnoseKey / computeReachableNodes).
//
// See figureTokens.ts for the two token forms ([figID: N] stored, [fig: value]
// raw/unresolved).

import type { Figure } from './store.ts';
import { figIdTokenRegex, figRawTokenRegex, buildFigureLookups } from './figureTokens.ts';

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
