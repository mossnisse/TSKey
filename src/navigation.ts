// navigation.ts
// Small DOM helpers shared by the Ctrl/Cmd+click jump and the context-menu jumps:
// a re-triggerable "flash" highlight, scroll-into-view + flash, and a caret hit-test
// that finds the figure-reference token under a textarea caret.

import { figRawTokenRegex, figIdTokenRegex } from './figureTokens.ts';

/**
 * Briefly flashes an element by (re)applying the `nav-flash` class. Removing and
 * forcing a reflow before re-adding lets the same element flash again on repeat
 * jumps. Cleaned up on animationend, with a timeout fallback in case the node is
 * replaced by the reconciler before the animation finishes.
 */
export function flashHighlight(el: HTMLElement): void {
    el.classList.remove('nav-flash');
    void el.offsetWidth; // force reflow so the animation restarts
    el.classList.add('nav-flash');

    const cleanup = () => el.classList.remove('nav-flash');
    el.addEventListener('animationend', cleanup, { once: true });
    window.setTimeout(cleanup, 1200);
}

/**
 * Scrolls the first element matching `selector` into view and flashes it.
 * Returns false when nothing matches (caller can fall back, e.g. a figure popup).
 */
export function scrollIntoViewAndFlash(selector: string): boolean {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flashHighlight(el);
    return true;
}

/**
 * Returns the figure-reference token (`[fig: N]` or `[figID: N]`) whose span
 * contains `index` (the caret), or null. The interval is inclusive at both ends
 * so clicking on either bracket still counts. `value` is the inner reference
 * (a display number or filename), trimmed.
 */
export function figureTokenAtIndex(
    text: string,
    index: number
): { start: number; end: number; value: string } | null {
    for (const re of [figRawTokenRegex(), figIdTokenRegex()]) {
        let match: RegExpExecArray | null;
        while ((match = re.exec(text)) !== null) {
            const start = match.index;
            const end = match.index + match[0].length;
            if (index >= start && index <= end) {
                return { start, end, value: match[1].trim() };
            }
        }
    }
    return null;
}