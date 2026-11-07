/* Unlock PDF (known password only) */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var state = { file: null, pdf: null, count: 0, locked: false, busy: false, encrypted: false };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: ".pdf,application/pdf", icon: "lock", title: "Drop a protected PDF", hint: "Use a password you already know. Nothing is guessed, cracked or uploaded.", meta: ["PDF", "Known password", "Local only"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2 data-file-name>Document</h2><p data-file-meta></p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-change>Choose another</button></div></div>' +
      '<div class="settings">' +
      '<div class="settings-section">' +
      '<h3>Password</h3>' +
      '<div class="notice notice--warn" style="margin-bottom:14px">' + MTH.ui.icon("shield") + " <strong>MULTI TOOL HUB cannot crack or guess passwords.</strong> Enter the password you already use to open this document. It is checked by your browser and never leaves this page.</div>" +
      '<div class="field"><label for="un-password">Current PDF password</label><div class="inline" style="flex-wrap:nowrap;max-width:420px"><input class="input" id="un-password" data-password type="password" autocomplete="off" placeholder="Enter the known password"><button class="icon-btn" type="button" data-eye aria-label="Show password">' + MTH.ui.icon("eye") + "</button></div>" +
      '<div class="hint" data-password-hint>Leave blank if the file opens without a password.</div></div>' +
      "</div>" +
      '<div class="settings-section">' +
      '<h3>Fallback quality</h3>' +
      '<p class="hint" style="margin-bottom:12px">If a lossless save is blocked by the encryption, the pages are rebuilt as high-resolution images. Choose that resolution here.</p>' +
      '<div class="settings-grid settings-grid--3">' +
      '<div class="field"><label for="un-dpi">Rebuild resolution</label><select class="select" id="un-dpi" data-dpi><option value="120">120 DPI — smaller file</option><option value="150" selected>150 DPI — balanced</option><option value="200">200 DPI — sharp</option><option value="300">300 DPI — print</option></select></div>' +
      '<div class="field"><label for="un-quality">Image quality <span class="range-val" data-quality-val>90%</span></label><input id="un-quality" data-quality type="range" min="60" max="100" value="90"></div>' +
      '<div class="field"><label>Lossless first</label><label class="check" style="margin-top:8px"><input type="checkbox" data-lossless checked> Try a lossless save first</label></div>' +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-run>' + MTH.ui.icon("lock") + "Remove protection</button><span class=\"grow\"></span><span class=\"action-note\">The result is a normal PDF that opens without a password.</span></div>" +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("un-prog", "Ready") + MTH.ui.status("un-status") + "</div>" +
      "</section>" +
      '<div data-result></div>'
    );

    MTH.tool.bindDrop(stage(), { accept: ".pdf,application/pdf", onFiles: function (files) { load(files[0]); } });
    stage().querySelector("[data-change]").addEventListener("click", async function () {
      var files = await MTH.pick(".pdf,application/pdf", false);
      if (files.length) load(files[0]);
    });
    stage().querySelector("[data-eye]").addEventListener("click", function () {
      var input = stage().querySelector("[data-password]");
      input.type = input.type === "password" ? "text" : "password";
      this.innerHTML = MTH.ui.icon(input.type === "password" ? "eye" : "eye-off");
    });
    stage().querySelector("[data-quality]").addEventListener("input", function (e) {
      stage().querySelector("[data-quality-val]").textContent = e.target.value + "%";
    });
    stage().querySelector("[data-run]").addEventListener("click", run);
  }

  async function load(file) {
    if (!file) return;
    if (state.pdf) { MTH.pdf.destroy(state.pdf); state.pdf = null; }
    state.file = file; state.count = 0; state.locked = false; state.encrypted = false;
    var ws = stage().querySelector("[data-workspace]");
    ws.hidden = false;
    stage().querySelector("[data-result]").innerHTML = "";
    stage().querySelector("[data-password]").value = "";
    stage().querySelector("[data-file-name]").textContent = file.name;
    stage().querySelector("[data-file-meta]").textContent = "Checking protection…";
    MTH.status("un-status", "Opening " + file.name + "…");
    try {
      var pdf = await MTH.pdf.load(file);
      state.pdf = pdf; state.count = pdf.numPages;
      stage().querySelector("[data-file-meta]").textContent = pdf.numPages + " pages · " + MTH.fmtBytes(file.size);
      stage().querySelector("[data-password-hint]").textContent = "This file opens without a password. Protection may only restrict printing or editing.";
      MTH.status("un-status", "This PDF opens without a password. Removing permission restrictions…", "ok");
    } catch (e) {
      if (e.needsPassword) {
        state.locked = true; state.encrypted = true;
        stage().querySelector("[data-file-meta]").textContent = "Password required · " + MTH.fmtBytes(file.size);
        stage().querySelector("[data-password-hint]").textContent = "Enter the password that opens this document, then choose Remove protection.";
        MTH.status("un-status", "This PDF is protected. Enter the known password above.", "warn");
        stage().querySelector("[data-password]").focus();
      } else {
        stage().querySelector("[data-file-meta]").textContent = "Could not be opened";
        MTH.status("un-status", MTH.friendlyError(e), "err");
        MTH.reportError(e, "unlock-load");
      }
    }
    renderStats();
  }

  function renderStats() {
    stage().querySelector("[data-stats]").innerHTML =
      MTH.ui.stat("Pages", state.count || "—") +
      MTH.ui.stat("Input", MTH.fmtBytes(state.file ? state.file.size : 0)) +
      MTH.ui.stat("Protection", state.locked ? "Password" : state.pdf ? "Permission only" : "Unknown");
  }

  async function run() {
    if (state.busy || !state.file) return;
    var btn = stage().querySelector("[data-run]");
    var password = stage().querySelector("[data-password]").value;
    var dpi = +stage().querySelector("[data-dpi]").value;
    var quality = +stage().querySelector("[data-quality]").value / 100;
    var tryLossless = stage().querySelector("[data-lossless]").checked;

    state.busy = true;
    MTH.busy(btn, true); btn.dataset.busyText = "Unlocking…";
    MTH.progress("un-prog", .04, "Verifying access…");
    MTH.status("un-status", "Checking the document…");
    try {
      var pdf = state.pdf;
      if (!pdf || state.locked) {
        pdf = await MTH.pdf.load(state.file, password || undefined);
        state.pdf = pdf;
        state.count = pdf.numPages;
        state.locked = false;
      }
      var bytes = null, name = MTH.baseName(state.file.name) + "-unlocked.pdf", mode = "";

      if (tryLossless) {
        MTH.progress("un-prog", .18, "Trying a lossless save…");
        try {
          var src = await MTH.pdf.openLib(state.file);
          var out = await PDFLib.PDFDocument.create();
          var pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach(function (p) { out.addPage(p); });
          out.setProducer("MULTI TOOL HUB");
          out.setCreator("MULTI TOOL HUB · local unlock");
          bytes = await out.save({ useObjectStreams: true, addDefaultPage: false });
          mode = "lossless";
          MTH.status("un-status", "Protection removed with the original page content preserved.");
        } catch (losslessError) {
          if (!/encrypt|password/i.test(losslessError && losslessError.message || "")) throw losslessError;
          MTH.progress("un-prog", .24, "Encryption blocks a lossless save — rebuilding pages…");
          MTH.status("un-status", "The encryption blocks a lossless copy. Rebuilding the pages as high-resolution images…");
        }
      }

      if (!bytes) {
        var out2 = await PDFLib.PDFDocument.create();
        out2.setProducer("MULTI TOOL HUB");
        out2.setCreator("MULTI TOOL HUB · local unlock (raster rebuild)");
        var scale = dpi / 72;
        for (var i = 1; i <= pdf.numPages; i++) {
          MTH.status("un-status", "Rebuilding page " + i + " of " + pdf.numPages + "…");
          var page = await pdf.getPage(i);
          var rendered = await MTH.pdf.renderToCanvas(page, scale, page.rotate, { pixelRatio: 1, maxPixels: 80000000 });
          var enc = await MTH.images.encode(rendered.canvas, "image/jpeg", quality);
          var image = await out2.embedJpg(enc.bytes);
          var vp = page.getViewport({ scale: 1, rotation: page.rotate });
          var newPage = out2.addPage([vp.width, vp.height]);
          newPage.drawImage(image, { x: 0, y: 0, width: vp.width, height: vp.height });
          rendered.canvas.width = rendered.canvas.height = 0;
          MTH.progress("un-prog", .24 + (i / pdf.numPages) * .7, "Rebuilt " + i + " of " + pdf.numPages + " pages");
          await MTH.sleep(0);
        }
        bytes = await out2.save({ useObjectStreams: true, addDefaultPage: false });
        mode = "raster";
      }

      var blob = MTH.download(bytes, name, "application/pdf");
      MTH.progress("un-prog", 1, "Complete");
      MTH.status("un-status", "Unlocked copy ready · " + MTH.fmtBytes(blob.size) + (mode === "raster" ? " · rebuilt at " + dpi + " DPI." : " · original content preserved."), "ok");
      stage().querySelector("[data-result]").innerHTML = MTH.tool.resultPanel({
        title: mode === "lossless" ? "Unlocked without re-rendering" : "Unlocked copy is ready",
        meta: pdf.numPages + " pages · " + MTH.fmtBytes(blob.size) + (mode === "raster" ? " · rebuilt at " + dpi + " DPI" : " · lossless"),
        buttons: '<button class="btn btn--sm" data-download-result>' + MTH.ui.icon("download") + "Download " + MTH.esc(name) + "</button>"
      });
      stage().querySelector("[data-download-result]").addEventListener("click", function () { MTH.download(bytes, name, "application/pdf"); });
      stage().querySelector("[data-password]").value = "";
      MTH.toast("PDF unlocked", "ok");
    } catch (e) {
      MTH.progress("un-prog", null);
      if (e && e.needsPassword) {
        MTH.status("un-status", e.incorrect || password ? "That password is incorrect. Check it and try again." : "Enter the password that opens this document.", "err");
        stage().querySelector("[data-password]").focus();
      } else {
        MTH.status("un-status", MTH.friendlyError(e), "err");
        MTH.reportError(e, "unlock");
      }
    } finally {
      state.busy = false; MTH.busy(btn, false); renderStats();
    }
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
