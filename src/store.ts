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
    private undoStack: string[] = [];
    private redoStack: string[] = [];

    // Move transient UI states here so they don't pollute the history engine
    private selectedIds: number[] = [];
    public draggedId: number | null = null;

    constructor(initialKey: Couplet[]) {
        this.state = {
            dichotomousKey: initialKey
        };
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

    // ==========================================
    // HISTORY ENGINE (Undo / Redo)
    // ==========================================

    private saveCheckpoint() {
        // Clear forward history whenever a new mutation occurs
        this.redoStack = [];
        // Save a deep snapshot of the current state before modifying it
        this.undoStack.push(JSON.stringify(this.state));
    }

    public undo(): boolean {
        if (this.undoStack.length === 0) return false;

        // Push current state to redo stack
        this.redoStack.push(JSON.stringify(this.state));
        // Restore previous state
        this.state = JSON.parse(this.undoStack.pop()!);
        return true;
    }

    public redo(): boolean {
        if (this.redoStack.length === 0) return false;

        // Push current state back to undo stack
        this.undoStack.push(JSON.stringify(this.state));
        // Restore next state
        this.state = JSON.parse(this.redoStack.pop()!);
        return true;
    }

    // ==========================================
    // MUTATORS (State modifiers with history tracking)
    // ==========================================

    public updateCouplet(id: number, fields: Partial<Omit<Couplet, 'id'>>) {
        // OPTIMIZATION: Don't flood history for every single keypress.
        // The UI orchestrator will handle when to trigger saveCheckpoint() for typing,
        // but for safety, we preserve data updates immutably here.
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
        this.state.dichotomousKey = this.state.dichotomousKey.filter(
            c => !this.selectedIds.includes(c.id)
        );
        this.selectedIds = [];
    }

    public reorderCouplets(draggedId: number, targetId: number) {
        if (draggedId === targetId) return;

        this.saveCheckpoint();

        // Create a shallow copy of the array structure
        const nextKey = [...this.state.dichotomousKey];

        const draggedIndex = nextKey.findIndex(c => c.id === draggedId);
        const targetIndex = nextKey.findIndex(c => c.id === targetId);

        // Safely manipulate the copy
        const [removed] = nextKey.splice(draggedIndex, 1);
        nextKey.splice(targetIndex, 0, removed);

        // Assign the entirely new array reference
        this.state.dichotomousKey = nextKey;
    }

    /*
    public autoOrderBFS() {
        if (this.state.dichotomousKey.length === 0) return;
        this.saveCheckpoint();

        const incomingCounts = new Map<number, number>();
        this.state.dichotomousKey.forEach(c => {
            if (c.link1) incomingCounts.set(c.link1, (incomingCounts.get(c.link1) || 0) + 1);
            if (c.link2) incomingCounts.set(c.link2, (incomingCounts.get(c.link2) || 0) + 1);
        });

        const root = this.state.dichotomousKey.find(c => !incomingCounts.has(c.id));
        const rootId = root ? root.id : this.state.dichotomousKey[0].id;

        const visited = new Set<number>();
        const orderedCouplets: Couplet[] = [];
        const queue: number[] = [rootId];

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (currentId === 0 || visited.has(currentId)) continue;

            const couplet = this.state.dichotomousKey.find(c => c.id === currentId);
            if (!couplet) continue;

            visited.add(currentId);
            orderedCouplets.push(couplet);

            if (couplet.link1 && couplet.link1 !== 0 && !visited.has(couplet.link1)) queue.push(couplet.link1);
            if (couplet.link2 && couplet.link2 !== 0 && !visited.has(couplet.link2)) queue.push(couplet.link2);
        }

        // Clean sweep orphans so data isn't dropped
        this.state.dichotomousKey.forEach(c => {
            if (!visited.has(c.id)) {
                const orphanQueue = [c.id];
                while (orphanQueue.length > 0) {
                    const orphanId = orphanQueue.shift()!;
                    if (orphanId === 0 || visited.has(orphanId)) continue;

                    const orphanCouplet = this.state.dichotomousKey.find(x => x.id === orphanId);
                    if (!orphanCouplet) continue;

                    visited.add(orphanId);
                    orderedCouplets.push(orphanCouplet);

                    if (orphanCouplet.link1 && !visited.has(orphanCouplet.link1)) orphanQueue.push(orphanCouplet.link1);
                    if (orphanCouplet.link2 && !visited.has(orphanCouplet.link2)) orphanQueue.push(orphanCouplet.link2);
                }
            }
        });

        this.state.dichotomousKey = orderedCouplets;
    }*/

    public autoOrderBFS() {
        if (this.state.dichotomousKey.length === 0) return;
        this.saveCheckpoint();

        // Fix: Root is authoritatively the first card on the canvas
        const rootId = this.state.dichotomousKey[0].id;

        const visited = new Set<number>();
        const orderedCouplets: Couplet[] = [];
        const queue: number[] = [rootId];

        // Traverse the primary tree starting from Step #1
        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (currentId === 0 || visited.has(currentId)) continue;

            const couplet = this.state.dichotomousKey.find(c => c.id === currentId);
            if (!couplet) continue;

            visited.add(currentId);
            orderedCouplets.push(couplet);

            if (couplet.link1 && couplet.link1 !== 0 && !visited.has(couplet.link1)) queue.push(couplet.link1);
            if (couplet.link2 && couplet.link2 !== 0 && !visited.has(couplet.link2)) queue.push(couplet.link2);
        }

        // Clean sweep: Safely catches any temporary secondary roots, 
        // orphaned clusters, or floating nodes, appending them to the bottom.
        this.state.dichotomousKey.forEach(c => {
            if (!visited.has(c.id)) {
                const orphanQueue = [c.id];
                while (orphanQueue.length > 0) {
                    const orphanId = orphanQueue.shift()!;
                    if (orphanId === 0 || visited.has(orphanId)) continue;

                    const orphanCouplet = this.state.dichotomousKey.find(x => x.id === orphanId);
                    if (!orphanCouplet) continue;

                    visited.add(orphanId);
                    orderedCouplets.push(orphanCouplet);

                    if (orphanCouplet.link1 && !visited.has(orphanCouplet.link1)) orphanQueue.push(orphanCouplet.link1);
                    if (orphanCouplet.link2 && !visited.has(orphanCouplet.link2)) orphanQueue.push(orphanCouplet.link2);
                }
            }
        });

        this.state.dichotomousKey = orderedCouplets;
    }

    public replaceKeyData(newData: Couplet[]) {
        this.saveCheckpoint();
        this.state.dichotomousKey = newData;
        this.selectedIds = [];
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

        const reachableNodes = new Set<number>();
        if (key.length > 0) {
            const processQueue = [key[0].id];
            while (processQueue.length > 0) {
                const activeId = processQueue.shift()!;
                if (!reachableNodes.has(activeId)) {
                    reachableNodes.add(activeId);
                    const match = key.find(c => c.id === activeId);
                    if (match) {
                        if (match.link1) processQueue.push(match.link1);
                        if (match.link2) processQueue.push(match.link2);
                    }
                }
            }
        }

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

            if (index > 0 && !reachableNodes.has(c.id)) {
                issues.push({
                    severity: 'warning',
                    message: 'Orphaned: This step is unreachable from Step #1.'
                });
            }
            if (c.link1 === c.id) issues.push({ severity: 'error', message: 'Choice A loops directly into its own card.' });
            if (c.link2 === c.id) issues.push({ severity: 'error', message: 'Choice B loops directly into its own card.' });
            if (c.link1 && !key.some(x => x.id === c.link1)) issues.push({ severity: 'error', message: 'Choice A points to an invalid or deleted step.' });
            if (c.link2 && !key.some(x => x.id === c.link2)) issues.push({ severity: 'error', message: 'Choice B points to an invalid or deleted step.' });
            if (!c.taxa1 && !c.link1) issues.push({ severity: 'warning', message: 'Choice A is incomplete. Assign a Taxa or destination step.' });
            if (!c.taxa2 && !c.link2) issues.push({ severity: 'warning', message: 'Choice B is incomplete. Assign a Taxa or destination step.' });
            if (c.taxa1 && c.link1) issues.push({ severity: 'warning', message: 'Choice A contains both Taxa and a Goto jump (Hint Mode activated).' });
            if (c.taxa2 && c.link2) issues.push({ severity: 'warning', message: 'Choice B contains both Taxa and a Goto jump (Hint Mode activated).' });

            const uniqueParents = inboundParentMap.get(c.id);
            if (uniqueParents && uniqueParents.size > 1) {
                const parentStepLabels: string[] = [];
                uniqueParents.forEach(parentId => {
                    const parentIdx = key.findIndex(x => x.id === parentId);
                    if (parentIdx !== -1) parentStepLabels.push(`#${parentIdx + 1}`);
                });
                issues.push({
                    severity: 'warning',
                    message: `Convergence: Multiple steps (${parentStepLabels.join(', ')}) link here. Keys should ideally have only one entry path.`
                });
            }

            if (issues.length > 0) diagnostics.set(c.id, issues);
        });

        return diagnostics;
    }
}