// events/navigationEvents.ts
// Ctrl/Cmd+click jump-to-target navigation and the right-click path context menu,
// plus the small DOM helpers (flash highlight, caret hit-test) that back them.
import type { KeyStore, Couplet } from '../store';
import { computePathFromRoot } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { batchedRefresh } from './shared.ts';
import { openPopover } from '../popover.ts';
import type { PopoverItem } from '../popover.ts';
import { branchTarget, buildIdToIndexMap, escapeHTML, buildFigureIdToDisplayNumMap } from '../utils.ts';
import { buildFigureLookups, figIdTokenRegex, figRawTokenRegex } from '../figureTokens.ts';
import { workspaceStorage, activeObjectURLs } from '../store';

/** Re-triggers the "flash" highlight animation on an element (used after a jump). */
function flashHighlight(el: HTMLElement): void {
    el.classList.remove('nav-flash');
    void el.offsetWidth; // force reflow so the animation restarts
    el.classList.add('nav-flash');

    const cleanup = () => el.classList.remove('nav-flash');
    el.addEventListener('animationend', cleanup, { once: true });
    window.setTimeout(cleanup, 1200);
}

/** Scrolls the element matching `selector` into view and flashes it; false if not found. */
export function scrollIntoViewAndFlash(selector: string): boolean {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flashHighlight(el);
    return true;
}

/** Finds the figure-reference token (raw or stored) under a textarea caret position. */
function figureTokenAtIndex(
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

/** Scrolls the editor card for a step into view and flashes it. */
function jumpToStep(stepId: number): boolean {
    return scrollIntoViewAndFlash(`.key-card[data-id="${stepId}"]`);
}

/** Resolves an editor figure-token value (display number or filename) to a figure id. */
function resolveEditorFigToken(value: string, store: KeyStore): number | null {
    const { displayNumToFig, filenameToFig } = buildFigureLookups(store.getFigures());
    const num = parseInt(value, 10);
    if (!isNaN(num) && String(num) === value) {
        return displayNumToFig.get(num)?.id ?? null;
    }
    return filenameToFig.get(value.toLowerCase())?.id ?? null;
}

/** Scrolls+flashes the figure card; falls back to a preview popup when the panel is hidden. */
async function navigateToFigure(figId: number, store: KeyStore, uiState: UIStateStore, x: number, y: number, signal: AbortSignal): Promise<void> {
    if (!uiState.isFiguresHidden && scrollIntoViewAndFlash(`.figure-card[data-id="${figId}"]`)) {
        return;
    }

    const figures = store.getFigures();
    const index = figures.findIndex(f => f.id === figId);
    if (index === -1) return;
    const fig = figures[index];
    const displayNum = index + 1;

    let url = activeObjectURLs.get(figId) ?? null;
    let createdUrl: string | null = null;
    if (!url) {
        const blob = await workspaceStorage.getFigureBinary(store.getActiveProjectUid(), figId);
        if (blob) { url = URL.createObjectURL(blob); createdUrl = url; }
    }

    const imgHtml = url
        ? `<img class="popover-fig-img" src="${url}" alt="${escapeHTML(fig.filename || `Figure ${displayNum}`)}" />`
        : `<div class="popover-note">No image uploaded for this figure.</div>`;
    const caption = escapeHTML(fig.caption || fig.filename || 'Untitled figure');
    const headerHtml = `<div class="popover-fig-title">Fig. ${displayNum}</div>${imgHtml}<div class="popover-fig-caption">${caption}</div>`;

    openPopover({
        x, y, headerHtml, items: [], signal,
        onClose: () => { if (createdUrl) URL.revokeObjectURL(createdUrl); },
    });
}

/**
 * Ctrl/Cmd+click to jump: a step destination (editor or publication view) scrolls to
 * its target step; a figure reference scrolls to / previews that figure. Runs in the
 * capture phase so a handled click is stopped before the selection handler sees it;
 * unhandled modified clicks fall through to normal behaviour.
 */
export function setupNavigationClicks(store: KeyStore, uiState: UIStateStore, signal: AbortSignal) {
    document.addEventListener('click', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        const target = e.target as HTMLElement;
        const handled = () => { e.preventDefault(); e.stopPropagation(); };

        // 0. Inbound-link badge ("← 1b") → jump back to that parent step.
        const badgeLink = target.closest<HTMLElement>('.badge-link[data-step-id]');
        if (badgeLink) {
            handled();
            jumpToStep(Number(badgeLink.getAttribute('data-step-id')));
            return;
        }

        // 1. Figure citation span in the publication view.
        const figRef = target.closest<HTMLElement>('.fig-ref[data-fig-id]');
        if (figRef) {
            handled();
            navigateToFigure(Number(figRef.getAttribute('data-fig-id')), store, uiState, e.clientX, e.clientY, signal);
            return;
        }

        const coupletAt = (el: Element | null): Couplet | undefined =>
            el ? store.getKey().find(c => c.id === Number(el.getAttribute('data-id'))) : undefined;

        // 2. Editor destination input → its linked step.
        const dest = target.closest<HTMLElement>('.input-destination');
        if (dest) {
            const couplet = coupletAt(dest.closest('.key-card'));
            const branch = couplet && (dest.dataset.field === 'dest1' ? couplet.branch1 : couplet.branch2);
            const t = branch ? branchTarget(branch) : null;
            if (t !== null) { handled(); jumpToStep(t); }
            return;
        }

        // 3. Publication-view destination (step number) → its linked step.
        const printDest = target.closest<HTMLElement>('.print-dest');
        if (printDest) {
            const row = printDest.closest('.print-row');
            const couplet = coupletAt(printDest.closest('.print-step-block'));
            const branch = couplet && row && (row.getAttribute('data-choice') === '1' ? couplet.branch1 : couplet.branch2);
            const t = branch ? branchTarget(branch) : null;
            if (t !== null) { handled(); jumpToStep(t); }
            return;
        }

        // 4. Editor textarea: a [fig: N] token under the caret.
        if (target instanceof HTMLTextAreaElement && target.classList.contains('card-textarea')) {
            const token = figureTokenAtIndex(target.value, target.selectionStart ?? -1);
            if (token) {
                const figId = resolveEditorFigToken(token.value, store);
                if (figId !== null) {
                    handled();
                    navigateToFigure(figId, store, uiState, e.clientX, e.clientY, signal);
                }
            }
        }
    }, { signal, capture: true });
}

/**
 * Right-click a step (in the editor or the publication view) to open a menu showing
 * the path of alternatives from the root, each row labelled with the chosen
 * alternative's text, plus jump actions.
 */
export function setupContextMenu(store: KeyStore, refreshAll: () => void, signal: AbortSignal) {
    document.addEventListener('contextmenu', (e) => {
        const target = e.target as HTMLElement;
        // Keep the native context menu inside editable fields.
        if (target.closest('input, textarea')) return;

        const host = target.closest('.key-card') || target.closest('.print-step-block');
        if (!host) return;

        const id = Number(host.getAttribute('data-id'));
        if (!Number.isFinite(id)) return;

        e.preventDefault();

        const key = store.getKey();
        const path = computePathFromRoot(key, id);
        const stepNum = (buildIdToIndexMap(key).get(id) ?? 0) + 1;

        let headerHtml: string;
        if (!path.reachable) {
            headerHtml = `<div class="popover-note">Step ${stepNum} is unreachable from step 1.</div>`;
        } else {
            // Show each step on the route with the actual text of the alternative taken
            // (alt1 for choice 'a', alt2 for 'b'); the last row is the step itself.
            const idToDisplay = buildFigureIdToDisplayNumMap(store.getFigures());
            const rows = path.steps.map(s => {
                const numLabel = `${s.stepNum}${s.choice ?? ''}`;
                if (s.choice === undefined) {
                    return `<div class="popover-path-row is-target"><span class="popover-path-num">${numLabel}</span><span class="popover-path-text">(this step)</span></div>`;
                }
                const couplet = key.find(c => c.id === s.id);
                const raw = couplet ? (s.choice === 'a' ? couplet.alt1 : couplet.alt2) : '';
                const text = store.resolveTextReferences(raw, idToDisplay).trim() || '(no description)';
                return `<button type="button" class="popover-path-row" data-step-id="${s.id}">`
                    + `<span class="popover-path-num">${escapeHTML(numLabel)}</span>`
                    + `<span class="popover-path-text">${escapeHTML(text)}</span></button>`;
            }).join('');
            headerHtml = `<div class="popover-path">${rows}</div>`;
        }

        const items: PopoverItem[] = [
            { label: `Go to step ${stepNum}`, onSelect: () => jumpToStep(id) },
        ];
        if (path.reachable && path.steps.length > 1) {
            items.push({
                label: 'Select whole path',
                onSelect: () => {
                    store.setSelectionBatch(path.steps.map(s => s.id));
                    batchedRefresh(refreshAll);
                },
            });
        }

        openPopover({
            x: e.clientX,
            y: e.clientY,
            headerHtml,
            items,
            onCrumbSelect: (stepId) => jumpToStep(stepId),
            signal,
        });
    }, { signal });
}