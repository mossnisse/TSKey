// Bridges the contenteditable DOM and the source string. Per-node source length
// (text/chip/mark) is computed in one place (sourceLen / *Len helpers) so
// captureRange and setSelection can never drift on the accounting rule.

const TEXT = Node.TEXT_NODE;
const ELEMENT = Node.ELEMENT_NODE;

function isChip(el: Element): boolean {
    return (el as HTMLElement).dataset.src !== undefined;
}

const chipLen = (el: HTMLElement): number => (el.dataset.src ?? '').length;
const openLen = (el: HTMLElement): number => (el.dataset.open ?? '').length;
const closeLen = (el: HTMLElement): number => (el.dataset.close ?? '').length;

function sourceLen(node: Node): number {
    if (node.nodeType === TEXT) return (node.textContent ?? '').length;
    const el = node as HTMLElement;
    if (isChip(el)) return chipLen(el);
    let s = openLen(el) + closeLen(el);
    for (const k of Array.from(el.childNodes)) s += sourceLen(k);
    return s;
}

export function serialize(root: Node): string {
    let out = '';
    for (const child of Array.from(root.childNodes)) {
        if (child.nodeType === TEXT) {
            out += child.textContent ?? '';
        } else if (child.nodeType === ELEMENT) {
            const el = child as HTMLElement;
            if (isChip(el)) {
                out += el.dataset.src ?? '';
            } else {
                out += (el.dataset.open ?? '') + serialize(el) + (el.dataset.close ?? '');
            }
        }
    }
    return out;
}

interface TextStop { node: Text; start: number; end: number; }
interface BoundaryPos { src: number; container: Node; offset: number; }

// Records each text node's source-offset range plus a caret-placeable DOM position at
// every inter-child boundary (needed to land the caret next to chips / at the very end).
function collectStops(root: Node): { stops: TextStop[]; positions: BoundaryPos[] } {
    const stops: TextStop[] = [];
    const positions: BoundaryPos[] = [];
    let cursor = 0;

    const walk = (el: Node) => {
        positions.push({ src: cursor, container: el, offset: 0 });
        const kids = Array.from(el.childNodes);
        kids.forEach((child, idx) => {
            if (child.nodeType === TEXT) {
                const len = (child.textContent ?? '').length;
                stops.push({ node: child as Text, start: cursor, end: cursor + len });
                cursor += len;
            } else if (child.nodeType === ELEMENT) {
                const c = child as HTMLElement;
                if (isChip(c)) {
                    cursor += chipLen(c);
                } else {
                    cursor += openLen(c);
                    walk(c);
                    cursor += closeLen(c);
                }
            }
            positions.push({ src: cursor, container: el, offset: idx + 1 });
        });
    };

    walk(root);
    return { stops, positions };
}

function offsetOfPoint(root: Node, node: Node, offset: number): number {
    // Chips are atomic: snap a point inside a chip's subtree (browsers can produce one,
    // e.g. triple-click or Backspace) to the chip's start or end boundary.
    let anc: Node | null = node;
    while (anc && anc !== root) {
        if (anc.nodeType === ELEMENT && isChip(anc as Element)) {
            const parent: Node | null = anc.parentNode;
            if (!parent) break;
            const idx = Array.prototype.indexOf.call(parent.childNodes, anc);
            node = parent;
            offset = idx + (offset === 0 ? 0 : 1);
            break;
        }
        anc = anc.parentNode;
    }

    let total = 0;
    let done = false;

    const walk = (el: Node) => {
        if (done) return;
        if (el === node && el.nodeType !== TEXT) {
            for (let i = 0; i < offset; i++) total += sourceLen(el.childNodes[i]);
            done = true;
            return;
        }
        for (const child of Array.from(el.childNodes)) {
            if (done) return;
            if (child === node && child.nodeType === TEXT) {
                total += offset;
                done = true;
                return;
            }
            if (child.nodeType === TEXT) {
                total += (child.textContent ?? '').length;
            } else if (child.nodeType === ELEMENT) {
                const c = child as HTMLElement;
                if (isChip(c)) {
                    total += chipLen(c);
                } else {
                    total += openLen(c);
                    walk(c);
                    if (done) return;
                    total += closeLen(c);
                }
            }
        }
    };

    walk(root);
    return total;
}

/** The source-offset span a single child node (e.g. an atomic chip) occupies within
 *  `root`. Used to move a chip on drag-drop, where the browser gives no text selection
 *  to read back from captureRange. */
export function sourceRangeOfNode(root: HTMLElement, node: Node): { start: number; end: number } | null {
    const parent = node.parentNode;
    if (!parent) return null;
    const idx = Array.prototype.indexOf.call(parent.childNodes, node);
    if (idx < 0) return null;
    return {
        start: offsetOfPoint(root, parent, idx),
        end: offsetOfPoint(root, parent, idx + 1),
    };
}

export function captureRange(root: HTMLElement): { start: number; end: number } | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const r = sel.getRangeAt(0);
    if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
    const a = offsetOfPoint(root, r.startContainer, r.startOffset);
    const b = offsetOfPoint(root, r.endContainer, r.endOffset);
    return { start: Math.min(a, b), end: Math.max(a, b) };
}

// Clamps into hidden regions/chips to the nearest real caret position.
function locate(root: HTMLElement, target: number, stops: TextStop[], positions: BoundaryPos[]): { node: Node; offset: number } {
    for (const s of stops) {
        if (target >= s.start && target <= s.end) return { node: s.node, offset: target - s.start };
    }
    if (positions.length === 0) return { node: root, offset: 0 };
    let best = positions[0];
    let bestDist = Math.abs(best.src - target);
    for (const p of positions) {
        const d = Math.abs(p.src - target);
        if (d < bestDist || (d === bestDist && p.src <= target)) { best = p; bestDist = d; }
    }
    return { node: best.container, offset: best.offset };
}

export function setSelection(root: HTMLElement, start: number, end: number): void {
    const sel = window.getSelection();
    if (!sel) return;
    const { stops, positions } = collectStops(root);
    const a = locate(root, start, stops, positions);
    const b = start === end ? a : locate(root, end, stops, positions);
    const range = document.createRange();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    sel.removeAllRanges();
    sel.addRange(range);
}