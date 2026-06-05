// utils.ts
import type { Couplet } from './store.ts';

export function escapeHTML(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function getStepNumberById(key: readonly Couplet[], targetId: number): string {
    if (targetId === 0) return '0';
    const index = key.findIndex(c => c.id === targetId);
    return index !== -1 ? (index + 1).toString() : 'INVALID ID';
}

export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
    let url: string | null = null;
    let downloadAnchor: HTMLAnchorElement | null = null;

    try {
        const blob = new Blob([content], { type: mimeType });
        url = URL.createObjectURL(blob);

        downloadAnchor = document.createElement('a');
        downloadAnchor.href = url;
        downloadAnchor.download = filename;

        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
    } finally {
        // Clean up the DOM node instantly so it leaves no footprint in the document
        if (downloadAnchor && document.body.contains(downloadAnchor)) {
            document.body.removeChild(downloadAnchor);
        }
        
        // download pipeline successfully streams the data blob before its URL is destroyed.
        if (url) {
            const urlToRevoke = url; // Secure closure reference
            setTimeout(() => {
                URL.revokeObjectURL(urlToRevoke);
            }, 250);
        }
    }
}