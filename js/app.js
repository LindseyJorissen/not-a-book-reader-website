/* ════════════════════════════════════════════════════════════════
   app.js — Main application controller
   ════════════════════════════════════════════════════════════════ */

/* ── Layout configuration ────────────────────────────────────── */
const LAYOUTS = {
  standard: {
    name: 'Standard Reader',
    epubTheme: 'light',
    placeholders: {
      topbar:  '[ TOP BAR — APP HEADER / TOOLBAR IMAGE GOES HERE ]',
      content: '[ CONTENT AREA — DOCUMENT RENDERED HERE ]',
    },
    termCmd: null,
    sidebarLabel: 'Chapters',
    emailFrom: null,
  },
  email: {
    name: 'Email Client',
    epubTheme: 'light',
    placeholders: {
      topbar:     '[ TOP BAR — EMAIL CLIENT HEADER IMAGE GOES HERE ]',
      sidebar:    '[ LEFT SIDEBAR — EMAIL FOLDER LIST IMAGE GOES HERE ]',
      msgheader:  '[ MESSAGE HEADER — EMAIL SUBJECT / SENDER IMAGE GOES HERE ]',
      content:    '[ EMAIL BODY AREA — DOCUMENT RENDERED HERE ]',
    },
    termCmd: null,
    sidebarLabel: 'Folders',
    emailFrom: 'library@yourbookshelf.local',
  },
  terminal: {
    name: 'Terminal',
    epubTheme: 'terminal',
    placeholders: {
      topbar:  '[ TERMINAL HEADER BAR — WINDOW CONTROLS IMAGE GOES HERE ]',
      content: '[ TERMINAL OUTPUT AREA — DOCUMENT RENDERED HERE ]',
    },
    termCmd: 'cat document.epub | read --mode=focus',
    sidebarLabel: null,
    emailFrom: null,
  },
  notes: {
    name: 'Notes App',
    epubTheme: 'notes',
    placeholders: {
      topbar:   '[ TOP BAR — NOTES APP HEADER IMAGE GOES HERE ]',
      sidebar:  '[ LEFT SIDEBAR — NOTE TREE / FOLDER IMAGE GOES HERE ]',
      content:  '[ MAIN DOCUMENT AREA — DOCUMENT RENDERED HERE ]',
    },
    termCmd: null,
    sidebarLabel: 'Notes',
    emailFrom: null,
  },
  'document-editor': {
    name: 'Document Editor',
    epubTheme: 'light',
    placeholders: {
      topbar:  '[ TOOLBAR — EDITOR BUTTONS IMAGE GOES HERE ]',
      content: '[ DOCUMENT PAGE AREA — DOCUMENT RENDERED HERE ]',
    },
    termCmd: null,
    sidebarLabel: null,
    emailFrom: null,
  },
  'file-explorer': {
    name: 'File Explorer',
    epubTheme: 'light',
    placeholders: {
      topbar:   '[ TOP BAR — FILE EXPLORER HEADER IMAGE GOES HERE ]',
      sidebar:  '[ LEFT SIDEBAR — CHAPTERS AS FILES / FOLDERS GOES HERE ]',
      content:  '[ DOCUMENT VIEWER — FILE CONTENT RENDERED HERE ]',
    },
    termCmd: null,
    sidebarLabel: 'This PC > Documents > Books',
    emailFrom: null,
  },
  excel: {
    name: 'Spreadsheet',
    epubTheme: 'light',
    placeholders: {
      topbar:  '[ RIBBON — EXCEL TOOLBAR IMAGE GOES HERE ]',
      content: '[ SPREADSHEET CELL — DOCUMENT RENDERED HERE ]',
    },
    termCmd: null,
    sidebarLabel: null,
    emailFrom: null,
  },
};

/* ── App state ───────────────────────────────────────────────── */
const state = {
  layout: localStorage.getItem('nabr-layout') || 'standard',
  fileType: null,   // 'epub' | 'pdf'
  isDark: localStorage.getItem('nabr-dark') === 'true',
  showPH: localStorage.getItem('nabr-placeholders') !== 'false',
  fontSize: parseInt(localStorage.getItem('nabr-fontsize') || '100', 10),
  epubReader: null,
  pdfReader: null,
  toc: [],
  currentChapter: null,
  bookAuthor: '',
};

/* ── DOM references ──────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const dom = {
  uploadScreen:   $('upload-screen'),
  readerScreen:   $('reader-screen'),
  layoutContainer:$('layout-container'),
  fileInput:      $('file-input'),
  dropzone:       $('dropzone'),
  btnOpenFile:    $('btn-open-file'),
  layoutGrid:     $('layout-grid'),
  loadingOverlay: $('loading-overlay'),
  loadingMsg:     $('loading-msg'),
  // Reader controls
  btnBack:        $('btn-back'),
  btnPrev:        $('btn-prev'),
  btnNext:        $('btn-next'),
  btnDark:        $('btn-dark'),
  btnFontSm:      $('btn-font-sm'),
  btnFontLg:      $('btn-font-lg'),
  btnTogglePH:    $('btn-toggle-ph'),
  layoutSelect:   $('layout-select'),
  bookTitle:      $('book-title'),
  tbCenter:       $('tb-center'),
  pageInfo:       $('page-info'),
  progressFill:   $('progress-fill'),
  sidebarList:    $('sidebar-list'),
  sidebarHeader:  $('sidebar-header'),
  msgHeader:      $('el-msg-header'),
  emailListItems: $('email-list-items'),
  outlookSubject: $('outlook-subject'),
  outlookAvatar:  $('outlook-avatar'),
  outlookSender:  $('outlook-sender-name'),
  outlookTime:    $('outlook-msg-time'),
  outlookBadge:   $('outlook-badge'),
  termCmd:        $('term-cmd'),
  pdfZoom:        $('pdf-zoom'),
  btnZoomIn:      $('btn-zoom-in'),
  btnZoomOut:     $('btn-zoom-out'),
  zoomLabel:      $('zoom-label'),
  epubContainer:  $('epub-container'),
  pdfContainer:   $('pdf-container'),
  feActiveFolder: $('fe-active-folder'),
  // Placeholders
  phTopbar:  $('ph-top-bar'),
  phSidebar: $('ph-sidebar'),
  phMsgHdr:  $('ph-msg-header'),
  phContent: $('ph-content'),
};

/* ════════════════════════════════════════════════════════════════
   INITIALISE
   ════════════════════════════════════════════════════════════════ */
function init() {
  // Apply saved preferences immediately
  applyDarkMode(state.isDark, false);
  applyPlaceholderVisibility(state.showPH);

  // Upload screen: file open button (stopPropagation prevents bubbling to dropzone)
  dom.btnOpenFile.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.fileInput.click();
  });
  dom.fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  // Drag-and-drop on dropzone
  dom.dropzone.addEventListener('click', () => dom.fileInput.click());
  dom.dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dom.dropzone.classList.add('drag-over');
  });
  dom.dropzone.addEventListener('dragleave', () => dom.dropzone.classList.remove('drag-over'));
  dom.dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dom.dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  // Layout cards on upload screen
  document.querySelectorAll('.layout-card').forEach(card => {
    if (card.dataset.layout === state.layout) card.classList.add('active');
    else card.classList.remove('active');

    card.addEventListener('click', () => {
      document.querySelectorAll('.layout-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.layout = card.dataset.layout;
      localStorage.setItem('nabr-layout', state.layout);
    });
  });

  // Reader: layout select dropdown
  dom.layoutSelect.value = state.layout;
  dom.layoutSelect.addEventListener('change', () => {
    switchLayout(dom.layoutSelect.value);
  });

  // Reader nav
  dom.btnBack.addEventListener('click', returnToUpload);
  dom.btnPrev.addEventListener('click', () => state.epubReader?.prev() || state.pdfReader?.prev());
  dom.btnNext.addEventListener('click', () => state.epubReader?.next() || state.pdfReader?.next());

  // Dark mode
  dom.btnDark.addEventListener('click', () => applyDarkMode(!state.isDark));

  // Font size
  dom.btnFontSm.addEventListener('click', () => changeFontSize(-10));
  dom.btnFontLg.addEventListener('click', () => changeFontSize(+10));

  // Placeholder toggle
  dom.btnTogglePH.addEventListener('click', () => applyPlaceholderVisibility(!state.showPH));

  // PDF zoom
  dom.btnZoomIn.addEventListener('click', () => {
    state.pdfReader?.zoomIn();
    dom.zoomLabel.textContent = state.pdfReader?.zoomPercent + '%';
  });
  dom.btnZoomOut.addEventListener('click', () => {
    state.pdfReader?.zoomOut();
    dom.zoomLabel.textContent = state.pdfReader?.zoomPercent + '%';
  });
}

/* ════════════════════════════════════════════════════════════════
   FILE HANDLING
   ════════════════════════════════════════════════════════════════ */
function handleFile(file) {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.epub') && !name.endsWith('.pdf')) {
    alert('Please open an EPUB or PDF file.');
    return;
  }

  showLoading('Opening ' + file.name + '…');

  const reader = new FileReader();
  reader.onload = async (e) => {
    const buffer = e.target.result;
    state.fileType = name.endsWith('.epub') ? 'epub' : 'pdf';

    // Tear down any previous reader
    destroyReaders();

    if (state.fileType === 'epub') {
      await loadEPUB(buffer);
    } else {
      await loadPDF(buffer);
    }
  };
  reader.onerror = () => {
    hideLoading();
    alert('Could not read the file. Please try again.');
  };
  reader.readAsArrayBuffer(file);
}

async function loadEPUB(arrayBuffer) {
  dom.epubContainer.classList.remove('hidden');
  dom.pdfContainer.classList.add('hidden');
  dom.pdfZoom.classList.add('hidden');

  state.epubReader = new EPUBReader(dom.epubContainer, {
    onReady: ({ title, toc, author }) => {
      hideLoading();
      showReaderScreen();
      switchLayout(state.layout);
      dom.bookTitle.textContent = title;
      dom.termCmd.textContent = `cat "${title}.epub"`;
      state.toc = toc;
      state.bookAuthor = author || '';
      buildSidebar(toc);
      buildChapterSelect(toc);
      buildEmailList(title, author || '');
      _updateFormulaBar(title);
      _updateFeFolder(title);
    },
    onProgress: (fraction) => {
      updateProgressBar(fraction);
    },
    onChapterChange: (chapter) => {
      if (chapter) {
        highlightSidebarItem(chapter.href);
        state.currentChapter = chapter;
        updatePageInfo(chapter.label);
        // Keep reading pane subject synced to current chapter
        if (dom.outlookSubject) dom.outlookSubject.textContent = chapter.label;
      }
    },
    onError: (msg) => {
      hideLoading();
      alert(msg);
    },
  });

  await state.epubReader.load(arrayBuffer);
}

async function loadPDF(arrayBuffer) {
  dom.epubContainer.classList.add('hidden');
  dom.pdfContainer.classList.remove('hidden');
  dom.pdfZoom.classList.remove('hidden');

  state.pdfReader = new PDFReader(dom.pdfContainer, {
    onReady: ({ title, totalPages }) => {
      hideLoading();
      showReaderScreen();
      switchLayout(state.layout);
      dom.bookTitle.textContent = title;
      dom.termCmd.textContent = `cat "${title}.pdf"`;
      // No TOC for PDF — hide chapter nav
      dom.tbCenter.innerHTML = '';
      buildEmailList(title, '');
      _updateFormulaBar(title);
      _updateFeFolder(title);
    },
    onProgress: (fraction) => {
      updateProgressBar(fraction);
    },
    onPageChange: ({ current, total }) => {
      updatePageInfo(`Page ${current} of ${total}`);
      dom.zoomLabel.textContent = state.pdfReader?.zoomPercent + '%';
    },
    onError: (msg) => {
      hideLoading();
      alert(msg);
    },
  });

  await state.pdfReader.load(arrayBuffer);
}

function destroyReaders() {
  state.epubReader?.destroy();
  state.pdfReader?.destroy();
  state.epubReader = null;
  state.pdfReader = null;
  state.toc = [];
  dom.sidebarList.innerHTML = '';
  dom.tbCenter.innerHTML = '';
  dom.epubContainer.innerHTML = '';
  dom.pdfContainer.innerHTML = '';
}

/* ════════════════════════════════════════════════════════════════
   LAYOUT SWITCHING
   ════════════════════════════════════════════════════════════════ */
function switchLayout(layoutKey) {
  const cfg = LAYOUTS[layoutKey];
  if (!cfg) return;
  state.layout = layoutKey;
  localStorage.setItem('nabr-layout', layoutKey);

  // Swap grid class on layout-container
  const lc = dom.layoutContainer;
  // Remove any existing layout-* class, then add the new one
  Array.from(lc.classList)
    .filter(c => c.startsWith('layout-'))
    .forEach(c => lc.classList.remove(c));
  lc.classList.add('layout-' + layoutKey);

  // Update layout select dropdown
  dom.layoutSelect.value = layoutKey;

  // Update placeholder text
  dom.phTopbar.querySelector('.ph-text').textContent =
    cfg.placeholders.topbar || '';
  dom.phSidebar.querySelector('.ph-text').textContent =
    cfg.placeholders.sidebar || '';
  dom.phMsgHdr.querySelector('.ph-text').textContent =
    cfg.placeholders.msgheader || '';
  dom.phContent.querySelector('.ph-text').textContent =
    cfg.placeholders.content || '';

  // Sidebar label
  if (cfg.sidebarLabel !== null) {
    dom.sidebarHeader.textContent = cfg.sidebarLabel;
  }

  // Terminal command text
  if (cfg.termCmd) {
    dom.termCmd.textContent = cfg.termCmd;
  } else if (dom.bookTitle.textContent) {
    const title = dom.bookTitle.textContent;
    dom.termCmd.textContent = state.fileType === 'epub'
      ? `cat "${title}.epub"`
      : `cat "${title}.pdf"`;
  }

  // Re-build email list when switching back to email layout
  if (layoutKey === 'email' && dom.bookTitle.textContent) {
    buildEmailList(dom.bookTitle.textContent, state.bookAuthor || '');
  }

  // Update file-explorer active folder label with book title
  if (dom.feActiveFolder && dom.bookTitle.textContent && dom.bookTitle.textContent !== 'Loading…') {
    const shortTitle = dom.bookTitle.textContent.slice(0, 24) + (dom.bookTitle.textContent.length > 24 ? '…' : '');
    dom.feActiveFolder.childNodes[0].textContent = shortTitle + ' ';
  }

  // Update Excel formula bar
  const formulaEl = document.getElementById('excel-formula-content');
  if (formulaEl && dom.bookTitle.textContent) {
    const title = dom.bookTitle.textContent;
    formulaEl.textContent = `=VLOOKUP("${title}",Library!A:Z,2,FALSE)`;
  }

  // Apply epub theme matching the layout
  if (state.epubReader) {
    let epubTheme = cfg.epubTheme;
    if (state.isDark && epubTheme === 'light') epubTheme = 'dark';
    state.epubReader.setTheme(epubTheme);
    state.epubReader.setFontSize(state.fontSize);
  }
}

/* ════════════════════════════════════════════════════════════════
   SIDEBAR (chapter list / file list)
   ════════════════════════════════════════════════════════════════ */
function buildSidebar(toc) {
  dom.sidebarList.innerHTML = '';
  if (!toc?.length) {
    dom.sidebarList.innerHTML = '<div style="padding:10px 14px;font-size:0.8rem;opacity:0.5;">No chapters found</div>';
    return;
  }
  toc.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'sidebar-item';
    btn.textContent = item.label;
    btn.style.paddingLeft = (14 + item.depth * 10) + 'px';
    btn.addEventListener('click', () => {
      state.epubReader?.goToChapter(item.href);
    });
    dom.sidebarList.appendChild(btn);
  });
}

function buildChapterSelect(toc) {
  dom.tbCenter.innerHTML = '';
  if (!toc?.length) return;
  const sel = document.createElement('select');
  sel.id = 'chapter-select';
  sel.title = 'Jump to chapter';
  toc.forEach((item, i) => {
    const opt = document.createElement('option');
    opt.value = item.href;
    opt.textContent = item.label;
    opt.style.paddingLeft = (item.depth * 8) + 'px';
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => {
    state.epubReader?.goToChapter(sel.value);
  });
  dom.tbCenter.appendChild(sel);
}

function highlightSidebarItem(href) {
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.remove('active');
  });
  // Match by href
  const items = document.querySelectorAll('.sidebar-item');
  const match = state.toc.findIndex(t =>
    t.href && href && (href.includes(t.href.split('#')[0]) || t.href.includes(href.split('#')[0]))
  );
  if (match >= 0 && items[match]) {
    items[match].classList.add('active');
    items[match].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    // Sync chapter select
    const sel = document.getElementById('chapter-select');
    if (sel) sel.value = state.toc[match].href;
  }
}

/* ════════════════════════════════════════════════════════════════
   EMAIL LIST (Outlook layout)
   ════════════════════════════════════════════════════════════════ */

// Fake emails shown below the real book email
const FAKE_EMAILS = [
  { sender: 'Sarah Chen',       initials: 'SC', color: '#8b5e3c', subject: 'Re: Q4 Budget Review Meeting',         preview: "Thanks for sending over the slides. I've reviewed the…",    time: '2:47 PM' },
  { sender: 'LinkedIn',         initials: 'in', color: '#4a4a4a', subject: 'You appeared in 12 searches this week', preview: 'Your profile is getting noticed. See who\'s viewing you…',    time: '11:05 AM' },
  { sender: 'David Park',       initials: 'DP', color: '#6b4c3b', subject: 'Design mockups for the new dashboard',  preview: "Hey! I've finished the initial mockups for the analytics…",  time: '10:34 AM' },
  { sender: 'Stripe',           initials: 'S',  color: '#5a5a5a', subject: 'Your weekly summary',                   preview: "Here's your payment activity for the week: $12,450 in…",    time: '9:15 AM' },
  { sender: 'Emma Rodriguez',   initials: 'ER', color: '#7a4040', subject: 'Quick question about the API docs',     preview: "Hi! I was going through the API documentation and c…",       time: 'Yesterday' },
  { sender: 'Figma',            initials: 'F',  color: '#a0522d', subject: "Your team's design system is ready",    preview: "The component library you've been working on has b…",        time: 'Sat' },
  { sender: 'Michael Torres',   initials: 'MT', color: '#4a5568', subject: 'Re: Client presentation feedback',      preview: "The client loved the presentation! They want to move…",      time: 'Fri' },
];

function buildEmailList(title, authorName) {
  if (!dom.emailListItems) return;
  dom.emailListItems.innerHTML = '';

  const authorInitials = (authorName || title || 'A')
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'A';

  // Update inbox badge
  if (dom.outlookBadge) dom.outlookBadge.textContent = FAKE_EMAILS.length + 1;

  // Update reading pane header
  if (dom.outlookSubject) dom.outlookSubject.textContent = title || 'Untitled';
  if (dom.outlookAvatar)  {
    dom.outlookAvatar.textContent = authorInitials;
    dom.outlookAvatar.style.background = '#b85c28';
  }
  if (dom.outlookSender) dom.outlookSender.textContent = authorName || 'Author';
  if (dom.outlookTime)   dom.outlookTime.textContent = _fakeTime();

  // --- Book email (active, unread) ---
  const bookItem = document.createElement('div');
  bookItem.className = 'email-item active unread';
  bookItem.innerHTML = `
    <div class="email-avatar-circle" style="background:#b85c28">${authorInitials}</div>
    <div class="ei-body">
      <div class="ei-top">
        <span class="ei-sender">${_esc(authorName || 'Author')}</span>
        <span class="ei-time">${_fakeTime()}</span>
      </div>
      <div class="ei-subject">${_esc(title || 'Untitled')}</div>
      <div class="ei-preview">Now reading — your uploaded book</div>
    </div>`;
  dom.emailListItems.appendChild(bookItem);

  // --- Divider ---
  const div = document.createElement('div');
  div.style.cssText = 'padding:6px 14px 2px;font-size:0.7rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.05em;';
  div.textContent = 'Last week';
  dom.emailListItems.appendChild(div);

  // --- Fake emails ---
  FAKE_EMAILS.forEach(fe => {
    const row = document.createElement('div');
    row.className = 'email-item';
    row.innerHTML = `
      <div class="email-avatar-circle" style="background:${fe.color}">${_esc(fe.initials)}</div>
      <div class="ei-body">
        <div class="ei-top">
          <span class="ei-sender">${_esc(fe.sender)}</span>
          <span class="ei-time">${_esc(fe.time)}</span>
        </div>
        <div class="ei-subject">${_esc(fe.subject)}</div>
        <div class="ei-preview">${_esc(fe.preview)}</div>
      </div>`;
    dom.emailListItems.appendChild(row);
  });
}

function _updateFormulaBar(title) {
  const el = document.getElementById('excel-formula-content');
  if (el) el.textContent = `=VLOOKUP("${title}",Library!A:Z,2,FALSE)`;
}

function _updateFeFolder(title) {
  if (!dom.feActiveFolder) return;
  const short = title.length > 26 ? title.slice(0, 26) + '…' : title;
  // First child is the text node; preserve the pin span after it
  const pin = dom.feActiveFolder.querySelector('.fe-pin');
  dom.feActiveFolder.textContent = short + ' ';
  if (pin) dom.feActiveFolder.appendChild(pin);
}

function _fakeTime() {
  const now = new Date();
  let h = now.getHours(), m = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2,'0')} ${ampm}`;
}

function _esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ════════════════════════════════════════════════════════════════
   APPEARANCE
   ════════════════════════════════════════════════════════════════ */
function applyDarkMode(dark, save = true) {
  state.isDark = dark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  dom.btnDark.textContent = dark ? '◐' : '◑';
  if (save) localStorage.setItem('nabr-dark', String(dark));

  // Update epub theme if loaded
  if (state.epubReader) {
    const cfg = LAYOUTS[state.layout] || LAYOUTS.standard;
    let theme = cfg.epubTheme;
    if (dark && theme === 'light') theme = 'dark';
    if (theme === 'terminal') theme = 'terminal'; // terminal always dark
    state.epubReader.setTheme(theme);
  }
}

function changeFontSize(delta) {
  state.fontSize = Math.max(70, Math.min(160, state.fontSize + delta));
  localStorage.setItem('nabr-fontsize', String(state.fontSize));
  state.epubReader?.setFontSize(state.fontSize);
}

function applyPlaceholderVisibility(show) {
  state.showPH = show;
  document.body.classList.toggle('ph-hidden', !show);
  dom.btnTogglePH.textContent = show ? '[ ]' : '[x]';
  dom.btnTogglePH.title = show ? 'Hide placeholders' : 'Show placeholders';
  localStorage.setItem('nabr-placeholders', String(show));
}

/* ════════════════════════════════════════════════════════════════
   UI HELPERS
   ════════════════════════════════════════════════════════════════ */
function updateProgressBar(fraction) {
  const pct = Math.round(fraction * 100);
  dom.progressFill.style.width = pct + '%';
}

function updatePageInfo(text) {
  dom.pageInfo.textContent = text;
}

function showLoading(msg) {
  dom.loadingMsg.textContent = msg || 'Loading…';
  dom.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  dom.loadingOverlay.classList.add('hidden');
}

function showReaderScreen() {
  dom.uploadScreen.classList.add('hidden');
  dom.readerScreen.classList.remove('hidden');
}

function returnToUpload() {
  destroyReaders();
  dom.readerScreen.classList.add('hidden');
  dom.uploadScreen.classList.remove('hidden');
  dom.fileInput.value = '';
  // Re-sync layout cards with current state
  document.querySelectorAll('.layout-card').forEach(card => {
    card.classList.toggle('active', card.dataset.layout === state.layout);
  });
}

/* ════════════════════════════════════════════════════════════════
   BOOT
   ════════════════════════════════════════════════════════════════ */
init();
