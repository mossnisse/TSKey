// ui/figures.ts
// Renders the figure-reference cards via the shared reconciler, including lazy
// thumbnail loading from IndexedDB and object-URL lifecycle management.
import type { KeyStore, Figure } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { workspaceStorage, activeObjectURLs } from '../store';
import { reconcileCards } from './shared.ts';
import { mountRichTextField, syncRichTextField, destroyRichTextFieldsIn, markOnlyFieldSchema } from './richTextField.ts';
import { commitFigureCaption } from '../events/figureEvents.ts';

let pendingFigureRefresh: number | null = null;

// Caption is mark-only (no figure references); thumbnail/title/values are filled by update.
function createFigureCard(fig: Figure, store: KeyStore, uiState: UIStateStore, refreshAll: () => void): HTMLElement {
    const block = document.createElement('div');
    block.className = 'figure-card';
    block.setAttribute('data-id', fig.id.toString());
    block.draggable = true;
    block.innerHTML = `
        <div class="figure-card-header">
            <span class="figure-card-title"></span>
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
            <div class="rte-host figure-input-caption" data-field="caption"></div>
        </div>
    `;

    const captionHost = block.querySelector('.rte-host[data-field="caption"]') as HTMLElement | null;
    if (captionHost) {
        mountRichTextField(captionHost, {
            schema: markOnlyFieldSchema(),
            value: fig.caption,
            placeholder: 'Caption — supports **bold**, *italic*…',
            onChange: v => commitFigureCaption(store, uiState, refreshAll, fig.id, v),
        });
    }
    return block;
}

export function renderFigures(store: KeyStore, uiState: UIStateStore, refreshAll: () => void) {
    if (uiState.isFiguresHidden) return;

    const container = document.getElementById('figure-container');
    if (!container) return;

    const figures = store.getFigures();

    reconcileCards<Figure>({
        container,
        items: figures,
        getId: f => f.id,
        create: fig => createFigureCard(fig, store, uiState, refreshAll),
        onRemove: destroyRichTextFieldsIn,
        update: (block, fig, index) => {
            const figNum = index + 1;
            const labelEl = block.querySelector('.figure-card-title');
            if (labelEl) labelEl.textContent = `${figNum}.`;

            block.querySelector('.btn-trigger-upload')?.setAttribute('aria-label', `Choose image for Figure ${figNum}`);
            block.querySelector('.btn-remove-image')?.setAttribute('aria-label', `Remove image for Figure ${figNum}`);
            block.querySelector('.figure-input-filename')?.setAttribute('aria-label', `Figure ${figNum} filename`);
            block.querySelector('.rte-host[data-field="caption"]')?.setAttribute('aria-label', `Figure ${figNum} caption`);

            block.classList.toggle('is-selected', store.getSelectedFigureIds().has(fig.id));

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

                            // An upload (or another render) may have cached a URL while this
                            // read was in flight; don't clobber it — or leak its object URL —
                            // with the now-stale stored blob. Display the cached one instead.
                            const cachedNow = activeObjectURLs.get(fig.id);
                            if (cachedNow) {
                                if (previewImg.src !== cachedNow) previewImg.src = cachedNow;
                                previewImg.style.display = 'block';
                                if (removeBtn) removeBtn.style.display = 'inline-block';
                                return;
                            }

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

            const captionHost = block.querySelector('.rte-host[data-field="caption"]') as HTMLElement | null;
            if (captionHost) syncRichTextField(captionHost, fig.caption);
        },
    });

    // Revoke object URLs for figures that no longer exist.
    const currentFigIds = new Set(figures.map(f => f.id));
    for (const [id, url] of activeObjectURLs.entries()) {
        if (!currentFigIds.has(id)) {
            URL.revokeObjectURL(url);
            activeObjectURLs.delete(id);
        }
    }
}