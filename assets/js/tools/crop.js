/* PDF Crop */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;
  var state = { file: null, pdf: null, count: 0, page: 1, rect: { x: 0, y: 0, w: 1, h: 1 }, target: "all", busy: false, output: null, drag: null };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: ".pdf,application/pdf", icon: "crop", title: "Drop a PDF to crop", hint: "Drag the brass box, use the handles, or auto-trim the margins.", meta: ["PDF", "8 handles", "Multi-page"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2 data-file-name>Document</h2><p data-file-meta></p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-change>Choose another</button></div></div>' +
      '<div class="settings">' +
      '<div class="settings-section"><div class="row" style="justify-content:space-between"><h3 class="settings-title" style="margin:0">Crop preview</h3>' +
      '<div class="row"><button class="icon-btn icon-btn--sm" data-prev aria-label="Previous page">' + MTH.ui.icon("left") + "</button>" +
      '<span class="tag" data-page-label>Page 1 of 1</span>' +
      '<button class="icon-btn icon-btn--sm" data-next aria-label="Next page">' + MTH.ui.icon("right") + "</button></div></div>" +
      '<div class="preview-frame" data-frame><div class="crop-stage" data-crop-stage hidden><canvas data-canvas></canvas><div class="crop-overlay" data-overlay>' +
      '<div class="crop-shade" data-shade="top"></div><div class="crop-shade" data-shade="bottom"></div><div class="crop-shade" data-shade="left"></div><div class="crop-shade" data-shade="right"></div>' +
      '<div class="crop-box" data-box>' +
      '<span class="crop-handle" data-h="nw"></span><span class="crop-handle" data-h="n"></span><span class="crop-handle" data-h="ne"></span><span class="crop-handle" data-h="e"></span><span class="crop-handle" data-h="se"></span><span class="crop-handle" data-h="s"></span><span class="crop-handle" data-h="sw"></span><span class="crop-handle" data-h="w"></span>' +
      "</div><div class=\"crop-readout\" data-readout></div></div></div>" +
      '<div class="tiny muted" data-crop-note style="margin-top:8px;text-align:center">Drag inside the box to move it. Drag a handle to resize. Drag outside to draw a new box.</div></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn btn--sm btn--ghost" data-autotrim>' + MTH.ui.icon("wand") + ' Auto-trim margins</button><button class="btn btn--sm btn--subtle" data-reset>Full page</button></div>' +
      "</div>" +
      '<div class="settings-section"><h3>Apply to</h3><div class="seg" data-targets><button type="button" class="on" data-target="all">Every page</button><button type="button" data-target="current">This page</button><button type="button" data-target="range">Page range</button></div>' +
      '<div class="field" data-range-wrap style="margin-top:12px" hidden><label for="crop-range">Pages</label><input class="input" id="crop-range" data-range placeholder="For example 1-3, 5"><div class="hint">The same proportional crop is applied to each selected page, whatever its size.</div></div>' +
      '<div class="notice" style="margin-top:12px"><strong>What is cropped?</strong> The page’s visible box is reduced to your selection and the file is saved with the new page size. Content outside the box is no longer shown.</div>' +
      "</div>" +
      "</div>" +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-run>Crop PDF</button><span class="grow"></span><span class="action-note">The original document is unchanged.</span></div>' +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("crop-prog", "Ready") + MTH.ui.status("crop-status") + "</div>" +
      "</section>" +
      '<div data-result></div>'
    );
    MTH.tool.bindDrop(stage(), { accept: ".pdf,application/pdf", onFiles: function (files) { load(files[0]); } });
    stage().querySelector("[data-change]").addEventListener("click", async function () {
      var files = await MTH.pick(".pdf,application/pdf", false);
      if (files.length) load(files[0]);
    });
    stage().querySelector("[data-prev]").addEventListener("click", function () { go(-1); });
    stage().querySelector("[data-next]").addEventListener("click", function () { go(1); });
    stage().querySelector("[data-autotrim]").addEventListener("click", autoTrim);
    stage().querySelector("[data-reset]").addEventListener("click", function () {
      state.rect = { x: 0, y: 0, w: 1, h: 1 };
      paintCrop();
      MTH.status("crop-status", "Crop box reset to the full page.", "info");
    });
    stage().querySelector("[data-targets]").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-target]");
      if (!btn) return;
      state.target = btn.dataset.target;
      MTH.$$("[data-target]", stage()).forEach(function (b) { b.classList.toggle("on", b === btn); });
      stage().querySelector("[data-range-wrap]").hidden = state.target !== "range";
      updateStats();
    });
    bindCrop();
    stage().querySelector("[data-run]").addEventListener("click", run);
  }

  async function load(file) {
    if (!file) return;
    resetOutput();
    state.file = file;
    state.page = 1;
    state.rect = { x: 0, y: 0, w: 1, h: 1 };
    if (state.pdf) { MTH.pdf.destroy(state.pdf); state.pdf = null; }
    var ws = stage().querySelector("[data-workspace]");
    ws.hidden = false;
    stage().querySelector("[data-file-name]").textContent = file.name;
    stage().querySelector("[data-file-meta]").textContent = MTH.fmtBytes(file.size);
    MTH.status("crop-status", "Opening " + file.name + "…");
    try {
      var pdf = await MTH.pdf.load(file);
      state.pdf = pdf;
      state.count = pdf.numPages;
      state.page = 1;
      stage().querySelector("[data-crop-stage]").hidden = false;
      await renderPage();
      MTH.status("crop-status", state.count + " pages ready. Position the crop box, then choose where to apply it.", "ok");
    } catch (e) {
      stage().querySelector("[data-crop-stage]").hidden = true;
      if (e.needsPassword) {
        MTH.status("crop-status", "", "");
        stage().querySelector("[data-frame]").innerHTML = '<div class="notice notice--warn" style="max-width:640px">' + MTH.ui.icon("lock") + " <strong>This PDF is password-protected.</strong> Cropping saves a new file, so make an unencrypted copy first with <a href=\"" + MTH.esc(MTH.sitePath("tools/unlock.html")) + "\">Unlock PDF</a> using the password you know.</div>";
      } else {
        MTH.status("crop-status", MTH.friendlyError(e), "err");
        MTH.reportError(e, "crop-load");
      }
    }
  }

  function go(delta) {
    var next = MTH.clamp(state.page + delta, 1, state.count || 1);
    if (next === state.page) return;
    state.page = next;
    renderPage();
  }

  async function renderPage() {
    if (!state.pdf) return;
    var frame = stage().querySelector("[data-frame]");
    var canvas = stage().querySelector("[data-canvas]");
    var pageLabel = stage().querySelector("[data-page-label]");
    if (pageLabel) pageLabel.textContent = "Page " + state.page + " of " + state.count;
    try {
      var page = await state.pdf.getPage(state.page);
      var base = page.getViewport({ scale: 1 });
      var maxW = Math.max(240, (frame.clientWidth || 760) - 36);
      var scale = Math.min(maxW / base.width, 780 / base.height, 2.4);
      await MTH.pdf.render(page, canvas, { scale: scale, rotation: page.rotate, pixelRatio: Math.min(2, window.devicePixelRatio || 1) });
      stage().querySelector("[data-crop-stage]").hidden = false;
      paintCrop();
      stage().querySelector("[data-prev]").disabled = state.page <= 1;
      stage().querySelector("[data-next]").disabled = state.page >= state.count;
      updateStats();
    } catch (e) {
      MTH.status("crop-status", MTH.friendlyError(e), "err");
    }
  }

  function bindCrop() {
    var overlay = stage().querySelector("[data-overlay]");
    function point(e) {
      var r = overlay.getBoundingClientRect();
      return { x: MTH.clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1), y: MTH.clamp((e.clientY - r.top) / Math.max(1, r.height), 0, 1) };
    }
    overlay.addEventListener("pointerdown", function (e) {
      if (!state.pdf) return;
      var handle = e.target.closest("[data-h]");
      var box = e.target.closest("[data-box]");
      var p = point(e);
      if (handle) {
        state.drag = { type: "resize", h: handle.dataset.h, start: p, orig: MTH.clone(state.rect) };
      } else if (box) {
        state.drag = { type: "move", start: p, orig: MTH.clone(state.rect) };
      } else {
        state.drag = { type: "create", start: p };
        state.rect = { x: p.x, y: p.y, w: .001, h: .001 };
        paintCrop();
      }
      try { overlay.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    overlay.addEventListener("pointermove", function (e) {
      if (!state.drag) return;
      var p = point(e), d = state.drag;
      if (d.type === "move") {
        state.rect.x = MTH.clamp(d.orig.x + (p.x - d.start.x), 0, 1 - d.orig.w);
        state.rect.y = MTH.clamp(d.orig.y + (p.y - d.start.y), 0, 1 - d.orig.h);
      } else if (d.type === "create") {
        var x1 = Math.min(d.start.x, p.x), y1 = Math.min(d.start.y, p.y);
        var x2 = Math.max(d.start.x, p.x), y2 = Math.max(d.start.y, p.y);
        state.rect = { x: x1, y: y1, w: Math.max(.001, x2 - x1), h: Math.max(.001, y2 - y1) };
      } else {
        var o = d.orig;
        var left = o.x, top = o.y, right = o.x + o.w, bottom = o.y + o.h;
        if (d.h.indexOf("w") !== -1) left = MTH.clamp(p.x, 0, right - .02);
        if (d.h.indexOf("e") !== -1) right = MTH.clamp(p.x, left + .02, 1);
        if (d.h.indexOf("n") !== -1) top = MTH.clamp(p.y, 0, bottom - .02);
        if (d.h.indexOf("s") !== -1) bottom = MTH.clamp(p.y, top + .02, 1);
        state.rect = { x: left, y: top, w: right - left, h: bottom - top };
      }
      paintCrop();
      e.preventDefault();
    });
    function end(e) {
      if (!state.drag) return;
      if (state.rect.w < .02 || state.rect.h < .02) {
        state.rect = { x: .05, y: .05, w: .9, h: .9 };
      }
      state.drag = null;
      paintCrop();
      try { overlay.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    overlay.addEventListener("pointerup", end);
    overlay.addEventListener("pointercancel", end);
  }

  function paintCrop() {
    var box = stage().querySelector("[data-box]");
    if (!box) return;
    var r = state.rect;
    box.style.left = (r.x * 100) + "%";
    box.style.top = (r.y * 100) + "%";
    box.style.width = (r.w * 100) + "%";
    box.style.height = (r.h * 100) + "%";
    var top = stage().querySelector('[data-shade="top"]');
    var bottom = stage().querySelector('[data-shade="bottom"]');
    var left = stage().querySelector('[data-shade="left"]');
    var right = stage().querySelector('[data-shade="right"]');
    if (top) { top.style.left = "0"; top.style.top = "0"; top.style.width = "100%"; top.style.height = (r.y * 100) + "%"; }
    if (bottom) { bottom.style.left = "0"; bottom.style.top = ((r.y + r.h) * 100) + "%"; bottom.style.width = "100%"; bottom.style.height = ((1 - r.y - r.h) * 100) + "%"; }
    if (left) { left.style.left = "0"; left.style.top = (r.y * 100) + "%"; left.style.width = (r.x * 100) + "%"; left.style.height = (r.h * 100) + "%"; }
    if (right) { right.style.left = ((r.x + r.w) * 100) + "%"; right.style.top = (r.y * 100) + "%"; right.style.width = ((1 - r.x - r.w) * 100) + "%"; right.style.height = (r.h * 100) + "%"; }
    var readout = stage().querySelector("[data-readout]");
    if (readout) {
      var canvas = stage().querySelector("[data-canvas]");
      var pxW = Math.round(r.w * (canvas.width || 0));
      var pxH = Math.round(r.h * (canvas.height || 0));
      readout.textContent = pxW + " × " + pxH + " px · " + Math.round(r.w * 100) + "% × " + Math.round(r.h * 100) + "%";
    }
    updateStats();
  }

  async function autoTrim() {
    if (!state.pdf || !state.count) return;
    var btn = stage().querySelector("[data-autotrim]");
    MTH.busy(btn, true);
    btn.dataset.busyText = "Checking…";
    MTH.status("crop-status", "Scanning page " + state.page + " for content margins…");
    try {
      var page = await state.pdf.getPage(state.page);
      var base = page.getViewport({ scale: 1 });
      var scale = Math.min(2, 1400 / Math.max(base.width, base.height));
      var vp = page.getViewport({ scale: scale });
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(vp.width));
      canvas.height = Math.max(1, Math.round(vp.height));
      var ctx = canvas.getContext("2d", { alpha: false });
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp, background: "#ffffff" }).promise;
      var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      var minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0, found = false;
      for (var y = 0; y < canvas.height; y += 2) {
        for (var x = 0; x < canvas.width; x += 2) {
          var i = (y * canvas.width + x) * 4;
          if (data[i] < 244 || data[i + 1] < 244 || data[i + 2] < 244) {
            found = true;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (!found) {
        MTH.status("crop-status", "This page appears to be blank, so there are no margins to detect. Adjust the box by hand.", "warn");
        return;
      }
      var pad = 8;
      minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
      maxX = Math.min(canvas.width, maxX + pad); maxY = Math.min(canvas.height, maxY + pad);
      state.rect = {
        x: minX / canvas.width,
        y: minY / canvas.height,
        w: Math.max(.02, (maxX - minX) / canvas.width),
        h: Math.max(.02, (maxY - minY) / canvas.height)
      };
      paintCrop();
      MTH.status("crop-status", "Margins trimmed. Fine-tune with the handles if needed.", "ok");
      canvas.width = 0; canvas.height = 0;
    } catch (e) {
      MTH.status("crop-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "crop-trim");
    } finally {
      MTH.busy(btn, false);
    }
  }

  function targetPages() {
    if (state.target === "current") return [state.page];
    if (state.target === "all") { var all = []; for (var i = 1; i <= state.count; i++) all.push(i); return all; }
    try { return MTH.ranges(stage().querySelector("[data-range]").value, state.count).map(function (i) { return i + 1; }); }
    catch (e) { MTH.status("crop-status", e.message, "err"); return null; }
  }

  function updateStats() {
    var stats = stage() && stage().querySelector("[data-stats]");
    if (!stats) return;
    var pages = state.target === "current" ? 1 : state.target === "all" ? state.count : 0;
    stats.innerHTML = MTH.ui.stat("Pages", state.count || "—") + MTH.ui.stat("Apply to", state.target === "all" ? "All pages" : state.target === "current" ? "This page" : "Range") + MTH.ui.stat("Crop width", Math.round(state.rect.w * 100) + "%") + MTH.ui.stat("Crop height", Math.round(state.rect.h * 100) + "%") + MTH.ui.stat("Input size", state.file ? MTH.fmtBytes(state.file.size) : "—");
    var run = stage().querySelector("[data-run]");
    if (run) run.disabled = state.busy || !state.file;
  }

  function resetOutput() {
    state.output = null;
    var host = stage() && stage().querySelector("[data-result]");
    if (host) host.innerHTML = "";
  }

  async function run() {
    if (state.busy || !state.file) return;
    var pages = targetPages();
    if (!pages || !pages.length) return;
    var btn = stage().querySelector("[data-run]");
    state.busy = true;
    btn.dataset.busyText = "Cropping…";
    MTH.busy(btn, true);
    resetOutput();
    MTH.progress("crop-prog", 0, "Opening the document…");
    try {
      var src = await MTH.pdf.openLib(state.file);
      var libPages = src.getPages();
      if (!libPages.length) throw new Error("This PDF contains no pages.");
      var pdfjs = state.pdf;
      for (var i = 0; i < pages.length; i++) {
        var n = pages[i];
        var pageNumber = Math.min(n, libPages.length);
        var p = await pdfjs.getPage(pageNumber);
        var vp = p.getViewport({ scale: 1 });
        var x1 = state.rect.x * vp.width;
        var y1 = state.rect.y * vp.height;
        var x2 = (state.rect.x + state.rect.w) * vp.width;
        var y2 = (state.rect.y + state.rect.h) * vp.height;
        var a = vp.convertToPdfPoint(x1, y1);
        var b = vp.convertToPdfPoint(x2, y2);
        var x = Math.min(a[0], b[0]);
        var y = Math.min(a[1], b[1]);
        var w = Math.abs(a[0] - b[0]);
        var h = Math.abs(a[1] - b[1]);
        if (w < 4 || h < 4) throw new Error("The crop box is too small on page " + pageNumber + ". Make it larger and try again.");
        var libPage = libPages[pageNumber - 1];
        libPage.setCropBox(x, y, w, h);
        libPage.setMediaBox(x, y, w, h);
        if (i % 5 === 0) {
          MTH.progress("crop-prog", (i + 1) / pages.length, "Cropped " + (i + 1) + " of " + pages.length + " pages");
          await MTH.sleep(0);
        }
      }
      src.setProducer("MULTI TOOL HUB");
      src.setCreator("MULTI TOOL HUB · local browser crop");
      var bytes = await src.save({ useObjectStreams: true, addDefaultPage: false });
      var name = MTH.baseName(state.file.name) + "-cropped.pdf";
      var blob = new Blob([bytes], { type: "application/pdf" });
      state.output = { blob: blob, name: name };
      MTH.progress("crop-prog", 1, "Complete");
      MTH.download(blob, name, "application/pdf");
      MTH.status("crop-status", "Ready: " + name + " · " + pages.length + " page" + (pages.length === 1 ? "" : "s") + " cropped · " + MTH.fmtBytes(blob.size) + ".", "ok");
      stage().querySelector("[data-result]").innerHTML = MTH.tool.resultPanel({
        title: "Cropped PDF is ready",
        meta: pages.length + " page" + (pages.length === 1 ? "" : "s") + " cropped to " + Math.round(state.rect.w * 100) + "% × " + Math.round(state.rect.h * 100) + "% · " + MTH.fmtBytes(blob.size),
        buttons: '<button class="btn btn--sm" data-download-result>' + MTH.ui.icon("download") + "Download again</button>"
      });
      stage().querySelector("[data-download-result]").addEventListener("click", function () {
        if (state.output) MTH.download(state.output.blob, state.output.name, "application/pdf");
      });
      MTH.toast("PDF cropped", "ok");
    } catch (e) {
      MTH.progress("crop-prog", null);
      MTH.status("crop-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "crop");
    } finally {
      state.busy = false;
      MTH.busy(btn, false);
      updateStats();
    }
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
