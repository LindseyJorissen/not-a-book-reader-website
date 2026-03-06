/* ════════════════════════════════════════════════════════════════
   pdf-reader.js — PDF rendering via pdf.js (client-side only)
   ════════════════════════════════════════════════════════════════ */

const PDF_WORKER_SRC =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

class PDFReader {
  /**
   * @param {HTMLElement} container  - The #pdf-container div
   * @param {object}      callbacks  - { onReady, onProgress, onPageChange, onError }
   */
  constructor(container, callbacks = {}) {
    this.container = container;
    this.cb = callbacks;
    this.pdf = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.scale = 1.5;
    this._bookKey = null;
    this._activeRenderTask = null;
  }

  /* ── Load ──────────────────────────────────────────────────── */
  async load(arrayBuffer) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      this.pdf = await loadingTask.promise;
      this.totalPages = this.pdf.numPages;

      // Key by file size (good enough for progress persistence)
      this._bookKey = `nabr-pdf-${arrayBuffer.byteLength}`;
      const saved = parseInt(localStorage.getItem(this._bookKey) || '1', 10);
      this.currentPage = Math.max(1, Math.min(saved, this.totalPages));

      // Try to get PDF title from metadata
      let title = 'PDF Document';
      try {
        const meta = await this.pdf.getMetadata();
        title = meta.info?.Title || title;
      } catch (_) { /* metadata optional */ }

      await this.renderPage(this.currentPage);

      this.cb.onReady?.({ title, totalPages: this.totalPages });

    } catch (err) {
      this.cb.onError?.(`Failed to open PDF: ${err.message}`);
    }
  }

  /* ── Render a single page ──────────────────────────────────── */
  async renderPage(pageNum) {
    if (!this.pdf) return;
    pageNum = Math.max(1, Math.min(pageNum, this.totalPages));

    // Cancel any in-progress render
    if (this._activeRenderTask) {
      try { this._activeRenderTask.cancel(); } catch (_) {}
      this._activeRenderTask = null;
    }

    this.currentPage = pageNum;
    this.container.innerHTML = '';

    const page = await this.pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: this.scale });

    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-page';
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    this.container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const renderTask = page.render({ canvasContext: ctx, viewport });
    this._activeRenderTask = renderTask;

    try {
      await renderTask.promise;
    } catch (err) {
      if (err?.name === 'RenderingCancelledException') return;
      throw err;
    }
    this._activeRenderTask = null;

    // Progress and page info
    const progress = this.totalPages > 1
      ? (pageNum - 1) / (this.totalPages - 1)
      : 1;
    this.cb.onProgress?.(progress);
    this.cb.onPageChange?.({ current: pageNum, total: this.totalPages });

    // Persist progress
    if (this._bookKey) {
      localStorage.setItem(this._bookKey, String(pageNum));
    }
  }

  /* ── Navigation ────────────────────────────────────────────── */
  next() {
    if (this.currentPage < this.totalPages) {
      this.renderPage(this.currentPage + 1);
    }
  }

  prev() {
    if (this.currentPage > 1) {
      this.renderPage(this.currentPage - 1);
    }
  }

  goToPage(n) { this.renderPage(n); }

  /* ── Zoom ──────────────────────────────────────────────────── */
  zoomIn()  { this._setScale(Math.min(this.scale + 0.25, 4.0)); }
  zoomOut() { this._setScale(Math.max(this.scale - 0.25, 0.5)); }

  _setScale(scale) {
    this.scale = scale;
    this.renderPage(this.currentPage);
    this.cb.onZoomChange?.(Math.round(scale * 100));
  }

  get zoomPercent() { return Math.round(this.scale * 100); }

  /* ── Cleanup ───────────────────────────────────────────────── */
  destroy() {
    if (this._activeRenderTask) {
      try { this._activeRenderTask.cancel(); } catch (_) {}
    }
    this.pdf?.destroy();
    this.pdf = null;
  }
}
