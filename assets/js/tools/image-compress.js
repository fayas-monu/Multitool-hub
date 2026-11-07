/* Image Compressor */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var state = { items: [], busy: false };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp", multiple: true, icon: "compress", title: "Drop images to compress", hint: "Batch JPG, PNG and WebP. Target a quality level or an exact file size.", meta: ["JPG", "PNG", "WebP", "Batch"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2>Images in this batch</h2><p>Add more at any time. Results appear after compression.</p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-add>Add images</button><button class="btn btn--sm btn--subtle" data-clear>Clear</button></div></div>' +
      '<div class="panel-body panel-body--flush"><div class="img-list" data-list></div></div>' +
      '<div class="settings">' +
      '<div class="settings-section">' +
      '<h3>Compression target</h3>' +
      '<div class="seg" data-modes role="group" aria-label="Compression mode"><button type="button" class="on" data-mode="quality">By quality</button><button type="button" data-mode="size">By target size</button></div>' +
      '<div data-mode-panel="quality" style="margin-top:14px"><div class="field"><label for="ic-quality">Quality <span class="range-val" data-quality-val>78%</span></label><input id="ic-quality" data-quality type="range" min="10" max="100" value="78"><div class="hint">A lower quality means a smaller file. 70–85% is usually indistinguishable for photographs.</div></div></div>' +
      '<div data-mode-panel="size" hidden style="margin-top:14px"><div class="settings-grid"><div class="field"><label for="ic-target">Target size per image</label><div class="inline" style="flex-wrap:nowrap"><input class="input" id="ic-target" data-target type="number" min="10" max="100000" value="300"><select class="select" data-target-unit style="width:110px"><option value="1024">KB</option><option value="1048576">MB</option></select></div></div><div class="field"><label>Fallback</label><label class="check" style="margin-top:8px"><input type="checkbox" data-fallback checked> Reduce dimensions when quality alone is not enough</label></div></div><div class="hint">For PNG, the engine reduces dimensions because PNG compression is lossless.</div></div>' +
      "</div>" +
      '<div class="settings-section">' +
      '<h3>Format and dimensions</h3>' +
      '<div class="settings-grid settings-grid--3">' +
      '<div class="field"><label for="ic-format">Output format</label><select class="select" id="ic-format" data-format><option value="keep" selected>Keep original</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option></select></div>' +
      '<div class="field"><label for="ic-maxw">Maximum width (px)</label><input class="input" id="ic-maxw" data-maxw type="number" min="0" max="12000" value="0" placeholder="0 = original"></div>' +
      '<div class="field"><label for="ic-maxh">Maximum height (px)</label><input class="input" id="ic-maxh" data-maxh type="number" min="0" max="12000" value="0" placeholder="0 = original"></div>' +
      "</div>" +
      '<div class="notice">' + MTH.ui.icon("shield") + " Every image is decoded and re-encoded in this tab. Metadata such as GPS location and camera model is stripped automatically.</div>" +
      "</div>" +
      "</div>" +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-run>' + MTH.ui.icon("compress") + "Compress images</button><span class=\"grow\"></span><span class=\"action-note\">Smaller files, same tab. No uploads.</span></div>" +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("ic-prog", "Ready") + MTH.ui.status("ic-status") + "</div>" +
      '<div class="panel-body" data-results-wrap hidden style="border-top:1px solid var(--line)">' +
      '<div class="settings-title"><h3>Results <span class="tag" data-result-count>0</span></h3><button class="btn btn--sm btn--ghost" data-zip>' + MTH.ui.icon("download") + "Download all as ZIP</button></div>" +
      '<div class="result-grid" data-results style="margin-top:12px"></div>' +
      "</div>" +
      "</section>" +
      '<div data-result></div>'
    );

    MTH.tool.bindDrop(stage(), { accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp", multiple: true, onFiles: add });
    stage().querySelector("[data-add]").addEventListener("click", async function () {
      var files = await MTH.pick("image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp", true);
      if (files.length) add(files);
    });
    stage().querySelector("[data-clear]").addEventListener("click", clearAll);
    stage().querySelector("[data-list]").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var row = btn.closest("[data-index]");
      if (!row) return;
      var i = +row.dataset.index;
      if (btn.dataset.act === "remove") removeAt(i);
      render();
    });
    stage().querySelector("[data-modes]").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-mode]");
      if (!btn) return;
      MTH.$$("[data-mode]", stage()).forEach(function (b) { b.classList.toggle("on", b === btn); });
      MTH.$$("[data-mode-panel]", stage()).forEach(function (p) { p.hidden = p.dataset.modePanel !== btn.dataset.mode; });
    });
    stage().querySelector("[data-quality]").addEventListener("input", function (e) {
      stage().querySelector("[data-quality-val]").textContent = e.target.value + "%";
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
    var ws = stage().querySelector("[data-workspace]");
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
    ws.hidden = false;
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
      else if (it.result) meta = it.w + "×" + it.h + " → " + it.result.w + "×" + it.result.h + " · " + MTH.fmtBytes(it.file.size) + " → " + MTH.fmtBytes(it.result.blob.size);
      else meta = it.w ? it.w + " × " + it.h + " px · " + MTH.fmtBytes(it.file.size) : "Reading…";
      var pct = it.result ? Math.round((1 - it.result.blob.size / it.file.size) * 100) : null;
      return '<div class="img-row" data-index="' + i + '">' +
        '<span class="img-thumb"><img src="' + (it.result && it.result.url ? it.result.url : it.url) + '" alt="" loading="lazy"></span>' +
        '<span class="img-main"><span class="file-name" title="' + MTH.esc(it.file.name) + '">' + MTH.esc(it.file.name) + '</span><span class="file-meta">' + MTH.esc(meta) + "</span></span>" +
        (pct != null ? '<span class="save-pill ' + (pct >= 0 ? "ok" : "bad") + '">' + (pct >= 0 ? "−" + pct + "%" : "+" + Math.abs(pct) + "%") + "</span>" : "") +
        '<span class="file-actions"><button type="button" data-act="remove" aria-label="Remove">' + MTH.ui.icon("trash") + "</button></span></div>";
    }).join("");
    var totalIn = state.items.reduce(function (a, it) { return a + it.file.size; }, 0);
    var done = state.items.filter(function (it) { return it.result; });
    var totalOut = done.reduce(function (a, it) { return a + it.result.blob.size; }, 0);
    stage().querySelector("[data-stats]").innerHTML =
      MTH.ui.stat("Images", state.items.length) +
      MTH.ui.stat("Input total", MTH.fmtBytes(totalIn)) +
      MTH.ui.stat("Output total", done.length ? MTH.fmtBytes(totalOut) : "—") +
      MTH.ui.stat("Saved", done.length ? Math.max(0, Math.round((1 - totalOut / done.reduce(function (a, it) { return a + it.file.size; }, 0)) * 100)) + "%" : "—");
    stage().querySelector("[data-run]").disabled = !state.items.some(function (i) { return !i.error; }) || state.busy;
  }

  function outputType(file) {
    var choice = stage().querySelector("[data-format]").value;
    if (choice !== "keep") return choice;
    var type = (file.type || "").toLowerCase();
    if (type === "image/png") return "image/png";
    if (type === "image/webp") return "image/webp";
    return "image/jpeg";
  }
  function extFor(type) { return type === "image/png" ? ".png" : type === "image/webp" ? ".webp" : ".jpg"; }

  async function compressOne(item, opts) {
    var im = await MTH.images.load(item.file);
    try {
      var type = outputType(item.file);
      var bg = type === "image/jpeg" ? "#ffffff" : false;
      var maxW = opts.maxW || null, maxH = opts.maxH || null;
      var canvas = MTH.images.canvas(im.source, { maxW: maxW, maxH: maxH, background: bg });
      var enc = null, best = null;

      if (opts.mode === "quality") {
        enc = await MTH.images.encode(canvas, type, type === "image/png" ? undefined : opts.quality);
      } else {
        var target = opts.targetBytes;
        if (type !== "image/png") {
          var lo = .05, hi = .96;
          for (var i = 0; i < 9; i++) {
            var mid = (lo + hi) / 2;
            var trial = await MTH.images.encode(canvas, type, mid);
            if (trial.blob.size > target) hi = mid;
            else { best = trial; lo = mid; }
          }
          if (!best) best = await MTH.images.encode(canvas, type, .12);
        } else {
          best = await MTH.images.encode(canvas, "image/png");
        }
        var scale = 1;
        while (best.blob.size > target && opts.fallback && Math.min(canvas.width, canvas.height) > 90 && scale > .08) {
          scale *= .86;
          var w = Math.max(60, Math.round(canvas.width * scale));
          var h = Math.max(60, Math.round(canvas.height * scale));
          canvas = MTH.images.canvas(im.source, { maxW: w, maxH: h, background: bg });
          best = await MTH.images.encode(canvas, type, type === "image/png" ? undefined : .7);
        }
        enc = best;
        if (enc.blob.size > target) enc.targetMissed = true;
      }

      var name = MTH.baseName(item.file.name) + "-compressed" + extFor(type);
      return {
        blob: enc.blob, type: type, name: name,
        w: canvas.width, h: canvas.height,
        url: URL.createObjectURL(enc.blob),
        targetMissed: !!enc.targetMissed
      };
    } finally {
      im.close();
    }
  }

  async function run() {
    if (state.busy) return;
    var valid = state.items.filter(function (it) { return !it.error; });
    if (!valid.length) return;
    var mode = MTH.$("[data-mode].on", stage()).dataset.mode;
    var opts = {
      mode: mode,
      quality: +stage().querySelector("[data-quality]").value / 100,
      targetBytes: Math.max(1024, (+stage().querySelector("[data-target]").value || 300) * (+stage().querySelector("[data-target-unit]").value || 1024)),
      fallback: stage().querySelector("[data-fallback]").checked,
      maxW: Math.max(0, +stage().querySelector("[data-maxw]").value || 0),
      maxH: Math.max(0, +stage().querySelector("[data-maxh]").value || 0)
    };
    var btn = stage().querySelector("[data-run]");
    state.busy = true;
    MTH.busy(btn, true); btn.dataset.busyText = "Compressing…";
    MTH.progress("ic-prog", 0, "Compressing 1 of " + valid.length);
    MTH.status("ic-status", "Re-encoding images on this device…");
    try {
      for (var i = 0; i < valid.length; i++) {
        var item = valid[i];
        if (item.result && item.result.url) URL.revokeObjectURL(item.result.url);
        item.result = await compressOne(item, opts);
        MTH.progress("ic-prog", (i + 1) / valid.length, "Compressed " + (i + 1) + " of " + valid.length);
        await MTH.sleep(0);
      }
      render();
      renderResults();
      var totalIn = valid.reduce(function (a, it) { return a + it.file.size; }, 0);
      var totalOut = valid.reduce(function (a, it) { return a + it.result.blob.size; }, 0);
      MTH.progress("ic-prog", 1, "Complete");
      MTH.status("ic-status", "Compressed " + valid.length + " image" + (valid.length === 1 ? "" : "s") + " · " + MTH.fmtBytes(totalIn) + " → " + MTH.fmtBytes(totalOut) + " (" + Math.max(0, Math.round((1 - totalOut / totalIn) * 100)) + "% smaller).", "ok");
      MTH.toast("Images compressed", "ok");
    } catch (e) {
      MTH.progress("ic-prog", null);
      MTH.status("ic-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "image-compress");
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
        (it.result.targetMissed ? '<div class="rc-meta" style="color:var(--warn)"><span>Target not reached</span></div>' : "") +
        '<div class="rc-actions"><button class="btn btn--sm btn--ghost" data-dl="' + idx + '">' + MTH.ui.icon("download") + "Save</button></div></article>";
    }).join("");
  }

  async function zipAll() {
    var done = state.items.filter(function (it) { return it.result; });
    if (!done.length) return;
    var btn = stage().querySelector("[data-zip]");
    MTH.busy(btn, true); btn.dataset.busyText = "Packing…";
    try {
      var used = {};
      var entries = [];
      for (var i = 0; i < done.length; i++) {
        var it = done[i];
        var bytes = new Uint8Array(await it.result.blob.arrayBuffer());
        entries.push({ name: MTH.uniqueName(it.result.name, used), data: bytes });
      }
      await MTH.zip(entries, "compressed-images.zip", function (p) { MTH.progress("ic-prog", p, "Packing ZIP… " + Math.round(p * 100) + "%"); });
      MTH.progress("ic-prog", 1, "ZIP downloaded");
      MTH.status("ic-status", "ZIP archive downloaded with " + entries.length + " images.", "ok");
    } catch (e) {
      MTH.status("ic-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "image-compress-zip");
    } finally {
      MTH.busy(btn, false);
    }
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
