// store/selection.ts
// A set of selected entity ids with the shared toggle/replace/clear behaviour used
// by every panel (couplets, figures, taxa, and future entity types). Extracted so
// the store holds one Selection per collection instead of three duplicated Sets.

export class Selection {
    private ids = new Set<number>();

    /** The live selection set (read-only view; the store returns this to callers). */
    get(): ReadonlySet<number> {
        return this.ids;
    }

    has(id: number): boolean {
        return this.ids.has(id);
    }

    get size(): number {
        return this.ids.size;
    }

    /** Ctrl/Cmd/Shift toggles the id in place; a plain click selects only it. */
    toggle(id: number, multiSelect: boolean): void {
        if (multiSelect) {
            if (this.ids.has(id)) this.ids.delete(id);
            else this.ids.add(id);
        } else {
            this.ids = new Set([id]);
        }
    }

    /** Replaces the whole selection (e.g. select-all, or selecting a pasted batch). */
    replace(ids: Iterable<number>): void {
        this.ids = new Set(ids);
    }

    clear(): void {
        this.ids.clear();
    }
}
