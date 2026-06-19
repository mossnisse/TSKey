// figureTokens.ts
// Single source of truth for the two figure-reference token forms used across the
// editor, diagnostics, and exporters:
//
//   [figID: N]    — a stable STORED reference. N is an internal figure id, so it
//                   survives figure reordering. This is what gets persisted.
//   [fig: value]  — an UNRESOLVED / user-typed reference that hasn't been encoded
//                   yet. `value` is either a 1-based display number or a filename.

import type { Figure } from './store.ts';

export const figIdTokenRegex = (): RegExp => /\[figID:\s*(\d+)\s*\]/gi;
export const figRawTokenRegex = (): RegExp => /\[fig:\s*([^\]]+)\s*\]/gi;

export interface FigureLookups {
    idToDisplayNum: Map<number, number>;
    displayNumToFig: Map<number, Figure>;
    filenameToFig: Map<string, Figure>;
    idToFig: Map<number, Figure>;
}

export function buildFigureLookups(figures: readonly Figure[]): FigureLookups {
    const idToDisplayNum = new Map<number, number>();
    const displayNumToFig = new Map<number, Figure>();
    const filenameToFig = new Map<string, Figure>();
    const idToFig = new Map<number, Figure>();

    figures.forEach((fig, index) => {
        const displayNum = index + 1;
        idToDisplayNum.set(fig.id, displayNum);
        displayNumToFig.set(displayNum, fig);
        idToFig.set(fig.id, fig);

        const filename = fig.filename.trim().toLowerCase();
        if (filename) filenameToFig.set(filename, fig);
    });

    return { idToDisplayNum, displayNumToFig, filenameToFig, idToFig };
}
