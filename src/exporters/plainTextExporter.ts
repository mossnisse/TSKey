// plainTextExporter.ts
import type { KeyStore } from '../store.ts';
import { showToast } from '../uiRenderer.ts';
import { getStepNumberById, triggerFileDownload } from '../utils.ts';

/**
 * Compiles the dichotomous key into a cleanly aligned plain-text document 
 * using dot leaders, executing safely via the unified download utility.
 */
export function exportKeyToPlainText(store: KeyStore): void {
    try {
        const key = store.getKey();
        let content = '';

        key.forEach((c, index) => {
            const currentDisplayNum = index + 1;
            
            // Resolve destinations (either a text taxon or a numerical step number)
            const dest1 = c.taxa1 
                ? c.taxa1 
                : (c.link1 ? getStepNumberById(key, c.link1) : '...');
                
            const dest2 = c.taxa2 
                ? c.taxa2 
                : (c.link2 ? getStepNumberById(key, c.link2) : '...');

            const alt1Text = c.alt1 || '___';
            const alt2Text = c.alt2 || '___';

            // Append lines to document
            content += `${currentDisplayNum}.\t${alt1Text}\t${dest1}\n`;
            content += `—\t${alt2Text}\t${dest2}\n\n`;
        });

        // Forward to the unified browser file system download thread
        triggerFileDownload(content, 'dichotomous_key.txt', 'text/plain;charset=utf-8;');
        
    } catch (error) {
        console.error('Plain Text Export system failure:', error);
        showToast('❌ An unexpected error disrupted the plain text document generation pipeline.', 'error');
    }
}