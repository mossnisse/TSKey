// store/index.ts
// Public surface of the store module: the document model + state coordinator
// (keyStore) and the persistence layer (db), plus the one taxon helper used
// outside the module. Consumers import from '../store'; files inside store/
// import each other directly (and utils.ts/figureTokens.ts, which the store
// depends on, import the model types from './store/keyStore.ts' directly).
export * from './keyStore.ts';
export * from './db.ts';
export { findTaxonByName } from './taxonOps.ts';
