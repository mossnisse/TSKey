// coupletOps.ts
// Pure couplet-collection transforms extracted from KeyStore. Unlike plain
// entities, couplet operations must also keep inter-couplet branch links
// consistent (auto-link new steps, remap pasted links, sever/restore links on
// cut & delete), so they live here rather than in the generic collectionOps.
//
// Every function is pure: it takes a key (and its arguments) and returns the new
// key, never mutating its input. The store wrappers handle checkpointing,
// selection, and the hasUncommittedChanges flag.

import type { Branch, Couplet } from './store.ts';
import { branchTarget, classifyBranch, EMPTY_BRANCH } from './utils.ts';
import { nextEntityId } from './collectionOps.ts';

/** A link that was severed by a cut, buffered so paste can restore it. */
export interface CutLink {
    sourceId: number;
    field: 'branch1' | 'branch2';
    targetOldId: number;
}

/**
 * Appends a fresh empty couplet. The new step is auto-linked from the nearest
 * earlier open slot (searching backwards for the first empty branch), and any
 * `unresolved` branch that was waiting for this exact step number now resolves
 * to it. Returns the new key and the new couplet's id (for UI focus targeting).
 */
export function addCouplet(key: readonly Couplet[]): { key: Couplet[]; newId: number } {
    const newId = nextEntityId(key);
    // The 1-based step number the new step will occupy once appended.
    const newStepNumber = key.length + 1;

    // Find which slot we want to auto-link (searching backwards)
    let targetLinkIndex = -1;
    let targetField: 'branch1' | 'branch2' | null = null;

    for (let i = key.length - 1; i >= 0; i--) {
        const couplet = key[i];
        if (couplet.branch1.kind === 'empty') {
            targetLinkIndex = i;
            targetField = 'branch1';
            break;
        } else if (couplet.branch2.kind === 'empty') {
            targetLinkIndex = i;
            targetField = 'branch2';
            break;
        }
    }

    const linkedToNew: Branch = { kind: 'linked', targetId: newId };

    // An unresolved branch that was waiting for this exact step now resolves to it
    const resolveIfWaiting = (branch: Branch): Branch =>
        branch.kind === 'unresolved' && branch.couplet === newStepNumber ? linkedToNew : branch;

    const updatedKey = key.map((couplet, index) => {
        let updated = { ...couplet };

        updated.branch1 = resolveIfWaiting(updated.branch1);
        updated.branch2 = resolveIfWaiting(updated.branch2);

        // Apply standard backward auto-linking if this step matched an open slot
        if (index === targetLinkIndex && targetField) {
            updated[targetField] = linkedToNew;
        }

        return updated;
    });

    return {
        key: [
            ...updatedKey,
            { id: newId, alt1: '', alt2: '', branch1: EMPTY_BRANCH, branch2: EMPTY_BRANCH }
        ],
        newId,
    };
}

/**
 * Inserts a copy of `clipboard` into the key at the target position. Pasted
 * couplets get fresh ids; links between two members of the same paste are
 * re-pointed to their copies, while links out to the rest of the key keep their
 * original ids. When the paste comes from a cut (`cutMode`), the buffered
 * incoming links are restored against the new ids. Returns the new key and the
 * ids of the inserted couplets (for selection).
 */
export function pasteCouplets(
    key: readonly Couplet[],
    clipboard: readonly Couplet[],
    targetId: number | undefined,
    position: 'above' | 'below',
    cutMode: boolean,
    cutIncomingLinks: readonly CutLink[]
): { key: Couplet[]; newIds: number[] } {
    let insertIndex = key.length;

    if (targetId !== undefined) {
        const targetIndex = key.findIndex(c => c.id === targetId);
        if (targetIndex !== -1) {
            insertIndex = position === 'above' ? targetIndex : targetIndex + 1;
        }
    }

    const maxId = key.reduce((currentMax, couplet) => Math.max(currentMax, couplet.id), 0);

    const idTranslationMap = new Map<number, number>();
    clipboard.forEach((item, index) => {
        idTranslationMap.set(item.id, maxId + index + 1);
    });

    // Re-point a linked branch to the pasted copy of its target when that target
    // was part of the same paste; external links keep their original id.
    const remapBranch = (branch: Branch): Branch =>
        branch.kind === 'linked' && idTranslationMap.has(branch.targetId)
            ? { kind: 'linked', targetId: idTranslationMap.get(branch.targetId)! }
            : branch;

    const newCouplets: Couplet[] = clipboard.map((item) => ({
        ...item,
        id: idTranslationMap.get(item.id)!,
        branch1: remapBranch(item.branch1),
        branch2: remapBranch(item.branch2),
    }));

    let newKey = [...key];
    newKey.splice(insertIndex, 0, ...newCouplets);

    // Restore incoming links if this was a Cut operation
    if (cutMode && cutIncomingLinks.length > 0) {
        newKey = newKey.map(couplet => {
            const linksToRestore = cutIncomingLinks.filter(b => b.sourceId === couplet.id);
            if (linksToRestore.length === 0) return couplet;

            let updated = { ...couplet };
            linksToRestore.forEach(b => {
                const newTargetId = idTranslationMap.get(b.targetOldId);
                if (newTargetId !== undefined) {
                    updated[b.field] = { kind: 'linked', targetId: newTargetId };
                }
            });
            return updated;
        });
    }

    return { key: newKey, newIds: newCouplets.map(c => c.id) };
}

/**
 * Removes the selected couplets from the key, severing any link that pointed into
 * the cut set and buffering those severed links so a later paste can restore them.
 * Returns the new key and the severed-link buffer. (The clipboard buffer of the
 * cut couplets themselves is captured separately by the caller.)
 */
export function cutCouplets(
    key: readonly Couplet[],
    selectedIds: ReadonlySet<number>
): { key: Couplet[]; severedLinks: CutLink[] } {
    const severedLinks: CutLink[] = [];

    const newKey = key
        .filter(c => !selectedIds.has(c.id))
        .map(c => {
            let updated = { ...c };
            const t1 = branchTarget(c.branch1);
            if (t1 !== null && selectedIds.has(t1)) {
                severedLinks.push({ sourceId: c.id, field: 'branch1', targetOldId: t1 });
                updated.branch1 = EMPTY_BRANCH;
            }
            const t2 = branchTarget(c.branch2);
            if (t2 !== null && selectedIds.has(t2)) {
                severedLinks.push({ sourceId: c.id, field: 'branch2', targetOldId: t2 });
                updated.branch2 = EMPTY_BRANCH;
            }
            return updated;
        });

    return { key: newKey, severedLinks };
}

/**
 * Removes the given couplets and resets any branch that pointed at one of them
 * back to empty. (Unlike cut, deletion does not buffer the severed links.)
 */
export function deleteCouplets(key: readonly Couplet[], removedIds: ReadonlySet<number>): Couplet[] {
    const severIfRemoved = (branch: Branch): Branch => {
        const target = branchTarget(branch);
        return target !== null && removedIds.has(target) ? EMPTY_BRANCH : branch;
    };

    return key
        .filter(c => !removedIds.has(c.id))
        .map(c => ({
            ...c,
            branch1: severIfRemoved(c.branch1),
            branch2: severIfRemoved(c.branch2),
        }));
}

/**
 * Swaps the two alternatives (text + destination) for every selected couplet.
 * Returns the new key and whether any couplet was actually swapped.
 */
export function swapCouplets(
    key: readonly Couplet[],
    selectedIds: ReadonlySet<number>
): { key: Couplet[]; modified: boolean } {
    let modified = false;
    const newKey = key.map(couplet => {
        if (selectedIds.has(couplet.id)) {
            modified = true;
            return {
                ...couplet,
                alt1: couplet.alt2,
                alt2: couplet.alt1,
                branch1: couplet.branch2,
                branch2: couplet.branch1,
            };
        }
        return couplet;
    });

    return { key: newKey, modified };
}

/**
 * Moves the couplet `srcId` to just above/below `targetId`. Returns the new key,
 * or null when the move is a no-op or either id is missing (so the caller can
 * skip the history checkpoint entirely).
 */
export function reorderCouplets(
    key: readonly Couplet[],
    srcId: number,
    targetId: number,
    position: 'above' | 'below'
): Couplet[] | null {
    if (srcId === targetId) return null;

    const arr = [...key];
    const srcIdx = arr.findIndex(c => c.id === srcId);
    const targetIdx = arr.findIndex(c => c.id === targetId);

    if (srcIdx === -1 || targetIdx === -1) {
        console.warn(`Aborted reordering: srcIdx (${srcIdx}) or targetIdx (${targetIdx}) was invalid.`);
        return null;
    }

    const [movedItem] = arr.splice(srcIdx, 1);

    let insertIdx = targetIdx;
    if (position === 'above' && srcIdx < targetIdx) {
        insertIdx--; // Target shifted left because we removed an item before it
    } else if (position === 'below' && srcIdx > targetIdx) {
        insertIdx++; // Target stayed put, but we want to place it after the target
    }

    arr.splice(insertIdx, 0, movedItem);
    return arr;
}

/**
 * Reorders the key so that, for every couplet, the shorter/terminal alternative
 * sits in Alt1, and the whole list is flattened into pre-order depth-first
 * reading order from the root(s). Unresolved step numbers are treated as their
 * own simulated depth; broken/empty branches count as long. Pure — returns the
 * reordered key.
 */
export function autoOrderCouplets(key: readonly Couplet[]): Couplet[] {
    // Build an efficient lookup map of the current state
    const idToCoupletMap = new Map<number, Couplet>(key.map(c => [c.id, c]));

    // A branch that continues into an existing couplet, or null otherwise.
    const linkTarget = (branch: Branch): number | null => {
        const t = branchTarget(branch);
        return t !== null && idToCoupletMap.has(t) ? t : null;
    };

    // Declarative rank lookup keyed by the shared branch classifier.
    // Shorter/terminal branches rank lower so they sort into Alt1.
    const rankMap: Record<ReturnType<typeof classifyBranch>, number> = {
        taxon: 1,
        linked: 2,
        unresolved: 2, // Both imply continuing paths
        broken: 3,     // Implies a long/broken branch
        empty: 3       // Treated as a long/dangling branch
    };

    // Compute branch depths recursively (Memoized to prevent infinite loops on cycles)
    const depthCache = new Map<number, number>();
    const dynamicVisited = new Set<number>();

    // infer depth natively from the branch state if unresolved
    const getEdgeDepth = (branch: Branch): number => {
        switch (classifyBranch(branch, idToCoupletMap)) {
            case 'taxon': return 0;
            case 'linked': return calculateBranchDepth((branch as { targetId: number }).targetId);
            // Treat the unresolved step number as its simulated depth (higher number = deeper branch)
            case 'unresolved': return (branch as { couplet: number }).couplet || 0;
            default: return 10000; // broken/empty: count it as a long branch
        }
    };

    const calculateBranchDepth = (id: number): number => {
        if (!idToCoupletMap.has(id)) return 0;
        if (depthCache.has(id)) return depthCache.get(id)!;
        if (dynamicVisited.has(id)) return 0; // Handle cyclic loops gracefully

        dynamicVisited.add(id);
        const couplet = idToCoupletMap.get(id)!;

        // Compute utilizing our new edge depth evaluator
        const d1 = getEdgeDepth(couplet.branch1);
        const d2 = getEdgeDepth(couplet.branch2);

        dynamicVisited.delete(id);

        const totalDepth = 1 + Math.max(d1, d2);
        depthCache.set(id, totalDepth);
        return totalDepth;
    };

    // Populate depth cache for all items so parents inherit the weight of unresolved numbers
    key.forEach(c => calculateBranchDepth(c.id));

    // Mirror Pass: Re-map and swap alt1/alt2 fields using the Rank Engine
    const optimizedKey = key.map(c => {
        const type1 = classifyBranch(c.branch1, idToCoupletMap);
        const type2 = classifyBranch(c.branch2, idToCoupletMap);

        const rank1 = rankMap[type1];
        const rank2 = rankMap[type2];

        let shouldSwap = false;

        if (rank1 > rank2) {
            shouldSwap = true;
        } else if (rank1 === rank2) {
            // Tie-breakers when both alternatives share the same structural rank
            if (rank1 === 2) {
                // Both are continuing paths (Linked vs Unresolved vs Both)
                const depth1 = getEdgeDepth(c.branch1);
                const depth2 = getEdgeDepth(c.branch2);

                // Shorter branches (actual or inferred) go to Alt1
                if (depth2 < depth1) {
                    shouldSwap = true;
                } else if (depth2 === depth1) {
                    // Depth ties. Prefer resolving actual linked paths first as convention.
                    if (type1 !== type2) {
                        if (type2 === 'linked') shouldSwap = true;
                    }
                }
            }
        }

        if (shouldSwap) {
            return {
                ...c,
                alt1: c.alt2,
                alt2: c.alt1,
                branch1: c.branch2,
                branch2: c.branch1
            };
        }
        return { ...c };
    });

    // Rebuild updated maps using optimized instances
    const optimizedIdMap = new Map<number, Couplet>(optimizedKey.map(c => [c.id, c]));

    // Trace incoming references to identify top-level structural root items
    const incomingCounts = new Map<number, number>();
    optimizedKey.forEach(c => {
        const t1 = linkTarget(c.branch1);
        if (t1 !== null) incomingCounts.set(t1, (incomingCounts.get(t1) || 0) + 1);
        const t2 = linkTarget(c.branch2);
        if (t2 !== null) incomingCounts.set(t2, (incomingCounts.get(t2) || 0) + 1);
    });

    const roots = optimizedKey.filter(c => !incomingCounts.has(c.id));
    if (roots.length === 0 && optimizedKey.length > 0) {
        roots.push(optimizedKey[0]);
    }

    const visited = new Set<number>();
    const orderedCouplets: Couplet[] = [];

    // Topology Flattening Pass: O(1) Stack Engine Traversal (Pre-order Depth First)
    const traverseTreeBranch = (startId: number) => {
        const stack: number[] = [startId];

        while (stack.length > 0) {
            const currentId = stack.pop()!;
            if (currentId === 0 || visited.has(currentId)) continue;

            const couplet = optimizedIdMap.get(currentId);
            if (!couplet) continue;

            visited.add(currentId);
            orderedCouplets.push(couplet);

            // Push branch2's target first, then branch1's, onto the stack.
            const t2 = linkTarget(couplet.branch2);
            if (t2 !== null && !visited.has(t2)) {
                stack.push(t2);
            }
            const t1 = linkTarget(couplet.branch1);
            if (t1 !== null && !visited.has(t1)) {
                stack.push(t1);
            }
        }
    };

    // Run traversal on main root nodes
    roots.forEach(root => traverseTreeBranch(root.id));

    // Cleanup Sweep (Capture detached orphaned/cyclical sub-graphs)
    optimizedKey.forEach(c => {
        if (!visited.has(c.id)) {
            traverseTreeBranch(c.id);
        }
    });

    return orderedCouplets;
}
