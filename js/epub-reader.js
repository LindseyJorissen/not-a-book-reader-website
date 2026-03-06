/* ════════════════════════════════════════════════════════════════
   epub-reader.js — EPUB rendering via epub.js (client-side only)
   ════════════════════════════════════════════════════════════════ */

class EPUBReader {
  /**
   * @param {HTMLElement} container  - The #epub-container div
   * @param {object}      callbacks  - { onReady, onProgress, onChapterChange, onError }
   */
  constructor(container, callbacks = {}) {
    this.container = container;
    this.cb = callbacks;
    this.book = null;
    this.rendition = null;
    this.toc = [];
    this.currentCFI = null;
    this.locationsReady = false;
    this._resizeObserver = null;
    this._currentTheme = 'light';
    this._fontSize = 100;
  }

  /* ── Load ──────────────────────────────────────────────────── */
  async load(arrayBuffer) {
    try {
      // ePub() accepts an ArrayBuffer directly
      this.book = ePub(arrayBuffer, { openAs: 'binary' });

      // Render into container
      this.rendition = this.book.renderTo(this.container, {
        width:  '100%',
        height: '100%',
        spread: 'none',
        allowScriptedContent: false,
      });

      // Register colour themes
      this._registerThemes();
      this.rendition.themes.select(this._currentTheme);
      this.rendition.themes.fontSize(`${this._fontSize}%`);

      // Display first page (or restore saved position)
      const savedCFI = this._getSavedCFI();
      await this.rendition.display(savedCFI || undefined);

      // Load navigation (TOC)
      const nav = await this.book.loaded.navigation;
      this.toc = this._flattenTOC(nav.toc);

      // Generate locations for % progress (async, non-blocking)
      this.book.locations.generate(1500).then(() => {
        this.locationsReady = true;
        if (this.currentCFI) this._emitProgress(this.currentCFI);
      });

      // Event: page turned
      this.rendition.on('relocated', (location) => {
        this.currentCFI = location.start.cfi;
        this._saveProgress();
        if (this.locationsReady) this._emitProgress(this.currentCFI);
        const chapter = this._chapterForHref(location.start.href);
        this.cb.onChapterChange?.(chapter);
      });

      // Resize observer keeps rendition sized correctly
      this._resizeObserver = new ResizeObserver(() => {
        this.rendition?.resize('100%', '100%');
      });
      this._resizeObserver.observe(this.container);

      // Read metadata
      const meta = await this.book.loaded.metadata;
      const title  = meta.title  || 'Untitled EPUB';
      const author = Array.isArray(meta.creator)
        ? meta.creator[0]
        : (meta.creator || '');

      this.cb.onReady?.({ title, author, toc: this.toc });

    } catch (err) {
      this.cb.onError?.(`Failed to open EPUB: ${err.message}`);
    }
  }

  /* ── Navigation ────────────────────────────────────────────── */
  next() { this.rendition?.next(); }
  prev() { this.rendition?.prev(); }

  goToChapter(href) {
    if (href) this.rendition?.display(href);
  }

  /* ── Appearance ────────────────────────────────────────────── */
  setTheme(themeName) {
    this._currentTheme = themeName;
    this.rendition?.themes.select(themeName);
  }

  setFontSize(percent) {
    this._fontSize = percent;
    this.rendition?.themes.fontSize(`${percent}%`);
  }

  /* ── Cleanup ───────────────────────────────────────────────── */
  destroy() {
    this._saveProgress();
    this._resizeObserver?.disconnect();
    this.rendition?.destroy();
    this.book?.destroy();
    this.rendition = null;
    this.book = null;
  }

  /* ── Private helpers ───────────────────────────────────────── */
  _registerThemes() {
    const base = {
      'body, p, div, span, h1, h2, h3, h4, h5, h6, li, td, th': {
        'line-height': '1.75 !important',
        'transition': 'color 0.2s, background 0.2s !important',
      }
    };

    this.rendition.themes.register('light', {
      ...base,
      body: { background: '#ffffff !important', color: '#1a1a1a !important' },
    });

    this.rendition.themes.register('dark', {
      ...base,
      body: { background: '#1a1a1a !important', color: '#e0e0e0 !important' },
      'p, div, span, h1, h2, h3, h4, h5, h6, li, td, th': {
        color: '#e0e0e0 !important',
      },
      a: { color: '#c47a3a !important' },
    });

    this.rendition.themes.register('terminal', {
      ...base,
      body: {
        background: '#0d1117 !important',
        color: '#39ff14 !important',
        'font-family': '"Courier New", Consolas, monospace !important',
      },
      'p, div, span, h1, h2, h3, h4, h5, h6, li, td, th, a': {
        color: '#39ff14 !important',
      },
    });

    this.rendition.themes.register('notes', {
      ...base,
      body: { background: '#1e1e2e !important', color: '#cdd6f4 !important' },
      'p, div, span, li, td, th': { color: '#cdd6f4 !important' },
      'h1, h2, h3, h4, h5, h6': { color: '#cba6f7 !important' },
      a: { color: '#cba6f7 !important' },
    });
  }

  _flattenTOC(items, depth = 0) {
    const flat = [];
    for (const item of (items || [])) {
      flat.push({ label: item.label?.trim() || '(Untitled)', href: item.href, depth });
      if (item.subitems?.length) {
        flat.push(...this._flattenTOC(item.subitems, depth + 1));
      }
    }
    return flat;
  }

  _chapterForHref(href) {
    if (!href) return null;
    // Strip anchor
    const base = href.split('#')[0];
    return this.toc.find(t => {
      const tBase = t.href?.split('#')[0] || '';
      return tBase === base || base.endsWith(tBase) || tBase.endsWith(base);
    }) || null;
  }

  _emitProgress(cfi) {
    try {
      const pct = this.book.locations.percentageFromCfi(cfi);
      this.cb.onProgress?.(pct); // 0.0 – 1.0
    } catch (_) { /* locations may not be ready yet */ }
  }

  _bookKey() {
    try {
      // epub.js book key (ISBN / unique identifier)
      return this.book.key();
    } catch (_) {
      return null;
    }
  }

  _getSavedCFI() {
    const key = this._bookKey();
    return key ? localStorage.getItem(`nabr-epub-${key}`) : null;
  }

  _saveProgress() {
    const key = this._bookKey();
    if (key && this.currentCFI) {
      localStorage.setItem(`nabr-epub-${key}`, this.currentCFI);
    }
  }
}
