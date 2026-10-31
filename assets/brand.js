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
    document.querySelectorAll("footer, .site-foot, .foot, .drawer-foot").forEach(function (el) {
      // Keep the authored footer credit when it is already exact; otherwise
      // enforce one dedicated, exact credit node without duplicating it.
      if (el.textContent.indexOf(FOOTER_TEXT) !== -1) return;
      var credit = el.querySelector(".mth-credit-auto");
      if (!credit) {
        credit = document.createElement("span");
        credit.className = "mth-credit-auto";
        credit.style.cssText =
          "display:block;font-family:Arial,sans-serif;font-size:11px;color:#666;margin-top:6px;";
        el.appendChild(credit);
      }
      credit.textContent = FOOTER_TEXT;
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
