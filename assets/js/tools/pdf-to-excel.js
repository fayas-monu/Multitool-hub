/* PDF to Excel & CSV */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var state = { file: null, pdf: null, count: 0, busy: false, tables: [] };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: ".pdf,application/pdf", icon: "table", title: "Drop a PDF to extract tables", hint: "Rows and columns are detected from the text layer. Nothing is uploaded.", meta: ["PDF", "XLSX", "CSV"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2 data-file-name>Document</h2><p data-file-meta></p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-change>Choose another</button></div></div>' +
      '<div class="settings">' +
      '<div class="settings-section">' +
      '<h3>Detection settings</h3>' +
      '<div class="settings-grid settings-grid--3">' +
      '<div class="field"><label for="pe-pages">Pages</label><input class="input" id="pe-pages" data-pages placeholder="Blank means all pages"></div>' +
      '<div class="field"><label for="pe-gap">Column spacing</label><select class="select" id="pe-gap" data-gap><option value="8">Tight — more columns</option><option value="14" selected>Balanced</option><option value="26">Wide — fewer columns</option></select></div>' +
      '<div class="field"><label for="pe-sheets">Workbook layout</label><select class="select" id="pe-sheets" data-sheets><option value="single" selected>One sheet, all pages</option><option value="perpage">One sheet per page</option></select></div>' +
      "</div>" +
      '<div class="settings-grid" style="margin-top:4px">' +
      '<label class="check"><input type="checkbox" data-page-col> Add a “Page” column</label>' +
      '<label class="check"><input type="checkbox" data-blank checked> Keep empty rows as separators</label>' +
      "</div>" +
      '<div class="notice notice--warn">' + MTH.ui.icon("info") + " <strong>Best results come from ruled tables and scans with a text layer.</strong> Detection is geometric: it rebuilds rows from text positions, so tidy the first rows in Excel if a merged heading shifts a column.</div>" +
      "</div>" +
      "</div>" +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-run>' + MTH.ui.icon("table") + "Read tables</button><span class=\"grow\"></span><span class=\"action-note\">You can preview every row before saving.</span></div>" +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("pe-prog", "Ready") + MTH.ui.status("pe-status") + "</div>" +
      "</section>" +
      '<section class="panel" data-preview-wrap hidden>' +
      '<div class="panel-head"><div><h2>Table preview</h2><p data-preview-meta>Rows detected from the PDF text layer.</p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-csv>' + MTH.ui.icon("download") + "CSV</button><button class=\"btn btn--sm\" data-xlsx>" + MTH.ui.icon("excel") + "Excel .xlsx</button></div></div>" +
      '<div class="panel-body panel-body--flush"><div class="table-scroll"><table class="table-preview" data-table></table></div></div>' +
      "</section>" +
      '<div data-result></div>'
    );

    MTH.tool.bindDrop(stage(), { accept: ".pdf,application/pdf", onFiles: function (files) { load(files[0]); } });
    stage().querySelector("[data-change]").addEventListener("click", async function () {
      var files = await MTH.pick(".pdf,application/pdf", false);
      if (files.length) load(files[0]);
    });
    stage().querySelector("[data-run]").addEventListener("click", extract);
    stage().querySelector("[data-pages]").addEventListener("change", function () { if (state.pdf) extract(); });
    stage().querySelector("[data-gap]").addEventListener("change", function () { if (state.tables.length) rebuildPreview(); });
    MTH.$$("[data-page-col],[data-blank]", stage()).forEach(function (el) {
      el.addEventListener("change", function () { if (state.tables.length) rebuildPreview(); });
    });
    stage().querySelector("[data-xlsx]").addEventListener("click", exportXlsx);
    stage().querySelector("[data-csv]").addEventListener("click", exportCsv);
  }

  async function load(file) {
    if (!file) return;
    if (state.pdf) { MTH.pdf.destroy(state.pdf); state.pdf = null; }
    state.file = file; state.count = 0; state.tables = [];
    var ws = stage().querySelector("[data-workspace]");
    ws.hidden = false;
    stage().querySelector("[data-preview-wrap]").hidden = true;
    stage().querySelector("[data-result]").innerHTML = "";
    stage().querySelector("[data-file-name]").textContent = file.name;
    stage().querySelector("[data-file-meta]").textContent = "Opening document…";
    MTH.status("pe-status", "Opening " + file.name + "…");
    try {
      var pdf = await MTH.pdf.openWithPrompt(file);
      state.pdf = pdf; state.count = pdf.numPages;
      stage().querySelector("[data-file-meta]").textContent = pdf.numPages + " pages · " + MTH.fmtBytes(file.size);
      stage().querySelector("[data-stats]").innerHTML =
        MTH.ui.stat("Pages", pdf.numPages) +
        MTH.ui.stat("Input", MTH.fmtBytes(file.size)) +
        MTH.ui.stat("Output", "XLSX / CSV");
      MTH.status("pe-status", pdf.numPages + " pages ready. Reading table structure…", "ok");
      extract();
    } catch (e) {
      if (e.cancelled) { MTH.status("pe-status", "Extraction cancelled."); return; }
      stage().querySelector("[data-file-meta]").textContent = "Could not be opened";
      MTH.status("pe-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "pdf-to-excel-load");
    }
  }

  async function extract() {
    if (state.busy || !state.pdf) return;
    var btn = stage().querySelector("[data-run]");
    var text = (stage().querySelector("[data-pages]").value || "").trim();
    var indices;
    try {
      indices = text ? MTH.ranges(text, state.count) : Array.from({ length: state.count }, function (_, i) { return i; });
    } catch (e) { MTH.status("pe-status", e.message, "err"); return; }

    state.busy = true; state.tables = [];
    MTH.busy(btn, true); btn.dataset.busyText = "Reading tables…";
    MTH.progress("pe-prog", 0, "Reading page 1 of " + indices.length);
    MTH.status("pe-status", "Detecting rows and columns…");
    try {
      for (var k = 0; k < indices.length; k++) {
        var pn = indices[k] + 1;
        var page = await state.pdf.getPage(pn);
        var data = await MTH.tool.pageLines(page);
        var rows = buildRows(data, +stage().querySelector("[data-gap]").value);
        state.tables.push({ page: pn, rows: rows, lines: data.lines });
        MTH.progress("pe-prog", (k + 1) / indices.length, "Read " + (k + 1) + " of " + indices.length + " pages");
        await MTH.sleep(0);
      }
      var totalRows = state.tables.reduce(function (a, t) { return a + t.rows.length; }, 0);
      if (!totalRows) {
        stage().querySelector("[data-preview-wrap]").hidden = true;
        MTH.progress("pe-prog", null);
        MTH.status("pe-status", "No positioned text was found. This PDF may be a scan without a text layer.", "warn");
        return;
      }
      rebuildPreview();
      MTH.progress("pe-prog", 1, "Tables read");
      MTH.status("pe-status", totalRows + " rows detected across " + state.tables.length + " pages. Check the preview, then save.", "ok");
      MTH.toast("Table structure read", "ok");
    } catch (e) {
      MTH.progress("pe-prog", null);
      MTH.status("pe-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "pdf-to-excel");
    } finally {
      state.busy = false; MTH.busy(btn, false);
    }
  }

  function buildRows(data, gap) {
    var rows = [];
    (data.lines || []).forEach(function (line) {
      var items = (line.items || []).slice().sort(function (a, b) { return a.x - b.x; });
      if (!items.length) return;
      var cells = [];
      var current = null;
      items.forEach(function (it) {
        var text = String(it.str).replace(/\s+/g, " ").trim();
        if (!text) return;
        if (!current) { current = { text: text, x: it.x, end: it.x + it.w }; return; }
        var gapPx = it.x - current.end;
        if (gapPx > gap) {
          cells.push(current);
          current = { text: text, x: it.x, end: it.x + it.w };
        } else {
          current.text += (gapPx > Math.max(1.2, it.h * .22) ? " " : "") + text;
          current.end = Math.max(current.end, it.x + it.w);
        }
      });
      if (current) cells.push(current);
      if (cells.length) rows.push(cells);
    });
    // Align cells into shared columns using their horizontal centres.
    var centres = [];
    rows.forEach(function (cells) {
      cells.forEach(function (c) {
        var centre = (c.x + c.end) / 2;
        var hit = null;
        for (var i = 0; i < centres.length; i++) {
          if (Math.abs(centres[i].at - centre) <= Math.max(gap * .9, 10)) { hit = centres[i]; break; }
        }
        if (hit) { hit.at = (hit.at * hit.n + centre) / (hit.n + 1); hit.n++; }
        else centres.push({ at: centre, n: 1 });
      });
    });
    centres.sort(function (a, b) { return a.at - b.at; });
    if (centres.length > 60) centres = centres.slice(0, 60);
    var grid = rows.map(function (cells) {
      var out = new Array(centres.length).fill("");
      cells.forEach(function (c) {
        var centre = (c.x + c.end) / 2, best = 0, bestD = Infinity;
        centres.forEach(function (col, i) {
          var d = Math.abs(col.at - centre);
          if (d < bestD) { bestD = d; best = i; }
        });
        out[best] = out[best] ? out[best] + " " + c.text : c.text;
      });
      return out;
    }).filter(function (row) { return row.some(function (c) { return c !== ""; }); });
    return grid;
  }

  function combinedRows() {
    var includePage = stage().querySelector("[data-page-col]").checked;
    var keepBlank = stage().querySelector("[data-blank]").checked;
    var out = [];
    state.tables.forEach(function (table, index) {
      if (index > 0 && keepBlank) out.push([]);
      table.rows.forEach(function (row) {
        out.push(includePage ? [String(table.page)].concat(row) : row.slice());
      });
    });
    return out;
  }

  function rebuildPreview() {
    var rows = combinedRows();
    var includePage = stage().querySelector("[data-page-col]").checked;
    var maxRows = 120;
    var shown = rows.slice(0, maxRows);
    var maxCols = shown.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var head = shown.length ? shown[0] : [];
    var body = shown.slice(1);
    var html = "";
    if (includePage) html += "<thead><tr><th>Page</th>";
    else html += "<thead><tr>";
    for (var c = 0; c < maxCols; c++) {
      html += "<th>" + MTH.esc(head[c] == null ? "" : head[c]) + "</th>";
    }
    html += "</tr></thead><tbody>";
    body.forEach(function (row) {
      html += "<tr>";
      for (var i = 0; i < maxCols; i++) html += "<td>" + MTH.esc(row[i] == null ? "" : row[i]) + "</td>";
      html += "</tr>";
    });
    html += "</tbody>";
    if (!shown.length) html = '<tbody><tr><td>No rows detected.</td></tr></tbody>';
    stage().querySelector("[data-preview-wrap]").hidden = false;
    stage().querySelector("[data-table]").innerHTML = html;
    stage().querySelector("[data-preview-meta]").textContent = rows.length.toLocaleString() + " rows · " + maxCols + " columns" + (rows.length > maxRows ? " · previewing the first " + maxRows + " rows" : "");
    stage().querySelector("[data-stats]").innerHTML =
      MTH.ui.stat("Pages read", state.tables.length) +
      MTH.ui.stat("Rows", rows.length.toLocaleString()) +
      MTH.ui.stat("Columns", maxCols);
  }

  async function exportXlsx() {
    if (!state.tables.length) return;
    if (typeof XLSX === "undefined") { MTH.status("pe-status", "The Excel engine did not load. Refresh the page and try again.", "err"); return; }
    var btn = stage().querySelector("[data-xlsx]");
    MTH.busy(btn, true); btn.dataset.busyText = "Building…";
    try {
      var wb = XLSX.utils.book_new();
      var perPage = stage().querySelector("[data-sheets]").value === "perpage";
      if (perPage) {
        state.tables.forEach(function (table) {
          var ws = XLSX.utils.aoa_to_sheet(table.rows);
          ws["!cols"] = widthColumns(table.rows);
          XLSX.utils.book_append_sheet(wb, ws, "Page " + table.page);
        });
      } else {
        var rows = combinedRows();
        var ws2 = XLSX.utils.aoa_to_sheet(rows);
        ws2["!cols"] = widthColumns(rows);
        XLSX.utils.book_append_sheet(wb, ws2, "Tables");
      }
      var name = MTH.baseName(state.file.name) + "-tables.xlsx";
      var array = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      var blob = new Blob([array], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      MTH.download(blob, name, blob.type);
      MTH.status("pe-status", "Excel workbook saved · " + MTH.fmtBytes(blob.size) + ".", "ok");
      stage().querySelector("[data-result]").innerHTML = MTH.tool.resultPanel({
        title: "Excel workbook is ready",
        meta: state.tables.length + " pages · " + MTH.fmtBytes(blob.size),
        buttons: '<button class="btn btn--sm" data-download-result>' + MTH.ui.icon("download") + "Download " + MTH.esc(name) + "</button>"
      });
      stage().querySelector("[data-download-result]").addEventListener("click", function () { MTH.download(blob, name, blob.type); });
      MTH.toast("Workbook exported", "ok");
    } catch (e) {
      MTH.status("pe-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "pdf-to-excel-xlsx");
    } finally {
      MTH.busy(btn, false);
    }
  }

  function exportCsv() {
    if (!state.tables.length) return;
    var rows = combinedRows();
    var csv = rows.map(function (row) {
      return row.map(function (cell) {
        var text = cell == null ? "" : String(cell);
        return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
      }).join(",");
    }).join("\r\n");
    var name = MTH.baseName(state.file.name) + "-tables.csv";
    MTH.download(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), name, "text/csv;charset=utf-8");
    MTH.status("pe-status", "CSV saved · " + rows.length + " rows.", "ok");
    MTH.toast("CSV exported", "ok");
  }

  function widthColumns(rows) {
    var widths = [];
    rows.slice(0, 300).forEach(function (row) {
      row.forEach(function (cell, i) {
        var len = String(cell == null ? "" : cell).length;
        widths[i] = Math.max(widths[i] || 8, Math.min(52, len + 2));
      });
    });
    return widths.map(function (w) { return { wch: w }; });
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
