/* PDF to Text */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var state = { file: null, pdf: null, count: 0, busy: false, text: "", pages: [] };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: ".pdf,application/pdf", icon: "text", title: "Drop a PDF to extract its text", hint: "Uses the document\'s real text layer — no OCR and no uploads.", meta: ["PDF", "TXT", "Text layer"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2 data-file-name>Document</h2><p data-file-meta></p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-change>Choose another</button></div></div>' +
      '<div class="settings">' +
      '<div class="settings-section">' +
      '<h3>Extraction settings</h3>' +
      '<div class="settings-grid settings-grid--3">' +
      '<div class="field"><label for="pt-pages">Pages</label><input class="input" id="pt-pages" data-pages placeholder="Blank means all pages"></div>' +
      '<div class="field"><label for="pt-style">Structure</label><select class="select" id="pt-style" data-style><option value="plain">Plain text</option><option value="markdown">Markdown-style headings</option></select></div>' +
      '<div class="field"><label for="pt-order">Reading order</label><select class="select" id="pt-order" data-order><option value="auto">Detect lines automatically</option><option value="raw">Strict top-to-bottom</option></select></div>' +
      "</div>" +
      '<div class="settings-grid settings-grid--3" style="margin-top:4px">' +
      '<label class="check"><input type="checkbox" data-page-labels checked> Add page labels</label>' +
      '<label class="check"><input type="checkbox" data-page-breaks checked> Keep page breaks</label>' +
      '<label class="check"><input type="checkbox" data-bullets checked> Recognise bullets</label>' +
      "</div>" +
      '<div class="notice">' + MTH.ui.icon("info") + " This tool reads embedded text. If the PDF is a scan, the page has no text layer; open PDF to Images and use your system\'s OCR instead.</div>" +
      "</div>" +
      "</div>" +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-run>' + MTH.ui.icon("text") + "Extract text</button><span class=\"grow\"></span><span class=\"action-note\">Text is reconstructed from the PDF\'s own glyph positions.</span></div>" +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("pt-prog", "Ready") + MTH.ui.status("pt-status") + "</div>" +
      '<div class="panel-body" data-preview-wrap hidden style="border-top:1px solid var(--line)">' +
      '<div class="settings-title"><h3>Extracted text <span class="tag" data-preview-tag>0 words</span></h3><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-copy>' + MTH.ui.icon("copy") + "Copy</button><button class=\"btn btn--sm\" data-save>" + MTH.ui.icon("download") + "Save .txt</button></div></div>" +
      '<pre class="text-output" data-output tabindex="0" aria-label="Extracted text"></pre>' +
      "</div>" +
      "</section>" +
      '<div data-result></div>'
    );

    MTH.tool.bindDrop(stage(), { accept: ".pdf,application/pdf", onFiles: function (files) { load(files[0]); } });
    stage().querySelector("[data-change]").addEventListener("click", async function () {
      var files = await MTH.pick(".pdf,application/pdf", false);
      if (files.length) load(files[0]);
    });
    stage().querySelector("[data-run]").addEventListener("click", extract);
    stage().querySelector("[data-copy]").addEventListener("click", function () {
      if (state.text) MTH.copy(state.text, "Extracted text copied");
    });
    stage().querySelector("[data-save]").addEventListener("click", save);
    stage().querySelector("[data-style]").addEventListener("change", function () { if (state.pages.length) rebuildText(); });
    stage().querySelector("[data-order]").addEventListener("change", function () { if (state.pages.length) extract(); });
    MTH.$$("[data-page-labels],[data-page-breaks],[data-bullets]", stage()).forEach(function (el) {
      el.addEventListener("change", function () { if (state.pages.length) rebuildText(); });
    });
  }

  async function load(file) {
    if (!file) return;
    if (state.pdf) { MTH.pdf.destroy(state.pdf); state.pdf = null; }
    state.file = file; state.count = 0; state.pages = []; state.text = "";
    var ws = stage().querySelector("[data-workspace]");
    ws.hidden = false;
    stage().querySelector("[data-result]").innerHTML = "";
    stage().querySelector("[data-preview-wrap]").hidden = true;
    stage().querySelector("[data-file-name]").textContent = file.name;
    stage().querySelector("[data-file-meta]").textContent = "Opening document…";
    MTH.status("pt-status", "Opening " + file.name + "…");
    try {
      var pdf = await MTH.pdf.openWithPrompt(file);
      state.pdf = pdf; state.count = pdf.numPages;
      stage().querySelector("[data-file-meta]").textContent = pdf.numPages + " pages · " + MTH.fmtBytes(file.size);
      stage().querySelector("[data-stats]").innerHTML =
        MTH.ui.stat("Pages", pdf.numPages) +
        MTH.ui.stat("Input", MTH.fmtBytes(file.size)) +
        MTH.ui.stat("Output", "Plain text");
      MTH.status("pt-status", pdf.numPages + " pages ready. Choose a range, then extract.", "ok");
      extract();
    } catch (e) {
      if (e.cancelled) { MTH.status("pt-status", "Extraction cancelled."); return; }
      stage().querySelector("[data-file-meta]").textContent = "Could not be opened";
      MTH.status("pt-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "pdf-to-text-load");
    }
  }

  async function extract() {
    if (state.busy || !state.pdf) return;
    var btn = stage().querySelector("[data-run]");
    var text = (stage().querySelector("[data-pages]").value || "").trim();
    var indices;
    try {
      indices = text ? MTH.ranges(text, state.count) : Array.from({ length: state.count }, function (_, i) { return i; });
    } catch (e) { MTH.status("pt-status", e.message, "err"); MTH.toast(e.message, "err"); return; }

    state.busy = true; state.pages = []; state.text = "";
    MTH.busy(btn, true); btn.dataset.busyText = "Extracting…";
    MTH.progress("pt-prog", 0, "Reading page 1 of " + indices.length);
    MTH.status("pt-status", "Reading the text layer…");
    try {
      for (var k = 0; k < indices.length; k++) {
        var pn = indices[k] + 1;
        var page = await state.pdf.getPage(pn);
        var data = await MTH.tool.pageLines(page, { exact: stage().querySelector("[data-order]").value === "raw" });
        data.pageNumber = pn;
        data.raw = data.lines.map(function (l) { return l.text; }).join("\n");
        state.pages.push(data);
        MTH.progress("pt-prog", (k + 1) / indices.length, "Extracted " + (k + 1) + " of " + indices.length + " pages");
        await MTH.sleep(0);
      }
      rebuildText();
      var empty = !state.text;
      if (empty) {
        MTH.status("pt-status", "No embedded text was found. This PDF is probably a scan or uses outlined glyphs.", "warn");
        stage().querySelector("[data-preview-wrap]").hidden = true;
      } else {
        MTH.progress("pt-prog", 1, "Complete");
        MTH.status("pt-status", "Extracted " + state.pages.length + " pages · " + countWords(state.text) + " words.", "ok");
        stage().querySelector("[data-preview-wrap]").hidden = false;
        MTH.toast("Text extracted", "ok");
      }
    } catch (e) {
      MTH.progress("pt-prog", null);
      MTH.status("pt-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "pdf-to-text");
    } finally {
      state.busy = false; MTH.busy(btn, false);
    }
  }

  function rebuildText() {
    var opts = {
      markdown: stage().querySelector("[data-style]").value === "markdown",
      pageLabels: stage().querySelector("[data-page-labels]").checked,
      pageBreaks: stage().querySelector("[data-page-breaks]").checked,
      bullets: stage().querySelector("[data-bullets]").checked,
      raw: stage().querySelector("[data-order]").value === "raw"
    };
    state.text = MTH.tool.linesToText(state.pages, opts);
    var out = stage().querySelector("[data-output]");
    out.textContent = state.text || "No embedded text was found in the selected pages.";
    stage().querySelector("[data-preview-tag]").textContent = countWords(state.text) + " words · " + state.text.length.toLocaleString() + " characters";
    stage().querySelector("[data-stats]").innerHTML =
      MTH.ui.stat("Pages read", state.pages.length) +
      MTH.ui.stat("Words", countWords(state.text).toLocaleString()) +
      MTH.ui.stat("Characters", state.text.length.toLocaleString());
  }

  function countWords(text) {
    var m = String(text || "").match(/\S+/g);
    return m ? m.length : 0;
  }

  function save() {
    if (!state.text) { MTH.status("pt-status", "Extract some text before saving.", "warn"); return; }
    var name = MTH.baseName(state.file ? state.file.name : "document") + ".txt";
    MTH.download(new Blob([state.text], { type: "text/plain;charset=utf-8" }), name, "text/plain;charset=utf-8");
    MTH.status("pt-status", "Saved " + name + " · " + MTH.fmtBytes(new Blob([state.text]).size) + ".", "ok");
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
