/* Images to PDF */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var state = { items: [], busy: false };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp", multiple: true, icon: "images", title: "Drop images to build a PDF", hint: "JPG, PNG and WebP. Drag the list into the exact page order you want.", meta: ["JPG", "PNG", "WebP", "Batch"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2>Pages in this PDF</h2><p>Reorder, remove or add more images. The list order is the page order.</p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-add>Add images</button><button class="btn btn--sm btn--subtle" data-clear>Clear</button></div></div>' +
      '<div class="panel-body panel-body--flush"><div data-list class="img-list"></div></div>' +
      '<div class="settings">' +
      '<div class="settings-section">' +
      '<h3>Page layout</h3>' +
      '<div class="settings-grid settings-grid--3">' +
      '<div class="field"><label for="ip-size">Page size</label><select class="select" id="ip-size" data-size><option value="auto" selected>Match each image</option><option value="a4">A4</option><option value="letter">US Letter</option><option value="legal">US Legal</option><option value="a3">A3</option></select></div>' +
      '<div class="field"><label for="ip-orient">Orientation</label><select class="select" id="ip-orient" data-orient><option value="auto" selected>Auto</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></div>' +
      '<div class="field"><label for="ip-fit">Image fit</label><select class="select" id="ip-fit" data-fit><option value="contain" selected>Contain — no cropping</option><option value="cover">Cover — fill the page</option></select></div>' +
      "</div>" +
      '<div class="settings-grid settings-grid--3">' +
      '<div class="field"><label for="ip-margin">Margin <span class="range-val" data-margin-val>0 mm</span></label><input id="ip-margin" data-margin type="range" min="0" max="40" value="0"></div>' +
      '<div class="field"><label for="ip-quality">Image quality <span class="range-val" data-quality-val>92%</span></label><input id="ip-quality" data-quality type="range" min="55" max="100" value="92"></div>' +
      '<div class="field"><label for="ip-bg">Page background</label><input class="input" id="ip-bg" data-bg type="color" value="#ffffff"></div>' +
      "</div>" +
      '<div class="notice">' + MTH.ui.icon("info") + " With “Match each image”, the page adopts the picture\'s proportions — ideal for scanned pages and phone photos. Choose A4 or Letter for a uniform document.</div>" +
      "</div>" +
      "</div>" +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-run>' + MTH.ui.icon("images") + "Create PDF</button><span class=\"grow\"></span><span class=\"action-note\">All images stay on this device.</span></div>" +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("ip-prog", "Ready") + MTH.ui.status("ip-status") + "</div>" +
      "</section>" +
      '<div data-result></div>'
    );

    MTH.tool.bindDrop(stage(), { accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp", multiple: true, onFiles: add });
    stage().querySelector("[data-add]").addEventListener("click", async function () {
      var files = await MTH.pick("image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp", true);
      if (files.length) add(files);
    });
    stage().querySelector("[data-clear]").addEventListener("click", function () {
      state.items.forEach(function (it) { if (it.url) URL.revokeObjectURL(it.url); });
      state.items = []; render();
    });
    stage().querySelector("[data-list]").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var row = btn.closest("[data-index]");
      if (!row) return;
      var i = +row.dataset.index;
      var act = btn.dataset.act;
      if (act === "remove") {
        if (state.items[i].url) URL.revokeObjectURL(state.items[i].url);
        state.items.splice(i, 1);
      } else if (act === "up" && i > 0) {
        state.items.splice(i - 1, 0, state.items.splice(i, 1)[0]);
      } else if (act === "down" && i < state.items.length - 1) {
        state.items.splice(i + 1, 0, state.items.splice(i, 1)[0]);
      }
      render();
    });
    stage().querySelector("[data-margin]").addEventListener("input", function (e) {
      stage().querySelector("[data-margin-val]").textContent = e.target.value + " mm";
    });
    stage().querySelector("[data-quality]").addEventListener("input", function (e) {
      stage().querySelector("[data-quality-val]").textContent = e.target.value + "%";
    });
    stage().querySelector("[data-run]").addEventListener("click", run);
  }

  async function add(files) {
    if (!files || !files.length) return;
    var ws = stage().querySelector("[data-workspace]");
    var before = state.items.length;
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var item = { file: file, url: URL.createObjectURL(file), w: 0, h: 0, error: null };
      state.items.push(item);
      try {
        var im = await MTH.images.load(file);
        item.w = im.width; item.h = im.height;
        im.close();
      } catch (e) {
        item.error = MTH.friendlyError(e);
      }
    }
    ws.hidden = false;
    render();
    stage().querySelector("[data-result]").innerHTML = "";
    if (state.items.length > before) MTH.status("ip-status", state.items.length + " image" + (state.items.length === 1 ? "" : "s") + " ready.", "ok");
  }

  function render() {
    var ws = stage().querySelector("[data-workspace]");
    var list = stage().querySelector("[data-list]");
    if (!state.items.length) { ws.hidden = true; return; }
    ws.hidden = false;
    list.innerHTML = state.items.map(function (it, i) {
      var meta = it.error ? it.error : it.w ? it.w + " × " + it.h + " px · " + MTH.fmtBytes(it.file.size) : "Reading…";
      return '<div class="img-row" data-index="' + i + '" draggable="true">' +
        '<span class="img-thumb"><img src="' + it.url + '" alt="" loading="lazy"></span>' +
        '<span class="img-main"><span class="file-name" title="' + MTH.esc(it.file.name) + '">' + MTH.esc(it.file.name) + '</span><span class="file-meta">' + MTH.esc(meta) + "</span></span>" +
        '<span class="img-order">' + (i + 1 < 10 ? "0" : "") + (i + 1) + "</span>" +
        '<span class="file-actions"><button type="button" data-act="up" aria-label="Move up"' + (i === 0 ? " disabled" : "") + ">" + MTH.ui.icon("up") + "</button>" +
        '<button type="button" data-act="down" aria-label="Move down"' + (i === state.items.length - 1 ? " disabled" : "") + ">" + MTH.ui.icon("down") + "</button>" +
        '<button type="button" data-act="remove" aria-label="Remove">' + MTH.ui.icon("trash") + "</button></span></div>";
    }).join("");
    var totalBytes = state.items.reduce(function (a, it) { return a + it.file.size; }, 0);
    stage().querySelector("[data-stats]").innerHTML =
      MTH.ui.stat("Pages", state.items.length) +
      MTH.ui.stat("Images", state.items.filter(function (i) { return !i.error; }).length) +
      MTH.ui.stat("Input size", MTH.fmtBytes(totalBytes));
    stage().querySelector("[data-run]").disabled = !state.items.some(function (i) { return !i.error; }) || state.busy;
    bindDrag();
  }

  function bindDrag() {
    var host = stage().querySelector("[data-list]");
    var dragIndex = -1;
    MTH.$$(".img-row", host).forEach(function (row) {
      row.addEventListener("dragstart", function (e) {
        dragIndex = +row.dataset.index;
        row.classList.add("dragging");
        if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(dragIndex)); } catch (err) {} }
      });
      row.addEventListener("dragend", function () { row.classList.remove("dragging"); dragIndex = -1; });
      row.addEventListener("dragover", function (e) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      });
      row.addEventListener("drop", function (e) {
        e.preventDefault();
        var target = +row.dataset.index;
        if (dragIndex < 0 || target === dragIndex) return;
        var moved = state.items.splice(dragIndex, 1)[0];
        state.items.splice(target, 0, moved);
        dragIndex = -1;
        render();
        MTH.status("ip-status", "Page order updated.", "ok");
      });
    });
  }

  function pageSizeFor(item, opts) {
    var sizes = MTH.tool.pageSizes;
    if (opts.size === "auto") {
      var w = Math.max(1, item.w || 1200), h = Math.max(1, item.h || 1600);
      var cap = 842;
      var scale = Math.min(cap / Math.max(w, h), 1.6);
      var pw = w * scale, ph = h * scale;
      if (opts.orient === "portrait" && pw > ph) { var t = pw; pw = ph; ph = t; }
      if (opts.orient === "landscape" && pw < ph) { var t2 = pw; pw = ph; ph = t2; }
      return { w: pw, h: ph };
    }
    var size = sizes[opts.size] || sizes.a4;
    var portrait = size[0] <= size[1];
    var wantPortrait = opts.orient === "portrait" || (opts.orient === "auto" && portrait);
    var w2 = Math.min(size[0], size[1]), h2 = Math.max(size[0], size[1]);
    return wantPortrait ? { w: w2, h: h2 } : { w: h2, h: w2 };
  }

  async function run() {
    if (state.busy) return;
    var valid = state.items.filter(function (i) { return !i.error; });
    if (!valid.length) { MTH.status("ip-status", "Add at least one readable image.", "warn"); return; }

    var opts = {
      size: stage().querySelector("[data-size]").value,
      orient: stage().querySelector("[data-orient]").value,
      fit: stage().querySelector("[data-fit]").value,
      margin: +stage().querySelector("[data-margin]").value * 72 / 25.4,
      quality: +stage().querySelector("[data-quality]").value / 100,
      bg: stage().querySelector("[data-bg]").value
    };
    var btn = stage().querySelector("[data-run]");
    state.busy = true;
    MTH.busy(btn, true); btn.dataset.busyText = "Building PDF…";
    MTH.progress("ip-prog", 0, "Preparing pages…");
    MTH.status("ip-status", "Creating the document…");
    try {
      if (typeof PDFLib === "undefined") throw new Error("The PDF writing engine did not load. Refresh the page and try again.");
      var doc = await PDFLib.PDFDocument.create();
      doc.setProducer("MULTI TOOL HUB");
      doc.setCreator("MULTI TOOL HUB · local images to PDF");

      for (var i = 0; i < valid.length; i++) {
        var item = valid[i];
        MTH.status("ip-status", "Placing " + item.file.name + "…");
        var pageDims = pageSizeFor(item, opts);
        var margin = Math.min(opts.margin, pageDims.w / 3, pageDims.h / 3);
        var cw = Math.max(1, pageDims.w - margin * 2), ch = Math.max(1, pageDims.h - margin * 2);
        var pxPerPt = 1.8;
        var renderW = Math.max(1, Math.min(4000, Math.round(cw * pxPerPt)));
        var renderH = Math.max(1, Math.min(4000, Math.round(ch * pxPerPt)));
        var canvas = document.createElement("canvas");
        canvas.width = renderW; canvas.height = renderH;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = opts.bg || "#ffffff";
        ctx.fillRect(0, 0, renderW, renderH);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        var im = await MTH.images.load(item.file);
        var iw = im.width, ih = im.height;
        var scale = opts.fit === "cover" ? Math.max(renderW / iw, renderH / ih) : Math.min(renderW / iw, renderH / ih);
        var dw = iw * scale, dh = ih * scale;
        var dx = (renderW - dw) / 2, dy = (renderH - dh) / 2;
        ctx.drawImage(im.source, dx, dy, dw, dh);
        im.close();

        var png = /\.png$/i.test(item.file.name) && opts.fit === "contain";
        var enc = await MTH.images.encode(canvas, png ? "image/png" : "image/jpeg", opts.quality);
        var image = png ? await doc.embedPng(enc.bytes) : await doc.embedJpg(enc.bytes);
        var page = doc.addPage([pageDims.w, pageDims.h]);
        page.drawImage(image, { x: margin, y: margin, width: cw, height: ch });
        canvas.width = canvas.height = 0;
        MTH.progress("ip-prog", (i + 1) / valid.length, "Placed " + (i + 1) + " of " + valid.length + " images");
        await MTH.sleep(0);
      }

      MTH.progress("ip-prog", .95, "Writing the PDF…");
      var bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
      var name = "images-" + new Date().toISOString().slice(0, 10) + ".pdf";
      var blob = MTH.download(bytes, name, "application/pdf");
      MTH.progress("ip-prog", 1, "Complete");
      MTH.status("ip-status", "Created a " + doc.getPageCount() + "-page PDF · " + MTH.fmtBytes(blob.size) + ".", "ok");
      stage().querySelector("[data-result]").innerHTML = MTH.tool.resultPanel({
        title: "PDF is ready",
        meta: doc.getPageCount() + " pages · " + MTH.fmtBytes(blob.size) + " · " + opts.size.toUpperCase(),
        buttons: '<button class="btn btn--sm" data-download-result>' + MTH.ui.icon("download") + "Download " + MTH.esc(name) + "</button>"
      });
      stage().querySelector("[data-download-result]").addEventListener("click", function () { MTH.download(bytes, name, "application/pdf"); });
      MTH.toast("PDF created", "ok");
    } catch (e) {
      MTH.progress("ip-prog", null);
      MTH.status("ip-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "images-to-pdf");
    } finally {
      state.busy = false; MTH.busy(btn, false); render();
    }
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
