// ui/imageLightbox.ts
// A self-contained full-screen image viewer for figure previews: wheel/button
// zoom (centered on the cursor) and drag-to-pan. Created lazily as a body-level
// singleton and reused for every figure, so it needs no setup wiring — callers
// just invoke openImageLightbox(src, caption).

let overlay: HTMLElement | null = null;
let imgEl!: HTMLImageElement;
let captionEl!: HTMLElement;
let zoomLabel!: HTMLElement;

let scale = 1;
let tx = 0;
let ty = 0;

// Restored on close so the dialog leaves the page exactly as it found it.
let prevBodyOverflow = '';
let lastFocused: HTMLElement | null = null;

const MIN_SCALE = 1;
const MAX_SCALE = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Clamps the pan so the scaled image can't be dragged off the stage. */
function clampTranslate(): void {
    const stage = imgEl.parentElement as HTMLElement;
    const overflowX = Math.max(0, (imgEl.offsetWidth * scale - stage.clientWidth) / 2);
    const overflowY = Math.max(0, (imgEl.offsetHeight * scale - stage.clientHeight) / 2);
    tx = clamp(tx, -overflowX, overflowX);
    ty = clamp(ty, -overflowY, overflowY);
}

/** Pushes the current scale/translation onto the image and refreshes the readout. */
function apply(): void {
    if (scale < MIN_SCALE) scale = MIN_SCALE;
    clampTranslate();
    imgEl.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    imgEl.style.cursor = scale > MIN_SCALE ? 'grab' : 'default';
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
}

function reset(): void { scale = 1; tx = 0; ty = 0; apply(); }

/**
 * Zooms by `factor` while keeping the point under (clientX, clientY) fixed.
 * Transform is `translate(t) scale(s)` about the stage centre, so for a screen
 * offset c from that centre: t' = c·(1 − s'/s) + t·(s'/s).
 */
function zoomAt(clientX: number, clientY: number, factor: number): void {
    const rect = imgEl.parentElement!.getBoundingClientRect();
    const cx = clientX - (rect.left + rect.width / 2);
    const cy = clientY - (rect.top + rect.height / 2);
    const newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    const ratio = newScale / scale;
    tx = cx * (1 - ratio) + tx * ratio;
    ty = cy * (1 - ratio) + ty * ratio;
    scale = newScale;
    apply();
}

function close(): void {
    if (!overlay || overlay.style.display === 'none') return;
    overlay.style.display = 'none';
    imgEl.removeAttribute('src');
    document.body.style.overflow = prevBodyOverflow;
    lastFocused?.focus?.();
    lastFocused = null;
}

function ensureOverlay(): void {
    if (overlay) return;
    // Guard against a stale node left over by a hot reload.
    document.getElementById('image-lightbox')?.remove();

    overlay = document.createElement('div');
    overlay.id = 'image-lightbox';
    overlay.className = 'image-lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.display = 'none';
    overlay.innerHTML = `
        <div class="image-lightbox-toolbar">
            <span class="image-lightbox-caption"></span>
            <span class="image-lightbox-spacer"></span>
            <button type="button" class="image-lightbox-btn" data-act="out" title="Zoom out">−</button>
            <span class="image-lightbox-zoom">100%</span>
            <button type="button" class="image-lightbox-btn" data-act="in" title="Zoom in">+</button>
            <button type="button" class="image-lightbox-btn" data-act="reset" title="Reset zoom">Reset</button>
            <button type="button" class="image-lightbox-btn image-lightbox-close" data-act="close" title="Close (Esc)">✕</button>
        </div>
        <div class="image-lightbox-stage">
            <img class="image-lightbox-img" alt="Figure" draggable="false" />
        </div>`;
    document.body.appendChild(overlay);

    imgEl = overlay.querySelector('.image-lightbox-img') as HTMLImageElement;
    captionEl = overlay.querySelector('.image-lightbox-caption') as HTMLElement;
    zoomLabel = overlay.querySelector('.image-lightbox-zoom') as HTMLElement;
    const stage = overlay.querySelector('.image-lightbox-stage') as HTMLElement;

    overlay.querySelector('.image-lightbox-toolbar')!.addEventListener('click', (e) => {
        const act = (e.target as HTMLElement).closest('button')?.dataset.act;
        if (!act) return;
        const r = stage.getBoundingClientRect();
        const midX = r.left + r.width / 2;
        const midY = r.top + r.height / 2;
        if (act === 'in') zoomAt(midX, midY, 1.3);
        else if (act === 'out') zoomAt(midX, midY, 1 / 1.3);
        else if (act === 'reset') reset();
        else if (act === 'close') close();
    });

    stage.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });

    // Click the empty backdrop around the image to dismiss.
    stage.addEventListener('click', (e) => { if (e.target === stage) close(); });

    // Double-click toggles between fit and a 2.5x zoom at the cursor.
    imgEl.addEventListener('dblclick', (e) => {
        if (scale > MIN_SCALE) reset(); else zoomAt(e.clientX, e.clientY, 2.5);
    });

    // Drag to pan once zoomed in.
    let dragging = false, lastX = 0, lastY = 0;
    imgEl.addEventListener('pointerdown', (e) => {
        if (scale <= MIN_SCALE) return;
        dragging = true; lastX = e.clientX; lastY = e.clientY;
        imgEl.setPointerCapture(e.pointerId);
        imgEl.style.cursor = 'grabbing';
    });
    imgEl.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        tx += e.clientX - lastX; ty += e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        apply();
    });
    const endDrag = (e: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        try { imgEl.releasePointerCapture(e.pointerId); } catch { /* already released */ }
        imgEl.style.cursor = scale > MIN_SCALE ? 'grab' : 'default';
    };
    imgEl.addEventListener('pointerup', endDrag);
    imgEl.addEventListener('pointercancel', endDrag);

    document.addEventListener('keydown', (e) => {
        if (overlay && overlay.style.display !== 'none' && e.key === 'Escape') {
            e.stopPropagation();
            close();
        }
    });
}

/** Opens the viewer on `src`, resetting zoom; `caption` labels the toolbar. */
export function openImageLightbox(src: string, caption = ''): void {
    ensureOverlay();
    // Lock page scroll and remember focus only on a genuine open, not a re-open.
    if (overlay!.style.display === 'none') {
        prevBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        lastFocused = document.activeElement as HTMLElement | null;
    }
    overlay!.setAttribute('aria-label', caption || 'Figure image viewer');
    captionEl.textContent = caption;
    imgEl.src = src;
    reset();
    overlay!.style.display = 'flex';
    (overlay!.querySelector('.image-lightbox-close') as HTMLElement | null)?.focus();
}
