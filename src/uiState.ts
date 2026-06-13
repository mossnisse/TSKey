// uiState.ts
// Manages persistent UI preferences, separate from key data in KeyStore.
// Panel visibility and other display settings survive page reloads via localStorage.

export const UI_STATE_STORAGE_KEY = 'dichotomous_key_ui';

export interface UIPanelState {
    isFiguresHidden: boolean;
    isPrintHidden: boolean;
}

const DEFAULTS: UIPanelState = {
    isFiguresHidden: false,
    isPrintHidden: false,
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
            this.active = false;
            this.timeoutId = null;
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
        if (this.fieldKey !== null && fieldKey !== null && this.fieldKey === fieldKey) {
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
}

export class UIStateStore {
    private state: UIPanelState;
    // Centralized access point for typing flows passed implicitly into event structures
    public readonly typing = new TypingSessionManager();

    constructor() {
        this.state = this.loadFromStorage();
    }

    // ==========================================
    // GETTERS
    // ==========================================

    get isFiguresHidden(): boolean {
        return this.state.isFiguresHidden;
    }

    get isPrintHidden(): boolean {
        return this.state.isPrintHidden;
    }

    // ==========================================
    // MUTATORS
    // ==========================================

    public toggleFigures(): void {
        this.state = { ...this.state, isFiguresHidden: !this.state.isFiguresHidden };
        this.persist();
    }

    public togglePrint(): void {
        this.state = { ...this.state, isPrintHidden: !this.state.isPrintHidden };
        this.persist();
    }

    // ==========================================
    // PERSISTENCE
    // ==========================================

    private loadFromStorage(): UIPanelState {
        try {
            const raw = localStorage.getItem(UI_STATE_STORAGE_KEY);
            if (!raw) return { ...DEFAULTS };
            // Spread DEFAULTS first so new fields added in future versions don't break old saves
            return { ...DEFAULTS, ...JSON.parse(raw) };
        } catch {
            return { ...DEFAULTS };
        }
    }

    private persist(): void {
        try {
            localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(this.state));
        } catch (error) {
            console.warn('UIStateStore: Failed to persist UI preferences to localStorage.', error);
        }
    }
}