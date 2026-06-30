// store.ts
import { isValidCoupletArray, isValidFigureArray, isRecord, branchTarget } from './utils.ts';
import { figIdTokenRegex, figRawTokenRegex, buildFigureLookups } from './figureTokens.ts';
import { workspaceStorage } from './db.ts';
import type { StagingSnapshot, ProjectData } from './db.ts';
import { nextEntityId, updateEntity, deleteEntities, reorderEntity } from './collectionOps.ts';
import {
    addCouplet as addCoupletOp,
    pasteCouplets as pasteCoupletsOp,
    cutCouplets as cutCoupletsOp,
    deleteCouplets as deleteCoupletsOp,
    swapCouplets as swapCoupletsOp,
    reorderCouplets as reorderCoupletsOp,
    autoOrderCouplets as autoOrderCoupletsOp,
    type CutLink,
} from './coupletOps.ts';
import { orderFiguresByReference } from './figureOps.ts';
import { resolveTextReferences, encodeFigureTokens, decodeTextReferencesForEditor } from './figureRefs.ts';
import { createTaxon, resolveDrafts, migrateLegacyTaxa, deleteTaxaAndSever, findTaxonByName } from './taxonOps.ts';

export const APP_NAME = 'TSKey';
export const APP_VERSION = '0.0.1';

/** Stable, rename-proof project identity used to key figure blobs in storage. */
function newProjectUid(): string {
    return crypto.randomUUID();
}

/**
 * A couplet choice's destination.
 * Exactly one of:
 *
 *   linked     — points at another couplet's permanent id
 *   unresolved — a step number was typed before that step exists
 *   taxon      — a terminal, normalized reference to a Taxon record (by id)
 *   taxonDraft — a taxon name typed but not yet committed to a record. Transient:
 *                resolved to a `taxon` (find-or-create) on blur, mirroring how raw
 *                [fig: …] tokens encode to stable [figID: …]. Essentially never
 *                persisted, but handled defensively wherever a branch is read.
 *   empty      — nothing entered yet
 *
 * A "broken" destination (a `linked` branch whose target no longer exists) is
 * NOT a stored kind — it is derived at read time via classifyBranch(), since it
 * depends on the rest of the key rather than on the branch itself.
 */
export type Branch =
    | { kind: 'linked'; targetId: number }
    | { kind: 'unresolved'; couplet: number }
    | { kind: 'taxon'; taxonId: number }
    | { kind: 'taxonDraft'; name: string }
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

/** A confusable species and how to tell it apart from the taxon. */
export interface ConfusableSpecies {
    name: string;          // scientific name of the confusable species
    distinction: string;   // how to distinguish the two
}

/**
 * A taxon "chapter": the terminal that key leads point at (by id), carrying the
 * descriptive text shown alongside the key. Several leads may share one record.
 */
export interface Taxon {
    id: number;                       // Permanent internal unique ID
    scientificName: string;           // e.g. "Bufo bufo" — the find-or-create key
    auctor: string;                   // author citation, e.g. "Linnaeus, 1758"
    vernacularName: string;           // common name
    synonyms: string[];               // alternative scientific names
    description: string;              // morphological description
    biology: string;                  // biology / ecology notes
    distribution: string;             // geographic distribution
    confusables: ConfusableSpecies[]; // confusable species + how to distinguish
}

export interface KeyValidationError {
    severity: 'warning' | 'error';
    message: string;
}

/**
 * The full editable document: the title plus every id-keyed collection. This is
 * the single serializable unit — its collections are listed in
 * DOCUMENT_COLLECTIONS so history cloning and (later) new entity types extend in
 * one place. Ready to gain `taxa` / `glossary` / `references`.
 */
interface KeyDocument {
    title: string;
    dichotomousKey: Couplet[];
    figures: Figure[];
    taxa: Taxon[];
}

/**
 * The array-valued collections of KeyDocument. Adding a new entity type means
 * adding its field to KeyDocument and its key here — captureState() then clones
 * it automatically.
 */
type CollectionKey = 'dichotomousKey' | 'figures' | 'taxa';
const DOCUMENT_COLLECTIONS: CollectionKey[] = ['dichotomousKey', 'figures', 'taxa'];

/** One undo/redo frame: the editable document plus the figure-binary staging. */
interface HistoryEntry {
    state: KeyDocument;
    staging: StagingSnapshot;
}

export interface ImportResult {
    success: boolean;
    errors: string[];
    importedFigures?: FigureWithBinary[];
}

/**
 * Computes the set of couplet ids reachable from the first step by following
 * branch links. Pure: operates only on the supplied key. Shared by the store's
 * live editor and by pre-commit checks such as the plain-text importer.
 */
export function computeReachableNodes(key: Couplet[], idMap?: Map<number, Couplet>): Set<number> {
    const reachable = new Set<number>();
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

/** One step on the root→target path, with the alternative (a/b) taken to leave it. */
export interface PathStep {
    id: number;
    stepNum: number;        // 1-based display number
    choice?: 'a' | 'b';     // which alternative leads to the NEXT crumb; undefined on the target
}

export interface PathResult {
    steps: PathStep[];
    reachable: boolean;
}

/**
 * Finds a path of alternatives from the first step (root) to `targetId`, following
 * only resolved (linked) branches. Pure. Uses breadth-first search, so when a step
 * is reachable by several routes (convergence) the shortest/canonical one wins; a
 * visited set makes cycles safe. Unreachable or unknown targets return reachable:false.
 */
export function computePathFromRoot(key: readonly Couplet[], targetId: number): PathResult {
    const empty: PathResult = { steps: [], reachable: false };
    if (key.length === 0) return empty;

    const idMap = new Map<number, Couplet>(key.map(c => [c.id, c]));
    const idToIndex = new Map<number, number>();
    key.forEach((c, index) => idToIndex.set(c.id, index));
    if (!idMap.has(targetId)) return empty;

    const rootId = key[0].id;
    const cameFrom = new Map<number, { parentId: number; choice: 'a' | 'b' }>();
    const visited = new Set<number>([rootId]);
    const queue: number[] = [rootId];

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (currentId === targetId) break;

        const couplet = idMap.get(currentId);
        if (!couplet) continue;

        const edges: Array<[Branch, 'a' | 'b']> = [[couplet.branch1, 'a'], [couplet.branch2, 'b']];
        for (const [branch, choice] of edges) {
            const next = branchTarget(branch);
            if (next !== null && idMap.has(next) && !visited.has(next)) {
                visited.add(next);
                cameFrom.set(next, { parentId: currentId, choice });
                queue.push(next);
            }
        }
    }

    if (!visited.has(targetId)) return empty;

    // Walk back target→root, then reverse. Each crumb's `choice` is the edge that
    // leads to the next crumb, so it belongs to the parent — shift them down by one.
    const reverse: Array<{ id: number; choice?: 'a' | 'b' }> = [];
    let cursor: number | undefined = targetId;
    let incomingChoice: 'a' | 'b' | undefined = undefined;
    while (cursor !== undefined) {
        reverse.push({ id: cursor, choice: incomingChoice });
        const parent = cameFrom.get(cursor);
        incomingChoice = parent?.choice;
        cursor = parent?.parentId;
    }
    reverse.reverse();

    const steps: PathStep[] = reverse.map(node => ({
        id: node.id,
        stepNum: (idToIndex.get(node.id) ?? 0) + 1,
        choice: node.choice,
    }));

    return { steps, reachable: true };
}

/**
 * Runs the full real-time diagnostics pass over a key, returning issues keyed by
 * couplet id. Pure: takes the key and figure list explicitly so callers can vet
 * a candidate key (e.g. a freshly parsed import) without first loading it into
 * the store. The store's runDiagnostics() delegates here against live state.
 */
export function diagnoseKey(key: Couplet[], figures: Figure[]): Map<number, KeyValidationError[]> {
    const diagnostics = new Map<number, KeyValidationError[]>();
    if (key.length === 0) return diagnostics;

    const idMap = new Map<number, Couplet>();
    const idToIndexMap = new Map<number, number>();
    const inboundParentMap = new Map<number, Set<number>>();

    const figureIds = new Set(figures.map(f => f.id));
    const { displayNumToFig, filenameToFig } = buildFigureLookups(figures);

    const rawFigTokenResolves = (value: string): boolean => {
        const trimmed = value.trim();
        if (trimmed === '') return false;
        const n = parseInt(trimmed, 10);
        if (!isNaN(n) && String(n) === trimmed) return displayNumToFig.has(n);
        return filenameToFig.has(trimmed.toLowerCase());
    };

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

    const reachableNodes = computeReachableNodes(key, idMap);

    // Created once and reused: matchAll clones the regex per call, so the shared
    // lastIndex is never mutated across couplets.
    const FIG_ID_REGEX = figIdTokenRegex();
    const FIG_RAW_REGEX = figRawTokenRegex();

    // Collects figure-reference issues for one alternative's text: stored [figID: N]
    // tokens whose figure is gone, and raw [fig: value] tokens that don't resolve.
    const figureIssues = (text: string, label: 'A' | 'B'): KeyValidationError[] => {
        const out: KeyValidationError[] = [];
        if (!text) return out;

        const missingIds: number[] = [];
        for (const match of text.matchAll(FIG_ID_REGEX)) {
            const figId = parseInt(match[1], 10);
            if (!figureIds.has(figId) && !missingIds.includes(figId)) missingIds.push(figId);
        }
        missingIds.forEach(id => {
            out.push({ severity: 'warning', message: `Choice ${label} references a missing or deleted figure (Internal ID: ${id}).` });
        });

        const unresolved: string[] = [];
        for (const match of text.matchAll(FIG_RAW_REGEX)) {
            const token = match[1].trim();
            if (!rawFigTokenResolves(token) && !unresolved.includes(token)) unresolved.push(token);
        }
        unresolved.forEach(token => {
            out.push({ severity: 'warning', message: `Choice ${label} references an unresolved figure reference '[fig: ${token}]'.` });
        });

        return out;
    };

    key.forEach((c, index) => {
        const issues: KeyValidationError[] = [];

        if (c.branch1.kind === 'unresolved') {
            issues.push({ severity: 'error', message: `Choice A points to step '${c.branch1.couplet}' which does not exist yet.` });
        } else if (c.branch1.kind === 'empty') {
            issues.push({ severity: 'warning', message: 'Choice A is incomplete. Assign a Taxa or destination step.' });
        }

        if (c.branch2.kind === 'unresolved') {
            issues.push({ severity: 'error', message: `Choice B points to step '${c.branch2.couplet}' which does not exist yet.` });
        } else if (c.branch2.kind === 'empty') {
            issues.push({ severity: 'warning', message: 'Choice B is incomplete. Assign a Taxa or destination step.' });
        }

        // --- Unresolved Figure Reference Diagnostics ---
        issues.push(...figureIssues(c.alt1, 'A'));
        issues.push(...figureIssues(c.alt2, 'B'));

        if (index > 0 && !reachableNodes.has(c.id)) {
            issues.push({ severity: 'warning', message: 'Orphaned: This step is unreachable from Step #1.' });
        }

        // The first step is the key's entry point, so nothing should link back into it.
        // inboundParentMap only holds ids that have a parent, so its presence is the test.
        if (index === 0 && inboundParentMap.has(c.id)) {
            issues.push({ severity: 'warning', message: "Step #1 should be the key's starting point, but other steps link here." });
        }
        if (c.branch1.kind === 'linked') {
            if (c.branch1.targetId === c.id) issues.push({ severity: 'error', message: 'Choice A loops directly into its own key step.' });
            else if (!idMap.has(c.branch1.targetId)) issues.push({ severity: 'error', message: 'Choice A points to an invalid or deleted step.' });
        }
        if (c.branch2.kind === 'linked') {
            if (c.branch2.targetId === c.id) issues.push({ severity: 'error', message: 'Choice B loops directly into its own key step.' });
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

export class KeyStore {
    private state: KeyDocument;
    private hasUncommittedChanges: boolean = false;
    private editScope: string | null = null;
    private persistedTitle: string = '';
    private activeProjectUid: string = newProjectUid();
    private onProjectPersisted?: (title: string) => void;

    private undoStack: HistoryEntry[] = [];
    private redoStack: HistoryEntry[] = [];
    private readonly maxHistoryLimit: number;
    private savedDepth: number | null = 0;

    private selectedCoupletIds: Set<number> = new Set();
    private _draggedId: number | null = null;
    private activeCoupletId: number | null = null;

    // Shared clipboard state structure
    private clipboardBuffer: Couplet[] = [];
    private clipboardMode: 'copy' | 'cut' = 'copy';
    private cutIncomingLinksBuffer: CutLink[] = [];

    // Figures
    private selectedFigureIds: Set<number> = new Set();

    // Taxa
    private selectedTaxonIds: Set<number> = new Set();

    constructor(initialKey: Couplet[], initialFigures: Figure[] = [], initialTitle = 'Untitled Key', maxHistoryLimit = 100, initialTaxa: Taxon[] = []) {
        this.state = {
            title: initialTitle,
            dichotomousKey: initialKey,
            figures: initialFigures,
            taxa: initialTaxa
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

    public getTaxa(): readonly Taxon[] {
        return this.state.taxa || [];
    }

    public getSelectedCoupletIds(): ReadonlySet<number> {
        return this.selectedCoupletIds;
    }

    public setActiveCouplet(id: number | null) {
        this.activeCoupletId = id;
    }

    public getActiveCoupletId(): number | null {
        return this.activeCoupletId;
    }

    public clearActiveCouplet() {
        this.activeCoupletId = null;
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
        this.savedDepth = this.undoStack.length;
        this.hasUncommittedChanges = false;
        this.editScope = null;
    }

    public hasUnsavedChanges(): boolean {
        // Current position is just the undo-stack size; unsaved if it left the saved depth.
        return this.undoStack.length !== this.savedDepth || this.hasUncommittedChanges;
    }

    /**
    * Wipes undo/redo timelines, selections, and drag-and-drop focus profiles 
    */
    private resetTrackingContext(): void {
        this.undoStack = [];
        this.redoStack = [];
        this.savedDepth = 0;
        this.hasUncommittedChanges = false;
        this.editScope = null;
        this.selectedCoupletIds.clear();
        this.selectedFigureIds.clear();
        this.selectedTaxonIds.clear();
        this.activeCoupletId = null;
        this._draggedId = null;
    }

    // ==========================================
    // HISTORY ENGINE (Undo / Redo)
    // ==========================================
    //
    // Two stacks of frames: undoStack holds past states, redoStack holds states we
    // undid away from, and the live state sits between them. The current position is
    // simply undoStack.length. undo() and redo() only ever hand a single frame from
    // one stack to the other, so undoStack.length + redoStack.length never grows —
    // the one size cap in saveCheckpoint() suffices and undo/redo need no trimming.

    /**
     * Deep-enough clone of the editable document for a history frame. Each
     * collection in DOCUMENT_COLLECTIONS is shallow-cloned per item, so a new
     * entity type joins the timeline just by being listed there.
     */
    private captureState(): KeyDocument {
        const clone = { title: this.state.title } as KeyDocument;
        for (const key of DOCUMENT_COLLECTIONS) {
            const items = (this.state[key] || []) as ReadonlyArray<{ id: number }>;
            (clone[key] as unknown[]) = items.map(item => ({ ...item }));
        }
        return clone;
    }

    /** A history frame: current metadata paired with the current binary staging. */
    private captureHistoryEntry(): HistoryEntry {
        return { state: this.captureState(), staging: workspaceStorage.getStagingSnapshot() };
    }

    private saveCheckpoint() {
        if (this.savedDepth !== null && this.savedDepth > this.undoStack.length) {
            this.savedDepth = null;
        }
        this.redoStack = [];

        this.undoStack.push(this.captureHistoryEntry());

        // Enforce the cap by dropping the oldest frame. Every frame shifts down a slot,
        // so the saved marker follows — or is lost if that oldest frame WAS the save.
        if (this.undoStack.length > this.maxHistoryLimit) {
            this.undoStack.shift();
            if (this.savedDepth !== null) {
                this.savedDepth = this.savedDepth > 0 ? this.savedDepth - 1 : null;
            }
        }

        this.hasUncommittedChanges = false;
        this.editScope = null;
    }

    /** Reverts a pending cut back to a plain copy, dropping the severed-link buffer. */
    private discardCutBuffer(): void {
        if (this.clipboardMode === 'cut') {
            this.clipboardMode = 'copy';
            this.cutIncomingLinksBuffer = [];
        }
    }

    public undo(): boolean {
        if (this.undoStack.length === 0) return false;

        // Park the live state on the redo stack, then restore the previous frame.
        this.redoStack.push(this.captureHistoryEntry());
        const previous = this.undoStack.pop()!;
        this.state = previous.state;
        workspaceStorage.restoreStagingSnapshot(previous.staging);

        this.hasUncommittedChanges = false;
        this.editScope = null;
        this.discardCutBuffer();

        return true;
    }

    public redo(): boolean {
        if (this.redoStack.length === 0) return false;
        this.undoStack.push(this.captureHistoryEntry());
        const next = this.redoStack.pop()!;
        this.state = next.state;
        workspaceStorage.restoreStagingSnapshot(next.staging);

        this.hasUncommittedChanges = false;
        this.editScope = null;
        this.discardCutBuffer();

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

    // ==========================================
    // MUTATORS (State modifiers with history tracking)
    // ==========================================

    public endTypingSession() {
        if (!this.hasUncommittedChanges) return;
        this.hasUncommittedChanges = false;
        this.editScope = null;
    }

    public updateCouplet(id: number, fields: Partial<Omit<Couplet, 'id'>>) {
        // Open a fresh checkpoint unless we're already mid-edit on the key, so
        // couplet edits batch together but never merge with a figure edit.
        if (this.editScope !== 'key') {
            this.saveCheckpoint();
        }
        this.editScope = 'key';

        const newKey = updateEntity(this.state.dichotomousKey, id, fields);
        if (!newKey) return;
        this.state.dichotomousKey = newKey;

        this.hasUncommittedChanges = true;
    }

    public addCouplet(): number {
        this.saveCheckpoint();

        const { key, newId } = addCoupletOp(this.state.dichotomousKey);
        this.state.dichotomousKey = key;
        this.hasUncommittedChanges = true;

        return newId; // Return the new ID for UI targeting focus
    }


    /**
    * Pastes couplets from the clipboard buffer.
    */
    public pasteCouplets(targetId?: number, position: 'above' | 'below' = 'below'): boolean {
        if (this.clipboardBuffer.length === 0) return false;

        this.saveCheckpoint();

        const { key, newIds } = pasteCoupletsOp(
            this.state.dichotomousKey,
            this.clipboardBuffer,
            targetId,
            position,
            this.clipboardMode === 'cut',
            this.cutIncomingLinksBuffer
        );

        // A cut's severed links have now been consumed — revert to a plain copy.
        if (this.clipboardMode === 'cut' && this.cutIncomingLinksBuffer.length > 0) {
            this.clipboardMode = 'copy';
            this.cutIncomingLinksBuffer = [];
        }

        this.state.dichotomousKey = key;
        this.setSelectionBatch(newIds);
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

        // Remove the selected couplets, buffering any incoming links so a later
        // paste can restore them.
        const { key, severedLinks } = cutCoupletsOp(this.state.dichotomousKey, selectedIds);
        this.state.dichotomousKey = key;
        this.cutIncomingLinksBuffer = severedLinks;

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

        this.state.dichotomousKey = deleteCoupletsOp(this.state.dichotomousKey, removedIds);

        this.selectedCoupletIds = new Set();
        this.hasUncommittedChanges = true;
    }

    /**
    * Swaps alternative choices, target links, and taxa fields for all selected couplets.
    */
    public swapSelectedCouplets(): boolean {
        if (this.selectedCoupletIds.size === 0) return false;

        this.saveCheckpoint();
        const { key, modified } = swapCoupletsOp(this.state.dichotomousKey, this.selectedCoupletIds);
        this.state.dichotomousKey = key;

        if (modified) {
            this.hasUncommittedChanges = true;
            return true;
        }

        return false;
    }

    public reorderCouplets(srcId: number, targetId: number, position: 'above' | 'below' = 'above'): boolean {
        // Compute first so an invalid/no-op move skips the history checkpoint.
        const next = reorderCoupletsOp(this.state.dichotomousKey, srcId, targetId, position);
        if (next === null) return false;

        this.saveCheckpoint();
        this.state.dichotomousKey = next;
        this.hasUncommittedChanges = true;
        return true;
    }


    // Orders the key with shorter branches first, flattened into depth-first
    // reading order. See autoOrderCouplets in coupletOps.ts for the full rules.
    public autoOrderCouplets() {
        if (this.state.dichotomousKey.length === 0) return;

        this.saveCheckpoint();
        this.state.dichotomousKey = autoOrderCoupletsOp(this.state.dichotomousKey);
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
        if (multiSelect) {
            if (this.selectedFigureIds.has(id)) {
                this.selectedFigureIds.delete(id);
            } else {
                this.selectedFigureIds.add(id);
            }
        } else {
            this.selectedFigureIds = new Set([id]);
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

        this.state.figures = deleteEntities(this.state.figures, this.selectedFigureIds);

        // Clear the selection set
        this.selectedFigureIds = new Set();
        this.hasUncommittedChanges = true;
    }

    public addFigure(filename: string, caption: string): number {
        this.saveCheckpoint();

        const figures = this.state.figures || [];
        const nextId = nextEntityId(figures);

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
        // Open a fresh checkpoint unless we're already mid-edit on figures, so
        // figure edits batch together but never merge with a couplet edit.
        if (this.editScope !== 'figures') {
            this.saveCheckpoint();
        }
        this.editScope = 'figures';

        const newFigures = updateEntity(this.state.figures, id, fields);
        if (!newFigures) return;
        this.state.figures = newFigures;

        this.hasUncommittedChanges = true;
    }

    public reorderFigures(srcIdx: number, targetIdx: number) {
        if (!this.state.figures || srcIdx === targetIdx) return;
        this.saveCheckpoint();

        this.state.figures = reorderEntity(this.state.figures, srcIdx, targetIdx);
        this.hasUncommittedChanges = true;
    }

    public autoOrderFigures(): void {
        const figures = this.state.figures || [];
        if (figures.length === 0 || this.state.dichotomousKey.length === 0) return;

        // Create a history checkpoint before mutating state
        this.saveCheckpoint();

        this.state.figures = orderFiguresByReference(figures, this.state.dichotomousKey);
        this.hasUncommittedChanges = true;
    }

    /* taxa mutators */

    // ==========================================
    // TAXA SELECTION & MUTATORS
    // ==========================================

    public getSelectedTaxonIds(): ReadonlySet<number> {
        return this.selectedTaxonIds;
    }

    /** Toggles a taxon's selection; multiSelect adds/removes, otherwise selects only it. */
    public toggleTaxonSelection(id: number, multiSelect: boolean) {
        if (multiSelect) {
            if (this.selectedTaxonIds.has(id)) {
                this.selectedTaxonIds.delete(id);
            } else {
                this.selectedTaxonIds.add(id);
            }
        } else {
            this.selectedTaxonIds = new Set([id]);
        }
    }

    public clearTaxonSelection() {
        this.selectedTaxonIds.clear();
    }

    /** Deletes selected taxa and severs any branch that pointed at one of them. */
    public deleteSelectedTaxa() {
        if (this.selectedTaxonIds.size === 0) return;
        this.saveCheckpoint();

        const removedIds = this.selectedTaxonIds;
        this.state.taxa = deleteEntities(this.state.taxa, removedIds);
        this.state.dichotomousKey = deleteTaxaAndSever(this.state.dichotomousKey, removedIds).key;

        this.selectedTaxonIds = new Set();
        this.hasUncommittedChanges = true;
    }

    public addTaxon(scientificName = ''): number {
        this.saveCheckpoint();

        const taxa = this.state.taxa || [];
        const nextId = nextEntityId(taxa);
        this.state.taxa = [...taxa, createTaxon(nextId, scientificName)];

        this.hasUncommittedChanges = true;
        return nextId;
    }

    public updateTaxon(id: number, fields: Partial<Omit<Taxon, 'id'>>) {
        // Batch consecutive taxon edits, but never merge with a couplet/figure edit.
        if (this.editScope !== 'taxa') {
            this.saveCheckpoint();
        }
        this.editScope = 'taxa';

        const next = updateEntity(this.state.taxa, id, fields);
        if (!next) return;
        this.state.taxa = next;

        this.hasUncommittedChanges = true;
    }

    public reorderTaxa(srcIdx: number, targetIdx: number) {
        if (!this.state.taxa || srcIdx === targetIdx) return;
        this.saveCheckpoint();

        this.state.taxa = reorderEntity(this.state.taxa, srcIdx, targetIdx);
        this.hasUncommittedChanges = true;
    }

    /**
     * Explicitly turns one lead's unlinked taxon draft into a real record and links
     * the branch to it (find-or-create by scientific name, so it reuses a match made
     * since the draft was typed). Returns the taxon id, or null when the branch isn't
     * a draft. This is the deliberate "create taxon" action from the editor.
     */
    public createTaxonForBranch(coupletId: number, field: 'branch1' | 'branch2'): number | null {
        const couplet = this.state.dichotomousKey.find(c => c.id === coupletId);
        if (!couplet) return null;

        const branch = couplet[field];
        if (branch.kind !== 'taxonDraft') return null;

        this.saveCheckpoint();

        const existing = findTaxonByName(this.state.taxa, branch.name);
        let taxonId: number;
        if (existing) {
            taxonId = existing.id;
        } else {
            taxonId = nextEntityId(this.state.taxa);
            this.state.taxa = [...this.state.taxa, createTaxon(taxonId, branch.name)];
        }

        this.state.dichotomousKey = updateEntity(this.state.dichotomousKey, coupletId, {
            [field]: { kind: 'taxon', taxonId },
        } as Partial<Omit<Couplet, 'id'>>) ?? this.state.dichotomousKey;

        this.hasUncommittedChanges = true;
        return taxonId;
    }

    public importJsonData(rawData: unknown): ImportResult {
        try {
            let importedKey: Couplet[] | null = null;
            let importedFigures: Figure[] = [];
            let importedTaxa: Taxon[] = [];
            let importedTitle = 'Untitled Key';

            if (isRecord(rawData) && isRecord(rawData.data)) {
                const payload = rawData.data;

                if (isValidCoupletArray(payload.key)) {
                    importedKey = payload.key;

                    if (isValidFigureArray(payload.figures)) {
                        importedFigures = payload.figures;
                    }

                    // Taxa are taken as-is; migrateLegacyTaxa below reconciles them
                    // with the key (and folds any legacy name-string branches).
                    if (Array.isArray(payload.taxa)) {
                        importedTaxa = payload.taxa as Taxon[];
                    }
                }

                // Extract project title if declared inside native file format
                if (typeof payload.title === 'string') {
                    importedTitle = payload.title;
                } else if (typeof rawData.title === 'string') {
                    importedTitle = rawData.title;
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

            // Normalize legacy name-string taxon branches, then (bulk import) commit
            // any drafts into records — an import is a deliberate bulk creation.
            const migrated = migrateLegacyTaxa(importedKey, importedTaxa);
            const resolved = resolveDrafts(migrated.key, migrated.taxa);

            this.saveCheckpoint();
            this.state.title = importedTitle;
            this.activeProjectUid = newProjectUid();
            this.persistedTitle = importedTitle;
            this.state.dichotomousKey = resolved.key;
            this.state.figures = importedFigures;
            this.state.taxa = resolved.taxa;

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

    public setProjectPersistedListener(cb: (title: string) => void): void {
        this.onProjectPersisted = cb;
    }

    private commitPersistedTitle(title: string): void {
        this.persistedTitle = title;
        this.onProjectPersisted?.(title);   // <- the single place the pointer updates
    }

    public async createNewProject(title: string): Promise<void> {
        this.state.title = title;
        this.activeProjectUid = newProjectUid(); // Fresh identity for a fresh project
        this.commitPersistedTitle(title); // Sync the disk tracking name
        this.state.dichotomousKey = [];
        this.state.figures = [];
        this.state.taxa = [];
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
            // Normalize any legacy name-string taxon branches into records on load.
            const migrated = migrateLegacyTaxa(data.dichotomousKey, data.taxa);
            this.state.dichotomousKey = migrated.key;
            this.state.taxa = migrated.taxa;
            this.state.figures = data.figures;
            this.resetTrackingContext();

            return true;
        }
        return false;
    }

    /** The persistable collections of the live document (one object so new entity
     *  types flow to storage without changing saveProject's signature). */
    private getProjectData(): ProjectData {
        return {
            dichotomousKey: this.state.dichotomousKey,
            figures: this.state.figures,
            taxa: this.state.taxa,
        };
    }

    public async saveToStorage(): Promise<void> {
        const isRename = this.persistedTitle && this.persistedTitle !== this.state.title;
        const oldTitle = this.persistedTitle;

        try {

            await workspaceStorage.saveProject(this.state.title, this.activeProjectUid, this.getProjectData());

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

            await workspaceStorage.saveProject(newTitle, newUid, this.getProjectData());

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

    public async loadFromStorage(fallbackData: Couplet[] = [], fallbackFigures: Figure[] = [], lastActiveTitle = 'Untitled Key', fallbackTaxa: Taxon[] = []): Promise<boolean> {
        const lastActive = lastActiveTitle;
        const success = await this.loadProject(lastActive);

        if (!success) {
            // The fallback is seed data: migrate legacy branches and bulk-create any
            // draft taxa so the sample opens with real, linked taxon cards.
            const migrated = migrateLegacyTaxa(fallbackData, fallbackTaxa);
            const resolved = resolveDrafts(migrated.key, migrated.taxa);
            this.state = {
                title: lastActive,
                dichotomousKey: resolved.key,
                figures: fallbackFigures,
                taxa: resolved.taxa
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


    public setSelectionBatch(coupletIds: number[] | Set<number>): void {
        this.selectedCoupletIds = new Set(coupletIds);
    }

    public selectAll() {
        this.selectedCoupletIds = new Set(this.state.dichotomousKey.map(c => c.id));
    }

    // ==========================================
    // REAL-TIME DIAGNOSTICS ENGINE
    // ==========================================

    public runDiagnostics(): Map<number, KeyValidationError[]> {
        return diagnoseKey(this.state.dichotomousKey, this.state.figures);
    }

    // Figure-token helpers — thin wrappers over the pure functions in figureRefs.ts,
    // bound to the live figure list. See that module for the token-form details.

    public resolveTextReferences(text: string, idToDisplayNum: Map<number, number>): string {
        return resolveTextReferences(text, this.state.figures, idToDisplayNum);
    }

    public encodeFigureTokens(text: string): string {
        return encodeFigureTokens(text, this.state.figures);
    }

    public decodeTextReferencesForEditor(text: string): string {
        return decodeTextReferencesForEditor(text, this.state.figures);
    }
}