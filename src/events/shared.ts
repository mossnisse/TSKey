// events/shared.ts
// Cross-cutting helpers shared by the event modules.
import type { KeyStore } from '../store.ts';
import { workspaceStorage } from '../db.ts';
import { renderProjectHubList } from '../uiRenderer.ts';

export const DEBOUNCE_TYPING_MS = 800;
export const AUTO_SCROLL_THRESHOLD_PX = 80;
export const AUTO_SCROLL_SPEED_PX = 15;

let refreshScheduled = false;

/** Coalesces event-driven refresh requests into at most one per animation frame. */
export function batchedRefresh(refreshFn: () => void) {
    if (refreshScheduled) return;
    refreshScheduled = true;

    requestAnimationFrame(() => {
        refreshScheduled = false;
        refreshFn();
    });
}

/** Refreshes and populates rows inside the workspace project selector hub. */
export async function refreshHubView(store: KeyStore) {
    const currentTitle = store.getTitle();
    const projects = await workspaceStorage.getProjectList();
    renderProjectHubList(projects, currentTitle);
}

export interface CardDragReorderOptions {
    /** The scrollable list element that owns the draggable cards. */
    container: HTMLElement;
    /** Selector identifying a card within the container (cards carry a numeric data-id). */
    cardSelector: string;
    /** Reads the id of the card currently being dragged, or null when idle. */
    getDraggedId: () => number | null;
    /** Stores (or clears, on null) the id of the card being dragged. */
    setDraggedId: (id: number | null) => void;
    /** Commits a completed drop of `draggedId` relative to `targetId`. */
    onDrop: (draggedId: number, targetId: number, position: 'above' | 'below') => void;
    signal: AbortSignal;
}

/**
 * HTML5 drag-and-drop reordering shared by the couplet and figure card lists.
 * Handles the above/below drop markers, edge auto-scroll, and the drag lifecycle;
 * callers supply only how the dragged id is stored and what a committed drop does.
 */
export function setupCardDragReorder(opts: CardDragReorderOptions): void {
    const { container, cardSelector, getDraggedId, setDraggedId, onDrop, signal } = opts;

    let activeDropCard: HTMLElement | null = null;
    let activeDropClass: 'drag-drop-above' | 'drag-drop-below' | null = null;
    let activeDropRect: DOMRect | null = null;   // Cached bounding metrics to prevent layout thrashing
    let cachedScrollY = 0;

    const clearDropMarkers = () => {
        if (activeDropCard) {
            activeDropCard.classList.remove('drag-drop-above', 'drag-drop-below');
            activeDropCard = null;
            activeDropClass = null;
            activeDropRect = null;
        }
    };

    const updateTargetTrackers = (clientY: number, cardEl: HTMLElement) => {
        const actualCard = cardEl.closest(cardSelector) as HTMLElement | null;
        if (!actualCard) {
            clearDropMarkers();
            return;
        }

        const currentScrollY = container.scrollTop;
        if (activeDropCard !== actualCard || !activeDropRect || cachedScrollY !== currentScrollY) {
            activeDropRect = actualCard.getBoundingClientRect();
            cachedScrollY = currentScrollY;
        }

        const relativeMouseY = clientY - activeDropRect.top;
        const currentClass = relativeMouseY < activeDropRect.height / 2 ? 'drag-drop-above' : 'drag-drop-below';

        if (activeDropCard !== actualCard || activeDropClass !== currentClass) {
            const rectToPreserve = activeDropRect;
            clearDropMarkers();
            actualCard.classList.add(currentClass);
            activeDropCard = actualCard;
            activeDropClass = currentClass;
            activeDropRect = rectToPreserve;
        }
    };

    container.addEventListener('dragstart', (e) => {
        const card = (e.target as HTMLElement).closest(cardSelector) as HTMLElement | null;
        if (!card) return;
        setDraggedId(Number(card.getAttribute('data-id')));
        requestAnimationFrame(() => { card.style.opacity = '0.4'; });
    }, { signal });

    container.addEventListener('dragend', (e) => {
        const card = (e.target as HTMLElement).closest(cardSelector) as HTMLElement | null;
        if (card) card.style.opacity = '1';
        setDraggedId(null);
        clearDropMarkers();
    }, { signal });

    container.addEventListener('dragover', (e: DragEvent) => {
        if (getDraggedId() === null) return;
        e.preventDefault();

        const containerRect = container.getBoundingClientRect();
        if (e.clientY - containerRect.top < AUTO_SCROLL_THRESHOLD_PX) {
            container.scrollBy(0, -AUTO_SCROLL_SPEED_PX);
        } else if (containerRect.bottom - e.clientY < AUTO_SCROLL_THRESHOLD_PX) {
            container.scrollBy(0, AUTO_SCROLL_SPEED_PX);
        }

        updateTargetTrackers(e.clientY, e.target as HTMLElement);
    }, { signal });

    container.addEventListener('dragleave', (e: DragEvent) => {
        const related = e.relatedTarget as HTMLElement | null;
        if (!related || !container.contains(related)) {
            clearDropMarkers();
        }
    }, { signal });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const card = (e.target as HTMLElement).closest(cardSelector) as HTMLElement | null;
        if (!card) return;

        const draggedId = getDraggedId();
        const targetId = Number(card.getAttribute('data-id'));
        if (draggedId === null || draggedId === targetId) return;

        const position: 'above' | 'below' = card.classList.contains('drag-drop-above') ? 'above' : 'below';
        onDrop(draggedId, targetId, position);
    }, { signal });
}
