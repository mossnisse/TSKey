import type { StoredOcrLanguage } from './pdfTypes.ts';

const DB_NAME = 'TSKey_OCR_Languages';
const DB_VERSION = 1;
const STORE_NAME = 'languages';

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'code' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error('OCR language storage was aborted.'));
    });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function languageCodeFromFilename(filename: string): string | null {
    const match = filename.trim().match(/^([A-Za-z0-9_]+)\.traineddata(?:\.gz)?$/i);
    return match?.[1].toLowerCase() ?? null;
}

export async function listStoredOcrLanguages(): Promise<StoredOcrLanguage[]> {
    const db = await openDatabase();
    try {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const records = await requestValue(transaction.objectStore(STORE_NAME).getAll() as IDBRequest<StoredOcrLanguage[]>);
        return records.sort((a, b) => a.code.localeCompare(b.code));
    } finally {
        db.close();
    }
}

export async function saveOcrLanguage(language: StoredOcrLanguage): Promise<void> {
    const db = await openDatabase();
    try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(language);
        await transactionDone(transaction);
    } finally {
        db.close();
    }
}

export async function getStoredOcrLanguage(code: string): Promise<StoredOcrLanguage | null> {
    const db = await openDatabase();
    try {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const record = await requestValue(transaction.objectStore(STORE_NAME).get(code) as IDBRequest<StoredOcrLanguage | undefined>);
        return record ?? null;
    } finally {
        db.close();
    }
}
