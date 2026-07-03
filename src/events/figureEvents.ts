// events/figureEvents.ts
// Figure panel events (add, edit, image upload/removal, drag-and-drop) and the
// figure-reference insertion tool. The generic panel wiring lives in entityPanel.ts;
// this module adds the figure-specific image handling on top. `isFigureRefHost` and
// `openFigureReferencePicker` are also used by the keyboard shortcut (Alt+F).
import type { KeyStore, Figure } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { batchedRefresh, DEBOUNCE_TYPING_MS } from './shared.ts';
import { setupEntityPanel } from './entityPanel.ts';
import { showToast } from '../uiRenderer.ts';
import { workspaceStorage, activeObjectURLs } from '../store';
import { openImageLightbox } from '../ui/imageLightbox.ts';
import { openPopover } from '../popover.ts';
import { getFieldEditor } from '../ui/richTextField.ts';
import { renderPlainText } from '../keyDocumentModel.ts';
import type { RichTextEditor } from '../editor/richText/index.ts';

// The figure-aware rich-text field (and its caret) most recently focused, so the menu
// item / shortcut can target it even though clicking the menu blurs the editor.
let lastFigureField: { host: HTMLElement; selection: { start: number; end: number } | null } | null = null;

/** True for a mounted figure-aware rich-text field (couplet alt1/alt2 or taxa
 *  description) — the fields where figure references are allowed. */
export function isFigureRefHost(el: EventTarget | null): el is HTMLElement {
    return el instanceof HTMLElement
        && el.classList.contains('rte-host')
        && el.dataset.rteFigures === 'true';
}

/** Resolves the field to insert into and the caret to insert at: the focused editor,
 *  else the most recently focused one. */
function resolveFigureTarget(): { editor: RichTextEditor; selection: { start: number; end: number } | null } | null {
    const active = document.activeElement;
    if (isFigureRefHost(active)) {
        const editor = getFieldEditor(active);
        if (editor) return { editor, selection: editor.getSelection() };
    }
    if (lastFigureField && document.body.contains(lastFigureField.host)) {
        const editor = getFieldEditor(lastFigureField.host);
        if (editor) return { editor, selection: lastFigureField.selection };
    }
    return null;
}

/**
 * Opens a figure picker at (x, y) and inserts the chosen `[fig: N]` reference at the
 * target field's caret. A chip editor can't host an editable empty `[fig: ]` skeleton,
 * so we pick a real figure and insert a complete, resolvable reference instead.
 */
export function openFigureReferencePicker(store: KeyStore, x: number, y: number, signal: AbortSignal): void {
    const target = resolveFigureTarget();
    if (!target) {
        showToast('Click into a key step or taxon description first, then insert a figure reference.', 'error');
        return;
    }

    const figures = store.getFigures();
    if (figures.length === 0) {
        showToast('Add a figure in the Figures panel first, then insert a reference.', 'error');
        return;
    }

    openPopover({
        x,
        y,
        signal,
        headerHtml: '<div class="popover-header">Insert figure reference</div>',
        items: figures.map((fig, i) => {
            const displayNum = i + 1;
            const detail = fig.caption || fig.filename || '';
            return {
                label: detail ? `Fig. ${displayNum} — ${detail}` : `Fig. ${displayNum}`,
                onSelect: () => target.editor.insertToken(`[fig: ${displayNum}]`, target.selection ?? undefined),
            };
        }),
    });
}

/** Figure panel: add button, text fields, image upload/removal, and figure drag-and-drop. */
export function setupFigurePanel(store: KeyStore, uiState: UIStateStore, refreshAll: () => void, signal: AbortSignal) {
    const figureContainer = document.getElementById('figure-container');
    if (!figureContainer) return;

    // Figure-specific clicks handled before selection: image upload trigger, image
    // removal, and opening a loaded image in the lightbox. A modifier-click on the
    // image falls through to selection. Returns true when the click was consumed.
    const handleFigureClick = (target: HTMLElement, e: MouseEvent): boolean => {
        if (target.classList.contains('btn-trigger-upload')) {
            const card = target.closest('.figure-card') as HTMLElement | null;
            (card?.querySelector('.hidden-file-picker') as HTMLInputElement | null)?.click();
            return true;
        }

        if (target.classList.contains('btn-remove-image')) {
            const card = target.closest('.figure-card') as HTMLElement | null;
            if (!card) return true;
            const figId = Number(card.getAttribute('data-id'));
            store.updateFigure(figId, { filename: '' });
            workspaceStorage.deleteFigureBinary(figId);

            const oldUrl = activeObjectURLs.get(figId);
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            activeObjectURLs.delete(figId);

            batchedRefresh(refreshAll);
            return true;
        }

        if (target.classList.contains('figure-preview-img') && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
            const img = target as HTMLImageElement;
            const src = img.currentSrc || img.getAttribute('src') || '';
            if (img.style.display !== 'none' && src) {
                const card = img.closest('.figure-card') as HTMLElement | null;
                const num = card?.querySelector('.figure-card-title')?.textContent?.trim() ?? '';
                const captionHost = card?.querySelector('.figure-input-caption') as HTMLElement | null;
                // Strip mark markers so the lightbox caption shows styled text as plain
                // prose (captions carry no figure tokens, so no figures are needed).
                const caption = renderPlainText((captionHost ? getFieldEditor(captionHost)?.getValue() : '') ?? '');
                openImageLightbox(src, [num, caption].filter(Boolean).join('  '));
                return true;
            }
        }

        return false;
    };

    setupEntityPanel({
        container: figureContainer,
        cardSelector: '.figure-card',
        addButton: document.getElementById('add-figure-btn'),
        fieldKeyPrefix: 'fig',
        typing: uiState.typing.figures,
        signal,
        refreshAll,
        onAdd: () => store.addFigure('', ''),
        endTypingSession: () => store.endTypingSession(),
        buildUpdate: (field, value) => ({ [field]: value }),
        applyUpdate: (id, update) => store.updateFigure(id, update as Partial<Omit<Figure, 'id'>>),
        toggleSelection: (id, multi) => store.toggleFigureSelection(id, multi),
        clearSelection: () => store.clearFigureSelection(),
        getItems: () => store.getFigures(),
        reorder: (src, tgt) => store.reorderFigures(src, tgt),
        extraClick: handleFigureClick,
        // A figure field can also lose focus to a key-card figure reference or the
        // floating format toolbar.
        keepFocusWithin: ['.key-card', '#add-figure-btn', '.format-toolbar'],
    });

    // Image upload: when the OS file picker resolves, stage the binary + thumbnail.
    figureContainer.addEventListener('change', async (e) => {
        const target = e.target as HTMLInputElement;
        if (!target.classList.contains('hidden-file-picker')) return;

        const file = target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('⚠️ Only image files are supported.', 'error');
            target.value = '';
            return;
        }

        const card = target.closest('.figure-card') as HTMLElement;
        const figId = Number(card?.getAttribute('data-id'));
        if (isNaN(figId)) return;

        store.updateFigure(figId, { filename: file.name });
        workspaceStorage.uploadFigureBinary(figId, file);

        // Evict any stale object URL, then cache a fresh one for the immediate preview.
        const oldUrl = activeObjectURLs.get(figId);
        if (oldUrl) URL.revokeObjectURL(oldUrl);

        const freshUrl = URL.createObjectURL(file);
        activeObjectURLs.set(figId, freshUrl);
        target.value = '';

        batchedRefresh(refreshAll);
    }, { signal });
}

/** Commits a rich-text caption edit: immediate store sync + undo checkpoint, then a
 *  debounced refresh. Captions are mark-only (no figure tokens), so there is no encode
 *  step. Wired to the mounted editor's onChange. */
export function commitFigureCaption(
    store: KeyStore,
    uiState: UIStateStore,
    refreshAll: () => void,
    id: number,
    value: string,
) {
    uiState.typing.figures.start(`fig-${id}-caption`, () => store.endTypingSession());
    store.updateFigure(id, { caption: value });
    uiState.typing.figures.extendTimeout(DEBOUNCE_TYPING_MS, () => batchedRefresh(refreshAll));
}

/**
 * Figure-reference tool: tracks the last-focused figure-aware editor + caret (so the
 * menu item can target it after the click steals focus) and wires the Insert Figure
 * Reference menu command to the figure picker. The Alt+F shortcut lives in
 * keyboardShortcuts.ts. Tracking is document-level so taxa descriptions qualify too.
 */
export function setupFigureReference(store: KeyStore, signal: AbortSignal) {
    const captureCaret = (e: Event) => {
        const host = (e.target instanceof HTMLElement) ? e.target.closest('.rte-host') as HTMLElement | null : null;
        if (host && isFigureRefHost(host)) {
            lastFigureField = { host, selection: getFieldEditor(host)?.getSelection() ?? null };
        }
    };
    (['focusin', 'keyup', 'mouseup', 'input'] as const).forEach(type =>
        document.addEventListener(type, captureCaret, { signal })
    );

    document.querySelector('#cmd-insert-figref')?.addEventListener('click', (e) => {
        // Anchor the picker near the menu item that opened it.
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        openFigureReferencePicker(store, rect.left, rect.bottom + 4, signal);
    }, { signal });
}
