import type {
    PositionedLine,
    PositionedLineGap,
    PositionedSpan,
} from './pdfTypes.ts';

export interface PositionedPage {
    pageNum: number;
    spans: PositionedSpan[];
}

export interface LayoutOptions {
    pageNum?: number;
    removeFurniture?: boolean;
    repeatedFurniture?: ReadonlySet<string>;
}

export interface ReconstructedPage {
    text: string;
    lines: string[];
    positionedLines: PositionedLine[];
    warnings: string[];
    columnCount: number;
}

interface LineBucket {
    spans: PositionedSpan[];
    baseline: number;
    height: number;
}

interface GutterCandidate {
    midpoint: number;
    leftChars: number;
    rightChars: number;
    leftWidth: number;
    rightWidth: number;
}

const MARGIN_BAND = 0.1;

function clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function median(values: readonly number[]): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function spanBaseline(span: PositionedSpan): number {
    return span.baseline ?? span.y + span.height * 0.82;
}

export function normalizeSpan(span: PositionedSpan): PositionedSpan {
    return {
        ...span,
        x: clamp(span.x),
        y: clamp(span.y),
        width: clamp(span.width),
        height: clamp(span.height),
        fontHeight: clamp(span.fontHeight),
        baseline: clamp(spanBaseline(span)),
    };
}

function estimatedEmWidth(spans: readonly PositionedSpan[]): number {
    const widths = spans
        .map(span => span.width / Math.max([...span.text.trim()].length, 1))
        .filter(width => Number.isFinite(width) && width > 0 && width < 0.1);
    return Math.max(0.002, median(widths) || median(spans.map(span => span.fontHeight)) * 0.45 || 0.006);
}

function joinSpanSlice(spans: readonly PositionedSpan[], emWidth: number): string {
    let text = '';
    for (let index = 0; index < spans.length; index++) {
        const current = spans[index];
        const value = current.text.trim();
        if (!value) continue;
        if (!text) {
            text = value;
            continue;
        }
        const previous = spans[index - 1];
        const gap = current.x - (previous.x + previous.width);
        const sourceHasSpace = /\s$/u.test(previous.text) || /^\s/u.test(current.text);
        const punctuationContinues = /^[,.;:!?%)\]}]/u.test(value) || ['(', '[', '{', '/'].some(char => text.endsWith(char));
        const separator = !punctuationContinues && (sourceHasSpace || gap > emWidth * 0.35) ? ' ' : '';
        text += `${separator}${value}`;
    }
    return text.replace(/\s+/gu, ' ').trim();
}

function looksLikeDestination(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 160) return false;
    if (/^(?:→\s*)?(?:go\s+to\s+|couplet\s+)?\d{1,4}\.?$/iu.test(trimmed)) return true;
    if (!/^[\p{L}(\[]/u.test(trimmed)) return false;
    if (/[!?]$/u.test(trimmed)) return false;
    return trimmed.split(/\s+/u).length <= 16;
}

function buildLine(
    sourceSpans: readonly PositionedSpan[],
    pageNum: number,
    lineIndex: number,
    columnIndex = 0,
): PositionedLine {
    const spans = sourceSpans
        .map(normalizeSpan)
        .filter(span => span.text.trim())
        .sort((a, b) => a.x - b.x);
    const emWidth = estimatedEmWidth(spans);
    const gaps: PositionedLineGap[] = [];
    for (let index = 1; index < spans.length; index++) {
        const previousRight = spans[index - 1].x + spans[index - 1].width;
        const width = Math.max(0, spans[index].x - previousRight);
        gaps.push({
            afterSpan: index - 1,
            x: previousRight,
            width,
            emWidth,
            rightX: spans[index].x,
            leftText: joinSpanSlice(spans.slice(0, index), emWidth),
            rightText: joinSpanSlice(spans.slice(index), emWidth),
        });
    }

    const separatorGap = gaps
        .filter(gap => gap.width >= Math.max(0.012, gap.emWidth * 3))
        .filter(gap => /^(?:→\s*)?(?:go\s+to\s+|couplet\s+)?\d{1,4}\.?$/iu.test(gap.rightText)
            || (gap.rightX >= 0.45 && looksLikeDestination(gap.rightText)))
        .sort((a, b) => b.width - a.width)[0];

    let text = '';
    for (let index = 0; index < spans.length; index++) {
        const value = spans[index].text.trim();
        if (!value) continue;
        if (!text) {
            text = value;
            continue;
        }
        const previous = spans[index - 1];
        const gap = spans[index].x - (previous.x + previous.width);
        const sourceHasSpace = /\s$/u.test(previous.text) || /^\s/u.test(spans[index].text);
        const punctuationContinues = /^[,.;:!?%)\]}]/u.test(value) || ['(', '[', '{', '/'].some(char => text.endsWith(char));
        const separator = separatorGap?.afterSpan === index - 1
            ? '\t'
            : !punctuationContinues && (sourceHasSpace || gap > emWidth * 0.35) ? ' ' : '';
        text += `${separator}${value}`;
    }

    const x = Math.min(...spans.map(span => span.x));
    const y = Math.min(...spans.map(span => span.y));
    const right = Math.max(...spans.map(span => span.x + span.width), x);
    const bottom = Math.max(...spans.map(span => span.y + span.height), y);
    const confidences = spans.map(span => span.confidence).filter((value): value is number => value !== undefined);
    return {
        id: `${pageNum}-${lineIndex}`,
        pageNum,
        lineIndex,
        columnIndex,
        text: text.replace(/ +/gu, ' ').trim(),
        spans,
        gaps,
        x,
        y,
        width: Math.max(0, right - x),
        height: Math.max(0, bottom - y),
        baseline: median(spans.map(spanBaseline)),
        fontHeight: median(spans.map(span => span.fontHeight)),
        fontFamilies: [...new Set(spans.map(span => span.fontFamily).filter((value): value is string => !!value))],
        confidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : undefined,
    };
}

function clusterRawLines(spans: readonly PositionedSpan[], pageNum: number): PositionedLine[] {
    const sorted = spans
        .filter(span => span.text.trim())
        .map(normalizeSpan)
        .sort((a, b) => spanBaseline(a) - spanBaseline(b) || a.x - b.x);
    const buckets: LineBucket[] = [];
    for (const span of sorted) {
        const baseline = spanBaseline(span);
        let best: LineBucket | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (let index = Math.max(0, buckets.length - 8); index < buckets.length; index++) {
            const candidate = buckets[index];
            const distance = Math.abs(candidate.baseline - baseline);
            const tolerance = Math.max(0.0025, Math.max(candidate.height, span.fontHeight, span.height) * 0.32);
            if (distance <= tolerance && distance < bestDistance) {
                best = candidate;
                bestDistance = distance;
            }
        }
        if (best) {
            best.spans.push(span);
            best.baseline = median(best.spans.map(spanBaseline));
            best.height = Math.max(best.height, span.fontHeight, span.height);
        } else {
            buckets.push({ spans: [span], baseline, height: Math.max(span.fontHeight, span.height) });
        }
    }
    return buckets
        .sort((a, b) => a.baseline - b.baseline)
        .map((bucket, index) => buildLine(bucket.spans, pageNum, index));
}

function normalizedFurnitureText(text: string): string {
    return text.toLowerCase().replace(/\d+/gu, '#').replace(/\s+/gu, ' ').trim();
}

function isMarginLine(line: PositionedLine): boolean {
    const centerY = line.y + line.height / 2;
    return centerY <= MARGIN_BAND || centerY >= 1 - MARGIN_BAND;
}

function isPageNumberLine(line: PositionedLine): boolean {
    return isMarginLine(line) && /^(?:\d{1,5}|[ivxlcdm]{1,8})$/iu.test(line.text.trim());
}

/** Finds normalized headers/footers repeated on >=60% of selected pages. */
export function findRepeatedFurniture(pages: readonly PositionedPage[]): Set<string> {
    const occurrences = new Map<string, Set<number>>();
    for (const page of pages) {
        for (const line of clusterRawLines(page.spans, page.pageNum).filter(isMarginLine)) {
            const key = normalizedFurnitureText(line.text);
            if (!key || /^(?:#|[ivxlcdm]{1,8})$/iu.test(key)) continue;
            let pageSet = occurrences.get(key);
            if (!pageSet) occurrences.set(key, (pageSet = new Set()));
            pageSet.add(page.pageNum);
        }
    }
    const threshold = Math.max(2, Math.ceil(pages.length * 0.6));
    return new Set([...occurrences].filter(([, set]) => set.size >= threshold).map(([key]) => key));
}

function inferColumnGutter(lines: readonly PositionedLine[]): number | null {
    const groups = new Map<number, GutterCandidate[]>();
    for (const line of lines) {
        for (const gap of line.gaps) {
            if (gap.width < 0.07) continue;
            const leftSpans = line.spans.slice(0, gap.afterSpan + 1);
            const rightSpans = line.spans.slice(gap.afterSpan + 1);
            const candidate: GutterCandidate = {
                midpoint: gap.x + gap.width / 2,
                leftChars: [...gap.leftText].length,
                rightChars: [...gap.rightText].length,
                leftWidth: Math.max(...leftSpans.map(span => span.x + span.width)) - Math.min(...leftSpans.map(span => span.x)),
                rightWidth: Math.max(...rightSpans.map(span => span.x + span.width)) - Math.min(...rightSpans.map(span => span.x)),
            };
            const bin = Math.round(candidate.midpoint / 0.035);
            const group = groups.get(bin) ?? [];
            group.push(candidate);
            groups.set(bin, group);
        }
    }
    const best = [...groups.values()].sort((a, b) => b.length - a.length)[0];
    if (!best || best.length < Math.max(3, Math.ceil(lines.length * 0.08))) return null;
    if (median(best.map(item => item.leftChars)) < 10 || median(best.map(item => item.rightChars)) < 10) return null;
    if (median(best.map(item => item.leftWidth)) < 0.12 || median(best.map(item => item.rightWidth)) < 0.12) return null;
    return median(best.map(item => item.midpoint));
}

function splitLineAtGutter(line: PositionedLine, gutter: number): PositionedLine[] {
    if (line.spans.some(span => span.x < gutter && span.x + span.width > gutter)) {
        return [{ ...line, columnIndex: -1 }];
    }
    const left = line.spans.filter(span => span.x + span.width <= gutter);
    const right = line.spans.filter(span => span.x >= gutter);
    if (!left.length || !right.length) {
        return [{ ...line, columnIndex: line.x >= gutter ? 1 : 0 }];
    }
    return [buildLine(left, line.pageNum, line.lineIndex, 0), buildLine(right, line.pageNum, line.lineIndex, 1)];
}

function orderColumnLines(lines: readonly PositionedLine[], gutter: number): PositionedLine[] {
    const split = lines.flatMap(line => splitLineAtGutter(line, gutter));
    const spanning = split.filter(line => line.columnIndex === -1).sort((a, b) => a.y - b.y);
    let columnLines = split.filter(line => line.columnIndex !== -1);
    const ordered: PositionedLine[] = [];
    const appendBand = (limit: number): void => {
        const band = columnLines.filter(line => line.y < limit);
        columnLines = columnLines.filter(line => line.y >= limit);
        ordered.push(
            ...band.filter(line => line.columnIndex === 0).sort((a, b) => a.y - b.y),
            ...band.filter(line => line.columnIndex === 1).sort((a, b) => a.y - b.y),
        );
    };
    for (const line of spanning) {
        appendBand(line.y);
        ordered.push(line);
    }
    appendBand(Number.POSITIVE_INFINITY);
    return ordered;
}

/** Reconstructs a page while retaining lines, gaps, fonts, coordinates, and OCR confidence. */
export function reconstructPage(spans: readonly PositionedSpan[], options: LayoutOptions = {}): ReconstructedPage {
    const pageNum = options.pageNum ?? 0;
    const removeFurniture = options.removeFurniture ?? true;
    let positionedLines = clusterRawLines(spans, pageNum);
    if (removeFurniture) {
        positionedLines = positionedLines.filter(line => {
            if (isPageNumberLine(line)) return false;
            const key = normalizedFurnitureText(line.text);
            return !isMarginLine(line) || !options.repeatedFurniture?.has(key);
        });
    }

    const warnings: string[] = [];
    const gutter = inferColumnGutter(positionedLines);
    if (gutter !== null) {
        positionedLines = orderColumnLines(positionedLines, gutter);
        warnings.push('Detected and reordered a likely two-column page. Review the extracted reading order.');
    }
    positionedLines = positionedLines.map((line, lineIndex) => ({
        ...line,
        id: `${pageNum}-${lineIndex}`,
        pageNum,
        lineIndex,
    }));
    const lines = positionedLines.map(line => line.text).filter(Boolean);
    return {
        lines,
        positionedLines,
        text: lines.join('\n'),
        warnings,
        columnCount: gutter === null ? 1 : 2,
    };
}
