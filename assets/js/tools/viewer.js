/* ==========================================================================
   MULTI TOOL HUB — PDF Viewer & Editor
   Read, annotate, reorder, rotate, split, merge and export — entirely local.
   ========================================================================== */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var state = {
    sources: {},
    pages: [],
    active: 0,
    zoom: 1,
    zoomMode: "fit-width",
    tool: "select",
    color: "#b08832",
    fill: false,
    lw: 2,
    fs: 18,
    opacity: 1,
    selected: null,
    selectedPage: null,
    font: "Helvetica",
    align: "left",
    bold: false,
    italic: false,
    lineHeight: 1.32,
    history: [],
    future: [],
    dirty: false,
    busy: false,
    readOnly: false,
    docName: "",
    rendered: {},
    queue: [],
    pumping: false,
    version: 0,
    drag: null,
    draw: null,
    observer: null,
    resizeTimer: null,
    suppressScroll: false,
    lastPageScroll: 0
  };

  var els = {};

  function ic(name, size) { return MTH.ui.icon(name, "", size || 16); }
  function root() { return MTH.tool.stage(); }
  function q(sel) { return root().querySelector(sel); }
  function qa(sel) { return Array.prototype.slice.call(root().querySelectorAll(sel)); }
  function srcOf(page) { return state.sources[page.key]; }
  function currentPage() { return state.pages[state.active] || state.pages[0] || null; }
  function allAnnotations() {
    var out = [];
    state.pages.forEach(function (p, pi) {
      (p.annos || []).forEach(function (a) { out.push({ anno: a, page: p, pageIndex: pi }); });
    });
    return out;
  }
  function saveStateLabel() {
    var total = allAnnotations().length;
    if (els.docName) els.docName.textContent = state.docName || "No document";
    if (els.statusNote) {
      els.statusNote.textContent = state.pages.length
        ? state.pages.length + " page" + (state.pages.length === 1 ? "" : "s") + " · " + total + " annotation" + (total === 1 ? "" : "s") + (state.readOnly ? " · view only" : "")
        : "Open a PDF to begin.";
    }
    qa("[data-needs-doc]").forEach(function (b) { b.disabled = !state.pages.length || state.busy; });
    qa("[data-needs-write]").forEach(function (b) { b.disabled = !state.pages.length || state.readOnly || state.busy; });
    if (els.exportBtn) els.exportBtn.disabled = !state.pages.length || state.busy;
    if (els.readonly) els.readonly.hidden = !state.readOnly;
  }

  /* ---------- shell ---------- */
  function shell() {
    var tools = [
      ["select", "select", "Select & move"],
      ["text", "type", "Text note"],
      ["note", "note", "Sticky comment"],
      ["underline", "underline", "Underline"],
      ["strike", "strike", "Strike-through"],
      ["rect", "shape", "Rectangle"],
      ["ellipse", "shape", "Ellipse"],
      ["line", "arrow-right", "Line / arrow"],
      ["highlight", "highlight", "Highlight"],
      ["ink", "pen", "Freehand ink"],
      ["redact", "redact", "Redaction block"],
      ["whiteout", "eraser", "Whiteout"],
      ["replace", "replace", "Replace text"],
      ["signature", "signature", "Draw signature"],
      ["image", "image-plus", "Image stamp"],
      ["watermark", "watermark", "Watermark"]
    ];
    var toolBar = tools.map(function (t) {
      return '<button class="tb-btn' + (t[0] === "select" ? " on" : "") + '" type="button" data-tool="' + t[0] + '" aria-pressed="' + (t[0] === "select") + '" title="' + t[2] + '" aria-label="' + t[2] + '">' + ic(t[1]) + "</button>";
    }).join("");

    var html = [] ;
    html.push('<div class="viewer-shell" data-viewer>');
    html.push('<div class="viewer-toolbar pdf-toolbar" data-toolbar role="toolbar" aria-label="PDF viewer and editor">');
    html.push('<div class="tb-group"><button class="tb-btn" type="button" data-open title="Open PDF" aria-label="Open PDF">' + ic("file") + '</button><button class="tb-btn" type="button" data-op-merge title="Merge another PDF" aria-label="Merge another PDF" data-needs-write>' + ic("merge") + '</button><span class="tb-doc" data-doc-name>No document</span></div>');
    html.push('<div class="tb-group"><button class="tb-btn" type="button" data-zoom-out title="Zoom out" aria-label="Zoom out">' + ic("minus") + '</button><span class="tb-zoom" data-zoom-label>100%</span><button class="tb-btn" type="button" data-zoom-in title="Zoom in" aria-label="Zoom in">' + ic("plus") + '</button><button class="tb-btn" type="button" data-fit-width title="Fit width" aria-label="Fit width">' + ic("expand") + '</button><button class="tb-btn" type="button" data-fit-page title="Fit whole page" aria-label="Fit whole page">' + ic("viewer") + '</button></div>');
    html.push('<div class="tb-group"><button class="tb-btn" type="button" data-page-prev title="Previous page" aria-label="Previous page">' + ic("left") + '</button><input class="tb-page" data-page-input value="1" inputmode="numeric" aria-label="Page number"><span class="tb-page-label">/ <b data-page-total>0</b></span><button class="tb-btn" type="button" data-page-next title="Next page" aria-label="Next page">' + ic("right") + '</button></div>');
    html.push('<div class="tb-group viewer-tools" data-tools>' + toolBar + '</div>');
    html.push('<div class="tb-grow"></div>');
    html.push('<div class="tb-group"><button class="tb-btn" type="button" data-undo title="Undo" aria-label="Undo" disabled>' + ic("undo") + '</button><button class="tb-btn" type="button" data-redo title="Redo" aria-label="Redo" disabled>' + ic("redo") + '</button></div>');
    html.push('<button class="btn btn--sm tb-save" type="button" data-export data-needs-doc>' + ic("download") + ' <span>Export</span></button>');
    html.push("</div>");

    html.push('<div class="viewer-layout">');
    html.push('<div class="viewer-main"><div class="viewer-readonly" data-readonly hidden></div><div class="viewer-doc-wrap" data-doc-wrap>');
    html.push('<div class="viewer-empty" data-empty><div class="viewer-empty-card">');
    html.push(MTH.ui.dropzone({ accept: ".pdf,application/pdf", icon: "viewer", title: "Drop a PDF to open it", hint: "Or click to choose a file. Pages render locally, one after another, as you scroll.", meta: ["PDF", "Annotate", "Reorder", "100% local"] }));
    html.push('<p class="viewer-empty-note">' + ic("shield") + " Your document never leaves this browser. Scanned pages can be annotated, but their text is not editable.</p>");
    html.push("</div></div>");
    html.push("</div>");
    html.push('<div class="viewer-statusbar"><span class="status" data-status></span><span class="tiny muted" data-status-note>Open a PDF to begin.</span></div>');
    html.push("</div>");

    html.push('<aside class="viewer-side editor-side">');
    html.push('<section class="panel"><div class="panel-head"><div><h3>Pages</h3><p data-page-summary>0 pages</p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" type="button" data-op-rotate-all data-needs-doc title="Rotate every page 90°">' + ic("rotate", 13) + " All</button></div></div>");
    html.push('<div class="page-order-list" data-page-list></div>');
    html.push('<div class="viewer-side-actions">');
    html.push('<button class="btn btn--sm btn--ghost" type="button" data-op-rotate data-needs-write>' + ic("rotate", 13) + " Rotate</button>");
    html.push('<button class="btn btn--sm btn--ghost" type="button" data-op-up data-needs-write>' + ic("up", 13) + " Up</button>");
    html.push('<button class="btn btn--sm btn--ghost" type="button" data-op-down data-needs-write>' + ic("down", 13) + " Down</button>");
    html.push('<button class="btn btn--sm btn--ghost" type="button" data-op-duplicate data-needs-write>' + ic("copy", 13) + " Duplicate</button>");
    html.push('<button class="btn btn--sm btn--ghost" type="button" data-op-delete data-needs-write>' + ic("trash", 13) + " Delete</button>");
    html.push('<button class="btn btn--sm btn--ghost" type="button" data-op-extract data-needs-write>' + ic("split", 13) + " Extract</button>");
    html.push('<button class="btn btn--sm btn--ghost" type="button" data-op-split data-needs-write>' + ic("split", 13) + " Split</button>");
    html.push('<button class="btn btn--sm btn--ghost" type="button" data-op-merge data-needs-write>' + ic("merge", 13) + " Merge</button>");
    html.push('<button class="btn btn--sm btn--ghost" type="button" data-op-blank data-needs-write>' + ic("plus", 13) + " Blank page</button>");
    html.push("</div></section>");

    html.push('<section class="panel"><div class="panel-head"><div><h3>Annotation style</h3><p>Applies to new marks and the selected mark.</p></div></div><div class="panel-body viewer-style">');
    html.push('<div class="style-grid"><label class="field"><span>Colour</span><input class="tb-color" type="color" data-style-color value="' + state.color + '"></label>');
    html.push('<label class="field"><span>Opacity</span><span class="range-wrap"><input type="range" min="10" max="100" value="100" data-style-opacity><span class="range-val" data-opacity-val>100%</span></span></label>');
    html.push('<label class="field"><span>Stroke</span><span class="range-wrap"><input type="range" min="1" max="14" value="2" data-style-width><span class="range-val" data-width-val>2 pt</span></span></label>');
    html.push('<label class="field"><span>Text size</span><span class="range-wrap"><input type="range" min="8" max="72" value="18" data-style-size><span class="range-val" data-size-val>18 pt</span></span></label></div>');
    html.push('<label class="check-line"><input type="checkbox" data-style-fill> Fill shapes with the same colour</label>');
    html.push('<div class="viewer-typo"><label class="field"><span>Font</span><select class="select" data-style-font>' +
      '<option value="Helvetica">Helvetica / Arial</option>' +
      '<option value="Georgia">Georgia</option>' +
      '<option value="Times">Times New Roman</option>' +
      '<option value="Courier">Courier</option>' +
      '<option value="Verdana">Verdana</option></select></label>' +
      '<div class="field"><span>Type style</span><div class="type-row" role="group" aria-label="Text style">' +
        '<button type="button" class="type-btn" data-style-bold title="Bold" aria-label="Bold" aria-pressed="false"><b>B</b></button>' +
        '<button type="button" class="type-btn" data-style-italic title="Italic" aria-label="Italic" aria-pressed="false"><i>I</i></button>' +
        '<span class="type-sep" aria-hidden="true"></span>' +
        '<button type="button" class="type-btn" data-style-align="left" title="Align left" aria-label="Align left" aria-pressed="true">' + ic("left", 13) + '</button>' +
        '<button type="button" class="type-btn" data-style-align="center" title="Align centre" aria-label="Align centre" aria-pressed="false">' + ic("menu", 13) + '</button>' +
        '<button type="button" class="type-btn" data-style-align="right" title="Align right" aria-label="Align right" aria-pressed="false">' + ic("right", 13) + '</button>' +
      '</div></div>' +
      '<label class="field"><span>Line height</span><select class="select" data-style-lineheight>' +
        '<option value="1">Tight · 1.0</option><option value="1.15">1.15</option><option value="1.32" selected>Normal · 1.32</option><option value="1.5">1.5</option><option value="1.8">Airy · 1.8</option>' +
      '</select></label></div>');
    html.push('<div class="viewer-tool-hint" data-tool-hint>' + ic("select") + " <span>Select a mark to move it, or drag its corner to resize. Double-click text to edit.</span></div>");
    html.push("</div></section>");

    html.push('<section class="panel"><div class="panel-head"><div><h3>Marks on this page</h3><p data-anno-summary>No marks yet.</p></div></div><div class="panel-body panel-body--flush"><div class="annot-list" data-anno-list></div></div></section>');
    html.push('<section class="panel"><div class="panel-head"><div><h3>Comments</h3><p data-comment-summary>No comments yet.</p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" type="button" data-notes-export title="Download a summary of every annotation">' + ic("download", 13) + ' Notes</button></div></div><div class="panel-body panel-body--flush"><div class="comment-list" data-comment-list></div></div></section>');
    html.push('<section class="panel viewer-help"><div class="panel-body"><p class="eyebrow">Good to know</p><ul class="aside-list"><li>The viewer keeps the original pages intact. Annotations are burned into an overlay only when you export.</li><li>Scanned PDFs have no text layer. This viewer annotates them but cannot turn pixels into editable words.</li><li>Password-protected files open read-only because saving requires an unencrypted source. Use <a href="' + MTH.esc(MTH.sitePath("tools/unlock.html")) + '">Unlock PDF</a> first.</li></ul></div></section>');
    html.push("</aside></div></div>");

    MTH.tool.mount(html.join(""));

    els.docWrap = q("[data-doc-wrap]");
    els.empty = q("[data-empty]");
    els.toolbar = q("[data-toolbar]");
    els.docName = q("[data-doc-name]");
    els.pageList = q("[data-page-list]");
    els.pageTotal = q("[data-page-total]");
    els.pageInput = q("[data-page-input]");
    els.pageSummary = q("[data-page-summary]");
    els.annoList = q("[data-anno-list]");
    els.annoSummary = q("[data-anno-summary]");
    els.commentList = q("[data-comment-list]");
    els.commentSummary = q("[data-comment-summary]");
    els.zoomLabel = q("[data-zoom-label]");
    els.statusNote = q("[data-status-note]");
    els.status = q("[data-status]");
    els.readonly = q("[data-readonly]");
    els.exportBtn = q("[data-export]");
    els.undo = q("[data-undo]");
    els.redo = q("[data-redo]");
    els.hint = q("[data-tool-hint]");

    MTH.tool.bindDrop(els.empty, { accept: ".pdf,application/pdf", onFiles: function (files) { if (files[0]) openDocument(files[0]); } });
    bindToolbar();
    bindStyle();
    bindKeys();
    syncHistoryButtons();
    syncTool();
    saveStateLabel();
    refreshComments();
  }

  function bindToolbar() {
    q("[data-open]").addEventListener("click", async function () {
      var files = await MTH.pick(".pdf,application/pdf", false);
      if (files[0]) openDocument(files[0]);
    });
    q("[data-zoom-in]").addEventListener("click", function () { setZoom(state.zoom * 1.18, "manual"); });
    q("[data-zoom-out]").addEventListener("click", function () { setZoom(state.zoom / 1.18, "manual"); });
    q("[data-fit-width]").addEventListener("click", function () { setZoom(0, "fit-width"); });
    q("[data-fit-page]").addEventListener("click", function () { setZoom(0, "fit-page"); });
    q("[data-page-prev]").addEventListener("click", function () { goPage(state.active - 1); });
    q("[data-page-next]").addEventListener("click", function () { goPage(state.active + 1); });
    els.pageInput.addEventListener("change", function () {
      var n = parseInt(els.pageInput.value, 10);
      if (!isNaN(n)) goPage(n - 1);
    });
    els.pageInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); els.pageInput.blur(); } });
    q("[data-tools]").addEventListener("click", function (e) {
      var b = e.target.closest("[data-tool]");
      if (b) setTool(b.dataset.tool);
    });
    q("[data-export]").addEventListener("click", openExport);
    q("[data-undo]").addEventListener("click", undo);
    q("[data-redo]").addEventListener("click", redo);
    qa("[data-op-merge]").forEach(function (b) { b.addEventListener("click", mergePdf); });
    q("[data-op-blank]").addEventListener("click", insertBlankPage);
    q("[data-notes-export]").addEventListener("click", exportNotes);
    q("[data-op-rotate]").addEventListener("click", function () { rotatePage(state.active, 1); });
    q("[data-op-rotate-all]").addEventListener("click", rotateAll);
    q("[data-op-up]").addEventListener("click", function () { movePage(state.active, -1); });
    q("[data-op-down]").addEventListener("click", function () { movePage(state.active, 1); });
    q("[data-op-delete]").addEventListener("click", deletePage);
    q("[data-op-duplicate]").addEventListener("click", duplicatePage);
    q("[data-op-extract]").addEventListener("click", openExtract);
    q("[data-op-split]").addEventListener("click", openSplit);
    window.addEventListener("resize", function () {
      clearTimeout(state.resizeTimer);
      state.resizeTimer = setTimeout(function () {
        if (state.zoomMode === "fit-width" || state.zoomMode === "fit-page") setZoom(0, state.zoomMode);
      }, 160);
    });
  }

  function bindStyle() {
    var color = q("[data-style-color]");
    color.addEventListener("input", function () {
      state.color = color.value;
      applyStyle({ color: color.value });
    });
    var op = q("[data-style-opacity]");
    op.addEventListener("input", function () {
      state.opacity = Number(op.value) / 100;
      q("[data-opacity-val]").textContent = op.value + "%";
      applyStyle({ opacity: state.opacity });
    });
    var wd = q("[data-style-width]");
    wd.addEventListener("input", function () {
      state.lw = Number(wd.value);
      q("[data-width-val]").textContent = state.lw + " pt";
      applyStyle({ lw: state.lw });
    });
    var fs = q("[data-style-size]");
    fs.addEventListener("input", function () {
      state.fs = Number(fs.value);
      q("[data-size-val]").textContent = state.fs + " pt";
      applyStyle({ fs: state.fs });
    });
    var fill = q("[data-style-fill]");
    fill.addEventListener("change", function () { state.fill = fill.checked; applyStyle({ fill: state.fill }); });

    var font = q("[data-style-font]");
    if (font) font.addEventListener("change", function () { state.font = font.value; applyStyle({ font: state.font }); });
    var bold = q("[data-style-bold]");
    if (bold) bold.addEventListener("click", function () {
      state.bold = !state.bold;
      bold.classList.toggle("on", state.bold);
      bold.setAttribute("aria-pressed", state.bold ? "true" : "false");
      applyStyle({ bold: state.bold });
    });
    var italic = q("[data-style-italic]");
    if (italic) italic.addEventListener("click", function () {
      state.italic = !state.italic;
      italic.classList.toggle("on", state.italic);
      italic.setAttribute("aria-pressed", state.italic ? "true" : "false");
      applyStyle({ italic: state.italic });
    });
    qa("[data-style-align]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.align = b.dataset.styleAlign || "left";
        qa("[data-style-align]").forEach(function (x) {
          var on = x === b;
          x.classList.toggle("on", on);
          x.setAttribute("aria-pressed", on ? "true" : "false");
        });
        applyStyle({ align: state.align });
      });
    });
    var lh = q("[data-style-lineheight]");
    if (lh) lh.addEventListener("change", function () { state.lineHeight = Number(lh.value) || 1.32; applyStyle({ lineHeight: state.lineHeight }); });
  }

  function bindKeys() {
    document.addEventListener("keydown", function (e) {
      var tag = (e.target && e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || (e.target && e.target.isContentEditable)) return;
      if (!state.pages.length) return;
      var meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (meta && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (meta && e.key.toLowerCase() === "s") { e.preventDefault(); openExport(); return; }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (state.selected) { e.preventDefault(); removeAnnotation(state.selected); }
        return;
      }
      if (e.key === "Escape") { selectAnno(null); setTool("select"); return; }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); goPage(state.active - 1); }
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); goPage(state.active + 1); }
    });
  }

  function setStatus(message, kind) { MTH.status(els.status, message || "", kind || ""); }

  function setTool(name) {
    state.tool = name;
    qa("[data-tool]").forEach(function (b) {
      var on = b.dataset.tool === name;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var hints = {
      select: "Select a mark to move it, or drag its corner to resize. Double-click text or a comment to edit it.",
      text: "Click anywhere on a page to place a text note. A dialogue asks for the words.",
      note: "Click to drop a sticky comment. Comments are listed in the sidebar and can be resolved.",
      underline: "Drag beneath a line of text to underline it. The mark is a visual annotation.",
      strike: "Drag across a line of text to strike through it.",
      rect: "Drag to draw a rectangle. Hold Shift for a square.",
      ellipse: "Drag to draw an ellipse. Hold Shift for a circle.",
      line: "Drag to draw an arrow from start to end.",
      highlight: "Drag across an area to lay down a translucent highlight.",
      ink: "Draw freehand on the page. Release to finish the stroke.",
      redact: "Drag to cover sensitive content with an opaque black block. Use Flatten on export for true content removal.",
      whiteout: "Drag to cover an area with opaque white. Useful for cleaning scans and removing stray marks.",
      replace: "Drag over the text you want to replace, then type the new wording. The original area is covered first.",
      signature: "Draw a signature in the pad, then place and resize it on the page.",
      image: "Pick an image file, then click the page to place it.",
      watermark: "Add a tiled text watermark to the current page."
    };
    var hintIcons = { select: "select", text: "type", note: "note", underline: "underline", strike: "strike", rect: "shape", ellipse: "shape", line: "arrow-right", highlight: "highlight", ink: "pen", redact: "redact", whiteout: "eraser", replace: "replace", signature: "signature", image: "image-plus", watermark: "watermark" };
    if (els.hint) els.hint.innerHTML = ic(hintIcons[name] || "pen") + " <span>" + (hints[name] || "") + "</span>";
    qa(".annot-canvas").forEach(function (c) {
      c.classList.toggle("select-mode", name === "select");
      c.classList.toggle("text-mode", name === "text" || name === "watermark" || name === "note" || name === "replace");
    });
  }

  function syncTool() { setTool(state.tool); }

  function syncHistoryButtons() {
    if (els.undo) els.undo.disabled = !state.history.length;
    if (els.redo) els.redo.disabled = !state.future.length;
  }

  /* ---------- document loading ---------- */
  async function openDocument(file) {
    if (!file) return;
    if (!(await ensureDiscard())) return;
    setStatus("Opening " + file.name + "…");
    var bytes;
    try { bytes = await MTH.read(file); }
    catch (e) { setStatus(MTH.friendlyError(e), "err"); return; }
    var pdf;
    try {
      pdf = await MTH.pdf.openWithPrompt(bytes);
    } catch (e) {
      if (e && e.cancelled) { setStatus("Open cancelled."); return; }
      setStatus(MTH.friendlyError(e), "err");
      MTH.reportError(e, "viewer-open");
      return;
    }
    var lib = null, libError = null;
    try {
      if (typeof PDFLib === "undefined") throw new Error("The PDF writing engine did not load. Refresh the page and try again.");
      lib = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    } catch (e) { libError = e; lib = null; }

    destroyAllSources();
    var key = MTH.uid();
    var src = { key: key, name: file.name, bytes: bytes, pdfjs: pdf, lib: lib, meta: {}, count: pdf.numPages };
    state.sources[key] = src;
    state.pages = [];
    state.active = 0;
    state.history = [];
    state.future = [];
    state.selected = null;
    state.dirty = false;
    state.readOnly = !lib;
    state.docName = file.name;

    await readMeta(src);
    for (var i = 0; i < src.count; i++) state.pages.push({ id: MTH.uid(), key: key, index: i, rotate: 0, annos: [] });
    if (!state.pages.length) {
      setStatus("This PDF contains no readable pages.", "err");
      destroyAllSources();
      state.docName = "";
      saveStateLabel();
      return;
    }
    showReadOnly(libError);
    buildPageShells();
    state.zoomMode = "fit-width";
    applyFit();
    goPage(0, false);
    setStatus("Opened " + file.name + " · " + src.count + " page" + (src.count === 1 ? "" : "s") + (state.readOnly ? " (view only)" : "") + ".", "ok");
    MTH.store.pushRecent("viewer");
    syncHistoryButtons();
    saveStateLabel();
  }

  async function readMeta(src) {
    src.meta = {};
    for (var i = 1; i <= src.count; i++) {
      try {
        var page = await src.pdfjs.getPage(i);
        var vp = page.getViewport({ scale: 1, rotation: 0 });
        src.meta[i - 1] = { uw: vp.width, uh: vp.height, baseRot: (page.rotate || 0) % 360 };
      } catch (e) {
        src.meta[i - 1] = { uw: 595.28, uh: 841.89, baseRot: 0 };
      }
      if (i % 10 === 0 || i === src.count) {
        setStatus("Preparing page " + i + " of " + src.count + "…");
        await MTH.sleep(0);
      }
    }
  }

  async function importSource(file) {
    var bytes = await MTH.read(file);
    var pdf = await MTH.pdf.openWithPrompt(bytes);
    var lib;
    try {
      lib = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    } catch (e) {
      throw new Error("“" + file.name + "” is password-protected or cannot be written. Unlock it first with the Unlock PDF tool, then merge the unlocked copy.");
    }
    var key = MTH.uid();
    var src = { key: key, name: file.name, bytes: bytes, pdfjs: pdf, lib: lib, meta: {}, count: pdf.numPages };
    state.sources[key] = src;
    await readMeta(src);
    return src;
  }

  function showReadOnly(err) {
    if (!state.readOnly) { els.readonly.hidden = true; return; }
    var reason = err ? (/encrypt|password/i.test(err.message || "") ? "This PDF is password-protected. The viewer can display it, but saving an edited copy needs an unencrypted source." : "The writing engine could not open this PDF for editing. You can still read and annotate it on screen.") : "This PDF is read-only in the editor.";
    els.readonly.innerHTML = '<div class="viewer-readonly-box">' + ic("lock", 18) + '<div><b>Viewing only</b><p>' + MTH.esc(reason) + ' Unlock the file first with the password you already know, then reopen it here.</p><div class="row"><a class="btn btn--sm" href="' + MTH.esc(MTH.sitePath("tools/unlock.html")) + '">' + ic("lock", 13) + " Open Unlock PDF</a></div></div></div>";
    els.readonly.hidden = false;
  }

  function destroyAllSources() {
    Object.keys(state.sources).forEach(function (k) {
      MTH.pdf.destroy(state.sources[k].pdfjs);
    });
    state.sources = {};
  }

  async function ensureDiscard() {
    if (!state.dirty) return true;
    return await MTH.confirm({
      title: "Discard unsaved changes?",
      message: "You have annotations or page changes that have not been exported. Opening another file will clear them.",
      confirmText: "Discard & open",
      danger: true
    });
  }

  /* ---------- page shells ---------- */
  function visualSize(page) {
    var src = srcOf(page);
    var m = src && src.meta[page.index];
    if (!m) return { w: 595.28, h: 841.89 };
    var rot = ((m.baseRot + (page.rotate || 0)) % 360 + 360) % 360;
    return rot % 180 === 0 ? { w: m.uw, h: m.uh } : { w: m.uh, h: m.uw };
  }

  function buildPageShells() {
    state.version++;
    state.queue = [];
    state.rendered = {};
    els.empty.hidden = state.pages.length > 0;
    qa(".viewer-page").forEach(function (n) { n.remove(); });
    if (state.observer) { state.observer.disconnect(); state.observer = null; }
    if (!state.pages.length) { refreshPageList(); saveStateLabel(); return; }
    var frag = document.createDocumentFragment();
    state.pages.forEach(function (p, i) {
      var src = srcOf(p);
      var el = document.createElement("div");
      el.className = "viewer-page";
      el.dataset.index = i;
      el.id = "vp-" + i;
      el.innerHTML =
        '<div class="pdf-page-bar"><span>Page ' + (i + 1) + ' · ' + MTH.esc(src ? src.name : "document") + '</span><span class="pp-actions">' +
          '<button type="button" data-pa="rot-l" title="Rotate left" aria-label="Rotate page ' + (i + 1) + ' left">' + ic("undo", 12) + '</button>' +
          '<button type="button" data-pa="rot-r" title="Rotate right" aria-label="Rotate page ' + (i + 1) + ' right">' + ic("rotate", 12) + '</button>' +
          '<button type="button" data-pa="del" title="Delete page" aria-label="Delete page ' + (i + 1) + '">' + ic("trash", 12) + '</button>' +
        '</span></div>' +
        '<div class="pdf-page-sheet" data-sheet style="aspect-ratio:' + visualSize(p).w + ' / ' + visualSize(p).h + '">' +
          '<canvas class="viewer-canvas" data-canvas aria-label="Page ' + (i + 1) + '"></canvas>' +
          '<canvas class="annot-canvas select-mode" data-anno-canvas aria-label="Annotations for page ' + (i + 1) + '"></canvas>' +
          '<div class="viewer-skeleton" data-skeleton><span class="spinner"></span><span>Page ' + (i + 1) + '</span></div>' +
        '</div>';
      frag.appendChild(el);
      bindOverlay(el.querySelector("[data-anno-canvas]"), i);
      el.addEventListener("click", function (e) {
        var b = e.target.closest("[data-pa]");
        if (!b) return;
        e.stopPropagation();
        if (b.dataset.pa === "rot-l") rotatePage(i, -1);
        else if (b.dataset.pa === "rot-r") rotatePage(i, 1);
        else if (b.dataset.pa === "del") deletePage(i);
      });
    });
    els.docWrap.insertBefore(frag, els.docWrap.querySelector(".viewer-statusbar"));
    if (window.IntersectionObserver) {
      state.observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var i = Number(entry.target.dataset.index);
          schedule(i);
          schedule(i + 1);
          schedule(i - 1);
        });
      }, { rootMargin: "700px 0px", threshold: 0.01 });
      qa(".viewer-page").forEach(function (n) { state.observer.observe(n); });
    }
    refreshPageList();
    refreshAnnoList();
    refreshComments();
    saveStateLabel();
    if (!state.scrollBound) { window.addEventListener("scroll", onScroll, { passive: true }); state.scrollBound = true; }
    onScroll();
    applyLayout();
  }

  function bindOverlay(canvas, index) {
    canvas.addEventListener("pointerdown", function (e) { overlayDown(e, index); });
    canvas.addEventListener("pointermove", function (e) { overlayMove(e, index); });
    canvas.addEventListener("pointerup", function (e) { overlayUp(e, index); });
    canvas.addEventListener("pointercancel", function (e) { overlayUp(e, index); });
    canvas.addEventListener("dblclick", function (e) { overlayDouble(e, index); });
  }

  /* ---------- rendering queue ---------- */
  function schedule(i) {
    if (i < 0 || i >= state.pages.length) return;
    if (state.queue.indexOf(i) === -1) state.queue.push(i);
    pump();
  }

  async function pump() {
    if (state.pumping) return;
    state.pumping = true;
    try {
      while (state.queue.length) {
        var i = state.queue.shift();
        if (i < 0 || i >= state.pages.length) continue;
        if (state.rendered[i] && state.rendered[i].version === state.version) continue;
        try { await renderPage(i); }
        catch (e) {
          var sk = qa('.viewer-page[data-index="' + i + '"] [data-skeleton]')[0];
          if (sk) sk.innerHTML = '<span class="viewer-error">' + MTH.esc(MTH.friendlyError(e)) + "</span>";
          if (!e || !e.cancelled) MTH.reportError(e, "viewer-render");
        }
      }
    } finally { state.pumping = false; }
  }

  async function renderPage(i) {
    var p = state.pages[i];
    var src = srcOf(p);
    var el = q('.viewer-page[data-index="' + i + '"]');
    if (!p || !src || !el) return;
    var sheet = el.querySelector("[data-sheet]");
    var canvas = el.querySelector("[data-canvas]");
    var skeleton = el.querySelector("[data-skeleton]");
    var version = state.version;
    var page = await src.pdfjs.getPage(p.index + 1);
    if (version !== state.version) return;
    var rotation = ((src.meta[p.index] ? src.meta[p.index].baseRot : 0) + (p.rotate || 0)) % 360;
    var info = await MTH.pdf.render(page, canvas, {
      scale: state.zoom,
      rotation: rotation,
      pixelRatio: Math.min(2, window.devicePixelRatio || 1),
      maxPixels: 22000000
    });
    if (version !== state.version) return;
    sheet.style.width = info.width + "px";
    sheet.style.aspectRatio = info.width + " / " + info.height;
    skeleton.hidden = true;
    var ov = el.querySelector("[data-anno-canvas]");
    var pr = info.pixelRatio || 1;
    ov.width = Math.max(1, Math.round(info.width * pr));
    ov.height = Math.max(1, Math.round(info.height * pr));
    state.rendered[i] = { version: version, info: info, rotation: rotation, canvas: canvas, overlay: ov };
    paintOverlay(i);
  }

  function invalidateRender() {
    state.version++;
    state.queue = [];
    state.rendered = {};
    qa(".viewer-page").forEach(function (el) {
      var sk = el.querySelector("[data-skeleton]");
      if (sk) { sk.hidden = false; sk.innerHTML = '<span class="spinner"></span><span>Rendering…</span>'; }
      var c = el.querySelector("[data-anno-canvas]");
      if (c) { var ctx = c.getContext("2d"); ctx && ctx.clearRect(0, 0, c.width, c.height); }
    });
    scheduleVisible();
  }

  function scheduleVisible() {
    var vh = window.innerHeight || 800;
    qa(".viewer-page").forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom > -600 && r.top < vh + 600) schedule(Number(el.dataset.index));
    });
  }

  /* ---------- zoom / navigation ---------- */
  function maxVisual() {
    var maxW = 0, maxH = 0;
    state.pages.forEach(function (p) {
      var v = visualSize(p);
      if (v.w > maxW) maxW = v.w;
      if (v.h > maxH) maxH = v.h;
    });
    return { w: maxW || 595.28, h: maxH || 841.89 };
  }

  function applyFit() {
    var dim = maxVisual();
    var availW = Math.max(240, els.docWrap.clientWidth - 34);
    var availH = Math.max(280, window.innerHeight - 210);
    var scale = state.zoomMode === "fit-page" ? Math.min(availW / dim.w, availH / dim.h) : availW / dim.w;
    state.zoom = MTH.clamp(scale, 0.12, 5);
    applyLayout();
  }

  function setZoom(value, mode) {
    if (!state.pages.length) return;
    state.zoomMode = mode || "manual";
    if (mode === "fit-width" || mode === "fit-page") { applyFit(); return; }
    state.zoom = MTH.clamp(value || 1, 0.12, 5);
    applyLayout();
  }

  function applyLayout() {
    var zoom = state.zoom;
    qa(".viewer-page").forEach(function (el) {
      var p = state.pages[Number(el.dataset.index)];
      if (!p) return;
      var dim = visualSize(p);
      var sheet = el.querySelector("[data-sheet]");
      sheet.style.width = (dim.w * zoom) + "px";
      sheet.style.aspectRatio = dim.w + " / " + dim.h;
    });
    els.zoomLabel.textContent = Math.round(zoom * 100) + "%";
    qa("[data-fit-width]").forEach(function (b) { b.classList.toggle("on", state.zoomMode === "fit-width"); });
    qa("[data-fit-page]").forEach(function (b) { b.classList.toggle("on", state.zoomMode === "fit-page"); });
    invalidateRender();
  }

  function goPage(index, smooth) {
    if (!state.pages.length) return;
    index = MTH.clamp(index, 0, state.pages.length - 1);
    setActive(index);
    var el = q('.viewer-page[data-index="' + index + '"]');
    if (!el) return;
    state.suppressScroll = true;
    var top = el.getBoundingClientRect().top + window.pageYOffset - 132;
    try { window.scrollTo({ top: Math.max(0, top), behavior: smooth === false ? "auto" : "smooth" }); }
    catch (e) { window.scrollTo(0, Math.max(0, top)); }
    schedule(index);
    clearTimeout(state.suppressTimer);
    state.suppressTimer = setTimeout(function () { state.suppressScroll = false; }, 520);
  }

  function setActive(index) {
    if (!state.pages.length) return;
    state.active = MTH.clamp(index, 0, state.pages.length - 1);
    if (els.pageInput) els.pageInput.value = state.active + 1;
    if (els.pageTotal) els.pageTotal.textContent = state.pages.length;
    if (els.pageSummary) els.pageSummary.textContent = state.pages.length + " page" + (state.pages.length === 1 ? "" : "s");
    qa(".page-order-item").forEach(function (row) { row.classList.toggle("is-active", Number(row.dataset.row) === state.active); });
    qa(".viewer-page").forEach(function (el) { el.classList.toggle("is-active", Number(el.dataset.index) === state.active); });
    refreshAnnoList();
    saveStateLabel();
  }

  function onScroll() {
    if (!state.pages.length) return;
    var now = Date.now();
    if (now - state.lastPageScroll < 90) return;
    state.lastPageScroll = now;
    if (state.suppressScroll) return;
    var mid = (window.innerHeight || 800) * 0.36;
    var best = -1, bestDist = Infinity;
    qa(".viewer-page").forEach(function (el) {
      var r = el.getBoundingClientRect();
      var d = Math.abs(r.top + Math.min(r.height * .25, 220) - mid);
      if (r.bottom > 60 && r.top < (window.innerHeight || 800) && d < bestDist) { bestDist = d; best = Number(el.dataset.index); }
    });
    if (best >= 0 && best !== state.active) setActive(best);
  }

  /* ---------- side lists ---------- */
  function refreshPageList() {
    if (!els.pageList) return;
    if (els.pageTotal) els.pageTotal.textContent = state.pages.length;
    if (els.pageInput && state.pages.length) els.pageInput.value = state.active + 1;
    if (!state.pages.length) {
      els.pageList.innerHTML = '<div class="editor-empty">Open a PDF to see its pages.</div>';
      return;
    }
    els.pageList.innerHTML = state.pages.map(function (p, i) {
      var total = (((srcOf(p) && srcOf(p).meta[p.index] ? srcOf(p).meta[p.index].baseRot : 0) + (p.rotate || 0)) % 360 + 360) % 360;
      var marks = (p.annos || []).length;
      return '<div class="page-order-item' + (i === state.active ? " is-active" : "") + '" draggable="true" data-row="' + i + '" title="Page ' + (i + 1) + '">' +
        '<span class="po-num">' + (i + 1) + '</span>' +
        '<span class="po-main"><b>Page ' + (i + 1) + '</b><small>' + (marks ? marks + " mark" + (marks === 1 ? "" : "s") : "No marks") + '</small></span>' +
        (total ? '<span class="po-rot">' + total + '°</span>' : "") +
        '<span class="po-actions">' +
          '<button type="button" data-pa="rot-l" title="Rotate left" aria-label="Rotate page ' + (i + 1) + ' left">' + ic("undo", 11) + '</button>' +
          '<button type="button" data-pa="rot-r" title="Rotate right" aria-label="Rotate page ' + (i + 1) + ' right">' + ic("rotate", 11) + '</button>' +
          '<button type="button" data-pa="up" title="Move up" aria-label="Move page ' + (i + 1) + ' up"' + (i === 0 ? " disabled" : "") + '>' + ic("up", 11) + '</button>' +
          '<button type="button" data-pa="down" title="Move down" aria-label="Move page ' + (i + 1) + ' down"' + (i === state.pages.length - 1 ? " disabled" : "") + '>' + ic("down", 11) + '</button>' +
          '<button type="button" data-pa="del" title="Delete page" aria-label="Delete page ' + (i + 1) + '">' + ic("trash", 11) + '</button>' +
        '</span></div>';
    }).join("");

    els.pageList.onclick = function (e) {
      var act = e.target.closest("[data-pa]");
      var row = e.target.closest("[data-row]");
      if (!row) return;
      var i = Number(row.dataset.row);
      if (!act) { goPage(i); return; }
      e.stopPropagation();
      if (act.dataset.pa === "rot-l") rotatePage(i, -1);
      else if (act.dataset.pa === "rot-r") rotatePage(i, 1);
      else if (act.dataset.pa === "up") movePage(i, -1);
      else if (act.dataset.pa === "down") movePage(i, 1);
      else if (act.dataset.pa === "del") deletePage(i);
    };
    els.pageList.ondragstart = function (e) {
      var row = e.target.closest("[data-row]");
      if (!row) return;
      e.dataTransfer.setData("text/plain", row.dataset.row);
      e.dataTransfer.effectAllowed = "move";
      row.classList.add("is-dragging");
    };
    els.pageList.ondragend = function (e) {
      qa(".page-order-item").forEach(function (r) { r.classList.remove("is-dragging", "is-drop"); });
    };
    els.pageList.ondragover = function (e) {
      var row = e.target.closest("[data-row]");
      e.preventDefault();
      if (!row) return;
      qa(".page-order-item").forEach(function (r) { r.classList.toggle("is-drop", r === row); });
    };
    els.pageList.ondrop = function (e) {
      e.preventDefault();
      var row = e.target.closest("[data-row]");
      var from = Number(e.dataTransfer.getData("text/plain"));
      if (!row || isNaN(from)) return;
      var to = Number(row.dataset.row);
      qa(".page-order-item").forEach(function (r) { r.classList.remove("is-drop", "is-dragging"); });
      if (from === to) return;
      remember();
      var moved = state.pages.splice(from, 1)[0];
      state.pages.splice(to, 0, moved);
      state.dirty = true;
      state.active = to;
      buildPageShells();
      setActive(to);
      goPage(to, false);
      MTH.toast("Page moved to position " + (to + 1), "ok");
    };
  }

  function refreshAnnoList() {
    if (!els.annoList) return;
    var p = currentPage();
    var annos = p ? (p.annos || []) : [];
    if (els.annoSummary) els.annoSummary.textContent = annos.length ? annos.length + " mark" + (annos.length === 1 ? "" : "s") + " on page " + (state.active + 1) : "No marks yet.";
    if (!annos.length) {
      els.annoList.innerHTML = '<div class="editor-empty">Choose a tool above, then draw on the page.<br>Text, comments, shapes, highlights, redaction, signatures, ink, images and watermarks are supported.</div>';
      return;
    }
    els.annoList.innerHTML = annos.map(function (a) {
      var label = annotationLabel(a);
      var preview = a.text ? a.text.replace(/\s+/g, " ").slice(0, 46) : a.type === "image" ? "Image stamp" : label;
      return '<div class="annot-item' + (state.selected === a ? " is-selected" : "") + (a.resolved ? " is-resolved" : "") + '" data-anno="' + MTH.esc(a.id) + '">' +
        '<span class="ai-type">' + MTH.esc(label) + '</span><span class="ai-text">' + MTH.esc(preview) + '</span>' +
        '<button type="button" data-anno-del title="Delete mark" aria-label="Delete ' + MTH.esc(label) + '">' + ic("trash", 11) + '</button></div>';
    }).join("");
    els.annoList.onclick = function (e) {
      var del = e.target.closest("[data-anno-del]");
      var item = e.target.closest("[data-anno]");
      if (!item) return;
      var a = annos.filter(function (x) { return x.id === item.dataset.anno; })[0];
      if (!a) return;
      if (del) { removeAnnotation(a); return; }
      selectAnno(a);
    };
  }

  function selectAnno(anno, page) {
    state.selected = anno || null;
    state.selectedPage = anno ? (page || currentPage()) : null;
    qa(".annot-canvas").forEach(function (c) { c.classList.toggle("select-mode", state.tool === "select"); });
    refreshAnnoList();
    refreshComments();
    paintAllOverlays();
    if (anno) syncStyleFromAnno(anno);
  }

  function syncStyleFromAnno(a) {
    if (!a) return;
    var color = q("[data-style-color]");
    if (a.color && color) { color.value = a.color; state.color = a.color; }
    var op = q("[data-style-opacity]");
    if (a.opacity != null && op) { op.value = Math.round(a.opacity * 100); q("[data-opacity-val]").textContent = op.value + "%"; state.opacity = a.opacity; }
    var wd = q("[data-style-width]");
    if (a.lw != null && wd) { wd.value = Math.round(a.lw); q("[data-width-val]").textContent = Math.round(a.lw) + " pt"; state.lw = a.lw; }
    var fs = q("[data-style-size]");
    if (a.fs != null && fs) { fs.value = Math.round(a.fs); q("[data-size-val]").textContent = Math.round(a.fs) + " pt"; state.fs = a.fs; }
    var fill = q("[data-style-fill]");
    if (fill) { fill.checked = !!a.fill; state.fill = !!a.fill; }
    var font = q("[data-style-font]");
    if (a.font && font) { font.value = a.font; state.font = a.font; }
    state.bold = !!a.bold;
    var bold = q("[data-style-bold]");
    if (bold) { bold.classList.toggle("on", state.bold); bold.setAttribute("aria-pressed", state.bold ? "true" : "false"); }
    state.italic = !!a.italic;
    var italic = q("[data-style-italic]");
    if (italic) { italic.classList.toggle("on", state.italic); italic.setAttribute("aria-pressed", state.italic ? "true" : "false"); }
    state.align = a.align || "left";
    qa("[data-style-align]").forEach(function (b) {
      var on = b.dataset.styleAlign === state.align;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var lh = q("[data-style-lineheight]");
    if (a.lineHeight && lh) { lh.value = String(a.lineHeight); state.lineHeight = a.lineHeight; }
  }

  function applyStyle(patch) {
    var a = state.selected;
    if (!a) return;
    if (!state.styleDirty) { remember(); state.styleDirty = true; }
    clearTimeout(state.styleTimer);
    state.styleTimer = setTimeout(function () { state.styleDirty = false; }, 700);
    Object.keys(patch).forEach(function (k) { a[k] = patch[k]; });
    state.dirty = true;
    paintAllOverlays();
    refreshAnnoList();
    saveStateLabel();
  }

  /* ---------- history ---------- */
  function serializeNow() {
    return { pages: JSON.parse(JSON.stringify(state.pages)), active: state.active };
  }
  function rememberSnapshot(snap) {
    if (!snap) return;
    state.history.push(snap);
    if (state.history.length > 24) state.history.shift();
    state.future = [];
    syncHistoryButtons();
  }
  function remember() { rememberSnapshot(serializeNow()); }
  function beginGesture() { state.gestureSnapshot = serializeNow(); }
  function endGesture(changed) {
    if (changed && state.gestureSnapshot) {
      rememberSnapshot(state.gestureSnapshot);
      state.dirty = true;
    }
    state.gestureSnapshot = null;
  }
  function undo() {
    if (!state.history.length) return;
    state.future.push(serializeNow());
    applySnapshot(state.history.pop());
    syncHistoryButtons();
  }
  function redo() {
    if (!state.future.length) return;
    state.history.push(serializeNow());
    applySnapshot(state.future.pop());
    syncHistoryButtons();
  }
  function applySnapshot(snap) {
    var same = snap.pages.length === state.pages.length && snap.pages.every(function (p, i) {
      var q = state.pages[i];
      return q && p.id === q.id && p.key === q.key && p.index === q.index && p.rotate === q.rotate;
    });
    state.pages = JSON.parse(JSON.stringify(snap.pages));
    state.active = MTH.clamp(snap.active || 0, 0, Math.max(0, state.pages.length - 1));
    state.selected = null;
    state.selectedPage = null;
    state.dirty = true;
    if (same) {
      paintAllOverlays();
      refreshPageList();
      refreshAnnoList();
      setActive(state.active);
    } else {
      buildPageShells();
      setActive(state.active);
      goPage(state.active, false);
    }
    refreshComments();
    saveStateLabel();
  }

  /* ---------- text / image inputs ---------- */
  function askText(defaultText, title, hint) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) { if (done) return; done = true; resolve(v); }
      var m = MTH.modal({
        title: title || "Add text",
        subtitle: hint || "The text is drawn locally on this page.",
        size: "sm",
        body: '<div class="field"><label for="viewer-text">Text</label><textarea class="input" id="viewer-text" rows="4" style="resize:vertical">' + MTH.esc(defaultText || "") + '</textarea><div class="hint">Use line breaks for separate lines. This is a visual annotation, not selectable PDF text.</div></div>',
        actions: '<button class="btn btn--sm btn--ghost" data-text-cancel>Cancel</button><button class="btn btn--sm" data-text-add>Add text</button>',
        onClose: function () { finish(null); }
      });
      var ta = m.body.querySelector("#viewer-text");
      setTimeout(function () { ta.focus(); ta.select(); }, 60);
      function submit() {
        var v = ta.value.trim();
        if (!v) { ta.focus(); return; }
        finish(v);
        m.close();
      }
      m.actions.querySelector("[data-text-cancel]").addEventListener("click", function () { m.close(); });
      m.actions.querySelector("[data-text-add]").addEventListener("click", submit);
      ta.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); submit(); } });
    });
  }

  function loadImageSrc(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("That image could not be loaded.")); };
      img.src = src;
    });
  }

  function readAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error("The image could not be read.")); };
      r.readAsDataURL(file);
    });
  }

  function addText(nx, ny) {
    askText("", "Add a text note").then(function (text) {
      if (!text) return;
      var p = currentPage();
      if (!p) return;
      remember();
      var a = {
        id: MTH.uid(), type: "text", text: text,
        x: MTH.clamp(nx, 0.01, 0.52), y: MTH.clamp(ny, 0.01, 0.9),
        w: 0.46, h: 0.12, color: state.color, lw: state.lw, fs: state.fs,
        opacity: state.opacity, fill: false, angle: 0, ar: 1,
        font: state.font, align: state.align, bold: state.bold, italic: state.italic, lineHeight: state.lineHeight
      };
      p.annos.push(a);
      state.dirty = true;
      state.selected = a;
      state.selectedPage = p;
      setTool("select");
      refreshAnnoList();
      paintAllOverlays();
      saveStateLabel();
    });
  }

  function addWatermark() {
    askText("CONFIDENTIAL", "Add a watermark", "A translucent tiled watermark covers the current page.").then(function (text) {
      if (!text) return;
      var p = currentPage();
      if (!p) return;
      remember();
      var a = {
        id: MTH.uid(), type: "watermark", text: text,
        x: 0, y: 0, w: 1, h: 1, color: state.color, lw: 1, fs: Math.max(34, state.fs * 2.4),
        opacity: Math.max(0.1, Math.min(0.35, state.opacity * 0.35)), fill: false, angle: -30, ar: 1
      };
      p.annos.push(a);
      state.dirty = true;
      setTool("select");
      refreshAnnoList();
      paintAllOverlays();
      saveStateLabel();
    });
  }

  async function addImage(nx, ny) {
    try {
      var files = await MTH.pick("image/png,image/jpeg,image/webp,image/gif", false);
      if (!files.length) return;
      var dataUrl = await readAsDataURL(files[0]);
      var img = await loadImageSrc(dataUrl);
      var p = currentPage();
      if (!p) return;
      var dim = visualSize(p);
      var w = 0.42;
      var ar = img.width / img.height;
      var h = (w * dim.w * ar) / dim.h;
      remember();
      var a = {
        id: MTH.uid(), type: "image", src: dataUrl, text: files[0].name,
        x: MTH.clamp(nx, 0.02, 0.9 - w * 0.35), y: MTH.clamp(ny, 0.02, 0.9),
        w: w, h: Math.min(0.9, h), color: "#000000", lw: 1, fs: 0,
        opacity: state.opacity, fill: false, angle: 0, ar: ar
      };
      p.annos.push(a);
      state.dirty = true;
      setTool("select");
      selectAnno(a);
      saveStateLabel();
      MTH.toast("Image placed. Drag it into position.", "ok");
    } catch (e) {
      if (e && !e.cancelled) MTH.toast(MTH.friendlyError(e), "err");
    }
  }

  function addStickyNote(nx, ny) {
    askText("", "Add a comment", "This note is pinned to the page and listed in the sidebar. Comments are stored only in this browser session until you export notes.").then(function (text) {
      if (!text) return;
      var p = currentPage();
      if (!p) return;
      remember();
      var a = {
        id: MTH.uid(), type: "note", text: text,
        x: MTH.clamp(nx, 0.005, 0.96), y: MTH.clamp(ny, 0.005, 0.96),
        w: 0.038, h: 0.038, color: state.color, lw: 1, fs: 12,
        opacity: 1, fill: true, angle: 0, ar: 1, resolved: false, created: Date.now()
      };
      p.annos.push(a);
      state.dirty = true;
      state.selected = a;
      state.selectedPage = p;
      setTool("select");
      refreshAnnoList();
      refreshComments();
      paintAllOverlays();
      saveStateLabel();
      MTH.toast("Comment added. Open the Comments panel to review or resolve it.", "ok", 3200);
    });
  }

  function openSignaturePad() {
    var m = MTH.modal({
      title: "Draw a signature",
      subtitle: "Sign with a mouse, stylus or finger. The signature is placed as a transparent image stamp.",
      size: "md",
      body: '<div class="sig-pad-wrap"><canvas class="sig-pad" data-sig-pad aria-label="Signature pad"></canvas><span class="sig-baseline" aria-hidden="true"></span></div>' +
        '<div class="sig-tools"><label class="sig-color"><span>Ink</span><input type="color" value="#0b1a33" data-sig-color></label>' +
        '<button class="btn btn--sm btn--ghost" type="button" data-sig-clear>' + ic("reset", 13) + ' Clear</button>' +
        '<span class="small muted" data-sig-hint>Draw above the line. The empty space is cropped automatically.</span></div>',
      actions: '<button class="btn btn--sm btn--ghost" data-sig-cancel>Cancel</button><button class="btn btn--sm" data-sig-use>' + ic("signature", 14) + ' Place signature</button>'
    });
    var canvas = m.body.querySelector("[data-sig-pad]");
    var ctx = canvas && canvas.getContext("2d");
    var color = m.body.querySelector("[data-sig-color]");
    var hint = m.body.querySelector("[data-sig-hint]");
    var use = m.actions.querySelector("[data-sig-use]");
    if (!ctx) { m.close(); MTH.toast("This browser could not open the signature pad.", "err"); return; }
    var drawing = false, last = null, dpr = 1;

    function setup() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(320, Math.round((r.width || 480) * dpr));
      canvas.height = Math.max(150, Math.round((r.height || 180) * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = color.value;
      canvas.dataset.dirty = "";
      hint.textContent = "Draw above the line. The empty space is cropped automatically.";
    }
    function point(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function down(e) {
      drawing = true;
      last = point(e);
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
    function move(e) {
      if (!drawing) return;
      var p = point(e);
      ctx.strokeStyle = color.value;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      canvas.dataset.dirty = "1";
      e.preventDefault();
    }
    function up(e) {
      drawing = false;
      try { if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    color.addEventListener("input", function () { ctx.strokeStyle = color.value; });
    m.body.querySelector("[data-sig-clear]").addEventListener("click", function () {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore();
      canvas.dataset.dirty = "";
    });
    m.actions.querySelector("[data-sig-cancel]").addEventListener("click", function () { m.close(); });
    setTimeout(setup, 40);

    use.addEventListener("click", function () {
      if (!canvas.dataset.dirty) { hint.textContent = "Draw your signature first."; hint.style.color = "var(--err)"; return; }
      var sw = canvas.width, sh = canvas.height;
      var src = canvas.getContext("2d").getImageData(0, 0, sw, sh).data;
      var minX = sw, minY = sh, maxX = 0, maxY = 0, found = false;
      for (var y = 0; y < sh; y++) {
        for (var x = 0; x < sw; x++) {
          if (src[(y * sw + x) * 4 + 3] > 8) {
            found = true;
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      if (!found) { hint.textContent = "Draw your signature first."; hint.style.color = "var(--err)"; return; }
      var pad = Math.max(8, Math.round(6 * dpr));
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(sw - 1, maxX + pad); maxY = Math.min(sh - 1, maxY + pad);
      var out = document.createElement("canvas");
      out.width = Math.max(1, maxX - minX + 1);
      out.height = Math.max(1, maxY - minY + 1);
      out.getContext("2d").drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
      var dataUrl = out.toDataURL("image/png");
      var p = currentPage();
      m.close();
      if (!p) return;
      loadImageSrc(dataUrl).then(function (img) {
        var dim = visualSize(p);
        var w = 0.34;
        var ar = img.width / img.height;
        var h = Math.min(0.4, (w * dim.w / ar) / dim.h);
        remember();
        var a = {
          id: MTH.uid(), type: "image", src: dataUrl, text: "Signature",
          x: Math.round((0.5 - w / 2) * 1000) / 1000, y: Math.round(MTH.clamp(0.86 - h, 0.02, 0.9) * 1000) / 1000,
          w: w, h: h, color: "#000000", lw: 1, fs: 0, opacity: 1, fill: false, angle: 0, ar: ar
        };
        p.annos.push(a);
        state.dirty = true;
        state.selected = a;
        state.selectedPage = p;
        setTool("select");
        refreshAnnoList();
        paintAllOverlays();
        saveStateLabel();
        MTH.toast("Signature placed. Drag it into position, or resize from the corner.", "ok", 3400);
      }).catch(function (e) { MTH.toast(MTH.friendlyError(e), "err"); });
    });
  }

  /* ---------- blank page ---------- */
  async function insertBlankPage() {
    if (!state.pages.length || state.readOnly || state.busy) return;
    state.busy = true;
    saveStateLabel();
    setStatus("Inserting a blank page…");
    try {
      var ref = currentPage();
      var dim = ref ? visualSize(ref) : { w: 595.28, h: 841.89 };
      var doc = await PDFLib.PDFDocument.create();
      doc.addPage([dim.w, dim.h]);
      var bytes = await doc.save({ useObjectStreams: true });
      var pdfjs = await MTH.pdf.openWithPrompt(bytes);
      var lib = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
      var key = MTH.uid();
      var src = { key: key, name: "Blank page", bytes: bytes, pdfjs: pdfjs, lib: lib, meta: {}, count: 1 };
      state.sources[key] = src;
      await readMeta(src);
      remember();
      var at = Math.min(state.pages.length, state.active + 1);
      state.pages.splice(at, 0, { id: MTH.uid(), key: key, index: 0, rotate: 0, annos: [] });
      state.dirty = true;
      state.active = at;
      buildPageShells();
      setActive(at);
      goPage(at, false);
      setStatus("Blank page inserted at position " + (at + 1) + ".", "ok");
      MTH.toast("Blank page inserted", "ok");
    } catch (e) {
      setStatus(MTH.friendlyError(e), "err");
      MTH.reportError(e, "viewer-blank-page");
    } finally {
      state.busy = false;
      saveStateLabel();
    }
  }

  /* ---------- comments & notes ---------- */
  function commentsAll() {
    var out = [];
    state.pages.forEach(function (p, pi) {
      (p.annos || []).forEach(function (a) { if (a.type === "note") out.push({ anno: a, page: p, pageIndex: pi }); });
    });
    return out;
  }

  function refreshComments() {
    if (!els.commentList) return;
    var comments = commentsAll();
    var open = comments.filter(function (c) { return !c.anno.resolved; }).length;
    if (els.commentSummary) els.commentSummary.textContent = comments.length ? open + " open · " + comments.length + " total" : "No comments yet.";
    if (!comments.length) {
      els.commentList.innerHTML = '<div class="editor-empty">Choose the sticky-comment tool and click a page to leave feedback.<br>Comments stay with this session and can be exported as notes.</div>';
      return;
    }
    els.commentList.innerHTML = comments.map(function (c) {
      var a = c.anno;
      var excerpt = String(a.text || "").replace(/\s+/g, " ").slice(0, 70);
      return '<div class="comment-item' + (a.resolved ? " is-resolved" : "") + (state.selected === a ? " is-selected" : "") + '" data-comment="' + MTH.esc(a.id) + '">' +
        '<button type="button" class="comment-main" data-comment-go title="Go to page ' + (c.pageIndex + 1) + '">' +
          '<span class="comment-page">p.' + (c.pageIndex + 1) + '</span>' +
          '<span class="comment-text">' + MTH.esc(excerpt || "Comment") + '</span>' +
        '</button>' +
        '<button type="button" class="comment-resolve' + (a.resolved ? " on" : "") + '" data-comment-resolve title="' + (a.resolved ? "Reopen comment" : "Mark resolved") + '" aria-label="' + (a.resolved ? "Reopen comment" : "Mark resolved") + '" aria-pressed="' + (a.resolved ? "true" : "false") + '">' + ic("check", 12) + '</button>' +
        '<button type="button" class="comment-del" data-comment-del title="Delete comment" aria-label="Delete comment">' + ic("trash", 12) + '</button></div>';
    }).join("");
    els.commentList.onclick = function (e) {
      var resolve = e.target.closest("[data-comment-resolve]");
      var del = e.target.closest("[data-comment-del]");
      var go = e.target.closest("[data-comment-go]");
      var item = e.target.closest("[data-comment]");
      if (!item) return;
      var found = commentsAll().filter(function (c) { return c.anno.id === item.dataset.comment; })[0];
      if (!found) return;
      if (resolve) {
        remember();
        found.anno.resolved = !found.anno.resolved;
        state.dirty = true;
        refreshComments();
        paintAllOverlays();
        saveStateLabel();
        return;
      }
      if (del) { removeAnnotation(found.anno); return; }
      if (go) {
        goPage(found.pageIndex);
        setTool("select");
        selectAnno(found.anno, found.page);
      }
    };
  }

  function annotationLabel(a) {
    return ({ text: a && a.cover ? "Replaced text" : "Text note", note: "Comment", rect: "Rectangle", ellipse: "Ellipse", line: "Line / arrow", highlight: "Highlight", ink: "Freehand ink", image: a && a.text === "Signature" ? "Signature" : "Image", watermark: "Watermark", redact: "Redaction", whiteout: "Whiteout", underline: "Underline", strike: "Strike-through" })[a && a.type] || (a && a.type) || "Mark";
  }

  function exportNotes() {
    var rows = allAnnotations();
    if (!rows.length) { MTH.toast("There are no annotations to export yet.", "warn"); return; }
    var lines = [
      "MULTI TOOL HUB — Annotation notes",
      "Document: " + (state.docName || "Untitled PDF"),
      "Exported: " + new Date().toLocaleString(),
      "Pages: " + state.pages.length + " · Annotations: " + rows.length,
      "Developed by chank!nd3 p4d4y41! l FAYAS MONU",
      ""
    ];
    rows.forEach(function (r) {
      var a = r.anno;
      lines.push("Page " + (r.pageIndex + 1) + " · " + annotationLabel(a) + (a.resolved ? " · resolved" : ""));
      if (a.text) String(a.text).split(/\r?\n/).forEach(function (t) { lines.push("    " + t); });
      if (a.type === "note" && a.created) lines.push("    Created: " + new Date(a.created).toLocaleString());
      if (a.x != null) lines.push("    Position: " + Math.round(a.x * 100) + "%, " + Math.round(a.y * 100) + "%");
      lines.push("");
    });
    var name = MTH.baseName(state.docName || "document") + "-notes.txt";
    MTH.download(lines.join("\r\n"), name, "text/plain;charset=utf-8");
    MTH.toast("Annotation notes downloaded", "ok");
  }

  function removeAnnotation(anno) {
    var found = null;
    state.pages.forEach(function (p) {
      var i = (p.annos || []).indexOf(anno);
      if (i !== -1) { found = { page: p, index: i }; }
    });
    if (!found) return;
    remember();
    found.page.annos.splice(found.index, 1);
    if (state.selected === anno) { state.selected = null; state.selectedPage = null; }
    state.dirty = true;
    refreshAnnoList();
    paintAllOverlays();
    refreshPageList();
    refreshComments();
    saveStateLabel();
  }

  /* ---------- annotation painting ---------- */
  var imageCache = {};
  function cachedImage(src) {
    if (!src) return null;
    if (imageCache[src]) return imageCache[src];
    var img = new Image();
    img.onload = function () { paintAllOverlays(); };
    img.src = src;
    imageCache[src] = img;
    return img;
  }

  function clamp01(v) { return MTH.clamp(v, 0, 1); }

  function annoBox(a, Wv, Hv, unit) {
    if (a.type === "watermark") return { x: 0, y: 0, w: 1, h: 1 };
    if (a.type === "ink" && a.points && a.points.length) {
      var xs = a.points.map(function (p) { return p[0]; });
      var ys = a.points.map(function (p) { return p[1]; });
      return { x: Math.min.apply(null, xs), y: Math.min.apply(null, ys), w: Math.max.apply(null, xs) - Math.min.apply(null, xs), h: Math.max.apply(null, ys) - Math.min.apply(null, ys) };
    }
    if (a.type === "line") {
      return { x: Math.min(a.x, a.x + a.w), y: Math.min(a.y, a.y + a.h), w: Math.abs(a.w), h: Math.abs(a.h) };
    }
    return { x: a.x, y: a.y, w: a.w, h: a.h };
  }

  function wrapLines(ctx, text, maxWidth) {
    var raw = String(text == null ? "" : text).split(/\r?\n/);
    var out = [];
    raw.forEach(function (paragraph) {
      if (!paragraph) { out.push(""); return; }
      var words = paragraph.split(/\s+/);
      var line = "";
      words.forEach(function (w) {
        var test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = w; }
        else { line = test; }
      });
      out.push(line);
    });
    return out;
  }

  function contextLines(ctx, lines, x, lh) {
    lines.forEach(function (line, i) { if (line) ctx.fillText(line, x, i * lh); });
  }

  function paintAnno(ctx, a, Wv, Hv, unit, selection) {
    if (!a || !Wv || !Hv) return;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    var x = a.x * Wv, y = a.y * Hv, w = a.w * Wv, h = a.h * Hv;
    var alpha = a.opacity == null ? 1 : clamp01(a.opacity);
    var lw = Math.max(0.6, (a.lw || 1) * unit);
    ctx.strokeStyle = a.color || "#b08832";
    ctx.fillStyle = a.color || "#b08832";

    if (a.type === "text") {
      var px = Math.max(4, (a.fs || 18) * unit);
      var lh = px * (a.lineHeight || 1.32);
      var families = {
        Helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        Georgia: 'Georgia, "Times New Roman", serif',
        Times: '"Times New Roman", Times, serif',
        Courier: '"Courier New", Courier, monospace',
        Verdana: 'Verdana, Geneva, sans-serif'
      };
      var family = families[a.font] || families.Helvetica;
      var weight = (a.italic ? "italic " : "") + (a.bold ? "700 " : "400 ");
      ctx.translate(x, y);
      if (a.angle) ctx.rotate(a.angle * Math.PI / 180);
      ctx.globalAlpha = alpha;
      if (a.cover) {
        ctx.fillStyle = a.coverColor || "#ffffff";
        ctx.fillRect(0, 0, Math.abs(w), Math.abs(h));
      }
      ctx.font = weight + px + "px " + family;
      ctx.textBaseline = "top";
      ctx.textAlign = a.align === "center" ? "center" : a.align === "right" ? "right" : "left";
      ctx.fillStyle = a.color || "#111111";
      var anchorX = a.align === "center" ? Math.abs(w) / 2 : a.align === "right" ? Math.abs(w) : 0;
      var lines = wrapLines(ctx, a.text || "", Math.max(12, Math.abs(w)));
      contextLines(ctx, lines, anchorX, lh);
    } else if (a.type === "rect") {
      if (a.fill) { ctx.globalAlpha = alpha * 0.18; ctx.fillRect(x, y, w, h); }
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.strokeRect(x, y, w, h);
    } else if (a.type === "ellipse") {
      var rx = Math.abs(w) / 2, ry = Math.abs(h) / 2;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      if (a.fill) { ctx.globalAlpha = alpha * 0.18; ctx.fill(); }
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.stroke();
    } else if (a.type === "line") {
      var x1 = x, y1 = y, x2 = x + w, y2 = y + h;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      var ang = Math.atan2(y2 - y1, x2 - x1);
      var head = Math.max(6, lw * 3.4);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 7), y2 - head * Math.sin(ang - Math.PI / 7));
      ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 7), y2 - head * Math.sin(ang + Math.PI / 7));
      ctx.closePath(); ctx.fill();
    } else if (a.type === "highlight") {
      ctx.globalAlpha = alpha * 0.34;
      ctx.fillStyle = a.color || "#f2d16b";
      ctx.fillRect(x, y, w, h);
    } else if (a.type === "underline" || a.type === "strike") {
      var lineY = a.type === "underline" ? y + Math.abs(h) : y + Math.abs(h) / 2;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x, lineY);
      ctx.lineTo(x + w, lineY);
      ctx.stroke();
    } else if (a.type === "redact" || a.type === "whiteout") {
      ctx.globalAlpha = 1;
      ctx.fillStyle = a.type === "redact" ? "#000000" : "#ffffff";
      ctx.fillRect(x, y, w, h);
    } else if (a.type === "note") {
      var ns = Math.max(12, 16 * unit);
      ctx.globalAlpha = 1;
      ctx.translate(x, y);
      ctx.fillStyle = a.resolved ? "#2f855a" : (a.color || "#b08832");
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(0, 0, ns, ns, ns * 0.22);
      else ctx.rect(0, 0, ns, ns);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, ns * 0.085);
      ctx.beginPath();
      ctx.moveTo(ns * 0.26, ns * 0.30); ctx.lineTo(ns * 0.74, ns * 0.30);
      ctx.moveTo(ns * 0.26, ns * 0.50); ctx.lineTo(ns * 0.64, ns * 0.50);
      ctx.moveTo(ns * 0.26, ns * 0.70); ctx.lineTo(ns * 0.56, ns * 0.70);
      ctx.stroke();
      if (a.resolved) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1.2, ns * 0.1);
        ctx.beginPath();
        ctx.moveTo(ns * 0.74, ns * 0.76); ctx.lineTo(ns * 0.82, ns * 0.86); ctx.lineTo(ns * 1.0, ns * 0.62);
        ctx.stroke();
      }
    } else if (a.type === "ink") {
      var pts = a.points || [];
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.beginPath();
      pts.forEach(function (pt, i) {
        var px2 = pt[0] * Wv, py2 = pt[1] * Hv;
        if (i === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
      });
      if (pts.length === 1) { ctx.arc(pts[0][0] * Wv, pts[0][1] * Hv, lw / 2, 0, Math.PI * 2); ctx.fill(); }
      else ctx.stroke();
    } else if (a.type === "image") {
      var img = cachedImage(a.src);
      if (img && img.complete && img.naturalWidth) {
        var iw = Math.abs(w), ih = Math.abs(h);
        var rotated = Math.abs((((a.angle || 0) % 180) + 180) % 180 - 90) < 1;
        var dw = rotated ? ih : iw, dh = rotated ? iw : ih;
        ctx.globalAlpha = alpha;
        ctx.translate(x + w / 2, y + h / 2);
        if (a.angle) ctx.rotate(a.angle * Math.PI / 180);
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      }
    } else if (a.type === "watermark") {
      var fpx = Math.max(18, (a.fs || 48) * unit);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = a.color || "#7a6120";
      ctx.font = "700 " + fpx + 'px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.translate(Wv / 2, Hv / 2);
      ctx.rotate((a.angle || -30) * Math.PI / 180);
      var text = a.text || "CONFIDENTIAL";
      var tw = ctx.measureText(text).width;
      var stepX = tw + fpx * 2.2, stepY = fpx * 2.5;
      var cols = Math.ceil(Wv / Math.max(40, stepX)) + 2;
      var rows = Math.ceil(Hv / Math.max(40, stepY)) + 2;
      for (var row = -rows; row <= rows; row++) {
        for (var col = -cols; col <= cols; col++) {
          ctx.fillText(text, col * stepX - (row % 2 ? stepX / 2 : 0), row * stepY);
        }
      }
      ctx.textAlign = "start";
    }

    if (selection) {
      var b = annoBox(a, Wv, Hv, unit);
      ctx.globalAlpha = 1;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = "#b08832";
      ctx.strokeRect(b.x * Wv - 2, b.y * Hv - 2, b.w * Wv + 4, b.h * Hv + 4);
      ctx.setLineDash([]);
      ctx.fillStyle = "#b08832";
      [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].forEach(function (pt) {
        ctx.fillRect(pt[0] * Wv - 3.5, pt[1] * Hv - 3.5, 7, 7);
      });
    }
    ctx.restore();
  }

  function paintOverlay(i) {
    var rec = state.rendered[i];
    if (!rec) return;
    var ctx = rec.overlay.getContext("2d");
    if (!ctx) return;
    var pr = rec.info.pixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, rec.overlay.width, rec.overlay.height);
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    var p = state.pages[i];
    if (!p) return;
    (p.annos || []).forEach(function (a) {
      paintAnno(ctx, a, rec.info.width, rec.info.height, state.zoom, a === state.selected);
    });
  }

  function paintAllOverlays() {
    Object.keys(state.rendered).forEach(function (k) { paintOverlay(Number(k)); });
  }

  /* ---------- pointer interaction ---------- */
  function pointFromEvent(e, canvas) {
    var r = canvas.getBoundingClientRect();
    return { x: clamp01((e.clientX - r.left) / Math.max(1, r.width)), y: clamp01((e.clientY - r.top) / Math.max(1, r.height)) };
  }

  function hitTest(p, nx, ny, Wv, Hv) {
    var list = (p.annos || []).slice().reverse();
    for (var i = 0; i < list.length; i++) {
      var b = annoBox(list[i], Wv, Hv, state.zoom);
      var padX = 6 / Math.max(1, Wv), padY = 6 / Math.max(1, Hv);
      if (nx >= b.x - padX && nx <= b.x + b.w + padX && ny >= b.y - padY && ny <= b.y + b.h + padY) return list[i];
    }
    return null;
  }

  function overlayDown(e, i) {
    if (e.button != null && e.button !== 0) return;
    if (!state.rendered[i]) { schedule(i); return; }
    var canvas = e.currentTarget;
    var pt = pointFromEvent(e, canvas);
    var p = state.pages[i];
    if (!p) return;
    setActive(i);
    var info = state.rendered[i].info;
    var tool = state.tool;

    if (tool === "select") {
      var hit = hitTest(p, pt.x, pt.y, info.width, info.height);
      if (!hit) { selectAnno(null); return; }
      selectAnno(hit);
      beginGesture();
      var b = annoBox(hit, info.width, info.height, state.zoom);
      var resize = Math.abs(pt.x - (b.x + b.w)) < 0.025 && Math.abs(pt.y - (b.y + b.h)) < 0.025;
      state.drag = { mode: resize ? "resize" : "move", anno: hit, page: p, start: pt, box: { x: b.x, y: b.y, w: b.w, h: b.h }, moved: false };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
      return;
    }

    if (tool === "text") { addText(pt.x, pt.y); return; }
    if (tool === "note") { addStickyNote(pt.x, pt.y); return; }
    if (tool === "watermark") { addWatermark(); return; }
    if (tool === "image") { addImage(pt.x, pt.y); return; }
    if (tool === "signature") { openSignaturePad(); return; }

    beginGesture();
    var isReplace = tool === "replace";
    var a = {
      id: MTH.uid(), type: isReplace ? "text" : tool, text: "",
      x: pt.x, y: pt.y, w: 0, h: 0,
      color: tool === "highlight" ? (state.color === "#b08832" ? "#f2d16b" : state.color) : tool === "redact" ? "#000000" : tool === "whiteout" ? "#ffffff" : state.color,
      lw: state.lw, fs: state.fs, opacity: tool === "highlight" ? Math.min(1, state.opacity + .15) : state.opacity,
      fill: isReplace ? true : state.fill, angle: 0, ar: 1, points: tool === "ink" ? [[pt.x, pt.y]] : null,
      font: state.font, align: state.align, bold: state.bold, italic: state.italic, lineHeight: state.lineHeight,
      cover: isReplace, coverColor: "#ffffff", replacePending: isReplace
    };
    p.annos.push(a);
    state.selected = a;
    state.selectedPage = p;
    state.draw = { anno: a, page: p, start: pt, index: i };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    refreshAnnoList();
    paintOverlay(i);
    e.preventDefault();
  }

  function overlayMove(e, i) {
    var canvas = e.currentTarget;
    var pt = pointFromEvent(e, canvas);
    var info = state.rendered[i] && state.rendered[i].info;
    if (!info) return;

    if (state.drag) {
      var d = state.drag;
      var dx = pt.x - d.start.x, dy = pt.y - d.start.y;
      if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) d.moved = true;
      var a = d.anno;
      if (d.mode === "move") {
        a.x = MTH.clamp(d.box.x + dx, 0, Math.max(0, 1 - a.w));
        a.y = MTH.clamp(d.box.y + dy, 0, Math.max(0, 1 - a.h));
      } else {
        a.x = d.box.x; a.y = d.box.y;
        a.w = MTH.clamp(d.box.w + dx, 0.02, 1 - a.x);
        a.h = MTH.clamp(d.box.h + dy, 0.012, 1 - a.y);
      }
      paintOverlay(i);
      e.preventDefault();
      return;
    }

    if (!state.draw) return;
    var temp = state.draw.anno;
    var sx = state.draw.start.x, sy = state.draw.start.y;
    if (temp.type === "ink") {
      var pts = temp.points;
      var last = pts[pts.length - 1];
      if (Math.abs(pt.x - last[0]) + Math.abs(pt.y - last[1]) > 0.0025) pts.push([pt.x, pt.y]);
    } else if (temp.type === "line") {
      temp.x = sx; temp.y = sy; temp.w = pt.x - sx; temp.h = pt.y - sy;
    } else {
      temp.x = Math.min(sx, pt.x); temp.y = Math.min(sy, pt.y);
      temp.w = Math.abs(pt.x - sx); temp.h = Math.abs(pt.y - sy);
    }
    paintOverlay(i);
    e.preventDefault();
  }

  function overlayUp(e, i) {
    var canvas = e.currentTarget;
    try { if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    if (state.drag) {
      var moved = state.drag.moved;
      endGesture(moved);
      if (moved) { refreshPageList(); saveStateLabel(); }
      state.drag = null;
      return;
    }
    if (!state.draw) return;
    var d = state.draw;
    var bad = false;
    if (d.anno.type === "ink") bad = !d.anno.points || d.anno.points.length < 2;
    else if (d.anno.type === "line") bad = Math.abs(d.anno.w) < 0.004 && Math.abs(d.anno.h) < 0.004;
    else bad = d.anno.w < 0.005 || d.anno.h < 0.005;
    if (bad) {
      var idx = (d.page.annos || []).indexOf(d.anno);
      if (idx !== -1) d.page.annos.splice(idx, 1);
      if (state.selected === d.anno) state.selected = null;
      endGesture(false);
    } else {
      endGesture(true);
      refreshPageList();
      saveStateLabel();
    }
    var pendingReplace = !bad && d.anno.replacePending;
    var replaceAnno = d.anno;
    state.draw = null;
    setTool("select");
    refreshAnnoList();
    refreshComments();
    paintOverlay(i);
    if (pendingReplace) {
      delete replaceAnno.replacePending;
      askText("", "Replace text", "Type the replacement wording. The covered area is painted white with the new text on top, so it moves as one mark.").then(function (text) {
        if (!text || !text.trim()) {
          var page = null;
          state.pages.forEach(function (p) { if ((p.annos || []).indexOf(replaceAnno) !== -1) page = p; });
          if (page) {
            var at = page.annos.indexOf(replaceAnno);
            if (at !== -1) page.annos.splice(at, 1);
          }
          if (state.selected === replaceAnno) { state.selected = null; state.selectedPage = null; }
          state.dirty = true;
          refreshAnnoList();
          refreshPageList();
          refreshComments();
          paintAllOverlays();
          saveStateLabel();
          MTH.toast("Text replacement cancelled", "info", 1800);
          return;
        }
        replaceAnno.text = text.trim();
        state.dirty = true;
        state.selected = replaceAnno;
        refreshAnnoList();
        refreshPageList();
        paintAllOverlays();
        saveStateLabel();
        MTH.toast("Text replaced. Use the style panel to adjust the font or size.", "ok", 3200);
      });
    }
  }

  function overlayDouble(e, i) {
    var rec = state.rendered[i];
    if (!rec) return;
    var canvas = e.currentTarget;
    var pt = pointFromEvent(e, canvas);
    var p = state.pages[i];
    if (!p) return;
    var hit = hitTest(p, pt.x, pt.y, rec.info.width, rec.info.height);
    if (!hit) return;
    if (hit.type !== "text" && hit.type !== "watermark" && hit.type !== "note") return;
    e.preventDefault();
    var title = hit.type === "watermark" ? "Edit watermark" : hit.type === "note" ? "Edit comment" : hit.cover ? "Edit replacement text" : "Edit text note";
    askText(hit.text || "", title).then(function (text) {
      if (!text || !text.trim()) return;
      remember();
      hit.text = text.trim();
      state.dirty = true;
      refreshAnnoList();
      refreshComments();
      paintAllOverlays();
      saveStateLabel();
    });
  }

  /* ---------- page operations ---------- */
  function remapAnno(a, dir) {
    function mapPt(x, y) { return dir > 0 ? [1 - y, x] : [y, 1 - x]; }
    if (a.type === "watermark") { a.angle = (a.angle || 0) + dir * 90; return; }
    if (a.type === "ink") {
      a.points = (a.points || []).map(function (p) { return mapPt(p[0], p[1]); });
      return;
    }
    if (a.type === "line") {
      var p1 = mapPt(a.x, a.y), p2 = mapPt(a.x + a.w, a.y + a.h);
      a.x = p1[0]; a.y = p1[1]; a.w = p2[0] - p1[0]; a.h = p2[1] - p1[1];
      return;
    }
    var q1 = mapPt(a.x, a.y), q2 = mapPt(a.x + a.w, a.y + a.h);
    a.x = Math.min(q1[0], q2[0]);
    a.y = Math.min(q1[1], q2[1]);
    a.w = Math.abs(q2[0] - q1[0]);
    a.h = Math.abs(q2[1] - q1[1]);
    if (a.angle) a.angle += dir * 90;
  }

  function relayoutPage(i) {
    var el = q('.viewer-page[data-index="' + i + '"]');
    var p = state.pages[i];
    if (!el || !p) return;
    var dim = visualSize(p);
    var sheet = el.querySelector("[data-sheet]");
    sheet.style.width = (dim.w * state.zoom) + "px";
    sheet.style.aspectRatio = dim.w + " / " + dim.h;
  }

  function rotatePage(i, dir) {
    var p = state.pages[i];
    if (!p) return;
    remember();
    p.rotate = ((p.rotate + dir * 90) % 360 + 360) % 360;
    (p.annos || []).forEach(function (a) { remapAnno(a, dir); });
    state.dirty = true;
    state.active = i;
    relayoutPage(i);
    invalidateRender();
    refreshPageList();
    refreshAnnoList();
    setActive(i);
    MTH.toast("Page rotated " + (dir > 0 ? "90° right" : "90° left"), "ok");
  }

  function rotateAll() {
    if (!state.pages.length) return;
    remember();
    state.pages.forEach(function (p) {
      p.rotate = ((p.rotate + 90) % 360 + 360) % 360;
      (p.annos || []).forEach(function (a) { remapAnno(a, 1); });
    });
    state.dirty = true;
    invalidateRender();
    qa(".viewer-page").forEach(function (el, i) { relayoutPage(i); });
    refreshPageList();
    refreshAnnoList();
    MTH.toast("Every page rotated 90° right", "ok");
  }

  function movePage(i, dir) {
    var to = i + dir;
    if (i < 0 || i >= state.pages.length || to < 0 || to >= state.pages.length) return;
    remember();
    var p = state.pages.splice(i, 1)[0];
    state.pages.splice(to, 0, p);
    state.dirty = true;
    state.active = to;
    buildPageShells();
    setActive(to);
    goPage(to, false);
    MTH.toast("Page moved to position " + (to + 1), "ok");
  }

  async function deletePage(i) {
    if (i < 0 || i >= state.pages.length) return;
    if (state.pages.length === 1) {
      MTH.toast("A PDF needs at least one page. Delete the file instead, or split it first.", "warn");
      return;
    }
    var ok = await MTH.confirm({
      title: "Delete page " + (i + 1) + "?",
      message: "This removes the page and its annotations from the working copy. The original file on disk is not changed.",
      confirmText: "Delete page",
      danger: true
    });
    if (!ok) return;
    remember();
    state.pages.splice(i, 1);
    state.dirty = true;
    state.active = Math.min(i, state.pages.length - 1);
    buildPageShells();
    setActive(state.active);
    goPage(state.active, false);
    MTH.toast("Page deleted", "ok");
  }

  function duplicatePage(i) {
    var p = state.pages[i];
    if (!p) return;
    remember();
    var copy = JSON.parse(JSON.stringify(p));
    copy.id = MTH.uid();
    (copy.annos || []).forEach(function (a) { a.id = MTH.uid(); });
    state.pages.splice(i + 1, 0, copy);
    state.dirty = true;
    state.active = i + 1;
    buildPageShells();
    setActive(i + 1);
    goPage(i + 1, false);
    MTH.toast("Page duplicated", "ok");
  }

  /* ---------- merge ---------- */
  async function mergePdf() {
    if (state.readOnly || state.busy) return;
    var files = await MTH.pick(".pdf,application/pdf", true);
    if (!files.length) return;
    state.busy = true;
    saveStateLabel();
    setStatus("Importing " + files.length + " PDF" + (files.length === 1 ? "" : "s") + "…");
    try {
      var imported = [];
      for (var f = 0; f < files.length; f++) {
        setStatus("Opening " + files[f].name + "…");
        var src = await importSource(files[f]);
        imported.push(src);
      }
      remember();
      var firstNew = state.pages.length;
      imported.forEach(function (src) {
        for (var i = 0; i < src.count; i++) state.pages.push({ id: MTH.uid(), key: src.key, index: i, rotate: 0, annos: [] });
      });
      state.dirty = true;
      buildPageShells();
      setActive(firstNew);
      goPage(firstNew, false);
      setStatus("Merged " + imported.length + " document" + (imported.length === 1 ? "" : "s") + ". Review the page order, then export.", "ok");
      MTH.toast("PDFs merged into the working document", "ok");
    } catch (e) {
      if (!e || !e.cancelled) {
        setStatus(MTH.friendlyError(e), "err");
        MTH.reportError(e, "viewer-merge");
      }
    } finally {
      state.busy = false;
      saveStateLabel();
    }
  }

  /* ---------- extract / split ---------- */
  function openExtract() {
    if (!state.pages.length || state.readOnly) return;
    var count = state.pages.length;
    var m = MTH.modal({
      title: "Extract pages",
      subtitle: "Build a separate PDF from a page range. Annotations and rotations are included.",
      size: "sm",
      body: '<div class="field"><label for="extract-range">Pages</label><input class="input" id="extract-range" placeholder="1-3, 7" value="' + (state.active + 1) + '"><div class="hint">Use commas for separate pages and a dash for ranges. This document has ' + count + ' pages.</div></div><div class="status" data-extract-status></div>',
      actions: '<button class="btn btn--sm btn--ghost" data-extract-cancel>Cancel</button><button class="btn btn--sm" data-extract-go>Extract PDF</button>'
    });
    var input = m.body.querySelector("#extract-range");
    var status = m.body.querySelector("[data-extract-status]");
    var go = m.actions.querySelector("[data-extract-go]");
    m.actions.querySelector("[data-extract-cancel]").addEventListener("click", function () { m.close(); });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go.click(); } });
    go.addEventListener("click", async function () {
      var indices;
      try { indices = MTH.ranges(input.value, count); }
      catch (e) { MTH.status(status, e.message, "err"); return; }
      if (!indices.length) { MTH.status(status, "Choose at least one page.", "err"); return; }
      MTH.busy(go, true);
      MTH.status(status, "Building the extract…");
      try {
        var pages = indices.map(function (i) { return state.pages[i]; });
        var name = MTH.baseName(state.docName) + "-extract.pdf";
        var result = await buildPdf(pages, { name: name, onProgress: function (v) { MTH.status(status, "Rendering " + Math.round(v * 100) + "%…"); } });
        MTH.download(result.bytes, name, "application/pdf");
        MTH.status(status, "Saved " + name + " · " + MTH.fmtBytes(result.bytes.byteLength), "ok");
        MTH.toast("Extracted PDF downloaded", "ok");
        setTimeout(function () { m.close(); }, 700);
      } catch (e) {
        MTH.busy(go, false);
        MTH.status(status, MTH.friendlyError(e), "err");
        MTH.reportError(e, "viewer-extract");
      }
    });
  }

  function openSplit() {
    if (!state.pages.length || state.readOnly) return;
    var count = state.pages.length;
    var m = MTH.modal({
      title: "Split this PDF",
      subtitle: "Create several PDFs, then download them together in one ZIP.",
      size: "sm",
      body: '<div class="field"><label for="split-mode">How should it split?</label><select class="input" id="split-mode" data-split-mode>' +
        '<option value="each">One PDF per page</option>' +
        '<option value="chunks" selected>Fixed-size chunks</option>' +
        '<option value="ranges">One PDF per custom range</option></select></div>' +
        '<div class="field" data-split-chunks><label for="split-n">Pages per file</label><input class="input" id="split-n" type="number" min="1" max="' + count + '" value="' + Math.min(10, count) + '"><div class="hint">The last chunk can be shorter.</div></div>' +
        '<div class="field" data-split-ranges hidden><label for="split-ranges">Ranges</label><input class="input" id="split-ranges" placeholder="1-3, 4-6, 7"><div class="hint">Each comma-separated range becomes its own PDF.</div></div>' +
        '<div class="notice">Every output keeps the current page order, rotation and annotations. The original file is untouched.</div><div class="status" data-split-status></div>',
      actions: '<button class="btn btn--sm btn--ghost" data-split-cancel>Cancel</button><button class="btn btn--sm" data-split-go>Split & download</button>'
    });
    var mode = m.body.querySelector("[data-split-mode]");
    var chunks = m.body.querySelector("[data-split-chunks]");
    var ranges = m.body.querySelector("[data-split-ranges]");
    var status = m.body.querySelector("[data-split-status]");
    var go = m.actions.querySelector("[data-split-go]");
    mode.addEventListener("change", function () {
      chunks.hidden = mode.value !== "chunks";
      ranges.hidden = mode.value !== "ranges";
    });
    m.actions.querySelector("[data-split-cancel]").addEventListener("click", function () { m.close(); });
    go.addEventListener("click", async function () {
      var groups = [];
      if (mode.value === "each") {
        state.pages.forEach(function (p, i) { groups.push({ pages: [p], label: "p" + (i + 1) }); });
      } else if (mode.value === "chunks") {
        var n = parseInt(m.body.querySelector("#split-n").value, 10);
        if (isNaN(n) || n < 1) { MTH.status(status, "Enter a chunk size of at least 1.", "err"); return; }
        for (var i = 0; i < count; i += n) {
          var slice = state.pages.slice(i, Math.min(count, i + n));
          groups.push({ pages: slice, label: "pages-" + (i + 1) + "-" + (i + slice.length) });
        }
      } else {
        var text = m.body.querySelector("#split-ranges").value;
        var parts = text.split(/[,;]/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (!parts.length) { MTH.status(status, "Enter at least one page range.", "err"); return; }
        try {
          parts.forEach(function (part) {
            var idx = MTH.ranges(part, count);
            if (!idx.length) return;
            groups.push({ pages: idx.map(function (j) { return state.pages[j]; }), label: "pages-" + part.replace(/[^0-9-]+/g, "_") });
          });
        } catch (e) { MTH.status(status, e.message, "err"); return; }
      }
      if (!groups.length) { MTH.status(status, "No pages were selected.", "err"); return; }
      MTH.busy(go, true);
      try {
        var base = MTH.baseName(state.docName);
        var entries = [];
        for (var g = 0; g < groups.length; g++) {
          MTH.status(status, "Building PDF " + (g + 1) + " of " + groups.length + "…");
          var name = base + "-" + groups[g].label + ".pdf";
          var result = await buildPdf(groups[g].pages, { name: name });
          entries.push({ name: name, data: result.bytes });
          await MTH.sleep(0);
        }
        if (entries.length === 1) {
          MTH.download(entries[0].data, entries[0].name, "application/pdf");
          MTH.status(status, "Saved " + entries[0].name + ".", "ok");
        } else {
          MTH.status(status, "Packing " + entries.length + " PDFs into a ZIP…");
          var zipName = base + "-split.zip";
          var blob = await MTH.zipBlob(entries);
          MTH.download(blob, zipName, "application/zip");
          MTH.status(status, "Saved " + zipName + " · " + entries.length + " files.", "ok");
        }
        MTH.toast("Split complete", "ok");
        setTimeout(function () { m.close(); }, 900);
      } catch (e) {
        MTH.busy(go, false);
        MTH.status(status, MTH.friendlyError(e), "err");
        MTH.reportError(e, "viewer-split");
      }
    });
  }

  /* ---------- PDF export ---------- */
  function canvasBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error("The browser could not encode this page. Try a lower resolution."));
      }, type || "image/png", quality);
    });
  }

  async function makeOverlay(page, W, H, rotation, scale) {
    var rot = ((rotation % 360) + 360) % 360;
    var s = MTH.clamp(scale || 2, 0.8, Math.max(0.8, 5000 / Math.max(W, H)));
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(W * s));
    canvas.height = Math.max(1, Math.round(H * s));
    var ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser could not create a canvas context for the annotation overlay.");
    if (rot === 90) ctx.setTransform(0, -s, s, 0, 0, H * s);
    else if (rot === 180) ctx.setTransform(-s, 0, 0, -s, W * s, H * s);
    else if (rot === 270) ctx.setTransform(0, s, -s, 0, W * s, 0);
    else ctx.setTransform(s, 0, 0, s, 0, 0);
    var Wv = rot % 180 === 0 ? W : H;
    var Hv = rot % 180 === 0 ? H : W;
    (page.annos || []).forEach(function (a) { paintAnno(ctx, a, Wv, Hv, s, false); });
    var blob = await canvasBlob(canvas, "image/png");
    return new Uint8Array(await blob.arrayBuffer());
  }

  async function buildPdf(pages, opts) {
    opts = opts || {};
    if (!pages || !pages.length) throw new Error("There are no pages to export.");
    if (typeof PDFLib === "undefined") throw new Error("The PDF writing engine did not load. Refresh the page and try again.");
    if (opts.flatten) return await buildFlattened(pages, opts);

    var out = await PDFLib.PDFDocument.create();
    out.setProducer("MULTI TOOL HUB");
    out.setCreator("MULTI TOOL HUB — local browser export");
    try { out.setTitle(MTH.baseName(opts.name || state.docName || "document")); } catch (e) {}

    for (var i = 0; i < pages.length; i++) {
      var p = pages[i];
      var src = srcOf(p);
      if (!src || !src.lib) throw new Error("A page comes from a source that cannot be written. Unlock the PDF, then reopen it.");
      var libPage = src.lib.getPages()[p.index];
      if (!libPage) throw new Error("Page " + (p.index + 1) + " could not be found in " + src.name + ".");
      var baseRotation = ((libPage.getRotation().angle % 360) + 360) % 360;
      var rotation = ((baseRotation + (p.rotate || 0)) % 360 + 360) % 360;

      var copied;
      try { copied = await out.copyPages(src.lib, [p.index]); }
      catch (e) { throw new Error("Page " + (p.index + 1) + " of " + src.name + " could not be copied into the export."); }
      var pg = copied[0];
      out.addPage(pg);
      try { pg.setRotation(PDFLib.degrees(rotation)); } catch (e) {}

      if (p.annos && p.annos.length) {
        var crop = pg.getCropBox();
        var W = crop.width || pg.getWidth();
        var H = crop.height || pg.getHeight();
        var overlay = await makeOverlay(p, W, H, rotation, 2);
        var png = await out.embedPng(overlay);
        pg.drawImage(png, { x: crop.x, y: crop.y, width: W, height: H });
      }
      if (opts.onProgress) opts.onProgress((i + 1) / pages.length);
      await MTH.sleep(0);
    }
    out.setModificationDate(new Date());
    var bytes = await out.save({ useObjectStreams: true, addDefaultPage: false });
    return { bytes: bytes, name: opts.name || (MTH.baseName(state.docName) + "-edited.pdf") };
  }

  async function buildFlattened(pages, opts) {
    var dpi = MTH.clamp(opts.dpi || 150, 72, 400);
    var quality = MTH.clamp(opts.quality == null ? .9 : opts.quality, .4, .98);
    var scale = dpi / 72;
    var out = await PDFLib.PDFDocument.create();
    out.setProducer("MULTI TOOL HUB");
    out.setCreator("MULTI TOOL HUB — flattened browser export");
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i];
      var src = srcOf(p);
      if (!src) throw new Error("A page source is missing.");
      var page = await src.pdfjs.getPage(p.index + 1);
      var rotation = (((page.rotate || 0) + (p.rotate || 0)) % 360 + 360) % 360;
      var rendered = await MTH.pdf.renderToCanvas(page, scale, rotation, { pixelRatio: 1, maxPixels: 30000000 });
      var canvas = rendered.canvas;
      var info = rendered.info;
      var ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("The browser could not create a canvas context for page " + (i + 1) + ".");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      (p.annos || []).forEach(function (a) { paintAnno(ctx, a, info.width, info.height, scale, false); });
      var enc = await MTH.images.encode(canvas, "image/jpeg", quality);
      var image = await out.embedJpg(enc.bytes);
      var pw = info.width / scale, ph = info.height / scale;
      var pg = out.addPage([pw, ph]);
      pg.drawImage(image, { x: 0, y: 0, width: pw, height: ph });
      canvas.width = 1; canvas.height = 1;
      if (opts.onProgress) opts.onProgress((i + 1) / pages.length);
      await MTH.sleep(0);
    }
    var bytes = await out.save({ useObjectStreams: true, addDefaultPage: false });
    return { bytes: bytes, name: opts.name || (MTH.baseName(state.docName) + "-flattened.pdf") };
  }

  function openReadOnlyNotice() {
    var m = MTH.modal({
      title: "This document is view-only",
      size: "sm",
      body: '<p style="font-size:.86rem;color:var(--muted);line-height:1.65">Saving an edited copy needs a PDF that can be rewritten. This file is encrypted or uses a structure the writer cannot open.</p><div class="notice notice--warn" style="margin-top:12px"><strong>Use the password you already know.</strong> Open <a href="' + MTH.esc(MTH.sitePath("tools/unlock.html")) + '">Unlock PDF</a>, remove the protection, then reopen the unlocked copy here. MULTI TOOL HUB never guesses or cracks passwords.</div>',
      actions: '<button class="btn btn--sm btn--ghost" data-ro-close>Close</button><a class="btn btn--sm" href="' + MTH.esc(MTH.sitePath("tools/unlock.html")) + '">Open Unlock PDF</a>'
    });
    m.actions.querySelector("[data-ro-close]").addEventListener("click", function () { m.close(); });
  }

  function openExport() {
    if (!state.pages.length) return;
    if (state.readOnly) { openReadOnlyNotice(); return; }
    var count = state.pages.length;
    var m = MTH.modal({
      title: "Export the edited PDF",
      subtitle: "Choose how much of the document to save and how the pages should be built.",
      size: "md",
      body: '<div class="export-grid">' +
        '<div class="field"><label for="export-mode">Page construction</label><select class="input" id="export-mode" data-export-mode>' +
          '<option value="vector">Original pages + annotation overlay (recommended)</option>' +
          '<option value="flatten">Flatten every page to an image</option></select>' +
          '<div class="hint" data-export-mode-hint>Keeps the original text and vectors. Annotations are burned into a transparent overlay on top.</div></div>' +
        '<div class="field" data-flatten-opts hidden><div class="settings-grid"><div class="field"><label for="export-dpi">Resolution</label><select class="input" id="export-dpi" data-export-dpi><option value="120">120 DPI · smaller</option><option value="150" selected>150 DPI · balanced</option><option value="200">200 DPI · sharp</option><option value="300">300 DPI · print</option></select></div>' +
        '<div class="field"><label for="export-quality">JPEG quality <span data-quality-val>90%</span></label><input id="export-quality" type="range" min="55" max="98" value="90" data-export-quality></div></div><div class="hint">Flattening rasterises text, so it can no longer be selected. Use it for guaranteed visual fidelity with unusual fonts.</div></div>' +
        '<div class="field"><label for="export-scope">Pages to export</label><select class="input" id="export-scope" data-export-scope><option value="all">All ' + count + ' pages</option><option value="current">Current page (' + (state.active + 1) + ')</option><option value="range">A page range</option></select>' +
        '<input class="input" data-export-range placeholder="For example 1-3, 6, 8-10" style="margin-top:8px" hidden></div>' +
        '<div class="notice"><strong>What is included?</strong> Page order, rotations and every visible annotation are included. The source files on disk are never modified.</div>' +
        '<div class="status" data-export-status></div></div>',
      actions: '<button class="btn btn--sm btn--ghost" data-export-cancel>Cancel</button><button class="btn btn--sm" data-export-go>Export PDF</button>'
    });
    var mode = m.body.querySelector("[data-export-mode]");
    var flatten = m.body.querySelector("[data-flatten-opts]");
    var scope = m.body.querySelector("[data-export-scope]");
    var range = m.body.querySelector("[data-export-range]");
    var status = m.body.querySelector("[data-export-status]");
    var go = m.actions.querySelector("[data-export-go]");
    var dpi = m.body.querySelector("[data-export-dpi]");
    var quality = m.body.querySelector("[data-export-quality]");
    var qval = m.body.querySelector("[data-quality-val]");
    mode.addEventListener("change", function () {
      flatten.hidden = mode.value !== "flatten";
      m.body.querySelector("[data-export-mode-hint]").textContent = mode.value === "flatten"
        ? "Every page becomes a JPEG image inside a fresh PDF. Text and vectors are flattened."
        : "Keeps the original text and vectors. Annotations are burned into a transparent overlay on top.";
    });
    scope.addEventListener("change", function () { range.hidden = scope.value !== "range"; if (scope.value === "range") range.focus(); });
    quality.addEventListener("input", function () { qval.textContent = quality.value + "%"; });
    m.actions.querySelector("[data-export-cancel]").addEventListener("click", function () { m.close(); });
    go.addEventListener("click", async function () {
      var indices;
      try {
        if (scope.value === "all") indices = state.pages.map(function (_, i) { return i; });
        else if (scope.value === "current") indices = [state.active];
        else {
          indices = MTH.ranges(range.value, count);
          if (!indices.length) throw new Error("Enter at least one page or range.");
        }
      } catch (e) { MTH.status(status, e.message || "Choose a valid page range.", "err"); return; }
      var subset = indices.map(function (i) { return state.pages[i]; });
      var allPages = indices.length === state.pages.length;
      MTH.busy(go, true);
      MTH.status(status, "Preparing " + subset.length + " page" + (subset.length === 1 ? "" : "s") + "…");
      try {
        var flattenMode = mode.value === "flatten";
        var name = MTH.baseName(state.docName) + (flattenMode ? "-flattened.pdf" : "-edited.pdf");
        var result = await buildPdf(subset, {
          flatten: flattenMode,
          dpi: Number(dpi.value),
          quality: Number(quality.value) / 100,
          name: name,
          onProgress: function (v) { MTH.status(status, "Page " + Math.ceil(v * subset.length) + " of " + subset.length + "…"); }
        });
        MTH.download(result.bytes, name, "application/pdf");
        MTH.status(status, "Saved " + name + " · " + MTH.fmtBytes(result.bytes.byteLength), "ok");
        if (allPages) state.dirty = false;
        MTH.toast("PDF exported", "ok");
        setTimeout(function () { m.close(); }, 800);
      } catch (e) {
        MTH.busy(go, false);
        MTH.status(status, MTH.friendlyError(e), "err");
        MTH.reportError(e, "viewer-export");
      }
    });
  }

  /* ---------- lifecycle ---------- */
  function init() {
    if (!document.getElementById("tool")) return;
    shell();
    window.addEventListener("beforeunload", function (e) {
      if (!state.dirty) return;
      e.preventDefault();
      e.returnValue = "";
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
