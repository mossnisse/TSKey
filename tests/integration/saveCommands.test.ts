import { describe, expect, it, vi } from 'vitest';
import { defaultMarks } from '../../src/editor/richText/schema.ts';
import { setupTitleEditing } from '../../src/events/coupletEvents.ts';
import { setupKeyboardShortcuts } from '../../src/events/keyboardShortcuts.ts';
import { setupFileMenu } from '../../src/events/menuEvents.ts';
import { workspaceStorage } from '../../src/store/db.ts';
import { KeyStore } from '../../src/store/keyStore.ts';
import { UIStateStore } from '../../src/uiState.ts';
import { mountRichTextField } from '../../src/ui/richTextField.ts';
import { couplet, deferred } from '../helpers/factories.ts';

function button(id: string): HTMLButtonElement {
    const element = document.createElement('button');
    element.id = id;
    document.body.appendChild(element);
    return element;
}

describe('save command synchronization', () => {
    it('waits for asynchronous title validation before taking the save snapshot', async () => {
        const title = document.createElement('input');
        title.id = 'key-title-input';
        title.value = 'Original';
        document.body.appendChild(title);
        const save = button('cmd-save');
        const store = new KeyStore([couplet(1)], [], 'Original');
        const uiState = new UIStateStore();
        const gate = deferred<{ name: string; lastModified: number }[]>();
        vi.spyOn(workspaceStorage, 'getProjectList').mockReturnValue(gate.promise);
        const saveSpy = vi.spyOn(store, 'saveToStorage').mockResolvedValue();
        const controller = new AbortController();
        setupTitleEditing(store, vi.fn(), controller.signal);
        setupFileMenu(store, uiState, vi.fn(), controller.signal);

        title.value = 'Renamed';
        title.dispatchEvent(new FocusEvent('blur'));
        save.click();
        await Promise.resolve();

        expect(saveSpy).not.toHaveBeenCalled();
        gate.resolve([]);
        await vi.waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
        expect(store.getTitle()).toBe('Renamed');
        controller.abort();
    });

    it('flushes a pending rich-text DOM edit before Ctrl+S invokes persistence', async () => {
        button('cmd-save');
        const root = document.createElement('div');
        root.className = 'rte-host';
        document.body.appendChild(root);
        const store = new KeyStore([couplet(1, { alt1: 'old' })], [], 'Original');
        const editor = mountRichTextField(root, {
            schema: { marks: defaultMarks, tokens: [] },
            value: 'old',
            onChange: value => store.updateCouplet(1, { alt1: value }),
        });
        let valueAtSave = '';
        const saveSpy = vi.spyOn(store, 'saveToStorage').mockImplementation(async () => {
            valueAtSave = store.getKey()[0].alt1;
        });
        const controller = new AbortController();
        setupFileMenu(store, new UIStateStore(), vi.fn(), controller.signal);
        const destroyKeyboard = setupKeyboardShortcuts(store, vi.fn());

        root.textContent = 'latest text';
        root.dispatchEvent(new InputEvent('input', { bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));

        await vi.waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
        expect(valueAtSave).toBe('latest text');
        expect(editor.hasPendingEdit()).toBe(false);

        destroyKeyboard();
        controller.abort();
        editor.destroy();
    });
});
