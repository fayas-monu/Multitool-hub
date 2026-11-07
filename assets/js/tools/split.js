/* PDF Split */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;
  var state = { file: null, pdf: null, count: 0, selected: {}, mode: "extract", busy: false, output: null };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: ".pdf,application/pdf", icon: "split", title: "Drop a PDF to split", hint: "Choose one document. Nothing leaves this device.", meta: ["PDF", "Extract", "ZIP"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2 data-file-name>Document</h2><p data-file-meta></p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-change>Choose another</button></div></div>' +
      '<div class="settings" data-settings>' +
      '<div class="settings-section"><h3>How should the split work?</h3>' +
      '<div class="seg" data-modes role="group" aria-label="Split mode">' +
      '<button type="button" class="on" data-mode="extract">Extract pages</button>' +
      '<button type="button" data-mode="each">Every page</button>' +
      '<button type="button" data-mode="chunks">Fixed chunks</button>' +
      '<button type="button" data-mode="ranges">Custom ranges</button>' +
      "</div>" +
      '<div data-option="extract" style="margin-top:14px"><div class="field"><label for="split-range">Pages to extract</label><input class="input" id="split-range" data-range placeholder="For example 1-3, 5, 8-10"><div class="hint">Click thumbnails below or type a range. Selected pages become one PDF.</div></div></div>' +
      '<div data-option="chunks" style="margin-top:14px" hidden><div class="field"><label for="split-size">Pages per file</label><input class="input" id="split-size" data-chunk type="number" min="1" max="500" value="5"><div class="hint">The document is divided into consecutive files of this length.</div></div></div>' +
      '<div data-option="ranges" style="margin-top:14px" hidden><div class="field"><label for="split-ranges">Ranges, one file each</label><input class="input" id="split-ranges" data-range-groups placeholder="For example 1-3, 4, 5-10"><div class="hint">Each comma-separated group produces its own PDF inside the ZIP.</div></div></div>' +
      '<div class="notice" data-mode-note style="margin-top:12px">Select the pages you want to keep. Everything else is discarded from the new document.</div>' +
      "</div>" +
      '<div class="settings-section"><div class="panel-head" style="padding:0 0 10px;border:0;background:transparent"><div><h3 class="settings-title" style="margin:0">Page selection <span class="tag" data-selected-count>0 selected</span></h3><p class="hint">Click a page to include or exclude it. Thumbnails are generated locally.</p></div><div class="panel-actions"><button class="btn btn--sm btn--subtle" data-select-all>Select all</button><button class="btn btn--sm btn--subtle" data-select-none>Select none</button><button class="btn btn--sm btn--subtle" data-select-invert>Invert</button></div></div>' +
      '<div class="thumb-grid" data-thumbs></div>' +
      "</div>" +
      "</div>" +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-run>Split PDF</button><span class="grow"></span><span class="action-note">Output stays in this tab until you save it.</span></div>' +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("split-prog", "Ready") + MTH.ui.status("split-status") + "</div>" +
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
      state.mode = btn.dataset.mode;
      MTH.$$("[data-mode]", stage()).forEach(function (b) { b.classList.toggle("on", b === btn); });
      syncMode();
    });
    stage().querySelector("[data-thumbs]").addEventListener("click", function (e) {
      var card = e.target.closest("[data-page]");
      if (!card || !state.count) return;
      var page = +card.dataset.page;
      state.selected[page] = !state.selected[page];
      card.classList.toggle("is-selected", !!state.selected[page]);
      syncSelection();
    });
    stage().querySelector("[data-select-all]").addEventListener("click", function () { setAll(true); });
    stage().querySelector("[data-select-none]").addEventListener("click", function () { setAll(false); });
    stage().querySelector("[data-select-invert]").addEventListener("click", function () {
      for (var i = 1; i <= state.count; i++) state.selected[i] = !state.selected[i];
      paintSelection();
    });
    stage().querySelector("[data-range]").addEventListener("change", applyTypedRange);
    stage().querySelector("[data-range]").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); applyTypedRange(); }
    });
    stage().querySelector("[data-run]").addEventListener("click", split);
  }

  async function load(file) {
    if (!file) return;
    resetOutput();
    state.file = file;
    state.pdf = null;
    state.count = 0;
    state.selected = {};
    var ws = stage().querySelector("[data-workspace]");
    ws.hidden = false;
    stage().querySelector("[data-file-name]").textContent = file.name;
    stage().querySelector("[data-file-meta]").textContent = MTH.fmtBytes(file.size);
    stage().querySelector("[data-thumbs]").innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="spinner"></span><p>Opening the document…</p></div>';
    MTH.status("split-status", "Reading " + file.name + "…");
    try {
      var pdf = await MTH.pdf.load(file);
      if (state.pdf) MTH.pdf.destroy(state.pdf);
      state.pdf = pdf;
      state.count = pdf.numPages;
      for (var i = 1; i <= state.count; i++) state.selected[i] = true;
      stage().querySelector("[data-thumbs]").innerHTML = "";
      renderThumbs();
      syncSelection();
      MTH.status("split-status", state.count + " pages ready. Choose a split mode.", "ok");
    } catch (e) {
      ws.querySelector("[data-thumbs]").innerHTML = "";
      if (e.needsPassword) {
        MTH.status("split-status", "", "");
        ws.querySelector("[data-thumbs]").innerHTML = lockedNotice();
      } else {
        MTH.status("split-status", MTH.friendlyError(e), "err");
        MTH.reportError(e, "split-load");
      }
    }
  }

  function lockedNotice() {
    return '<div class="notice notice--warn" style="grid-column:1/-1">' + MTH.ui.icon("lock") +
      " <strong>This PDF is password-protected.</strong> The splitter needs an unencrypted working copy. Open <a href=\"" + MTH.esc(MTH.sitePath("tools/unlock.html")) + "\">Unlock PDF</a>, save the unlocked copy with your known password, then split that file. Nothing is guessed or uploaded.</div>";
  }

  function renderThumbs() {
    var host = stage().querySelector("[data-thumbs]");
    host.innerHTML = "";
    var fragment = document.createDocumentFragment();
    for (var i = 1; i <= state.count; i++) {
      var card = MTH.el("div", { class: "thumb-card is-selected", dataset: { page: String(i) }, role: "button", tabindex: "0", "aria-label": "Page " + i });
      card.innerHTML = '<div class="thumb-canvas"><canvas data-canvas="' + i + '"></canvas></div><div class="thumb-label"><span>Page ' + i + '</span><span data-state>Keep</span></div>';
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
  }

  function setAll(value) {
    for (var i = 1; i <= state.count; i++) state.selected[i] = value;
    paintSelection();
  }

  function paintSelection() {
    MTH.$$("[data-page]", stage()).forEach(function (card) {
      var page = +card.dataset.page;
      card.classList.toggle("is-selected", !!state.selected[page]);
    });
    syncSelection();
  }

  function selectedIndices() {
    var out = [];
    for (var i = 1; i <= state.count; i++) if (state.selected[i]) out.push(i - 1);
    return out;
  }

  function syncSelection() {
    var list = selectedIndices();
    var text = MTH.rangesText(list);
    var range = stage() && stage().querySelector("[data-range]");
    if (range && document.activeElement !== range) range.value = state.mode === "extract" ? text : range.value;
    MTH.$$("[data-state]", stage()).forEach(function (el) {
      var page = +el.closest("[data-page]").dataset.page;
      el.textContent = state.selected[page] ? "Keep" : "Skip";
    });
    var count = stage() && stage().querySelector("[data-selected-count]");
    if (count) count.textContent = list.length + " of " + state.count + " selected";
    var stats = stage() && stage().querySelector("[data-stats]");
    if (stats) {
      stats.innerHTML = MTH.ui.stat("Pages in file", state.count || "—") +
        MTH.ui.stat("Pages selected", list.length) +
        MTH.ui.stat("Input size", state.file ? MTH.fmtBytes(state.file.size) : "—");
    }
    var run = stage() && stage().querySelector("[data-run]");
    if (run) run.disabled = state.busy || !state.count || (state.mode === "extract" && !list.length);
  }

  function applyTypedRange() {
    var input = stage().querySelector("[data-range]");
    try {
      var list = MTH.ranges(input.value, state.count);
      state.selected = {};
      list.forEach(function (i) { state.selected[i + 1] = true; });
      paintSelection();
      MTH.status("split-status", list.length + " page" + (list.length === 1 ? "" : "s") + " selected.", "ok");
    } catch (e) {
      MTH.status("split-status", e.message, "err");
    }
  }

  function syncMode() {
    MTH.$$("[data-option]", stage()).forEach(function (el) {
      el.hidden = el.dataset.option !== state.mode;
    });
    var note = stage().querySelector("[data-mode-note]");
    var selBlock = stage().querySelector("[data-selected-count]").closest(".settings-section");
    var notes = {
      extract: "Select the pages you want to keep. Everything else is discarded from the new document.",
      each: "Every page becomes its own PDF. All files are bundled in one ZIP archive.",
      chunks: "The document is divided into consecutive files of the length you choose, bundled in one ZIP archive.",
      ranges: "Each comma-separated range becomes its own PDF. The set is bundled in one ZIP archive."
    };
    note.textContent = notes[state.mode] || "";
    selBlock.style.opacity = state.mode === "extract" || state.mode === "each" ? "1" : ".55";
    selBlock.style.pointerEvents = state.mode === "extract" || state.mode === "each" ? "" : "none";
    if (state.mode === "extract") {
      var range = stage().querySelector("[data-range]");
      if (range) range.value = MTH.rangesText(selectedIndices());
    }
    syncSelection();
  }

  function resetOutput() {
    state.output = null;
    var host = stage() && stage().querySelector("[data-result]");
    if (host) host.innerHTML = "";
  }

  async function split() {
    if (state.busy || !state.pdf || !state.file) return;
    var btn = stage().querySelector("[data-run]");
    var groups = [];
    var base = MTH.baseName(state.file.name);
    var pad = String(state.count).length;
    try {
      if (state.mode === "extract") {
        var selected = selectedIndices();
        if (!selected.length) throw new Error("Select at least one page to extract.");
        groups.push({ indices: selected, name: base + "-extracted.pdf", label: selected.length + " selected page" + (selected.length === 1 ? "" : "s") });
      } else if (state.mode === "each") {
        for (var i = 0; i < state.count; i++) {
          groups.push({ indices: [i], name: base + "-page-" + String(i + 1).padStart(pad, "0") + ".pdf", label: "Page " + (i + 1) });
        }
      } else if (state.mode === "chunks") {
        var size = Math.max(1, Math.min(state.count, parseInt(stage().querySelector("[data-chunk]").value, 10) || 5));
        for (var start = 0; start < state.count; start += size) {
          var end = Math.min(state.count, start + size);
          var indices = [];
          for (var p = start; p < end; p++) indices.push(p);
          groups.push({ indices: indices, name: base + "-pages-" + String(start + 1).padStart(pad, "0") + "-" + String(end).padStart(pad, "0") + ".pdf", label: "Pages " + (start + 1) + "–" + end });
        }
      } else {
        var text = stage().querySelector("[data-range-groups]").value;
        var parts = String(text || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
        if (!parts.length) throw new Error("Enter at least one range, for example 1-3, 4, 5-10.");
        parts.forEach(function (part, i) {
          var idx = MTH.ranges(part, state.count);
          groups.push({ indices: idx, name: base + "-range-" + String(i + 1).padStart(2, "0") + ".pdf", label: MTH.rangesText(idx) });
        });
      }
    } catch (e) {
      MTH.status("split-status", e.message, "err");
      return;
    }

    state.busy = true;
    MTH.busy(btn, true);
    btn.dataset.busyText = "Splitting…";
    resetOutput();
    MTH.progress("split-prog", 0, "Reading the source document…");
    try {
      var src = await MTH.pdf.openLib(state.file);
      var files = [];
      for (var g = 0; g < groups.length; g++) {
        var group = groups[g];
        MTH.status("split-status", "Building " + group.name + "…");
        var out = await PDFLib.PDFDocument.create();
        var copied = await out.copyPages(src, group.indices);
        copied.forEach(function (page) { out.addPage(page); });
        out.setProducer("MULTI TOOL HUB");
        out.setCreator("MULTI TOOL HUB · local browser split");
        var bytes = await out.save({ useObjectStreams: true, addDefaultPage: false });
        files.push({ name: group.name, data: bytes });
        MTH.progress("split-prog", (g + 1) / groups.length, "Built " + (g + 1) + " of " + groups.length + " files");
        await MTH.sleep(0);
      }
      var outputBlob, outputName;
      if (files.length === 1) {
        outputBlob = new Blob([files[0].data], { type: "application/pdf" });
        outputName = files[0].name;
      } else {
        MTH.status("split-status", "Compressing " + files.length + " files into one ZIP…");
        outputBlob = await MTH.zipBlob(files, function (p) { MTH.progress("split-prog", .85 + p * .15, "ZIP " + Math.round(p * 100) + "%"); });
        outputName = base + "-split.zip";
      }
      state.output = { blob: outputBlob, name: outputName };
      MTH.progress("split-prog", 1, "Complete");
      MTH.download(outputBlob, outputName, files.length === 1 ? "application/pdf" : "application/zip");
      MTH.status("split-status", "Ready: " + files.length + " file" + (files.length === 1 ? "" : "s") + " · " + MTH.fmtBytes(outputBlob.size) + ".", "ok");
      stage().querySelector("[data-result]").innerHTML = MTH.tool.resultPanel({
        title: files.length === 1 ? "Your split PDF is ready" : files.length + " split files are ready",
        meta: groups.map(function (x) { return x.label; }).slice(0, 4).join(" · ") + (groups.length > 4 ? " …" : "") + " · " + MTH.fmtBytes(outputBlob.size),
        buttons: '<button class="btn btn--sm" data-download-result>' + MTH.ui.icon("download") + "Download " + MTH.esc(outputName) + "</button>"
      });
      stage().querySelector("[data-download-result]").addEventListener("click", function () {
        if (state.output) MTH.download(state.output.blob, state.output.name, files.length === 1 ? "application/pdf" : "application/zip");
      });
      MTH.toast(files.length + " file" + (files.length === 1 ? "" : "s") + " created", "ok");
    } catch (e) {
      MTH.progress("split-prog", null);
      MTH.status("split-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "split");
    } finally {
      state.busy = false;
      MTH.busy(btn, false);
      syncSelection();
    }
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
