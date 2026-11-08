/* ==========================================================================
   MULTI TOOL HUB — shared core
   Everything below runs in the browser. No network calls, no backend.
   ========================================================================== */
(function () {
  "use strict";

  var MTH = window.MTH = window.MTH || {};
  var scriptEl = document.currentScript;
  var assetsBase = scriptEl ? new URL("../", scriptEl.src).href : new URL("/assets/", location.href).href;
  var rootBase = scriptEl ? new URL("../../", scriptEl.src).href : new URL("/", location.href).href;

  MTH.version = "6.0";
  MTH.credit = "\u00A9 2026 MULTI TOOL HUB \u00B7 Developed by chank!nd3 p4d4y41! l FAYAS MONU";
  MTH.assets = assetsBase;
  MTH.root = rootBase;
  MTH.asset = function (path) { return new URL(path, assetsBase).href; };
  MTH.sitePath = function (path) { return new URL(path, rootBase).href; };
  MTH.cancelled = new Error("Cancelled");

  /* ---------- DOM ---------- */
  MTH.$ = function (sel, root) { return (root || document).querySelector(sel); };
  MTH.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  MTH.esc = function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  };
  MTH.el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (key) {
      if (key === "class") node.className = attrs[key];
      else if (key === "text") node.textContent = attrs[key];
      else if (key === "html") node.innerHTML = attrs[key];
      else if (key === "dataset") Object.keys(attrs[key]).forEach(function (k) { node.dataset[k] = attrs[key][k]; });
      else if (key.slice(0, 2) === "on" && typeof attrs[key] === "function") node.addEventListener(key.slice(2), attrs[key]);
      else if (attrs[key] != null) node.setAttribute(key, attrs[key]);
    });
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (child) {
        if (child == null) return;
        node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
      });
    }
    return node;
  };

  /* ---------- basic helpers ---------- */
  MTH.clamp = function (v, min, max) { return v < min ? min : v > max ? max : v; };
  MTH.uid = function () { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); };
  MTH.sleep = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms || 0); }); };
  MTH.debounce = function (fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 140); }; };
  MTH.throttle = function (fn, ms) { var last = 0, t; return function () { var now = Date.now(), a = arguments, c = this; if (now - last >= (ms || 100)) { last = now; fn.apply(c, a); } else { clearTimeout(t); t = setTimeout(function () { last = Date.now(); fn.apply(c, a); }, (ms || 100) - (now - last)); } }; };
  MTH.fmtBytes = function (bytes) {
    if (bytes == null || isNaN(bytes)) return "0 B";
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + " GB";
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
    if (bytes >= 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
    return Math.round(bytes) + " B";
  };
  MTH.baseName = function (name) { return String(name || "file").replace(/\.[^.]+$/, ""); };
  MTH.ext = function (name) { var m = String(name || "").match(/\.[^.]+$/); return m ? m[0].toLowerCase() : ""; };
  MTH.safeName = function (name) { return String(name || "file").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 160); };
  MTH.uniqueName = function (name, used) {
    var base = MTH.baseName(name), ext = MTH.ext(name), out = name, n = 2;
    while (used[out.toLowerCase()]) { out = base + " (" + n + ")" + ext; n++; }
    used[out.toLowerCase()] = true;
    return out;
  };
  MTH.fmtDate = function (date) { return new Date(date).toLocaleString(); };

  /* ---------- storage ---------- */
  MTH.store = {
    prefix: "mth.",
    key: function (key) { return this.prefix + key; },
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(this.key(key));
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(this.key(key), JSON.stringify(value)); return true; }
      catch (e) { MTH.toast("This browser blocked local storage. Your preferences will only last for this tab.", "warn"); return false; }
    },
    remove: function (key) { try { localStorage.removeItem(this.key(key)); } catch (e) {} },
    favorites: function () { var v = this.get("favorites", []); return Array.isArray(v) ? v : []; },
    isFavorite: function (id) { return this.favorites().indexOf(id) !== -1; },
    toggleFavorite: function (id) {
      var list = this.favorites(), i = list.indexOf(id);
      if (i === -1) list.push(id); else list.splice(i, 1);
      this.set("favorites", list);
      return i === -1;
    },
    pushRecent: function (id) {
      if (!id) return;
      var list = this.get("recents", []);
      if (!Array.isArray(list)) list = [];
      list = list.filter(function (x) { return x !== id; });
      list.unshift(id);
      this.set("recents", list.slice(0, 8));
    }
  };

  /* ---------- theme ---------- */
  MTH.theme = {
    current: function () {
      var t = document.documentElement.getAttribute("data-theme");
      if (t === "light" || t === "dark") return t;
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    },
    paint: function () {
      var dark = this.current() === "dark";
      var iconName = dark ? "sun" : "moon";
      MTH.$$("[data-theme-toggle]").forEach(function (btn) {
        btn.innerHTML = MTH.ui.icon(iconName);
        btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
        btn.setAttribute("title", dark ? "Switch to light theme" : "Switch to dark theme");
        btn.setAttribute("aria-pressed", dark ? "true" : "false");
      });
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", dark ? "#0b100e" : "#f5f2ea");
    },
    set: function (theme) {
      document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
      try { localStorage.setItem("mth.theme", theme === "dark" ? "dark" : "light"); } catch (e) {}
      this.paint();
      try { window.dispatchEvent(new CustomEvent("mth:theme", { detail: theme })); } catch (e) {}
    },
    toggle: function () { this.set(this.current() === "dark" ? "light" : "dark"); },
    init: function () {
      var self = this;
      self.paint();
      document.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-theme-toggle]");
        if (btn) self.toggle();
      });
      if (window.matchMedia) {
        try {
          var mq = window.matchMedia("(prefers-color-scheme: dark)");
          var onChange = function (e) {
            if (!localStorage.getItem("mth.theme")) {
              document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
              self.paint();
            }
          };
          if (mq.addEventListener) mq.addEventListener("change", onChange); else if (mq.addListener) mq.addListener(onChange);
        } catch (e) {}
      }
    }
  };

  /* ---------- icons ---------- */
  var iconPaths = {
    merge: '<path d="M7 4H4v3M17 4h3v3M7 20H4v-3M17 20h3v-3"/><path d="M8 12h8M12 8l4 4-4 4"/>',
    split: '<path d="M12 3v6M8 13H4v7h7M20 13h-7v7h7z"/><path d="M9 9l-4 4M15 9l4 4"/>',
    organize: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    rotate: '<path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 4v7h-7"/>',
    compress: '<path d="M4 9h6V3M20 15h-6v6M9 9 3 3M15 15l6 6"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>',
    viewer: '<path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    watermark: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h5"/><path d="m15 16 5 5M20 16l-5 5"/>',
    hash: '<path d="M5 9h14M5 15h14M10 3 8 21M16 3l-2 18"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    images: '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h14v14"/><circle cx="8" cy="11" r="1.4"/><path d="m17 20-4-4L5 20"/>',
    text: '<path d="M4 6h16M4 6V4h16v2M12 6v14M8 20h8"/>',
    word: '<path d="M4 4h16v16H4z"/><path d="m7 9 2 7 2-5 2 5 2-7"/>',
    excel: '<path d="M4 4h16v16H4z"/><path d="m8 8 8 8M16 8l-8 8"/>',
    convert: '<path d="M4 7h13l-3-3M20 17H7l3 3"/><path d="M4 7l3 3M20 17l-3-3"/>',
    eraser: '<path d="m5 16 7-7 7 7-4 4H9z"/><path d="M3 21h18"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
    audio: '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    'arrow-right': '<path d="M4 12h16M14 6l6 6-6 6"/>',
    'arrow-left': '<path d="M20 12H4M10 6l-6 6 6 6"/>',
    'arrow-up': '<path d="M12 20V4M6 10l6-6 6 6"/>',
    'arrow-down': '<path d="M12 4v16M6 14l6 6 6-6"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.3A8 8 0 0 1 9.7 4 8.1 8.1 0 1 0 20 14.3Z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 18v3h16v-3"/>',
    file: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v6h6"/>',
    pdf: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v6h6M9 14h6M9 17h4"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
    'eye-off': '<path d="m3 3 18 18"/><path d="M10.6 6.2A10.5 10.5 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3 3.7M6.3 6.8C3.6 8.6 2 12 2 12s3.5 6 10 6a10 10 0 0 0 4-.8"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    expand: '<path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"/>',
    save: '<path d="M4 4h13l3 3v13H4z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
    undo: '<path d="M9 7 4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 6 6"/>',
    redo: '<path d="m15 7 5 5-5 5"/><path d="M20 12h-9a6 6 0 0 0-6 6"/>',
    select: '<path d="m4 3 7 18 2.5-7.5L21 11z"/>',
    pen: '<path d="m4 20 4-1 11-11-3-3L5 16z"/><path d="m14 7 3 3"/>',
    shape: '<rect x="3" y="5" width="12" height="9" rx="1"/><circle cx="17" cy="17" r="4"/>',
    type: '<path d="M4 6V4h16v2M12 4v16M8 20h8"/>',
    highlight: '<path d="m4 20 4-1 11-11-3-3L5 16z"/><path d="M3 22h18"/>',
    underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4"/><path d="M5 21h14"/>',
    strike: '<path d="M4 12h16"/><path d="M8 7a4.5 4.5 0 0 1 8-1M8 17a4.5 4.5 0 0 0 8 1"/>',
    note: '<path d="M4 4h16v11l-5 5H4z"/><path d="M20 15h-5v5"/><path d="M8 8h8M8 11h5"/>',
    signature: '<path d="M3 17c2.5-6 4.5-8 5.5-7s-.5 7 1.5 7 2.5-8 4.5-8 1 5 2 5 2-1.5 4-2"/><path d="M3 21h18"/>',
    replace: '<path d="M4 7h10M10 3l4 4-4 4"/><path d="M20 17H10M14 13l-4 4 4 4"/>',
    redact: '<rect x="4" y="7" width="16" height="10" rx="1"/><path d="M4 7V4M20 7V4M4 20v-3M20 20v-3"/>',
    'image-plus': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/>',
    alert: '<path d="M12 3 2 21h20z"/><path d="M12 9v5M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    play: '<path d="m7 4 13 8-13 8z"/>',
    pause: '<path d="M8 4v16M16 4v16"/>',
    reset: '<path d="M4 11a8 8 0 1 1 2.3 6.3"/><path d="M4 4v7h7"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V4H4v12h4"/>',
    external: '<path d="M14 3h7v7M10 14 21 3"/><path d="M21 14v7H3V3h7"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    spark: '<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h2.5A6.5 6.5 0 0 0 21 6.5C19.5 4.3 16.3 3 12 3Z"/><circle cx="7.5" cy="10" r="1"/><circle cx="10" cy="6.5" r="1"/><circle cx="15" cy="6.5" r="1"/><circle cx="17.5" cy="10" r="1"/>',
    wand: '<path d="m4 20 10-10M13 4l1-2M18 9l2-1M19 14l2 1M14 17l1 2"/><path d="m12 8 4 4"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    move: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9 3 12l3 3M18 9l3 3-3 3"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14-4L4 9"/><path d="M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2"/><path d="M20 20v-5h-5"/>',
    'zoom-in': '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5M8 11h6M11 8v6"/>',
    'zoom-out': '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5M8 11h6"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.1 8.1 12 11.8M8.1 15.9 20.1 4"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M9 4v16M15 4v16"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0"/>',
    youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.2 6.8h.01"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/>'
  };

  MTH.ui = MTH.ui || {};
  MTH.ui.icon = function (name, cls, size) {
    var path = iconPaths[name] || iconPaths.file;
    var s = size || 24;
    return '<svg class="' + (cls || "") + '" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + path + "</svg>";
  };
  MTH.ui.hydrateIcons = function (root) {
    MTH.$$("[data-icon]", root).forEach(function (node) {
      if (node.dataset.iconDone) return;
      node.innerHTML = MTH.ui.icon(node.dataset.icon, "", node.dataset.iconSize || 24);
      node.dataset.iconDone = "1";
    });
  };

  /* ---------- feedback ---------- */
  MTH.toast = function (message, type, ms) {
    var stack = document.getElementById("mth-toasts");
    if (!stack) {
      stack = MTH.el("div", { id: "mth-toasts", class: "toast-stack", "aria-live": "polite" });
      document.body.appendChild(stack);
    }
    var kind = type || "info";
    var node = MTH.el("div", { class: "toast toast--" + kind, role: "status" });
    var ic = kind === "err" ? "alert" : kind === "ok" ? "check-circle" : kind === "warn" ? "alert" : "info";
    node.innerHTML = MTH.ui.icon(ic) + "<span>" + MTH.esc(message) + "</span>";
    stack.appendChild(node);
    setTimeout(function () {
      node.style.opacity = "0";
      node.style.transform = "translateY(8px)";
      setTimeout(function () { node.remove(); }, 220);
    }, ms || 4200);
    return node;
  };
  MTH.status = function (target, message, kind) {
    var el = typeof target === "string" ? document.getElementById(target) : target;
    if (!el) return null;
    el.textContent = message || "";
    el.className = "status" + (kind ? " " + kind : "");
    return el;
  };
  MTH.progress = function (target, value, label) {
    var el = typeof target === "string" ? document.getElementById(target) : target;
    if (!el) return;
    var wrap = el.classList && el.classList.contains("progress") ? el : el.querySelector ? el.querySelector(".progress") : null;
    if (!wrap) return;
    var bar = wrap.querySelector("span");
    if (value == null || value < 0) {
      wrap.classList.remove("show");
      if (bar) bar.style.width = "0%";
      return;
    }
    wrap.classList.add("show");
    var pct = MTH.clamp(value, 0, 1) * 100;
    if (bar) bar.style.width = pct + "%";
    if (label) {
      var lab = wrap.parentElement && wrap.parentElement.querySelector(".progress-label");
      if (lab) lab.textContent = label;
    }
  };
  MTH.setProgress = function (el, labelEl, value, label) {
    if (el) {
      el.classList.toggle("show", value != null);
      var bar = el.querySelector("span");
      if (bar) bar.style.width = value == null ? "0%" : MTH.clamp(value, 0, 1) * 100 + "%";
    }
    if (labelEl && label != null) labelEl.textContent = label;
  };
  MTH.busy = function (buttons, on) {
    (Array.isArray(buttons) ? buttons : [buttons]).forEach(function (btn) {
      if (!btn) return;
      if (on) {
        if (!btn.dataset.original) btn.dataset.original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>' + (btn.dataset.busyText || "Working…");
      } else {
        btn.disabled = false;
        if (btn.dataset.original) btn.innerHTML = btn.dataset.original;
      }
    });
  };

  /* ---------- error boundary ---------- */
  MTH.friendlyError = function (err) {
    var msg = (err && (err.message || err.reason || err)) + "";
    if (/password|PasswordException|encrypt/i.test(msg)) return "This PDF is password-protected. Use PDF Unlock with the correct password, then continue.";
    if (/InvalidPDF|Invalid PDF|not a PDF|Failed to parse|damaged|structure/i.test(msg)) return "This file could not be read as a PDF. It may be damaged, or it may not be a PDF.";
    if (/QuotaExceeded|out of memory|Array buffer allocation|allocation failed|too large|canvas/i.test(msg)) return "This browser ran out of working memory. Try a smaller file, fewer pages, a lower resolution, or close other tabs and try again.";
    if (/NotAllowedError|SecurityError|permission/i.test(msg)) return "The browser blocked that action. Check the site permissions, then try again.";
    if (/NotSupportedError|not supported|codec/i.test(msg)) return "This browser cannot process that format or codec. Try a different file, or use Chrome, Edge, Firefox or Safari 16+.";
    if (/NetworkError|fetch/i.test(msg)) return "A required local resource could not be loaded. Refresh the page and try again.";
    return msg && msg !== "undefined" ? msg : "Something unexpected went wrong. Refresh the page and try again.";
  };
  MTH.reportError = function (err, context) {
    try { console.error("[MTH]", context || "error", err); } catch (e) {}
    if (err && err.cancelled) return;
    var box = document.getElementById("mth-error-boundary");
    if (box) box.remove();
    box = MTH.el("div", { id: "mth-error-boundary", class: "error-boundary", role: "alert" });
    box.innerHTML =
      MTH.ui.icon("alert") +
      '<div><b>That action could not be completed.</b><p>' + MTH.esc(MTH.friendlyError(err)) + "</p>" +
      '<div class="eb-actions"><button class="btn btn--sm btn--ghost" data-eb-reload>Reload page</button>' +
      '<button class="btn btn--sm btn--subtle" data-eb-dismiss>Dismiss</button></div></div>' +
      '<button class="icon-btn icon-btn--sm icon-btn--plain eb-close" data-eb-dismiss aria-label="Dismiss error">' + MTH.ui.icon("close") + "</button>";
    document.body.appendChild(box);
    box.addEventListener("click", function (e) {
      if (e.target.closest("[data-eb-dismiss]")) box.remove();
      if (e.target.closest("[data-eb-reload]")) location.reload();
    });
    setTimeout(function () { if (box.isConnected) box.remove(); }, 14000);
  };
  MTH.guard = function (fn, context) {
    return function () {
      try { var r = fn.apply(this, arguments); if (r && typeof r.catch === "function") r.catch(function (e) { MTH.reportError(e, context); }); return r; }
      catch (e) { MTH.reportError(e, context); }
    };
  };
  window.addEventListener("error", function (e) {
    if (!e || !e.message) return;
    if (/ResizeObserver loop/i.test(e.message)) return;
    MTH.reportError(e.error || e, "window");
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    if (r && r.cancelled) { e.preventDefault(); return; }
    MTH.reportError(r, "promise");
    if (e && e.preventDefault) e.preventDefault();
  });

  /* ---------- modal ---------- */
  MTH.modal = function (opts) {
    opts = opts || {};
    var existing = document.querySelector(".modal");
    if (existing) existing.remove();
    var overlay = MTH.el("div", { class: "modal" });
    var box = MTH.el("div", { class: "modal-box" + (opts.size ? " modal-box--" + opts.size : "") });
    var head = MTH.el("div", { class: "modal-head" });
    head.innerHTML = '<div><h2>' + MTH.esc(opts.title || "MULTI TOOL HUB") + "</h2>" + (opts.subtitle ? "<p>" + MTH.esc(opts.subtitle) + "</p>" : "") + "</div>";
    var closeBtn = MTH.el("button", { class: "icon-btn icon-btn--sm", type: "button", "aria-label": "Close dialog" });
    closeBtn.innerHTML = MTH.ui.icon("close");
    closeBtn.addEventListener("click", close);
    head.appendChild(closeBtn);
    var body = MTH.el("div", { class: "modal-body" });
    if (opts.body instanceof Node) body.appendChild(opts.body); else body.innerHTML = opts.body || "";
    var foot = MTH.el("div", { class: "modal-foot" });
    var credit = MTH.el("span", { class: "modal-credit", text: MTH.credit });
    var actions = MTH.el("div", { class: "modal-actions" });
    if (opts.actions) actions.innerHTML = opts.actions;
    foot.appendChild(credit);
    foot.appendChild(actions);
    box.appendChild(head); box.appendChild(body); box.appendChild(foot);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.body.classList.add("modal-open");
    var lastFocus = document.activeElement;
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      if (!document.querySelector(".modal")) document.body.classList.remove("modal-open");
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) { if (e.key === "Escape") { e.preventDefault(); close(); } }
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay && opts.dismissible !== false) close(); });
    setTimeout(function () {
      var focusable = box.querySelector("input, textarea, select, button:not(.modal-head button)");
      if (focusable) focusable.focus();
    }, 40);
    return { el: box, body: body, actions: actions, close: close };
  };

  MTH.confirm = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var m = MTH.modal({
        title: opts.title || "Please confirm",
        size: "sm",
        body: '<p style="font-size:.86rem;color:var(--muted);line-height:1.65">' + MTH.esc(opts.message || "") + "</p>",
        actions: '<button class="btn btn--sm btn--ghost" data-no>' + MTH.esc(opts.cancelText || "Cancel") + '</button><button class="btn btn--sm ' + (opts.danger ? "btn--danger" : "") + '" data-yes>' + MTH.esc(opts.confirmText || "Continue") + "</button>",
        onClose: function () { resolve(false); }
      });
      m.actions.querySelector("[data-no]").addEventListener("click", function () { m.close(); });
      m.actions.querySelector("[data-yes]").addEventListener("click", function () { resolve(true); m.close(); });
    });
  };

  /* ---------- download / zip ---------- */
  var mimeByExt = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", txt: "text/plain;charset=utf-8", csv: "text/csv;charset=utf-8", json: "application/json", zip: "application/zip", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", mp3: "audio/mpeg", wav: "audio/wav", webm: "video/webm", mp4: "video/mp4" };
  MTH.download = function (data, name, type) {
    var blob;
    if (data instanceof Blob) blob = data;
    else if (data instanceof Uint8Array) blob = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)], { type: type || mimeByExt[MTH.ext(name).slice(1)] || "application/octet-stream" });
    else if (data instanceof ArrayBuffer) blob = new Blob([data], { type: type || mimeByExt[MTH.ext(name).slice(1)] || "application/octet-stream" });
    else blob = new Blob([data], { type: type || mimeByExt[MTH.ext(name).slice(1)] || "application/octet-stream" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = MTH.safeName(name || "download");
    a.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    return blob;
  };
  MTH.read = async function (file) {
    if (file instanceof Uint8Array) return file;
    if (file instanceof ArrayBuffer) return new Uint8Array(file);
    if (file && typeof file.arrayBuffer === "function") return new Uint8Array(await file.arrayBuffer());
    throw new Error("No readable file was supplied.");
  };
  MTH.zipBlob = async function (entries, onProgress) {
    if (typeof JSZip === "undefined") throw new Error("The ZIP engine did not load. Refresh the page and try again.");
    if (!entries || !entries.length) throw new Error("There are no files to place in the ZIP archive.");
    var zip = new JSZip();
    var used = {};
    entries.forEach(function (entry) {
      zip.file(MTH.uniqueName(entry.name || "file", used), entry.data);
    });
    return await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }, function (meta) {
      if (onProgress) onProgress(meta.percent / 100);
    });
  };
  MTH.zip = async function (entries, name, onProgress) {
    var blob = await MTH.zipBlob(entries, onProgress);
    MTH.download(blob, name || "multi-tool-hub.zip", "application/zip");
    return blob;
  };

  /* ---------- ranges ---------- */
  MTH.ranges = function (text, count, opts) {
    var out = [];
    function add(v) { var k = v - 1; if (k >= 0 && k < count && out.indexOf(k) === -1) out.push(k); }
    var parts = String(text == null ? "" : text).split(/[,;]/);
    var any = false;
    parts.forEach(function (part) {
      part = part.trim();
      if (!part) return;
      var m = part.match(/^(\d+)\s*(?:-|–|to)\s*(\d+)$/i), a, b;
      if (m) { a = +m[1]; b = +m[2]; }
      else if (/^(\d*)\s*-\s*(\d*)$/.test(part)) { var mm = part.match(/^(\d*)\s*-\s*(\d*)$/); a = mm[1] ? +mm[1] : 1; b = mm[2] ? +mm[2] : count; }
      else if (/^(all|\*)$/i.test(part)) { a = 1; b = count; }
      else if (/^\d+$/.test(part)) { a = b = +part; }
      else throw new Error('"' + part + '" is not a valid page or range. Try 1-3, 5, 8-.');
      if (a < 1 || b > count || a > b) throw new Error("Pages must be between 1 and " + count + ' (you entered "' + part + '").');
      for (var i = a; i <= b; i++) add(i);
      any = true;
    });
    if (!any || !out.length) throw new Error("Enter at least one page or range, for example 1-3, 5.");
    out.sort(function (x, y) { return x - y; });
    return out;
  };
  MTH.rangesText = function (list) {
    var a = list.slice().sort(function (x, y) { return x - y; }), out = [], i = 0;
    while (i < a.length) {
      var s = a[i], e = s;
      while (i + 1 < a.length && a[i + 1] === e + 1) { e = a[i + 1]; i++; }
      out.push(s === e ? String(s + 1) : e === s + 1 ? s + 1 + ", " + (e + 1) : s + 1 + "-" + (e + 1));
      i++;
    }
    return out.join(", ");
  };

  /* ---------- file input / drop ---------- */
  function acceptance(accept) {
    if (!accept) return function () { return true; };
    var parts = String(accept).split(",").map(function (p) { return p.trim().toLowerCase(); }).filter(Boolean);
    return function (file) {
      if (!file) return false;
      var type = (file.type || "").toLowerCase(), name = (file.name || "").toLowerCase();
      return parts.some(function (p) {
        if (p.charAt(0) === ".") return name.slice(-p.length) === p;
        if (p.slice(-2) === "/*") return type.indexOf(p.slice(0, -1)) === 0;
        return type === p;
      });
    };
  }
  MTH.accepts = acceptance;
  MTH.drop = function (zone, opts) {
    opts = opts || {};
    if (!zone) return;
    var input = zone.querySelector('input[type="file"]');
    if (!input) return;
    if (opts.accept) input.setAttribute("accept", opts.accept);
    if (opts.multiple) input.setAttribute("multiple", "multiple"); else input.removeAttribute("multiple");
    var ok = acceptance(opts.accept);
    var dragging = 0;
    function take(fileList) {
      var files = Array.prototype.slice.call(fileList || []);
      var accepted = files.filter(ok);
      if (!accepted.length) {
        MTH.toast("That file type is not supported here. " + (opts.acceptHint || ""), "warn");
        return;
      }
      if (accepted.length < files.length) MTH.toast((files.length - accepted.length) + " file(s) skipped because the type did not match.", "warn");
      if (opts.onFiles) opts.onFiles(accepted);
    }
    zone.addEventListener("click", function (e) {
      if (e.target.closest("input")) return;
      input.click();
    });
    zone.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
    });
    input.addEventListener("change", function () {
      take(input.files);
      input.value = "";
    });
    zone.addEventListener("dragenter", function (e) { e.preventDefault(); dragging++; zone.classList.add("is-over"); });
    zone.addEventListener("dragover", function (e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; });
    zone.addEventListener("dragleave", function (e) { e.preventDefault(); dragging = Math.max(0, dragging - 1); if (!dragging) zone.classList.remove("is-over"); });
    zone.addEventListener("drop", function (e) {
      e.preventDefault(); dragging = 0; zone.classList.remove("is-over");
      if (e.dataTransfer) take(e.dataTransfer.files);
    });
    return { input: input, take: take };
  };
  MTH.pick = function (accept, multiple) {
    return new Promise(function (resolve) {
      var input = document.createElement("input");
      input.type = "file"; input.accept = accept || ""; input.multiple = !!multiple;
      input.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(input);
      input.addEventListener("change", function () {
        var files = Array.prototype.slice.call(input.files || []);
        input.remove(); resolve(files);
      });
      input.click();
    });
  };

  /* ---------- UI templates ---------- */
  MTH.ui.dropzone = function (opts) {
    opts = opts || {};
    var accept = opts.accept || "";
    var meta = (opts.meta || []).map(function (t) { return '<span class="tag">' + MTH.esc(t) + "</span>"; }).join("");
    return '<div class="dropzone' + (opts.compact ? " dropzone--compact" : "") + '" data-dropzone tabindex="0" role="button" aria-label="' + MTH.esc(opts.title || "Choose a file") + '">' +
      '<input type="file" data-drop-input accept="' + MTH.esc(accept) + '"' + (opts.multiple ? " multiple" : "") + ">" +
      '<div class="dz-icon">' + MTH.ui.icon(opts.icon || "upload") + "</div>" +
      "<strong>" + MTH.esc(opts.title || "Choose a file or drop it here") + "</strong>" +
      '<span class="dz-sub">' + MTH.esc(opts.hint || "Processed entirely on this device. Nothing is uploaded.") + "</span>" +
      (meta ? '<span class="dz-meta">' + meta + "</span>" : "") +
      "</div>";
  };
  MTH.ui.fileList = function (files, opts) {
    opts = opts || {};
    return '<ul class="file-list">' + files.map(function (file, i) {
      var meta = opts.meta ? opts.meta(file, i) : MTH.fmtBytes(file.size);
      return '<li class="file-row" data-file-index="' + i + '">' +
        '<span class="file-num">' + (i + 1 < 10 ? "0" : "") + (i + 1) + "</span>" +
        '<span class="file-ic">' + MTH.ui.icon(opts.icon || "file") + "</span>" +
        '<span class="file-main"><span class="file-name" title="' + MTH.esc(file.name) + '">' + MTH.esc(file.name) + "</span><span class=\"file-meta\">" + MTH.esc(meta) + "</span></span>" +
        '<span class="file-actions">' +
        (opts.sortable ? '<button type="button" data-act="up" aria-label="Move up"' + (i === 0 ? " disabled" : "") + ">" + MTH.ui.icon("up") + "</button><button type=\"button\" data-act=\"down\" aria-label=\"Move down\"" + (i === files.length - 1 ? " disabled" : "") + ">" + MTH.ui.icon("down") + "</button>" : "") +
        (opts.remove !== false ? '<button type="button" data-act="remove" aria-label="Remove">' + MTH.ui.icon("trash") + "</button>" : "") +
        "</span></li>";
    }).join("") + "</ul>";
  };
  MTH.ui.stat = function (label, value, cls) {
    return '<div class="stat ' + (cls || "") + '"><b>' + MTH.esc(value) + "</b><span>" + MTH.esc(label) + "</span></div>";
  };
  MTH.ui.progress = function (id, label) {
    return '<div class="progress" id="' + id + '"><span></span></div><div class="progress-label" id="' + id + '-label">' + MTH.esc(label || "Ready") + "</div>";
  };
  MTH.ui.status = function (id) { return '<div class="status" id="' + id + '" role="status" aria-live="polite"></div>'; };
  MTH.ui.related = function (container, category, currentId) {
    if (!container) return;
    var list = (MTH.tools || []).filter(function (t) { return t.cat === category && t.id !== currentId; }).slice(0, 6);
    container.innerHTML = list.map(function (t) {
      return '<a href="' + MTH.esc(MTH.sitePath(t.href)) + '">' + MTH.ui.icon(t.icon) + "<span>" + MTH.esc(t.title) + "</span></a>";
    }).join("");
  };

  /* ---------- preview modal ---------- */
  MTH.preview = async function (opts) {
    opts = opts || {};
    var blob = opts.blob || null;
    if (!blob && opts.canvas) {
      blob = await new Promise(function (resolve) {
        if (!opts.canvas.toBlob) return resolve(null);
        opts.canvas.toBlob(function (b) { resolve(b); }, opts.type || "image/png", opts.quality || .92);
      });
    }
    if (!blob && opts.url) {
      try { blob = await (await fetch(opts.url)).blob(); } catch (e) {}
    }
    var url = blob ? URL.createObjectURL(blob) : opts.url;
    var overlay = MTH.el("div", { class: "modal" });
    var box = MTH.el("div", { class: "modal-box modal-box--full" });
    var head = MTH.el("div", { class: "preview-head" });
    head.innerHTML = '<div class="preview-title"><span class="tag tag--brass">Preview</span><b>' + MTH.esc(opts.title || "Preview") + "</b></div>" +
      '<div class="preview-tools">' +
      '<button class="icon-btn icon-btn--sm" data-z="out" aria-label="Zoom out">' + MTH.ui.icon("zoom-out") + "</button>" +
      '<span class="preview-pct" data-pct>100%</span>' +
      '<button class="icon-btn icon-btn--sm" data-z="in" aria-label="Zoom in">' + MTH.ui.icon("zoom-in") + "</button>" +
      '<button class="btn btn--sm btn--ghost" data-z="fit">Fit</button>' +
      '<button class="btn btn--sm btn--ghost" data-z="actual">100%</button>' +
      '<span style="width:5px"></span>' +
      '<a class="btn btn--sm btn--ghost" data-download download="' + MTH.esc(opts.downloadName || "preview.png") + '">' + MTH.ui.icon("download") + "Save</a>" +
      '<button class="icon-btn icon-btn--sm" data-close aria-label="Close preview">' + MTH.ui.icon("close") + "</button>" +
      "</div>";
    var stage = MTH.el("div", { class: "preview-stage" });
    var img = MTH.el("img", { alt: opts.title || "Preview", draggable: "false" });
    img.src = url;
    stage.appendChild(img);
    var foot = MTH.el("div", { class: "preview-foot" });
    foot.innerHTML = '<span class="preview-live">Local preview</span><span data-dims></span><span class="modal-credit">' + MTH.esc(MTH.credit) + "</span>";
    box.appendChild(head); box.appendChild(stage); box.appendChild(foot);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    document.body.classList.add("modal-open");
    var scale = 1, x = 0, y = 0, fitScale = 1, dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    function apply() {
      img.style.transform = "translate(-50%,-50%) translate(" + x + "px," + y + "px) scale(" + scale + ")";
      var pct = Math.round(scale / fitScale * 100);
      head.querySelector("[data-pct]").textContent = pct + "%";
    }
    function measure() {
      var nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
      var sw = stage.clientWidth - 48, sh = stage.clientHeight - 48;
      fitScale = Math.min(sw / nw, sh / nh, 1);
      if (!fitScale || !isFinite(fitScale)) fitScale = 1;
      foot.querySelector("[data-dims]").textContent = nw + " × " + nh + " px · " + MTH.fmtBytes(blob ? blob.size : 0);
      scale = fitScale; x = 0; y = 0; apply();
    }
    img.addEventListener("load", measure);
    if (img.complete) measure();
    setTimeout(measure, 60);
    function zoom(factor) { scale = MTH.clamp(scale * factor, fitScale * .25, 8); apply(); }
    head.addEventListener("click", function (e) {
      var z = e.target.closest("[data-z]");
      if (z) {
        if (z.dataset.z === "in") zoom(1.22);
        else if (z.dataset.z === "out") zoom(1 / 1.22);
        else if (z.dataset.z === "fit") { scale = fitScale; x = 0; y = 0; apply(); }
        else if (z.dataset.z === "actual") { scale = 1; x = 0; y = 0; apply(); }
      }
      if (e.target.closest("[data-close]")) close();
    });
    var dl = head.querySelector("[data-download]");
    if (url) dl.href = url;
    dl.addEventListener("click", function () { if (!blob) return; });
    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    stage.addEventListener("pointerdown", function (e) {
      dragging = true; sx = e.clientX; sy = e.clientY; ox = x; oy = y;
      stage.classList.add("dragging");
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    });
    stage.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      x = ox + (e.clientX - sx); y = oy + (e.clientY - sy); apply();
    });
    function endDrag() { dragging = false; stage.classList.remove("dragging"); }
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);
    stage.addEventListener("dblclick", function () { scale = scale > fitScale * 1.05 ? fitScale : 1; x = 0; y = 0; apply(); });
    function close() {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      if (!document.querySelector(".modal")) document.body.classList.remove("modal-open");
      if (blob && url) setTimeout(function () { URL.revokeObjectURL(url); }, 400);
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) {
      if (e.key === "Escape") close();
      else if (e.key === "+" || e.key === "=") zoom(1.15);
      else if (e.key === "-") zoom(1 / 1.15);
      else if (e.key === "0") { scale = fitScale; x = 0; y = 0; apply(); }
    }
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    return { close: close, el: box };
  };

  /* ---------- PDF engine ---------- */
  MTH.pdf = {
    workerReady: false,
    worker: function () {
      if (typeof pdfjsLib === "undefined") throw new Error("The PDF rendering engine did not load. Refresh the page and try again.");
      if (!this.workerReady) {
        try { pdfjsLib.GlobalWorkerOptions.workerSrc = MTH.asset("vendor/pdfjs/pdf.worker.min.js"); } catch (e) {}
        this.workerReady = true;
      }
      return pdfjsLib;
    },
    load: async function (file, password) {
      var lib = this.worker();
      var data = await MTH.read(file);
      var params = { data: data, isEvalSupported: false, useSystemFonts: true, cMapPacked: true };
      if (password) params.password = password;
      try {
        var task = lib.getDocument(params);
        return await task.promise;
      } catch (e) {
        var name = e && (e.name || "");
        var msg = (e && e.message) || "";
        if (name === "PasswordException" || /password/i.test(msg)) {
          var err = new Error(password ? "That password is incorrect." : "This PDF is password-protected.");
          err.needsPassword = true; err.incorrect = !!password;
          throw err;
        }
        if (name === "InvalidPDFException" || /Invalid PDF|not a PDF|structure/i.test(msg)) {
          throw new Error("This file could not be read as a PDF. It may be damaged or use an unsupported format.");
        }
        throw e;
      }
    },
    openWithPrompt: async function (file, password) {
      try { return await this.load(file, password); }
      catch (e) {
        if (!e.needsPassword) throw e;
        return await new Promise(function (resolve, reject) {
          var m = MTH.modal({
            title: "This PDF is protected",
            subtitle: "Enter the password you already know. It never leaves this device.",
            size: "sm",
            body: '<div class="field"><label for="pdf-pwd">PDF password</label><div class="inline" style="flex-wrap:nowrap"><input class="input" id="pdf-pwd" type="password" autocomplete="off" placeholder="Enter password"><button class="icon-btn" type="button" data-pwd-eye aria-label="Show password">' + MTH.ui.icon("eye") + '</button></div><div class="hint" data-pwd-msg>MULTI TOOL HUB does not crack or guess passwords.</div></div>',
            actions: '<button class="btn btn--sm btn--ghost" data-pwd-cancel>Cancel</button><button class="btn btn--sm" data-pwd-go>Unlock</button>',
            onClose: function () { var err = new Error("Password entry cancelled."); err.cancelled = true; reject(err); }
          });
          var input = m.body.querySelector("#pdf-pwd");
          var msg = m.body.querySelector("[data-pwd-msg]");
          var eye = m.body.querySelector("[data-pwd-eye]");
          eye.addEventListener("click", function () {
            input.type = input.type === "password" ? "text" : "password";
            eye.innerHTML = MTH.ui.icon(input.type === "password" ? "eye" : "eye-off");
          });
          m.actions.querySelector("[data-pwd-cancel]").addEventListener("click", function () { m.close(); });
          async function submit() {
            var pwd = input.value;
            if (!pwd) { msg.textContent = "Enter the password first."; msg.style.color = "var(--err)"; input.focus(); return; }
            MTH.busy(m.actions.querySelector("[data-pwd-go]"), true);
            try {
              var doc = await MTH.pdf.load(file, pwd);
              m.close();
              resolve(doc);
            } catch (err) {
              MTH.busy(m.actions.querySelector("[data-pwd-go]"), false);
              msg.textContent = err.incorrect ? "That password is incorrect. Try again." : MTH.friendlyError(err);
              msg.style.color = "var(--err)";
              input.select();
            }
          }
          m.actions.querySelector("[data-pwd-go]").addEventListener("click", submit);
          input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submit(); } });
        });
      }
    },
    render: async function (page, canvas, opts) {
      opts = opts || {};
      var scale = opts.scale || 1;
      var rotation = opts.rotation == null ? page.rotate : opts.rotation;
      var vp = page.getViewport({ scale: scale, rotation: rotation });
      var pr = opts.pixelRatio || Math.min(2.5, window.devicePixelRatio || 1);
      if (opts.maxPixels) {
        var maxPixels = opts.maxPixels, pixels = vp.width * vp.height * pr * pr;
        if (pixels > maxPixels) pr = Math.max(1, pr * Math.sqrt(maxPixels / pixels));
      }
      canvas.width = Math.max(1, Math.round(vp.width * pr));
      canvas.height = Math.max(1, Math.round(vp.height * pr));
      canvas.style.width = vp.width + "px";
      canvas.style.height = vp.height + "px";
      var ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("This browser could not create a canvas context.");
      ctx.setTransform(pr, 0, 0, pr, 0, 0);
      ctx.fillStyle = opts.background || "#ffffff";
      ctx.fillRect(0, 0, vp.width, vp.height);
      var task = page.render({ canvasContext: ctx, viewport: vp, background: opts.background || "#ffffff" });
      await task.promise;
      return { vp: vp, width: vp.width, height: vp.height, pixelRatio: pr, scale: scale };
    },
    renderToCanvas: async function (page, scale, rotation, opts) {
      opts = opts || {};
      var canvas = document.createElement("canvas");
      var info = await this.render(page, canvas, { scale: scale, rotation: rotation, pixelRatio: opts.pixelRatio || 2, background: opts.background || "#ffffff", maxPixels: opts.maxPixels });
      return { canvas: canvas, info: info };
    },
    toPdfPoint: function (viewport, x, y) {
      var p = viewport.convertToPdfPoint(x, y);
      return { x: p[0], y: p[1] };
    },
    openLib: async function (file) {
      if (typeof PDFLib === "undefined") throw new Error("The PDF writing engine did not load. Refresh the page and try again.");
      var bytes = await MTH.read(file);
      try { return await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false }); }
      catch (e) {
        var msg = (e && e.message) || "";
        if (/encrypt|password/i.test(msg)) throw new Error("This PDF is password-protected. Use the Unlock tool with the correct password first.");
        throw new Error("This PDF could not be opened for writing. It may be damaged or use an unsupported feature.");
      }
    },
    destroy: function (doc) { try { if (doc && doc.destroy) doc.destroy(); } catch (e) {} },
    pageRotation: function (page) { return ((page && page.rotate || 0) % 360 + 360) % 360; }
  };

  /* ---------- image engine ---------- */
  MTH.images = {
    load: async function (file) {
      var bitmap = null, url = null, img = null;
      try {
        if (window.createImageBitmap) {
          try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
          catch (e) { bitmap = await createImageBitmap(file); }
        }
      } catch (e) { bitmap = null; }
      if (!bitmap) {
        url = URL.createObjectURL(file);
        img = await new Promise(function (resolve, reject) {
          var image = new Image();
          image.onload = function () { resolve(image); };
          image.onerror = function () { reject(new Error("This image could not be decoded. Try a JPG, PNG or WebP file.")); };
          image.src = url;
        });
      }
      var source = bitmap || img;
      return {
        source: source,
        width: source.width || source.naturalWidth,
        height: source.height || source.naturalHeight,
        close: function () {
          if (bitmap && bitmap.close) { try { bitmap.close(); } catch (e) {} }
          if (url) URL.revokeObjectURL(url);
        }
      };
    },
    canvas: function (source, opts) {
      opts = opts || {};
      var w = source.width || source.naturalWidth, h = source.height || source.naturalHeight;
      var rotation = ((opts.rotate || 0) % 360 + 360) % 360;
      var swap = rotation % 180 !== 0;
      var scale = 1;
      if (opts.maxW || opts.maxH) {
        var sW = opts.maxW ? opts.maxW / w : Infinity;
        var sH = opts.maxH ? opts.maxH / h : Infinity;
        scale = Math.min(1, sW, sH);
      }
      if (opts.scale) scale *= opts.scale;
      var dw = Math.max(1, Math.round(w * scale)), dh = Math.max(1, Math.round(h * scale));
      var cw = swap ? dh : dw, ch = swap ? dw : dh;
      var canvas = document.createElement("canvas");
      canvas.width = cw; canvas.height = ch;
      var ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This browser could not create a canvas context.");
      if (opts.background !== false) {
        ctx.fillStyle = opts.background || "#ffffff";
        ctx.fillRect(0, 0, cw, ch);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate(rotation * Math.PI / 180);
      ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh);
      return canvas;
    },
    encode: async function (canvas, mime, quality) {
      var type = mime || "image/jpeg";
      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, type, quality == null ? .9 : quality); });
      if (!blob && type === "image/webp") {
        type = "image/png";
        blob = await new Promise(function (resolve) { canvas.toBlob(resolve, type, quality); });
      }
      if (!blob) throw new Error("The browser could not encode this image. Try a smaller image or a different format.");
      return { blob: blob, type: type, bytes: new Uint8Array(await blob.arrayBuffer()) };
    },
    fitCanvas: function (w, h, maxW, maxH) {
      var scale = Math.min(maxW / w, maxH / h, 1);
      return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)), scale: scale };
    }
  };

  /* ---------- copy ---------- */
  MTH.copy = async function (text, message) {
    try { await navigator.clipboard.writeText(text); MTH.toast(message || "Copied to clipboard", "ok"); }
    catch (e) {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); MTH.toast(message || "Copied to clipboard", "ok"); }
      catch (err) { MTH.toast("Press Ctrl+C to copy the selected text.", "warn"); }
      ta.remove();
    }
  };

  /* ---------- local action ripple ---------- */
  MTH.motion = function () {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.addEventListener("pointerdown", function (e) {
      var target = e.target.closest("[data-ripple], .btn, .icon-btn");
      if (!target || target.disabled) return;
      var rect = target.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height) * 1.8;
      var ripple = document.createElement("span");
      ripple.className = "mth-ripple";
      ripple.style.width = ripple.style.height = size + "px";
      ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
      ripple.style.top = (e.clientY - rect.top - size / 2) + "px";
      target.appendChild(ripple);
      setTimeout(function () { ripple.remove(); }, 640);
    });
  };

  /* ---------- mobile nav ---------- */
  MTH.mobileNav = function () {
    var btn = document.querySelector("[data-menu-toggle]");
    var nav = document.querySelector("[data-mobile-nav]");
    if (!btn || !nav) return;
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.innerHTML = MTH.ui.icon(open ? "close" : "menu");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) {
        nav.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); btn.innerHTML = MTH.ui.icon("menu");
      }
    });
  };

  /* ---------- service worker ---------- */
  MTH.registerSW = function () {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "http:" && location.protocol !== "https:") return;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(MTH.sitePath("sw.js")).catch(function (e) {
        try { console.warn("[MTH] Service worker registration failed", e); } catch (err) {}
      });
    });
  };

  /* ---------- init ---------- */
  MTH.init = function () {
    MTH.theme.init();
    MTH.mobileNav();
    MTH.motion();
    MTH.ui.hydrateIcons();
    var body = document.body;
    var toolId = body && body.dataset.toolId;
    if (toolId) MTH.store.pushRecent(toolId);
    MTH.$$("[data-related]").forEach(function (node) {
      var cat = node.dataset.related;
      MTH.ui.related(node, cat, toolId);
    });
    MTH.$$("[data-credit-copy]").forEach(function (node) {
      node.title = "Copy developer credit";
      node.addEventListener("click", function () { MTH.copy(MTH.credit, "Developer credit copied"); });
    });
    MTH.registerSW();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", MTH.init);
  else MTH.init();

  /* Expose a small diagnostic surface without leaking any user file data. */
  MTH.diagnostics = function () {
    return { version: MTH.version, theme: MTH.theme.current(), tools: (MTH.tools || []).length, online: navigator.onLine, memory: performance && performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + " MB" : "n/a" };
  };
})();

;(function(){var s=document.createElement("script");s.src=MTH.asset("js/assistant.js");s.defer=true;document.head.appendChild(s);})();
