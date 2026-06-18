// db.ts - Complete zero-dependency client-side storage engine
import type { Couplet, Figure } from './store.ts';

export interface ProjectRecord {
    title: string;
    projectUid: string;   // Stable identity; figure blobs are keyed by this, not the title
    dichotomousKey: Couplet[];
    figures: Figure[];
    lastModified: number;
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
                // v2: figure blobs are keyed by `${projectUid}::${id}` instead of the old
                // `${title}::${id}`. The old keys are unreadable under the new scheme, so
                // drop and recreate the store (pre-v2 images are discarded).
                if (db.objectStoreNames.contains(this.figuresStoreName)) {
                    db.deleteObjectStore(this.figuresStoreName);
                }
                db.createObjectStore(this.figuresStoreName);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error('IndexedDB open blocked by another open connection.'));
        });

        this.dbPromise.catch(() => {
            this.dbPromise = null;
        });

        return this.dbPromise;
    }

    private getFigureKey(projectUid: string, id: number): string {
        return `${projectUid}::${id}`;
    }

    private getProjectKeyRange(projectUid: string): IDBKeyRange {
        const prefix = `${projectUid}::`;
        const upper = prefix.substring(0, prefix.length - 1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
        return IDBKeyRange.bound(prefix, upper, false, true);
    }

    public async getProjectList(): Promise<{ name: string, lastModified: number }[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.projectsStoreName, 'readonly');
            const store = tx.objectStore(this.projectsStoreName);
            const request = store.getAll();

            request.onsuccess = () => {
                const records = request.result as ProjectRecord[];
                const projects = records.map((p) => ({
                    name: p.title,
                    lastModified: p.lastModified
                }));
                projects.sort((a, b) => b.lastModified - a.lastModified);
                resolve(projects);
            };
            request.onerror = () => reject(request.error);
        });
    }

    public async saveProject(title: string, projectUid: string, key: Couplet[], figures: Figure[]): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.projectsStoreName, 'readwrite');
            const store = tx.objectStore(this.projectsStoreName);

            store.put({
                title,
                projectUid,
                dichotomousKey: key,
                figures,
                lastModified: Date.now()
            });

            // Resolving on complete ensures that data is successfully committed to disk
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error(`Transaction aborted while saving project: ${title}`));
        });
    }

    public async loadProject(title: string): Promise<ProjectRecord | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.projectsStoreName, 'readonly');
            const store = tx.objectStore(this.projectsStoreName);
            const request = store.get(title);
            
            request.onsuccess = () => resolve((request.result as ProjectRecord) || null);
            request.onerror = () => reject(request.error);
        });
    }

    public async deleteProject(title: string, projectUid: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([this.projectsStoreName, this.figuresStoreName], 'readwrite');

            const pStore = tx.objectStore(this.projectsStoreName);
            pStore.delete(title);

            const fStore = tx.objectStore(this.figuresStoreName);
            const range = this.getProjectKeyRange(projectUid);
            const cursorReq = fStore.openCursor(range);

            cursorReq.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error(`Project deletion aborted for: ${title}`));
        });
    }

    /**
     * Deletes only the project metadata record, leaving its figure blobs intact.
     * Used by rename, where the new-title record keeps the same projectUid.
     */
    public async deleteProjectRecordOnly(title: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.projectsStoreName, 'readwrite');
            tx.objectStore(this.projectsStoreName).delete(title);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error(`Project record deletion aborted for: ${title}`));
        });
    }

    public async saveFigure(projectUid: string, id: number, blob: Blob): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.figuresStoreName, 'readwrite');
            const store = tx.objectStore(this.figuresStoreName);

            store.put(blob, this.getFigureKey(projectUid, id));

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error(`Transaction aborted while saving figure ID ${id}`));
        });
    }

    /**
     * Garbage Collection Engine: Deletes binary objects from IndexedDB 
     * whose IDs are no longer tracked in the active project metadata.
     */
    public async cleanupOrphanFigures(projectUid: string, activeIds: Set<number>): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.figuresStoreName, 'readwrite');
            const store = tx.objectStore(this.figuresStoreName);
            const range = this.getProjectKeyRange(projectUid);
            const cursorReq = store.openCursor(range);

            cursorReq.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
                if (cursor) {
                    const key = cursor.key as string;
                    const idParts = key.split('::');
                    const id = parseInt(idParts[idParts.length - 1], 10);

                    if (!activeIds.has(id)) {
                        cursor.delete();
                    }
                    cursor.continue();
                }
                // FIXED: Removed the dual-resolving "else" block.
            };
            
            cursorReq.onerror = () => reject(cursorReq.error);
            tx.oncomplete = () => resolve(); // Safely single-resolves here
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error(`Orphan cleanup transaction aborted for project: ${projectUid}`));
        });
    }

    public async getFigure(projectUid: string, id: number): Promise<Blob | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.figuresStoreName, 'readonly');
            const store = tx.objectStore(this.figuresStoreName);
            const request = store.get(this.getFigureKey(projectUid, id));
            
            request.onsuccess = () => resolve((request.result as Blob) || null);
            request.onerror = () => reject(request.error);
        });
    }

    public async cloneProjectFigures(oldUid: string, newUid: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.figuresStoreName, 'readwrite');
            const store = tx.objectStore(this.figuresStoreName);
            const range = this.getProjectKeyRange(oldUid);
            const cursorReq = store.openCursor(range);

            cursorReq.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
                if (cursor) {
                    const key = cursor.key as string;
                    const id = key.substring(key.lastIndexOf('::') + 2);
                    const blob = cursor.value as Blob;

                    store.put(blob, this.getFigureKey(newUid, parseInt(id, 10)));
                    cursor.continue();
                }
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error(`Cloning figures transaction aborted from "${oldUid}" to "${newUid}"`));
        });
    }

}

/**
 * VOLATILE MEMORY LAYER & FACADE (Workspace Manager)
 */
export class WorkspaceManager {
    private storage = new IndexedDBEngine();
    private pendingUploads = new Map<number, Blob>();
    private commitPromise: Promise<void> | null = null;

    public async getProjectList(): Promise<{ name: string, lastModified: number }[]> {
        return this.storage.getProjectList();
    }

    public async saveProject(title: string, projectUid: string, key: Couplet[], figures: Figure[]): Promise<void> {
        await this.storage.saveProject(title, projectUid, key, figures);
        await this.commitStagedChanges(projectUid, figures);
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
        this.clearStagedChanges();
        // Resolve the project's stable uid so its figure blobs can be removed too.
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
    }

    /**
     * Single teardown for switching the active project: drops staged (uncommitted)
     * blob uploads and revokes every cached figure object-URL. Owning this here keeps
     * callers from hand-rolling the revoke loop on every project switch.
     */
    public resetActiveImageCache(): void {
        revokeStoredObjectURLs();
        this.clearStagedChanges();
    }

    public deleteFigureBinary(id: number): void {
        this.pendingUploads.delete(id);
    }

    public uploadFigureBinary(id: number, blob: Blob): void {
        this.pendingUploads.set(id, blob);
    }

    public async getFigureBinary(projectUid: string, id: number): Promise<Blob | null> {
        if (this.pendingUploads.has(id)) return this.pendingUploads.get(id)!;
        return this.storage.getFigure(projectUid, id);
    }

    public async commitStagedChanges(projectUid: string, activeFigures: Figure[]): Promise<void> {
        const previous = this.commitPromise ?? Promise.resolve();

        const run = (async () => {
            await previous.catch(() => { });

            try {
                const activeIds = new Set<number>(activeFigures.map((f) => f.id));

                for (const [id, blob] of this.pendingUploads.entries()) {
                    if (activeIds.has(id)) {
                        await this.storage.saveFigure(projectUid, id, blob);
                    }
                }

                await this.storage.cleanupOrphanFigures(projectUid, activeIds);
                this.clearStagedChanges();
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