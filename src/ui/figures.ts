// ui/figures.ts
// Incremental reconciler for the figure-reference cards, including lazy thumbnail
// loading from IndexedDB and object-URL lifecycle management.
import type { KeyStore } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { workspaceStorage, activeObjectURLs } from '../store';

let pendingFigureRefresh: number | null = null;

export function renderFigures(store: KeyStore, uiState: UIStateStore, refreshAll: () => void) {
    if (uiState.isFiguresHidden) return;

    const container = document.getElementById('figure-container');
    if (!container) return;

    const figures = store.getFigures();

    const existingBlocks = Array.from(container.children) as HTMLElement[];
    const existingMap = new Map<number, HTMLElement>();
    existingBlocks.forEach(block => {
        const id = Number(block.getAttribute('data-id'));
        if (!isNaN(id)) existingMap.set(id, block);
    });

    figures.forEach((fig, index) => {
        const displayNum = index + 1;
        const isSelected = store.getSelectedFigureIds().has(fig.id);
        let block = existingMap.get(fig.id);

        if (!block) {
            block = document.createElement('div');
            block.className = 'figure-card';
            block.setAttribute('data-id', fig.id.toString());
            block.draggable = true;
            block.innerHTML = `
                <div class="figure-card-header">
                    <span class="figure-card-title">${displayNum}.</span>
                </div>

                <div class="figure-preview-wrapper">
                    <img class="figure-preview-img" alt="Figure view" style="display: none;" />
                    <div class="figure-upload-overlay">
                        <button type="button" class="btn-trigger-upload">Choose Image</button>
                        <button type="button" class="btn-remove-image" style="display: none;">Remove Image</button>
                        <input type="file" class="hidden-file-picker" accept="image/*" style="display: none;" />
                    </div>
                </div>

                <div class="figure-field-row">
                    <label>Filename:</label>
                    <input type="text" class="input-sync figure-input-filename" data-field="filename" />
                </div>

                <div class="figure-field-row">
                    <label>Caption:</label>
                    <textarea class="input-sync figure-input-caption" data-field="caption" rows="2"></textarea>
                </div>
            `;
        } else {
            const labelEl = block.querySelector('.figure-card-title');
            if (labelEl) labelEl.textContent = `${displayNum}.`;
            existingMap.delete(fig.id);
        }

        if (container.children[index] !== block) {
            container.insertBefore(block, container.children[index] || null);
        }
        block.classList.toggle('is-selected', isSelected);

        const previewWrapper = block.querySelector('.figure-preview-wrapper') as HTMLElement;
        const previewImg = block.querySelector('.figure-preview-img') as HTMLImageElement;

        if (uiState.isImagesHidden) {
            if (previewWrapper) previewWrapper.style.display = 'none';
            if (previewImg) previewImg.style.display = 'none';
        } else {
            if (previewWrapper) previewWrapper.style.display = '';

            const cachedUrl = activeObjectURLs.get(fig.id);
            const removeBtn = block.querySelector('.btn-remove-image') as HTMLButtonElement | null;

            if (cachedUrl) {
                if (previewImg.src !== cachedUrl) {
                    previewImg.src = cachedUrl;
                }
                previewImg.style.display = 'block';
                if (removeBtn) removeBtn.style.display = 'inline-block';
            } else {
                if (!previewImg.hasAttribute('data-loading-state')) {
                    previewImg.setAttribute('data-loading-state', 'pending');

                    const uidAtLoad = store.getActiveProjectUid();
                    workspaceStorage.getFigureBinary(uidAtLoad, fig.id).then(blob => {
                        previewImg.removeAttribute('data-loading-state');
                        if (store.getActiveProjectUid() !== uidAtLoad) return;
                        if (blob) {
                            const newUrl = URL.createObjectURL(blob);
                            activeObjectURLs.set(fig.id, newUrl);
                            if (pendingFigureRefresh === null) {
                                pendingFigureRefresh = requestAnimationFrame(() => {
                                    pendingFigureRefresh = null;
                                    refreshAll();
                                });
                            }
                        } else {
                            previewImg.style.display = 'none';
                            if (removeBtn) removeBtn.style.display = 'none';
                        }
                    }).catch((err) => {
                        console.error("Failed to load binary thumbnail:", err);
                        previewImg.removeAttribute('data-loading-state');
                        if (removeBtn) removeBtn.style.display = 'none';
                    });
                }
            }
        }

        const fileInput = block.querySelector('.figure-input-filename') as HTMLInputElement;
        if (fileInput && document.activeElement !== fileInput && fileInput.value !== fig.filename) {
            fileInput.value = fig.filename;
        }

        const captionInput = block.querySelector('.figure-input-caption') as HTMLTextAreaElement;
        if (captionInput && document.activeElement !== captionInput && captionInput.value !== fig.caption) {
            captionInput.value = fig.caption;
        }
    });

    existingMap.forEach(block => block.remove());
    const currentFigIds = new Set(figures.map(f => f.id));

    for (const [id, url] of activeObjectURLs.entries()) {
        if (!currentFigIds.has(id)) {
            URL.revokeObjectURL(url);
            activeObjectURLs.delete(id);
        }
    }
}