/* PDF Compress */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;
  var state = { file: null, pdf: null, count: 0, encrypted: false, busy: false, output: null, mode: "rebuild" };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: ".pdf,application/pdf", icon: "compress", title: "Drop a PDF to compress", hint: "Choose a cleanup pass or a page-by-page rebuild.", meta: ["PDF", "Quality control", "Local only"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2 data-file-name>Document</h2><p data-file-meta></p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-change>Choose another</button></div></div>' +
      '<div class="settings">' +
      '<div class="settings-section"><h3>Compression method</h3>' +
      '<div class="seg" data-modes role="group" aria-label="Compression method"><button type="button" class="on" data-mode="rebuild">Rebuild pages</button><button type="button" data-mode="cleanup">Structure cleanup</button></div>' +
      '<div class="notice" data-mode-note style="margin-top:12px"><strong>Rebuild pages</strong> renders every page at the resolution you choose and re-embeds it as a JPEG. This is the big saving for scanned documents, but the text layer becomes an image.</div>' +
      "</div>" +
      '<div class="settings-section" data-options>' +
      '<div class="settings-grid">' +
      '<div class="field"><label for="cmp-dpi">Render resolution</label><select class="select" id="cmp-dpi" data-dpi><option value="72">72 DPI · proof</option><option value="96">96 DPI · small</option><option value="120" selected>120 DPI · balanced</option><option value="150">150 DPI · sharp</option><option value="200">200 DPI · print</option></select><div class="hint">Higher values look better and produce larger files.</div></div>' +
      '<div class="field"><label for="cmp-quality">JPEG quality <span class="range-val" data-q-val>72%</span></label><input type="range" id="cmp-quality" data-quality min="35" max="92" value="72"><div class="hint">Below 55% compression artefacts become visible on text.</div></div>' +
      "</div>" +
      '<label class="check" style="margin-top:4px"><input type="checkbox" data-grayscale> Convert pages to grayscale</label>' +
      '<label class="check" style="margin-top:8px"><input type="checkbox" data-strip checked> Remove document metadata (author, title, keywords)</label>' +
      "</div>" +
      '<div class="settings-section" data-cleanup-note hidden><div class="notice"><strong>Structure cleanup</strong> rewrites the PDF’s internal object table without changing page content. It is lossless and preserves selectable text. Savings depend on how the original file was written; a well-optimised file may not shrink.</div></div>' +
      "</div>" +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-run>Compress PDF</button><span class="grow"></span><span class="action-note">The original file is never modified.</span></div>' +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("compress-prog", "Ready") + MTH.ui.status("compress-status") + "</div>" +
      "</section>" +
      '<div data-result></div>'
    );
    MTH.tool.bindDrop(stage(), { accept: ".pdf,application/pdf", onFiles: function (files) { load(files[0]); } });
    stage().querySelector("[data-change]").addEventListener("click", async function () {
      var files = await MTH.pick(".pdf,application/pdf", false);
      if (files.length) load(files[0]);
    });
    stage().querySelector("[data-modes]").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-mode]");
      if (!btn) return;
      if (state.encrypted && btn.dataset.mode === "cleanup") {
        MTH.status("compress-status", "Structure cleanup needs an unencrypted file. Rebuild pages works with the password you entered.", "warn");
        return;
      }
      state.mode = btn.dataset.mode;
      MTH.$$("[data-mode]", stage()).forEach(function (b) { b.classList.toggle("on", b === btn); });
      syncMode();
    });
    var q = stage().querySelector("[data-quality]");
    q.addEventListener("input", function () {
      var val = stage().querySelector("[data-q-val]");
      if (val) val.textContent = q.value + "%";
    });
    stage().querySelector("[data-run]").addEventListener("click", run);
  }

  async function load(file) {
    if (!file) return;
    resetOutput();
    state.file = file;
    state.encrypted = false;
    if (state.pdf) { MTH.pdf.destroy(state.pdf); state.pdf = null; }
    var ws = stage().querySelector("[data-workspace]");
    ws.hidden = false;
    stage().querySelector("[data-file-name]").textContent = file.name;
    stage().querySelector("[data-file-meta]").textContent = MTH.fmtBytes(file.size);
    MTH.status("compress-status", "Opening " + file.name + "…");
    try {
      var pdf;
      try { pdf = await MTH.pdf.load(file); }
      catch (e) {
        if (!e.needsPassword) throw e;
        pdf = await MTH.pdf.openWithPrompt(file);
        state.encrypted = true;
      }
      state.pdf = pdf;
      state.count = pdf.numPages;
      if (state.encrypted) {
        state.mode = "rebuild";
        MTH.$$("[data-mode]", stage()).forEach(function (b) { b.classList.toggle("on", b.dataset.mode === "rebuild"); });
        var cleanupBtn = stage().querySelector('[data-mode="cleanup"]');
        if (cleanupBtn) { cleanupBtn.disabled = true; cleanupBtn.title = "Unlock the PDF first to use lossless cleanup."; }
      } else {
        var cleanupBtn2 = stage().querySelector('[data-mode="cleanup"]');
        if (cleanupBtn2) { cleanupBtn2.disabled = false; cleanupBtn2.title = ""; }
      }
      syncMode();
      MTH.status("compress-status", state.count + " pages ready." + (state.encrypted ? " Protected file opened for rebuild only." : ""), "ok");
    } catch (e) {
      if (e.cancelled) { MTH.status("compress-status", "Password entry cancelled.", "warn"); return; }
      MTH.status("compress-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "compress-load");
    }
  }

  function syncMode() {
    var note = stage().querySelector("[data-mode-note]");
    var options = stage().querySelector("[data-options]");
    var cleanupNote = stage().querySelector("[data-cleanup-note]");
    if (state.mode === "cleanup") {
      note.innerHTML = "<strong>Structure cleanup</strong> rewrites the PDF’s object streams without touching page content. Text stays selectable and nothing is re-rendered.";
      options.hidden = true;
      cleanupNote.hidden = false;
    } else {
      note.innerHTML = "<strong>Rebuild pages</strong> renders every page at the resolution you choose and re-embeds it as a JPEG. This is the big saving for scanned documents, but the text layer becomes an image.";
      options.hidden = false;
      cleanupNote.hidden = true;
    }
    updateStats();
  }

  function updateStats() {
    var stats = stage() && stage().querySelector("[data-stats]");
    if (!stats) return;
    stats.innerHTML = MTH.ui.stat("Pages", state.count || "—") + MTH.ui.stat("Input size", state.file ? MTH.fmtBytes(state.file.size) : "—") + MTH.ui.stat("Method", state.mode === "cleanup" ? "Lossless" : "Rebuild") + MTH.ui.stat("Protection", state.encrypted ? "Password" : "None");
    var run = stage().querySelector("[data-run]");
    if (run) run.disabled = state.busy || !state.file;
  }

  function resetOutput() {
    state.output = null;
    var host = stage() && stage().querySelector("[data-result]");
    if (host) host.innerHTML = "";
  }

  function grayscale(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    var data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var px = data.data;
    for (var i = 0; i < px.length; i += 4) {
      var v = Math.round(px[i] * .299 + px[i + 1] * .587 + px[i + 2] * .114);
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(data, 0, 0);
  }

  async function run() {
    if (state.busy || !state.file) return;
    var btn = stage().querySelector("[data-run]");
    state.busy = true;
    btn.dataset.busyText = state.mode === "cleanup" ? "Cleaning…" : "Rebuilding…";
    MTH.busy(btn, true);
    resetOutput();
    MTH.progress("compress-prog", 0, state.mode === "cleanup" ? "Reading the document…" : "Rendering page 1…");
    try {
      var bytes, name, method;
      if (state.mode === "cleanup") {
        if (state.encrypted) throw new Error("This PDF is encrypted. Unlock it first, or use Rebuild pages.");
        var src = await MTH.pdf.openLib(state.file);
        if (stage().querySelector("[data-strip]").checked) {
          try {
            src.setTitle("");
            src.setAuthor("");
            src.setSubject("");
            src.setKeywords([]);
          } catch (e) {}
        }
        src.setProducer("MULTI TOOL HUB");
        src.setCreator("MULTI TOOL HUB · local browser cleanup");
        bytes = await src.save({ useObjectStreams: true, addDefaultPage: false });
        name = MTH.baseName(state.file.name) + "-compressed.pdf";
        method = "Structure cleanup";
        MTH.progress("compress-prog", 1, "Complete");
      } else {
        var dpi = parseInt(stage().querySelector("[data-dpi]").value, 10) || 120;
        var quality = parseInt(stage().querySelector("[data-quality]").value, 10) / 100;
        var gray = stage().querySelector("[data-grayscale]").checked;
        var pdf = state.pdf;
        if (!pdf) throw new Error("The PDF is no longer open. Choose the file again.");
        var out = await PDFLib.PDFDocument.create();
        for (var n = 1; n <= pdf.numPages; n++) {
          var page = await pdf.getPage(n);
          var base = page.getViewport({ scale: 1 });
          var scale = Math.min(dpi / 72, Math.sqrt(9000000 / (base.width * base.height)));
          var vp = page.getViewport({ scale: scale });
          var canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(vp.width));
          canvas.height = Math.max(1, Math.round(vp.height));
          var ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) throw new Error("This browser could not create a canvas for page " + n + ".");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.setTransform(scale, 0, 0, scale, 0, 0);
          var task = page.render({ canvasContext: ctx, viewport: base, background: "#ffffff" });
          await task.promise;
          if (gray) grayscale(canvas);
          var enc = await MTH.images.encode(canvas, "image/jpeg", quality);
          var img = await out.embedJpg(enc.bytes);
          var sheet = out.addPage([base.width, base.height]);
          sheet.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
          canvas.width = 0; canvas.height = 0;
          MTH.progress("compress-prog", n / pdf.numPages, "Rendered " + n + " of " + pdf.numPages + " pages");
          MTH.status("compress-status", "Compressing page " + n + " of " + pdf.numPages + "…");
          if (n % 2 === 0) await MTH.sleep(0);
        }
        if (stage().querySelector("[data-strip]").checked) {
          try { out.setTitle(""); out.setAuthor(""); out.setSubject(""); out.setKeywords([]); } catch (e) {}
        }
        out.setProducer("MULTI TOOL HUB");
        out.setCreator("MULTI TOOL HUB · local browser rebuild");
        bytes = await out.save({ useObjectStreams: true, addDefaultPage: false });
        name = MTH.baseName(state.file.name) + "-compressed.pdf";
        method = "Page rebuild at " + dpi + " DPI";
        MTH.progress("compress-prog", 1, "Complete");
      }
      var blob = new Blob([bytes], { type: "application/pdf" });
      var saved = state.file.size - blob.size;
      var pct = state.file.size ? Math.round(saved / state.file.size * 100) : 0;
      state.output = { blob: blob, name: name };
      MTH.download(blob, name, "application/pdf");
      MTH.status("compress-status", "Ready: " + MTH.fmtBytes(state.file.size) + " → " + MTH.fmtBytes(blob.size) + (saved >= 0 ? " (" + pct + "% smaller)" : " (" + MTH.fmtBytes(-saved) + " larger)") + ". " + method + ".", saved >= 0 ? "ok" : "warn");
      stage().querySelector("[data-result]").innerHTML = MTH.tool.resultPanel({
        title: "Compressed PDF is ready",
        meta: MTH.fmtBytes(state.file.size) + " → " + MTH.fmtBytes(blob.size) + " · " + method + " · downloaded automatically",
        buttons: '<button class="btn btn--sm" data-download-result>' + MTH.ui.icon("download") + "Download again</button>"
      });
      stage().querySelector("[data-download-result]").addEventListener("click", function () {
        if (state.output) MTH.download(state.output.blob, state.output.name, "application/pdf");
      });
      MTH.toast(saved >= 0 ? "PDF compressed by " + pct + "%" : "Compression complete — this file was already well optimised", saved >= 0 ? "ok" : "warn");
      updateStats();
    } catch (e) {
      MTH.progress("compress-prog", null);
      MTH.status("compress-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "compress");
    } finally {
      state.busy = false;
      MTH.busy(btn, false);
      updateStats();
    }
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
