// store.ts
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

export class KeyStore {
    private state: AppState;
    private lastSavedState: string;

    // FIX: Change stack types from string[] to AppState[]
    private undoStack: AppState[] = [];
    private redoStack: AppState[] = [];
    private readonly maxHistoryLimit: number;

    private selectedIds: number[] = [];
    private _draggedId: number | null = null;
    private activeEditingCardId: number | null = null;

    constructor(initialKey: Couplet[], maxHistoryLimit = 100) {
        this.state = { dichotomousKey: initialKey };
        this.maxHistoryLimit = maxHistoryLimit;
        this.lastSavedState = JSON.stringify(initialKey);
    }

    // ==========================================
    // GETTERS (Read-Only access to state)
    // ==========================================

    public getKey(): readonly Couplet[] {
        return this.state.dichotomousKey;
    }

    public getSelectedIds(): readonly number[] {
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

    /** Commit the current memory matrix as clean after a successful storage save */
    public markSaved() {
        this.lastSavedState = JSON.stringify(this.state.dichotomousKey);
    }

    /** Evaluation hook: Checks if active state differs from local storage baseline */
    public hasUnsavedChanges(): boolean {
        return this.lastSavedState !== JSON.stringify(this.state.dichotomousKey);
    }

    // ==========================================
    // HISTORY ENGINE (Undo / Redo)
    // ==========================================

    private saveCheckpoint() {
        this.redoStack = [];

        // Native deep-clone replaces JSON stringification
        this.undoStack.push(structuredClone(this.state));

        if (this.undoStack.length > this.maxHistoryLimit) {
            this.undoStack.shift();
        }
    }

    public undo(): boolean {
        if (this.undoStack.length === 0) return false;

        this.redoStack.push(structuredClone(this.state));

        if (this.redoStack.length > this.maxHistoryLimit) {
            this.redoStack.shift();
        }

        // Clean, type-safe assignment with no JSON.parse() needed
        this.state = this.undoStack.pop()!;
        return true;
    }

    public redo(): boolean {
        if (this.redoStack.length === 0) return false;

        this.undoStack.push(structuredClone(this.state));

        if (this.undoStack.length > this.maxHistoryLimit) {
            this.undoStack.shift();
        }

        this.state = this.redoStack.pop()!;
        return true;
    }

    // ==========================================
    // GRAPH ANALYSIS HELPERS
    // ==========================================

    /**
     * Finds the 0-based array index of a couplet by its internal unique ID.
     * Returns -1 if the ID does not exist.
     */
    public getIndexById(id: number): number {
        return this.state.dichotomousKey.findIndex(c => c.id === id);
    }

    /**
     * Sweeps the key matrix to find all parent step routes targeting an internal ID.
     * Returns human-readable labels like ["#1a", "#4b"].
     */
    public getInboundLinks(targetId: number): string[] {
        const inbound: string[] = [];
        if (!targetId) return inbound;

        this.state.dichotomousKey.forEach((couplet, index) => {
            if (couplet.link1 === targetId) inbound.push(`#${index + 1}a`);
            if (couplet.link2 === targetId) inbound.push(`#${index + 1}b`);
        });
        return inbound;
    }

    /**
     * Executes a Breadth-First Search (BFS) starting from the root node (Index 0).
     * Returns a Set containing all unique, reachable internal IDs.
     */
    public getReachableNodes(): Set<number> {
        const reachable = new Set<number>();
        const key = this.state.dichotomousKey;
        if (key.length === 0) return reachable;

        // Start traversal queue at the absolute root step
        const queue: number[] = [key[0].id];

        while (queue.length > 0) {
            const activeId = queue.shift()!;
            if (!reachable.has(activeId)) {
                reachable.add(activeId);

                const match = key.find(c => c.id === activeId);
                if (match) {
                    if (match.link1) queue.push(match.link1);
                    if (match.link2) queue.push(match.link2);
                }
            }
        }
        return reachable;
    }

    // ==========================================
    // MUTATORS (State modifiers with history tracking)
    // ==========================================

    public updateCouplet(id: number, fields: Partial<Omit<Couplet, 'id'>>) {
        this.state.dichotomousKey = this.state.dichotomousKey.map(c => {
            if (c.id === id) {
                return { ...c, ...fields };
            }
            return c;
        });
    }

    /** Explicitly commits a history point. Useful after text editing finishes (blur). */
    public commitHistoryCheckpoint() {
        this.saveCheckpoint();
    }

    public addCouplet() {
        this.saveCheckpoint();

        const maxId = this.state.dichotomousKey.reduce((currentMax, couplet) => {
            const validId = Number(couplet?.id);
            return !isNaN(validId) ? Math.max(currentMax, validId) : currentMax;
        }, 100);

        const nextInternalId = maxId + 1;

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

        // Generate a new array with updated linkages immutably
        const updatedKey = this.state.dichotomousKey.map((couplet, index) => {
            if (index === targetLinkIndex && targetField) {
                return { ...couplet, [targetField]: nextInternalId };
            }
            return couplet;
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
    }

    public deleteSelected() {
        if (this.selectedIds.length === 0) return;
        this.saveCheckpoint();
        const removedIds = new Set(this.selectedIds);
        this.state.dichotomousKey = this.state.dichotomousKey
            .filter(c => !removedIds.has(c.id))
            .map(c => ({
                ...c,
                link1: removedIds.has(c.link1) ? 0 : c.link1,
                link2: removedIds.has(c.link2) ? 0 : c.link2,
            }));
        this.selectedIds = [];
    }

    public reorderCouplets(srcId: number, targetId: number): boolean {
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
        this.commitHistoryCheckpoint();

        // Safely perform the swap
        const [movedItem] = arr.splice(srcIdx, 1);
        arr.splice(targetIdx, 0, movedItem);

        this.state.dichotomousKey = arr;
        return true;
    }

    public autoOrderBFS() {
        if (this.state.dichotomousKey.length === 0) return;
        this.saveCheckpoint();

        const key = this.state.dichotomousKey;

        // Calculate incoming counts (in-degree) for all nodes
        const incomingCounts = new Map<number, number>();
        key.forEach(c => {
            if (c.link1) incomingCounts.set(c.link1, (incomingCounts.get(c.link1) || 0) + 1);
            if (c.link2) incomingCounts.set(c.link2, (incomingCounts.get(c.link2) || 0) + 1);
        });

        // Identify all structural roots (nodes with 0 incoming links)
        // We maintain their relative order as they currently exist in the array
        const roots = key.filter(c => !incomingCounts.has(c.id));

        // Fallback: If the graph is a pure closed loop and no root is found,
        // use the first card as a seed root so the algorithm doesn't fail.
        if (roots.length === 0) {
            roots.push(key[0]);
        }

        const visited = new Set<number>();
        const orderedCouplets: Couplet[] = [];

        // Process each structural root sequentially to prevent tree-interleaving
        roots.forEach(root => {
            if (visited.has(root.id)) return;

            const queue: number[] = [root.id];

            while (queue.length > 0) {
                const currentId = queue.shift()!;
                if (currentId === 0 || visited.has(currentId)) continue;

                const couplet = key.find(c => c.id === currentId);
                if (!couplet) continue;

                visited.add(currentId);
                orderedCouplets.push(couplet);

                // Add children to the queue for this specific root's tree
                if (couplet.link1 && couplet.link1 !== 0 && !visited.has(couplet.link1)) {
                    queue.push(couplet.link1);
                }
                if (couplet.link2 && couplet.link2 !== 0 && !visited.has(couplet.link2)) {
                    queue.push(couplet.link2);
                }
            }
        });

        // Clean sweep: Catches completely cyclical islands 
        // (nodes that link to each other but have no path back to any 0-in-degree root)
        key.forEach(c => {
            if (!visited.has(c.id)) {
                const orphanQueue = [c.id];
                while (orphanQueue.length > 0) {
                    const orphanId = orphanQueue.shift()!;
                    if (orphanId === 0 || visited.has(orphanId)) continue;

                    const orphanCouplet = key.find(x => x.id === orphanId);
                    if (!orphanCouplet) continue;

                    visited.add(orphanId);
                    orderedCouplets.push(orphanCouplet);

                    if (orphanCouplet.link1 && !visited.has(orphanCouplet.link1)) orphanQueue.push(orphanCouplet.link1);
                    if (orphanCouplet.link2 && !visited.has(orphanCouplet.link2)) orphanQueue.push(orphanCouplet.link2);
                }
            }
        });

        // Commit the perfectly grouped layout
        this.state.dichotomousKey = orderedCouplets;
    }

    public replaceKeyData(newData: Couplet[]) {
        this.saveCheckpoint();
        this.state.dichotomousKey = newData;
        this.selectedIds = [];
    }

    /**
     * Validates external JSON data shapes safely before committing to the state tree.
     * Blocks corruption entirely if basic structural parameters are breached.
     */
    public importJsonData(rawData: unknown): { success: boolean; errors: string[] } {
        const errors: string[] = [];

        // Verify root structure type
        if (!rawData || !Array.isArray(rawData)) {
            return { success: false, errors: ['Invalid file format: Imported root data must be a JSON array.'] };
        }

        const validatedData: Couplet[] = [];
        const seenIds = new Set<number>();

        rawData.forEach((item: any, index) => {
            const structuralLocation = `Item at index ${index + 1}`;

            // Strict ID verification (Lookups will shatter if ID properties fail)
            if (item.id === undefined || item.id === null) {
                errors.push(`${structuralLocation} is missing its mandatory 'id' parameter.`);
            } else if (typeof item.id !== 'number' || isNaN(item.id)) {
                errors.push(`${structuralLocation} has an invalid 'id' type (must be a number).`);
            } else if (seenIds.has(item.id)) {
                errors.push(`Data Integrity Breach: Duplicate internal 'id' (${item.id}) found at index ${index + 1}.`);
            } else {
                seenIds.add(item.id);
            }

            // Graceful type coercion & sanitation for standard fields
            // Rather than instantly crashing the app for a missing description string,
            // we sanitize individual fields safely to empty parameters.
            const sanitizedCouplet: Couplet = {
                id: Number(item.id) || 0,
                alt1: typeof item.alt1 === 'string' ? item.alt1 : '',
                alt2: typeof item.alt2 === 'string' ? item.alt2 : '',
                link1: typeof item.link1 === 'number' && !isNaN(item.link1) ? item.link1 : 0,
                link2: typeof item.link2 === 'number' && !isNaN(item.link2) ? item.link2 : 0,
                taxa1: typeof item.taxa1 === 'string' ? item.taxa1 : '',
                taxa2: typeof item.taxa2 === 'string' ? item.taxa2 : ''
            };

            validatedData.push(sanitizedCouplet);
        });

        // Critical Gatekeeper Check
        // If any structural issues were discovered, abort state changes completely
        if (errors.length > 0) {
            return { success: false, errors };
        }

        // Safe State Transition
        this.saveCheckpoint(); //
        this.state.dichotomousKey = validatedData; //
        this.selectedIds = []; //

        return { success: true, errors: [] };
    }

    // ==========================================
    // SELECTION MANAGEMENT (Bypasses history)
    // ==========================================

    public toggleSelection(id: number, multiSelect: boolean) {
        if (multiSelect) {
            if (this.selectedIds.includes(id)) {
                this.selectedIds = this.selectedIds.filter(x => x !== id);
            } else {
                this.selectedIds.push(id);
            }
        } else {
            this.selectedIds = [id];
        }
    }

    public clearSelection() {
        this.selectedIds = [];
    }

    // ==========================================
    // REAL-TIME DIAGNOSTICS ENGINE
    // ==========================================

    public runDiagnostics(): Map<number, KeyValidationError[]> {
        const diagnostics = new Map<number, KeyValidationError[]>();
        const key = this.state.dichotomousKey;

        // Pre-build lookups
        const idMap = new Map<number, Couplet>();
        const idToIndexMap = new Map<number, number>();
        key.forEach((c, index) => {
            idMap.set(c.id, c);
            idToIndexMap.set(c.id, index);
        });

        // ─── REFACTORED TO USE EXSTING TRAVERSAL HELPER ─────────────────────
        const reachableNodes = this.getReachableNodes();
        // ────────────────────────────────────────────────────────────────────

        // Parent Map grouping
        const inboundParentMap = new Map<number, Set<number>>();
        key.forEach(c => {
            if (c.link1) {
                if (!inboundParentMap.has(c.link1)) inboundParentMap.set(c.link1, new Set());
                inboundParentMap.get(c.link1)!.add(c.id);
            }
            if (c.link2) {
                if (!inboundParentMap.has(c.link2)) inboundParentMap.set(c.link2, new Set());
                inboundParentMap.get(c.link2)!.add(c.id);
            }
        });

        key.forEach((c, index) => {
            const issues: KeyValidationError[] = [];

            // Warns users if a card isn't picked up by the BFS traversal queue
            if (index > 0 && !reachableNodes.has(c.id)) {
                issues.push({ severity: 'warning', message: 'Orphaned: This step is unreachable from Step #1.' });
            }
            if (c.link1 === c.id) issues.push({ severity: 'error', message: 'Choice A loops directly into its own card.' });
            if (c.link2 === c.id) issues.push({ severity: 'error', message: 'Choice B loops directly into its own card.' });
            if (c.link1 && !idMap.has(c.link1)) issues.push({ severity: 'error', message: 'Choice A points to an invalid or deleted step.' });
            if (c.link2 && !idMap.has(c.link2)) issues.push({ severity: 'error', message: 'Choice B points to an invalid or deleted step.' });
            if (!c.taxa1 && !c.link1) issues.push({ severity: 'warning', message: 'Choice A is incomplete. Assign a Taxa or destination step.' });
            if (!c.taxa2 && !c.link2) issues.push({ severity: 'warning', message: 'Choice B is incomplete. Assign a Taxa or destination step.' });
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