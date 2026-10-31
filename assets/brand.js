/* MULTI TOOL HUB — brand injector.
   Preserves the official inline SVG MTH logo + wordmark that every page
   already ships inside <a class="brand">. Only normalises the mobile drawer
   heading and enforces the mandatory footer credit text everywhere.
   Developed by chank!nd3 p4d4y41! l FAYAS MONU */
(function () {
  "use strict";

  var FOOTER_TEXT = "Developed by chank!nd3 p4d4y41! l FAYAS MONU";

  function injectLogo() {
    // Keep the official inline SVG mark + .brand-word that each page ships.
    // Only normalise the drawer heading so the mobile menu stays consistent.
    document.querySelectorAll(".drawer-head b").forEach(function (el) {
      el.textContent = "MULTI TOOL HUB";
    });
    document.querySelectorAll("a.brand").forEach(function (el) {
      el.setAttribute("aria-label", "MULTI TOOL HUB");
    });
  }

  function ensureFooterCredit() {
    // Belt-and-braces: if any footer/credit node is missing the mandated
    // text (e.g. a page added later without it), append it automatically.
    var candidates = document.querySelectorAll(
      "footer, .site-foot, .foot, .drawer-foot"
    );
    candidates.forEach(function (el) {
      if (el.textContent.indexOf("FAYAS MONU") === -1) {
        var tag = document.createElement("span");
        tag.className = "mth-credit-auto";
        tag.style.cssText =
          "display:block;font-family:Arial,sans-serif;font-size:11px;color:#666;margin-top:6px;";
        tag.textContent = FOOTER_TEXT;
        el.appendChild(tag);
      }
    });
  }

  function init() {
    injectLogo();
    ensureFooterCredit();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
