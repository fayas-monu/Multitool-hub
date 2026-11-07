/* PDF Merge */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;
  var state = { docs: [], busy: false };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: ".pdf,application/pdf", multiple: true, icon: "merge", title: "Drop PDF files here", hint: "Select two or more PDFs. They will be combined in the order shown below.", meta: ["PDF", "Multiple files", "Local only"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2>Documents in this merge</h2><p>Use the arrows to change the order. The first file is placed first.</p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-add>Add files</button><button class="btn btn--sm btn--subtle" data-clear>Clear</button></div></div>' +
      '<div class="panel-body panel-body--flush" data-list></div>' +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-merge>Merge PDF</button><span class="grow"></span><span class="action-note">Everything is assembled in this tab.</span></div>' +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("merge-prog", "Ready") + MTH.ui.status("merge-status") + "</div>" +
      "</section>" +
      '<div data-result></div>'
    );
    MTH.tool.bindDrop(stage(), { accept: ".pdf,application/pdf", multiple: true, onFiles: addFiles });
    stage().querySelector("[data-add]").addEventListener("click", async function () {
      var files = await MTH.pick(".pdf,application/pdf", true);
      if (files.length) addFiles(files);
    });
    stage().querySelector("[data-clear]").addEventListener("click", function () {
      state.docs = []; render();
    });
    stage().querySelector("[data-list]").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn) return;
      var row = btn.closest("[data-file-index]");
      if (!row) return;
      var i = +row.dataset.fileIndex, act = btn.dataset.act;
      if (act === "remove") state.docs.splice(i, 1);
      if (act === "up" && i > 0) state.docs.splice(i - 1, 0, state.docs.splice(i, 1)[0]);
      if (act === "down" && i < state.docs.length - 1) state.docs.splice(i + 1, 0, state.docs.splice(i, 1)[0]);
      render();
    });
    stage().querySelector("[data-merge]").addEventListener("click", merge);
  }

  async function addFiles(files) {
    if (!files || !files.length) return;
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var doc = { file: file, pages: null, error: null };
      state.docs.push(doc);
    }
    render();
    for (var j = 0; j < state.docs.length; j++) {
      var item = state.docs[j];
      if (item.pages != null || item.error) continue;
      try {
        var pdf = await MTH.pdf.load(item.file);
        item.pages = pdf.numPages;
        MTH.pdf.destroy(pdf);
      } catch (e) {
        item.error = e.needsPassword ? "Locked" : "Unreadable";
      }
      render();
    }
  }

  function render() {
    var ws = stage().querySelector("[data-workspace]");
    var list = stage().querySelector("[data-list]");
    var stats = stage().querySelector("[data-stats]");
    if (!state.docs.length) { ws.hidden = true; return; }
    ws.hidden = false;
    list.innerHTML = '<ul class="file-list" style="padding:12px 16px">' + state.docs.map(function (doc, i) {
      var meta = doc.error ? doc.error : doc.pages == null ? "Reading…" : doc.pages + " page" + (doc.pages === 1 ? "" : "s") + " · " + MTH.fmtBytes(doc.file.size);
      return '<li class="file-row" data-file-index="' + i + '"><span class="file-num">' + (i + 1 < 10 ? "0" : "") + (i + 1) + "</span>" +
        '<span class="file-ic">' + MTH.ui.icon("pdf") + "</span>" +
        '<span class="file-main"><span class="file-name" title="' + MTH.esc(doc.file.name) + '">' + MTH.esc(doc.file.name) + "</span><span class=\"file-meta\">" + MTH.esc(meta) + "</span></span>" +
        '<span class="file-actions"><button type="button" data-act="up" aria-label="Move up"' + (i === 0 ? " disabled" : "") + ">" + MTH.ui.icon("up") + "</button>" +
        '<button type="button" data-act="down" aria-label="Move down"' + (i === state.docs.length - 1 ? " disabled" : "") + ">" + MTH.ui.icon("down") + "</button>" +
        '<button type="button" data-act="remove" aria-label="Remove">' + MTH.ui.icon("trash") + "</button></span></li>";
    }).join("") + "</ul>";
    var totalPages = state.docs.reduce(function (a, d) { return a + (d.pages || 0); }, 0);
    var totalSize = state.docs.reduce(function (a, d) { return a + d.file.size; }, 0);
    stats.innerHTML = MTH.ui.stat("Files", state.docs.length) + MTH.ui.stat("Pages", totalPages || "—") + MTH.ui.stat("Input size", MTH.fmtBytes(totalSize));
    stage().querySelector("[data-merge]").disabled = state.docs.length === 0 || state.busy;
  }

  async function merge() {
    if (state.busy || !state.docs.length) return;
    var btn = stage().querySelector("[data-merge]");
    state.busy = true; MTH.busy(btn, true); btn.dataset.busyText = "Merging…";
    MTH.progress("merge-prog", 0, "Reading documents…");
    MTH.status("merge-status", "Opening the first document…");
    try {
      var out = await PDFLib.PDFDocument.create();
      var totalBytes = 0;
      for (var i = 0; i < state.docs.length; i++) {
        var doc = state.docs[i];
        MTH.status("merge-status", "Adding " + doc.file.name + "…");
        var src = await MTH.pdf.openLib(doc.file);
        var indices = src.getPageIndices();
        var pages = await out.copyPages(src, indices);
        pages.forEach(function (p) { out.addPage(p); });
        totalBytes += doc.file.size;
        MTH.progress("merge-prog", (i + 1) / state.docs.length, "Merged " + (i + 1) + " of " + state.docs.length + " files");
        await MTH.sleep(0);
      }
      out.setProducer("MULTI TOOL HUB");
      out.setCreator("MULTI TOOL HUB · local browser merge");
      MTH.status("merge-status", "Writing the combined PDF…");
      var bytes = await out.save({ useObjectStreams: true, addDefaultPage: false });
      var name = "merged-" + new Date().toISOString().slice(0, 10) + ".pdf";
      var blob = MTH.download(bytes, name, "application/pdf");
      MTH.progress("merge-prog", 1, "Complete");
      MTH.status("merge-status", "Merged " + out.getPageCount() + " pages into " + name + " (" + MTH.fmtBytes(blob.size) + ").", "ok");
      stage().querySelector("[data-result]").innerHTML = MTH.tool.resultPanel({
        title: "Merged PDF is ready",
        meta: state.docs.length + " files · " + out.getPageCount() + " pages · " + MTH.fmtBytes(blob.size) + " (input " + MTH.fmtBytes(totalBytes) + ")",
        buttons: '<button class="btn btn--sm" data-download-result>' + MTH.ui.icon("download") + "Download " + MTH.esc(name) + "</button>"
      });
      stage().querySelector("[data-download-result]").addEventListener("click", function () { MTH.download(bytes, name, "application/pdf"); });
      MTH.toast("PDF merged", "ok");
    } catch (e) {
      MTH.progress("merge-prog", null);
      MTH.status("merge-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "merge");
    } finally {
      state.busy = false; MTH.busy(btn, false); render();
    }
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
