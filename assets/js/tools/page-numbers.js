/* PDF Page Numbers */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var state = { file: null, pdf: null, count: 0, busy: false };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: ".pdf,application/pdf", icon: "hash", title: "Drop a PDF to number", hint: "Add clean page numbers at any edge. Nothing is uploaded.", meta: ["PDF", "Pagination", "Local only"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2 data-file-name>Document</h2><p data-file-meta></p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-change>Choose another</button></div></div>' +
      '<div class="settings">' +
      '<div class="settings-section">' +
      '<h3>Numbering style</h3>' +
      '<div class="settings-grid">' +
      '<div class="field"><label for="pn-position">Position on the page</label><select class="select" id="pn-position" data-position>' +
      '<option value="bottom-center">Bottom centre</option><option value="bottom-right">Bottom right</option><option value="bottom-left">Bottom left</option>' +
      '<option value="top-center">Top centre</option><option value="top-right">Top right</option><option value="top-left">Top left</option>' +
      '</select></div>' +
      '<div class="field"><label for="pn-format">Format</label><input class="input" id="pn-format" data-format value="Page {page} of {total}" spellcheck="false"><div class="hint">Use <code>{page}</code> and <code>{total}</code>. Example: <b data-sample>Page 1 of 12</b></div></div>' +
      "</div>" +
      '<div class="settings-grid settings-grid--3">' +
      '<div class="field"><label for="pn-start">First number</label><input class="input" id="pn-start" data-start type="number" min="0" max="9999" value="1"></div>' +
      '<div class="field"><label for="pn-font">Typeface</label><select class="select" id="pn-font" data-font>' +
      '<option value="Helvetica">Helvetica</option><option value="HelveticaBold">Helvetica bold</option><option value="TimesRoman">Times</option><option value="TimesRomanBold">Times bold</option><option value="Courier">Courier</option>' +
      "</select></div>" +
      '<div class="field"><label for="pn-colour">Colour</label><input class="input" id="pn-colour" data-colour type="color" value="#17201c"></div>' +
      "</div>" +
      '<div class="settings-grid">' +
      '<div class="field"><label for="pn-size">Font size <span class="range-val" data-size-val>11 pt</span></label><input id="pn-size" data-size type="range" min="6" max="28" value="11"></div>' +
      '<div class="field"><label for="pn-margin">Margin <span class="range-val" data-margin-val>28 pt</span></label><input id="pn-margin" data-margin type="range" min="8" max="90" value="28"></div>' +
      "</div>" +
      "</div>" +
      '<div class="settings-section">' +
      '<div class="settings-title"><h3>Apply to</h3><span class="tag" data-pages-tag>0 pages</span></div>' +
      '<div class="field"><label for="pn-range">Pages</label><input class="input" id="pn-range" data-range placeholder="1-3, 5, 8- (blank means every page)"><div class="hint">The printed page number still reflects the real page position unless you set a different first number.</div></div>' +
      '<div class="notice">' + MTH.ui.icon("info") + " Page numbers are written as real PDF text, so they stay sharp at every zoom level and print cleanly.</div>" +
      "</div>" +
      "</div>" +
      '<div class="panel-body" style="border-top:1px solid var(--line)">' +
      '<div class="settings-title"><h3>Live position preview</h3><span class="tag tag--brass">Updated as you type</span></div>' +
      '<div class="preview-frame"><div class="pn-mock" data-mock aria-hidden="true"><span data-mock-number>Page 1 of 12</span></div></div>' +
      '<div class="preview-caption"><span>Mock page · A4 portrait</span><span data-preview-note>Bottom centre · Helvetica 11 pt</span></div>' +
      "</div>" +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-run>' + MTH.ui.icon("hash") + "Add page numbers</button><span class=\"grow\"></span><span class=\"action-note\">Exports a new PDF. The original is never changed.</span></div>" +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("pn-prog", "Ready") + MTH.ui.status("pn-status") + "</div>" +
      "</section>" +
      '<div data-result></div>'
    );

    MTH.tool.bindDrop(stage(), { accept: ".pdf,application/pdf", onFiles: function (files) { load(files[0]); } });
    stage().querySelector("[data-change]").addEventListener("click", async function () {
      var files = await MTH.pick(".pdf,application/pdf", false);
      if (files.length) load(files[0]);
    });
    stage().querySelector("[data-run]").addEventListener("click", run);
    stage().querySelector("[data-format]").addEventListener("input", syncPreview);
    stage().querySelector("[data-range]").addEventListener("input", syncPreview);
    stage().querySelector("[data-position]").addEventListener("change", syncPreview);
    stage().querySelector("[data-font]").addEventListener("change", syncPreview);
    stage().querySelector("[data-colour]").addEventListener("input", syncPreview);
    stage().querySelector("[data-size]").addEventListener("input", syncPreview);
    stage().querySelector("[data-margin]").addEventListener("input", syncPreview);
    stage().querySelector("[data-start]").addEventListener("input", syncPreview);
  }

  async function load(file) {
    if (!file) return;
    var ws = stage().querySelector("[data-workspace]");
    ws.hidden = false;
    state.file = file;
    if (state.pdf) { MTH.pdf.destroy(state.pdf); state.pdf = null; }
    state.count = 0;
    stage().querySelector("[data-file-name]").textContent = file.name;
    stage().querySelector("[data-file-meta]").textContent = "Reading document…";
    stage().querySelector("[data-result]").innerHTML = "";
    MTH.status("pn-status", "Opening " + file.name + "…");
    try {
      var pdf = await MTH.pdf.load(file);
      state.pdf = pdf;
      state.count = pdf.numPages;
      stage().querySelector("[data-file-meta]").textContent = pdf.numPages + " pages · " + MTH.fmtBytes(file.size);
      stage().querySelector("[data-pages-tag]").textContent = pdf.numPages + " pages";
      stage().querySelector("[data-stats]").innerHTML =
        MTH.ui.stat("Pages", pdf.numPages) +
        MTH.ui.stat("Input size", MTH.fmtBytes(file.size)) +
        MTH.ui.stat("Output", "New PDF");
      MTH.status("pn-status", pdf.numPages + " pages ready.", "ok");
      syncPreview();
    } catch (e) {
      stage().querySelector("[data-file-meta]").textContent = "Could not be opened";
      if (e.needsPassword) {
        stage().querySelector("[data-stats]").innerHTML = "";
        MTH.status("pn-status", "", "");
        stage().querySelector("[data-result]").innerHTML =
          '<div class="notice notice--warn">' + MTH.ui.icon("lock") + " <strong>This PDF is password-protected.</strong> Add page numbers needs an unprotected working copy. Open <a href=\"" + MTH.esc(MTH.sitePath("tools/unlock.html")) + "\">Unlock PDF</a>, save the unlocked copy with your known password, then number that file.</div>";
      } else {
        MTH.status("pn-status", MTH.friendlyError(e), "err");
        MTH.reportError(e, "page-numbers-load");
      }
    }
  }

  function selectedPages() {
    var input = stage().querySelector("[data-range]");
    var text = (input.value || "").trim();
    if (!text) return { list: null, label: "all pages" };
    var list = MTH.ranges(text, state.count);
    return { list: list, label: MTH.rangesText(list) };
  }

  function syncPreview() {
    if (!state.count) return;
    var size = +stage().querySelector("[data-size]").value;
    var margin = +stage().querySelector("[data-margin]").value;
    var start = Math.max(0, +stage().querySelector("[data-start]").value || 0);
    var fmt = stage().querySelector("[data-format]").value || "{page}";
    var position = stage().querySelector("[data-position]").value;
    var font = stage().querySelector("[data-font]").value;
    var sample = fmt.replace(/\{page\}/gi, start + 1).replace(/\{total\}/gi, start + state.count - 1);
    stage().querySelector("[data-sample]").textContent = sample;
    stage().querySelector("[data-size-val]").textContent = size + " pt";
    stage().querySelector("[data-margin-val]").textContent = margin + " pt";

    var mock = stage().querySelector("[data-mock]");
    var label = stage().querySelector("[data-mock-number]");
    label.textContent = sample;
    label.style.fontSize = Math.max(6, size * 1.55) + "px";
    label.style.fontWeight = /Bold/.test(font) ? "700" : "400";
    label.style.fontFamily = /Courier/.test(font) ? "var(--font-mono)" : /Times/.test(font) ? "Georgia, serif" : "var(--font-body)";
    label.style.color = stage().querySelector("[data-colour]").value;
    var pad = Math.max(4, margin * .7);
    var top = position.indexOf("top") === 0;
    var hAlign = /left/.test(position) ? "flex-start" : /right/.test(position) ? "flex-end" : "center";
    mock.style.alignItems = top ? "flex-start" : "flex-end";
    mock.style.justifyContent = hAlign;
    mock.style.padding = pad + "px";

    var countLabel = "all pages";
    try {
      var sel = selectedPages();
      countLabel = sel.list ? sel.list.length + " selected page" + (sel.list.length === 1 ? "" : "s") : "all " + state.count + " pages";
    } catch (e) { countLabel = "check the range"; }
    stage().querySelector("[data-preview-note]").textContent = position.replace("-", " ") + " · " + font.replace(/([a-z])([A-Z])/g, "$1 $2") + " " + size + " pt · " + countLabel;
  }

  async function run() {
    if (state.busy || !state.pdf) return;
    var btn = stage().querySelector("[data-run]");
    var selection;
    try {
      selection = selectedPages();
    } catch (e) {
      MTH.status("pn-status", e.message, "err");
      MTH.toast(e.message, "err");
      return;
    }
    var indices = selection.list || state.pdf.numPages && Array.from({ length: state.count }, function (_, i) { return i; });
    if (!indices.length) { MTH.status("pn-status", "There are no pages to number.", "warn"); return; }

    var total = +stage().querySelector("[data-start]").value + state.count - 1;
    var start = +stage().querySelector("[data-start]").value || 0;
    var fmt = stage().querySelector("[data-format]").value || "{page}";
    var position = stage().querySelector("[data-position]").value;
    var fontKey = stage().querySelector("[data-font]").value;
    var size = +stage().querySelector("[data-size]").value;
    var margin = +stage().querySelector("[data-margin]").value;
    var colour = stage().querySelector("[data-colour]").value;
    var rgb = hexRgb(colour);

    state.busy = true;
    MTH.busy(btn, true); btn.dataset.busyText = "Numbering…";
    MTH.progress("pn-prog", 0, "Opening a writable copy…");
    MTH.status("pn-status", "Preparing the document…");
    try {
      var doc = await MTH.pdf.openLib(state.file);
      var fonts = PDFLib.StandardFonts;
      var font = await doc.embedFont(fonts[fontKey] || fonts.Helvetica);
      var pages = doc.getPages();
      var sampleWidth = font.widthOfTextAtSize("0000000000", size);

      for (var k = 0; k < indices.length; k++) {
        var idx = indices[k];
        var page = pages[idx];
        if (!page) continue;
        var pageNumber = start + idx;
        var text = sanitize(fmt.replace(/\{page\}/gi, pageNumber).replace(/\{total\}/gi, total));
        var textWidth = Math.min(font.widthOfTextAtSize(text, size), sampleWidth * 2.2);

        var W = page.getWidth(), H = page.getHeight();
        var rot = ((page.getRotation().angle % 360) + 360) % 360;
        var swap = rot % 180 !== 0;
        var vw = swap ? H : W, vh = swap ? W : H;
        var top = position.indexOf("top") === 0;
        var left = /left/.test(position), right = /right/.test(position);
        var vx = left ? margin : right ? vw - margin - textWidth : (vw - textWidth) / 2;
        var vy = top ? vh - margin - size * .82 : margin + size * .18;
        var mapped = visualToPdf(vx, vy, W, H, rot);
        page.drawText(text, {
          x: mapped.x,
          y: mapped.y,
          size: size,
          font: font,
          color: PDFLib.rgb(rgb.r, rgb.g, rgb.b),
          rotate: PDFLib.degrees(rot)
        });
        if (k % 12 === 0) {
          MTH.progress("pn-prog", (k + 1) / indices.length, "Numbered " + (k + 1) + " of " + indices.length + " pages");
          await MTH.sleep(0);
        }
      }
      doc.setProducer("MULTI TOOL HUB");
      doc.setCreator("MULTI TOOL HUB · local page numbering");
      doc.setModificationDate(new Date());
      MTH.progress("pn-prog", .96, "Writing the PDF…");
      var bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
      var name = MTH.baseName(state.file.name) + "-numbered.pdf";
      var blob = MTH.download(bytes, name, "application/pdf");
      MTH.progress("pn-prog", 1, "Complete");
      MTH.status("pn-status", "Numbered " + indices.length + " page" + (indices.length === 1 ? "" : "s") + " · " + MTH.fmtBytes(blob.size) + ".", "ok");
      stage().querySelector("[data-result]").innerHTML = MTH.tool.resultPanel({
        title: "Numbered PDF is ready",
        meta: indices.length + " pages · " + fontKey.replace(/([a-z])([A-Z])/g, "$1 $2") + " " + size + " pt · " + MTH.fmtBytes(blob.size),
        buttons: '<button class="btn btn--sm" data-download-result>' + MTH.ui.icon("download") + "Download " + MTH.esc(name) + "</button>"
      });
      stage().querySelector("[data-download-result]").addEventListener("click", function () { MTH.download(bytes, name, "application/pdf"); });
      MTH.toast("Page numbers added", "ok");
    } catch (e) {
      MTH.progress("pn-prog", null);
      if (/encrypt|password/i.test(e && e.message || "")) {
        MTH.status("pn-status", "", "");
        stage().querySelector("[data-result]").innerHTML =
          '<div class="notice notice--warn">' + MTH.ui.icon("lock") + " <strong>This PDF is protected.</strong> Page numbering needs an unprotected copy. <a href=\"" + MTH.esc(MTH.sitePath("tools/unlock.html")) + "\">Unlock it first</a> using the password you already know.</div>";
      } else {
        MTH.status("pn-status", MTH.friendlyError(e), "err");
        MTH.reportError(e, "page-numbers");
      }
    } finally {
      state.busy = false; MTH.busy(btn, false); syncPreview();
    }
  }

  function sanitize(text) {
    return String(text).replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
  }
  function hexRgb(hex) {
    var h = String(hex || "#000000").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
  }
  function visualToPdf(vx, vy, W, H, rot) {
    if (rot === 90) return { x: W - vy, y: vx };
    if (rot === 180) return { x: W - vx, y: H - vy };
    if (rot === 270) return { x: vy, y: H - vx };
    return { x: vx, y: vy };
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
