// db.ts - Complete client-side storage engine

export interface ProjectRecord {
    title: string;
    dichotomousKey: any[];
    figures: any[];
    lastModified: number;
}

export class WorkspaceDatabase {
    private dbName = 'TSKey_Workspace_DB';
    private projectsStoreName = 'projects';
    private figuresStoreName = 'figures';
    private dbPromise: Promise<IDBDatabase> | null = null;

    private pendingUploads = new Map<number, Blob>();
    private pendingDeletes = new Set<number>();
    private isCommitting = false;

    // Tracks the current contextual workspace to route figure binaries correctly
    public activeProjectTitle = 'Untitled Key';

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
                    // Keys for figures will be a composite array: [title, figureId]
                    db.createObjectStore(this.figuresStoreName);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return this.dbPromise;
    }

    // ==========================================
    // PROJECT WORKSPACE API
    // ==========================================

    public async getProjectList(): Promise<{ name: string, lastModified: number }[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.projectsStoreName, 'readonly');
            const store = tx.objectStore(this.projectsStoreName);
            const request = store.getAll();

            request.onsuccess = () => {
                const projects = request.result.map(p => ({
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
        if (title === this.activeProjectTitle) {
            this.clearStagedChanges();
        }
        
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([this.projectsStoreName, this.figuresStoreName], 'readwrite');

            const pStore = tx.objectStore(this.projectsStoreName);
            pStore.delete(title);

            // Sweep and remove all isolated figures attached to this project
            const fStore = tx.objectStore(this.figuresStoreName);
            const cursorReq = fStore.openCursor();
            cursorReq.onsuccess = (e) => {
                const cursor = (e.target as IDBRequest).result;
                if (cursor) {
                    const key = cursor.key as [string, number];
                    if (key[0] === title) cursor.delete();
                    cursor.continue();
                }
            };

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // ==========================================
    // FIGURE BINARY API
    // ==========================================

    public async commitStagedChanges(): Promise<void> {
        if (this.isCommitting) return;
        if (this.pendingUploads.size === 0 && this.pendingDeletes.size === 0) return;

        this.isCommitting = true;
        const db = await this.getDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.figuresStoreName, 'readwrite');
            const store = tx.objectStore(this.figuresStoreName);

            this.pendingUploads.forEach((blob, id) => store.put(blob, [this.activeProjectTitle, id]));
            this.pendingDeletes.forEach(id => store.delete([this.activeProjectTitle, id]));

            tx.oncomplete = () => {
                this.pendingUploads.clear();
                this.pendingDeletes.clear();
                this.isCommitting = false;
                resolve();
            };
            tx.onerror = () => {
                this.isCommitting = false;
                reject(tx.error);
            };
        });
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

        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.figuresStoreName, 'readonly');
            const store = tx.objectStore(this.figuresStoreName);
            const request = store.get([this.activeProjectTitle, id]);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }
}

// Global active memory mapping engine. Kept named `figureStorage` to prevent breaking your EventController.
export const figureStorage = new WorkspaceDatabase();
export const activeObjectURLs = new Map<number, string>();

export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}