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

export function isMacUser(): boolean {
    // Modern User-Agent Client Hints API (Chrome, Edge, Opera)
    const userAgentData = (navigator as any).userAgentData;
    if (userAgentData?.platform) {
        return userAgentData.platform.toLowerCase().includes('mac');
    }

    // Legacy Platform fallback (Safari, Firefox, Older browsers)
    const platform = (navigator.platform || '').toLowerCase();
    if (platform.includes('mac') || platform.includes('iphone') || platform.includes('ipad') || platform.includes('ipod')) {
        return true;
    }

    // The "iPad masquerading as a Desktop Mac" exception
    // Modern iPads running Safari report their platform as "MacIntel", but they use touch interfaces
    if (platform.includes('mac') && navigator.maxTouchPoints > 1) {
        return true; 
    }

    // Raw userAgent string regex fallback (absolute safety net)
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.includes('macintosh') || userAgent.includes('mac os x');
}

export function isValidCoupletArray(data: any): data is Couplet[] {
    if (!Array.isArray(data)) return false;
    
    return data.every(item => 
        item &&
        typeof item === 'object' &&
        typeof item.id === 'number' &&
        typeof item.alt1 === 'string' &&
        typeof item.alt2 === 'string' &&
        typeof item.link1 === 'number' &&
        typeof item.link2 === 'number' &&
        typeof item.taxa1 === 'string' &&
        typeof item.taxa2 === 'string'
    );
}

export function buildIdToIndexMap(key: readonly Couplet[]): Map<number, number> {
    const map = new Map<number, number>();
    key.forEach((c, index) => map.set(c.id, index));
    return map;
}

export function getStepNumberById(idToIndexMap: Map<number, number>, targetId: number): string {
    if (targetId === 0) return '0';
    const index = idToIndexMap.get(targetId);
    return index !== undefined ? (index + 1).toString() : 'INVALID ID';
}