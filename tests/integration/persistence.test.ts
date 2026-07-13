import { describe, expect, it, vi } from 'vitest';
import { WorkspaceManager, workspaceStorage } from '../../src/store/db.ts';
import type { ProjectData, ProjectRecord } from '../../src/store/db.ts';
import { KeyStore } from '../../src/store/keyStore.ts';
import { couplet, deferred, figure } from '../helpers/factories.ts';
import { MemoryStorageEngine } from '../helpers/memoryStorage.ts';

const projectData = (figures = [] as ReturnType<typeof figure>[]): ProjectData => ({
    dichotomousKey: [couplet(1)],
    figures,
    taxa: [],
});

function blobText(blob: Blob): Promise<string> {
    const crossRealmBlob = blob as Blob & { text?: () => Promise<string> };
    if (typeof crossRealmBlob.text === 'function') return crossRealmBlob.text();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
    });
}

describe('WorkspaceManager with IndexedDB', () => {
    it('saves, lists, loads, and deletes a project', async () => {
        const manager = new WorkspaceManager();
        await manager.saveProject('Key A', 'uid-a', projectData());

        expect(await manager.getProjectList()).toEqual([
            expect.objectContaining({ name: 'Key A' }),
        ]);
        expect(await manager.loadProject('Key A')).toMatchObject({ title: 'Key A', projectUid: 'uid-a' });

        await manager.deleteProject('Key A');
        expect(await manager.loadProject('Key A')).toBeNull();
    });

    it('isolates figure binaries by project identity', async () => {
        // fake-indexeddb does not structured-clone jsdom's cross-realm Blob reliably;
        // use the injected engine here while the preceding test covers real IDB records.
        const manager = new WorkspaceManager(new MemoryStorageEngine());
        const metadata = [figure(1)];
        manager.uploadFigureBinary(1, new Blob(['alpha'], { type: 'text/plain' }));
        await manager.saveProject('A', 'uid-a', projectData(metadata));

        manager.resetActiveImageCache();
        manager.uploadFigureBinary(1, new Blob(['beta'], { type: 'text/plain' }));
        await manager.saveProject('B', 'uid-b', projectData(metadata));

        manager.resetActiveImageCache();
        expect(await blobText((await manager.getFigureBinary('uid-a', 1))!)).toBe('alpha');
        expect(await blobText((await manager.getFigureBinary('uid-b', 1))!)).toBe('beta');
    });
});

describe('WorkspaceManager staging snapshots', () => {
    it('leaves an upload made during a save staged for the next save', async () => {
        const engine = new MemoryStorageEngine();
        const manager = new WorkspaceManager(engine);
        const gate = deferred<void>();
        engine.beforeProjectSave = () => gate.promise;

        manager.uploadFigureBinary(1, new Blob(['first']));
        const firstSave = manager.saveProject('A', 'uid-a', projectData([figure(1)]));
        manager.uploadFigureBinary(2, new Blob(['late']));
        gate.resolve();
        await firstSave;

        expect(await blobText((await manager.getFigureBinary('uid-a', 2))!)).toBe('late');

        engine.beforeProjectSave = undefined;
        await manager.saveProject('A', 'uid-a', projectData([figure(1), figure(2)]));
        expect(await blobText((await engine.getFigure('uid-a', 2))!)).toBe('late');
    });
});

describe('KeyStore persistence regressions', () => {
    it('supports undo/redo while preserving dirty-state semantics', () => {
        const store = new KeyStore([couplet(1)], [], 'A');
        store.updateCouplet(1, { alt1: 'changed' });
        expect(store.hasUnsavedChanges()).toBe(true);
        expect(store.undo()).toBe(true);
        expect(store.getKey()[0].alt1).toBe('Alternative 1a');
        expect(store.redo()).toBe(true);
        expect(store.getKey()[0].alt1).toBe('changed');
    });

    it('does not mark an edit made during a delayed save as persisted', async () => {
        const gate = deferred<void>();
        let savedData: ProjectData | undefined;
        vi.spyOn(workspaceStorage, 'saveProject').mockImplementation(async (_title, _uid, data) => {
            savedData = data;
            await gate.promise;
        });
        const store = new KeyStore([couplet(1)], [], 'A');
        store.updateCouplet(1, { alt1: 'snapshot' });

        const saving = store.saveToStorage();
        store.updateCouplet(1, { alt1: 'newer edit' });
        gate.resolve();
        await saving;

        expect(savedData?.dichotomousKey[0].alt1).toBe('snapshot');
        expect(store.getKey()[0].alt1).toBe('newer edit');
        expect(store.hasUnsavedChanges()).toBe(true);
    });

    it('does not let a late save completion rewrite a newly loaded project pointer', async () => {
        const gate = deferred<void>();
        vi.spyOn(workspaceStorage, 'saveProject').mockImplementation(() => gate.promise);
        const projectB: ProjectRecord = {
            title: 'B',
            projectUid: 'uid-b',
            schemaVersion: 2,
            lastModified: 1,
            dichotomousKey: [couplet(2)],
            figures: [],
            taxa: [],
        };
        vi.spyOn(workspaceStorage, 'loadProject').mockResolvedValue(projectB);
        const store = new KeyStore([couplet(1)], [], 'A');
        const savingA = store.saveToStorage();

        await store.loadProject('B');
        gate.resolve();
        await savingA;

        expect(store.getTitle()).toBe('B');
        expect(store.getPersistedTitle()).toBe('B');
        expect(store.getActiveProjectUid()).toBe('uid-b');
    });

    it('restores the in-memory title and identity after Save As fails', async () => {
        vi.spyOn(workspaceStorage, 'cloneProjectFigures').mockResolvedValue();
        vi.spyOn(workspaceStorage, 'saveProject').mockRejectedValue(new Error('disk full'));
        const store = new KeyStore([couplet(1)], [], 'Original');
        store.setTitle('Unsaved title');
        const originalUid = store.getActiveProjectUid();

        await expect(store.saveAsProject('Copy')).rejects.toThrow('disk full');
        expect(store.getTitle()).toBe('Unsaved title');
        expect(store.getActiveProjectUid()).toBe(originalUid);
        expect(store.hasUnsavedChanges()).toBe(true);
    });
});
