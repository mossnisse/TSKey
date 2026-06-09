// store.ts
import { isValidCoupletArray } from './utils.ts';

export const APP_NAME = 'TSKey';
export const APP_VERSION = '0.0.1';
export const STORAGE_KEY = 'dichotomous_key';

export interface Couplet {
    id: number;    // Permanent internal unique ID
    alt1: string;
    alt2: string;
    link1: number; // Links to the internal ID of another couplet
    link2: number;
    taxa1: string;
    taxa2: string;
}

export interface KeyValidationError {
    severity: 'warning' | 'error';
    message: string;
}

interface AppState {
    dichotomousKey: Couplet[];
}

export interface ImportResult {
    success: boolean;
    errors: string[];
}

export class KeyStore {
    private state: AppState;
    private hasUncommittedChanges: boolean = false;

    private undoStack: AppState[] = [];
    private redoStack: AppState[] = [];
    private readonly maxHistoryLimit: number;
    private savedHistoryIndex: number = 0;
    private currentHistoryIndex: number = 0;

    private selectedIds: Set<number> = new Set();
    private _draggedId: number | null = null;
    private activeEditingCardId: number | null = null;

    // Shared clipboard state structure
    private clipboardBuffer: Couplet[] = [];
    private clipboardMode: 'copy' | 'cut' = 'copy';
    private cutIncomingLinksBuffer: Array<{ sourceId: number, field: 'link1' | 'link2', targetOldId: number }> = [];

    constructor(initialKey: Couplet[], maxHistoryLimit = 100) {
        this.state = { dichotomousKey: initialKey };
        this.maxHistoryLimit = maxHistoryLimit;
        this.hasUncommittedChanges = false;
    }

    // ==========================================
    // GETTERS and Setters
    // ==========================================

    public getKey(): readonly Couplet[] {
        return this.state.dichotomousKey;
    }

    public getSelectedIds(): ReadonlySet<number> {
        return this.selectedIds;
    }

    public setActiveCard(id: number | null) {
        this.activeEditingCardId = id;
    }

    public clearActiveCard() {
        this.activeEditingCardId = null;
    }

    public getActiveCardId(): number | null {
        return this.activeEditingCardId;
    }

    public get draggedId(): number | null {
        return this._draggedId;
    }

    public startDragging(id: number) {
        this._draggedId = id;
    }

    public stopDragging() {
        this._draggedId = null;
    }

    public markSaved() {
        this.savedHistoryIndex = this.currentHistoryIndex;
    }

    public hasUnsavedChanges(): boolean {
        return this.currentHistoryIndex !== this.savedHistoryIndex || this.hasUncommittedChanges;
    }

    /**
    * Wipes undo/redo timelines, selections, and drag-and-drop focus profiles 
    * cleanly to avoid cross-contamination across different data files.
    */
    private resetTrackingContext(): void {
        this.undoStack = [];
        this.redoStack = [];
        this.currentHistoryIndex = 0;
        this.savedHistoryIndex = 0;
        this.hasUncommittedChanges = false;
        this.selectedIds.clear();
        this.activeEditingCardId = null;
        this._draggedId = null;
    }

    // ==========================================
    // HISTORY ENGINE (Undo / Redo)
    // ==========================================

    private saveCheckpoint() {
        // If we were sitting on an undone branch and make a new change, 
        // the old redo timeline branch is discarded. 
        // If the saved point was on that discarded branch, invalidate it.
        if (this.redoStack.length > 0 && this.savedHistoryIndex > this.currentHistoryIndex) {
            this.savedHistoryIndex = -1;
        }

        this.redoStack = [];
        this.undoStack.push({ dichotomousKey: [...this.state.dichotomousKey] });

        if (this.undoStack.length > this.maxHistoryLimit) {
            this.undoStack.shift();
        }

        this.currentHistoryIndex++;
        this.hasUncommittedChanges = false;
    }

    public undo(): boolean {
        if (this.undoStack.length === 0) return false;

        this.redoStack.push({ dichotomousKey: this.state.dichotomousKey });

        if (this.redoStack.length > this.maxHistoryLimit) {
            this.redoStack.shift();
        }

        const nextState = this.undoStack.pop();
        if (nextState) this.state = nextState;

        // Decrement down the absolute timeline
        this.currentHistoryIndex--;
        this.hasUncommittedChanges = false;
        return true;
    }

    public redo(): boolean {
        if (this.redoStack.length === 0) return false;

        this.undoStack.push({ dichotomousKey: this.state.dichotomousKey });

        if (this.undoStack.length > this.maxHistoryLimit) {
            this.undoStack.shift();
        }

        this.currentHistoryIndex++;

        this.state = this.redoStack.pop()!;

        this.hasUncommittedChanges = false;
        return true;
    }

    public get canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    public get canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    public copySelectedCards(): void {
        const selectedIds = this.getSelectedIds();
        if (selectedIds.size === 0) return;

        // Clone internal objects completely, retaining IDs for translation maps
        this.clipboardBuffer = this.state.dichotomousKey
            .filter(c => selectedIds.has(c.id))
            .map(c => ({ ...c }));

        // Reset clipboard mode
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
     * Computes a highly optimized inverted lookup map of all inbound links 
     * across the entire key sequence in a single O(N) execution pass.
     */
    public generateInboundLinksMap(): Map<number, string[]> {
        const map = new Map<number, string[]>();
        const key = this.state.dichotomousKey;

        key.forEach((couplet, index) => {
            const humanLabel = index + 1;

            if (couplet.link1) {
                if (!map.has(couplet.link1)) map.set(couplet.link1, []);
                map.get(couplet.link1)!.push(`#${humanLabel}a`);
            }
            if (couplet.link2) {
                if (!map.has(couplet.link2)) map.set(couplet.link2, []);
                map.get(couplet.link2)!.push(`#${humanLabel}b`);
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

        // PIvOT TO STACK: Functions identically for building a set of reachable nodes
        const stack: number[] = [key[0].id];

        while (stack.length > 0) {
            // O(1) constant time extraction!
            const activeId = stack.pop()!;

            if (!reachable.has(activeId)) {
                reachable.add(activeId);

                const match = lookupMap.get(activeId);
                if (match) {
                    // Order of links doesn't matter for gathering reachability sets
                    if (match.link2) stack.push(match.link2);
                    if (match.link1) stack.push(match.link1);
                }
            }
        }
        return reachable;
    }

    // ==========================================
    // MUTATORS (State modifiers with history tracking)
    // ==========================================

    /** Explicitly commits a history point. Useful after text editing finishes (blur). */
    public commitHistoryCheckpoint() {
        if (!this.hasUncommittedChanges) return;
        this.saveCheckpoint();
    }

    public updateCouplet(id: number, fields: Partial<Omit<Couplet, 'id'>>) {
        this.state.dichotomousKey = this.state.dichotomousKey.map(c => {
            if (c.id === id) {
                return { ...c, ...fields };
            }
            return c;
        });
        this.hasUncommittedChanges = true;
    }

    public addCouplet(): number {
        this.saveCheckpoint();

        const maxId = this.state.dichotomousKey.reduce((currentMax, couplet) => {
            const validId = Number(couplet?.id);
            return !isNaN(validId) ? Math.max(currentMax, validId) : currentMax;
        }, 100);

        const nextInternalId = maxId + 1;
        // Determine what the 1-based step number string will be for the new card
        const newStepNumberStr = (this.state.dichotomousKey.length + 1).toString();

        // Find which slot we want to auto-link (searching backwards)
        let targetLinkIndex = -1;
        let targetField: 'link1' | 'link2' | null = null;

        for (let i = this.state.dichotomousKey.length - 1; i >= 0; i--) {
            const couplet = this.state.dichotomousKey[i];
            if (!couplet.link1 && !couplet.taxa1) {
                targetLinkIndex = i;
                targetField = 'link1';
                break;
            } else if (!couplet.link2 && !couplet.taxa2) {
                targetLinkIndex = i;
                targetField = 'link2';
                break;
            }
        }

        // Generate a new array with updated linkages and text-to-ID resolutions
        const updatedKey = this.state.dichotomousKey.map((couplet, index) => {
            let updated = { ...couplet };

            // Apply standard backward auto-linking if this card matched an open slot
            if (index === targetLinkIndex && targetField) {
                updated[targetField] = nextInternalId;
            }

            // Scan for unresolved text entries pointing to the new step number and link them
            if (!updated.link1 && updated.taxa1.trim() === newStepNumberStr) {
                updated.link1 = nextInternalId;
                updated.taxa1 = "";
            }
            if (!updated.link2 && updated.taxa2.trim() === newStepNumberStr) {
                updated.link2 = nextInternalId;
                updated.taxa2 = "";
            }

            return updated;
        });

        // Append the new step block to our new array reference
        this.state.dichotomousKey = [
            ...updatedKey,
            {
                id: nextInternalId,
                alt1: "", alt2: "",
                link1: 0, link2: 0,
                taxa1: "", taxa2: ""
            }
        ];
        this.hasUncommittedChanges = true;

        return nextInternalId; // Return the new ID for UI targeting focus
    }


    /**
    * Pastes cards from the clipboard buffer.
    */
    public pasteCards(targetId?: number, position: 'above' | 'below' = 'below'): boolean {
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

        const newCards: Couplet[] = this.clipboardBuffer.map((item) => {
            const mappedId = idTranslationMap.get(item.id)!;
            const mappedLink1 = idTranslationMap.has(item.link1) ? idTranslationMap.get(item.link1)! : item.link1;
            const mappedLink2 = idTranslationMap.has(item.link2) ? idTranslationMap.get(item.link2)! : item.link2;

            return {
                ...item,
                id: mappedId,
                link1: mappedLink1,
                link2: mappedLink2
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
                        updated[b.field] = newTargetId;
                    }
                });

                return updated;
            });

            // Revert clipboard to 'copy' mode.
            this.clipboardMode = 'copy';
            this.cutIncomingLinksBuffer = [];
        }

        this.state.dichotomousKey = newKey;
        this.setSelectionBatch(newCards.map(c => c.id));
        this.hasUncommittedChanges = true;

        return true;
    }

    public cutSelectedCards(): void {
        const selectedIds = this.getSelectedIds();
        if (selectedIds.size === 0) return;

        this.saveCheckpoint();

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
                if (selectedIds.has(c.link1)) {
                    this.cutIncomingLinksBuffer.push({ sourceId: c.id, field: 'link1', targetOldId: c.link1 });
                    updated.link1 = 0;
                }
                if (selectedIds.has(c.link2)) {
                    this.cutIncomingLinksBuffer.push({ sourceId: c.id, field: 'link2', targetOldId: c.link2 });
                    updated.link2 = 0;
                }
                return updated;
            });

        this.selectedIds = new Set();
        this.hasUncommittedChanges = true;
    }

    public deleteSelected() {
        if (this.selectedIds.size === 0) return;
        this.saveCheckpoint();

        const removedIds = this.selectedIds;
        this.state.dichotomousKey = this.state.dichotomousKey
            .filter(c => !removedIds.has(c.id))
            .map(c => ({
                ...c,
                link1: removedIds.has(c.link1) ? 0 : c.link1,
                link2: removedIds.has(c.link2) ? 0 : c.link2,
            }));

        this.selectedIds = new Set();
        this.hasUncommittedChanges = true;
    }

    /**
         * Swaps alternative choices, target links, and taxa fields for all selected cards.
         * Automatically saves a history checkpoint for undo support.
         */
    public swapSelectedCouplets(): boolean {
        if (this.selectedIds.size === 0) return false;

        // Capture current state in history stack before mutating
        this.saveCheckpoint();

        let modified = false;
        this.state.dichotomousKey = this.state.dichotomousKey.map(couplet => {
            if (this.selectedIds.has(couplet.id)) {
                modified = true;
                return {
                    ...couplet,
                    alt1: couplet.alt2,
                    alt2: couplet.alt1,
                    link1: couplet.link2,
                    link2: couplet.link1,
                    taxa1: couplet.taxa2,
                    taxa2: couplet.taxa1
                };
            }
            return couplet;
        });

        if (modified) {
            this.hasUncommittedChanges = true;
            // Trigger internal graph diagnostics validation if available
            if (typeof (this as any).validateKey === 'function') {
                (this as any).validateKey();
            }
            return true;
        }

        return false;
    }

    public reorderCouplets(srcId: number, targetId: number, position: 'above' | 'below' = 'above'): boolean {
        // Locate the item indices safely
        const arr = [...this.state.dichotomousKey];
        const srcIdx = arr.findIndex(c => c.id === srcId);
        const targetIdx = arr.findIndex(c => c.id === targetId);

        // Defensive Guard: If either ID vanished, abort immediately 
        if (srcIdx === -1 || targetIdx === -1) {
            console.warn(`Aborted reordering: srcIdx (${srcIdx}) or targetIdx (${targetIdx}) was invalid.`);
            return false;
        }

        // Commit history state before mutating data
        this.saveCheckpoint();

        // Remove the dragged item from its current sequence location
        const [movedItem] = arr.splice(srcIdx, 1);

        // Locate the target item's *new* index location after the array collapse
        // This removes index-shifting math errors entirely
        let insertIdx = arr.findIndex(c => c.id === targetId);

        // Adjust the insertion pointer if appending below the card target
        if (position === 'below') {
            insertIdx++;
        }

        // Splice the item cleanly into its precise user-intended position
        arr.splice(insertIdx, 0, movedItem);

        this.state.dichotomousKey = arr;
        this.hasUncommittedChanges = true;
        return true;
    }

    public autoOrder() {
        if (this.state.dichotomousKey.length === 0) return;

        // Commit history state SAFELY before transforming data
        this.saveCheckpoint();

        // Build an efficient lookup map of the current state
        const idToCoupletMap = new Map<number, Couplet>(
            this.state.dichotomousKey.map(c => [c.id, c])
        );

        // Helper closures to cleanly detect string and link states
        const hasTaxa = (taxaStr: string) => !!taxaStr && taxaStr.trim() !== '';
        const isNumericReference = (taxaStr: string) => /^\d+$/.test(taxaStr.trim());
        const isValidLink = (linkId: number) => linkId !== 0 && idToCoupletMap.has(linkId);

        type BranchType =
            | 'terminal'
            | 'unresolved'
            | 'linked'
            | 'broken';

        const classifyBranch = (taxaStr: string, linkId: number): BranchType => {
            if (hasTaxa(taxaStr) && !isNumericReference(taxaStr)) return 'terminal';
            if (isValidLink(linkId)) return 'linked';
            if (isNumericReference(taxaStr)) return 'unresolved';
            return 'broken';
        };

        // Compute branch depths recursively (Memoized to prevent infinite loops on cycles)
        const depthCache = new Map<number, number>();
        const dynamicVisited = new Set<number>();

        // NEW: Function to infer depth natively from strings if unresolved
        const getEdgeDepth = (taxaStr: string, linkId: number): number => {
            const type = classifyBranch(taxaStr, linkId);
            if (type === 'terminal') return 0;
            if (type === 'linked') return calculateBranchDepth(linkId);
            // Treat the unresolved numeric string as its simulated depth (higher number = deeper branch)
            if (type === 'unresolved') return parseInt(taxaStr.trim(), 10) || 0;
            return 0; // broken
        };

        const calculateBranchDepth = (id: number): number => {
            if (id === 0 || !idToCoupletMap.has(id)) return 0;
            if (depthCache.has(id)) return depthCache.get(id)!;
            if (dynamicVisited.has(id)) return 0; // Handle cyclic loops gracefully

            dynamicVisited.add(id);
            const couplet = idToCoupletMap.get(id)!;

            // Compute utilizing our new edge depth evaluator
            const d1 = getEdgeDepth(couplet.taxa1, couplet.link1);
            const d2 = getEdgeDepth(couplet.taxa2, couplet.link2);

            dynamicVisited.delete(id);

            const totalDepth = 1 + Math.max(d1, d2);
            depthCache.set(id, totalDepth);
            return totalDepth;
        };

        // Populate depth cache for all items so parents inherit the weight of unresolved numbers
        this.state.dichotomousKey.forEach(c => calculateBranchDepth(c.id));

        // Mirror Pass: Re-map and swap alt1/alt2 fields using the Rank Engine
        const optimizedKey = this.state.dichotomousKey.map(c => {
            const type1 = classifyBranch(c.taxa1, c.link1);
            const type2 = classifyBranch(c.taxa2, c.link2);

            const getChoiceRank = (type: BranchType): number => {
                switch (type) {
                    case 'terminal': return 1;
                    case 'linked':
                    case 'unresolved': return 2; // Grouped: both imply continuing paths
                    case 'broken': return 3;
                }
            };

            const rank1 = getChoiceRank(type1);
            const rank2 = getChoiceRank(type2);

            let shouldSwap = false;

            if (rank1 > rank2) {
                shouldSwap = true;
            } else if (rank1 === rank2) {
                // Tie-breakers when both alternatives share the same structural rank
                if (rank1 === 1) {
                    // Both are Taxa terminal options.
                    if (c.link2 !== 0 && c.link1 !== 0) {
                        if (c.link2 < c.link1) shouldSwap = true;
                    } else if (c.link1 !== 0 && c.link2 === 0) {
                        shouldSwap = true;
                    }
                } else if (rank1 === 2) {
                    // Both are continuing paths (Linked vs Unresolved vs Both)
                    const depth1 = getEdgeDepth(c.taxa1, c.link1);
                    const depth2 = getEdgeDepth(c.taxa2, c.link2);

                    // Shorter branches (actual or inferred) go to Alt1
                    if (depth2 < depth1) {
                        shouldSwap = true;
                    } else if (depth2 === depth1) {
                        // Depth ties. Prefer resolving actual linked paths first as convention.
                        if (type1 !== type2) {
                            if (type2 === 'linked') shouldSwap = true;
                        } else if (type1 === 'linked') {
                            if (c.link2 < c.link1) shouldSwap = true;
                        }
                    }
                } else if (rank1 === 3) {
                    // Both are completely broken paths
                    if (c.link2 < c.link1) shouldSwap = true;
                }
            }

            if (shouldSwap) {
                return {
                    ...c,
                    alt1: c.alt2,
                    alt2: c.alt1,
                    link1: c.link2,
                    link2: c.link1,
                    taxa1: c.taxa2,
                    taxa2: c.taxa1
                };
            }
            return { ...c };
        });

        // Rebuild updated maps using optimized instances
        const optimizedIdMap = new Map<number, Couplet>(optimizedKey.map(c => [c.id, c]));

        // Trace incoming references to identify top-level structural root items
        const incomingCounts = new Map<number, number>();
        optimizedKey.forEach(c => {
            if (isValidLink(c.link1)) incomingCounts.set(c.link1, (incomingCounts.get(c.link1) || 0) + 1);
            if (isValidLink(c.link2)) incomingCounts.set(c.link2, (incomingCounts.get(c.link2) || 0) + 1);
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

                // Push link2 first, then link1 onto the stack.
                if (isValidLink(couplet.link2) && !visited.has(couplet.link2)) {
                    stack.push(couplet.link2);
                }
                if (isValidLink(couplet.link1) && !visited.has(couplet.link1)) {
                    stack.push(couplet.link1);
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

    public importJsonData(rawData: unknown): ImportResult {
        try {
            let targetKeyData: unknown = null;

            // Sniff payload topology to extract data payload safely
            if (rawData && typeof rawData === 'object' && 'data' in rawData && 'metadata' in rawData) {
                // New Wrapped Schema Layout format detected
                targetKeyData = (rawData as { data: unknown }).data;
            } else {
                // Fallback for Legacy Raw Array Format compatibility
                targetKeyData = rawData;
            }

            // Run our shared strict schema validation check against targeted data records
            if (!isValidCoupletArray(targetKeyData)) {
                return {
                    success: false,
                    errors: ["The uploaded file does not match the required schema structure (missing properties or incorrect types)."]
                };
            }

            // Save state snapshot for structural Undo/Redo tracking before updating
            this.saveCheckpoint();

            // Hydrate state safe in the knowledge schema runtime structure matches expectations
            this.state.dichotomousKey = targetKeyData;
            this.clearSelection();
            this.hasUncommittedChanges = true;

            return {
                success: true,
                errors: []
            };

        } catch (e) {
            return {
                success: false,
                errors: [e instanceof Error ? e.message : "Unknown engine exception during state hydration parsing."]
            };
        }
    }

    public saveToStorage(): void {
        const currentData = this.state.dichotomousKey;

        if (!Array.isArray(currentData) || currentData.length === 0) {
            throw new Error("Cannot save an empty or corrupted data structure.");
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
        this.markSaved();
    }

    public loadFromStorage(fallbackData: Couplet[] = []): boolean {
        try {
            const rawStorage = localStorage.getItem(STORAGE_KEY);

            if (!rawStorage) {
                this.state = { dichotomousKey: fallbackData };
                this.resetTrackingContext();
                return false;
            }

            const parsed = JSON.parse(rawStorage);

            // Reuses your strict duplicate-safe type-guard checking rules cleanly
            if (isValidCoupletArray(parsed)) {
                this.state = { dichotomousKey: parsed };
                this.resetTrackingContext();
                return true;
            } else {
                console.warn('Invalid data schema detected in localStorage. Loading fallbacks.');
                this.state = { dichotomousKey: fallbackData };
                this.resetTrackingContext();
                return false;
            }
        } catch (error) {
            console.warn('Corrupted localStorage JSON format. Loading fallbacks.', error);
            this.state = { dichotomousKey: fallbackData };
            this.resetTrackingContext();
            return false;
        }
    }

    // ==========================================
    // SELECTION MANAGEMENT (Bypasses history)
    // ==========================================

    public toggleSelection(id: number, multiSelect: boolean) {
        if (multiSelect) {
            if (this.selectedIds.has(id)) {
                this.selectedIds.delete(id);
            } else {
                this.selectedIds.add(id);
            }
        } else {
            this.selectedIds = new Set([id]);
        }
    }

    public clearSelection(): void {
        if (this.selectedIds.size === 0) return; // Optimize: don't trigger updates if already empty
        this.selectedIds.clear();
    }

    public setSelectionToSingle(cardId: number): void {
        this.selectedIds.clear();
        this.selectedIds.add(cardId);
    }

    public setSelectionBatch(cardIds: number[] | Set<number>): void {
        this.selectedIds = new Set(cardIds);
    }

    public selectAll() {
        this.selectedIds = new Set(this.state.dichotomousKey.map(c => c.id));
    }

    // ==========================================
    // REAL-TIME DIAGNOSTICS ENGINE
    // ==========================================

    public runDiagnostics(): Map<number, KeyValidationError[]> {
        const diagnostics = new Map<number, KeyValidationError[]>();
        const key = this.state.dichotomousKey;

        // Early exit for empty states
        if (key.length === 0) return diagnostics;

        const idMap = new Map<number, Couplet>();
        const idToIndexMap = new Map<number, number>();
        const inboundParentMap = new Map<number, Set<number>>();

        key.forEach((c, index) => {
            idMap.set(c.id, c);
            idToIndexMap.set(c.id, index);

            if (c.link1) {
                let parentSet = inboundParentMap.get(c.link1);
                if (!parentSet) inboundParentMap.set(c.link1, (parentSet = new Set()));
                parentSet.add(c.id);
            }
            if (c.link2) {
                let parentSet = inboundParentMap.get(c.link2);
                if (!parentSet) inboundParentMap.set(c.link2, (parentSet = new Set()));
                parentSet.add(c.id);
            }
        });

        const reachableNodes = this.getReachableNodes(idMap);
        const NUMERIC_REGEX = /^\d+$/;

        key.forEach((c, index) => {
            const issues: KeyValidationError[] = [];

            const isUnresolved1 = !c.link1 && NUMERIC_REGEX.test(c.taxa1);
            const isUnresolved2 = !c.link2 && NUMERIC_REGEX.test(c.taxa2);

            if (isUnresolved1) {
                issues.push({ severity: 'error', message: `Choice A points to step '${c.taxa1}' which does not exist yet.` });
            } else if (!c.taxa1 && !c.link1) {
                issues.push({ severity: 'warning', message: 'Choice A is incomplete. Assign a Taxa or destination step.' });
            }

            if (isUnresolved2) {
                issues.push({ severity: 'error', message: `Choice B points to step '${c.taxa2}' which does not exist yet.` });
            } else if (!c.taxa2 && !c.link2) {
                issues.push({ severity: 'warning', message: 'Choice B is incomplete. Assign a Taxa or destination step.' });
            }

            if (index > 0 && !reachableNodes.has(c.id)) {
                issues.push({ severity: 'warning', message: 'Orphaned: This step is unreachable from Step #1.' });
            }
            if (c.link1 === c.id) issues.push({ severity: 'error', message: 'Choice A loops directly into its own card.' });
            if (c.link2 === c.id) issues.push({ severity: 'error', message: 'Choice B loops directly into its own card.' });

            if (c.link1 && !idMap.has(c.link1)) issues.push({ severity: 'error', message: 'Choice A points to an invalid or deleted step.' });
            if (c.link2 && !idMap.has(c.link2)) issues.push({ severity: 'error', message: 'Choice B points to an invalid or deleted step.' });

            if (c.taxa1 && c.link1) issues.push({ severity: 'warning', message: 'Choice A contains both Taxa and a Goto jump (Hint Mode activated).' });
            if (c.taxa2 && c.link2) issues.push({ severity: 'warning', message: 'Choice B contains both Taxa and a Goto jump (Hint Mode activated).' });

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
}