// taxonOps.ts
// Pure taxon-collection transforms extracted from KeyStore, parallel to coupletOps.
// Taxa are normalized records that key leads point at by id; these helpers keep the
// key's branches and the taxa list consistent when typed names are committed
// (resolveDrafts), legacy name-strings are migrated (migrateLegacyTaxa), or a taxon
// is deleted (deleteTaxaAndSever). Every function is pure — the store wrappers handle
// checkpointing and the hasUncommittedChanges flag.

import type { Branch, Couplet, Taxon } from './store.ts';
import { EMPTY_BRANCH } from './utils.ts';
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
    const nameToId = new Map<string, number>();
    taxa.forEach(t => {
        const norm = normalizeName(t.scientificName);
        if (norm && !nameToId.has(norm)) nameToId.set(norm, t.id);
    });

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

    const nextKey = key.map(c => {
        const branch1 = resolveBranch(c.branch1);
        const branch2 = resolveBranch(c.branch2);
        if (branch1 === c.branch1 && branch2 === c.branch2) return c;
        return { ...c, branch1, branch2 };
    });

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

/** Resets any branch pointing at a deleted taxon back to empty (parallels deleteCouplets). */
export function deleteTaxaAndSever(key: readonly Couplet[], removedIds: ReadonlySet<number>): { key: Couplet[] } {
    const severIfRemoved = (branch: Branch): Branch =>
        branch.kind === 'taxon' && removedIds.has(branch.taxonId) ? EMPTY_BRANCH : branch;

    const nextKey = key.map(c => {
        const branch1 = severIfRemoved(c.branch1);
        const branch2 = severIfRemoved(c.branch2);
        if (branch1 === c.branch1 && branch2 === c.branch2) return c;
        return { ...c, branch1, branch2 };
    });

    return { key: nextKey };
}
