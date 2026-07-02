// editor/richText/caret.ts
// The bridge between the contenteditable DOM and the source string. Three concerns,
// all sharing ONE accounting convention so offsets round-trip exactly:
//
//   source length of a node = text -> textContent.length
//                             chip -> data-src.length
//                             mark -> data-open.length + <children> + data-close.length
//
//   * serialize(root)      DOM -> source string (reads user edits back out)
//   * captureRange(root)   current selection -> {start,end} source offsets
//   * setSelection(...)    {start,end} source offsets -> DOM selection (after re-render)
//
// Because mark delimiters are hidden and chips are atomic, a source offset may point
// "inside" a hidden region; restoration clamps to the nearest real caret position.

const TEXT = Node.TEXT_NODE;
const ELEMENT = Node.ELEMENT_NODE;

function isChip(el: Element): boolean {
    return (el as HTMLElement).dataset.src !== undefined;
}

/** DOM subtree -> the source string it represents. */
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

/** One DFS that records, in source-offset space: the range each text node covers, and
 *  a caret-placeable DOM position at every inter-child boundary (used to land the caret
 *  next to chips / at the very end, where no text node exists). */
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
                    cursor += (c.dataset.src ?? '').length;
                } else {
                    cursor += (c.dataset.open ?? '').length;
                    walk(c);
                    cursor += (c.dataset.close ?? '').length;
                }
            }
            positions.push({ src: cursor, container: el, offset: idx + 1 });
        });
    };

    walk(root);
    return { stops, positions };
}

/** Source offset of a single (node, offset) DOM caret position within `root`. */
function offsetOfPoint(root: Node, node: Node, offset: number): number {
    // Chips are atomic: no caret position exists inside one. A point inside a chip's
    // subtree (the browser can produce one — e.g. a triple-click selection endpoint,
    // or a caret parked at the chip after Backspace) is snapped to the chip's
    // boundary: its start when at the leading edge, otherwise its end.
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

    // Accumulate the source length of everything before the point, in document order.
    let total = 0;
    let done = false;

    const fullLen = (n: Node): number => {
        if (n.nodeType === TEXT) return (n.textContent ?? '').length;
        const el = n as HTMLElement;
        if (isChip(el)) return (el.dataset.src ?? '').length;
        let s = (el.dataset.open ?? '').length + (el.dataset.close ?? '').length;
        for (const k of Array.from(el.childNodes)) s += fullLen(k);
        return s;
    };

    const walk = (el: Node) => {
        if (done) return;
        // Point given as (element, offset): it sits before child index `offset`.
        if (el === node && el.nodeType !== TEXT) {
            for (let i = 0; i < offset; i++) total += fullLen(el.childNodes[i]);
            done = true;
            return;
        }
        for (const child of Array.from(el.childNodes)) {
            if (done) return;
            // Point given as (textNode, offset): `offset` chars into this text node.
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
                    total += (c.dataset.src ?? '').length;
                } else {
                    total += (c.dataset.open ?? '').length; // enter: hidden opener
                    walk(c);
                    if (done) return;
                    total += (c.dataset.close ?? '').length; // leave: hidden closer
                }
            }
        }
    };

    walk(root);
    return total;
}

/** Current selection as source offsets, or null when the selection isn't in `root`. */
export function captureRange(root: HTMLElement): { start: number; end: number } | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const r = sel.getRangeAt(0);
    if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
    const a = offsetOfPoint(root, r.startContainer, r.startOffset);
    const b = offsetOfPoint(root, r.endContainer, r.endOffset);
    return { start: Math.min(a, b), end: Math.max(a, b) };
}

/** Maps a source offset to a concrete DOM caret position, clamping into hidden regions
 *  and chips to the nearest real position (and to the very end when past all text). */
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

/** Restores a selection (collapsed when start===end) from source offsets. */
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
