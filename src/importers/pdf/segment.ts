import {
    DEFAULT_PARSE_OPTIONS,
    ocrNumericToken,
    parseLeadMarker,
    parsePlainTextKey,
    type LeadMarker,
} from '../plainTextImporter.ts';
import type { KeyRegion, LogicalKeyLead, PositionedLine } from './pdfTypes.ts';

export interface TextPage {
    pageNum: number;
    text: string;
    /** Present for unedited PDF/OCR pages; omitted for manually edited text. */
    lines?: PositionedLine[];
}

interface FlatTextLine {
    pageNum: number;
    pageLine: number;
    text: string;
    score: number;
    markerNum: number | null;
    markerKind: 'first' | 'second' | null;
}

interface LineRef {
    pageNum: number;
    line: PositionedLine;
}

interface LeadDraft {
    marker: LeadMarker;
    markerText: string;
    coupletNum: number;
    kind: 'first' | 'second';
    bodyX: number;
    refs: LineRef[];
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function median(values: readonly number[]): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function scoreCoupletLikeness(line: string): number {
    let score = 0;
    const marker = parseLeadMarker(line, DEFAULT_PARSE_OPTIONS);
    if (marker) score += 2;
    if (/\t|\.(?:\s?\.){2,}|\s{2,}/u.test(line)) score += 1;
    if (/\b(?:go\s+to\s+|couplet\s+)?\d{1,4}\.?\s*$/iu.test(line)
        || /\b[\p{Lu}][\p{L}.'’()-]+(?:\s+[\p{L}.'’(),-]+){0,15}\s*$/u.test(line)) score += 1;
    if (line.length > 400 && !marker) score -= 1;
    return score;
}

function flattenText(pages: readonly TextPage[]): FlatTextLine[] {
    const lines: FlatTextLine[] = [];
    for (const page of pages) {
        page.text.replace(/\r\n?/gu, '\n').split('\n').forEach((text, pageLine) => {
            const trimmed = text.trim();
            if (!trimmed) return;
            const marker = parseLeadMarker(trimmed, DEFAULT_PARSE_OPTIONS);
            lines.push({
                pageNum: page.pageNum,
                pageLine,
                text: trimmed,
                score: scoreCoupletLikeness(trimmed),
                markerNum: marker?.coupletNum ?? null,
                markerKind: marker?.kind ?? null,
            });
        });
    }
    return lines;
}

/** Text-only fallback used after the user manually edits page text. */
function detectTextRegions(pages: readonly TextPage[]): KeyRegion[] {
    const lines = flattenText(pages);
    if (!lines.length) return [];
    const markerLines = lines
        .map((line, index) => ({ line, index }))
        .filter(item => item.line.markerKind !== null || item.line.score >= 3);
    if (markerLines.length < 2) return [];

    const groups: number[][] = [];
    let previousFirstNumber: number | null = null;
    for (const { line, index } of markerLines) {
        const current = groups.at(-1);
        const numberingRestart = line.markerKind === 'first'
            && line.markerNum !== null
            && previousFirstNumber !== null
            && line.markerNum <= previousFirstNumber;
        if (!current || index - current.at(-1)! > 6 || numberingRestart) groups.push([index]);
        else current.push(index);
        if (line.markerKind === 'first' && line.markerNum !== null) previousFirstNumber = line.markerNum;
    }

    const regions: KeyRegion[] = [];
    for (const group of groups) {
        if (group.length < 2) continue;
        const selected = lines.slice(group[0], group.at(-1)! + 1);
        const firstCount = selected.filter(line => line.markerKind === 'first').length;
        const secondCount = selected.filter(line => line.markerKind === 'second').length;
        if (!firstCount || !secondCount) continue;
        const start = selected[0];
        const end = selected.at(-1)!;
        const text = selected.map(line => line.text).join('\n');
        const parsed = parsePlainTextKey(text, DEFAULT_PARSE_OPTIONS);
        if (!parsed.couplets.length || parsed.errors.length) continue;
        regions.push({
            id: `text-key-${regions.length + 1}-${start.pageNum}-${start.pageLine}`,
            label: `Detected key ${regions.length + 1} (pages ${start.pageNum}–${end.pageNum})`,
            startPage: start.pageNum,
            endPage: end.pageNum,
            startLine: start.pageLine,
            endLine: end.pageLine,
            confidence: clamp01(Math.min(firstCount, secondCount) / Math.max(firstCount, secondCount)),
            text,
        });
    }
    return regions;
}

function flattenPositioned(pages: readonly TextPage[]): LineRef[] {
    return pages.flatMap(page => (page.lines ?? []).map(line => ({
        pageNum: page.pageNum,
        line,
    })));
}

function inferBodyX(line: PositionedLine): number {
    const candidate = line.gaps
        .filter(gap => gap.rightX <= 0.35 && gap.width >= Math.max(0.006, gap.emWidth * 1.5))
        .sort((a, b) => a.rightX - b.rightX)[0];
    return candidate?.rightX ?? Math.min(0.95, line.x + Math.max(0.025, line.fontHeight * 1.8));
}

function shouldContinueLead(draft: LeadDraft, next: LineRef): boolean {
    const previous = draft.refs.at(-1)!;
    if (previous.pageNum !== next.pageNum) {
        const accumulatedBody = joinPhysicalSegments([
            draft.marker.rest,
            ...draft.refs.slice(1).map(ref => ref.line.text),
        ]);
        const crossesPage = next.pageNum === previous.pageNum + 1
            && previous.line.y >= 0.75
            && next.line.y <= 0.25
            && !splitLeadBody(accumulatedBody).destination;
        if (!crossesPage) return false;
    } else {
        const verticalGap = next.line.y - (previous.line.y + previous.line.height);
        if (verticalGap > Math.max(0.022, previous.line.fontHeight * 1.8)) return false;
    }
    if (next.line.x < draft.bodyX - 0.035) return false;
    const fontRatio = next.line.fontHeight / Math.max(draft.refs[0].line.fontHeight, 0.001);
    return fontRatio >= 0.65 && fontRatio <= 1.55;
}

function isSkippablePageHeader(draft: LeadDraft, next: LineRef): boolean {
    const previous = draft.refs.at(-1)!;
    const leadFontHeight = median(draft.refs.map(ref => ref.line.fontHeight));
    return next.pageNum === previous.pageNum + 1
        && previous.line.y >= 0.75
        && next.line.y <= 0.07
        && next.line.fontHeight < leadFontHeight * 0.9
        && next.line.x < draft.bodyX - 0.025;
}

function joinPhysicalSegments(segments: readonly string[]): string {
    let result = '';
    for (const raw of segments) {
        const segment = raw.trim();
        if (!segment) continue;
        if (!result) {
            result = segment;
        } else if (/\p{L}-$/u.test(result)) {
            result = `${result.slice(0, -1)}${segment}`;
        } else {
            result += ` ${segment}`;
        }
    }
    return result.trim();
}

function lastLeader(text: string): RegExpExecArray | null {
    const expression = /\.(?:\s?\.){2,}/gu;
    let last: RegExpExecArray | null = null;
    let match: RegExpExecArray | null;
    while ((match = expression.exec(text)) !== null) last = match;
    return last;
}

function cleanDescription(text: string): string {
    return text
        .replace(/\.(?:\s?\.){2,}/gu, ' ')
        .replace(/\s*(?:→|➔|=>)\s*$/u, '')
        .replace(/\s+/gu, ' ')
        .trim();
}

function splitLeadBody(body: string): { description: string; destination: string } {
    const tabIndex = body.lastIndexOf('\t');
    const leader = lastLeader(body);
    let description = body;
    let destination = '';
    if (leader && (tabIndex === -1 || leader.index > tabIndex)) {
        description = body.slice(0, leader.index);
        destination = body.slice(leader.index + leader[0].length);
    } else if (tabIndex !== -1) {
        description = body.slice(0, tabIndex);
        destination = body.slice(tabIndex + 1);
    } else {
        const trailing = body.match(/^(.*\S)\s+(?:→\s*|➔\s*|=>\s*)?(?:go\s+to\s+|couplet\s+)?([0-9A-Za-z|!]{1,4})\.?\s*$/iu);
        const dest = trailing
            ? ocrNumericToken(trailing[2]) ?? (/^\d{1,4}$/u.test(trailing[2]) ? trailing[2] : '')
            : '';
        if (trailing && dest) {
            description = trailing[1];
            destination = dest;
        }
    }
    return {
        description: cleanDescription(description),
        destination: destination.replace(/^[.\s]+|[.\s]+$/gu, '').replace(/\s+/gu, ' ').trim(),
    };
}

function leadFromDraft(draft: LeadDraft): LogicalKeyLead {
    const segments = [draft.marker.rest, ...draft.refs.slice(1).map(ref => ref.line.text)];
    const body = joinPhysicalSegments(segments);
    const { description, destination } = splitLeadBody(body);
    const first = draft.refs[0];
    const last = draft.refs.at(-1)!;
    const confidences = draft.refs.map(ref => ref.line.confidence).filter((value): value is number => value !== undefined);
    const canonicalMarker = draft.kind === 'first' ? `${draft.coupletNum}.` : '—';
    return {
        id: `lead-${first.pageNum}-${first.line.lineIndex}-${draft.coupletNum}-${draft.kind}`,
        coupletNum: draft.coupletNum,
        kind: draft.kind,
        markerText: draft.markerText,
        description,
        destination,
        canonicalText: `${canonicalMarker}\t${description || '___'}\t${destination || '...'}`,
        startPage: first.pageNum,
        endPage: last.pageNum,
        startLine: first.line.lineIndex,
        endLine: last.line.lineIndex,
        x: first.line.x,
        y: first.line.y,
        fontHeight: median(draft.refs.map(ref => ref.line.fontHeight)),
        confidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : undefined,
        lines: draft.refs.map(ref => ref.line),
    };
}

/** Converts positioned page lines into logical alternatives without flattening their evidence first. */
export function reconstructLogicalLeads(pages: readonly TextPage[]): LogicalKeyLead[] {
    const refs = flattenPositioned(pages);
    const leads: LogicalKeyLead[] = [];
    let active: LeadDraft | null = null;
    let lastCoupletNum = 0;
    let lastKind: 'first' | 'second' | null = null;

    const finalize = (): void => {
        if (!active || active.coupletNum < 1) {
            active = null;
            return;
        }
        const lead = leadFromDraft(active);
        leads.push(lead);
        lastKind = lead.kind;
        active = null;
    };

    for (const ref of refs) {
        const marker = parseLeadMarker(ref.line.text, DEFAULT_PARSE_OPTIONS);
        if (!marker) {
            if (active && shouldContinueLead(active, ref)) active.refs.push(ref);
            else if (active && isSkippablePageHeader(active, ref)) continue;
            else finalize();
            continue;
        }

        finalize();
        let coupletNum = marker.coupletNum ?? lastCoupletNum;
        let kind = marker.kind;
        if (kind === 'first' && coupletNum === lastCoupletNum && lastKind === 'first') kind = 'second';
        if (marker.coupletNum !== null) lastCoupletNum = marker.coupletNum;
        coupletNum = marker.coupletNum ?? lastCoupletNum;
        const markerText = marker.kind === 'second' && marker.coupletNum === null
            ? ref.line.text.trim().slice(0, 1)
            : `${coupletNum}${kind === 'second' ? 'b' : '.'}`;
        active = {
            marker,
            markerText,
            coupletNum,
            kind,
            bodyX: inferBodyX(ref.line),
            refs: [ref],
        };
    }
    finalize();
    return leads;
}

function splitLeadGroups(leads: readonly LogicalKeyLead[]): LogicalKeyLead[][] {
    const groups: LogicalKeyLead[][] = [];
    let previousFirstNumber: number | null = null;
    for (const lead of leads) {
        if (lead.coupletNum < 1) continue;
        const current = groups.at(-1);
        const previous = current?.at(-1);
        const numberingRestart = lead.kind === 'first'
            && previousFirstNumber !== null
            && lead.coupletNum <= previousFirstNumber;
        const pageGap = previous ? lead.startPage - previous.endPage > 1 : false;
        const spatialGap = previous && lead.startPage === previous.endPage
            ? lead.y - (previous.lines.at(-1)!.y + previous.lines.at(-1)!.height) > 0.075
            : false;
        if (!current || numberingRestart || pageGap || spatialGap) {
            groups.push([lead]);
            previousFirstNumber = lead.kind === 'first' ? lead.coupletNum : null;
        } else {
            current.push(lead);
            if (lead.kind === 'first') previousFirstNumber = lead.coupletNum;
        }
    }
    return groups;
}

function regionFromGroup(group: readonly LogicalKeyLead[]): KeyRegion | null {
    const alternatives = new Map<number, Set<'first' | 'second'>>();
    for (const lead of group) {
        const kinds = alternatives.get(lead.coupletNum) ?? new Set<'first' | 'second'>();
        kinds.add(lead.kind);
        alternatives.set(lead.coupletNum, kinds);
    }
    const pairCount = [...alternatives.values()].filter(kinds => kinds.has('first') && kinds.has('second')).length;
    const pairRatio = pairCount / Math.max(alternatives.size, 1);
    const destinationRatio = group.filter(lead => lead.destination.length > 0).length / Math.max(group.length, 1);
    if (pairCount < 1 || pairRatio < 0.5 || destinationRatio < 0.45) return null;

    const text = group.map(lead => lead.canonicalText).join('\n');
    const parsed = parsePlainTextKey(text, DEFAULT_PARSE_OPTIONS);
    if (!parsed.couplets.length || parsed.errors.length) return null;
    const markerXs = group.map(lead => lead.x);
    const markerMedian = median(markerXs);
    const markerAlignment = 1 - Math.min(1, median(markerXs.map(x => Math.abs(x - markerMedian))) / 0.05);
    const fontSizes = group.map(lead => lead.fontHeight);
    const fontMedian = median(fontSizes);
    const fontConsistency = 1 - Math.min(1, median(fontSizes.map(size => Math.abs(size - fontMedian))) / Math.max(fontMedian, 0.001));
    const confidence = clamp01(pairRatio * 0.4 + destinationRatio * 0.3 + markerAlignment * 0.15 + fontConsistency * 0.15);
    const first = group[0];
    const last = group.at(-1)!;
    return {
        id: `positioned-key-${first.startPage}-${first.startLine}`,
        label: '',
        startPage: first.startPage,
        endPage: last.endPage,
        startLine: first.startLine,
        endLine: last.endLine,
        confidence,
        text,
        leads: [...group],
    };
}

/** Detects and canonicalizes key regions, preferring geometry whenever it is available. */
export function detectKeyRegions(pages: readonly TextPage[]): KeyRegion[] {
    if (!pages.length) return [];
    if (!pages.every(page => page.lines !== undefined)) return detectTextRegions(pages);
    return splitLeadGroups(reconstructLogicalLeads(pages))
        .map(group => regionFromGroup(group))
        .filter((region): region is KeyRegion => region !== null)
        .map((region, index) => ({
            ...region,
            label: `Detected key ${index + 1} (pages ${region.startPage}–${region.endPage}, ${Math.round(region.confidence * 100)}%)`,
        }));
}

/** Prefers confidence first, then the more complete key when scores are effectively tied. */
export function selectPreferredKeyRegion(keyRegions: readonly KeyRegion[]): KeyRegion | undefined {
    return keyRegions.reduce<KeyRegion | undefined>((best, region) => {
        if (!best || region.confidence > best.confidence + 0.02) return region;
        const similarlyConfident = Math.abs(region.confidence - best.confidence) <= 0.02;
        if (similarlyConfident && (region.leads?.length ?? 0) > (best.leads?.length ?? 0)) return region;
        return best;
    }, undefined);
}
