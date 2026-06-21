// ui/shared.ts
// Small render helper shared by the editor-card and menu renderers.

/** Patches a field's value without clobbering an in-progress edit (skips the focused element). */
export function syncField(parent: HTMLElement, selector: string, value: string, forceUpdate = false): HTMLInputElement | HTMLTextAreaElement | null {
    const el = parent.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    if (!el) return null;

    if ((forceUpdate || document.activeElement !== el) && el.value !== value) {
        el.value = value;
    }
    return el;
}
