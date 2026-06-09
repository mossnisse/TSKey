// exporters/jsonExporter.ts
import type { KeyStore } from '../store.ts';
import { triggerFileDownload } from '../utils.ts';

/**
 * Wraps the current KeyStore data with application metadata and 
 * triggers a client-side JSON file download.
 */
export function exportKeyToJSON(store: KeyStore): void {
    const exportPayload = {
        metadata: {
            application: "TSKey",
            version: "0.0.1",
            exportedAt: new Date().toISOString()
        },
        data: store.getKey()
    };

    const content = JSON.stringify(exportPayload, null, 2);
    triggerFileDownload(content, 'dichotomous_key_export.json', 'application/json');
}