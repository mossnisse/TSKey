// db.ts - Simple client-side binary storage engine

export class FigureStorageEngine {
    private dbName = 'TSKey_Binary_Store';
    private storeName = 'figures';
    private dbPromise: Promise<IDBDatabase> | null = null; 
    public pendingUploads = new Map<number, Blob>();
    public pendingDeletes = new Set<number>();

    private getDB(): Promise<IDBDatabase> {
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = () => {
                request.result.createObjectStore(this.storeName);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return this.dbPromise;
    }

    public async commitStagedChanges(): Promise<void> {
        if (this.pendingUploads.size === 0 && this.pendingDeletes.size === 0) return;

        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);

            this.pendingUploads.forEach((blob, id) => store.put(blob, id));
            this.pendingDeletes.forEach(id => store.delete(id));

            tx.oncomplete = () => {
                this.pendingUploads.clear();
                this.pendingDeletes.clear();
                resolve();
            };
            tx.onerror = () => reject(tx.error);
        });
    }

    
    public async deleteFigureBinary(id: number): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    public async getFigureBinary(id: number): Promise<Blob | null> {
        // Serve from memory if it's staged, bypassing the database
        if (this.pendingUploads.has(id)) return this.pendingUploads.get(id)!;
        if (this.pendingDeletes.has(id)) return null;

        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }
}

// Global active memory mapping engine to bypass async constraints inside hot layout updates
export const figureStorage = new FigureStorageEngine();
export const activeObjectURLs = new Map<number, string>();

/**
 * Converts a standard file Blob into a secure Base64 data URL string.
 */
export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}