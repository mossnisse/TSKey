// exporters/jsonExporter.ts
import { KeyStore, APP_NAME, APP_VERSION } from '../store.ts';
import { triggerFileDownload, sanitizeFilename } from '../utils.ts';
import { blobToBase64, workspaceStorage } from '../db.ts';

export async function exportKeyToJSON(store: KeyStore): Promise<void> {
    const figures = store.getFigures();
    
    const exportedFigures = await Promise.all(figures.map(async (fig) => {
        const blob = await workspaceStorage.getFigureBinary(fig.id);
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
            title: store.getTitle(), // Embed title into the payload
            key: store.getKey(),
            figures: exportedFigures
        }
    };

    const content = JSON.stringify(exportPayload, null, 2);
    
    // Dynamically generate the filename using your sanitized utility
    const filename = sanitizeFilename(store.getTitle(), '.tskey');

    triggerFileDownload(content, filename, 'application/json');
}