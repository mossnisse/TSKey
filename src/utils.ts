// utils.ts
import type { Branch, Couplet, Figure } from './store.ts';

/**
 * The shared empty destination. Branches are treated as immutable values
 * (always replaced, never mutated in place), so this single frozen instance
 * can be reused everywhere a destination is cleared.
 */
export const EMPTY_BRANCH: Branch = Object.freeze({ kind: 'empty' });

/** The couplet id a branch points at, or null when it isn't a link. */
export function branchTarget(branch: Branch): number | null {
    return branch.kind === 'linked' ? branch.targetId : null;
}

/**
 * Classifies a branch against the current key. The only state that depends on
 * the rest of the key is 'broken' — a 'linked' branch whose target id is absent
 * from idMap. Every other status is intrinsic to the branch.
 */
export type BranchStatus = 'linked' | 'broken' | 'unresolved' | 'taxon' | 'empty';

export function classifyBranch(branch: Branch, idMap: ReadonlyMap<number, unknown>): BranchStatus {
    switch (branch.kind) {
        case 'linked': return idMap.has(branch.targetId) ? 'linked' : 'broken';
        case 'unresolved': return 'unresolved';
        case 'taxon': return 'taxon';
        case 'empty': return 'empty';
    }
}

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
                binaryString += String.fromCharCode(...chunk);
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
    interface NavigatorUAData { platform?: string }
    const navWithUA = navigator as Navigator & { userAgentData?: NavigatorUAData };
    const userAgentData = navWithUA.userAgentData;
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
function isValidBranch(value: unknown): value is Branch {
    if (!value || typeof value !== 'object') return false;
    const branch = value as { kind?: unknown; targetId?: unknown; step?: unknown; name?: unknown };
    switch (branch.kind) {
        case 'linked': return typeof branch.targetId === 'number';
        case 'unresolved': return typeof branch.step === 'number';
        case 'taxon': return typeof branch.name === 'string';
        case 'empty': return true;
        default: return false;
    }
}

export function isValidCoupletArray(data: unknown): data is Couplet[] {
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
            isValidBranch(item.branch1) &&
            isValidBranch(item.branch2);

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
export function isValidFigureArray(data: unknown): data is Figure[] {
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
export function resolveDestination(branch: Branch, idToIndexMap: Map<number, number>): DestinationResolution {
    switch (branch.kind) {
        // Points at an internal step ID — resolve it to a 1-based step number
        case 'linked': {
            const index = idToIndexMap.get(branch.targetId);
            if (index !== undefined) {
                const stepNumStr = (index + 1).toString();
                return { inputValue: stepNumStr, printText: stepNumStr, printClass: 'print-dest-strong', isUnresolved: false };
            }
            // Broken: the pointer exists but the target card was deleted
            return { inputValue: '?', printText: '?', printClass: 'error-text', isUnresolved: true };
        }

        // A step number was typed before that step exists
        case 'unresolved': {
            const stepStr = branch.couplet.toString();
            return { inputValue: stepStr, printText: stepStr, printClass: 'error-text', isUnresolved: true };
        }

        // Standard descriptive taxon string (e.g., "Homo sapiens")
        case 'taxon':
            return { inputValue: branch.name, printText: branch.name, printClass: 'print-dest-taxon', isUnresolved: false };

        // Nothing entered yet
        case 'empty':
            return { inputValue: '', printText: '...', printClass: '', isUnresolved: false };
    }
}

/**
 * The label style applied to the two alternatives of every couplet. Shared by the
 * live publication view (renderPrintView) and every text/HTML/LaTeX exporter, and
 * chosen by the user in Options & Settings (persisted via UIStateStore).
 *
 *   classic  — "1." / "—"   (step number + em dash; the original look)
 *   lettered — "1a" / "1b"  (lettered sub-items)
 *   minimal  — "1"  / "-"   (bare number + hyphen)
 */
export type LeadFormat = 'classic' | 'lettered' | 'minimal';

export const DEFAULT_LEAD_FORMAT: LeadFormat = 'classic';

/** Narrows an arbitrary value (persisted prefs / user input) to a valid LeadFormat. */
export function isLeadFormat(value: unknown): value is LeadFormat {
    return value === 'classic' || value === 'lettered' || value === 'minimal';
}

export interface CoupletLeads {
    lead1: string; // marker for the first alternative
    lead2: string; // marker for the second alternative
}

/**
 * Maps each couplet id to the sorted, de-duplicated 1-based step numbers of the
 * couplets that link to it (its parents). Powers the optional "(n)" back-
 * reference after a couplet's lead. Only resolved (linked) branches count; the
 * root couplet has no entry, and a couplet reached by convergence lists every
 * parent — e.g. (1, 5).
 */
export function buildBackReferenceMap(key: readonly Couplet[]): Map<number, number[]> {
    const parents = new Map<number, Set<number>>();

    key.forEach((c, index) => {
        const stepNum = index + 1;
        for (const branch of [c.branch1, c.branch2]) {
            const target = branchTarget(branch);
            if (target === null) continue;
            let set = parents.get(target);
            if (!set) parents.set(target, (set = new Set()));
            set.add(stepNum);
        }
    });

    const result = new Map<number, number[]>();
    for (const [id, set] of parents) {
        result.set(id, [...set].sort((a, b) => a - b));
    }
    return result;
}

/**
 * Builds the two leading markers for a couplet at the given 1-based display
 * number, according to the chosen label format. When `backRefSteps` is supplied
 * and non-empty, the parent step number(s) are appended to the first lead only
 * (e.g. "2 (1)") as a back-reference for navigating upwards.
 */
export function buildCoupletLeads(format: LeadFormat, displayNum: number, backRefSteps?: readonly number[]): CoupletLeads {
    let leads: CoupletLeads;
    switch (format) {
        case 'lettered':
            leads = { lead1: `${displayNum}a`, lead2: `${displayNum}b` };
            break;
        case 'minimal':
            leads = { lead1: `${displayNum}`, lead2: '-' };
            break;
        case 'classic':
        default:
            leads = { lead1: `${displayNum}.`, lead2: '—' };
            break;
    }

    if (backRefSteps && backRefSteps.length > 0) {
        leads.lead1 += ` (${backRefSteps.join(', ')})`;
    }
    return leads;
}

/**
 * Robust input parser for editing. Determines whether typed characters represent
 * a valid step connection, an unresolved step reference, or a plain taxon name,
 * and returns the corresponding Branch.
 */
export function parseDestinationInput(input: string, key: readonly Couplet[]): Branch {
    const trimmed = input.trim();

    if (trimmed === '') return { kind: 'empty' };

    if (/^\d+$/.test(trimmed)) {
        const stepNum = parseInt(trimmed, 10);
        const index = stepNum - 1;

        if (index >= 0 && index < key.length) {
            // Target step is active in canvas: secure stable pointer connection
            return { kind: 'linked', targetId: key[index].id };
        }
        // Target step doesn't exist yet: keep the raw number as an unresolved reference
        return { kind: 'unresolved', couplet: stepNum };
    }

    // Descriptive textual taxon identification
    return { kind: 'taxon', name: trimmed };
}

export function sanitizeFilename(title: string, extension = '.tskey'): string {
    const slug = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_\-]/gi, '_') // Replace spaces and special characters with underscores
        .replace(/_+/g, '_')            // Collapse consecutive underscores
        .replace(/_$/, '');             // NEW: Strip trailing underscore

    return `${slug || 'untitled_key'}${extension}`;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null;
}