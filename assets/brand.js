/* MULTI TOOL HUB — brand injector.
   Places the mandatory dark-square MTH logo + wordmark into every header
   across the app, and keeps footer credit text consistent everywhere.
   Developed by chank!nd3 p4d4y41! l FAYAS MONU */
(function () {
  "use strict";

  var LOGO_HTML =
    '<div class="logo-container" style="display:flex;align-items:center;gap:8px;padding:6px 12px;background:#FAFAFA;border:1px solid #EAEAEA;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.03);">' +
    '<svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
    '<rect x="6" y="6" width="88" height="88" rx="20" fill="#111111" opacity="0.08"/>' +
    '<rect x="10" y="10" width="80" height="80" rx="16" fill="url(#mth-logo-grad)"/>' +
    '<rect x="16" y="16" width="68" height="68" rx="10" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.2"/>' +
    '<text x="50" y="61" font-family="Arial, sans-serif" font-weight="900" font-size="34" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">MTH</text>' +
    '<defs><linearGradient id="mth-logo-grad" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">' +
    '<stop stop-color="#1A1A1A"/><stop offset="1" stop-color="#000000"/></linearGradient></defs>' +
    '</svg>' +
    '<div class="brand-text" style="display:flex;flex-direction:column;">' +
    '<span style="font-family:Arial, sans-serif;font-size:18px;font-weight:800;color:#111111;letter-spacing:0.5px;line-height:1.1;">MULTI TOOL HUB</span>' +
    '<span style="font-family:Arial, sans-serif;font-size:9px;font-weight:600;color:#666666;letter-spacing:1.2px;text-transform:uppercase;margin-top:2px;">Media Tools &amp; PDF Tools</span>' +
    '</div></div>';

  var FOOTER_TEXT = "Developed by chank!nd3 p4d4y41! l FAYAS MONU";

  function injectLogo() {
    var slots = document.querySelectorAll("a.brand, .drawer-head b");
    slots.forEach(function (el) {
      if (el.tagName === "A") {
        el.innerHTML = LOGO_HTML;
        el.style.textDecoration = "none";
      } else {
        el.textContent = "MULTI TOOL HUB";
      }
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
