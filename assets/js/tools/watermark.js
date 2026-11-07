/* PDF Watermark */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;
  var state = { file: null, pdf: null, count: 0, page: 1, baseInfo: null, vp: null, image: null, imageFile: null, imageName: "", busy: false, output: null };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: ".pdf,application/pdf", icon: "watermark", title: "Drop a PDF to watermark", hint: "Stamp text or a logo across every page, with a live preview.", meta: ["PDF", "Text or image", "Live preview"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2 data-file-name>Document</h2><p data-file-meta></p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-change>Choose another</button></div></div>' +
      '<div class="settings">' +
      '<div class="settings-section"><h3>Watermark style</h3>' +
      '<div class="seg" data-types><button type="button" class="on" data-type="text">Text</button><button type="button" data-type="image">Image / logo</button></div>' +
      '<div data-type-panel="text" style="margin-top:14px">' +
      '<div class="settings-grid"><div class="field"><label for="wm-text">Text</label><input class="input" id="wm-text" data-text value="CONFIDENTIAL" maxlength="80"></div>' +
      '<div class="field"><label for="wm-size">Size <span class="range-val" data-size-val>48 pt</span></label><input type="range" id="wm-size" data-size min="8" max="180" value="48"></div></div>' +
      '<div class="settings-grid"><div class="field"><label for="wm-color">Colour</label><input class="input" id="wm-color" data-color type="color" value="#a8782e"></div>' +
      '<div class="field"><label for="wm-angle">Angle <span class="range-val" data-angle-val>45°</span></label><input type="range" id="wm-angle" data-angle min="-90" max="90" value="45"></div></div>' +
      "</div>" +
      '<div data-type-panel="image" hidden style="margin-top:14px">' +
      '<div class="row"><button class="btn btn--sm btn--ghost" data-pick-image>' + MTH.ui.icon("image-plus") + " Choose image</button><span class=\"tag\" data-image-name>No image selected</span></div>" +
      '<div class="settings-grid" style="margin-top:12px"><div class="field"><label for="wm-image-scale">Width <span class="range-val" data-image-scale-val>28%</span></label><input type="range" id="wm-image-scale" data-image-scale min="5" max="80" value="28"></div>' +
      '<div class="field"><label for="wm-image-angle">Angle <span class="range-val" data-image-angle-val>0°</span></label><input type="range" id="wm-image-angle" data-image-angle min="-90" max="90" value="0"></div></div>' +
      "</div>" +
      '<div class="settings-grid" style="margin-top:8px"><div class="field"><label for="wm-opacity">Opacity <span class="range-val" data-opacity-val>28%</span></label><input type="range" id="wm-opacity" data-opacity min="4" max="100" value="28"></div>' +
      '<div class="field"><label for="wm-position">Position</label><select class="select" id="wm-position" data-position><option value="center" selected>Centre</option><option value="top-left">Top left</option><option value="top-right">Top right</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option><option value="tile">Tile across page</option></select></div></div>' +
      '<div class="field" data-density-wrap hidden><label for="wm-density">Tile density <span class="range-val" data-density-val>3 × 3</span></label><input type="range" id="wm-density" data-density min="2" max="6" value="3"></div>' +
      "</div>" +
      '<div class="settings-section"><div class="row" style="justify-content:space-between"><h3 class="settings-title" style="margin:0">Preview</h3><div class="row"><button class="icon-btn icon-btn--sm" data-prev aria-label="Previous page">' + MTH.ui.icon("left") + '</button><span class="tag" data-page-label>Page 1</span><button class="icon-btn icon-btn--sm" data-next aria-label="Next page">' + MTH.ui.icon("right") + '</button><button class="btn btn--sm btn--subtle" data-preview>Open large preview</button></div></div>' +
      '<div class="preview-wrap"><div class="preview-layers"><canvas data-canvas></canvas><canvas class="overlay-canvas" data-overlay-canvas></canvas></div></div>' +
      '<div class="preview-caption"><span data-preview-caption>Watermark previews live.</span><span>Rendered locally</span></div>' +
      "</div>" +
      '<div class="settings-section"><h3>Apply to pages</h3><div class="field"><label for="wm-range">Page range</label><input class="input" id="wm-range" data-range placeholder="Leave blank for every page"><div class="hint">Use comma-separated ranges, for example 1-3, 6, 9-.</div></div></div>' +
      "</div>" +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-run>Apply watermark</button><span class="grow"></span><span class="action-note">Text and images are embedded into a new PDF.</span></div>' +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("watermark-prog", "Ready") + MTH.ui.status("watermark-status") + "</div>" +
      "</section>" +
      '<div data-result></div>'
    );
    MTH.tool.bindDrop(stage(), { accept: ".pdf,application/pdf", onFiles: function (files) { load(files[0]); } });
    stage().querySelector("[data-change]").addEventListener("click", async function () {
      var files = await MTH.pick(".pdf,application/pdf", false);
      if (files.length) load(files[0]);
    });
    stage().querySelector("[data-types]").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-type]");
      if (!btn) return;
      MTH.$$("[data-type]", stage()).forEach(function (b) { b.classList.toggle("on", b === btn); });
      MTH.$$("[data-type-panel]", stage()).forEach(function (p) { p.hidden = p.dataset.typePanel !== btn.dataset.type; });
      drawPreview();
    });
    MTH.$$("input[type=range]", stage()).forEach(function (input) {
      input.addEventListener("input", function () {
        if (input.dataset.size) { var el = stage().querySelector("[data-size-val]"); if (el) el.textContent = input.value + " pt"; }
        if (input.dataset.angle) { var el2 = stage().querySelector("[data-angle-val]"); if (el2) el2.textContent = input.value + "°"; }
        if (input.dataset.imageScale) { var el3 = stage().querySelector("[data-image-scale-val]"); if (el3) el3.textContent = input.value + "%"; }
        if (input.dataset.imageAngle) { var el4 = stage().querySelector("[data-image-angle-val]"); if (el4) el4.textContent = input.value + "°"; }
        if (input.dataset.opacity) { var el5 = stage().querySelector("[data-opacity-val]"); if (el5) el5.textContent = input.value + "%"; }
        if (input.dataset.density) { var el6 = stage().querySelector("[data-density-val]"); if (el6) el6.textContent = input.value + " × " + input.value; }
        drawPreview();
        updateStats();
      });
    });
    MTH.$$("[data-text], [data-color], [data-position]", stage()).forEach(function (input) {
      input.addEventListener("input", function () { drawPreview(); updateStats(); });
      input.addEventListener("change", function () {
        stage().querySelector("[data-density-wrap]").hidden = stage().querySelector("[data-position]").value !== "tile";
        drawPreview();
        updateStats();
      });
    });
    stage().querySelector("[data-pick-image]").addEventListener("click", pickImage);
    stage().querySelector("[data-prev]").addEventListener("click", function () { go(-1); });
    stage().querySelector("[data-next]").addEventListener("click", function () { go(1); });
    stage().querySelector("[data-preview]").addEventListener("click", openPreview);
    stage().querySelector("[data-run]").addEventListener("click", run);
  }

  async function load(file) {
    if (!file) return;
    resetOutput();
    state.file = file;
    state.page = 1;
    if (state.pdf) { MTH.pdf.destroy(state.pdf); state.pdf = null; }
    var ws = stage().querySelector("[data-workspace]");
    ws.hidden = false;
    stage().querySelector("[data-file-name]").textContent = file.name;
    stage().querySelector("[data-file-meta]").textContent = MTH.fmtBytes(file.size);
    MTH.status("watermark-status", "Opening " + file.name + "…");
    try {
      var pdf = await MTH.pdf.load(file);
      state.pdf = pdf;
      state.count = pdf.numPages;
      stage().querySelector("[data-canvas]").parentElement.style.visibility = "visible";
      await renderPreviewPage();
      MTH.status("watermark-status", state.count + " pages ready. Adjust the watermark and watch the preview.", "ok");
    } catch (e) {
      if (e.needsPassword) {
        MTH.status("watermark-status", "", "");
        stage().querySelector(".preview-wrap").innerHTML = '<div class="notice notice--warn">' + MTH.ui.icon("lock") + " <strong>This PDF is password-protected.</strong> Watermarking writes a new file, so make an unencrypted copy with <a href=\"" + MTH.esc(MTH.sitePath("tools/unlock.html")) + "\">Unlock PDF</a> first, using the password you know.</div>";
      } else {
        MTH.status("watermark-status", MTH.friendlyError(e), "err");
        MTH.reportError(e, "watermark-load");
      }
    }
  }

  function go(delta) {
    var next = MTH.clamp(state.page + delta, 1, state.count || 1);
    if (next === state.page) return;
    state.page = next;
    renderPreviewPage();
  }

  async function renderPreviewPage() {
    if (!state.pdf) return;
    var base = stage().querySelector("[data-canvas]");
    var overlay = stage().querySelector("[data-overlay-canvas]");
    stage().querySelector("[data-page-label]").textContent = "Page " + state.page + " of " + state.count;
    try {
      var page = await state.pdf.getPage(state.page);
      var vp = page.getViewport({ scale: 1 });
      var targetWidth = Math.min(700, Math.max(280, stage().querySelector(".preview-wrap").clientWidth || 640));
      var scale = Math.min(targetWidth / vp.width, 880 / vp.height, 2.4);
      var info = await MTH.pdf.render(page, base, { scale: scale, rotation: page.rotate, pixelRatio: Math.min(2, window.devicePixelRatio || 1) });
      state.baseInfo = info;
      state.vp = vp;
      overlay.width = base.width;
      overlay.height = base.height;
      stage().querySelector("[data-prev]").disabled = state.page <= 1;
      stage().querySelector("[data-next]").disabled = state.page >= state.count;
      drawPreview();
      updateStats();
    } catch (e) {
      MTH.status("watermark-status", MTH.friendlyError(e), "err");
    }
  }

  function readOpts() {
    var type = stage().querySelector("[data-type].on").dataset.type;
    return {
      type: type,
      text: stage().querySelector("[data-text]").value || "CONFIDENTIAL",
      size: +stage().querySelector("[data-size]").value,
      color: stage().querySelector("[data-color]").value,
      angle: +stage().querySelector("[data-angle]").value,
      imageScale: +stage().querySelector("[data-image-scale]").value / 100,
      imageAngle: +stage().querySelector("[data-image-angle]").value,
      opacity: +stage().querySelector("[data-opacity]").value / 100,
      position: stage().querySelector("[data-position]").value,
      density: +stage().querySelector("[data-density]").value
    };
  }

  function positions(vp, opts, itemW, itemH) {
    var list = [];
    if (opts.position === "tile") {
      var n = opts.density;
      var stepX = vp.width / n;
      var stepY = Math.max(itemH * 1.65, vp.height / Math.max(2, Math.round(n * vp.height / vp.width)));
      for (var y = stepY / 2; y < vp.height; y += stepY) {
        for (var x = stepX / 2; x < vp.width; x += stepX) {
          list.push({ x: x + ((Math.round(y / stepY) % 2) ? stepX / 2 : 0), y: y });
        }
      }
      return list;
    }
    var margin = Math.min(vp.width, vp.height) * .1;
    if (opts.position === "center") list.push({ x: vp.width / 2, y: vp.height / 2 });
    else if (opts.position === "top-left") list.push({ x: margin + itemW / 2, y: margin + itemH / 2 });
    else if (opts.position === "top-right") list.push({ x: vp.width - margin - itemW / 2, y: margin + itemH / 2 });
    else if (opts.position === "bottom-left") list.push({ x: margin + itemW / 2, y: vp.height - margin - itemH / 2 });
    else list.push({ x: vp.width - margin - itemW / 2, y: vp.height - margin - itemH / 2 });
    return list;
  }

  function drawPreview() {
    if (!state.baseInfo || !state.vp) return;
    var overlay = stage().querySelector("[data-overlay-canvas]");
    var base = stage().querySelector("[data-canvas]");
    var ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    var opts = readOpts();
    var scale = overlay.width / state.vp.width;
    ctx.save();
    ctx.globalAlpha = opts.opacity;
    if (opts.type === "text") {
      var text = opts.text || "CONFIDENTIAL";
      var fontPx = Math.max(4, opts.size * scale);
      ctx.font = "700 " + fontPx + "px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = opts.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var metrics = ctx.measureText(text);
      var itemW = metrics.width / scale;
      var itemH = fontPx / scale;
      var list = positions(state.vp, opts, itemW, itemH);
      list.forEach(function (p) {
        ctx.save();
        ctx.translate(p.x * scale, p.y * scale);
        ctx.rotate(-opts.angle * Math.PI / 180);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      });
    } else if (state.image) {
      var img = state.image;
      var iw = state.vp.width * opts.imageScale;
      var ih = iw * img.height / img.width;
      var list2 = positions(state.vp, opts, iw, ih);
      list2.forEach(function (p) {
        ctx.save();
        ctx.translate(p.x * scale, p.y * scale);
        ctx.rotate(-opts.imageAngle * Math.PI / 180);
        ctx.drawImage(img, -iw * scale / 2, -ih * scale / 2, iw * scale, ih * scale);
        ctx.restore();
      });
    } else {
      ctx.font = "600 " + Math.max(11, 15 * scale) + "px 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = "rgba(23,32,28,.55)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Choose an image to see the watermark", overlay.width / 2, overlay.height / 2);
    }
    ctx.restore();
    var cap = stage().querySelector("[data-preview-caption]");
    if (cap) cap.textContent = opts.type === "text" ? "“" + (opts.text || "CONFIDENTIAL") + "” · " + opts.size + " pt · " + opts.opacity * 100 + "% opacity" : state.imageName ? state.imageName + " · " + Math.round(opts.imageScale * 100) + "% width · " + Math.round(opts.opacity * 100) + "% opacity" : "No image selected";
  }

  async function pickImage() {
    var files = await MTH.pick("image/png,image/jpeg,image/webp,image/gif", false);
    if (!files.length) return;
    try {
      var img = await new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(files[0]);
        var image = new Image();
        image.onload = function () { URL.revokeObjectURL(url); resolve(image); };
        image.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That image could not be decoded. Use PNG, JPG or WebP.")); };
        image.src = url;
      });
      state.image = img;
      state.imageFile = files[0];
      state.imageName = files[0].name;
      stage().querySelector("[data-image-name]").textContent = files[0].name;
      drawPreview();
      MTH.toast("Logo loaded into the watermark preview", "ok");
    } catch (e) {
      MTH.status("watermark-status", MTH.friendlyError(e), "err");
    }
  }

  async function openPreview() {
    var base = stage().querySelector("[data-canvas]");
    var overlay = stage().querySelector("[data-overlay-canvas]");
    if (!base.width) return;
    var canvas = document.createElement("canvas");
    canvas.width = base.width;
    canvas.height = base.height;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(base, 0, 0);
    ctx.drawImage(overlay, 0, 0);
    var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });
    if (blob) MTH.preview({ blob: blob, title: "Watermark preview · page " + state.page, downloadName: MTH.baseName(state.file.name) + "-preview.png" });
  }

  function updateStats() {
    var stats = stage() && stage().querySelector("[data-stats]");
    if (!stats) return;
    var opts = readOpts();
    var range = stage().querySelector("[data-range]").value.trim();
    var apply = range || "All pages";
    stats.innerHTML = MTH.ui.stat("Pages", state.count || "—") + MTH.ui.stat("Apply to", apply) + MTH.ui.stat("Style", opts.type === "text" ? "Text" : "Image") + MTH.ui.stat("Opacity", Math.round(opts.opacity * 100) + "%") + MTH.ui.stat("Input size", state.file ? MTH.fmtBytes(state.file.size) : "—");
    var run = stage().querySelector("[data-run]");
    if (run) run.disabled = state.busy || !state.file || (opts.type === "image" && !state.image);
  }

  function resetOutput() {
    state.output = null;
    var host = stage() && stage().querySelector("[data-result]");
    if (host) host.innerHTML = "";
  }

  function sanitizeText(text) {
    return String(text || "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...").replace(/[^\x20-\xFF\n]/g, "?");
  }

  async function run() {
    if (state.busy || !state.file) return;
    var opts = readOpts();
    if (opts.type === "image" && !state.image) { MTH.status("watermark-status", "Choose an image first.", "warn"); return; }
    var rangeText = stage().querySelector("[data-range]").value;
    var targets;
    try { targets = rangeText.trim() ? MTH.ranges(rangeText, state.count) : Array.apply(null, Array(state.count)).map(function (_, i) { return i; }); }
    catch (e) { MTH.status("watermark-status", e.message, "err"); return; }
    var btn = stage().querySelector("[data-run]");
    state.busy = true;
    btn.dataset.busyText = "Stamping…";
    MTH.busy(btn, true);
    resetOutput();
    MTH.progress("watermark-prog", 0, "Opening the document…");
    try {
      var src = await MTH.pdf.openLib(state.file);
      var libPages = src.getPages();
      var font = null;
      if (opts.type === "text") font = await src.embedFont(PDFLib.StandardFonts.HelveticaBold);
      var embeddedImage = null;
      if (opts.type === "image") {
        var file = state.imageFile;
        var mime = (file && file.type || "").toLowerCase();
        var raw = new Uint8Array(await file.arrayBuffer());
        if (mime === "image/jpeg" || mime === "image/jpg") embeddedImage = await src.embedJpg(raw);
        else if (mime === "image/png") embeddedImage = await src.embedPng(raw);
        else {
          var png = await MTH.images.encode(MTH.images.canvas(state.image, { background: false }), "image/png", 1);
          embeddedImage = await src.embedPng(png.bytes);
        }
      }
      var text = sanitizeText(opts.text) || "CONFIDENTIAL";
      for (var t = 0; t < targets.length; t++) {
        var pageIndex = targets[t];
        var p = await state.pdf.getPage(pageIndex + 1);
        var vp = p.getViewport({ scale: 1 });
        var libPage = libPages[pageIndex];
        if (opts.type === "text") {
          var size = opts.size;
          var width = font.widthOfTextAtSize(text, size);
          var height = size * .72;
          var list = positions(vp, opts, width, height);
          var rad = opts.angle * Math.PI / 180;
          list.forEach(function (pos) {
            var pdfCenter = vp.convertToPdfPoint(pos.x, pos.y);
            var ahead = vp.convertToPdfPoint(pos.x + Math.cos(rad) * 100, pos.y - Math.sin(rad) * 100);
            var angle = Math.atan2(ahead[1] - pdfCenter[1], ahead[0] - pdfCenter[0]);
            var ux = Math.cos(angle), uy = Math.sin(angle);
            var nx = -uy, ny = ux;
            var startX = pdfCenter[0] - ux * width / 2 - nx * height / 2;
            var startY = pdfCenter[1] - uy * width / 2 - ny * height / 2;
            libPage.drawText(text, { x: startX, y: startY, size: size, font: font, color: hexColor(opts.color), opacity: opts.opacity, rotate: PDFLib.degrees(angle * 180 / Math.PI) });
          });
        } else {
          var iw = vp.width * opts.imageScale;
          var ih = iw * state.image.height / state.image.width;
          var list2 = positions(vp, opts, iw, ih);
          var rad2 = opts.imageAngle * Math.PI / 180;
          list2.forEach(function (pos) {
            var pdfCenter2 = vp.convertToPdfPoint(pos.x, pos.y);
            var ahead2 = vp.convertToPdfPoint(pos.x + Math.cos(rad2) * 100, pos.y - Math.sin(rad2) * 100);
            var angle2 = Math.atan2(ahead2[1] - pdfCenter2[1], ahead2[0] - pdfCenter2[0]);
            var ux2 = Math.cos(angle2), uy2 = Math.sin(angle2);
            var nx2 = -uy2, ny2 = ux2;
            libPage.drawImage(embeddedImage, {
              x: pdfCenter2[0] - ux2 * iw / 2 - nx2 * ih / 2,
              y: pdfCenter2[1] - uy2 * iw / 2 - ny2 * ih / 2,
              width: iw, height: ih, opacity: opts.opacity, rotate: PDFLib.degrees(angle2 * 180 / Math.PI)
            });
          });
        }
        MTH.progress("watermark-prog", (t + 1) / targets.length, "Stamped " + (t + 1) + " of " + targets.length + " pages");
        if (t % 3 === 0) await MTH.sleep(0);
      }
      src.setProducer("MULTI TOOL HUB");
      src.setCreator("MULTI TOOL HUB · local browser watermark");
      var bytes = await src.save({ useObjectStreams: true, addDefaultPage: false });
      var name = MTH.baseName(state.file.name) + "-watermarked.pdf";
      var blob = new Blob([bytes], { type: "application/pdf" });
      state.output = { blob: blob, name: name };
      MTH.progress("watermark-prog", 1, "Complete");
      MTH.download(blob, name, "application/pdf");
      MTH.status("watermark-status", "Ready: " + name + " · " + targets.length + " page" + (targets.length === 1 ? "" : "s") + " stamped · " + MTH.fmtBytes(blob.size) + ".", "ok");
      stage().querySelector("[data-result]").innerHTML = MTH.tool.resultPanel({
        title: "Watermarked PDF is ready",
        meta: targets.length + " page" + (targets.length === 1 ? "" : "s") + " · " + (opts.type === "text" ? "text watermark" : "image watermark") + " · " + MTH.fmtBytes(blob.size),
        buttons: '<button class="btn btn--sm" data-download-result>' + MTH.ui.icon("download") + "Download again</button>"
      });
      stage().querySelector("[data-download-result]").addEventListener("click", function () {
        if (state.output) MTH.download(state.output.blob, state.output.name, "application/pdf");
      });
      MTH.toast("Watermark applied", "ok");
    } catch (e) {
      MTH.progress("watermark-prog", null);
      MTH.status("watermark-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "watermark");
    } finally {
      state.busy = false;
      MTH.busy(btn, false);
      updateStats();
    }
  }

  function hexColor(hex) {
    var m = /^#?([a-f0-9]{6})$/i.exec(hex || "#a8782e");
    if (!m) return PDFLib.rgb(.65, .47, .18);
    var n = parseInt(m[1], 16);
    return PDFLib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
