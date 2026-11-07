/* Image Converter */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var state = { items: [], busy: false };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: "image/*", multiple: true, icon: "convert", title: "Drop images to convert", hint: "JPG, PNG, WebP, GIF or BMP. Choose one output format for the whole batch.", meta: ["Format", "Resize", "Metadata-free"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2>Images in this batch</h2><p>Converted files appear below. Order does not matter here.</p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-add>Add images</button><button class="btn btn--sm btn--subtle" data-clear>Clear</button></div></div>' +
      '<div class="panel-body panel-body--flush"><div class="img-list" data-list></div></div>' +
      '<div class="settings">' +
      '<div class="settings-section">' +
      '<h3>Output</h3>' +
      '<div class="settings-grid settings-grid--3">' +
      '<div class="field"><label for="iv-format">Convert to</label><select class="select" id="iv-format" data-format><option value="image/jpeg">JPG</option><option value="image/png" selected>PNG</option><option value="image/webp">WebP</option></select></div>' +
      '<div class="field"><label for="iv-quality">Quality <span class="range-val" data-quality-val>92%</span></label><input id="iv-quality" data-quality type="range" min="40" max="100" value="92"><div class="hint">No effect on PNG.</div></div>' +
      '<div class="field"><label for="iv-bg">Background for JPG</label><input class="input" id="iv-bg" data-bg type="color" value="#ffffff"></div>' +
      "</div>" +
      "</div>" +
      '<div class="settings-section">' +
      '<h3>Resize while converting</h3>' +
      '<div class="settings-grid">' +
      '<div class="field"><label for="iv-resize">Resize mode</label><select class="select" id="iv-resize" data-resize><option value="none" selected>Keep original dimensions</option><option value="max">Fit within a maximum</option><option value="percent">Scale by percentage</option><option value="exact">Exact size with padding</option></select></div>' +
      '<div class="field" data-resize-panel="percent" hidden><label for="iv-percent">Scale <span class="range-val" data-percent-val>75%</span></label><input id="iv-percent" data-percent type="range" min="10" max="100" value="75"></div>' +
      "</div>" +
      '<div class="settings-grid" data-resize-panel="max" hidden><div class="field"><label for="iv-maxw">Maximum width</label><input class="input" id="iv-maxw" data-maxw type="number" min="16" max="12000" value="1920"></div><div class="field"><label for="iv-maxh">Maximum height</label><input class="input" id="iv-maxh" data-maxh type="number" min="16" max="12000" value="1920"></div></div>' +
      '<div class="settings-grid" data-resize-panel="exact" hidden><div class="field"><label for="iv-w">Width (px)</label><input class="input" id="iv-w" data-w type="number" min="16" max="12000" value="1200"></div><div class="field"><label for="iv-h">Height (px)</label><input class="input" id="iv-h" data-h type="number" min="16" max="12000" value="1200"></div></div>' +
      '<div class="notice">' + MTH.ui.icon("shield") + " Conversion redraws each image through Canvas, which removes EXIF, GPS and other embedded metadata as a side effect. Animated GIFs become a single still frame.</div>" +
      "</div>" +
      "</div>" +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-run>' + MTH.ui.icon("convert") + "Convert images</button><span class=\"grow\"></span><span class=\"action-note\">Nothing is sent to a server.</span></div>" +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("iv-prog", "Ready") + MTH.ui.status("iv-status") + "</div>" +
      '<div class="panel-body" data-results-wrap hidden style="border-top:1px solid var(--line)">' +
      '<div class="settings-title"><h3>Converted files <span class="tag" data-result-count>0</span></h3><button class="btn btn--sm btn--ghost" data-zip>' + MTH.ui.icon("download") + "Download all as ZIP</button></div>" +
      '<div class="result-grid" data-results style="margin-top:12px"></div>' +
      "</div>" +
      "</section>" +
      '<div data-result></div>'
    );

    MTH.tool.bindDrop(stage(), { accept: "image/*", multiple: true, onFiles: add });
    stage().querySelector("[data-add]").addEventListener("click", async function () {
      var files = await MTH.pick("image/*", true);
      if (files.length) add(files);
    });
    stage().querySelector("[data-clear]").addEventListener("click", clearAll);
    stage().querySelector("[data-list]").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var row = btn.closest("[data-index]");
      if (!row) return;
      removeAt(+row.dataset.index);
      render();
    });
    stage().querySelector("[data-resize]").addEventListener("change", function (e) {
      MTH.$$("[data-resize-panel]", stage()).forEach(function (p) { p.hidden = p.dataset.resizePanel !== e.target.value; });
    });
    stage().querySelector("[data-quality]").addEventListener("input", function (e) {
      stage().querySelector("[data-quality-val]").textContent = e.target.value + "%";
    });
    stage().querySelector("[data-percent]").addEventListener("input", function (e) {
      stage().querySelector("[data-percent-val]").textContent = e.target.value + "%";
    });
    stage().querySelector("[data-run]").addEventListener("click", run);
    stage().querySelector("[data-zip]").addEventListener("click", zipAll);
    stage().querySelector("[data-results]").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-dl]");
      if (!btn) return;
      var r = state.items[+btn.dataset.dl];
      if (r && r.result) MTH.download(r.result.blob, r.result.name, r.result.blob.type);
    });
  }

  async function add(files) {
    if (!files || !files.length) return;
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var item = { file: file, url: URL.createObjectURL(file), w: 0, h: 0, error: null, result: null };
      try {
        var im = await MTH.images.load(file);
        item.w = im.width; item.h = im.height;
        im.close();
      } catch (e) { item.error = MTH.friendlyError(e); }
      state.items.push(item);
    }
    stage().querySelector("[data-workspace]").hidden = false;
    stage().querySelector("[data-result]").innerHTML = "";
    render();
  }

  function removeAt(i) {
    var item = state.items[i];
    if (!item) return;
    if (item.url) URL.revokeObjectURL(item.url);
    if (item.result && item.result.url) URL.revokeObjectURL(item.result.url);
    state.items.splice(i, 1);
  }
  function clearAll() {
    state.items.forEach(function (it) {
      if (it.url) URL.revokeObjectURL(it.url);
      if (it.result && it.result.url) URL.revokeObjectURL(it.result.url);
    });
    state.items = [];
    stage().querySelector("[data-results-wrap]").hidden = true;
    render();
  }

  function render() {
    var ws = stage().querySelector("[data-workspace]");
    var list = stage().querySelector("[data-list]");
    if (!state.items.length) { ws.hidden = true; return; }
    ws.hidden = false;
    list.innerHTML = state.items.map(function (it, i) {
      var meta;
      if (it.error) meta = it.error;
      else if (it.result) meta = it.w + "×" + it.h + " → " + it.result.w + "×" + it.result.h + " · " + MTH.fmtBytes(it.result.blob.size);
      else meta = it.w ? it.w + " × " + it.h + " px · " + MTH.fmtBytes(it.file.size) : "Reading…";
      return '<div class="img-row" data-index="' + i + '">' +
        '<span class="img-thumb"><img src="' + (it.result && it.result.url ? it.result.url : it.url) + '" alt="" loading="lazy"></span>' +
        '<span class="img-main"><span class="file-name" title="' + MTH.esc(it.file.name) + '">' + MTH.esc(it.file.name) + '</span><span class="file-meta">' + MTH.esc(meta) + "</span></span>" +
        '<span class="file-actions"><button type="button" data-act="remove" aria-label="Remove">' + MTH.ui.icon("trash") + "</button></span></div>";
    }).join("");
    var totalIn = state.items.reduce(function (a, it) { return a + it.file.size; }, 0);
    var done = state.items.filter(function (it) { return it.result; });
    stage().querySelector("[data-stats]").innerHTML =
      MTH.ui.stat("Images", state.items.length) +
      MTH.ui.stat("Input", MTH.fmtBytes(totalIn)) +
      MTH.ui.stat("Converted", done.length || "—");
    stage().querySelector("[data-run]").disabled = !state.items.some(function (i) { return !i.error; }) || state.busy;
  }

  function exactCanvas(im, w, h, bg) {
    var canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    var scale = Math.min(w / im.width, h / im.height);
    var dw = im.width * scale, dh = im.height * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(im.source, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return canvas;
  }

  async function run() {
    if (state.busy) return;
    var valid = state.items.filter(function (it) { return !it.error; });
    if (!valid.length) return;
    var type = stage().querySelector("[data-format]").value;
    var quality = +stage().querySelector("[data-quality]").value / 100;
    var bg = stage().querySelector("[data-bg]").value;
    var resize = stage().querySelector("[data-resize]").value;
    var percent = +stage().querySelector("[data-percent]").value / 100;
    var maxW = +stage().querySelector("[data-maxw]").value || 1920;
    var maxH = +stage().querySelector("[data-maxh]").value || 1920;
    var exactW = +stage().querySelector("[data-w]").value || 1200;
    var exactH = +stage().querySelector("[data-h]").value || 1200;
    var ext = type === "image/png" ? ".png" : type === "image/webp" ? ".webp" : ".jpg";
    var btn = stage().querySelector("[data-run]");

    state.busy = true;
    MTH.busy(btn, true); btn.dataset.busyText = "Converting…";
    MTH.progress("iv-prog", 0, "Converting 1 of " + valid.length);
    MTH.status("iv-status", "Redrawing images through Canvas…");
    try {
      for (var i = 0; i < valid.length; i++) {
        var item = valid[i];
        if (item.result && item.result.url) URL.revokeObjectURL(item.result.url);
        MTH.status("iv-status", "Converting " + item.file.name + "…");
        var im = await MTH.images.load(item.file);
        var canvas;
        var background = type === "image/jpeg" ? bg : false;
        if (resize === "percent") canvas = MTH.images.canvas(im.source, { scale: percent, background: background });
        else if (resize === "max") canvas = MTH.images.canvas(im.source, { maxW: maxW, maxH: maxH, background: background });
        else if (resize === "exact") canvas = exactCanvas(im, Math.max(16, Math.round(exactW)), Math.max(16, Math.round(exactH)), bg);
        else canvas = MTH.images.canvas(im.source, { background: background });
        var enc = await MTH.images.encode(canvas, type, quality);
        item.result = {
          blob: enc.blob, type: enc.type, w: canvas.width, h: canvas.height,
          url: URL.createObjectURL(enc.blob),
          name: MTH.baseName(item.file.name) + "-converted" + ext
        };
        im.close();
        canvas.width = canvas.height = 0;
        MTH.progress("iv-prog", (i + 1) / valid.length, "Converted " + (i + 1) + " of " + valid.length);
        await MTH.sleep(0);
      }
      render();
      renderResults();
      var totalOut = valid.reduce(function (a, it) { return a + it.result.blob.size; }, 0);
      MTH.progress("iv-prog", 1, "Complete");
      MTH.status("iv-status", "Converted " + valid.length + " image" + (valid.length === 1 ? "" : "s") + " to " + ext.slice(1).toUpperCase() + " · " + MTH.fmtBytes(totalOut) + ".", "ok");
      MTH.toast("Images converted", "ok");
    } catch (e) {
      MTH.progress("iv-prog", null);
      MTH.status("iv-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "image-convert");
    } finally {
      state.busy = false; MTH.busy(btn, false); render();
    }
  }

  function renderResults() {
    var wrap = stage().querySelector("[data-results-wrap]");
    wrap.hidden = false;
    var done = state.items.filter(function (it) { return it.result; });
    stage().querySelector("[data-result-count]").textContent = done.length + " file" + (done.length === 1 ? "" : "s");
    stage().querySelector("[data-results]").innerHTML = done.map(function (it) {
      var idx = state.items.indexOf(it);
      return '<article class="result-card"><div class="result-thumb"><img src="' + it.result.url + '" alt="" loading="lazy"></div>' +
        '<div class="rc-name" title="' + MTH.esc(it.result.name) + '">' + MTH.esc(it.result.name) + "</div>" +
        '<div class="rc-meta"><span>' + it.result.w + "×" + it.result.h + "</span><span>" + MTH.fmtBytes(it.result.blob.size) + "</span></div>" +
        '<div class="rc-actions"><button class="btn btn--sm btn--ghost" data-dl="' + idx + '">' + MTH.ui.icon("download") + "Save</button></div></article>";
    }).join("");
  }

  async function zipAll() {
    var done = state.items.filter(function (it) { return it.result; });
    if (!done.length) return;
    var btn = stage().querySelector("[data-zip]");
    MTH.busy(btn, true); btn.dataset.busyText = "Packing…";
    try {
      var entries = [];
      for (var i = 0; i < done.length; i++) {
        var it = done[i];
        entries.push({ name: it.result.name, data: new Uint8Array(await it.result.blob.arrayBuffer()) });
      }
      await MTH.zip(entries, "converted-images.zip", function (p) { MTH.progress("iv-prog", p, "Packing ZIP… " + Math.round(p * 100) + "%"); });
      MTH.progress("iv-prog", 1, "ZIP downloaded");
      MTH.status("iv-status", "ZIP archive downloaded with " + entries.length + " images.", "ok");
    } catch (e) {
      MTH.status("iv-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "image-convert-zip");
    } finally {
      MTH.busy(btn, false);
    }
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
