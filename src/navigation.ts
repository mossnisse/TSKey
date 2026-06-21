// navigation.ts
// Small DOM helpers shared by the Ctrl/Cmd+click jump and the context-menu jumps:
// a re-triggerable "flash" highlight, scroll-into-view + flash, and a caret hit-test
// that finds the figure-reference token under a textarea caret.

import { figRawTokenRegex, figIdTokenRegex } from './figureTokens.ts';

export function flashHighlight(el: HTMLElement): void {
    el.classList.remove('nav-flash');
    void el.offsetWidth; // force reflow so the animation restarts
    el.classList.add('nav-flash');

    const cleanup = () => el.classList.remove('nav-flash');
    el.addEventListener('animationend', cleanup, { once: true });
    window.setTimeout(cleanup, 1200);
}

export function scrollIntoViewAndFlash(selector: string): boolean {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flashHighlight(el);
    return true;
}

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