import { describe, expect, it, vi } from 'vitest';
import { commitParsedKey } from '../../src/importers/importCommit.ts';
import { parsePlainTextKey } from '../../src/importers/plainTextImporter.ts';
import { workspaceStorage } from '../../src/store/db.ts';
import { KeyStore } from '../../src/store/keyStore.ts';
import { UIStateStore } from '../../src/uiState.ts';
import { couplet } from '../helpers/factories.ts';

const parsed = parsePlainTextKey('1. Has wings ..... Species one\n— Lacks wings ..... Species two');

function options(store: KeyStore, refreshAll = vi.fn()) {
    return {
        store,
        uiState: new UIStateStore(),
        refreshAll,
        result: parsed,
        title: 'Imported key',
        sourceLabel: 'PDF',
    };
}

describe('shared parsed-key commit flow', () => {
    it('leaves the workspace untouched when unsaved-work confirmation is cancelled', async () => {
        const store = new KeyStore([couplet(1)], [], 'Current');
        store.updateCouplet(1, { alt1: 'unsaved' });
        vi.mocked(confirm).mockReturnValue(false);
        const projectList = vi.spyOn(workspaceStorage, 'getProjectList');

        expect(await commitParsedKey(options(store))).toBe('cancelled');
        expect(store.getTitle()).toBe('Current');
        expect(store.getKey()[0].alt1).toBe('unsaved');
        expect(projectList).not.toHaveBeenCalled();
    });

    it('cancels before import when an existing project overwrite is declined', async () => {
        const store = new KeyStore([couplet(1)], [], 'Current');
        vi.spyOn(workspaceStorage, 'getProjectList').mockResolvedValue([{
            name: 'Imported key',
            lastModified: 1,
        }]);
        vi.mocked(confirm).mockReturnValue(false);

        expect(await commitParsedKey(options(store))).toBe('cancelled');
        expect(store.getTitle()).toBe('Current');
    });

    it('imports, persists, and refreshes a valid parsed key', async () => {
        const store = new KeyStore([], [], 'Current');
        const refreshAll = vi.fn();
        vi.spyOn(workspaceStorage, 'getProjectList').mockResolvedValue([]);
        const save = vi.spyOn(workspaceStorage, 'saveProject').mockResolvedValue();

        expect(await commitParsedKey(options(store, refreshAll))).toBe('saved');
        expect(store.getTitle()).toBe('Imported key');
        expect(store.getKey()).toHaveLength(1);
        expect(save).toHaveBeenCalledOnce();
        expect(refreshAll).toHaveBeenCalledOnce();
    });

    it('keeps a successfully imported key available when browser persistence fails', async () => {
        const store = new KeyStore([], [], 'Current');
        const refreshAll = vi.fn();
        vi.spyOn(workspaceStorage, 'getProjectList').mockResolvedValue([]);
        vi.spyOn(workspaceStorage, 'saveProject').mockRejectedValue(new Error('quota exceeded'));

        expect(await commitParsedKey(options(store, refreshAll))).toBe('imported-unsaved');
        expect(store.getTitle()).toBe('Imported key');
        expect(store.getKey()).toHaveLength(1);
        expect(store.hasUnsavedChanges()).toBe(true);
        expect(refreshAll).toHaveBeenCalledOnce();
    });
});
