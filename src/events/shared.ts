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
    const currentTitle = store.getProjectName();
    const projects = await workspaceStorage.getProjectList();
    renderProjectHubList(projects, currentTitle);
}
