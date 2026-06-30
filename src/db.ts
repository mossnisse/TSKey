// db.ts - Complete zero-dependency client-side storage engine
import type { Couplet, Figure, Taxon } from './store.ts';

/**
 * Bumped whenever the persisted document gains a collection or changes shape.
 * Stored on each ProjectRecord so future loads can migrate older records.
 *   v1 — couplets + figures
 *   v2 — adds the taxa collection (normalized terminal records)
 */
export const SCHEMA_VERSION = 2;

/**
 * The serializable document collections, passed as one object so adding a new
 * collection (taxa, glossary, references…) never grows saveProject's argument
 * list. Title and projectUid are passed alongside as they key the record.
 */
export interface ProjectData {
    dichotomousKey: Couplet[];
    figures: Figure[];
    taxa: Taxon[];
}

export interface ProjectRecord extends ProjectData {
    title: string;
    projectUid: string;   // Stable identity; figure blobs are keyed by this, not the title
    schemaVersion?: number;
    lastModified: number;
}

export interface StagingSnapshot {
    uploads: Map<number, Blob>;
    deletes: Set<number>;
}

/**
 * Resolves when a transaction commits; rejects on error or abort.
 * `abortMessage` gives the abort path a contextual error for debugging.
 */
function txDone(tx: IDBTransaction, abortMessage: string): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error(abortMessage));
    });
}

/** Resolves with a single IDBRequest's result; rejects on error. */
function reqValue<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * PERSISTENT DISK LAYER (IndexedDB Engine)
 * Handles low-level raw browser transactions wrapped cleanly in native Promises.
 */
class IndexedDBEngine {
    private dbName = 'TSKey_Workspace_DB';
    private projectsStoreName = 'projects';
    private figuresStoreName = 'figures';
    private dbPromise: Promise<IDBDatabase> | null = null;

    private getDB(): Promise<IDBDatabase> {
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 2);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.projectsStoreName)) {
                    db.createObjectStore(this.projectsStoreName, { keyPath: 'title' });
                }
                if (!db.objectStoreNames.contains(this.figuresStoreName)) {
                    db.createObjectStore(this.figuresStoreName);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
                alert('⚠️ TSKey could not open its database because another tab still has an older version open. Please close other TSKey tabs and reload.');
                reject(new Error('IndexedDB open blocked by another open connection.'));
            };
        });

        this.dbPromise.catch(() => {
            this.dbPromise = null;
        });

        return this.dbPromise;
    }

    private getFigureKey(projectUid: string, id: number): string {
        return `${projectUid}::${id}`;
    }

    private parseFigureId(key: string): number {
        return parseInt(key.substring(key.lastIndexOf('::') + 2), 10);
    }

    private getProjectKeyRange(projectUid: string): IDBKeyRange {
        const prefix = `${projectUid}::`;
        const upper = prefix.substring(0, prefix.length - 1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
        return IDBKeyRange.bound(prefix, upper, false, true);
    }

    public async getProjectList(): Promise<{ name: string, lastModified: number }[]> {
        const db = await this.getDB();
        const tx = db.transaction(this.projectsStoreName, 'readonly');
        const records = await reqValue(tx.objectStore(this.projectsStoreName).getAll() as IDBRequest<ProjectRecord[]>);

        return records
            .map((p) => ({ name: p.title, lastModified: p.lastModified }))
            .sort((a, b) => b.lastModified - a.lastModified);
    }

    public async saveProject(title: string, projectUid: string, data: ProjectData): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction(this.projectsStoreName, 'readwrite');

        const record: ProjectRecord = {
            title,
            projectUid,
            schemaVersion: SCHEMA_VERSION,
            dichotomousKey: data.dichotomousKey,
            figures: data.figures,
            taxa: data.taxa,
            lastModified: Date.now()
        };
        tx.objectStore(this.projectsStoreName).put(record);

        // Resolving on complete ensures that data is successfully committed to disk
        return txDone(tx, `Transaction aborted while saving project: ${title}`);
    }

    public async loadProject(title: string): Promise<ProjectRecord | null> {
        const db = await this.getDB();
        const tx = db.transaction(this.projectsStoreName, 'readonly');
        const result = await reqValue(tx.objectStore(this.projectsStoreName).get(title) as IDBRequest<ProjectRecord | undefined>);
        if (!result) return null;

        // Default any collection a legacy record predates, so callers can rely on
        // every collection being a present array regardless of when it was saved.
        result.dichotomousKey = result.dichotomousKey || [];
        result.figures = result.figures || [];
        result.taxa = result.taxa || [];
        return result;
    }

    public async deleteProject(title: string, projectUid: string): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction([this.projectsStoreName, this.figuresStoreName], 'readwrite');

        tx.objectStore(this.projectsStoreName).delete(title);

        const fStore = tx.objectStore(this.figuresStoreName);
        const cursorReq = fStore.openCursor(this.getProjectKeyRange(projectUid));
        cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };

        return txDone(tx, `Project deletion aborted for: ${title}`);
    }

    /**
     * Deletes only the project metadata record, leaving its figure blobs intact.
     * Used by rename, where the new-title record keeps the same projectUid.
     */
    public async deleteProjectRecordOnly(title: string): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction(this.projectsStoreName, 'readwrite');
        tx.objectStore(this.projectsStoreName).delete(title);
        return txDone(tx, `Project record deletion aborted for: ${title}`);
    }

    public async saveFigure(projectUid: string, id: number, blob: Blob): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction(this.figuresStoreName, 'readwrite');
        tx.objectStore(this.figuresStoreName).put(blob, this.getFigureKey(projectUid, id));
        return txDone(tx, `Transaction aborted while saving figure ID ${id}`);
    }

    public async deleteFigure(projectUid: string, id: number): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction(this.figuresStoreName, 'readwrite');
        tx.objectStore(this.figuresStoreName).delete(this.getFigureKey(projectUid, id));
        return txDone(tx, `Transaction aborted while deleting figure ID ${id}`);
    }

    /**
     * Garbage Collection Engine: Deletes binary objects from IndexedDB 
     * whose IDs are no longer tracked in the active project metadata.
     */
    public async cleanupOrphanFigures(projectUid: string, activeIds: Set<number>): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction(this.figuresStoreName, 'readwrite');
        const cursorReq = tx.objectStore(this.figuresStoreName).openCursor(this.getProjectKeyRange(projectUid));

        cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
                const id = this.parseFigureId(cursor.key as string);

                if (!activeIds.has(id)) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };

        return txDone(tx, `Orphan cleanup transaction aborted for project: ${projectUid}`);
    }

    public async getFigure(projectUid: string, id: number): Promise<Blob | null> {
        const db = await this.getDB();
        const tx = db.transaction(this.figuresStoreName, 'readonly');
        const result = await reqValue(tx.objectStore(this.figuresStoreName).get(this.getFigureKey(projectUid, id)) as IDBRequest<Blob | undefined>);
        return result || null;
    }

    public async cloneProjectFigures(oldUid: string, newUid: string): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction(this.figuresStoreName, 'readwrite');
        const store = tx.objectStore(this.figuresStoreName);
        const cursorReq = store.openCursor(this.getProjectKeyRange(oldUid));

        cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
                const id = this.parseFigureId(cursor.key as string);
                const blob = cursor.value as Blob;

                store.put(blob, this.getFigureKey(newUid, id));
                cursor.continue();
            }
        };

        return txDone(tx, `Cloning figures transaction aborted from "${oldUid}" to "${newUid}"`);
    }

}

/**
 * VOLATILE MEMORY LAYER & FACADE (Workspace Manager)
 */
export class WorkspaceManager {
    private storage = new IndexedDBEngine();
    private pendingUploads = new Map<number, Blob>();
    private pendingDeletes = new Set<number>();
    private commitPromise: Promise<void> | null = null;

    public async getProjectList(): Promise<{ name: string, lastModified: number }[]> {
        return this.storage.getProjectList();
    }

    public async saveProject(title: string, projectUid: string, data: ProjectData): Promise<void> {
        await this.storage.saveProject(title, projectUid, data);
        await this.commitStagedChanges(projectUid, data.figures);
    }

    public async loadProject(title: string): Promise<ProjectRecord | null> {
        this.resetActiveImageCache();

        const project = await this.storage.loadProject(title);
        if (project?.projectUid) {
            await this.storage.cleanupOrphanFigures(project.projectUid, new Set(project.figures.map(f => f.id)));
        }
        return project;
    }

    public async deleteProject(title: string): Promise<void> {
        const project = await this.storage.loadProject(title);
        if (!project) return;
        return this.storage.deleteProject(title, project.projectUid);
    }

    /** Removes only the metadata record (rename) — figure blobs stay under their uid. */
    public async deleteProjectRecord(title: string): Promise<void> {
        return this.storage.deleteProjectRecordOnly(title);
    }

    public async cloneProjectFigures(oldUid: string, newUid: string): Promise<void> {
        return this.storage.cloneProjectFigures(oldUid, newUid);
    }

    public clearStagedChanges(): void {
        this.pendingUploads.clear();
        this.pendingDeletes.clear();
    }

    /** Shallow copy of the current staging buffer (Blobs are shared by reference). */
    public getStagingSnapshot(): StagingSnapshot {
        return {
            uploads: new Map(this.pendingUploads),
            deletes: new Set(this.pendingDeletes),
        };
    }

    public restoreStagingSnapshot(snap: StagingSnapshot): void {
        const candidates = new Set<number>([
            ...this.pendingUploads.keys(), ...this.pendingDeletes,
            ...snap.uploads.keys(), ...snap.deletes,
        ]);
        for (const id of candidates) {
            const sameUpload = this.pendingUploads.get(id) === snap.uploads.get(id);
            const sameDelete = this.pendingDeletes.has(id) === snap.deletes.has(id);
            if (sameUpload && sameDelete) continue; // source unchanged — keep the thumbnail

            const url = activeObjectURLs.get(id);
            if (url) {
                URL.revokeObjectURL(url);
                activeObjectURLs.delete(id);
            }
        }
        this.pendingUploads = new Map(snap.uploads);
        this.pendingDeletes = new Set(snap.deletes);
    }

    public resetActiveImageCache(): void {
        revokeStoredObjectURLs();
        this.clearStagedChanges();
    }

    public deleteFigureBinary(id: number): void {
        this.pendingUploads.delete(id);
        this.pendingDeletes.add(id);
    }

    public uploadFigureBinary(id: number, blob: Blob): void {
        this.pendingDeletes.delete(id); // A fresh upload supersedes a staged delete
        this.pendingUploads.set(id, blob);
    }

    public async getFigureBinary(projectUid: string, id: number): Promise<Blob | null> {
        if (this.pendingUploads.has(id)) return this.pendingUploads.get(id)!;
        if (this.pendingDeletes.has(id)) return null; // Removed but not yet committed
        return this.storage.getFigure(projectUid, id);
    }

    public async commitStagedChanges(projectUid: string, activeFigures: Figure[]): Promise<void> {
        const previous = this.commitPromise ?? Promise.resolve();
        const uploads = new Map(this.pendingUploads);
        const deletes = new Set(this.pendingDeletes);

        const run = (async () => {
            await previous.catch(() => { });

            try {
                const activeIds = new Set<number>(activeFigures.map((f) => f.id));

                for (const [id, blob] of uploads) {
                    if (activeIds.has(id)) {
                        await this.storage.saveFigure(projectUid, id, blob);
                    }
                }

                for (const id of deletes) {
                    await this.storage.deleteFigure(projectUid, id);
                }

                await this.storage.cleanupOrphanFigures(projectUid, activeIds);

                for (const [id, blob] of uploads) {
                    if (this.pendingUploads.get(id) === blob) this.pendingUploads.delete(id);
                }
                for (const id of deletes) {
                    this.pendingDeletes.delete(id);
                }
            } catch (error: unknown) {
                if (error instanceof Error && error.name === 'QuotaExceededError') {
                    alert("⚠️ Browser storage is full! Could not save the latest images. Please delete old workspaces to free up space.");
                }
                throw error;
            }
        })();

        const tracked = run.finally(() => {
            if (this.commitPromise === tracked) this.commitPromise = null;
        });
        this.commitPromise = tracked;

        return tracked;
    }
}

// Unified global instances
export const workspaceStorage = new WorkspaceManager();
export const activeObjectURLs = new Map<number, string>();

/**
 * Converts a Blob to base64. Useful for data exports or fallback workflows.
 */
export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Revokes every cached figure object-URL to prevent client-side memory exhaustion.
 * Internal to the storage layer — callers go through WorkspaceManager.resetActiveImageCache().
 */
function revokeStoredObjectURLs(): void {
    for (const url of activeObjectURLs.values()) {
        URL.revokeObjectURL(url);
    }
    activeObjectURLs.clear();
}