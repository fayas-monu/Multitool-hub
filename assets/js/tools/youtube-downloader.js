/* ==========================================================================
   MULTI TOOL HUB — YouTube Downloader
   Original Loader.to workflow, preserved and restyled.
   ========================================================================== */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var STORE_KEY = "mth.yt.recent";
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
    if (/^[\w-]{11}$/.test(u)) return { id: u, url: "https://www.youtube.com/watch?v=" + u };
    var id = null, m;
    if ((m = u.match(/(?:youtu\.be\/)([\w-]{11})/))) id = m[1];
    else if ((m = u.match(/[?&]v=([\w-]{11})/))) id = m[1];
    else if ((m = u.match(/(?:youtube\.com\/|youtube-nocookie\.com\/)(?:embed|shorts|live|v)\/([\w-]{11})/))) id = m[1];
    if (!id) return null;
    var host = "";
    try { host = new URL(u).hostname; } catch (e) {}
    if (host && !/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(host)) return null;
    return { id: id, url: "https://www.youtube.com/watch?v=" + id };
  }

  function shell() {
    MTH.tool.mount(
      '<section class="panel dl-panel">' +
        '<div class="panel-head"><div><h2>Check a public YouTube link</h2><p>The link is checked on this device before any download card opens.</p></div><span class="badge badge--new">Partner API</span></div>' +
        '<div class="panel-body">' +
          '<div class="field">' +
            '<label for="yt-url">YouTube link</label>' +
            '<div class="dl-input-row">' +
              '<input class="input" id="yt-url" type="url" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off" spellcheck="false" data-url>' +
              '<button class="btn btn--subtle btn--sm" type="button" data-paste>' + ic("clipboard") + ' Paste</button>' +
            '</div>' +
            '<div class="hint">Works with regular videos, Shorts, live replays and youtu.be links. Playlists and private videos are not supported.</div>' +
          '</div>' +
          '<div class="row">' +
            '<button class="btn" type="button" data-check>' + ic("download") + ' Check link &amp; show options</button>' +
            '<button class="btn btn--ghost" type="button" data-open-tab hidden>' + ic("external") + ' Open in a new tab</button>' +
          '</div>' +
          '<div class="dl-preview" data-video hidden>' +
            '<div class="dl-thumb-wrap"><img data-thumb alt="Video thumbnail" loading="lazy"></div>' +
            '<div class="dl-meta"><b data-video-title>YouTube video</b><span data-video-id></span>' +
              '<a data-watch href="#" target="_blank" rel="noopener">Open on YouTube ' + ic("external", 12) + '</a></div>' +
          '</div>' +
          '<div data-recent-wrap hidden>' +
            '<label class="field-label" style="display:block;margin-top:18px">Recent links on this device</label>' +
            '<div class="dl-recent" data-recent></div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="panel" data-options hidden>' +
        '<div class="panel-head"><div><h2>Download options</h2><p>Choose a format and quality inside the Loader.to card.</p></div></div>' +
        '<div class="panel-body">' +
          '<p class="hint" style="margin-bottom:0">The card opens in a new tab because the provider blocks embedding on other websites.</p>' +
          '<div class="dl-card">' +
            '<span class="di" aria-hidden="true">' + ic("external", 18) + '</span>' +
            '<div><strong>Open the secure download card</strong>' +
              '<p>Loader.to prepares the video or audio and your browser saves the file. Nothing else leaves this page.</p>' +
              '<a class="btn" data-card-link href="#" target="_blank" rel="noopener">' + ic("external") + ' Open download options</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="panel">' +
        '<div class="panel-head"><div><h2>How this works — and what leaves your device</h2></div></div>' +
        '<div class="panel-body">' +
          '<div class="dl-apinote notice notice--warn">' + ic("info", 18) + '<div>' +
            '<strong>The YouTube tool is the one exception to the local-only rule.</strong> ' +
            'Your public link (and nothing else — no file, no account) is sent to <strong>Loader.to</strong>, which returns the download card above. ' +
            'Loader.to may see your IP address and may set its own cookies. We do not run the download servers and cannot control their availability. ' +
            'Please download only videos you own or have permission to save, and follow YouTube\'s terms.' +
          '</div></div>' +
        '</div>' +
      '</section>' +

      '<section class="panel">' +
        '<div class="panel-head"><div><h2>If the card does not load</h2><p>Four checks solve almost every failed request.</p></div></div>' +
        '<div class="panel-body">' +
          '<ol class="dl-steps">' +
            '<li>Check that the video is public and still available. Private, age-restricted and removed videos usually fail.</li>' +
            '<li>Press <strong>Open in a new tab</strong>. Some browsers block cross-site frames or third-party downloads.</li>' +
            '<li>Turn off strict tracking protection or an ad blocker for this page, then try again.</li>' +
            '<li>The Loader.to service can be busy. Wait a minute and retry.</li>' +
          '</ol>' +
          '<p class="hint" style="margin-top:14px">Prefer a fully local tool? Use <a href="' + MTH.esc(MTH.sitePath("tools/video-to-audio.html")) + '">Video to Audio</a> on a video file you already have. It never uploads anything.</p>' +
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
    var video = stage.querySelector("[data-video]");
    var thumb = stage.querySelector("[data-thumb]");
    var title = stage.querySelector("[data-video-title]");
    var vid = stage.querySelector("[data-video-id]");
    var watch = stage.querySelector("[data-watch]");
    var options = stage.querySelector("[data-options]");
    var cardLink = stage.querySelector("[data-card-link]");
    var recent = stage.querySelector("[data-recent]");
    var recentWrap = stage.querySelector("[data-recent-wrap]");

    function say(message, kind) { MTH.status(status, message, kind); }

    function resetPanels() {
      video.hidden = true;
      options.hidden = true;
      openTab.hidden = true;
    }

    function run() {
      var p = parse(input.value);
      state.current = p;
      if (!p) {
        resetPanels();
        say("That does not look like a YouTube video link. Use a youtube.com/watch?v=…, youtu.be/… or /shorts/… link.", "err");
        return;
      }
      input.value = p.url;
      video.hidden = false;
      thumb.style.visibility = "hidden";
      thumb.onerror = function () { this.style.visibility = "hidden"; };
      thumb.onload = function () { this.style.visibility = "visible"; };
      thumb.src = "https://i.ytimg.com/vi/" + p.id + "/hqdefault.jpg";
      vid.textContent = "Video ID: " + p.id;
      watch.href = p.url;
      title.textContent = "YouTube video " + p.id;

      var list = getRecent().filter(function (x) { return x && x.id !== p.id; });
      list.unshift({ id: p.id, url: p.url, at: Date.now() });
      setRecent(list);
      renderRecent();

      options.hidden = false;
      openTab.hidden = false;
      openTab.onclick = function () { window.open(p.url, "_blank", "noopener"); };
      cardLink.href = "https://loader.to/api/card/?url=" + encodeURIComponent(p.url);
      say("Link checked. Open the download card in a new tab to choose a format.", "ok");
      try { options.scrollIntoView({ behavior: "smooth", block: "start" }); }
      catch (e) { options.scrollIntoView(); }
    }

    function renderRecent() {
      var list = getRecent();
      recentWrap.hidden = !list.length;
      if (!list.length) { recent.innerHTML = ""; return; }
      recent.innerHTML = list.map(function (x) {
        return '<a href="#" data-recent-id="' + MTH.esc(x.id) + '" title="' + MTH.esc(x.url) + '">' + ic("clock", 12) + " " + MTH.esc(x.id) + "</a>";
      }).join("") + '<button type="button" data-clear-recent>Clear</button>';

      recent.querySelectorAll("[data-recent-id]").forEach(function (a) {
        a.addEventListener("click", function (e) {
          e.preventDefault();
          input.value = "https://www.youtube.com/watch?v=" + a.dataset.recentId;
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
    MTH.guard(shell, "youtube-downloader")();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
