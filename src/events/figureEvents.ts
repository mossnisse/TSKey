// events/figureEvents.ts
// Figure panel events (add, edit, image upload/removal, drag-and-drop) and the
// figure-reference insertion tool. The generic panel wiring lives in entityPanel.ts;
// this module adds the figure-specific image handling on top. `isFigureTextarea` and
// `insertFigureReference` are also used by the keyboard shortcut (Alt+F).
import type { KeyStore, Figure } from '../store';
import type { UIStateStore } from '../uiState.ts';
import { batchedRefresh } from './shared.ts';
import { setupEntityPanel } from './entityPanel.ts';
import { showToast } from '../uiRenderer.ts';
import { workspaceStorage, activeObjectURLs } from '../store';
import { openImageLightbox } from '../ui/imageLightbox.ts';

// Figure-reference insertion (key editor alt1/alt2 text only).
const FIG_REF_TOKEN = '[fig: ]';
const FIG_REF_CARET_OFFSET = '[fig: '.length; // caret lands just after the colon+space

// The alt1/alt2 textarea (and caret) most recently edited, so the menu item can
// target it even though clicking the menu blurs the textarea.
let lastFigureField: { el: HTMLTextAreaElement; start: number; end: number } | null = null;

/** True only for the key editor's alt1/alt2 description textareas, where figure refs live. */
export function isFigureTextarea(el: EventTarget | null): el is HTMLTextAreaElement {
    return el instanceof HTMLTextAreaElement
        && (el.dataset.field === 'alt1' || el.dataset.field === 'alt2')
        && el.closest('.key-card') !== null;
}

/** Resolves the textarea to insert into: the focused one, else the last one edited. */
function resolveFigureTarget(): { el: HTMLTextAreaElement; start: number; end: number } | null {
    const active = document.activeElement;
    if (isFigureTextarea(active)) {
        return { el: active, start: active.selectionStart ?? 0, end: active.selectionEnd ?? 0 };
    }
    if (lastFigureField && document.body.contains(lastFigureField.el)) {
        return lastFigureField;
    }
    return null;
}

/**
 * Inserts a "[fig: ]" reference skeleton at the caret/selection of a key-step
 * textarea and parks the caret just after the colon, ready for a figure number.
 * Dispatches `input` so the store syncs and the edit is captured for undo.
 */
export function insertFigureReference(el: HTMLTextAreaElement, start: number, end: number): void {
    const value = el.value;
    const from = Math.min(Math.max(start, 0), value.length);
    const to = Math.min(Math.max(end, from), value.length);

    el.value = value.slice(0, from) + FIG_REF_TOKEN + value.slice(to);

    const caret = from + FIG_REF_CARET_OFFSET;
    el.focus();
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event('input', { bubbles: true }));
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
                const caption = (card?.querySelector('.figure-input-caption') as HTMLTextAreaElement | null)?.value ?? '';
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
        // A figure field can also lose focus to a key-card figure reference.
        keepFocusWithin: ['.key-card', '#add-figure-btn'],
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

/**
 * Figure-reference tool: remembers the last alt1/alt2 caret (so the menu item can
 * target it after the click steals focus) and wires the Insert Figure Reference
 * menu command. The keyboard shortcut (Alt+F) lives in keyboardShortcuts.ts.
 */
export function setupFigureReference(keyContainer: HTMLElement, signal: AbortSignal) {
    const captureCaret = (e: Event) => {
        if (isFigureTextarea(e.target)) {
            const t = e.target as HTMLTextAreaElement;
            lastFigureField = { el: t, start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0 };
        }
    };
    (['focusout', 'keyup', 'mouseup', 'input', 'select'] as const).forEach(type =>
        keyContainer.addEventListener(type, captureCaret, { signal })
    );

    document.querySelector('#cmd-insert-figref')?.addEventListener('click', () => {
        const target = resolveFigureTarget();
        if (!target) {
            showToast('Click into a key step description first, then insert a figure reference.', 'error');
            return;
        }
        insertFigureReference(target.el, target.start, target.end);
    }, { signal });
}
