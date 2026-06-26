// exporters/jsonExporter.ts
import { KeyStore, APP_NAME, APP_VERSION } from '../store.ts';
import { triggerFileDownload, sanitizeFilename } from '../utils.ts';
import { blobToBase64, workspaceStorage } from '../db.ts';
import { showToast } from '../uiRenderer.ts';

export async function exportKeyToJSON(store: KeyStore): Promise<void> {
    try {
        const figures = store.getFigures();
        const exportedFigures = [];

        const projectUid = store.getActiveProjectUid();
        for (const fig of figures) {
            const blob = await workspaceStorage.getFigureBinary(projectUid, fig.id);
            let binaryData = null;

            if (blob) {
                binaryData = await blobToBase64(blob);
            }

            exportedFigures.push({
                ...fig,
                binaryData
            });
        }

        const exportPayload = {
            metadata: {
                application: APP_NAME,
                version: APP_VERSION,
                exportedAt: new Date().toISOString()
            },
            title: store.getTitle(),
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
    } catch (error) {
        console.error('JSON (.tskey) export system failure:', error);
        showToast('❌ An unexpected error disrupted the .tskey file export.', 'error');
    }
}
