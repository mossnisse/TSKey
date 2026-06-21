// events/keyboardShortcuts.ts
// Global window-level keyboard shortcut interceptor. Most shortcuts delegate to the
// corresponding menu command button; figure-reference insert and paste call shared
// helpers directly.
import type { KeyStore } from '../store.ts';
import { IS_MAC } from '../utils.ts';
import { isFigureTextarea, insertFigureReference } from './figureEvents.ts';
import { executePaste } from './coupletEvents.ts';

/**
 * Desktop Command Shortcut Interceptor Engine.
 */
export function setupKeyboardShortcuts(store: KeyStore, refreshAll: () => void) {
    const handleKeyDown = (e: KeyboardEvent) => {
        const importView = document.getElementById('plain-text-import-view') as HTMLElement | null;
        if (importView && importView.style.display === 'flex') return;

        const modals = document.querySelectorAll('.modal-overlay');
        const activeModal = Array.from(modals).find(
            el => (el as HTMLElement).style.display === 'flex'
        ) as HTMLElement | null;

        if (activeModal) {
            if (e.key === 'Escape') {
                activeModal.style.display = 'none';
                e.preventDefault();
                return;
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                const focusables = Array.from(activeModal.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )).filter(el => el.offsetParent !== null);
                if (focusables.length > 0) {
                    const current = focusables.indexOf(document.activeElement as HTMLElement);
                    const delta = e.shiftKey ? -1 : 1;
                    focusables[(current + delta + focusables.length) % focusables.length].focus();
                }
                return;
            }
        }
        const hasModifier = IS_MAC ? e.metaKey : e.ctrlKey;
        const activeElement = document.activeElement;
        const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.hasAttribute('contenteditable')
        );

        if (e.altKey && !hasModifier && !e.shiftKey && e.code === 'KeyF' && isFigureTextarea(activeElement)) {
            e.preventDefault();
            insertFigureReference(activeElement, activeElement.selectionStart ?? 0, activeElement.selectionEnd ?? 0);
            return;
        }

        // Global lifecycle overrides (Available even when focus sits inside active text fields)
        if (hasModifier && e.key.toLowerCase() === 's') {
            e.preventDefault();
            if (e.shiftKey) {
                document.querySelector<HTMLButtonElement>('#cmd-save-as')?.click();
            } else {
                document.querySelector<HTMLButtonElement>('#cmd-save')?.click();
            }
            return;
        }

        if (hasModifier && e.key.toLowerCase() === 'o') {
            e.preventDefault();
            document.querySelector<HTMLButtonElement>('#cmd-open-dialog')?.click();
            return;
        }

        if (hasModifier && e.altKey && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            document.querySelector<HTMLButtonElement>('#cmd-new')?.click();
            return;
        }

        if (hasModifier && e.shiftKey && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            document.querySelector<HTMLButtonElement>('#cmd-toggle-figures')?.click();
            return;
        }

        if (hasModifier && e.shiftKey && e.key.toLowerCase() === 'p') {
            e.preventDefault();
            document.querySelector<HTMLButtonElement>('#cmd-toggle-print')?.click();
            return;
        }

        if (!isTyping) {
            if (e.altKey && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-add')?.click();
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-select-all')?.click();
                return;
            }

            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-swap')?.click();
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    document.querySelector<HTMLButtonElement>('#cmd-redo')?.click();
                } else {
                    document.querySelector<HTMLButtonElement>('#cmd-undo')?.click();
                }
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-redo')?.click();
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-delete')?.click();
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-clear')?.click();
                return;
            }

            const hasTextSelection = (window.getSelection()?.toString() ?? '').trim() !== '';

            if (hasModifier && e.key.toLowerCase() === 'c') {
                if (hasTextSelection || store.getSelectedCoupletIds().size === 0) return;
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-copy')?.click();
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'x') {
                if (hasTextSelection || store.getSelectedCoupletIds().size === 0) return;
                e.preventDefault();
                document.querySelector<HTMLButtonElement>('#cmd-cut')?.click();
                return;
            }

            if (hasModifier && e.key.toLowerCase() === 'v') {
                if (!store.hasClipboardData()) return; // nothing internal to paste; allow native
                e.preventDefault();
                const position = e.shiftKey ? 'above' : 'below';
                executePaste(store, refreshAll, position);
                return;
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
}
