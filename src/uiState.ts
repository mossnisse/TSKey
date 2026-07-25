// uiState.ts
// Manages persistent UI preferences, separate from key data in KeyStore.
// Panel visibility and other display settings survive page reloads via localStorage.

import { DEFAULT_LEAD_FORMAT, isLeadFormat, DEFAULT_NAME_DISPLAY_MODE, isNameDisplayMode } from './utils.ts';
import type { LeadFormat, NameDisplayMode } from './utils.ts';
import { ChangeEmitter } from './changeEmitter.ts';
import type { ChangeListener } from './changeEmitter.ts';

export const UI_STATE_STORAGE_KEY = 'dichotomous_key_ui';

/** The main-layout columns that can be collapsed to a rotated header. */
export type PanelKey = 'editor' | 'figures' | 'taxa' | 'print';

export interface UIPanelState {
    isFiguresHidden: boolean;
    isPrintHidden: boolean;
    isImagesHidden: boolean;
    isTaxaHidden: boolean;
    collapsedPanels: Record<PanelKey, boolean>;
    activeProjectTitle: string;
    leadFormat: LeadFormat;
    showBackReference: boolean;
    nameDisplayMode: NameDisplayMode;
}

const DEFAULTS: UIPanelState = {
    isFiguresHidden: false,
    isPrintHidden: false,
    isImagesHidden: false,
    isTaxaHidden: false,
    collapsedPanels: { editor: false, figures: false, taxa: false, print: false },
    activeProjectTitle: 'Untitled Key',
    leadFormat: DEFAULT_LEAD_FORMAT,
    showBackReference: false,
    nameDisplayMode: DEFAULT_NAME_DISPLAY_MODE,
};

/**
 * Encapsulates the tracking, boundaries, and debounce timers of a specific text entry workflow.
 */
export class TypingSession {
    private active = false;
    private fieldKey: string | null = null;
    private timeoutId: number | null = null;

    public isActive(): boolean {
        return this.active;
    }

    public getFieldKey(): string | null {
        return this.fieldKey;
    }

    /**
     * Commits previous snapshots and initiates a new editing context if field focus shifts.
     */
    public start(fieldKey: string, onStart: () => void): void {
        if (!this.active || this.fieldKey !== fieldKey) {
            this.clearTimer();      // <-- never inherit the previous field's timer
            onStart();
            this.active = true;
            this.fieldKey = fieldKey;
        }
    }

    /**
     * Extends or resets the current input debounce window.
     */
    public extendTimeout(debounceMs: number, onTimeout: () => void): void {
        this.clearTimer();
        this.timeoutId = window.setTimeout(() => {
            this.timeoutId = null;
            this.active = false;
            this.fieldKey = null;   // <-- keep active/fieldKey in lockstep
            onTimeout();
        }, debounceMs);
    }

    /**
     * Instantly purges active debouncing timers.
     */
    public clearTimer(): void {
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    /**
     * Concludes the session if the focus matches the ending field context.
     */
    public end(fieldKey: string | null, onEnd: () => void): boolean {
        if (!this.active && this.fieldKey === null) return false;

        if (fieldKey === null || this.fieldKey === fieldKey) {
            this.active = false;
            this.fieldKey = null;
            this.clearTimer();
            onEnd();
            return true;
        }
        return false;
    }
}

/**
 * Organizes independent typing lifecycles across different structural elements.
 */
export class TypingSessionManager {
    public readonly couplets = new TypingSession();
    public readonly figures = new TypingSession();
    public readonly taxa = new TypingSession();

    /** Purges every panel's pending debounce timer, e.g. before undo/redo. */
    public clearAll(): void {
        this.couplets.clearTimer();
        this.figures.clearTimer();
        this.taxa.clearTimer();
    }
}

export class UIStateStore {
    private state: UIPanelState;
    // Centralized access point for typing flows passed implicitly into event structures
    public readonly typing = new TypingSessionManager();

    // Taxa-panel view state. Deliberately NOT part of UIPanelState, so it is never
    // persisted: the roster is meant to open compact and unfiltered every session.
    // A restored filter would look like missing taxa, and restored expansions would
    // defeat the collapsed default. Stale ids left by deleted taxa are harmless:
    // nothing looks them up once the record is gone, and ids are issued as max+1, so
    // the one id that can come back (delete the newest, then add) lands on a card the
    // add flow expands anyway.
    private expandedTaxonIds = new Set<number>();
    private taxaFilter = '';

    private readonly changes = new ChangeEmitter();

    constructor() {
        this.state = this.loadFromStorage();
    }

    /** Subscribes to preference/view-state changes; the returned function unsubscribes. */
    public subscribe(listener: ChangeListener): () => void {
        return this.changes.subscribe(listener);
    }

    // ==========================================
    // GETTERS
    // ==========================================

    get isFiguresHidden(): boolean {
        return this.state.isFiguresHidden;
    }

    get isImagesHidden(): boolean {
        return this.state.isImagesHidden;
    }

    get isTaxaHidden(): boolean {
        return this.state.isTaxaHidden;
    }

    get nameDisplayMode(): NameDisplayMode {
        return this.state.nameDisplayMode;
    }

    get isPrintHidden(): boolean {
        return this.state.isPrintHidden;
    }

    public isPanelCollapsed(panel: PanelKey): boolean {
        return this.state.collapsedPanels[panel] ?? false;
    }

    get activeProjectTitle(): string {
        return this.state.activeProjectTitle || 'Untitled Key';
    }

    get leadFormat(): LeadFormat {
        return this.state.leadFormat;
    }

    get taxaFilterQuery(): string {
        return this.taxaFilter;
    }

    public isTaxonExpanded(id: number): boolean {
        return this.expandedTaxonIds.has(id);
    }

    get showBackReference(): boolean {
        return this.state.showBackReference;
    }

    // ==========================================
    // MUTATORS
    // ==========================================

    public setActiveProjectTitle(title: string): void {
        this.state = { ...this.state, activeProjectTitle: title.trim() };
        this.commit();
    }

    public toggleFigures(): void {
        this.state = { ...this.state, isFiguresHidden: !this.state.isFiguresHidden };
        this.commit();
    }

    public togglePrint(): void {
        this.state = { ...this.state, isPrintHidden: !this.state.isPrintHidden };
        this.commit();
    }

    public toggleImages(): void {
        this.state = { ...this.state, isImagesHidden: !this.state.isImagesHidden };
        this.commit();
    }

    public toggleTaxa(): void {
        this.state = { ...this.state, isTaxaHidden: !this.state.isTaxaHidden };
        this.commit();
    }

    public togglePanelCollapse(panel: PanelKey): void {
        const collapsed = !(this.state.collapsedPanels[panel] ?? false);
        this.state = {
            ...this.state,
            collapsedPanels: { ...this.state.collapsedPanels, [panel]: collapsed },
        };
        this.commit();
    }

    public setNameDisplayMode(mode: NameDisplayMode): void {
        if (!isNameDisplayMode(mode) || this.state.nameDisplayMode === mode) return;
        this.state = { ...this.state, nameDisplayMode: mode };
        this.commit();
    }

    public setLeadFormat(format: LeadFormat): void {
        if (!isLeadFormat(format) || this.state.leadFormat === format) return;
        this.state = { ...this.state, leadFormat: format };
        this.commit();
    }

    /** Sets the taxa roster filter. Not persisted (see expandedTaxonIds), but still
     *  announced — the roster has to re-render to apply it. */
    public setTaxaFilter(query: string): void {
        if (this.taxaFilter === query) return;
        this.taxaFilter = query;
        this.changes.emit('structural');
    }

    public setTaxonExpanded(id: number, expanded: boolean): void {
        if (expanded) this.expandedTaxonIds.add(id);
        else this.expandedTaxonIds.delete(id);
        this.changes.emit('structural');
    }

    public toggleTaxonExpanded(id: number): void {
        this.setTaxonExpanded(id, !this.expandedTaxonIds.has(id));
    }

    public setShowBackReference(value: boolean): void {
        if (this.state.showBackReference === value) return;
        this.state = { ...this.state, showBackReference: value };
        this.commit();
    }

    // ==========================================
    // PERSISTENCE
    // ==========================================

    private loadFromStorage(): UIPanelState {
        try {
            const raw = localStorage.getItem(UI_STATE_STORAGE_KEY);
            if (!raw) return { ...DEFAULTS };
            const parsed = JSON.parse(raw);
            const merged: UIPanelState = { ...DEFAULTS, ...parsed };
            // Nested record needs its own merge so a partial persisted value from an
            // older build keeps the defaults for any newly added panel keys.
            merged.collapsedPanels = { ...DEFAULTS.collapsedPanels, ...(parsed.collapsedPanels ?? {}) };
            // Guard against stale/invalid persisted values from an older build.
            if (!isLeadFormat(merged.leadFormat)) merged.leadFormat = DEFAULT_LEAD_FORMAT;
            if (!isNameDisplayMode(merged.nameDisplayMode)) merged.nameDisplayMode = DEFAULT_NAME_DISPLAY_MODE;
            return merged;
        } catch {
            return { ...DEFAULTS };
        }
    }

    /** Writes the preferences to localStorage and announces the change, so every
     *  mutator that ends here refreshes the UI without its caller arranging it. */
    private commit(): void {
        this.changes.emit('structural');
        try {
            localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(this.state));
        } catch (error) {
            console.warn('UIStateStore: Failed to persist UI preferences to localStorage.', error);
        }
    }
}