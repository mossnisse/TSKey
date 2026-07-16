export interface PageRangeResult {
    pages: number[];
    error: string | null;
}

/** Parses page lists such as "1-5,8,10-12" into sorted, unique page numbers. */
export function parsePageRange(value: string, pageCount: number): PageRangeResult {
    const trimmed = value.trim();
    if (!trimmed) return { pages: [], error: 'Enter at least one page.' };
    if (!Number.isInteger(pageCount) || pageCount < 1) {
        return { pages: [], error: 'The PDF has no importable pages.' };
    }

    const result = new Set<number>();
    for (const rawPart of trimmed.split(',')) {
        const part = rawPart.trim();
        const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (!match) return { pages: [], error: `Invalid page range: "${part || rawPart}".` };
        const start = Number(match[1]);
        const end = Number(match[2] ?? match[1]);
        if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
            return { pages: [], error: `Pages must be between 1 and ${pageCount}.` };
        }
        if (end < start) return { pages: [], error: `Page range "${part}" runs backwards.` };
        for (let page = start; page <= end; page++) result.add(page);
    }

    return { pages: [...result].sort((a, b) => a - b), error: null };
}
