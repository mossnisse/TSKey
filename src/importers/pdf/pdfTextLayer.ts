import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { PositionedSpan } from './pdfTypes.ts';

export interface TextViewportLike {
    width: number;
    height: number;
    transform: number[];
}

export interface TextStyleLike {
    fontFamily?: string;
}

/** Converts one PDF.js text item without discarding baseline or font metadata. */
export function textItemToPositionedSpan(
    item: TextItem,
    viewport: TextViewportLike,
    transform: (first: number[], second: number[]) => number[],
    style?: TextStyleLike,
): PositionedSpan {
    const tx = transform(viewport.transform, item.transform as number[]);
    const fontHeight = Math.max(Math.hypot(tx[2], tx[3]), item.height, 1);
    const baseline = tx[5] / viewport.height;
    return {
        text: item.str,
        x: tx[4] / viewport.width,
        y: (tx[5] - fontHeight) / viewport.height,
        width: Math.max(item.width, 0) / viewport.width,
        height: fontHeight / viewport.height,
        fontHeight: fontHeight / viewport.height,
        baseline,
        fontName: item.fontName,
        fontFamily: style?.fontFamily,
        direction: item.dir,
        hasEol: item.hasEOL,
        source: 'text',
    };
}
