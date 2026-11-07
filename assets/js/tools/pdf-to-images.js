/* PDF to Images */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var state = { file: null, pdf: null, count: 0, busy: false, results: [] };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: ".pdf,application/pdf", icon: "image", title: "Drop a PDF to convert to images", hint: "Every page becomes a crisp JPG, PNG or WebP file. Nothing is uploaded.", meta: ["PDF", "JPG", "PNG", "WebP"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2 data-file-name>Document</h2><p data-file-meta></p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-change>Choose another</button></div></div>' +
      '<div class="settings">' +
      '<div class="settings-section">' +
      '<h3>Image output</h3>' +
      '<div class="settings-grid settings-grid--3">' +
      '<div class="field"><label for="pi-format">Format</label><select class="select" id="pi-format" data-format><option value="image/jpeg">JPG — smallest</option><option value="image/png">PNG — sharp text</option><option value="image/webp">WebP — modern</option></select></div>' +
      '<div class="field"><label for="pi-dpi">Resolution</label><select class="select" id="pi-dpi" data-dpi><option value="72">72 DPI — screen draft</option><option value="96">96 DPI</option><option value="150" selected>150 DPI — balanced</option><option value="200">200 DPI — print</option><option value="300">300 DPI — high detail</option><option value="600">600 DPI — archival</option></select></div>' +
      '<div class="field"><label for="pi-quality">JPG / WebP quality <span class="range-val" data-quality-val>90%</span></label><input id="pi-quality" data-quality type="range" min="45" max="100" value="90"></div>' +
      "</div>" +
      '<div class="field"><label for="pi-range">Pages</label><input class="input" id="pi-range" data-range placeholder="Blank means every page — or try 1-3, 5, 8-"><div class="hint">Each selected page becomes its own image, named by page number.</div></div>' +
      '<div class="notice">' + MTH.ui.icon("info") + " JPG is usually the smallest for photographs. PNG keeps letters and line art crisp. WebP balances both on modern browsers.</div>" +
      "</div>" +
      "</div>" +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-run>' + MTH.ui.icon("image") + "Render pages</button><span class=\"grow\"></span><span class=\"action-note\">Rendering happens page by page, on this device.</span></div>" +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("pi-prog", "Ready") + MTH.ui.status("pi-status") + "</div>" +
      '<div class="panel-body" data-results-wrap hidden style="border-top:1px solid var(--line)">' +
      '<div class="settings-title"><h3>Rendered images <span class="tag" data-result-count>0</span></h3><button class="btn btn--sm btn--ghost" data-zip>' + MTH.ui.icon("download") + "Download all as ZIP</button></div>" +
      '<div class="result-grid" data-results style="margin-top:12px"></div>' +
      "</div>" +
      "</section>" +
      '<div data-result></div>'
    );

    MTH.tool.bindDrop(stage(), { accept: ".pdf,application/pdf", onFiles: function (files) { load(files[0]); } });
    stage().querySelector("[data-change]").addEventListener("click", async function () {
      var files = await MTH.pick(".pdf,application/pdf", false);
      if (files.length) load(files[0]);
    });
    stage().querySelector("[data-quality]").addEventListener("input", function (e) {
      stage().querySelector("[data-quality-val]").textContent = e.target.value + "%";
    });
    stage().querySelector("[data-format]").addEventListener("change", function () {
      var jpg = stage().querySelector("[data-format]").value !== "image/png";
      stage().querySelector("[data-quality]").disabled = !jpg;
    });
    stage().querySelector("[data-run]").addEventListener("click", run);
    stage().querySelector("[data-zip]").addEventListener("click", zipAll);
    stage().querySelector("[data-results]").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-dl]");
      if (!btn) return;
      var item = state.results[+btn.dataset.dl];
      if (item) MTH.download(item.blob, item.name, item.type);
    });
  }

  function clearResults() {
    state.results.forEach(function (r) { if (r.url) URL.revokeObjectURL(r.url); });
    state.results = [];
    var wrap = stage().querySelector("[data-results-wrap]");
    if (wrap) wrap.hidden = true;
    var host = stage().querySelector("[data-results]");
    if (host) host.innerHTML = "";
  }

  async function load(file) {
    if (!file) return;
    clearResults();
    if (state.pdf) { MTH.pdf.destroy(state.pdf); state.pdf = null; }
    state.file = file; state.count = 0;
    var ws = stage().querySelector("[data-workspace]");
    ws.hidden = false;
    stage().querySelector("[data-result]").innerHTML = "";
    stage().querySelector("[data-file-name]").textContent = file.name;
    stage().querySelector("[data-file-meta]").textContent = "Opening document…";
    MTH.status("pi-status", "Opening " + file.name + "…");
    try {
      var pdf = await MTH.pdf.openWithPrompt(file);
      state.pdf = pdf; state.count = pdf.numPages;
      stage().querySelector("[data-file-meta]").textContent = pdf.numPages + " pages · " + MTH.fmtBytes(file.size);
      stage().querySelector("[data-stats]").innerHTML =
        MTH.ui.stat("Pages", pdf.numPages) +
        MTH.ui.stat("Input", MTH.fmtBytes(file.size)) +
        MTH.ui.stat("Output", stage().querySelector("[data-format]").value === "image/png" ? "PNG" : stage().querySelector("[data-format]").value === "image/webp" ? "WebP" : "JPG");
      MTH.status("pi-status", pdf.numPages + " pages ready to render.", "ok");
    } catch (e) {
      if (e.cancelled) { MTH.status("pi-status", "Conversion cancelled."); return; }
      stage().querySelector("[data-file-meta]").textContent = "Could not be opened";
      MTH.status("pi-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "pdf-to-images-load");
    }
  }

  async function run() {
    if (state.busy || !state.pdf) return;
    var btn = stage().querySelector("[data-run]");
    var rangeText = (stage().querySelector("[data-range]").value || "").trim();
    var indices;
    try {
      indices = rangeText ? MTH.ranges(rangeText, state.count) : Array.from({ length: state.count }, function (_, i) { return i; });
    } catch (e) { MTH.status("pi-status", e.message, "err"); MTH.toast(e.message, "err"); return; }
    if (!indices.length) { MTH.status("pi-status", "Select at least one page.", "warn"); return; }

    var format = stage().querySelector("[data-format]").value;
    var dpi = +stage().querySelector("[data-dpi]").value;
    var quality = +stage().querySelector("[data-quality]").value / 100;
    var base = MTH.baseName(state.file.name);
    var ext = format === "image/png" ? ".png" : format === "image/webp" ? ".webp" : ".jpg";
    var scale = dpi / 72;

    state.busy = true; clearResults();
    MTH.busy(btn, true); btn.dataset.busyText = "Rendering…";
    MTH.progress("pi-prog", 0, "Rendering page 1 of " + indices.length);
    MTH.status("pi-status", "Rendering at " + dpi + " DPI…");
    try {
      for (var k = 0; k < indices.length; k++) {
        var pageNumber = indices[k] + 1;
        var page = await state.pdf.getPage(pageNumber);
        var rendered = await MTH.pdf.renderToCanvas(page, scale, page.rotate, { pixelRatio: 1, maxPixels: 120000000 });
        var enc = await MTH.images.encode(rendered.canvas, format, quality);
        var name = base + "-page-" + String(pageNumber).padStart(3, "0") + ext;
        state.results.push({
          name: name, blob: enc.blob, type: enc.type, bytes: enc.bytes,
          width: rendered.canvas.width, height: rendered.canvas.height,
          url: URL.createObjectURL(enc.blob)
        });
        rendered.canvas.width = rendered.canvas.height = 0;
        MTH.progress("pi-prog", (k + 1) / indices.length, "Rendered " + (k + 1) + " of " + indices.length + " pages");
        MTH.status("pi-status", "Page " + pageNumber + " · " + MTH.fmtBytes(enc.blob.size) + " …");
        await MTH.sleep(0);
      }
      renderResults();
      var totalBytes = state.results.reduce(function (a, r) { return a + r.blob.size; }, 0);
      MTH.progress("pi-prog", 1, "Complete");
      MTH.status("pi-status", state.results.length + " image" + (state.results.length === 1 ? "" : "s") + " ready · " + MTH.fmtBytes(totalBytes) + " total.", "ok");
      MTH.toast("Pages rendered", "ok");
    } catch (e) {
      MTH.progress("pi-prog", null);
      MTH.status("pi-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "pdf-to-images");
    } finally {
      state.busy = false; MTH.busy(btn, false);
    }
  }

  function renderResults() {
    var wrap = stage().querySelector("[data-results-wrap]");
    wrap.hidden = false;
    stage().querySelector("[data-result-count]").textContent = state.results.length + " file" + (state.results.length === 1 ? "" : "s");
    stage().querySelector("[data-results]").innerHTML = state.results.map(function (r, i) {
      return '<article class="result-card"><div class="result-thumb"><img src="' + r.url + '" alt="Page image" loading="lazy"></div>' +
        '<div class="rc-name" title="' + MTH.esc(r.name) + '">' + MTH.esc(r.name) + "</div>" +
        '<div class="rc-meta"><span>' + r.width + "×" + r.height + "</span><span>" + MTH.fmtBytes(r.blob.size) + "</span></div>" +
        '<div class="rc-actions"><button class="btn btn--sm btn--ghost" data-dl="' + i + '">' + MTH.ui.icon("download") + "Save</button></div></article>";
    }).join("");
  }

  async function zipAll() {
    if (!state.results.length) return;
    var btn = stage().querySelector("[data-zip]");
    MTH.busy(btn, true); btn.dataset.busyText = "Packing…";
    try {
      var entries = state.results.map(function (r) { return { name: r.name, data: r.bytes }; });
      await MTH.zip(entries, MTH.baseName(state.file.name) + "-images.zip", function (p) { MTH.progress("pi-prog", p, "Packing ZIP… " + Math.round(p * 100) + "%"); });
      MTH.progress("pi-prog", 1, "ZIP downloaded");
      MTH.status("pi-status", "ZIP archive downloaded.", "ok");
    } catch (e) {
      MTH.status("pi-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "pdf-to-images-zip");
    } finally {
      MTH.busy(btn, false);
    }
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
