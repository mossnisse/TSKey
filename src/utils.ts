// utils.ts
import type { Couplet } from './store.ts';

const HTML_ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
};

/**
 * Escapes volatile HTML control characters to block XSS vector injections.
 * Uses a single-pass regex matching sequence for optimal processing speed.
 */
export function escapeHTML(str: string): string {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (match) => HTML_ESCAPE_MAP[match]);
}

/**
 * Streams a raw payload string out of runtime memory and drops it straight 
 * into the client system filesystem as an explicit file download. Includes
 * automated fallbacks to bypass restrictive Content Security Policies (CSP).
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
    let url: string | null = null;
    let downloadAnchor: HTMLAnchorElement | null = null;

    try {
        try {
            const blob = new Blob([content], { type: mimeType });
            url = URL.createObjectURL(blob);
        } catch (cspError) {
            console.warn("Blob URL creation blocked by environment security constraints. Attempting standard Base64 encoding fallback.", cspError);

            // Modern, safe alternative to btoa(unescape(encodeURIComponent(content)))
            const binaryBytes = new TextEncoder().encode(content);
            let binaryString = '';
            for (let i = 0; i < binaryBytes.byteLength; i++) {
                binaryString += String.fromCharCode(binaryBytes[i]);
            }
            const encodedContent = btoa(binaryString);
            url = `data:${mimeType};base64,${encodedContent}`;
        }

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

        // Only revoke memory allocations if the active URL was successfully generated as a live blob stream
        if (url && url.startsWith('blob:')) {
            const urlToRevoke = url;
            setTimeout(() => {
                URL.revokeObjectURL(urlToRevoke);
            }, 250);
        }
    }
}

/**
 * Sniffs client-side agent configurations to check if the target ecosystem
 * utilizes Apple standard human interface shortcuts (Meta/Command configurations).
 */
export const IS_MAC: boolean = (() => {
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

    // Raw userAgent string regex fallback
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.includes('macintosh') || userAgent.includes('mac os x');
})();

/**
 * Explicit Type Guard asserting whether incoming structural payloads conform 
 * cleanly to the strict data contract properties required by a Couplet array.
 */
export function isValidCoupletArray(data: any): data is Couplet[] {
    if (!Array.isArray(data)) return false;

    const seenIds = new Set<number>();

    return data.every(item => {
        const hasValidShape =
            item &&
            typeof item === 'object' &&
            typeof item.id === 'number' &&
            typeof item.alt1 === 'string' &&
            typeof item.alt2 === 'string' &&
            typeof item.link1 === 'number' &&
            typeof item.link2 === 'number' &&
            typeof item.taxa1 === 'string' &&
            typeof item.taxa2 === 'string';

        if (!hasValidShape) return false;

        // If we've already encountered this ID, the array is invalid
        if (seenIds.has(item.id)) return false;

        seenIds.add(item.id);
        return true;
    });
}

/**
 * Generates an O(1) hash map connecting unique Couplet database record IDs 
 * directly to their current dynamic arrays positional sorting coordinates.
 */
export function buildIdToIndexMap(key: readonly Couplet[]): Map<number, number> {
    const map = new Map<number, number>();
    key.forEach((c, index) => map.set(c.id, index));
    return map;
}

/**
 * Resolves a permanent record identifier into a user-facing step layout label integer.
 */
export function getStepNumberById(idToIndexMap: Map<number, number>, targetId: number): string {
    if (targetId === 0) return '0';
    const index = idToIndexMap.get(targetId);
    return index !== undefined ? (index + 1).toString() : 'INVALID ID';
}

/**
 * Validates whether a choice destination is unresolved (a broken link pointer 
 * or an accidental raw numeric string placed in a text taxon field).
 */
export function isUnresolvedLink(linkId: number, taxaStr: string, idToIndexMap: Map<number, number>): boolean {
    // If a link exists (not 0), check if its target ID is missing from the index map
    if (linkId !== 0) {
        return idToIndexMap.get(linkId) === undefined;
    }
    // If no link exists, check if the text field contains a raw number (e.g., user typed "3" instead of selecting a link)
    return /^\d+$/.test(taxaStr);
}