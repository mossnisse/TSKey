// utils.ts
import type { Couplet, Figure } from './store.ts';

const HTML_ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
};

export function escapeHTML(str: string): string {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (match) => HTML_ESCAPE_MAP[match]);
}

export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
    let url: string | null = null;
    let downloadAnchor: HTMLAnchorElement | null = null;

    try {
        try {
            const blob = new Blob([content], { type: mimeType });
            url = URL.createObjectURL(blob);
        } catch (cspError) {
            console.warn("Blob URL creation blocked by environment security constraints. Attempting standard Base64 encoding fallback.", cspError);

            const binaryBytes = new TextEncoder().encode(content);

            let binaryString = '';
            const chunkSize = 8192;
            for (let i = 0; i < binaryBytes.length; i += chunkSize) {
                const chunk = binaryBytes.subarray(i, i + chunkSize);
                // @ts-ignore
                binaryString += String.fromCharCode.apply(null, chunk);
            }

            const encodedContent = btoa(binaryString);
            const safeMimeType = mimeType.toLowerCase().includes('charset=')
                ? mimeType
                : `${mimeType};charset=utf-8`;

            url = `data:${safeMimeType};base64,${encodedContent}`;
        }

        downloadAnchor = document.createElement('a');
        downloadAnchor.href = url;
        downloadAnchor.download = filename;

        downloadAnchor.style.display = 'none';
        downloadAnchor.style.pointerEvents = 'none';

        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();

        // FIX: Capture local references for the asynchronous macro-task queue
        const finalAnchor = downloadAnchor;
        const finalUrl = url;

        // Give the browser's download manager 200ms to process the stream safely
        setTimeout(() => {
            if (finalAnchor && document.body.contains(finalAnchor)) {
                document.body.removeChild(finalAnchor);
            }
            if (finalUrl && finalUrl.startsWith('blob:')) {
                URL.revokeObjectURL(finalUrl);
            }
        }, 200);

    } catch (globalError) {
        console.error("An unhandled exception occurred during file synthesis/download processing:", globalError);
        
        // Fallback: If an error occurs BEFORE scheduling the timeout, clean up immediately
        if (downloadAnchor && document.body.contains(downloadAnchor)) {
            document.body.removeChild(downloadAnchor);
        }
        if (url && url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    }
}
/**
 * Sniffs client-side agent configurations to check if the target ecosystem
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
 * Checks if the json is an valid array of Couplets.
 */
export function isValidCoupletArray(data: any): data is Couplet[] {
    if (!Array.isArray(data)) return false;

    const seenIds = new Set<number>();

    return data.every(item => {
        const hasValidShape =
            item &&
            typeof item === 'object' &&
            typeof item.id === 'number' &&
            item.id > 0 &&
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
 * Checks if the json is a valid array of Figures.
 */
export function isValidFigureArray(data: any): data is Figure[] {
    if (!Array.isArray(data)) return false;

    const seenIds = new Set<number>();

    return data.every(item => {
        const hasValidShape =
            item &&
            typeof item === 'object' &&
            typeof item.id === 'number' &&
            item.id > 0 &&
            typeof item.filename === 'string' &&
            typeof item.caption === 'string';

        if (!hasValidShape) return false;

        // Prevent duplicate figure references
        if (seenIds.has(item.id)) return false;

        seenIds.add(item.id);
        return true;
    });
}

/**
 * Generates an O(1) hash map connecting unique Couplet record IDs to their current dynamic arrays coordinates.
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
 * Generates an O(1) hash map connecting unique Figure record IDs to their sequential 1-based display numbers.
 */
export function buildFigureIdToDisplayNumMap(figures: readonly Figure[]): Map<number, number> {
    const map = new Map<number, number>();
    figures.forEach((fig, index) => {
        map.set(fig.id, index + 1);
    });
    return map;
}

/**
 * functions for handling Destination links
 */
export interface DestinationResolution {
    inputValue: string;    // Raw text to bind inside edit input boxes
    printText: string;     // Formatted layout text for the publication panel
    printClass: string;    // Target CSS class mapping for styles/errors
    isUnresolved: boolean; // Flag to trigger immediate error styling highlights
}

/**
 * Resolves a destination's raw link and taxa state into a explicit UI and print configuration.
 */
export function resolveDestination(link: number, taxa: string, idToIndexMap: Map<number, number>): DestinationResolution {
    // Case A: The destination is actively configured to point to an internal step ID
    if (link !== 0) {
        const index = idToIndexMap.get(link);
        if (index !== undefined) {
            const stepNumStr = (index + 1).toString();
            return {
                inputValue: stepNumStr,
                printText: stepNumStr,
                printClass: 'print-dest-strong',
                isUnresolved: false
            };
        }
        // Broken Link Fallback: The step pointer exists but the target card was deleted
        const fallback = taxa || '?';
        return {
            inputValue: fallback,
            printText: fallback,
            printClass: 'error-text',
            isUnresolved: true
        };
    }

    // Case B: Link is 0 (unlinked). Check if it's completely blank
    if (!taxa) {
        return {
            inputValue: '',
            printText: '...',
            printClass: '',
            isUnresolved: false
        };
    }

    // Case C: Link is 0, but user typed a raw step number that doesn't exist yet
    if (/^\d+$/.test(taxa)) {
        return {
            inputValue: taxa,
            printText: taxa,
            printClass: 'error-text',
            isUnresolved: true
        };
    }

    // Case D: Standard descriptive taxon string (e.g., "Homo sapiens")
    return {
        inputValue: taxa,
        printText: taxa,
        printClass: 'print-dest-taxon',
        isUnresolved: false
    };
}

/**
 * Robust input parser for editing. Determines if typed characters represent
 * a valid step connection, an unresolved step reference, or a plain taxon name.
 */
export function parseDestinationInput(input: string, key: readonly Couplet[]): { link: number; taxa: string } {
    const trimmed = input.trim();

    if (/^\d+$/.test(trimmed)) {
        const stepNum = parseInt(trimmed, 10);
        const index = stepNum - 1;

        if (index >= 0 && index < key.length) {
            // Target step is active in canvas: secure stable pointer connection
            return { link: key[index].id, taxa: '' };
        }
        // Target step doesn't exist yet: store raw number as an unresolved string in taxa
        return { link: 0, taxa: trimmed };
    }

    // Is descriptive textual taxon identification
    return { link: 0, taxa: trimmed };
}