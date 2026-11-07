/* Background Remover — edge-aware flood fill on Canvas */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var state = {
    file: null,
    image: null,
    sourceCanvas: null,
    sourceData: null,
    width: 0,
    height: 0,
    samples: [],
    seeds: [],
    result: null,
    resultCanvas: null,
    view: "result",
    sampling: false,
    busy: false,
    downscaled: false,
    timer: null
  };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp", icon: "eraser", title: "Drop a product photo or logo", hint: "Remove a flat, near-flat or plain background. Runs entirely in this tab.", meta: ["PNG", "Transparency", "Canvas"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2 data-file-name>Image</h2><p data-file-meta></p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-change>Choose another</button><button class="btn btn--sm btn--subtle" data-reset>Reset edits</button></div></div>' +
      '<div class="panel-body">' +
      '<div class="bg-workspace">' +
      '<div class="bg-preview checkerboard" data-preview-box>' +
      '<canvas data-preview></canvas>' +
      '<div class="bg-empty" data-empty>' + MTH.ui.icon("image") + "<span>Your image appears here</span></div>" +
      '<div class="bg-cursor-hint" data-cursor-hint hidden>Click the background to add a sample</div>' +
      "</div>" +
      '<div class="bg-side">' +
      '<div class="settings-title"><h3>Background detection</h3><span class="tag" data-mode-tag>Border samples</span></div>' +
      '<div class="field"><label for="bg-tolerance">Colour tolerance <span class="range-val" data-tolerance-val>24%</span></label><input id="bg-tolerance" data-tolerance type="range" min="1" max="100" value="24"><div class="hint">Raise it for uneven lighting or subtle gradients. Lower it to protect a background-coloured subject.</div></div>' +
      '<div class="field"><label for="bg-feather">Edge feather <span class="range-val" data-feather-val>18%</span></label><input id="bg-feather" data-feather type="range" min="0" max="100" value="18"><div class="hint">Softens the cutoff so hair, fur and anti-aliased edges keep a natural outline.</div></div>' +
      '<label class="check" style="margin-bottom:13px"><input type="checkbox" data-edge checked> Edge-aware fill (stop at strong edges)</label>' +
      '<div class="inline" style="margin-bottom:13px"><button class="btn btn--sm btn--ghost" data-sample>' + MTH.ui.icon("target") + 'Sample background</button><button class="btn btn--sm btn--subtle" data-clear-samples>Clear samples</button></div>' +
      '<div class="settings-title" style="margin-top:18px"><h3>Replace with</h3></div>' +
      '<div class="seg" data-bg-modes role="group" aria-label="Replacement background"><button type="button" class="on" data-bg="transparent">Transparent</button><button type="button" data-bg="colour">Colour</button><button type="button" data-bg="white">White</button></div>' +
      '<div class="field" data-colour-field hidden style="margin-top:12px"><label for="bg-colour">Background colour</label><input class="input" id="bg-colour" data-colour type="color" value="#ffffff"></div>' +
      '<div class="seg seg--sm" data-views role="group" aria-label="Preview mode" style="margin-top:16px"><button type="button" class="on" data-view="result">Result</button><button type="button" data-view="original">Original</button></div>' +
      '<div class="stat-grid" data-stats style="margin-top:16px"></div>' +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="action-bar"><button class="btn" data-run>' + MTH.ui.icon("wand") + "Remove background</button><span class=\"grow\"></span><span class=\"action-note\">PNG keeps transparency. JPG flattens onto white.</span></div>" +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("bg-prog", "Ready") + MTH.ui.status("bg-status") + "</div>" +
      "</section>" +
      '<div data-result></div>'
    );

    MTH.tool.bindDrop(stage(), { accept: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp", onFiles: function (files) { load(files[0]); } });
    stage().querySelector("[data-change]").addEventListener("click", async function () {
      var files = await MTH.pick("image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp", false);
      if (files.length) load(files[0]);
    });
    stage().querySelector("[data-reset]").addEventListener("click", function () {
      state.samples = [];
      state.seeds = [];
      stage().querySelector("[data-mode-tag]").textContent = "Border samples";
      stage().querySelector("[data-sample]").classList.remove("btn--brass");
      state.sampling = false;
      stage().querySelector("[data-cursor-hint]").hidden = true;
      render();
      process();
    });
    stage().querySelector("[data-tolerance]").addEventListener("input", function (e) {
      stage().querySelector("[data-tolerance-val]").textContent = e.target.value + "%";
      schedule();
    });
    stage().querySelector("[data-feather]").addEventListener("input", function (e) {
      stage().querySelector("[data-feather-val]").textContent = e.target.value + "%";
      schedule();
    });
    stage().querySelector("[data-edge]").addEventListener("change", schedule);
    stage().querySelector("[data-sample]").addEventListener("click", toggleSampling);
    stage().querySelector("[data-clear-samples]").addEventListener("click", function () {
      state.samples = [];
      state.seeds = [];
      stage().querySelector("[data-mode-tag]").textContent = "Border samples";
      schedule();
    });
    stage().querySelector("[data-bg-modes]").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-bg]");
      if (!btn) return;
      MTH.$$("[data-bg]", stage()).forEach(function (b) { b.classList.toggle("on", b === btn); });
      stage().querySelector("[data-colour-field]").hidden = btn.dataset.bg !== "colour";
      schedule();
    });
    stage().querySelector("[data-views]").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-view]");
      if (!btn) return;
      state.view = btn.dataset.view;
      MTH.$$("[data-view]", stage()).forEach(function (b) { b.classList.toggle("on", b === btn); });
      paint();
    });
    stage().querySelector("[data-preview-box]").addEventListener("click", pickSample);
  }

  async function load(file) {
    if (!file) return;
    state.file = file;
    state.samples = [];
    state.seeds = [];
    state.sampling = false;
    state.result = null;
    var ws = stage().querySelector("[data-workspace]");
    ws.hidden = false;
    stage().querySelector("[data-result]").innerHTML = "";
    stage().querySelector("[data-file-name]").textContent = file.name;
    stage().querySelector("[data-file-meta]").textContent = "Decoding image…";
    stage().querySelector("[data-empty]").hidden = true;
    MTH.status("bg-status", "Reading " + file.name + "…");
    try {
      if (state.image) { try { state.image.close(); } catch (e) {} }
      var im = await MTH.images.load(file);
      state.image = im;
      var maxSide = 3200;
      var scale = Math.min(1, maxSide / Math.max(im.width, im.height));
      state.downscaled = scale < 1;
      state.width = Math.max(1, Math.round(im.width * scale));
      state.height = Math.max(1, Math.round(im.height * scale));
      var c = MTH.images.canvas(im.source, { maxW: state.width, maxH: state.height, background: false });
      state.sourceCanvas = c;
      var ctx = c.getContext("2d", { willReadFrequently: true });
      state.sourceData = ctx.getImageData(0, 0, c.width, c.height);
      state.width = c.width; state.height = c.height;
      stage().querySelector("[data-file-meta]").textContent = (im.width + " × " + im.height + " px · " + MTH.fmtBytes(file.size)) + (state.downscaled ? " · preview capped at 3200 px" : "");
      stage().querySelector("[data-stats]").innerHTML =
        MTH.ui.stat("Source", im.width + " × " + im.height) +
        MTH.ui.stat("Working", state.width + " × " + state.height) +
        MTH.ui.stat("Samples", "Auto");
      stage().querySelector("[data-empty]").hidden = true;
      render();
      await process();
      MTH.status("bg-status", "Adjust tolerance and feather until the outline looks clean.", "ok");
    } catch (e) {
      MTH.status("bg-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "background-remove-load");
    }
  }

  function render() {
    var box = stage().querySelector("[data-preview-box]");
    var canvas = stage().querySelector("[data-preview]");
    if (!state.sourceCanvas) { canvas.hidden = true; return; }
    canvas.hidden = false;
    var maxW = Math.max(220, box.clientWidth - 2);
    var scale = Math.min(1, maxW / state.width);
    canvas.width = state.width;
    canvas.height = state.height;
    canvas.style.width = Math.round(state.width * scale) + "px";
    canvas.style.height = Math.round(state.height * scale) + "px";
    paint();
  }

  function paint() {
    var canvas = stage().querySelector("[data-preview]");
    if (!canvas || !state.sourceCanvas) return;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.view === "original" || !state.resultCanvas) {
      ctx.drawImage(state.sourceCanvas, 0, 0);
    } else {
      ctx.drawImage(state.resultCanvas, 0, 0);
    }
  }

  function toggleSampling() {
    state.sampling = !state.sampling;
    var btn = stage().querySelector("[data-sample]");
    btn.classList.toggle("btn--brass", state.sampling);
    btn.classList.toggle("btn--ghost", !state.sampling);
    stage().querySelector("[data-cursor-hint]").hidden = !state.sampling;
    stage().querySelector("[data-preview-box]").classList.toggle("is-sampling", state.sampling);
    if (state.sampling) MTH.toast("Click the background colour in the preview. Add several samples for gradients.", "info", 5200);
  }

  function pickSample(e) {
    if (!state.sampling || !state.sourceData) return;
    var canvas = stage().querySelector("[data-preview]");
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var nx = MTH.clamp((e.clientX - rect.left) / rect.width, 0, .9999);
    var ny = MTH.clamp((e.clientY - rect.top) / rect.height, 0, .9999);
    var x = Math.floor(nx * state.width), y = Math.floor(ny * state.height);
    var i = (y * state.width + x) * 4;
    var d = state.sourceData.data;
    var sample = { r: d[i], g: d[i + 1], b: d[i + 2] };
    var exists = state.samples.some(function (s) { return Math.abs(s.r - sample.r) + Math.abs(s.g - sample.g) + Math.abs(s.b - sample.b) < 12; });
    if (!exists) state.samples.push(sample);
    state.seeds.push({ x: x, y: y });
    stage().querySelector("[data-mode-tag]").textContent = state.samples.length + " sample" + (state.samples.length === 1 ? "" : "s");
    stage().querySelector("[data-stats]").innerHTML =
      MTH.ui.stat("Source", state.image.width + " × " + state.image.height) +
      MTH.ui.stat("Working", state.width + " × " + state.height) +
      MTH.ui.stat("Samples", state.samples.length);
    process();
  }

  function schedule() {
    clearTimeout(state.timer);
    state.timer = setTimeout(process, 180);
  }

  function autoSamples() {
    if (state.samples.length) return state.samples.slice();
    var d = state.sourceData.data, w = state.width, h = state.height;
    var out = [], seen = {};
    function add(x, y) {
      var i = (y * w + x) * 4;
      var r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
      if (a < 24) return;
      var key = (r >> 4) + ":" + (g >> 4) + ":" + (b >> 4);
      if (seen[key]) return;
      seen[key] = 1; out.push({ r: r, g: g, b: b });
    }
    var step = Math.max(1, Math.floor((w + h) / 220));
    for (var x = 0; x < w; x += step) { add(x, 0); add(x, h - 1); }
    for (var y = 0; y < h; y += step) { add(0, y); add(w - 1, y); }
    return out.slice(0, 16);
  }

  function dist(r, g, b, s) {
    var dr = r - s.r, dg = g - s.g, db = b - s.b;
    return Math.sqrt(.299 * dr * dr + .587 * dg * dg + .114 * db * db);
  }

  function minDist(r, g, b, samples) {
    var best = Infinity;
    for (var i = 0; i < samples.length; i++) {
      var d = dist(r, g, b, samples[i]);
      if (d < best) best = d;
    }
    return best;
  }

  function localEdge(d, w, h, idx) {
    var x = idx % w, y = (idx - x) / w;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return false;
    var i = idx * 4;
    var l = (i - 4), r = (i + 4), u = (i - w * 4), dn = (i + w * 4);
    var lum = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2];
    var lumL = .299 * d[l] + .587 * d[l + 1] + .114 * d[l + 2];
    var lumR = .299 * d[r] + .587 * d[r + 1] + .114 * d[r + 2];
    var lumU = .299 * d[u] + .587 * d[u + 1] + .114 * d[u + 2];
    var lumD = .299 * d[dn] + .587 * d[dn + 1] + .114 * d[dn + 2];
    var gx = Math.abs(lumL - lumR), gy = Math.abs(lumU - lumD);
    return Math.sqrt(gx * gx + gy * gy) > 58;
  }

  function process(explicit) {
    if (!state.sourceData || state.busy) return;
    state.busy = true;
    var tolerance = +stage().querySelector("[data-tolerance]").value;
    var feather = +stage().querySelector("[data-feather]").value;
    var edge = stage().querySelector("[data-edge]").checked;
    var samples = autoSamples();
    if (!samples.length) {
      state.busy = false;
      MTH.status("bg-status", "No background samples could be found. Try the Sample background button.", "warn");
      return;
    }
    var canvas = document.createElement("canvas");
    canvas.width = state.width; canvas.height = state.height;
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    var out = ctx.createImageData(state.width, state.height);
    var src = state.sourceData.data, dst = out.data;
    var w = state.width, h = state.height, n = w * h;
    var maxDist = Math.max(6, tolerance / 100 * 180);
    var inner = Math.max(0, maxDist * (1 - feather / 100));
    var visited = new Uint8Array(n);
    var queue = new Int32Array(n);
    var qh = 0, qt = 0;

    function trySeed(idx) {
      if (visited[idx]) return;
      visited[idx] = 1;
      var i = idx * 4;
      if (src[i + 3] < 24) { queue[qt++] = idx; return; }
      var d = minDist(src[i], src[i + 1], src[i + 2], samples);
      if (d <= maxDist) queue[qt++] = idx;
    }
    var step = Math.max(1, Math.floor((w + h) / 260));
    for (var x = 0; x < w; x += step) { trySeed(x); trySeed((h - 1) * w + x); }
    for (var y = 0; y < h; y += step) { trySeed(y * w); trySeed(y * w + w - 1); }
    state.seeds.forEach(function (s) {
      var sx = MTH.clamp(Math.round(s.x), 0, w - 1), sy = MTH.clamp(Math.round(s.y), 0, h - 1);
      trySeed(sy * w + sx);
    });

    while (qh < qt) {
      var idx = queue[qh++];
      var px = idx % w, py = (idx - px) / w;
      if (px > 0) expand(idx - 1);
      if (px < w - 1) expand(idx + 1);
      if (py > 0) expand(idx - w);
      if (py < h - 1) expand(idx + w);
    }

    function expand(nb) {
      if (visited[nb]) return;
      visited[nb] = 1;
      var i = nb * 4;
      if (src[i + 3] < 24) { queue[qt++] = nb; return; }
      var d = minDist(src[i], src[i + 1], src[i + 2], samples);
      if (d > maxDist) return;
      if (edge && localEdge(src, w, h, nb)) return;
      queue[qt++] = nb;
    }

    for (var k = 0; k < n; k++) {
      var i = k * 4;
      var alpha = 255;
      if (visited[k]) {
        if (src[i + 3] < 24) alpha = 0;
        else {
          var d = minDist(src[i], src[i + 1], src[i + 2], samples);
          alpha = d <= inner ? 0 : d >= maxDist ? 255 : Math.round(255 * (d - inner) / Math.max(1, maxDist - inner));
          alpha = Math.min(alpha, 255);
        }
      }
      dst[i] = src[i]; dst[i + 1] = src[i + 1]; dst[i + 2] = src[i + 2];
      dst[i + 3] = alpha;
    }
    ctx.putImageData(out, 0, 0);

    var modeBtn = MTH.$("[data-bg].on", stage());
    var mode = modeBtn ? modeBtn.dataset.bg : "transparent";
    if (mode !== "transparent") {
      var colour = mode === "white" ? "#ffffff" : stage().querySelector("[data-colour]").value;
      var bg = document.createElement("canvas");
      bg.width = w; bg.height = h;
      var bctx = bg.getContext("2d");
      bctx.fillStyle = colour;
      bctx.fillRect(0, 0, w, h);
      bctx.drawImage(canvas, 0, 0);
      canvas = bg;
    }

    if (state.result && state.result.url) URL.revokeObjectURL(state.result.url);
    state.resultCanvas = canvas;
    state.result = { canvas: canvas, transparency: mode === "transparent" };
    var transparent = 0;
    for (var q = 3; q < dst.length; q += 4) if (dst[q] < 200) transparent++;
    var pct = Math.round(transparent / n * 100);
    stage().querySelector("[data-stats]").innerHTML =
      MTH.ui.stat("Source", state.image.width + " × " + state.image.height) +
      MTH.ui.stat("Working", state.width + " × " + state.height) +
      MTH.ui.stat("Removed", pct + "%") +
      MTH.ui.stat("Samples", state.samples.length || "Auto");
    state.busy = false;
    paint();
    MTH.status("bg-status", (explicit ? "Background removed. " : "") + pct + "% of the image became background. " + (state.samples.length ? "Using " + state.samples.length + " manual sample" + (state.samples.length === 1 ? "" : "s") + "." : "Using border or transparent samples."), "ok");
    stage().querySelector("[data-preview]").classList.add("is-updated");
    setTimeout(function () { var c = stage().querySelector("[data-preview]"); if (c) c.classList.remove("is-updated"); }, 500);
  }

  function finish(kind) {
    if (!state.resultCanvas) return;
    var name = MTH.baseName(state.file.name) + (kind === "jpg" ? "-no-background.jpg" : "-transparent.png");
    if (kind === "jpg") {
      var c = document.createElement("canvas");
      c.width = state.resultCanvas.width; c.height = state.resultCanvas.height;
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(state.resultCanvas, 0, 0);
      MTH.download(c.toDataURL("image/jpeg", .92), name, "image/jpeg");
    } else {
      MTH.download(state.resultCanvas, name, "image/png");
    }
    stage().querySelector("[data-result]").innerHTML = MTH.tool.resultPanel({
      title: "Cutout is ready",
      meta: state.width + " × " + state.height + " px · " + (kind === "jpg" ? "white background" : "transparent PNG"),
      buttons: '<button class="btn btn--sm btn--ghost" data-dl-png>' + MTH.ui.icon("download") + "PNG</button><button class=\"btn btn--sm\" data-dl-jpg>" + MTH.ui.icon("image") + "JPG</button><button class=\"btn btn--sm btn--subtle\" data-preview-result>Preview</button>"
    });
    var pngBtn = stage().querySelector("[data-dl-png]");
    var jpgBtn = stage().querySelector("[data-dl-jpg]");
    if (pngBtn) pngBtn.addEventListener("click", function () { finish("png"); });
    if (jpgBtn) jpgBtn.addEventListener("click", function () { finish("jpg"); });
    var pv = stage().querySelector("[data-preview-result]");
    if (pv) pv.addEventListener("click", function () { MTH.preview({ canvas: state.resultCanvas, title: "Background removed", downloadName: MTH.baseName(state.file.name) + "-transparent.png" }); });
    MTH.toast("Cutout downloaded", "ok");
  }

  function init() {
    shell();
    stage().querySelector("[data-run]").addEventListener("click", function () {
      if (!state.resultCanvas) { MTH.status("bg-status", "Choose an image first.", "warn"); return; }
      finish("png");
    });
    var ro = new ResizeObserver(function () { render(); });
    ro.observe(stage().querySelector("[data-preview-box]"));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
