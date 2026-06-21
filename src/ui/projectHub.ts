// ui/projectHub.ts
// Renders the rows of the "Open Key Workspace" hub modal.
import { escapeHTML } from '../utils.ts';

/**
 * Populates and updates rows inside the asynchronous Project Hub Modal view template.
 */
export function renderProjectHubList(projects: Array<{ name: string; lastModified: number }>, currentProjectName: string) {
    const container = document.getElementById('project-hub-list');
    if (!container) return;

    if (projects.length === 0) {
        container.innerHTML = `<div class="hub-empty">No keys saved inside local browser memory yet.</div>`;
        return;
    }

    container.innerHTML = projects.map(proj => {
        const isCurrent = proj.name === currentProjectName;
        const dateString = new Date(proj.lastModified).toLocaleString();
        const safeName = escapeHTML(proj.name);
        const activeTag = isCurrent ? ' <small class="hub-item-active-tag">(active)</small>' : '';

        return `
            <div class="project-hub-item${isCurrent ? ' is-current' : ''}" data-name="${safeName}">
                <div class="hub-item-clickable-zone" data-action="load" data-name="${safeName}">
                    <span class="hub-item-name">${safeName}${activeTag}</span>
                    <span class="hub-item-date">Last saved: ${dateString}</span>
                </div>
                <button class="btn-hub-delete" data-action="delete" data-name="${safeName}" title="Delete from local database">&times;</button>
            </div>
        `;
    }).join('');
}