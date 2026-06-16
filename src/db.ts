// db.ts - Complete zero-dependency client-side storage engine

export interface ProjectRecord {
    title: string;
    dichotomousKey: any[];
    figures: any[];
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
            const request = indexedDB.open(this.dbName, 1);
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
        });

        return this.dbPromise;
    }

    private buildFigureKey(projectTitle: string, id: number): string {
        return `${projectTitle}::${id}`;
    }

    public async getProjectList(): Promise<{ name: string, lastModified: number }[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.projectsStoreName, 'readonly');
            const store = tx.objectStore(this.projectsStoreName);
            const request = store.getAll();

            request.onsuccess = () => {
                const projects = request.result.map((p: any) => ({
                    name: p.title,
                    lastModified: p.lastModified
                }));
                projects.sort((a, b) => b.lastModified - a.lastModified);
                resolve(projects);
            };
            request.onerror = () => reject(request.error);
        });
    }

    public async saveProject(title: string, key: any[], figures: any[]): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.projectsStoreName, 'readwrite');
            const store = tx.objectStore(this.projectsStoreName);
            const request = store.put({
                title,
                dichotomousKey: key,
                figures,
                lastModified: Date.now()
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    public async loadProject(title: string): Promise<ProjectRecord | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.projectsStoreName, 'readonly');
            const store = tx.objectStore(this.projectsStoreName);
            const request = store.get(title);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    public async deleteProject(title: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([this.projectsStoreName, this.figuresStoreName], 'readwrite');

            // Delete project descriptor
            const pStore = tx.objectStore(this.projectsStoreName);
            pStore.delete(title);

            //  Cascade delete all matching namespace keys via prefix validation

            const fStore = tx.objectStore(this.figuresStoreName);
            const prefix = `${title}::`;
            const range = IDBKeyRange.bound(prefix, prefix + '\uffff'); // Restricts cursor to this namespace only
            const cursorReq = fStore.openCursor(range);

            cursorReq.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest).result;
                if (cursor) {
                    cursor.delete(); // No string check needed; the range guarantees it belongs to this project
                    cursor.continue();
                }
            };

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(new Error(`Project deletion aborted for: ${title}`));
        });
    }

    public async saveFigure(projectTitle: string, id: number, blob: Blob): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.figuresStoreName, 'readwrite');
            const store = tx.objectStore(this.figuresStoreName);
            const request = store.put(blob, this.buildFigureKey(projectTitle, id));
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    public async deleteFigure(projectTitle: string, id: number): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.figuresStoreName, 'readwrite');
            const store = tx.objectStore(this.figuresStoreName);
            const request = store.delete(this.buildFigureKey(projectTitle, id));
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    public async getFigure(projectTitle: string, id: number): Promise<Blob | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.figuresStoreName, 'readonly');
            const store = tx.objectStore(this.figuresStoreName);
            const request = store.get(this.buildFigureKey(projectTitle, id));
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    public async cloneProjectFigures(oldTitle: string, newTitle: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.figuresStoreName, 'readwrite');
            const store = tx.objectStore(this.figuresStoreName);
            const prefix = `${oldTitle}::`;
            const range = IDBKeyRange.bound(prefix, prefix + '\uffff');
            const cursorReq = store.openCursor(range);

            cursorReq.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest).result;
                if (cursor) {
                    const key = cursor.key as string;
                    const id = key.split('::')[1];
                    const blob = cursor.value as Blob;

                    store.put(blob, `${newTitle}::${id}`);
                    cursor.continue();
                }
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
}

/**
 * VOLATILE MEMORY LAYER & FACADE (Workspace Manager)
 * Coordinates active session memory staging and exposes unified interfaces to KeyStore.
 */
export class WorkspaceManager {
    private storage = new IndexedDBEngine();

    private pendingUploads = new Map<number, Blob>();
    private pendingDeletes = new Set<number>();
    private isCommitting = false;

    public activeProjectTitle = 'Untitled Key';

    public async getProjectList(): Promise<{ name: string, lastModified: number }[]> {
        return this.storage.getProjectList();
    }

    public async saveProject(title: string, key: any[], figures: any[]): Promise<void> {
        return this.storage.saveProject(title, key, figures);
    }

    public async loadProject(title: string): Promise<ProjectRecord | null> {
        return this.storage.loadProject(title);
    }

    public async deleteProject(title: string): Promise<void> {
        return this.storage.deleteProject(title);
    }

    public async cloneProjectFigures(oldTitle: string, newTitle: string): Promise<void> {
        return this.storage.cloneProjectFigures(oldTitle, newTitle);
    }

    public clearStagedChanges(): void {
        this.pendingUploads.clear();
        this.pendingDeletes.clear();
    }

    public deleteFigureBinary(id: number): void {
        this.pendingDeletes.add(id);
        this.pendingUploads.delete(id);
    }

    public uploadFigureBinary(id: number, blob: Blob): void {
        this.pendingUploads.set(id, blob);
        this.pendingDeletes.delete(id);
    }

    public async getFigureBinary(id: number): Promise<Blob | null> {
        if (this.pendingUploads.has(id)) return this.pendingUploads.get(id)!;
        if (this.pendingDeletes.has(id)) return null;

        return this.storage.getFigure(this.activeProjectTitle, id);
    }

    public async commitStagedChanges(): Promise<void> {
        if (this.isCommitting) return;
        if (this.pendingUploads.size === 0 && this.pendingDeletes.size === 0) return;

        this.isCommitting = true;

        try {
            // Sequential await loops prevent transaction overlaps on single object stores
            for (const [id, blob] of this.pendingUploads.entries()) {
                await this.storage.saveFigure(this.activeProjectTitle, id, blob);
            }
            for (const id of this.pendingDeletes) {
                await this.storage.deleteFigure(this.activeProjectTitle, id);
            }
            this.clearStagedChanges();
        } finally {
            this.isCommitting = false;
        }
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