/* ==========================================================================
   MULTI TOOL HUB — home page
   ========================================================================== */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;
  var state = { query: "", cat: "all", favOnly: false };

  var STOP = { "a": 1, "an": 1, "the": 1, "my": 1, "to": 1, "for": 1, "of": 1, "and": 1, "in": 1, "on": 1, "with": 1, "from": 1, "me": 1, "pdf": 0, "tool": 1 };

  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
  function words(s) { return norm(s).split(" ").filter(Boolean); }
  function hay(t) { return norm([t.title, t.short, t.desc, (t.tags || []).join(" "), t.aliases, (MTH.categories.filter(function (c) { return c.id === t.cat; })[0] || {}).name].join(" ")); }
  function editDistance(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 2) return 3;
    var prev = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }
  function score(t, tokens, raw) {
    var h = hay(t), title = norm(t.title + " " + t.short);
    var s = 0;
    var all = true;
    tokens.forEach(function (w) {
      if (STOP[w]) return;
      if (title.indexOf(w) !== -1) s += 8;
      else if (h.indexOf(w) !== -1) s += 4;
      else if (h.split(" ").some(function (x) { return x.indexOf(w) === 0 || editDistance(x, w) <= 1; })) s += 2;
      else all = false;
    });
    if (!all) return 0;
    if (title === raw) s += 20;
    if (title.indexOf(raw) !== -1) s += 10;
    if (h.indexOf(raw) !== -1) s += 5;
    if (t.badge) s += .2;
    return s;
  }
  function filtered() {
    var raw = norm(state.query);
    var tokens = raw.split(" ").filter(Boolean);
    var list = MTH.tools.slice();
    if (state.cat !== "all") list = list.filter(function (t) { return t.cat === state.cat; });
    if (state.favOnly) list = list.filter(function (t) { return MTH.store.isFavorite(t.id); });
    if (!tokens.length) return list;
    // Direction-aware phrase check, so "word to pdf" cannot return PDF-to-Word.
    var dir = raw.match(/([a-z0-9]+)\s+to\s+([a-z0-9]+)/);
    if (dir) {
      var phrase = dir[0];
      list = list.filter(function (t) { return hay(t).indexOf(phrase) !== -1 || norm(t.title).indexOf(phrase) !== -1; });
    }
    var scored = list.map(function (t) { return { t: t, s: score(t, tokens, raw) }; }).filter(function (x) { return x.s > 0; });
    if (!scored.length) {
      // Gentle typo fallback: allow one edit on a word of four or more letters.
      scored = list.map(function (t) {
        var h = hay(t), hit = 0;
        tokens.forEach(function (w) {
          if (w.length < 4) { if (h.indexOf(w) !== -1) hit++; return; }
          if (h.split(" ").some(function (x) { return editDistance(x, w) <= 2 || x.indexOf(w) === 0; })) hit++;
        });
        return { t: t, s: hit >= Math.max(1, tokens.length) ? 1 : 0 };
      }).filter(function (x) { return x.s > 0; });
    }
    scored.sort(function (a, b) { return b.s - a.s || a.t.title.localeCompare(b.t.title); });
    return scored.map(function (x) { return x.t; });
  }

  function card(t, index) {
    var favorite = MTH.store.isFavorite(t.id);
    var href = MTH.sitePath(t.href);
    return '<article class="tool-card" data-id="' + MTH.esc(t.id) + '">' +
      '<button class="fav-btn' + (favorite ? " on" : "") + '" type="button" data-fav="' + MTH.esc(t.id) + '" aria-label="' + (favorite ? "Remove from favourites" : "Add to favourites") + '" aria-pressed="' + (favorite ? "true" : "false") + '">' + MTH.ui.icon("star") + "</button>" +
      '<a class="tool-card-link" href="' + MTH.esc(href) + '">' +
      '<span class="tool-card-top"><span class="tool-card-icon">' + MTH.ui.icon(t.icon) + "</span><span class=\"tool-card-index\">" + (index < 10 ? "0" : "") + index + "</span></span>" +
      "<h3>" + MTH.esc(t.title) + "</h3>" +
      "<p>" + MTH.esc(t.desc) + "</p>" +
      '<span class="tool-card-foot"><span class="meta">' + (t.cat === "download" ? MTH.ui.icon("external") + " Partner API" : MTH.ui.icon("shield") + " Local only") + '</span><span class="go">' + MTH.ui.icon("arrow-right") + "</span></span>" +
      "</a>" +
      (t.badge ? '<span class="badge ' + (t.badge === "New" ? "badge--new" : "badge--live") + '">' + MTH.esc(t.badge) + "</span>" : "") +
      "</article>";
  }

  function render() {
    var grid = MTH.$("[data-tool-grid]");
    var empty = MTH.$("[data-no-results]");
    var count = MTH.$("[data-result-count]");
    var title = MTH.$("[data-result-title]");
    if (!grid) return;
    var list = filtered();
    grid.innerHTML = list.map(function (t, i) { return card(t, i + 1); }).join("");
    if (empty) empty.classList.toggle("show", !list.length);
    if (count) count.textContent = list.length + (list.length === 1 ? " tool" : " tools");
    if (title) {
      var cat = MTH.categories.filter(function (c) { return c.id === state.cat; })[0];
      title.textContent = state.favOnly ? "Saved favourites" : state.query ? "Search results" : cat ? cat.name : "All tools";
    }
    // Rail state
    MTH.$$("[data-cat]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.dataset.cat === state.cat ? "true" : "false");
    });
    MTH.$$("[data-count-cat]").forEach(function (el) {
      el.textContent = MTH.tools.filter(function (t) { return t.cat === el.dataset.countCat; }).length;
    });
    MTH.$$("[data-filter-fav]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", state.favOnly ? "true" : "false");
    });
  }

  function renderRecents() {
    var host = MTH.$("[data-recent]");
    var wrap = MTH.$("[data-recent-wrap]");
    if (!host) return;
    var ids = MTH.store.get("recents", []);
    var tools = (Array.isArray(ids) ? ids : []).map(function (id) { return MTH.toolById(id); }).filter(Boolean).slice(0, 6);
    if (!tools.length) { if (wrap) wrap.hidden = true; return; }
    if (wrap) wrap.hidden = false;
    host.innerHTML = tools.map(function (t) {
      return '<a href="' + MTH.esc(MTH.sitePath(t.href)) + '">' + MTH.ui.icon(t.icon) + MTH.esc(t.short) + "</a>";
    }).join("");
  }

  function initSearch() {
    var input = MTH.$("[data-search]");
    var box = MTH.$("[data-search-box]");
    var clear = MTH.$("[data-search-clear]");
    if (!input) return;
    var apply = MTH.debounce(function () { state.query = input.value; render(); }, 90);
    input.addEventListener("input", function () {
      if (box) box.classList.toggle("has-value", !!input.value);
      apply();
    });
    if (clear) clear.addEventListener("click", function () { input.value = ""; state.query = ""; if (box) box.classList.remove("has-value"); input.focus(); render(); });
    document.addEventListener("keydown", function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
      if ((e.key === "/" && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault(); input.focus(); input.select();
      }
    });
    MTH.$$("[data-quick]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        input.value = btn.dataset.quick; state.query = input.value; state.cat = "all"; state.favOnly = false;
        if (box) box.classList.add("has-value");
        render(); input.focus();
      });
    });
  }

  function init() {
    render();
    renderRecents();
    initSearch();
    MTH.$$("[data-cat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.cat = btn.dataset.cat;
        state.favOnly = false;
        var url = state.cat === "all" ? location.pathname : "#" + state.cat;
        try { history.replaceState(null, "", url); } catch (e) {}
        render();
      });
    });
    var favBtn = MTH.$("[data-filter-fav]");
    if (favBtn) favBtn.addEventListener("click", function () {
      state.favOnly = !state.favOnly; state.cat = "all"; render();
    });
    var grid = MTH.$("[data-tool-grid]");
    if (grid) grid.addEventListener("click", function (e) {
      var fav = e.target.closest("[data-fav]");
      if (!fav) return;
      e.preventDefault();
      var id = fav.dataset.fav;
      var added = MTH.store.toggleFavorite(id);
      MTH.toast(added ? "Saved to favourites" : "Removed from favourites", added ? "ok" : "info", 2200);
      render();
    });
    function applyHash() {
      var hash = (location.hash || "").replace("#", "");
      if (MTH.categories.some(function (c) { return c.id === hash; })) { state.cat = hash; state.favOnly = false; render(); }
    }
    window.addEventListener("hashchange", applyHash);
    applyHash();
    // First-visit prompt: keep the brand's promise visible.
    if (!MTH.store.get("seenPrivacy", false)) {
      MTH.store.set("seenPrivacy", true);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
