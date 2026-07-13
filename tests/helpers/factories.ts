import type { Branch, Couplet, Figure, Taxon } from '../../src/store/keyStore.ts';

export const emptyBranch = (): Branch => ({ kind: 'empty' });

export function couplet(id: number, fields: Partial<Couplet> = {}): Couplet {
    return {
        id,
        alt1: `Alternative ${id}a`,
        alt2: `Alternative ${id}b`,
        branch1: emptyBranch(),
        branch2: emptyBranch(),
        ...fields,
    };
}

export function figure(id: number, fields: Partial<Figure> = {}): Figure {
    return {
        id,
        filename: `figure-${id}.jpg`,
        caption: `Figure ${id}`,
        ...fields,
    };
}

export function taxon(id: number, fields: Partial<Taxon> = {}): Taxon {
    return {
        id,
        scientificName: `Species ${id}`,
        auctor: '',
        vernacularName: '',
        synonyms: [],
        description: '',
        biology: '',
        distribution: '',
        confusables: [],
        ...fields,
    };
}

export interface Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
}

export function deferred<T>(): Deferred<T> {
    let resolve!: Deferred<T>['resolve'];
    let reject!: Deferred<T>['reject'];
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}
