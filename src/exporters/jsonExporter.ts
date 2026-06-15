// exporters/jsonExporter.ts
import { KeyStore, APP_NAME, APP_VERSION } from '../store.ts';
import { triggerFileDownload } from '../utils.ts';
import { blobToBase64, figureStorage } from '../db.ts';

/**
 * Wraps the current KeyStore data with application metadata and
 * triggers a client-side JSON file download.
 */
export async function exportKeyToJSON(store: KeyStore): Promise<void> {
    const figures = store.getFigures();
    
    const exportedFigures = await Promise.all(figures.map(async (fig) => {
        const blob = await figureStorage.getFigureBinary(fig.id);
        let binaryData = null;
        if (blob) {
            binaryData = await blobToBase64(blob);
        }
        return {
            ...fig,
            binaryData
        };
    }));

    const exportPayload = {
        metadata: {
            application: APP_NAME,
            version: APP_VERSION,
            exportedAt: new Date().toISOString()
        },
        data: {
            key: store.getKey(),
            figures: exportedFigures
        }
    };

    const content = JSON.stringify(exportPayload, null, 2);

    triggerFileDownload(
        content,
        'dichotomous_key_export.json',
        'application/json'
    );
}