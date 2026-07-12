// taxonOps.ts
// Pure taxon-collection transforms extracted from KeyStore, parallel to coupletOps.
// Taxa are normalized records that key leads point at by id; these helpers keep the
// key's branches and the taxa list consistent when typed names are committed
// (resolveDrafts), legacy name-strings are migrated (migrateLegacyTaxa), or a taxon
// is deleted (deleteTaxaAndSever). Every function is pure — the store wrappers handle
// checkpointing and the hasUncommittedChanges flag.

import type { Branch, Couplet, Taxon } from './keyStore.ts';
import { EMPTY_BRANCH, displayTaxonName, type NameDisplayMode } from '../utils.ts';
import { nextEntityId } from './collectionOps.ts';

/** The find-or-create dedupe key for a scientific name (trim + lowercase). */
export function normalizeName(name: string): string {
    return name.trim().toLowerCase();
}

/** The taxon whose scientific name matches `name` (case-insensitive), or undefined. */
export function findTaxonByName(taxa: readonly Taxon[], name: string): Taxon | undefined {
    const norm = normalizeName(name);
    if (norm === '') return undefined;
    return taxa.find(t => normalizeName(t.scientificName) === norm);
}

/**
 * The taxon whose scientific OR vernacular name matches `name` (case-insensitive),
 * or undefined. A scientific-name match wins over a vernacular one. Used to link a
 * lead's typed destination to an existing taxon by either of its names.
 */
export function findTaxonByAnyName(taxa: readonly Taxon[], name: string): Taxon | undefined {
    const norm = normalizeName(name);
    if (norm === '') return undefined;
    return taxa.find(t => normalizeName(t.scientificName) === norm)
        ?? taxa.find(t => normalizeName(t.vernacularName) === norm);
}

/**
 * Returns the taxa sorted alphabetically by the name shown for `mode` (scientific or
 * vernacular), case-insensitively and locale-aware. `displayTaxonName` falls back to
 * the other name when the preferred one is blank, so every taxon sorts by a real
 * label. Ties keep their original relative order (Array.prototype.sort is stable).
 */
export function sortTaxaByName(taxa: readonly Taxon[], mode: NameDisplayMode): Taxon[] {
    return [...taxa].sort((a, b) =>
        displayTaxonName(a, mode).localeCompare(displayTaxonName(b, mode), undefined, { sensitivity: 'base' })
    );
}

/**
 * Normalizes untrusted taxa (imported .tskey payloads, records saved by older or
 * foreign builds) into well-formed Taxon records — the taxa counterpart of
 * isValidCoupletArray / isValidFigureArray, but repairing instead of rejecting so
 * sparse legacy records still load. Items without a valid unique positive numeric
 * id are dropped (branches pointing at them then surface as "[missing taxon]");
 * missing/mistyped fields fall back to the createTaxon defaults.
 */
export function sanitizeTaxa(data: unknown): Taxon[] {
    if (!Array.isArray(data)) return [];

    const str = (v: unknown): string => (typeof v === 'string' ? v : '');
    const seenIds = new Set<number>();
    const out: Taxon[] = [];

    for (const item of data) {
        if (!item || typeof item !== 'object') continue;
        const raw = item as Record<string, unknown>;
        const id = raw.id;
        if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0 || seenIds.has(id)) continue;
        seenIds.add(id);

        const taxon = createTaxon(id, str(raw.scientificName));
        taxon.auctor = str(raw.auctor);
        taxon.vernacularName = str(raw.vernacularName);
        taxon.description = str(raw.description);
        taxon.biology = str(raw.biology);
        taxon.distribution = str(raw.distribution);
        if (Array.isArray(raw.synonyms)) {
            taxon.synonyms = raw.synonyms.filter((s): s is string => typeof s === 'string');
        }
        if (Array.isArray(raw.confusables)) {
            taxon.confusables = raw.confusables
                .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
                .map(c => ({ name: str(c.name), distinction: str(c.distinction) }))
                .filter(c => c.name !== '' || c.distinction !== '');
        }
        out.push(taxon);
    }
    return out;
}

/** A blank taxon with the given id and (trimmed) scientific name; all text empty. */
export function createTaxon(id: number, scientificName = ''): Taxon {
    return {
        id,
        scientificName: scientificName.trim(),
        auctor: '',
        vernacularName: '',
        synonyms: [],
        description: '',
        biology: '',
        distribution: '',
        confusables: [],
    };
}

/**
 * Normalized name -> taxon id, first match wins. Scientific names are mapped first
 * so they win over any vernacular collision; vernacular names are added only when
 * `includeVernacular` is set (used for linking, not for find-or-create dedupe).
 */
function buildNameToIdMap(taxa: readonly Taxon[], includeVernacular = false): Map<string, number> {
    const nameToId = new Map<string, number>();
    taxa.forEach(t => {
        const norm = normalizeName(t.scientificName);
        if (norm && !nameToId.has(norm)) nameToId.set(norm, t.id);
    });
    if (includeVernacular) {
        taxa.forEach(t => {
            const norm = normalizeName(t.vernacularName);
            if (norm && !nameToId.has(norm)) nameToId.set(norm, t.id);
        });
    }
    return nameToId;
}

/** Maps `transform` over every couplet's two branches; keeps the couplet reference when neither branch changes. */
function mapBranches(key: readonly Couplet[], transform: (branch: Branch) => Branch): Couplet[] {
    return key.map(c => {
        const branch1 = transform(c.branch1);
        const branch2 = transform(c.branch2);
        if (branch1 === c.branch1 && branch2 === c.branch2) return c;
        return { ...c, branch1, branch2 };
    });
}

/**
 * Rewrites every branch for which `pendingNameOf` returns a name into a normalized
 * `{ kind:'taxon', taxonId }`, finding an existing taxon by scientific name or
 * appending a new record. A pending name that trims to empty becomes an empty
 * branch. Shared core of resolveDrafts and migrateLegacyTaxa.
 */
function resolvePendingNames(
    key: readonly Couplet[],
    taxa: readonly Taxon[],
    pendingNameOf: (branch: Branch) => string | null
): { key: Couplet[]; taxa: Taxon[]; changed: boolean } {
    const nameToId = buildNameToIdMap(taxa);

    const nextTaxa = [...taxa];
    let nextId = nextEntityId(nextTaxa); // running counter; avoids O(n²) re-scans
    let changed = false;

    const resolveBranch = (branch: Branch): Branch => {
        const pending = pendingNameOf(branch);
        if (pending === null) return branch;

        changed = true;
        const trimmed = pending.trim();
        if (trimmed === '') return EMPTY_BRANCH;

        const norm = normalizeName(trimmed);
        const existingId = nameToId.get(norm);
        if (existingId !== undefined) {
            return { kind: 'taxon', taxonId: existingId };
        }

        const taxonId = nextId++;
        nextTaxa.push(createTaxon(taxonId, trimmed));
        nameToId.set(norm, taxonId);
        return { kind: 'taxon', taxonId };
    };

    const nextKey = mapBranches(key, resolveBranch);

    return { key: nextKey, taxa: nextTaxa, changed };
}

/**
 * Commits transient `taxonDraft` branches (typed names not yet recorded) into real
 * taxon records via find-or-create. Returns whether anything changed so the caller
 * can skip the history checkpoint on a no-op blur.
 */
export function resolveDrafts(key: readonly Couplet[], taxa: readonly Taxon[]): { key: Couplet[]; taxa: Taxon[]; changed: boolean } {
    return resolvePendingNames(key, taxa, branch => (branch.kind === 'taxonDraft' ? branch.name : null));
}

/**
 * One-time migration of legacy `{ kind:'taxon', name }` branches (records that
 * predate normalized taxa) into taxon records + `{ kind:'taxon', taxonId }`. Runs
 * on every project load; a no-op once records are normalized. Deliberately does
 * NOT touch `taxonDraft` branches — a user-typed, not-yet-created name stays an
 * unlinked draft across reloads (taxon creation is an explicit action).
 */
export function migrateLegacyTaxa(key: readonly Couplet[], taxa: readonly Taxon[]): { key: Couplet[]; taxa: Taxon[] } {
    const result = resolvePendingNames(key, taxa, branch => {
        // Legacy taxon branch: carries `name`, lacks a numeric `taxonId`.
        const legacy = branch as { kind: string; taxonId?: unknown; name?: unknown };
        if (branch.kind === 'taxon' && typeof legacy.taxonId !== 'number' && typeof legacy.name === 'string') {
            return legacy.name;
        }
        return null;
    });
    return { key: result.key, taxa: result.taxa };
}

/**
 * Links any `taxonDraft` branch whose typed name now matches an existing taxon
 * record (by scientific OR vernacular name) to that record. Never creates records —
 * only links drafts to taxa that already exist. Run after a taxon is created/renamed
 * (or on load) so a draft doesn't stay amber when a matching record appears.
 */
export function relinkDraftsToExisting(key: readonly Couplet[], taxa: readonly Taxon[]): { key: Couplet[]; changed: boolean } {
    const nameToId = buildNameToIdMap(taxa, true);

    let changed = false;
    const relink = (branch: Branch): Branch => {
        if (branch.kind !== 'taxonDraft') return branch;
        const taxonId = nameToId.get(normalizeName(branch.name));
        if (taxonId === undefined) return branch;
        changed = true;
        return { kind: 'taxon', taxonId };
    };

    const nextKey = mapBranches(key, relink);
    return { key: nextKey, changed };
}

/** Resets any branch pointing at a deleted taxon back to empty (parallels deleteCouplets). */
export function deleteTaxaAndSever(key: readonly Couplet[], removedIds: ReadonlySet<number>): { key: Couplet[] } {
    const severIfRemoved = (branch: Branch): Branch =>
        branch.kind === 'taxon' && removedIds.has(branch.taxonId) ? EMPTY_BRANCH : branch;

    return { key: mapBranches(key, severIfRemoved) };
}
