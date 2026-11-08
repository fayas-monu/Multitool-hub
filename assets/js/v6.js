/* ==========================================================================
   MULTI TOOL HUB v6 — brand shell, fixed logo, credits, motion, AI launcher
   Loaded last on every canonical page.
   ========================================================================== */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;
  var CREDIT = "\u00A9 2026 MULTI TOOL HUB \u00B7 Developed by chank!nd3 p4d4y41! l FAYAS MONU";
  MTH.version = "6.0";
  MTH.credit = CREDIT;

  var depth = (location.pathname.replace(/\\/g, "/").match(/\//g) || []).length;
  var inSub = /\/tools\/|\/legal\//.test(location.pathname.replace(/\\/g, "/"));
  var base = inSub ? "../" : "";
  function href(p) { return base + p; }
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function icon(name, size) {
    try { return MTH.ui.icon(name, "", size || 15); } catch (e) { return ""; }
  }

  /* ---------- logo lockup ---------- */
  function fixLogo() {
    document.querySelectorAll("svg.brand-mark").forEach(function (svg) {
      var span = document.createElement("span");
      span.className = "brand-mark brand-mark--v6";
      span.setAttribute("role", "img");
      span.setAttribute("aria-label", "MTH");
      span.textContent = "MTH";
      if (svg.parentNode) svg.parentNode.replaceChild(span, svg);
    });
    document.querySelectorAll(".brand-mark:not(.brand-mark--v6)").forEach(function (el) {
      el.classList.add("brand-mark--v6");
      el.textContent = "MTH";
    });
    document.querySelectorAll(".brand-tag").forEach(function (el) {
      el.textContent = "Local-first productivity suite";
    });
  }

  /* ---------- navigation / header ---------- */
  function fixNav() {
    document.querySelectorAll(".header-nav a, .mobile-nav a").forEach(function (a) {
      var h = a.getAttribute("href") || "";
      if (/#focus|focus-studio|entertainment/.test(h)) {
        a.textContent = "After Hours";
        if (/#focus/.test(h) && !/entertainment\.html/.test(a.textContent)) {
          a.setAttribute("href", href("entertainment.html"));
          if (a.querySelector("span")) a.innerHTML = "After Hours <span aria-hidden=\"true\">&rarr;</span>";
        }
      }
    });
    document.querySelectorAll('.footer-col a[href*="#focus"]').forEach(function (a) {
      a.setAttribute("href", href("entertainment.html"));
      a.textContent = "After Hours";
    });
    // Add a persistent AI button to header actions once.
    var actions = document.querySelector(".header-actions");
    if (actions && !actions.querySelector("[data-ai-open]")) {
      var ai = document.createElement("button");
      ai.type = "button";
      ai.className = "header-ai-btn";
      ai.setAttribute("data-ai-open", "");
      ai.setAttribute("aria-label", "Open Hub Assistant");
      ai.innerHTML = '<span class="ai-dot" aria-hidden="true"></span>' + icon("spark", 14) + '<span class="ai-label">Assistant</span>';
      actions.insertBefore(ai, actions.firstChild);
    }
    // Ensure every page links the entertainment page in the footer.
    var products = document.querySelectorAll(".footer-col");
    if (products.length) {
      var nav = products[0];
      if (nav && !nav.querySelector('a[href$="entertainment.html"]')) {
        var link = document.createElement("a");
        link.href = href("entertainment.html");
        link.textContent = "After Hours";
        nav.appendChild(link);
      }
    }
  }

  /* ---------- credits / version ---------- */
  function fixCredits() {
    document.querySelectorAll(".credit, [data-credit-copy]").forEach(function (el) {
      el.textContent = CREDIT;
      el.setAttribute("data-credit-copy", "");
      el.setAttribute("title", "Copy developer credit");
    });
    // Direct text-node sweep for stale legacy credits.
    var walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var v = node.nodeValue || "";
      if (/Fayaz Mon\.?|Unique Hacker|chank!nd3/i.test(v) && !/FAYAS MONU/.test(v)) {
        if (v.length < 160) node.nodeValue = CREDIT;
      }
    });
    document.querySelectorAll(".footer-meta").forEach(function (el) {
      el.textContent = "Static build \u00B7 v" + MTH.version + " \u00B7 2026";
    });
  }

  /* ---------- dynamic counts ---------- */
  function fixCounts() {
    var n = (MTH.tools || []).length;
    document.querySelectorAll("[data-total-tools]").forEach(function (el) { el.textContent = n; });
    document.querySelectorAll('input[data-search]').forEach(function (input) {
      input.setAttribute("placeholder", "Search " + n + " tools \u2014 try \u201cmerge pdf\u201d");
    });
    document.querySelectorAll("[data-total-workspaces]").forEach(function (el) { el.textContent = (MTH.categories || []).length; });
  }

  /* ---------- AI launcher ---------- */
  function openAssistant(seed) {
    if (window.MTHAssistant && window.MTHAssistant.open) {
      window.MTHAssistant.open(seed);
      return true;
    }
    window.dispatchEvent(new CustomEvent("mth:ai-open", { detail: { seed: seed || "" } }));
    return false;
  }
  window.MTHOpenAssistant = openAssistant;

  document.addEventListener("click", function (e) {
    var open = e.target.closest("[data-ai-open]");
    if (open) {
      e.preventDefault();
      openAssistant(open.getAttribute("data-ai-prompt") || open.getAttribute("data-ai-seed") || "");
      return;
    }
    var prompt = e.target.closest("[data-ai-prompt]");
    if (prompt) {
      e.preventDefault();
      openAssistant(prompt.getAttribute("data-ai-prompt") || "");
    }
  });

  /* ---------- 3D tilt ---------- */
  function bindTilt() {
    if (!window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    document.querySelectorAll(".tool-card, .v6-deck, .v6-exp, .ent-card, .hero-panel").forEach(function (card) {
      if (card.dataset.v6tilt) return;
      card.dataset.v6tilt = "1";
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - .5;
        var py = (e.clientY - r.top) / r.height - .5;
        card.style.setProperty("--ry", (px * 5.5).toFixed(2) + "deg");
        card.style.setProperty("--rx", (-py * 4.5).toFixed(2) + "deg");
      });
      card.addEventListener("pointerleave", function () {
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--rx", "0deg");
      });
    });
  }

  /* ---------- reveal ---------- */
  function bindReveal() {
    var els = document.querySelectorAll("[data-reveal], .home-section, .v6-section, .ent-section");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    els.forEach(function (el, i) {
      if (!el.hasAttribute("data-reveal")) el.setAttribute("data-reveal", "");
      if (i < 6) el.style.transitionDelay = Math.min(i * 55, 220) + "ms";
      io.observe(el);
    });
  }

  /* ---------- misc polish ---------- */
  function polish() {
    document.documentElement.setAttribute("data-v6", "1");
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      m.setAttribute("content", dark ? "#071a33" : "#f3f5f8");
    });
    // Keep the theme-color in sync when the theme button is used.
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        setTimeout(function () {
          var dark = document.documentElement.getAttribute("data-theme") === "dark";
          document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
            m.setAttribute("content", dark ? "#071a33" : "#f3f5f8");
          });
        }, 30);
      });
    });
  }

  function init() {
    fixLogo();
    fixNav();
    fixCredits();
    fixCounts();
    polish();
    bindReveal();
    // Cards may be rendered later by the home page script.
    setTimeout(bindTilt, 250);
    setTimeout(bindTilt, 1200);
    document.addEventListener("mth:tools-rendered", bindTilt);
    // Re-apply logo/credit when pages inject components (modals, tool shells).
    var mo = new MutationObserver(function () {
      if (document.querySelector("svg.brand-mark, .brand-mark:not(.brand-mark--v6)")) fixLogo();
      if (document.querySelector(".credit:not([data-v6-fixed])")) {
        document.querySelectorAll(".credit").forEach(function (el) { el.setAttribute("data-v6-fixed", "1"); });
        fixCredits();
      }
    });
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  }

  ready(init);
})();
