/* PDF to Word */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var state = { file: null, pdf: null, count: 0, busy: false, pages: [], preview: "" };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: ".pdf,application/pdf", icon: "word", title: "Drop a PDF to convert to Word", hint: "Builds a real .docx with headings, bullets and page breaks. No upload.", meta: ["PDF", "DOCX", "Text layer"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2 data-file-name>Document</h2><p data-file-meta></p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-change>Choose another</button></div></div>' +
      '<div class="settings">' +
      '<div class="settings-section">' +
      '<h3>Document structure</h3>' +
      '<div class="settings-grid">' +
      '<div class="field"><label for="pw-pages">Pages</label><input class="input" id="pw-pages" data-pages placeholder="Blank means all pages"></div>' +
      '<div class="field"><label for="pw-theme">Word theme</label><select class="select" id="pw-theme" data-theme><option value="editorial">Editorial — serif, generous</option><option value="modern">Modern — clean sans</option><option value="compact">Compact — tighter spacing</option></select></div>' +
      "</div>" +
      '<div class="settings-grid" style="margin-top:4px">' +
      '<label class="check"><input type="checkbox" data-headings checked> Detect headings from font size</label>' +
      '<label class="check"><input type="checkbox" data-page-breaks checked> Keep original page breaks</label>' +
      "</div>" +
      '<div class="notice">' + MTH.ui.icon("info") + " The result is a genuine Word document built from the PDF text layer. Complex tables and multi-column magazine layouts may need a little tidying in Word.</div>" +
      "</div>" +
      "</div>" +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-run>' + MTH.ui.icon("word") + "Build Word document</button><span class=\"grow\"></span><span class=\"action-note\">Your PDF is read page by page, then a .docx is written locally.</span></div>" +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("pw-prog", "Ready") + MTH.ui.status("pw-status") + "</div>" +
      '<div class="panel-body" data-preview-wrap hidden style="border-top:1px solid var(--line)">' +
      '<div class="settings-title"><h3>Extracted outline <span class="tag" data-preview-tag>0 words</span></h3><span class="hint">A quick reading of the structure Word will receive.</span></div>' +
      '<pre class="text-output" data-output tabindex="0" aria-label="Extracted outline"></pre>' +
      "</div>" +
      "</section>" +
      '<div data-result></div>'
    );

    MTH.tool.bindDrop(stage(), { accept: ".pdf,application/pdf", onFiles: function (files) { load(files[0]); } });
    stage().querySelector("[data-change]").addEventListener("click", async function () {
      var files = await MTH.pick(".pdf,application/pdf", false);
      if (files.length) load(files[0]);
    });
    stage().querySelector("[data-run]").addEventListener("click", run);
    stage().querySelector("[data-pages]").addEventListener("change", function () { if (state.pdf) extract(); });
    MTH.$$("[data-headings],[data-page-breaks]", stage()).forEach(function (el) {
      el.addEventListener("change", function () { if (state.pages.length) buildPreview(); });
    });
  }

  async function load(file) {
    if (!file) return;
    if (state.pdf) { MTH.pdf.destroy(state.pdf); state.pdf = null; }
    state.file = file; state.count = 0; state.pages = []; state.preview = "";
    var ws = stage().querySelector("[data-workspace]");
    ws.hidden = false;
    stage().querySelector("[data-result]").innerHTML = "";
    stage().querySelector("[data-preview-wrap]").hidden = true;
    stage().querySelector("[data-file-name]").textContent = file.name;
    stage().querySelector("[data-file-meta]").textContent = "Opening document…";
    MTH.status("pw-status", "Opening " + file.name + "…");
    try {
      var pdf = await MTH.pdf.openWithPrompt(file);
      state.pdf = pdf; state.count = pdf.numPages;
      stage().querySelector("[data-file-meta]").textContent = pdf.numPages + " pages · " + MTH.fmtBytes(file.size);
      stage().querySelector("[data-stats]").innerHTML =
        MTH.ui.stat("Pages", pdf.numPages) +
        MTH.ui.stat("Input", MTH.fmtBytes(file.size)) +
        MTH.ui.stat("Output", "DOCX");
      MTH.status("pw-status", pdf.numPages + " pages ready. Reading the structure…", "ok");
      extract();
    } catch (e) {
      if (e.cancelled) { MTH.status("pw-status", "Conversion cancelled."); return; }
      stage().querySelector("[data-file-meta]").textContent = "Could not be opened";
      MTH.status("pw-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "pdf-to-word-load");
    }
  }

  async function extract() {
    if (!state.pdf || state.busy) return;
    var text = (stage().querySelector("[data-pages]").value || "").trim();
    var indices;
    try {
      indices = text ? MTH.ranges(text, state.count) : Array.from({ length: state.count }, function (_, i) { return i; });
    } catch (e) { MTH.status("pw-status", e.message, "err"); return; }
    state.busy = true;
    state.pages = [];
    MTH.progress("pw-prog", 0, "Reading page 1 of " + indices.length);
    MTH.status("pw-status", "Reading the text layer…");
    try {
      for (var k = 0; k < indices.length; k++) {
        var page = await state.pdf.getPage(indices[k] + 1);
        var data = await MTH.tool.pageLines(page);
        data.pageNumber = indices[k] + 1;
        state.pages.push(data);
        MTH.progress("pw-prog", (k + 1) / indices.length, "Read " + (k + 1) + " of " + indices.length + " pages");
        await MTH.sleep(0);
      }
      buildPreview();
      MTH.progress("pw-prog", 1, "Ready to build");
      MTH.status("pw-status", "Outline ready · " + wordCount(state.preview) + " words. Choose a theme, then build the .docx.", "ok");
      MTH.toast("PDF structure read", "ok");
    } catch (e) {
      MTH.progress("pw-prog", null);
      MTH.status("pw-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "pdf-to-word-extract");
    } finally {
      state.busy = false;
    }
  }

  function buildBlocks() {
    var useHeadings = stage().querySelector("[data-headings]").checked;
    var blocks = [];
    state.pages.forEach(function (page) {
      var lines = (page.lines || []).slice();
      var prev = null;
      var buf = null;
      function flush() {
        if (buf && buf.text.trim()) blocks.push(buf);
        buf = null;
      }
      lines.forEach(function (line) {
        var text = line.text.trim();
        if (!text) return;
        var level = useHeadings ? MTH.tool.classifyHeading(line, lines, {}) : 0;
        var bullet = /^([•▪◦‣·]|[-–])\s+/.test(text);
        var numbered = /^(\d{1,3}[.)])\s+/.test(text);
        var gap = prev ? line.y - (prev.y + Math.max(prev.size, 6)) : 0;

        if (level) {
          flush();
          blocks.push({ type: "heading", level: level, text: text });
          prev = line;
          return;
        }
        if (bullet) {
          flush();
          blocks.push({ type: "bullet", level: 0, text: text.replace(/^([•▪◦‣·]|[-–])\s+/, "") });
          prev = line;
          return;
        }
        if (numbered) {
          flush();
          blocks.push({ type: "numbered", text: text });
          prev = line;
          return;
        }

        var continues = buf && prev && gap < Math.max(prev.size, 10) * .65 &&
          (endsHyphen(prev.text) ? startsLower(text) : (prev.text.length > 52 && !/[.!?:;”"']$/.test(prev.text) && (startsLower(text) || !/^[A-Z0-9]/.test(text))));
        if (continues) {
          if (endsHyphen(buf.text) && startsLower(text)) buf.text = buf.text.replace(/[-\u00AD]$/, "") + text;
          else buf.text += " " + text;
        } else {
          flush();
          buf = { type: "paragraph", text: text };
        }
        prev = line;
      });
      flush();
      if (stage().querySelector("[data-page-breaks]").checked) blocks.push({ type: "pagebreak" });
    });
    if (blocks.length && blocks[blocks.length - 1].type === "pagebreak") blocks.pop();
    return blocks;
  }

  function buildPreview() {
    var blocks = buildBlocks();
    state.preview = blocks.map(function (b) {
      if (b.type === "heading") return new Array(b.level + 1).join("#") + " " + b.text;
      if (b.type === "bullet") return "• " + b.text;
      if (b.type === "pagebreak") return "\n— page break —\n";
      return b.text;
    }).join("\n\n");
    stage().querySelector("[data-preview-wrap]").hidden = false;
    stage().querySelector("[data-output]").textContent = state.preview || "No embedded text was found in this document.";
    stage().querySelector("[data-preview-tag]").textContent = wordCount(state.preview) + " words";
    var headings = blocks.filter(function (b) { return b.type === "heading"; }).length;
    stage().querySelector("[data-stats]").innerHTML =
      MTH.ui.stat("Pages read", state.pages.length) +
      MTH.ui.stat("Words", wordCount(state.preview).toLocaleString()) +
      MTH.ui.stat("Headings", headings);
  }

  async function run() {
    if (state.busy || !state.pages.length) return;
    if (typeof docx === "undefined") {
      MTH.status("pw-status", "The Word engine did not load. Refresh the page and try again.", "err");
      return;
    }
    var btn = stage().querySelector("[data-run]");
    state.busy = true;
    MTH.busy(btn, true); btn.dataset.busyText = "Building .docx…";
    MTH.progress("pw-prog", .1, "Composing paragraphs…");
    MTH.status("pw-status", "Assembling the Word document…");
    try {
      var blocks = buildBlocks();
      if (!blocks.length) throw new Error("No embedded text was found, so there is nothing to place in Word. This PDF is probably a scan.");
      var theme = stage().querySelector("[data-theme]").value;
      var bodyFont = theme === "editorial" ? "Georgia" : theme === "compact" ? "Arial" : "Calibri";
      var bodySize = theme === "compact" ? 20 : theme === "editorial" ? 24 : 22;
      var spacing = theme === "compact" ? { after: 60, line: 260 } : theme === "editorial" ? { after: 170, line: 330 } : { after: 120, line: 300 };
      var children = [];
      var headingCount = 0;

      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: MTH.baseName(state.file.name).replace(/[-_]+/g, " "), bold: true, size: theme === "editorial" ? 44 : 40, font: bodyFont, color: "17201C" })],
        spacing: { after: 120 },
        border: { bottom: { color: "A8782E", space: 6, style: docx.BorderStyle.SINGLE, size: 6 } }
      }));
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: "Converted locally with MULTI TOOL HUB", size: 17, color: "626B63", font: bodyFont })],
        spacing: { after: 320 }
      }));

      blocks.forEach(function (block) {
        if (block.type === "pagebreak") {
          children.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
          return;
        }
        if (block.type === "heading") {
          headingCount++;
          var heading = block.level === 1 ? docx.HeadingLevel.HEADING_1 : block.level === 2 ? docx.HeadingLevel.HEADING_2 : docx.HeadingLevel.HEADING_3;
          children.push(new docx.Paragraph({
            heading: heading,
            spacing: { before: block.level === 1 ? 260 : 180, after: 90 },
            children: [new docx.TextRun({ text: block.text, font: bodyFont, bold: true })]
          }));
          return;
        }
        if (block.type === "bullet") {
          children.push(new docx.Paragraph({
            bullet: { level: 0 },
            spacing: { after: 70, line: spacing.line },
            children: [new docx.TextRun({ text: block.text, size: bodySize, font: bodyFont })]
          }));
          return;
        }
        children.push(new docx.Paragraph({
          spacing: { after: spacing.after, line: spacing.line },
          children: [new docx.TextRun({ text: block.text, size: bodySize, font: bodyFont, color: "2B3731" })]
        }));
      });

      var document = new docx.Document({
        creator: "MULTI TOOL HUB",
        title: MTH.baseName(state.file.name),
        description: "Converted from PDF on this device",
        styles: {
          default: {
            document: { run: { font: bodyFont, size: bodySize, color: "2B3731" }, paragraph: { spacing: { line: spacing.line, after: spacing.after } } }
          }
        },
        sections: [{
          properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
          children: children
        }]
      });
      MTH.progress("pw-prog", .72, "Packing the .docx…");
      var blob = await docx.Packer.toBlob(document);
      var name = MTH.baseName(state.file.name) + ".docx";
      MTH.download(blob, name, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      MTH.progress("pw-prog", 1, "Complete");
      MTH.status("pw-status", "Word document ready · " + blocks.filter(function (b) { return b.type !== "pagebreak"; }).length + " paragraphs · " + MTH.fmtBytes(blob.size) + ".", "ok");
      stage().querySelector("[data-result]").innerHTML = MTH.tool.resultPanel({
        title: "Word document is ready",
        meta: state.pages.length + " pages · " + wordCount(state.preview).toLocaleString() + " words · " + MTH.fmtBytes(blob.size),
        buttons: '<button class="btn btn--sm" data-download-result>' + MTH.ui.icon("download") + "Download " + MTH.esc(name) + "</button>"
      });
      stage().querySelector("[data-download-result]").addEventListener("click", function () {
        MTH.download(blob, name, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      });
      MTH.toast("Word document created", "ok");
    } catch (e) {
      MTH.progress("pw-prog", null);
      MTH.status("pw-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "pdf-to-word");
    } finally {
      state.busy = false; MTH.busy(btn, false);
    }
  }

  function endsHyphen(text) { return /[-\u00AD]$/.test(String(text || "").trim()); }
  function startsLower(text) { return /^[a-zà-ÿ(]/.test(String(text || "").trim()); }
  function wordCount(text) { var m = String(text || "").match(/\S+/g); return m ? m.length : 0; }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
