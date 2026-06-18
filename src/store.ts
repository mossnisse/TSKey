// store.ts
import { isValidCoupletArray, isValidFigureArray, isRecord, branchTarget, classifyBranch, EMPTY_BRANCH } from './utils.ts';
import { workspaceStorage } from './db.ts';

export const APP_NAME = 'TSKey';
export const APP_VERSION = '0.0.1';

/** Stable, rename-proof project identity used to key figure blobs in storage. */
function newProjectUid(): string {
    return crypto.randomUUID();
}
export const STORAGE_KEY = 'dichotomous_key';
export const FIGURES_STORAGE_KEY = 'dichotomous_key_figures';
export const TITLE_STORAGE_KEY = 'dichotomous_key_title';

/**
 * A couplet choice's destination. 
 * Exactly one of:
 *
 *   linked     — points at another couplet's permanent id
 *   unresolved — a step number was typed before that step exists
 *   taxon      — a terminal taxon name (the branch ends here)
 *   empty      — nothing entered yet
 *
 * A "broken" destination (a `linked` branch whose target no longer exists) is
 * NOT a stored kind — it is derived at read time via classifyBranch(), since it
 * depends on the rest of the key rather than on the branch itself.
 */
export type Branch =
    | { kind: 'linked'; targetId: number }
    | { kind: 'unresolved'; step: number }
    | { kind: 'taxon'; name: string }
    | { kind: 'empty' };

export interface Couplet {
    id: number;        // Permanent internal unique ID
    alt1: string;
    alt2: string;
    branch1: Branch;   // destination for the first alternative
    branch2: Branch;   // destination for the second alternative
}

export interface Figure {
    id: number; // Permanent internal unique ID
    filename: string;
    caption: string;
}

export interface FigureWithBinary extends Figure {
    binaryData?: string;
}

export interface KeyValidationError {
    severity: 'warning' | 'error';
    message: string;
}

interface AppState {
    title: string;
    dichotomousKey: Couplet[];
    figures: Figure[];
}

export interface ImportResult {
    success: boolean;
    errors: string[];
    importedFigures?: FigureWithBinary[];
}

export class KeyStore {
    private state: AppState;
    private hasUncommittedChanges: boolean = false;
    private persistedTitle: string = '';
    private activeProjectUid: string = newProjectUid();
    private onProjectPersisted?: (title: string) => void;

    private undoStack: AppState[] = [];
    private redoStack: AppState[] = [];
    private readonly maxHistoryLimit: number;
    private savedHistoryIndex: number = 0;
    private currentHistoryIndex: number = 0;

    private selectedCoupletIds: Set<number> = new Set();
    private _draggedId: number | null = null;
    private activeCoupletId: number | null = null;

    // Shared clipboard state structure
    private clipboardBuffer: Couplet[] = [];
    private clipboardMode: 'copy' | 'cut' = 'copy';
    private cutIncomingLinksBuffer: Array<{ sourceId: number, field: 'branch1' | 'branch2', targetOldId: number }> = [];

    // Figures
    private selectedFigureIds: Set<number> = new Set();

    constructor(initialKey: Couplet[], initialFigures: Figure[] = [], initialTitle = 'Untitled Key', maxHistoryLimit = 100) {
        this.state = {
            title: initialTitle,
            dichotomousKey: initialKey,
            figures: initialFigures
        };
        this.maxHistoryLimit = maxHistoryLimit;
        this.hasUncommittedChanges = false;
        this.persistedTitle = initialTitle;
    }

    // ==========================================
    // GETTERS and Setters
    // ==========================================

    public getTitle(): string {
        return this.state.title;
    }

    public getPersistedTitle(): string {
        return this.persistedTitle;
    }

    public getActiveProjectUid(): string {
        return this.activeProjectUid;
    }

    public setTitle(newTitle: string): void {
        const trimmed = newTitle.trim();
        if (this.state.title === trimmed) return;

        this.saveCheckpoint();
        this.state.title = trimmed || 'Untitled Key';
        this.hasUncommittedChanges = true;
    }

    public getKey(): readonly Couplet[] {
        return this.state.dichotomousKey;
    }

    public getFigures(): readonly Figure[] {
        return this.state.figures || [];
    }

    public getSelectedCoupletIds(): ReadonlySet<number> {
        return this.selectedCoupletIds;
    }

    public setActiveCouplet(id: number | null) {
        this.activeCoupletId = id;
    }

    public clearActiveCouplet() {
        this.activeCoupletId = null;
    }

    public getActiveCoupletId(): number | null {
        return this.activeCoupletId;
    }

    public get draggedCoupletId(): number | null {
        return this._draggedId;
    }

    public startDraggingCouplet(id: number) {
        this._draggedId = id;
    }

    public stopDraggingCouplet() {
        this._draggedId = null;
    }

    public markSaved() {
        this.savedHistoryIndex = this.currentHistoryIndex;
        this.hasUncommittedChanges = false;
    }

    public hasUnsavedChanges(): boolean {
        return this.currentHistoryIndex !== this.savedHistoryIndex || this.hasUncommittedChanges;
    }

    /**
    * Wipes undo/redo timelines, selections, and drag-and-drop focus profiles 
    */
    private resetTrackingContext(): void {
        this.undoStack = [];
        this.redoStack = [];
        this.currentHistoryIndex = 0;
        this.savedHistoryIndex = 0;
        this.hasUncommittedChanges = false;
        this.selectedCoupletIds.clear();
        this.activeCoupletId = null;
        this._draggedId = null;
    }

    // ==========================================
    // HISTORY ENGINE (Undo / Redo)
    // ==========================================

    private saveCheckpoint() {
        if (this.redoStack.length > 0 && this.savedHistoryIndex > this.currentHistoryIndex) {
            this.savedHistoryIndex = -1;
        }

        this.redoStack = [];
        this.undoStack.push({
            title: this.state.title,
            dichotomousKey: this.state.dichotomousKey.map(c => ({ ...c })),
            figures: (this.state.figures || []).map(f => ({ ...f }))
        });

        if (this.undoStack.length > this.maxHistoryLimit) {
            this.undoStack.shift();
            this.currentHistoryIndex--;
            if (this.savedHistoryIndex > 0) {
                this.savedHistoryIndex--;
            } else {
                this.savedHistoryIndex = -1;
            }
        }

        this.currentHistoryIndex++;
        this.hasUncommittedChanges = false;
    }

    public undo(): boolean {
        if (this.undoStack.length === 0) return false;

        this.redoStack.push({
            title: this.state.title,
            dichotomousKey: this.state.dichotomousKey.map(c => ({ ...c })),
            figures: (this.state.figures || []).map(f => ({ ...f }))
        });

        if (this.redoStack.length > this.maxHistoryLimit) {
            this.redoStack.shift();
        }

        const nextState = this.undoStack.pop();
        if (nextState) this.state = nextState;

        this.currentHistoryIndex--;
        this.hasUncommittedChanges = false;

        if (this.clipboardMode === 'cut') {
            this.clipboardMode = 'copy';
            this.cutIncomingLinksBuffer = [];
        }

        return true;
    }

    public redo(): boolean {
        if (this.redoStack.length === 0) return false;

        this.undoStack.push({
            title: this.state.title,
            dichotomousKey: this.state.dichotomousKey.map(c => ({ ...c })),
            figures: (this.state.figures || []).map(f => ({ ...f }))
        });

        if (this.undoStack.length > this.maxHistoryLimit) {
            this.undoStack.shift();
        }

        this.currentHistoryIndex++;
        this.state = this.redoStack.pop()!;
        this.hasUncommittedChanges = false;

        if (this.clipboardMode === 'cut') {
            this.clipboardMode = 'copy';
            this.cutIncomingLinksBuffer = [];
        }

        return true;
    }

    public get canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    public get canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    public copySelectedCouplets(): void {
        const selectedIds = this.getSelectedCoupletIds();
        if (selectedIds.size === 0) return;

        this.clipboardBuffer = this.state.dichotomousKey
            .filter(c => selectedIds.has(c.id))
            .map(c => ({ ...c }));

        this.clipboardMode = 'copy';
        this.cutIncomingLinksBuffer = [];
    }

    public hasClipboardData(): boolean {
        return this.clipboardBuffer.length > 0;
    }

    // ==========================================
    // GRAPH ANALYSIS HELPERS
    // ==========================================

    /**
     * Computes inverted lookup map of all inbound links across the entire key.
     */
    public generateInboundLinksMap(): Map<number, string[]> {
        const map = new Map<number, string[]>();
        const key = this.state.dichotomousKey;

        key.forEach((couplet, index) => {
            const humanLabel = index + 1;

            const t1 = branchTarget(couplet.branch1);
            if (t1 !== null) {
                if (!map.has(t1)) map.set(t1, []);
                map.get(t1)!.push(`${humanLabel}a`);
            }
            const t2 = branchTarget(couplet.branch2);
            if (t2 !== null) {
                if (!map.has(t2)) map.set(t2, []);
                map.get(t2)!.push(`${humanLabel}b`);
            }
        });

        return map;
    }

    /**
     * Executes a DFS starting from the root node (Index 0).
     * Returns a Set containing all unique, reachable internal IDs.
     */
    public getReachableNodes(idMap?: Map<number, Couplet>): Set<number> {
        const reachable = new Set<number>();
        const key = this.state.dichotomousKey;
        if (key.length === 0) return reachable;

        const lookupMap = idMap || new Map<number, Couplet>(key.map(c => [c.id, c]));

        const stack: number[] = [key[0].id];

        while (stack.length > 0) {
            const activeId = stack.pop()!;

            if (!reachable.has(activeId)) {
                reachable.add(activeId);

                const match = lookupMap.get(activeId);
                if (match) {
                    const t2 = branchTarget(match.branch2);
                    if (t2 !== null) stack.push(t2);
                    const t1 = branchTarget(match.branch1);
                    if (t1 !== null) stack.push(t1);
                }
            }
        }
        return reachable;
    }

    // ==========================================
    // MUTATORS (State modifiers with history tracking)
    // ==========================================

    public endTypingSession() {
        if (!this.hasUncommittedChanges) return;
        this.hasUncommittedChanges = false;
    }

    public updateCouplet(id: number, fields: Partial<Omit<Couplet, 'id'>>) {
        if (!this.hasUncommittedChanges) {
            this.saveCheckpoint();
        }

        const index = this.state.dichotomousKey.findIndex(c => c.id === id);
        if (index === -1) return;

        const updatedCouplet = { ...this.state.dichotomousKey[index], ...fields };
        const newKey = [...this.state.dichotomousKey];
        newKey[index] = updatedCouplet;
        this.state.dichotomousKey = newKey;

        this.hasUncommittedChanges = true;
    }

    public addCouplet(): number {
        this.saveCheckpoint();

        const maxId = this.state.dichotomousKey.reduce((currentMax, couplet) => {
            const validId = Number(couplet?.id);
            return !isNaN(validId) ? Math.max(currentMax, validId) : currentMax;
        }, 100);

        const nextInternalId = maxId + 1;
        // Determine what the 1-based step number will be for the new card
        const newStepNumber = this.state.dichotomousKey.length + 1;

        // Find which slot we want to auto-link (searching backwards)
        let targetLinkIndex = -1;
        let targetField: 'branch1' | 'branch2' | null = null;

        for (let i = this.state.dichotomousKey.length - 1; i >= 0; i--) {
            const couplet = this.state.dichotomousKey[i];
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

        const linkedToNew: Branch = { kind: 'linked', targetId: nextInternalId };

        // An unresolved branch that was waiting for this exact step now resolves to it
        const resolveIfWaiting = (branch: Branch): Branch =>
            branch.kind === 'unresolved' && branch.step === newStepNumber ? linkedToNew : branch;

        const updatedKey = this.state.dichotomousKey.map((couplet, index) => {
            let updated = { ...couplet };

            updated.branch1 = resolveIfWaiting(updated.branch1);
            updated.branch2 = resolveIfWaiting(updated.branch2);

            // Apply standard backward auto-linking if this card matched an open slot
            if (index === targetLinkIndex && targetField) {
                updated[targetField] = linkedToNew;
            }

            return updated;
        });

        // Append the new step block to our new array reference
        this.state.dichotomousKey = [
            ...updatedKey,
            {
                id: nextInternalId,
                alt1: "", alt2: "",
                branch1: EMPTY_BRANCH, branch2: EMPTY_BRANCH
            }
        ];
        this.hasUncommittedChanges = true;

        return nextInternalId; // Return the new ID for UI targeting focus
    }


    /**
    * Pastes cards from the clipboard buffer.
    */
    public pasteCouplets(targetId?: number, position: 'above' | 'below' = 'below'): boolean {
        if (this.clipboardBuffer.length === 0) return false;

        this.saveCheckpoint();

        let insertIndex = this.state.dichotomousKey.length;

        if (targetId !== undefined) {
            const targetIndex = this.state.dichotomousKey.findIndex(c => c.id === targetId);
            if (targetIndex !== -1) {
                insertIndex = position === 'above' ? targetIndex : targetIndex + 1;
            }
        }

        const maxId = this.state.dichotomousKey.reduce((currentMax, couplet) => {
            return Math.max(currentMax, couplet.id);
        }, 0);

        const idTranslationMap = new Map<number, number>();

        this.clipboardBuffer.forEach((item, index) => {
            const newId = maxId + index + 1;
            idTranslationMap.set(item.id, newId);
        });

        // Re-point a linked branch to the pasted copy of its target when that target
        // was part of the same paste; external links keep their original id.
        const remapBranch = (branch: Branch): Branch =>
            branch.kind === 'linked' && idTranslationMap.has(branch.targetId)
                ? { kind: 'linked', targetId: idTranslationMap.get(branch.targetId)! }
                : branch;

        const newCards: Couplet[] = this.clipboardBuffer.map((item) => {
            return {
                ...item,
                id: idTranslationMap.get(item.id)!,
                branch1: remapBranch(item.branch1),
                branch2: remapBranch(item.branch2)
            };
        });

        // Splice items into a new shallow copy of the key array
        let newKey = [...this.state.dichotomousKey];
        newKey.splice(insertIndex, 0, ...newCards);

        // Restore incoming links if this was a Cut operation
        if (this.clipboardMode === 'cut' && this.cutIncomingLinksBuffer.length > 0) {
            newKey = newKey.map(couplet => {
                let updated = { ...couplet };

                // Find any broken links in the buffer that belong to this specific card
                const linksToRestore = this.cutIncomingLinksBuffer.filter(b => b.sourceId === couplet.id);

                linksToRestore.forEach(b => {
                    const newTargetId = idTranslationMap.get(b.targetOldId);
                    if (newTargetId !== undefined) {
                        updated[b.field] = { kind: 'linked', targetId: newTargetId };
                    }
                });

                return updated;
            });

            this.clipboardMode = 'copy';
            this.cutIncomingLinksBuffer = [];
        }

        this.state.dichotomousKey = newKey;
        this.setSelectionBatch(newCards.map(c => c.id));
        this.hasUncommittedChanges = true;

        return true;
    }

    public cutSelectedCouplets(): void {
        const selectedIds = this.getSelectedCoupletIds();
        if (selectedIds.size === 0) return;

        this.saveCheckpoint();

        if (this.activeCoupletId !== null && selectedIds.has(this.activeCoupletId)) {
            this.activeCoupletId = null;
        }

        // Copy selected items to the buffer
        this.clipboardBuffer = this.state.dichotomousKey
            .filter(c => selectedIds.has(c.id))
            .map(c => ({ ...c }));

        this.clipboardMode = 'cut';
        this.cutIncomingLinksBuffer = [];

        //  Identify incoming links, buffer them in memory, and safely sever them
        //    while removing the selected cards from the key array.
        this.state.dichotomousKey = this.state.dichotomousKey
            .filter(c => !selectedIds.has(c.id))
            .map(c => {
                let updated = { ...c };
                const t1 = branchTarget(c.branch1);
                if (t1 !== null && selectedIds.has(t1)) {
                    this.cutIncomingLinksBuffer.push({ sourceId: c.id, field: 'branch1', targetOldId: t1 });
                    updated.branch1 = EMPTY_BRANCH;
                }
                const t2 = branchTarget(c.branch2);
                if (t2 !== null && selectedIds.has(t2)) {
                    this.cutIncomingLinksBuffer.push({ sourceId: c.id, field: 'branch2', targetOldId: t2 });
                    updated.branch2 = EMPTY_BRANCH;
                }
                return updated;
            });

        this.selectedCoupletIds = new Set();
        this.hasUncommittedChanges = true;
    }

    public deleteSelectedCouplets() {
        if (this.selectedCoupletIds.size === 0) return;
        this.saveCheckpoint();

        const removedIds = this.selectedCoupletIds;

        if (this.activeCoupletId !== null && removedIds.has(this.activeCoupletId)) {
            this.activeCoupletId = null;
        }

        // Any branch pointing at a removed couplet is reset to empty.
        const severIfRemoved = (branch: Branch): Branch => {
            const target = branchTarget(branch);
            return target !== null && removedIds.has(target) ? EMPTY_BRANCH : branch;
        };

        this.state.dichotomousKey = this.state.dichotomousKey
            .filter(c => !removedIds.has(c.id))
            .map(c => ({
                ...c,
                branch1: severIfRemoved(c.branch1),
                branch2: severIfRemoved(c.branch2),
            }));

        this.selectedCoupletIds = new Set();
        this.hasUncommittedChanges = true;
    }

    /**
    * Swaps alternative choices, target links, and taxa fields for all selected cards.
    */
    public swapSelectedCouplets(): boolean {
        if (this.selectedCoupletIds.size === 0) return false;

        this.saveCheckpoint();
        let modified = false;
        this.state.dichotomousKey = this.state.dichotomousKey.map(couplet => {
            if (this.selectedCoupletIds.has(couplet.id)) {
                modified = true;
                return {
                    ...couplet,
                    alt1: couplet.alt2,
                    alt2: couplet.alt1,
                    branch1: couplet.branch2,
                    branch2: couplet.branch1
                };
            }
            return couplet;
        });

        if (modified) {
            this.hasUncommittedChanges = true;
            return true;
        }

        return false;
    }

    public reorderCouplets(srcId: number, targetId: number, position: 'above' | 'below' = 'above'): boolean {
        if (srcId === targetId) return false;

        const arr = [...this.state.dichotomousKey];
        const srcIdx = arr.findIndex(c => c.id === srcId);
        const targetIdx = arr.findIndex(c => c.id === targetId);

        if (srcIdx === -1 || targetIdx === -1) {
            console.warn(`Aborted reordering: srcIdx (${srcIdx}) or targetIdx (${targetIdx}) was invalid.`);
            return false;
        }

        this.saveCheckpoint();
        const [movedItem] = arr.splice(srcIdx, 1);

        let insertIdx = targetIdx;
        if (position === 'above' && srcIdx < targetIdx) {
            insertIdx--; // Target shifted left because we removed an item before it
        } else if (position === 'below' && srcIdx > targetIdx) {
            insertIdx++; // Target stayed put, but we want to place it after the target
        }

        arr.splice(insertIdx, 0, movedItem);

        this.state.dichotomousKey = arr;
        this.hasUncommittedChanges = true;
        return true;
    }


    // order they key with shorter branches first. unresolved links are implied to have longer branches the higher number, 
    // empty/broken links are implied to be long. When the branches are the same length they should not be changed.
    public autoOrderCouplets() {
        if (this.state.dichotomousKey.length === 0) return;

        this.saveCheckpoint();

        // Build an efficient lookup map of the current state
        const idToCoupletMap = new Map<number, Couplet>(
            this.state.dichotomousKey.map(c => [c.id, c])
        );

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
                case 'unresolved': return (branch as { step: number }).step || 0;
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
        this.state.dichotomousKey.forEach(c => calculateBranchDepth(c.id));

        // Mirror Pass: Re-map and swap alt1/alt2 fields using the Rank Engine
        const optimizedKey = this.state.dichotomousKey.map(c => {
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

        // Commit the cleanly structured hierarchical array back to application state
        this.state.dichotomousKey = orderedCouplets;
        this.hasUncommittedChanges = true;
    }

    /* figure mutators */

    // ==========================================
    // FIGURE SELECTION & DELETION STATE
    // ==========================================

    public getSelectedFigureIds(): ReadonlySet<number> {
        return this.selectedFigureIds;
    }

    /**
     * Toggles a figure's selection state. Supports multi-select via Ctrl/Cmd/Shift modifiers.
     */
    public toggleFigureSelection(id: number, multiSelect: boolean) {
        if (!multiSelect) {
            const wasSelected = this.selectedFigureIds.has(id);
            const sizeBefore = this.selectedFigureIds.size;
            this.selectedFigureIds.clear();
            if (!wasSelected || sizeBefore > 1) {
                this.selectedFigureIds.add(id);
            }
        } else {
            if (this.selectedFigureIds.has(id)) {
                this.selectedFigureIds.delete(id);
            } else {
                this.selectedFigureIds.add(id);
            }
        }
    }

    public clearFigureSelection() {
        this.selectedFigureIds.clear();
    }

    /**
     * Deletes all currently selected figures and saves an undo history checkpoint.
     */
    public deleteSelectedFigures() {
        if (this.selectedFigureIds.size === 0) return;

        this.saveCheckpoint(); // Integrates directly with your Undo/Redo engine
        const removedIds = this.selectedFigureIds;

        // Filter out selected figures
        this.state.figures = this.state.figures.filter(f => !removedIds.has(f.id));

        // Clear the selection set
        this.selectedFigureIds = new Set();
        this.hasUncommittedChanges = true;
    }

    public addFigure(filename: string, caption: string): number {
        this.saveCheckpoint();

        const figures = this.state.figures || [];
        const maxId = figures.reduce((max, f) => Math.max(max, f.id), 0);
        const nextId = maxId + 1;

        this.state.figures = [
            ...figures,
            { id: nextId, filename, caption }
        ];

        this.hasUncommittedChanges = true;
        return nextId;
    }

    /**
    * Patches mutating attributes inside a targeting unique figure structure.
    */
    public updateFigure(id: number, fields: Partial<Omit<Figure, 'id'>>) {
        if (!this.hasUncommittedChanges) {
            this.saveCheckpoint();
        }

        const index = this.state.figures.findIndex(f => f.id === id);
        if (index === -1) return;

        const updatedFigure = { ...this.state.figures[index], ...fields };
        const newFigures = [...this.state.figures];
        newFigures[index] = updatedFigure;
        this.state.figures = newFigures;

        this.hasUncommittedChanges = true;
    }

    public reorderFigures(srcIdx: number, targetIdx: number) {
        if (!this.state.figures || srcIdx === targetIdx) return;
        this.saveCheckpoint();

        const arr = [...this.state.figures];
        const [movedItem] = arr.splice(srcIdx, 1);
        arr.splice(targetIdx, 0, movedItem);

        this.state.figures = arr;
        this.hasUncommittedChanges = true;
    }

    public autoOrderFigures(): void {
        const figures = this.state.figures || [];
        if (figures.length === 0 || this.state.dichotomousKey.length === 0) return;

        // Create a history checkpoint before mutating state
        this.saveCheckpoint();

        // Build optimized lookup maps matching how resolveTextReferences functions
        const idToFig = new Map<number, Figure>(figures.map(f => [f.id, f]));
        const displayNumToFig = new Map<number, Figure>();
        const filenameToFig = new Map<string, Figure>();
        figures.forEach((f, index) => {
            displayNumToFig.set(index + 1, f);
            filenameToFig.set(f.filename.trim().toLowerCase(), f);
        });

        const orderedFigures: Figure[] = [];
        const seenFigureIds = new Set<number>();

        // Scan couplets sequentially in their current key order
        for (const couplet of this.state.dichotomousKey) {
            const taxon1 = couplet.branch1.kind === 'taxon' ? couplet.branch1.name : '';
            const taxon2 = couplet.branch2.kind === 'taxon' ? couplet.branch2.name : '';
            const fieldsToScan = [couplet.alt1, couplet.alt2, taxon1, taxon2];

            for (const text of fieldsToScan) {
                if (!text) continue;

                let match: RegExpExecArray | null;

                // Stored references [figID: N] — value is always an internal figure ID
                const idTokenRegex = /\[figID:\s*(\d+)\s*\]/gi;
                while ((match = idTokenRegex.exec(text)) !== null) {
                    const id = parseInt(match[1].trim(), 10);
                    const matchedFig = idToFig.get(id);
                    if (matchedFig && !seenFigureIds.has(matchedFig.id)) {
                        seenFigureIds.add(matchedFig.id);
                        orderedFigures.push(matchedFig);
                    }
                }

                // Unresolved references [fig: VALUE] — numeric = 1-based display number, text = filename
                const rawTokenRegex = /\[fig:\s*(.*?)\s*\]/gi;
                while ((match = rawTokenRegex.exec(text)) !== null) {
                    const trimmedValue = match[1].trim();
                    let matchedFig: Figure | undefined = undefined;

                    const displayNum = Number(trimmedValue);
                    if (Number.isInteger(displayNum) && displayNumToFig.has(displayNum)) {
                        matchedFig = displayNumToFig.get(displayNum);
                    } else {
                        const lowercaseFilename = trimmedValue.toLowerCase();
                        if (filenameToFig.has(lowercaseFilename)) {
                            matchedFig = filenameToFig.get(lowercaseFilename);
                        }
                    }

                    if (matchedFig && !seenFigureIds.has(matchedFig.id)) {
                        seenFigureIds.add(matchedFig.id);
                        orderedFigures.push(matchedFig);
                    }
                }
            }
        }

        // Cleanup Sweep: Append any figures that aren't referenced anywhere to the end
        for (const fig of figures) {
            if (!seenFigureIds.has(fig.id)) {
                orderedFigures.push(fig);
            }
        }

        // Commit the reordered array back to state and activate change tracking
        this.state.figures = orderedFigures;
        this.hasUncommittedChanges = true;
    }

    /**
     * Packages the current core application status state into the unified `.tskey` JSON file format structure.
     */
    public exportJsonData() {
        return {
            type: APP_NAME,
            version: APP_VERSION,
            title: this.state.title,
            data: {
                title: this.state.title,
                key: this.state.dichotomousKey,
                figures: this.state.figures
            }
        };
    }

    public importJsonData(rawData: unknown): ImportResult {
        try {
            let importedKey: Couplet[] | null = null;
            let importedFigures: Figure[] = [];
            let importedTitle = 'Untitled Key';

            if (isRecord(rawData) && isRecord(rawData.data)) {
                const payload = (rawData as any).data;

                if ('key' in payload && isValidCoupletArray(payload.key)) {
                    importedKey = payload.key;

                    if (isValidFigureArray(payload.figures)) {
                        importedFigures = payload.figures;
                    }
                }

                // Extract project title if declared inside native file format
                if (typeof payload.title === 'string') {
                    importedTitle = payload.title;
                } else if (typeof rawData.title === 'string') {
                    importedTitle = (rawData as any).title;
                }
            }

            // Legacy format fallback
            if (!importedKey && isValidCoupletArray(rawData)) {
                importedKey = rawData;
            }

            if (!importedKey) {
                return {
                    success: false,
                    errors: [
                        'The uploaded file does not match the required schema structure.'
                    ]
                };
            }

            let extractedFiguresWithBinary: FigureWithBinary[] = [];
            if (importedFigures.length > 0) {
                extractedFiguresWithBinary = [...importedFigures];

                // Strip the bulky binary data out of the application state timeline
                importedFigures = importedFigures.map((f: FigureWithBinary): Figure => {
                    const { binaryData, ...cleanFigure } = f;
                    return cleanFigure;
                });
            }

            this.saveCheckpoint();
            this.state.title = importedTitle;
            this.activeProjectUid = newProjectUid(); // Imported project is a new identity
            this.state.dichotomousKey = importedKey;
            this.state.figures = importedFigures;

            workspaceStorage.resetActiveImageCache();

            this.clearSelection();
            this.activeCoupletId = null;
            this.hasUncommittedChanges = true;

            return {
                success: true,
                errors: [],
                importedFigures: extractedFiguresWithBinary
            };

        } catch (e) {
            return {
                success: false,
                errors: [
                    e instanceof Error
                        ? e.message
                        : 'Unknown engine exception during parsing the json file.'
                ]
            };
        }
    }

    // ==========================================
    // WORKSPACE & PROJECT ENGINE
    // ==========================================

    public getProjectName(): string {
        return this.state.title;
    }

    public setProjectName(newTitle: string): void {
        this.setTitle(newTitle);
    }

    public setProjectPersistedListener(cb: (title: string) => void): void {
        this.onProjectPersisted = cb;
    }

    private commitPersistedTitle(title: string): void {
        this.persistedTitle = title;
        this.onProjectPersisted?.(title);   // <- the single place the pointer updates
    }

    public async getStoredProjectsList(): Promise<{ name: string, lastModified: number }[]> {
        return await workspaceStorage.getProjectList();
    }

    public async createNewProject(title: string): Promise<void> {
        this.state.title = title;
        this.activeProjectUid = newProjectUid(); // Fresh identity for a fresh project
        this.commitPersistedTitle(title); // Sync the disk tracking name
        this.state.dichotomousKey = [];
        this.state.figures = [];
        this.resetTrackingContext();

        workspaceStorage.resetActiveImageCache();
        await this.saveToStorage();
    }

    public async loadProject(title: string): Promise<boolean> {
        const data = await workspaceStorage.loadProject(title);
        if (data) {
            this.state.title = data.title;
            // Legacy records predate projectUid; mint one so figures re-key cleanly.
            this.activeProjectUid = data.projectUid || newProjectUid();
            this.commitPersistedTitle(data.title); // Sync the disk tracking name
            this.state.dichotomousKey = data.dichotomousKey;
            this.state.figures = data.figures;
            this.resetTrackingContext();

            return true;
        }
        return false;
    }

    public async deleteProject(title: string): Promise<void> {
        await workspaceStorage.deleteProject(title);

        if (this.state.title === title) {
            await this.createNewProject('Untitled Key');
        }
    }

    public async saveToStorage(): Promise<void> {
        const isRename = this.persistedTitle && this.persistedTitle !== this.state.title;
        const oldTitle = this.persistedTitle;

        try {

            const currentData = this.state.dichotomousKey;
            await workspaceStorage.saveProject(this.state.title, this.activeProjectUid, currentData, this.state.figures);

            if (isRename && oldTitle) {
                await workspaceStorage.deleteProjectRecord(oldTitle);
            }

            this.commitPersistedTitle(this.state.title);
            this.markSaved();

        } catch (error) {
            console.error("Failed to save or rename project workspace:", error);
            if (isRename && oldTitle) {
                this.state.title = oldTitle;
                workspaceStorage.clearStagedChanges();
            }
            throw error;
        }
    }

    public async saveAsProject(newTitle: string): Promise<void> {
        const oldTitle = this.persistedTitle;
        const oldUid = this.activeProjectUid;
        const newUid = newProjectUid(); // Save As is a true duplicate — new identity

        try {
            // Copy the source project's persisted blobs to the new identity.
            await workspaceStorage.cloneProjectFigures(oldUid, newUid);

            this.state.title = newTitle;
            this.activeProjectUid = newUid;

            await workspaceStorage.saveProject(newTitle, newUid, this.state.dichotomousKey, this.state.figures);

            this.commitPersistedTitle(newTitle);
            this.markSaved();
        } catch (error) {
            console.error("Save As Operation Failed:", error);
            // Rollback identity on failure
            this.state.title = oldTitle;
            this.activeProjectUid = oldUid;
            throw error;
        }
    }

    public addFigureReference(id: number, filename: string, blob: Blob): void {
        this.saveCheckpoint();
        this.state.figures = [...this.state.figures, { id, filename, caption: '' }];
        workspaceStorage.uploadFigureBinary(id, blob);
        this.hasUncommittedChanges = true;
    }

    /**
     * Handles dropping an image from reference map stack tracking
     */
    public deleteFigureReference(id: number): void {
        this.saveCheckpoint();
        this.state.figures = this.state.figures.filter(f => f.id !== id);
        workspaceStorage.deleteFigureBinary(id);
        this.hasUncommittedChanges = true;
    }

    public async loadFromStorage(fallbackData: Couplet[] = [], fallbackFigures: Figure[] = [], lastActiveTitle = 'Untitled Key'): Promise<boolean> {
        const lastActive = lastActiveTitle;
        const success = await this.loadProject(lastActive);

        if (!success) {
            this.state = {
                title: lastActive,
                dichotomousKey: fallbackData,
                figures: fallbackFigures
            };
            this.persistedTitle = lastActive;
            this.activeProjectUid = newProjectUid();
            workspaceStorage.resetActiveImageCache();
            this.resetTrackingContext();
        }
        return success;
    }

    // ==========================================
    // SELECTION MANAGEMENT (Bypasses history)
    // ==========================================

    public toggleSelection(id: number, multiSelect: boolean) {
        if (multiSelect) {
            if (this.selectedCoupletIds.has(id)) {
                this.selectedCoupletIds.delete(id);
            } else {
                this.selectedCoupletIds.add(id);
            }
        } else {
            this.selectedCoupletIds = new Set([id]);
        }
    }

    public clearSelection(): void {
        if (this.selectedCoupletIds.size === 0) return; // Optimize: don't trigger updates if already empty
        this.selectedCoupletIds.clear();
    }

    public setSelectionToSingle(cardId: number): void {
        this.selectedCoupletIds.clear();
        this.selectedCoupletIds.add(cardId);
    }

    public setSelectionBatch(cardIds: number[] | Set<number>): void {
        this.selectedCoupletIds = new Set(cardIds);
    }

    public selectAll() {
        this.selectedCoupletIds = new Set(this.state.dichotomousKey.map(c => c.id));
    }

    // ==========================================
    // REAL-TIME DIAGNOSTICS ENGINE
    // ==========================================

    public runDiagnostics(): Map<number, KeyValidationError[]> {
        const diagnostics = new Map<number, KeyValidationError[]>();
        const key = this.state.dichotomousKey;

        if (key.length === 0) return diagnostics;

        const idMap = new Map<number, Couplet>();
        const idToIndexMap = new Map<number, number>();
        const inboundParentMap = new Map<number, Set<number>>();

        // Collect all valid internal figure IDs currently present in the state
        const figureIds = new Set(this.state.figures.map(f => f.id));

        key.forEach((c, index) => {
            idMap.set(c.id, c);
            idToIndexMap.set(c.id, index);

            const t1 = branchTarget(c.branch1);
            if (t1 !== null) {
                let parentSet = inboundParentMap.get(t1);
                if (!parentSet) inboundParentMap.set(t1, (parentSet = new Set()));
                parentSet.add(c.id);
            }
            const t2 = branchTarget(c.branch2);
            if (t2 !== null) {
                let parentSet = inboundParentMap.get(t2);
                if (!parentSet) inboundParentMap.set(t2, (parentSet = new Set()));
                parentSet.add(c.id);
            }
        });

        const reachableNodes = this.getReachableNodes(idMap);

        key.forEach((c, index) => {
            const issues: KeyValidationError[] = [];

            if (c.branch1.kind === 'unresolved') {
                issues.push({ severity: 'error', message: `Choice A points to step '${c.branch1.step}' which does not exist yet.` });
            } else if (c.branch1.kind === 'empty') {
                issues.push({ severity: 'warning', message: 'Choice A is incomplete. Assign a Taxa or destination step.' });
            }

            if (c.branch2.kind === 'unresolved') {
                issues.push({ severity: 'error', message: `Choice B points to step '${c.branch2.step}' which does not exist yet.` });
            } else if (c.branch2.kind === 'empty') {
                issues.push({ severity: 'warning', message: 'Choice B is incomplete. Assign a Taxa or destination step.' });
            }

            // --- Unresolved Figure Reference Diagnostics ---
            const FIG_ID_REGEX = /\[figID:\s*(\d+)\s*\]/gi;
            const FIG_RAW_REGEX = /\[fig:\s*([^\]]+)\s*\]/gi;

            // Check Choice A
            if (c.alt1) {
                const missingIds1: number[] = [];
                for (const match of c.alt1.matchAll(FIG_ID_REGEX)) {
                    const figId = parseInt(match[1], 10);
                    if (!figureIds.has(figId) && !missingIds1.includes(figId)) {
                        missingIds1.push(figId);
                    }
                }
                missingIds1.forEach(id => {
                    issues.push({ severity: 'warning', message: `Choice A references a missing or deleted figure (Internal ID: ${id}).` });
                });

                const unresolved1: string[] = [];
                for (const match of c.alt1.matchAll(FIG_RAW_REGEX)) {
                    const token = match[1].trim();
                    if (!unresolved1.includes(token)) {
                        unresolved1.push(token);
                    }
                }
                unresolved1.forEach(token => {
                    issues.push({ severity: 'warning', message: `Choice A references an unresolved figure reference '[fig: ${token}]'.` });
                });
            }

            // Check Choice B
            if (c.alt2) {
                const missingIds2: number[] = [];
                for (const match of c.alt2.matchAll(FIG_ID_REGEX)) {
                    const figId = parseInt(match[1], 10);
                    if (!figureIds.has(figId) && !missingIds2.includes(figId)) {
                        missingIds2.push(figId);
                    }
                }
                missingIds2.forEach(id => {
                    issues.push({ severity: 'warning', message: `Choice B references a missing or deleted figure (Internal ID: ${id}).` });
                });

                const unresolved2: string[] = [];
                for (const match of c.alt2.matchAll(FIG_RAW_REGEX)) {
                    const token = match[1].trim();
                    if (!unresolved2.includes(token)) {
                        unresolved2.push(token);
                    }
                }
                unresolved2.forEach(token => {
                    issues.push({ severity: 'warning', message: `Choice B references an unresolved figure reference '[fig: ${token}]'.` });
                });
            }

            if (index > 0 && !reachableNodes.has(c.id)) {
                issues.push({ severity: 'warning', message: 'Orphaned: This step is unreachable from Step #1.' });
            }
            if (c.branch1.kind === 'linked') {
                if (c.branch1.targetId === c.id) issues.push({ severity: 'error', message: 'Choice A loops directly into its own card.' });
                else if (!idMap.has(c.branch1.targetId)) issues.push({ severity: 'error', message: 'Choice A points to an invalid or deleted step.' });
            }
            if (c.branch2.kind === 'linked') {
                if (c.branch2.targetId === c.id) issues.push({ severity: 'error', message: 'Choice B loops directly into its own card.' });
                else if (!idMap.has(c.branch2.targetId)) issues.push({ severity: 'error', message: 'Choice B points to an invalid or deleted step.' });
            }

            const uniqueParents = inboundParentMap.get(c.id);
            if (uniqueParents && uniqueParents.size > 1) {
                const parentStepLabels: string[] = [];
                uniqueParents.forEach(parentId => {
                    const parentIdx = idToIndexMap.get(parentId);
                    if (parentIdx !== undefined && parentIdx !== -1) {
                        parentStepLabels.push(`#${parentIdx + 1}`);
                    }
                });
                issues.push({
                    severity: 'warning',
                    message: `Convergence: Multiple steps (${parentStepLabels.join(', ')}) link here.`
                });
            }

            if (issues.length > 0) diagnostics.set(c.id, issues);
        });

        return diagnostics;
    }

    /**
     * Converts figure reference tokens in text to rendered print labels like (Fig. 3).
     * Handles two token forms:
     *   [figID: N]    — stable stored reference (internal figure ID, survives reordering)
     *   [fig: value]  — an unresolved reference the user typed that hasn't been encoded
     *                   yet; value is a 1-based display number or a filename.
     */
    public resolveTextReferences(text: string, idToDisplayNum: Map<number, number>): string {
        if (!text) return text;

        const figureCount = this.state.figures.length;
        const filenameToDisplayNum = new Map<string, number>();
        this.state.figures.forEach(fig => {
            if (!fig.filename) return;
            const displayNum = idToDisplayNum.get(fig.id);
            if (displayNum !== undefined) {
                filenameToDisplayNum.set(fig.filename.trim().toLowerCase(), displayNum);
            }
        });

        // Stored references [figID: N] — value is always an internal figure ID.
        text = text.replace(/\[figID:\s*(\d+)\s*\]/gi, (_match, value) => {
            const id = parseInt(value.trim(), 10);
            const displayNum = idToDisplayNum.get(id);
            return displayNum !== undefined
                ? `(Fig. ${displayNum})`
                : `[Broken Fig: ID ${id}]`;
        });

        // Unresolved references [fig: value] — numeric = 1-based display number, text = filename.
        text = text.replace(/\[fig:\s*(.*?)\s*\]/gi, (_match, value) => {
            const trimmedValue = value.trim();

            const displayNum = Number(trimmedValue);
            if (Number.isInteger(displayNum) && displayNum >= 1 && displayNum <= figureCount) {
                return `(Fig. ${displayNum})`;
            }

            const lowercaseFilename = trimmedValue.toLowerCase();
            if (filenameToDisplayNum.has(lowercaseFilename)) {
                return `(Fig. ${filenameToDisplayNum.get(lowercaseFilename)})`;
            }

            return `[Broken Fig: ${trimmedValue}]`;
        });

        return text;
    }

    /**
     * Converts user-written [fig: N] (display number) or [fig: filename.jpg] tokens
     * into stable internal storage tokens [figID: N] that survive figure reordering.
     * Incomplete or unresolvable tokens are left unchanged.
     */
    public encodeFigureTokens(text: string): string {
        if (!text) return '';

        const figures = this.state.figures;
        const displayNumToId = new Map<number, number>();
        const filenameToId = new Map<string, number>();

        figures.forEach((fig, index) => {
            displayNumToId.set(index + 1, fig.id);
            filenameToId.set(fig.filename.trim().toLowerCase(), fig.id);
        });

        return text.replace(/\[fig:\s*(.*?)\s*\]/gi, (match, value) => {
            const trimmed = value.trim();

            // Try as a 1-based display number (the primary user-facing format)
            const displayNum = parseInt(trimmed, 10);
            if (!isNaN(displayNum) && String(displayNum) === trimmed && displayNumToId.has(displayNum)) {
                return `[figID: ${displayNumToId.get(displayNum)!}]`;
            }

            // Try as a filename (case-insensitive)
            const fig = filenameToId.get(trimmed.toLowerCase());
            if (fig !== undefined) {
                return `[figID: ${fig}]`;
            }

            // Cannot resolve — keep the original token so the user sees the problem
            return match;
        });
    }

    /**
     * Converts stored [figID: N] tokens back to user-readable [fig: N] display numbers
     * for rendering inside editor textareas. The display number reflects the figure's
     * current position and automatically updates when figures are reordered.
     */
    public decodeTextReferencesForEditor(text: string): string {
        if (!text) return '';

        const figures = this.state.figures;
        const idToDisplayNum = new Map<number, number>();
        figures.forEach((fig, index) => {
            idToDisplayNum.set(fig.id, index + 1);
        });

        return text.replace(/\[figID:\s*(\d+)\s*\]/gi, (match, value) => {
            const id = parseInt(value.trim(), 10);
            const displayNum = idToDisplayNum.get(id);
            return displayNum !== undefined
                ? `[fig: ${displayNum}]`
                : match; // Keep broken token visible so the user knows it needs attention
        });
    }
}