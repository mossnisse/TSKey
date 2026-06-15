// db.ts - Simple client-side binary storage engine

export class FigureStorageEngine {
    private dbName = 'TSKey_Binary_Store';
    private storeName = 'figures';
    private dbPromise: Promise<IDBDatabase> | null = null; // Caches the connection

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

    public async saveFigureBinary(id: number, file: File | Blob): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            store.put(file, id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    public async getFigureBinary(id: number): Promise<Blob | null> {
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