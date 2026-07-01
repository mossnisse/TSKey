// exporters/htmlLightboxAssets.ts
// Self-contained CSS + JS embedded into the exported HTML document so figure
// thumbnails open a full-screen zoom/pan viewer on screen (inert on paper).
//
// This is a zero-dependency vanilla port of ui/imageLightbox.ts, which is the
// source of truth for the interaction — keep the two in rough sync. A shared
// module isn't reused here because the export must be a standalone file with no
// imports; the runtime below is deliberately kept minimal.
//
// The runtime string uses string concatenation (not template literals) on
// purpose, so it embeds cleanly inside the exporter's own template literal.

/** Lightbox styles, self-contained (concrete values, no reliance on app-only tokens). */
export const LIGHTBOX_CSS = `
    /* FIGURE ZOOM LIGHTBOX (on-screen only) */
    .print-fig-img { cursor: zoom-in; }
    .image-lightbox-overlay {
      position: fixed;
      inset: 0;
      z-index: 3000;
      display: none;
      flex-direction: column;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(4px);
    }
    .image-lightbox-toolbar {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--color-bg);
      border-bottom: 1px solid var(--color-border-light);
    }
    .image-lightbox-caption { font-size: 14px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .image-lightbox-spacer { flex: 1 1 auto; }
    .image-lightbox-zoom { min-width: 3.5em; text-align: center; font-variant-numeric: tabular-nums; font-size: 12px; color: var(--color-text-muted); }
    .image-lightbox-btn {
      background: var(--color-bg-muted);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
    }
    .image-lightbox-btn:hover { background: var(--color-border-light); }
    .image-lightbox-close { font-weight: 700; }
    .image-lightbox-stage { flex: 1 1 auto; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .image-lightbox-img { max-width: 100%; max-height: 100%; user-select: none; transform-origin: center center; will-change: transform; }

    @media print {
      .image-lightbox-overlay { display: none !important; }
      .print-fig-img { cursor: auto; }
    }`;

/** Lightbox runtime: builds the overlay lazily and opens it when a .print-fig-img is clicked. */
export const LIGHTBOX_RUNTIME_JS = `
(function () {
  var MIN_SCALE = 1, MAX_SCALE = 8;
  var overlay = null, imgEl = null, captionEl = null, zoomLabel = null, stage = null;
  var scale = 1, tx = 0, ty = 0;
  var prevBodyOverflow = '';

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function clampTranslate() {
    var overflowX = Math.max(0, (imgEl.offsetWidth * scale - stage.clientWidth) / 2);
    var overflowY = Math.max(0, (imgEl.offsetHeight * scale - stage.clientHeight) / 2);
    tx = clamp(tx, -overflowX, overflowX);
    ty = clamp(ty, -overflowY, overflowY);
  }

  function apply() {
    if (scale < MIN_SCALE) scale = MIN_SCALE;
    clampTranslate();
    imgEl.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')';
    imgEl.style.cursor = scale > MIN_SCALE ? 'grab' : 'default';
    zoomLabel.textContent = Math.round(scale * 100) + '%';
  }

  function reset() { scale = 1; tx = 0; ty = 0; apply(); }

  function zoomAt(clientX, clientY, factor) {
    var rect = stage.getBoundingClientRect();
    var cx = clientX - (rect.left + rect.width / 2);
    var cy = clientY - (rect.top + rect.height / 2);
    var newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    var ratio = newScale / scale;
    tx = cx * (1 - ratio) + tx * ratio;
    ty = cy * (1 - ratio) + ty * ratio;
    scale = newScale;
    apply();
  }

  function close() {
    if (!overlay || overlay.style.display === 'none') return;
    overlay.style.display = 'none';
    imgEl.removeAttribute('src');
    document.body.style.overflow = prevBodyOverflow;
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'image-lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="image-lightbox-toolbar">' +
        '<span class="image-lightbox-caption"></span>' +
        '<span class="image-lightbox-spacer"></span>' +
        '<button type="button" class="image-lightbox-btn" data-act="out" title="Zoom out">&#8722;</button>' +
        '<span class="image-lightbox-zoom">100%</span>' +
        '<button type="button" class="image-lightbox-btn" data-act="in" title="Zoom in">+</button>' +
        '<button type="button" class="image-lightbox-btn" data-act="reset" title="Reset zoom">Reset</button>' +
        '<button type="button" class="image-lightbox-btn image-lightbox-close" data-act="close" title="Close (Esc)">&#10005;</button>' +
      '</div>' +
      '<div class="image-lightbox-stage">' +
        '<img class="image-lightbox-img" alt="Figure" draggable="false" />' +
      '</div>';
    document.body.appendChild(overlay);

    imgEl = overlay.querySelector('.image-lightbox-img');
    captionEl = overlay.querySelector('.image-lightbox-caption');
    zoomLabel = overlay.querySelector('.image-lightbox-zoom');
    stage = overlay.querySelector('.image-lightbox-stage');

    overlay.querySelector('.image-lightbox-toolbar').addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      var act = btn && btn.dataset.act;
      if (!act) return;
      var r = stage.getBoundingClientRect();
      var midX = r.left + r.width / 2, midY = r.top + r.height / 2;
      if (act === 'in') zoomAt(midX, midY, 1.3);
      else if (act === 'out') zoomAt(midX, midY, 1 / 1.3);
      else if (act === 'reset') reset();
      else if (act === 'close') close();
    });

    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });

    stage.addEventListener('click', function (e) { if (e.target === stage) close(); });

    imgEl.addEventListener('dblclick', function (e) {
      if (scale > MIN_SCALE) reset(); else zoomAt(e.clientX, e.clientY, 2.5);
    });

    var dragging = false, lastX = 0, lastY = 0;
    imgEl.addEventListener('pointerdown', function (e) {
      if (scale <= MIN_SCALE) return;
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      imgEl.setPointerCapture(e.pointerId);
      imgEl.style.cursor = 'grabbing';
    });
    imgEl.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      tx += e.clientX - lastX; ty += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      apply();
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      try { imgEl.releasePointerCapture(e.pointerId); } catch (err) {}
      imgEl.style.cursor = scale > MIN_SCALE ? 'grab' : 'default';
    }
    imgEl.addEventListener('pointerup', endDrag);
    imgEl.addEventListener('pointercancel', endDrag);

    document.addEventListener('keydown', function (e) {
      if (overlay && overlay.style.display !== 'none' && e.key === 'Escape') { e.stopPropagation(); close(); }
    });
  }

  function open(src, caption) {
    ensureOverlay();
    if (overlay.style.display === 'none' || !overlay.style.display) {
      prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    overlay.setAttribute('aria-label', caption || 'Figure image viewer');
    captionEl.textContent = caption || '';
    imgEl.src = src;
    reset();
    overlay.style.display = 'flex';
  }

  document.addEventListener('click', function (e) {
    var img = e.target.closest('.print-fig-img');
    if (!img || !img.getAttribute('src')) return;
    open(img.getAttribute('src'), img.getAttribute('data-caption') || '');
  });
})();`;
