import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';

let objectUrlSequence = 0;

beforeEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: new IDBFactory(),
    });
    Object.defineProperty(globalThis, 'IDBKeyRange', {
        configurable: true,
        value: IDBKeyRange,
    });
    Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: vi.fn(() => `blob:test-${++objectUrlSequence}`),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: vi.fn(),
    });
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('prompt', vi.fn());
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});
