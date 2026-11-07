/* PDF Rotate */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;
  var state = { file: null, pdf: null, count: 0, selected: {}, rotations: {}, busy: false, output: null };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: ".pdf,application/pdf", icon: "rotate", title: "Drop a PDF to rotate", hint: "Turn a single page, a selection or the entire document.", meta: ["PDF", "90° steps", "Lossless"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2 data-file-name>Document</h2><p data-file-meta></p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-change>Choose another</button></div></div>' +
      '<div class="settings">' +
      '<div class="settings-section"><h3>Page selection <span class="tag" data-selected-count>0 selected</span></h3>' +
      '<div class="row" style="margin-bottom:10px"><button class="btn btn--sm btn--subtle" data-select-all>Select all</button><button class="btn btn--sm btn--subtle" data-select-none>Select none</button><button class="btn btn--sm btn--subtle" data-select-invert>Invert</button></div>' +
      '<div class="thumb-grid" data-thumbs></div>' +
      "</div>" +
      '<div class="settings-section"><h3>Rotation</h3><div class="row"><button class="btn btn--sm btn--ghost" data-rot="-90">' + MTH.ui.icon("undo") + " 90° left</button>" +
      '<button class="btn btn--sm btn--ghost" data-rot="90">' + MTH.ui.icon("redo") + " 90° right</button>" +
      '<button class="btn btn--sm btn--ghost" data-rot="180">' + MTH.ui.icon("rotate") + " 180°</button>" +
      '<button class="btn btn--sm btn--subtle" data-reset>Reset rotation</button></div>' +
      '<p class="hint" style="margin-top:9px">Each click turns the selected pages. The pages are not re-rendered, so text stays sharp and the file stays small.</p></div>' +
      "</div>" +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-run>Apply &amp; save PDF</button><span class="grow"></span><span class="action-note">Original page content is never modified.</span></div>' +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("rotate-prog", "Ready") + MTH.ui.status("rotate-status") + "</div>" +
      "</section>" +
      '<div data-result></div>'
    );
    MTH.tool.bindDrop(stage(), { accept: ".pdf,application/pdf", onFiles: function (files) { load(files[0]); } });
    stage().querySelector("[data-change]").addEventListener("click", async function () {
      var files = await MTH.pick(".pdf,application/pdf", false);
      if (files.length) load(files[0]);
    });
    stage().querySelector("[data-thumbs]").addEventListener("click", function (e) {
      var card = e.target.closest("[data-page]");
      if (!card) return;
      var page = +card.dataset.page;
      state.selected[page] = !state.selected[page];
      paintSelection();
    });
    stage().querySelector("[data-select-all]").addEventListener("click", function () { setAll(true); });
    stage().querySelector("[data-select-none]").addEventListener("click", function () { setAll(false); });
    stage().querySelector("[data-select-invert]").addEventListener("click", function () {
      for (var i = 1; i <= state.count; i++) state.selected[i] = !state.selected[i];
      paintSelection();
    });
    MTH.$$("[data-rot]", stage()).forEach(function (btn) {
      btn.addEventListener("click", function () { turn(parseInt(btn.dataset.rot, 10)); });
    });
    stage().querySelector("[data-reset]").addEventListener("click", function () {
      for (var i = 1; i <= state.count; i++) if (state.selected[i]) state.rotations[i] = 0;
      paintRotationBadges();
      MTH.status("rotate-status", "Rotation reset on the selected pages.", "info");
    });
    stage().querySelector("[data-run]").addEventListener("click", save);
  }

  async function load(file) {
    if (!file) return;
    resetOutput();
    state.file = file;
    if (state.pdf) { MTH.pdf.destroy(state.pdf); state.pdf = null; }
    state.count = 0; state.selected = {}; state.rotations = {};
    var ws = stage().querySelector("[data-workspace]");
    ws.hidden = false;
    stage().querySelector("[data-file-name]").textContent = file.name;
    stage().querySelector("[data-file-meta]").textContent = MTH.fmtBytes(file.size);
    stage().querySelector("[data-thumbs]").innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="spinner"></span><p>Opening the document…</p></div>';
    MTH.status("rotate-status", "Reading " + file.name + "…");
    try {
      var pdf = await MTH.pdf.load(file);
      state.pdf = pdf;
      state.count = pdf.numPages;
      for (var i = 1; i <= state.count; i++) { state.selected[i] = true; state.rotations[i] = 0; }
      renderThumbs();
      MTH.status("rotate-status", state.count + " pages ready. Pick pages, then rotate them.", "ok");
    } catch (e) {
      if (e.needsPassword) {
        stage().querySelector("[data-thumbs]").innerHTML = '<div class="notice notice--warn" style="grid-column:1/-1">' + MTH.ui.icon("lock") +
          " <strong>Password-protected PDF.</strong> Rotating writes a new PDF, so make an unencrypted copy first with <a href=\"" + MTH.esc(MTH.sitePath("tools/unlock.html")) + "\">Unlock PDF</a> using the password you already know.</div>";
        MTH.status("rotate-status", "", "");
      } else {
        MTH.status("rotate-status", MTH.friendlyError(e), "err");
        MTH.reportError(e, "rotate-load");
      }
    }
  }

  function renderThumbs() {
    var host = stage().querySelector("[data-thumbs]");
    host.innerHTML = "";
    var fragment = document.createDocumentFragment();
    for (var i = 1; i <= state.count; i++) {
      var card = MTH.el("div", { class: "thumb-card is-selected", dataset: { page: String(i) }, role: "button", tabindex: "0", "aria-label": "Page " + i });
      card.innerHTML = '<div class="thumb-canvas"><canvas data-canvas="' + i + '"></canvas></div><span class="thumb-rot" data-rot-badge hidden>0°</span><div class="thumb-label"><span>Page ' + i + '</span><span data-state>Keep</span></div>';
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.click(); }
      });
      fragment.appendChild(card);
    }
    host.appendChild(fragment);
    MTH.tool.thumbAll(state.pdf, host, {
      maxWidth: 170,
      concurrency: 3,
      render: async function (n) {
        var canvas = host.querySelector('canvas[data-canvas="' + n + '"]');
        if (!canvas) return;
        await MTH.tool.thumb(state.pdf, n, canvas, 170);
      },
      onPageError: function (e, n) {
        var card = host.querySelector('[data-page="' + n + '"]');
        if (card) card.querySelector(".thumb-canvas").innerHTML = '<span class="tiny" style="padding:8px;text-align:center">Preview unavailable</span>';
      }
    });
    paintSelection();
  }

  function setAll(value) {
    for (var i = 1; i <= state.count; i++) state.selected[i] = value;
    paintSelection();
  }

  function paintSelection() {
    var count = 0;
    MTH.$$("[data-page]", stage()).forEach(function (card) {
      var page = +card.dataset.page;
      var on = !!state.selected[page];
      if (on) count++;
      card.classList.toggle("is-selected", on);
      card.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var counter = stage().querySelector("[data-selected-count]");
    if (counter) counter.textContent = count + " of " + state.count + " selected";
    var stats = stage().querySelector("[data-stats]");
    if (stats) {
      var turned = 0;
      for (var k in state.rotations) if (state.rotations[k]) turned++;
      stats.innerHTML = MTH.ui.stat("Pages", state.count || "—") + MTH.ui.stat("Selected", count) + MTH.ui.stat("Pages turned", turned) + MTH.ui.stat("Input size", state.file ? MTH.fmtBytes(state.file.size) : "—");
    }
    var run = stage().querySelector("[data-run]");
    if (run) run.disabled = state.busy || !state.count || !count;
    paintRotationBadges();
  }

  function paintRotationBadges() {
    MTH.$$("[data-page]", stage()).forEach(function (card) {
      var page = +card.dataset.page;
      var deg = ((state.rotations[page] || 0) % 360 + 360) % 360;
      var badge = card.querySelector("[data-rot-badge]");
      if (badge) {
        badge.hidden = !deg;
        badge.textContent = (deg > 180 ? deg - 360 : deg) + "°";
      }
      var stateLabel = card.querySelector("[data-state]");
      if (stateLabel) stateLabel.textContent = state.selected[page] ? (deg ? "Turned " + deg + "°" : "Keep") : "Skip";
    });
  }

  function turn(delta) {
    var any = false;
    for (var i = 1; i <= state.count; i++) {
      if (!state.selected[i]) continue;
      state.rotations[i] = (((state.rotations[i] || 0) + delta) % 360 + 360) % 360;
      any = true;
    }
    if (!any) { MTH.status("rotate-status", "Select at least one page first.", "warn"); return; }
    paintSelection();
    MTH.status("rotate-status", "Rotation updated. Save the PDF when you are happy with it.", "info");
  }

  function resetOutput() {
    state.output = null;
    var host = stage() && stage().querySelector("[data-result]");
    if (host) host.innerHTML = "";
  }

  async function save() {
    if (state.busy || !state.file) return;
    var btn = stage().querySelector("[data-run]");
    state.busy = true;
    btn.dataset.busyText = "Writing…";
    MTH.busy(btn, true);
    resetOutput();
    MTH.progress("rotate-prog", 0, "Opening the document…");
    try {
      var src = await MTH.pdf.openLib(state.file);
      var pages = src.getPages();
      for (var i = 0; i < pages.length; i++) {
        var extra = state.rotations[i + 1] || 0;
        if (!extra) continue;
        var current = pages[i].getRotation().angle || 0;
        pages[i].setRotation(PDFLib.degrees(((current + extra) % 360 + 360) % 360));
      }
      src.setProducer("MULTI TOOL HUB");
      src.setCreator("MULTI TOOL HUB · local browser rotate");
      MTH.status("rotate-status", "Writing the rotated PDF…");
      var bytes = await src.save({ useObjectStreams: true, addDefaultPage: false });
      var name = MTH.baseName(state.file.name) + "-rotated.pdf";
      var blob = new Blob([bytes], { type: "application/pdf" });
      state.output = { blob: blob, name: name };
      MTH.progress("rotate-prog", 1, "Complete");
      MTH.download(blob, name, "application/pdf");
      MTH.status("rotate-status", "Ready: " + name + " · " + MTH.fmtBytes(blob.size) + ".", "ok");
      stage().querySelector("[data-result]").innerHTML = MTH.tool.resultPanel({
        title: "Rotated PDF is ready",
        meta: pages.length + " pages · " + MTH.fmtBytes(blob.size) + " · downloaded automatically",
        buttons: '<button class="btn btn--sm" data-download-result>' + MTH.ui.icon("download") + "Download again</button>"
      });
      stage().querySelector("[data-download-result]").addEventListener("click", function () {
        if (state.output) MTH.download(state.output.blob, state.output.name, "application/pdf");
      });
      MTH.toast("PDF rotated", "ok");
    } catch (e) {
      MTH.progress("rotate-prog", null);
      MTH.status("rotate-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "rotate");
    } finally {
      state.busy = false;
      MTH.busy(btn, false);
      paintSelection();
    }
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
