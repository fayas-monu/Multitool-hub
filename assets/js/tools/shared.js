/* ==========================================================================
   MULTI TOOL HUB — shared tool helpers
   ========================================================================== */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  MTH.tool = {
    stage: function () { return document.getElementById("tool"); },
    mount: function (html) {
      var stage = this.stage();
      if (!stage) throw new Error("The tool workspace could not be found on this page.");
      stage.innerHTML = html;
      MTH.ui.hydrateIcons(stage);
      return stage;
    },
    bindDrop: function (root, opts) {
      var zone = root.querySelector("[data-dropzone]");
      if (!zone) return null;
      return MTH.drop(zone, opts);
    },
    resultPanel: function (opts) {
      opts = opts || {};
      return '<div class="download-ready" data-result>' +
        '<span class="dr-icon">' + MTH.ui.icon("check-circle") + "</span>" +
        '<span class="dr-main"><b>' + MTH.esc(opts.title || "Your file is ready") + "</b><small>" + MTH.esc(opts.meta || "Processed locally on this device.") + "</small></span>" +
        '<span class="row">' + (opts.buttons || '<button class="btn btn--sm" data-download-result>' + MTH.ui.icon("download") + "Download</button>") + "</span>" +
        "</div>";
    },
    async thumb(pdf, pageNumber, canvas, maxWidth, rotation) {
      var page = await pdf.getPage(pageNumber);
      var v = page.getViewport({ scale: 1, rotation: rotation == null ? page.rotate : rotation });
      var scale = Math.min(2, Math.max(.15, (maxWidth || 150) / v.width));
      await MTH.pdf.render(page, canvas, { scale: scale, rotation: rotation == null ? page.rotate : rotation, pixelRatio: Math.min(2, window.devicePixelRatio || 1) });
      return { width: v.width, height: v.height, page: page };
    },
    async thumbAll(pdf, host, opts) {
      opts = opts || {};
      var maxWidth = opts.maxWidth || 180;
      var concurrency = opts.concurrency || 3;
      var total = pdf.numPages;
      var queue = [];
      for (var i = 1; i <= total; i++) queue.push(i);
      var active = 0, index = 0;
      return await new Promise(function (resolve) {
        function next() {
          while (active < concurrency && index < queue.length) {
            var pageNumber = queue[index++];
            active++;
            MTH.promise(function () { return opts.render(pageNumber); })
              .catch(function (e) { if (opts.onPageError) opts.onPageError(e, pageNumber); })
              .then(function () {
                active--;
                if (opts.onProgress) opts.onProgress(Math.min(1, (index) / total));
                if (index >= queue.length && active === 0) resolve(); else next();
              });
          }
        }
        if (!total) resolve(); else next();
      });
    },
    pageRange: function (text, count) {
      try { return MTH.ranges(text, count); }
      catch (e) { MTH.toast(e.message, "err"); return null; }
    },
    dataUrlBytes: function (url) {
      var parts = String(url).split(",");
      var bin = atob(parts[1] || "");
      var u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return u;
    },
    blobUrl: function (blob) { return URL.createObjectURL(blob); },
    revoke: function (url) { if (url) setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 2000); },
    async imageBytesForPdf(file) {
      var mime = (file.type || "").toLowerCase();
      if (mime === "image/jpeg" || mime === "image/jpg") return { kind: "jpg", bytes: new Uint8Array(await file.arrayBuffer()) };
      if (mime === "image/png") return { kind: "png", bytes: new Uint8Array(await file.arrayBuffer()) };
      var im = await MTH.images.load(file);
      var c = MTH.images.canvas(im.source, { background: "#ffffff" });
      im.close();
      var enc = await MTH.images.encode(c, "image/jpeg", .92);
      return { kind: "jpg", bytes: enc.bytes, width: c.width, height: c.height };
    },
    pointsFromMm: function (mm) { return mm * 72 / 25.4; },
    pointsFromPx: function (px) { return px * 72 / 96; },
    pageSizes: {
      a4: [595.28, 841.89],
      letter: [612, 792],
      legal: [612, 1008],
      a3: [841.89, 1190.55]
    },
    async pageLines(page, opts) {
      opts = opts || {};
      var viewport = page.getViewport({ scale: 1 });
      var text = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
      var styles = text.styles || {};
      var items = [];
      (text.items || []).forEach(function (item) {
        if (!item.str || !item.str.replace(/\s+/g, "")) return;
        var tr = item.transform || [1, 0, 0, 1, 0, 0];
        var pt = viewport.convertToViewportPoint(tr[4], tr[5]);
        var height = Math.abs(item.height || 0) || Math.hypot(tr[2], tr[3]) || 10;
        var width = Math.abs(item.width || 0) || Math.hypot(tr[0], tr[1]) * String(item.str).length;
        var style = styles[item.fontName] || {};
        var family = (style.fontFamily || item.fontName || "") + "";
        items.push({
          str: String(item.str),
          x: pt[0], y: pt[1], w: width, h: height,
          size: height,
          bold: /bold|black|heavy|semibold|demibold|demi/i.test(family),
          italic: /italic|oblique/i.test(family),
          font: family,
          hasEOL: !!item.hasEOL
        });
      });
      items.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
      var lines = [];
      items.forEach(function (it) {
        var tol = opts.exact ? .7 : Math.max(2.2, it.h * .38);
        var line = null;
        for (var i = lines.length - 1; i >= Math.max(0, lines.length - 4); i--) {
          if (Math.abs(lines[i].y - it.y) <= tol) { line = lines[i]; break; }
        }
        if (!line) {
          line = { y: it.y, items: [], text: "", x: it.x, width: 0, size: 0, bold: false, italic: false, endX: 0 };
          lines.push(line);
        }
        line.items.push(it);
        line.y = (line.y * (line.items.length - 1) + it.y) / line.items.length;
        line.size = Math.max(line.size, it.size);
        line.bold = line.bold || it.bold;
        line.italic = line.italic || it.italic;
      });
      lines.forEach(function (line) {
        line.items.sort(function (a, b) { return a.x - b.x; });
        var text = "", prev = null;
        line.items.forEach(function (it) {
          var str = String(it.str).replace(/\s+/g, " ").trim();
          if (!str) return;
          if (prev) {
            var gap = it.x - (prev.x + prev.w);
            if (gap > Math.max(1.2, it.h * .18)) text += " ";
            if (gap > it.h * 1.55) text += "  ";
          }
          text += str;
          prev = it;
        });
        line.text = text.replace(/\s{3,}/g, "   ").trim();
        line.x = line.items.length ? line.items[0].x : 0;
        line.endX = line.items.length ? line.items[line.items.length - 1].x + line.items[line.items.length - 1].w : 0;
        line.width = line.endX - line.x;
      });
      lines = lines.filter(function (l) { return l.text; });
      lines.sort(function (a, b) { return a.y - b.y; });
      return { items: items, lines: lines, width: viewport.width, height: viewport.height, viewport: viewport };
    },
    linesToText(pages, opts) {
      opts = opts || {};
      var out = [];
      pages.forEach(function (page, pi) {
        var lines = page.lines || [];
        if (opts.pageLabels && pages.length > 1) {
          if (out.length) out.push("");
          out.push("— Page " + (pi + 1) + " —");
        }
        var prev = null;
        lines.forEach(function (line) {
          if (prev) {
            var gap = line.y - (prev.y + Math.max(prev.size, 4));
            if (gap > Math.max(prev.size, 10) * .9) out.push("");
          }
          var text = line.text;
          var heading = MTH.tool.classifyHeading(line, lines, opts);
          if (heading && opts.markdown) text = new Array(heading + 1).join("#") + " " + text;
          else if (opts.bullets && /^([•▪◦‣·]|[-–])\s+/.test(text)) text = "• " + text.replace(/^([•▪◦‣·]|[-–])\s+/, "");
          out.push(text);
          prev = line;
        });
        if (opts.pageBreaks && pi < pages.length - 1) out.push("", "────────────────────────", "");
      });
      return out.join("\n").replace(/\n{4,}/g, "\n\n\n").trim();
    },
    classifyHeading: function (line, allLines, opts) {
      var sizes = (allLines || []).map(function (l) { return l.size; }).filter(Boolean).sort(function (a, b) { return a - b; });
      var median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : line.size;
      if (!line.size || line.size < median * 1.16) return 0;
      if (line.text.length > 110) return 0;
      if (line.size >= median * 1.7) return 1;
      if (line.size >= median * 1.35) return 2;
      return 3;
    }
  };

  MTH.promise = function (fn) {
    return new Promise(function (resolve) { resolve(fn()); });
  };

  MTH.clone = function (value) {
    if (window.structuredClone) { try { return structuredClone(value); } catch (e) {} }
    return JSON.parse(JSON.stringify(value));
  };
})();
