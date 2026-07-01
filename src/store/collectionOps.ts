// collectionOps.ts
// Generic, pure helpers shared by every id-keyed entity collection (couplets,
// figures, and — later — taxa / glossary / references). They replace the
// reduce-max-id / findIndex / splice boilerplate that was previously duplicated
// once per entity type. Every helper is immutable: it returns a new array (or
// null) and never mutates its input.

export interface Entity {
    id: number;
}

/**
 * The next free id: the highest existing id + 1. Ids only need to be unique
 * within their own collection (they are independent of any 1-based display
 * number), so a freshly emptied list restarts at 1. Non-numeric ids are skipped.
 */
export function nextEntityId(items: readonly Entity[]): number {
    const maxId = items.reduce((currentMax, item) => {
        const validId = Number(item?.id);
        return !isNaN(validId) ? Math.max(currentMax, validId) : currentMax;
    }, 0);
    return maxId + 1;
}

/**
 * Immutable field patch of a single entity by id. Returns a shallow copy of the
 * array with the matching item replaced, or null when no entity has that id so
 * the caller can bail without touching state.
 */
export function updateEntity<T extends Entity>(
    items: readonly T[],
    id: number,
    fields: Partial<Omit<T, 'id'>>
): T[] | null {
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;

    const updated = { ...items[index], ...fields };
    const next = [...items];
    next[index] = updated;
    return next;
}

/** Immutable removal of every entity whose id is in `ids`. */
export function deleteEntities<T extends Entity>(items: readonly T[], ids: ReadonlySet<number>): T[] {
    return items.filter(item => !ids.has(item.id));
}

/** Immutable move of the item at `srcIdx` to `targetIdx` (raw index splice). */
export function reorderEntity<T>(items: readonly T[], srcIdx: number, targetIdx: number): T[] {
    const arr = [...items];
    const [moved] = arr.splice(srcIdx, 1);
    arr.splice(targetIdx, 0, moved);
    return arr;
}
