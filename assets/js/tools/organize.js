/* PDF Organize Pages */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;
  var state = { docs: {}, pages: [], thumbs: {}, docSeq: 0, busy: false, output: null, dragFrom: -1 };

  function stage() { return MTH.tool.stage(); }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: ".pdf,application/pdf", multiple: true, icon: "organize", title: "Drop PDFs to organize", hint: "One or more PDFs. Every page becomes a movable card.", meta: ["PDF", "Reorder", "Duplicate", "Blank pages"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2>Page canvas</h2><p>Drag cards to reorder, or use the arrow buttons. Changes stay in this tab.</p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-add>Add PDFs</button><button class="btn btn--sm btn--ghost" data-blank>Add blank</button><button class="btn btn--sm btn--subtle" data-reload>Reset</button></div></div>' +
      '<div class="settings"><div class="settings-section">' +
      '<div class="notice" style="margin-bottom:12px"><strong>Drag to reorder.</strong> Each card can be rotated, duplicated or deleted. Blank pages match the size of the last page.</div>' +
      '<div class="thumb-grid" data-thumbs></div>' +
      "</div></div>" +
      '<div class="panel-foot"><div class="stat-grid" data-stats style="flex:1"></div></div>' +
      '<div class="action-bar"><button class="btn" data-run>Save organized PDF</button><span class="grow"></span><span class="action-note">Exports a fresh PDF with the new page order.</span></div>' +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("organize-prog", "Ready") + MTH.ui.status("organize-status") + "</div>" +
      "</section>" +
      '<div data-result></div>'
    );
    MTH.tool.bindDrop(stage(), { accept: ".pdf,application/pdf", multiple: true, onFiles: addFiles });
    stage().querySelector("[data-add]").addEventListener("click", async function () {
      var files = await MTH.pick(".pdf,application/pdf", true);
      if (files.length) addFiles(files);
    });
    stage().querySelector("[data-blank]").addEventListener("click", addBlank);
    stage().querySelector("[data-reload]").addEventListener("click", function () {
      if (!state.pages.length) return;
      MTH.confirm({ title: "Reset the page canvas?", message: "All ordering, rotation, duplicates and blank pages will be discarded. Your original files are untouched.", confirmText: "Reset canvas", danger: true }).then(function (yes) {
        if (yes) rebuildFromDocs();
      });
    });
    stage().querySelector("[data-run]").addEventListener("click", save);
    var host = stage().querySelector("[data-thumbs]");
    host.addEventListener("click", onGridClick);
    host.addEventListener("keydown", function (e) {
      var card = e.target.closest("[data-uid]");
      if (!card || (e.key !== "Enter" && e.key !== " ")) return;
      if (e.target.closest("[data-act]")) return;
      e.preventDefault();
      toggleCard(card);
    });
    host.addEventListener("dragstart", function (e) {
      var card = e.target.closest("[data-uid]");
      if (!card) return;
      state.dragFrom = indexOfUid(card.dataset.uid);
      card.classList.add("is-dragging");
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", card.dataset.uid); }
    });
    host.addEventListener("dragend", function (e) {
      var card = e.target.closest("[data-uid]");
      if (card) card.classList.remove("is-dragging");
      MTH.$$(".is-drop-target", host).forEach(function (n) { n.classList.remove("is-drop-target"); });
    });
    host.addEventListener("dragover", function (e) {
      var card = e.target.closest("[data-uid]");
      if (!card) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      MTH.$$(".is-drop-target", host).forEach(function (n) { if (n !== card) n.classList.remove("is-drop-target"); });
      card.classList.add("is-drop-target");
    });
    host.addEventListener("drop", function (e) {
      var card = e.target.closest("[data-uid]");
      if (!card) return;
      e.preventDefault();
      var to = indexOfUid(card.dataset.uid);
      if (state.dragFrom >= 0 && to >= 0 && state.dragFrom !== to) {
        var item = state.pages.splice(state.dragFrom, 1)[0];
        state.pages.splice(to, 0, item);
        renderGrid();
        MTH.status("organize-status", "Page moved to position " + (to + 1) + ".", "info");
      }
      state.dragFrom = -1;
    });
  }

  function indexOfUid(uid) {
    for (var i = 0; i < state.pages.length; i++) if (state.pages[i].uid === uid) return i;
    return -1;
  }

  function uid() { return "pg-" + MTH.uid(); }

  async function addFiles(files) {
    if (!files || !files.length) return;
    var ws = stage().querySelector("[data-workspace]");
    ws.hidden = false;
    MTH.status("organize-status", "Opening " + files.length + " file" + (files.length === 1 ? "" : "s") + "…");
    var added = 0, skipped = [];
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      try {
        var pdf = await MTH.pdf.load(file);
        var key = "doc-" + (++state.docSeq);
        state.docs[key] = { key: key, file: file, pdf: pdf, name: file.name };
        for (var n = 1; n <= pdf.numPages; n++) {
          var page = await pdf.getPage(n);
          var vp = page.getViewport({ scale: 1 });
          state.pages.push({ uid: uid(), doc: key, page: n, rotation: 0, width: vp.width, height: vp.height, blank: false, file: file.name });
        }
        added++;
      } catch (e) {
        skipped.push(file.name + (e.needsPassword ? " (password-protected)" : " (unreadable)"));
      }
    }
    if (!added) {
      MTH.status("organize-status", skipped.length ? "No usable PDFs. " + skipped.join(" · ") + ". Unlock protected files first." : "No PDF could be opened.", "err");
      return;
    }
    renderGrid();
    MTH.status("organize-status", added + " PDF" + (added === 1 ? "" : "s") + " added." + (skipped.length ? " Skipped: " + skipped.join(", ") + "." : ""), skipped.length ? "warn" : "ok");
  }

  function rebuildFromDocs() {
    var keys = Object.keys(state.docs);
    var rebuilt = [];
    keys.forEach(function (key) {
      var doc = state.docs[key];
      state.pages.forEach(function (p) {
        if (p.doc === key && !p.blank) rebuilt.push({ uid: uid(), doc: key, page: p.page, rotation: 0, width: p.width, height: p.height, blank: false, file: p.file });
      });
    });
    state.pages = rebuilt;
    state.thumbs = {};
    renderGrid();
    MTH.status("organize-status", "Page canvas reset to the original documents.", "ok");
  }

  function addBlank() {
    if (!state.pages.length) {
      var doc = MTH.last ? null : null;
      state.pages.push({ uid: uid(), blank: true, rotation: 0, width: 595.28, height: 841.89, doc: null, page: 0, file: "Blank page" });
    } else {
      var last = state.pages[state.pages.length - 1];
      state.pages.push({ uid: uid(), blank: true, rotation: 0, width: last.width || 595.28, height: last.height || 841.89, doc: null, page: 0, file: "Blank page" });
    }
    stage().querySelector("[data-workspace]").hidden = false;
    renderGrid();
    MTH.status("organize-status", "Blank page added at the end.", "info");
    var cards = MTH.$$("[data-uid]", stage());
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function toggleCard(card) {
    var index = indexOfUid(card.dataset.uid);
    if (index < 0) return;
    var p = state.pages[index];
    p.rotation = ((p.rotation || 0) + 90) % 360;
    paintBadges();
    MTH.status("organize-status", "Page " + (index + 1) + " rotated to " + p.rotation + "°.", "info");
  }

  function onGridClick(e) {
    var card = e.target.closest("[data-uid]");
    if (!card) return;
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    e.preventDefault();
    var uidValue = card.dataset.uid;
    var index = indexOfUid(uidValue);
    if (index < 0) return;
    var act = btn.dataset.act;
    var page = state.pages[index];
    if (act === "up" && index > 0) {
      state.pages.splice(index - 1, 0, state.pages.splice(index, 1)[0]);
      renderGrid(); MTH.status("organize-status", "Page moved up.", "info"); return;
    }
    if (act === "down" && index < state.pages.length - 1) {
      state.pages.splice(index + 1, 0, state.pages.splice(index, 1)[0]);
      renderGrid(); MTH.status("organize-status", "Page moved down.", "info"); return;
    }
    if (act === "rotate") {
      page.rotation = ((page.rotation || 0) + 90) % 360;
      paintBadges();
      MTH.status("organize-status", "Page " + (index + 1) + " rotated to " + page.rotation + "°.", "info");
      return;
    }
    if (act === "duplicate") {
      var copy = MTH.clone(page);
      copy.uid = uid();
      if (state.thumbs[page.uid]) state.thumbs[copy.uid] = state.thumbs[page.uid];
      state.pages.splice(index + 1, 0, copy);
      renderGrid();
      MTH.status("organize-status", "Page duplicated.", "info");
      return;
    }
    if (act === "remove") {
      state.pages.splice(index, 1);
      delete state.thumbs[uidValue];
      renderGrid();
      MTH.status("organize-status", "Page removed from the working set. Your original file is unchanged.", "info");
    }
  }

  function renderGrid() {
    var host = stage() && stage().querySelector("[data-thumbs]");
    if (!host) return;
    if (!state.pages.length) {
      host.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><strong>The canvas is empty</strong><p>Add a PDF or a blank page to begin.</p></div>';
      updateStats();
      return;
    }
    host.innerHTML = state.pages.map(function (p, i) {
      var thumb = state.thumbs[p.uid];
      var media = p.blank ?
        '<div class="thumb-canvas blank-page"><span>Blank</span></div>' :
        thumb ? '<div class="thumb-canvas"><img src="' + thumb + '" alt="Page ' + (i + 1) + '"></div>' :
          '<div class="thumb-canvas"><canvas data-canvas="' + MTH.esc(p.uid) + '"></canvas></div>';
      return '<div class="thumb-card" data-uid="' + MTH.esc(p.uid) + '" draggable="true" tabindex="0" role="button" aria-label="Page ' + (i + 1) + '">' +
        media +
        '<span class="thumb-badge">' + (i + 1) + "</span>" +
        (p.rotation ? '<span class="thumb-rot" data-rot-badge>' + p.rotation + "°</span>" : '<span class="thumb-rot" data-rot-badge hidden>0°</span>') +
        '<div class="thumb-label"><span>' + (p.blank ? "Blank" : MTH.esc(MTH.ext(p.file) ? p.file.replace(/\.[^.]+$/, "") : "Page")) + '</span><span>p.' + (p.blank ? "—" : p.page) + '</span></div>' +
        '<div class="thumb-ops">' +
        '<button type="button" data-act="up" aria-label="Move page up"' + (i === 0 ? " disabled" : "") + ">" + MTH.ui.icon("up") + "</button>" +
        '<button type="button" data-act="down" aria-label="Move page down"' + (i === state.pages.length - 1 ? " disabled" : "") + ">" + MTH.ui.icon("down") + "</button>" +
        '<button type="button" data-act="rotate" aria-label="Rotate page">' + MTH.ui.icon("rotate") + "</button>" +
        '<button type="button" data-act="duplicate" aria-label="Duplicate page">' + MTH.ui.icon("copy") + "</button>" +
        '<button type="button" data-act="remove" aria-label="Remove page">' + MTH.ui.icon("trash") + "</button>" +
        "</div></div>";
    }).join("");
    fillThumbs();
    updateStats();
  }

  function fillThumbs() {
    var missing = state.pages.filter(function (p) { return !p.blank && !state.thumbs[p.uid]; });
    if (!missing.length) return;
    var active = 0, index = 0;
    function next() {
      while (active < 2 && index < missing.length) {
        var p = missing[index++];
        active++;
        (async function (item) {
          try {
            var doc = state.docs[item.doc];
            if (!doc) throw new Error("Source document is no longer available.");
            var page = await doc.pdf.getPage(item.page);
            var vp = page.getViewport({ scale: 1 });
            var scale = Math.min(1.3, Math.max(.14, 160 / vp.width));
            var canvas = document.createElement("canvas");
            await MTH.pdf.render(page, canvas, { scale: scale, pixelRatio: 1.6 });
            state.thumbs[item.uid] = canvas.toDataURL("image/jpeg", .8);
            var host = stage().querySelector("[data-thumbs]");
            var card = host && host.querySelector('[data-uid="' + item.uid + '"]');
            if (card) {
              var holder = card.querySelector(".thumb-canvas");
              if (holder) holder.innerHTML = '<img src="' + state.thumbs[item.uid] + '" alt="Page preview">';
            }
            canvas.width = 0; canvas.height = 0;
          } catch (e) {
            var host2 = stage().querySelector("[data-thumbs]");
            var card2 = host2 && host2.querySelector('[data-uid="' + item.uid + '"]');
            if (card2) {
              var holder2 = card2.querySelector(".thumb-canvas");
              if (holder2) holder2.innerHTML = '<span class="tiny" style="padding:8px;text-align:center">No preview</span>';
            }
          }
        })(p).then(function () {
          active--;
          if (index >= missing.length && active === 0) return;
          next();
        });
      }
    }
    next();
  }

  function paintBadges() {
    MTH.$$("[data-uid]", stage()).forEach(function (card, i) {
      var p = state.pages[indexOfUid(card.dataset.uid)];
      if (!p) return;
      var badge = card.querySelector("[data-rot-badge]");
      if (badge) { badge.hidden = !p.rotation; badge.textContent = p.rotation + "°"; }
    });
    updateStats();
  }

  function updateStats() {
    var stats = stage() && stage().querySelector("[data-stats]");
    if (!stats) return;
    var size = 0, docs = {};
    state.pages.forEach(function (p) {
      if (p.blank) return;
      docs[p.doc] = true;
    });
    Object.keys(state.docs).forEach(function (k) { size += state.docs[k].file.size; });
    stats.innerHTML = MTH.ui.stat("Pages", state.pages.length) + MTH.ui.stat("Source files", Object.keys(docs).length) + MTH.ui.stat("Blanks", state.pages.filter(function (p) { return p.blank; }).length) + MTH.ui.stat("Input size", MTH.fmtBytes(size));
    var run = stage().querySelector("[data-run]");
    if (run) run.disabled = state.busy || !state.pages.length;
  }

  function resetOutput() {
    state.output = null;
    var host = stage() && stage().querySelector("[data-result]");
    if (host) host.innerHTML = "";
  }

  async function save() {
    if (state.busy || !state.pages.length) return;
    var btn = stage().querySelector("[data-run]");
    state.busy = true;
    btn.dataset.busyText = "Assembling…";
    MTH.busy(btn, true);
    resetOutput();
    MTH.progress("organize-prog", 0, "Preparing the source documents…");
    try {
      var libs = {};
      var keys = Object.keys(state.docs);
      for (var k = 0; k < keys.length; k++) {
        libs[keys[k]] = await MTH.pdf.openLib(state.docs[keys[k]].file);
      }
      var out = await PDFLib.PDFDocument.create();
      for (var i = 0; i < state.pages.length; i++) {
        var p = state.pages[i];
        if (p.blank) {
          out.addPage([p.width || 595.28, p.height || 841.89]);
        } else {
          var lib = libs[p.doc];
          if (!lib) throw new Error("A source document could not be reopened. Add it again.");
          var copied = await out.copyPages(lib, [p.page - 1]);
          var page = copied[0];
          if (p.rotation) {
            var current = page.getRotation().angle || 0;
            page.setRotation(PDFLib.degrees(((current + p.rotation) % 360 + 360) % 360));
          }
          out.addPage(page);
        }
        if (i % 4 === 0) {
          MTH.progress("organize-prog", (i + 1) / state.pages.length, "Assembled " + (i + 1) + " of " + state.pages.length + " pages");
          await MTH.sleep(0);
        }
      }
      out.setProducer("MULTI TOOL HUB");
      out.setCreator("MULTI TOOL HUB · local browser organizer");
      MTH.status("organize-status", "Writing the organized PDF…");
      var bytes = await out.save({ useObjectStreams: true, addDefaultPage: false });
      var name = MTH.baseName(Object.keys(state.docs).length ? state.docs[Object.keys(state.docs)[0]].file.name : "organized") + "-organized.pdf";
      var blob = new Blob([bytes], { type: "application/pdf" });
      state.output = { blob: blob, name: name };
      MTH.progress("organize-prog", 1, "Complete");
      MTH.download(blob, name, "application/pdf");
      MTH.status("organize-status", "Ready: " + name + " · " + state.pages.length + " pages · " + MTH.fmtBytes(blob.size) + ".", "ok");
      stage().querySelector("[data-result]").innerHTML = MTH.tool.resultPanel({
        title: "Organized PDF is ready",
        meta: state.pages.length + " pages · " + MTH.fmtBytes(blob.size) + " · downloaded automatically",
        buttons: '<button class="btn btn--sm" data-download-result>' + MTH.ui.icon("download") + "Download again</button>"
      });
      stage().querySelector("[data-download-result]").addEventListener("click", function () {
        if (state.output) MTH.download(state.output.blob, state.output.name, "application/pdf");
      });
      MTH.toast("Organized PDF saved", "ok");
    } catch (e) {
      MTH.progress("organize-prog", null);
      MTH.status("organize-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "organize");
    } finally {
      state.busy = false;
      MTH.busy(btn, false);
      updateStats();
    }
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
