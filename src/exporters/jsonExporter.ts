// exporters/jsonExporter.ts
import { KeyStore, APP_NAME, APP_VERSION } from '../store.ts';
import { triggerFileDownload } from '../utils.ts';

/**
 * Wraps the current KeyStore data with application metadata and
 * triggers a client-side JSON file download.
 */
export function exportKeyToJSON(store: KeyStore): void {
    const exportPayload = {
        metadata: {
            application: APP_NAME,
            version: APP_VERSION,
            exportedAt: new Date().toISOString()
        },
        data: {
            key: store.getKey(),
            figures: store.getFigures()
        }
    };

    const content = JSON.stringify(exportPayload, null, 2);

    triggerFileDownload(
        content,
        'dichotomous_key_export.json',
        'application/json'
    );
}