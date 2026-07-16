import type { PlainTextParseOptions, PlainTextParseResult } from './plainTextImporter.ts';

/** A parser implementation for one family of published key notation. */
export interface KeyDialect {
    readonly id: string;
    readonly label: string;
    parse(raw: string, options: PlainTextParseOptions): PlainTextParseResult;
}

const dialects = new Map<string, KeyDialect>();

/** Registers or replaces a dialect by id. Intended for app-owned parser modules. */
export function registerKeyDialect(dialect: KeyDialect): void {
    const id = dialect.id.trim();
    if (!id) throw new Error('A key dialect must have a non-empty id.');
    // Copy field by field (binding parse) so dialects whose parse lives on a
    // class prototype survive; a plain spread would drop inherited methods.
    dialects.set(id, { id, label: dialect.label, parse: dialect.parse.bind(dialect) });
}

export function getKeyDialect(id: string): KeyDialect | null {
    return dialects.get(id) ?? null;
}

export function listKeyDialects(): KeyDialect[] {
    return [...dialects.values()];
}
