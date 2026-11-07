/* ==========================================================================
   MULTI TOOL HUB — Instagram Downloader
   Original Loader.to workflow, preserved and restyled.
   ========================================================================== */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var STORE_KEY = "mth.ig.recent";
  var LABEL = { reel: "Instagram reel", reels: "Instagram reel", p: "Instagram post", tv: "Instagram video" };
  var state = { current: null };

  function ic(name, size) { return MTH.ui.icon(name, "", size || 16); }

  function getRecent() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function setRecent(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, 6))); } catch (e) {}
  }

  /* Original link parser — kept byte-for-byte in behaviour. */
  function parse(u) {
    u = String(u || "").trim();
    if (!u) return null;
    if (/^[\w-]{5,20}$/.test(u)) return { code: u, type: "p", url: "https://www.instagram.com/p/" + u + "/" };
    var m = u.match(/instagram\.com\/(?:[\w.]+\/)?(reel|reels|p|tv)\/([\w-]{5,20})/i);
    if (!m) {
      var s = u.match(/instagram\.com\/share\/(reel|p)\/([\w-]{5,20})/i);
      if (s) m = [s[0], s[1], s[2]];
    }
    if (!m) return null;
    var type = m[1].toLowerCase(), code = m[2];
    if (type === "reels") type = "reel";
    return { type: type, code: code, url: "https://www.instagram.com/" + type + "/" + code + "/" };
  }

  function shell() {
    MTH.tool.mount(
      '<section class="panel dl-panel">' +
        '<div class="panel-head"><div><h2>Check a public Instagram link</h2><p>Only public posts can be fetched by the partner API.</p></div><span class="badge badge--new">Partner API</span></div>' +
        '<div class="panel-body">' +
          '<div class="field">' +
            '<label for="ig-url">Instagram link</label>' +
            '<div class="dl-input-row">' +
              '<input class="input" id="ig-url" type="url" placeholder="https://www.instagram.com/reel/…" autocomplete="off" spellcheck="false" data-url>' +
              '<button class="btn btn--subtle btn--sm" type="button" data-paste>' + ic("clipboard") + ' Paste</button>' +
            '</div>' +
            '<div class="hint">Public posts, reels and IGTV only. Private accounts, stories and posts that need a login cannot be fetched by the API.</div>' +
          '</div>' +
          '<div class="row">' +
            '<button class="btn" type="button" data-check>' + ic("download") + ' Check link &amp; show options</button>' +
            '<button class="btn btn--ghost" type="button" data-open-tab hidden>' + ic("external") + ' Open in a new tab</button>' +
          '</div>' +
          '<div class="dl-preview dl-preview--ig" data-card hidden>' +
            '<div class="dl-ig-glyph">' + ic("instagram", 28) + '</div>' +
            '<div class="dl-meta"><b data-card-type>Instagram post</b><span data-card-url></span>' +
              '<a data-open href="#" target="_blank" rel="noopener">Open on Instagram ' + ic("external", 12) + '</a></div>' +
          '</div>' +
          '<div data-recent-wrap hidden>' +
            '<label class="field-label" style="display:block;margin-top:18px">Recent links on this device</label>' +
            '<div class="dl-recent" data-recent></div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="panel" data-options hidden>' +
        '<div class="panel-head"><div><h2>Download options</h2><p>Pick the photo or video inside the Loader.to card.</p></div></div>' +
        '<div class="panel-body">' +
          '<p class="hint" style="margin-bottom:0">The card opens in a new tab because the provider blocks embedding on other websites.</p>' +
          '<div class="dl-card">' +
            '<span class="di" aria-hidden="true">' + ic("external", 18) + '</span>' +
            '<div><strong>Open the secure download card</strong>' +
              '<p>Loader.to prepares the file and your browser saves it. Nothing else leaves this page.</p>' +
              '<a class="btn" data-card-link href="#" target="_blank" rel="noopener">' + ic("external") + ' Open download options</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="panel">' +
        '<div class="panel-head"><div><h2>What is shared, exactly</h2></div></div>' +
        '<div class="panel-body">' +
          '<div class="dl-apinote notice notice--warn">' + ic("info", 18) + '<div>' +
            '<strong>This is the second exception to our local-only rule.</strong> ' +
            'The public Instagram link — and nothing else — is sent to <strong>Loader.to</strong>, which returns the download card. ' +
            'Loader.to may see your IP address and may use its own cookies. We do not control whether a post is downloadable; that depends on the account\'s privacy and Instagram\'s rules. ' +
            'Save only content you own or have clear permission to use, and respect copyright.' +
          '</div></div>' +
        '</div>' +
      '</section>' +

      '<section class="panel">' +
        '<div class="panel-head"><div><h2>If the card does not load</h2><p>Four checks solve almost every failed request.</p></div></div>' +
        '<div class="panel-body">' +
          '<ol class="dl-steps">' +
            '<li>Confirm the post is public. Open it in a private window — if Instagram asks you to log in, the API cannot see it either.</li>' +
            '<li>Use the direct post link (instagram.com/reel/…, /p/… or /tv/…), not a screenshot or a profile link.</li>' +
            '<li>Press <strong>Open in a new tab</strong> if your browser blocks third-party frames.</li>' +
            '<li>Wait a minute and retry: the API can be busy or rate-limited.</li>' +
          '</ol>' +
          '<p class="hint" style="margin-top:14px">Working with a video file you already have? <a href="' + MTH.esc(MTH.sitePath("tools/video-to-audio.html")) + '">Video to Audio</a> extracts audio locally, with no API at all.</p>' +
        '</div>' +
      '</section>' +

      '<div class="status" data-status role="status" aria-live="polite"></div>'
    );

    bind();
  }

  function bind() {
    var stage = MTH.tool.stage();
    var input = stage.querySelector("[data-url]");
    var check = stage.querySelector("[data-check]");
    var paste = stage.querySelector("[data-paste]");
    var openTab = stage.querySelector("[data-open-tab]");
    var status = stage.querySelector("[data-status]");
    var card = stage.querySelector("[data-card]");
    var typeLabel = stage.querySelector("[data-card-type]");
    var code = stage.querySelector("[data-card-url]");
    var open = stage.querySelector("[data-open]");
    var options = stage.querySelector("[data-options]");
    var cardLink = stage.querySelector("[data-card-link]");
    var recent = stage.querySelector("[data-recent]");
    var recentWrap = stage.querySelector("[data-recent-wrap]");

    function say(message, kind) { MTH.status(status, message, kind); }

    function resetPanels() {
      card.hidden = true;
      options.hidden = true;
      openTab.hidden = true;
    }

    function run() {
      var p = parse(input.value);
      state.current = p;
      if (!p) {
        resetPanels();
        say("That does not look like a public Instagram post link. Use instagram.com/reel/…, /p/… or /tv/….", "err");
        return;
      }
      input.value = p.url;
      card.hidden = false;
      typeLabel.textContent = LABEL[p.type] || "Instagram post";
      code.textContent = p.url;
      open.href = p.url;

      var list = getRecent().filter(function (x) { return x && x.code !== p.code; });
      list.unshift({ code: p.code, url: p.url, type: p.type, at: Date.now() });
      setRecent(list);
      renderRecent();

      options.hidden = false;
      openTab.hidden = false;
      openTab.onclick = function () { window.open(p.url, "_blank", "noopener"); };
      cardLink.href = "https://loader.to/api/card/?url=" + encodeURIComponent(p.url);
      say("Link checked. Open the download card in a new tab to choose a photo or video.", "ok");
      try { options.scrollIntoView({ behavior: "smooth", block: "start" }); }
      catch (e) { options.scrollIntoView(); }
    }

    function renderRecent() {
      var list = getRecent();
      recentWrap.hidden = !list.length;
      if (!list.length) { recent.innerHTML = ""; return; }
      recent.innerHTML = list.map(function (x) {
        return '<a href="#" data-recent-url="' + MTH.esc(x.url) + '" title="' + MTH.esc(x.url) + '">' + ic("instagram", 12) + " " + MTH.esc(x.code) + "</a>";
      }).join("") + '<button type="button" data-clear-recent>Clear</button>';

      recent.querySelectorAll("[data-recent-url]").forEach(function (a) {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          input.value = a.dataset.recentUrl;
          run();
        });
      });
      var clear = recent.querySelector("[data-clear-recent]");
      if (clear) clear.addEventListener("click", function () {
        setRecent([]);
        renderRecent();
        say("Recent links cleared from this device.", "ok");
      });
    }

    renderRecent();

    check.addEventListener("click", run);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); run(); }
    });
    paste.addEventListener("click", async function () {
      try {
        var text = await navigator.clipboard.readText();
        input.value = String(text || "").trim();
        if (input.value) run();
      } catch (e) {
        say("Your browser did not allow clipboard access. Paste the link with Ctrl+V.", "err");
        input.focus();
      }
    });
  }

  function init() {
    if (!document.getElementById("tool")) return;
    MTH.guard(shell, "instagram-downloader")();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
