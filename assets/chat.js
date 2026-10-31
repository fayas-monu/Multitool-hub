/* MULTI TOOL HUB — Hub Assistant (Groq, via secure server proxy only).
   Developed by chank!nd3 p4d4y41! l FAYAS MONU

   The browser never holds a Groq API key. Every request goes to the proxy
   address configured in assets/config.js (window.MTH_CONFIG.groq.proxy,
   with a fallback to the legacy window.MTH_CONFIG.groqProxyUrl, and a
   final default of /api/assistant). Streams markdown as it arrives,
   with automatic fallback to a plain (non-streaming) request if the stream
   fails partway, so the assistant stays usable on flaky connections. */
(function () {
  "use strict";

  var globalCfg = window.MTH_CONFIG || {};
  var cfg = globalCfg.groq || {};
  var ENDPOINT = cfg.proxy || globalCfg.groqProxyUrl || "/api/assistant";
  var TOKEN = cfg.token || "";
  var MODEL_LABEL = cfg.modelLabel || "Groq · Llama 3.3 70B";
  var STORE_KEY = "mth.hub.chat.history.v1";

  var root, panel, list, form, input, sendBtn, statusEl, fab;
  var history = loadHistory();
  var busy = false;

  /* ---------------- tiny markdown renderer (safe: escapes first) --- */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function renderMarkdown(src) {
    var s = escapeHtml(src || "");
    s = s.replace(/```([\s\S]*?)```/g, function (_, code) {
      return "<pre><code>" + code.replace(/^\n/, "") + "</code></pre>";
    });
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/\*([^*]+)\*/g, "<i>$1</i>");
    s = s.replace(/^### (.*)$/gm, "<h4>$1</h4>");
    s = s.replace(/^## (.*)$/gm, "<h3>$1</h3>");
    s = s.replace(/^[-*] (.*)$/gm, "<li>$1</li>");
    s = s.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, function (m) {
      return "<ul>" + m + "</ul>";
    });
    s = s.replace(/\n{2,}/g, "</p><p>");
    s = s.replace(/\n/g, "<br>");
    return "<p>" + s + "</p>";
  }

  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveHistory() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-24))); } catch (e) {}
  }

  /* ---------------- UI build ---------------- */
  function build() {
    root = document.createElement("div");
    root.id = "mth-hub-chat";
    root.innerHTML =
      '<button type="button" class="mth-fab" aria-label="Open Hub Assistant" title="Ask the Hub Assistant">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-11.2 6.5L4 19.5l1.5-4.5A7.5 7.5 0 1 1 20 11.5Z"/></svg>' +
      '</button>' +
      '<div class="mth-panel" hidden role="dialog" aria-label="Hub Assistant">' +
        '<div class="mth-head">' +
          '<div class="mth-head-brand"><b>Hub Assistant</b><small></small></div>' +
          '<button type="button" class="mth-close" aria-label="Close assistant">&times;</button>' +
        '</div>' +
        '<div class="mth-list" aria-live="polite"></div>' +
        '<div class="mth-status" hidden></div>' +
        '<form class="mth-form">' +
          '<textarea rows="1" placeholder="Ask about any tool…" aria-label="Message"></textarea>' +
          '<button type="submit" aria-label="Send">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
          '</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(root);
    injectStyles();

    fab = root.querySelector(".mth-fab");
    panel = root.querySelector(".mth-panel");
    list = root.querySelector(".mth-list");
    form = root.querySelector(".mth-form");
    input = root.querySelector("textarea");
    sendBtn = root.querySelector('button[type="submit"]');
    statusEl = root.querySelector(".mth-status");
    root.querySelector(".mth-head-brand small").textContent = MODEL_LABEL;

    fab.addEventListener("click", function () { open(true); });
    root.querySelector(".mth-close").addEventListener("click", function () { open(false); });
    form.addEventListener("submit", onSubmit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });
    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(120, input.scrollHeight) + "px";
    });

    if (!history.length) {
      addMessage("bot", "Hi! I'm the Hub Assistant. Ask me which tool to use, how a tool works, or what happens to your files — I never read the files themselves.");
    } else {
      history.forEach(function (m) { addMessage(m.role === "user" ? "me" : "bot", m.content, true); });
    }

    if (!ENDPOINT) showStatus("The assistant proxy isn't configured yet. Set window.MTH_CONFIG.groq.proxy in assets/config.js.", "warn");

    window.openHubChat = function () { open(true); };
  }

  function open(show) {
    panel.hidden = !show;
    fab.setAttribute("aria-expanded", show ? "true" : "false");
    if (show) { input.focus(); list.scrollTop = list.scrollHeight; }
  }

  function showStatus(text, kind) {
    statusEl.hidden = !text;
    statusEl.textContent = text || "";
    statusEl.className = "mth-status" + (kind ? " " + kind : "");
  }

  function addMessage(who, text, isMarkdownAlready) {
    var row = document.createElement("div");
    row.className = "mth-msg " + who;
    var bubble = document.createElement("div");
    bubble.className = "mth-bubble";
    bubble.innerHTML = renderMarkdown(text);
    row.appendChild(bubble);
    list.appendChild(row);
    list.scrollTop = list.scrollHeight;
    return bubble;
  }

  /* ---------------- networking: streaming with non-stream fallback - */
  function onSubmit(e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;
    if (!ENDPOINT) { showStatus("No assistant proxy configured.", "warn"); return; }

    input.value = ""; input.style.height = "auto";
    addMessage("me", text);
    history.push({ role: "user", content: text });
    saveHistory();

    busy = true; sendBtn.disabled = true;
    var botBubble = addMessage("bot", "…thinking");
    showStatus("");

    streamReply(history, botBubble)
      .catch(function () { return plainReply(history, botBubble); })
      .catch(function (err) {
        botBubble.innerHTML = renderMarkdown("Sorry — I couldn't reach the assistant. " + (err && err.message ? err.message : ""));
        showStatus("Connection problem. You can try again.", "err");
      })
      .then(function () { busy = false; sendBtn.disabled = false; });
  }

  function streamReply(messages, bubble) {
    return fetch(ENDPOINT, {
      method: "POST",
      headers: Object.assign(
        { "Content-Type": "application/json" },
        TOKEN ? { Authorization: "Bearer " + TOKEN } : {}
      ),
      body: JSON.stringify({ messages: messages, stream: true })
    }).then(function (res) {
      if (!res.ok || !res.body) throw new Error("stream unavailable");
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = "", acc = "";
      bubble.innerHTML = "";
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) {
            if (!acc) throw new Error("empty stream");
            history.push({ role: "assistant", content: acc });
            saveHistory();
            return;
          }
          buf += decoder.decode(r.value, { stream: true });
          var lines = buf.split("\n");
          buf = lines.pop();
          lines.forEach(function (line) {
            line = line.trim();
            if (!line.startsWith("data:")) return;
            var payload = line.slice(5).trim();
            if (payload === "[DONE]") return;
            try {
              var obj = JSON.parse(payload);
              var delta = obj.choices && obj.choices[0] && obj.choices[0].delta && obj.choices[0].delta.content;
              if (delta) { acc += delta; bubble.innerHTML = renderMarkdown(acc); list.scrollTop = list.scrollHeight; }
            } catch (e) { /* ignore partial/non-JSON keep-alive lines */ }
          });
          return pump();
        });
      }
      return pump();
    });
  }

  function plainReply(messages, bubble) {
    showStatus("Streaming unavailable — using a single-response fallback.", "warn");
    return fetch(ENDPOINT, {
      method: "POST",
      headers: Object.assign(
        { "Content-Type": "application/json" },
        TOKEN ? { Authorization: "Bearer " + TOKEN } : {}
      ),
      body: JSON.stringify({ messages: messages, stream: false })
    }).then(function (res) { return res.json().then(function (d) { return { res: res, data: d }; }); })
      .then(function (r) {
        if (!r.res.ok || r.data.ok === false) throw new Error(r.data && r.data.error ? r.data.error : "The assistant is unavailable.");
        var text = r.data.reply || r.data.text || "";
        if (!text) throw new Error("Empty reply.");
        bubble.innerHTML = renderMarkdown(text);
        history.push({ role: "assistant", content: text });
        saveHistory();
      });
  }

  function injectStyles() {
    if (document.getElementById("mth-chat-style")) return;
    var css =
      "#mth-hub-chat{font-family:Arial,sans-serif}" +
      "#mth-hub-chat .mth-fab{position:fixed;right:22px;bottom:22px;width:56px;height:56px;border-radius:50%;background:#000;color:#fff;border:none;box-shadow:0 10px 26px rgba(0,0,0,.28);cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:9999;transition:transform .15s ease}" +
      "#mth-hub-chat .mth-fab:hover{transform:translateY(-2px) scale(1.04)}" +
      "#mth-hub-chat .mth-panel{position:fixed;right:22px;bottom:90px;width:360px;max-width:92vw;height:520px;max-height:75vh;background:#fff;border:1px solid #EAEAEA;border-radius:16px;box-shadow:0 24px 56px -20px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;z-index:9999}" +
      "#mth-hub-chat .mth-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #EAEAEA;background:#FAFAFA}" +
      "#mth-hub-chat .mth-head-brand b{display:block;font-size:14px;color:#111}" +
      "#mth-hub-chat .mth-head-brand small{color:#666;font-size:10px;letter-spacing:.4px;text-transform:uppercase}" +
      "#mth-hub-chat .mth-close{background:none;border:none;font-size:20px;line-height:1;cursor:pointer;color:#111;padding:4px 8px}" +
      "#mth-hub-chat .mth-list{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}" +
      "#mth-hub-chat .mth-msg{display:flex}" +
      "#mth-hub-chat .mth-msg.me{justify-content:flex-end}" +
      "#mth-hub-chat .mth-bubble{max-width:82%;padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.5}" +
      "#mth-hub-chat .mth-bubble p{margin:0 0 6px}#mth-hub-chat .mth-bubble p:last-child{margin-bottom:0}" +
      "#mth-hub-chat .mth-bubble pre{background:#111;color:#fff;padding:8px 10px;border-radius:8px;overflow-x:auto;font-size:12px}" +
      "#mth-hub-chat .mth-bubble code{background:#F0F0F0;padding:1px 5px;border-radius:5px;font-size:12px}" +
      "#mth-hub-chat .mth-msg.me .mth-bubble{background:#000;color:#fff;border-bottom-right-radius:4px}" +
      "#mth-hub-chat .mth-msg.bot .mth-bubble{background:#F3F3F3;color:#111;border-bottom-left-radius:4px}" +
      "#mth-hub-chat .mth-status{padding:6px 14px;font-size:11.5px;color:#8a5a00;background:#FFF8E8;border-top:1px solid #F0E6C8}" +
      "#mth-hub-chat .mth-status.err{color:#b91c1c;background:#FDECEC;border-color:#F6CACA}" +
      "#mth-hub-chat .mth-form{display:flex;gap:8px;padding:10px;border-top:1px solid #EAEAEA}" +
      "#mth-hub-chat .mth-form textarea{flex:1;resize:none;border:1px solid #EAEAEA;border-radius:10px;padding:9px 11px;font:inherit;font-size:13.5px;max-height:120px}" +
      "#mth-hub-chat .mth-form button{background:#000;color:#fff;border:none;border-radius:10px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}" +
      "#mth-hub-chat .mth-form button:disabled{opacity:.5;cursor:default}" +
      "@media (prefers-color-scheme:dark){#mth-hub-chat .mth-panel{background:#111;border-color:#2A2A2A}#mth-hub-chat .mth-head{background:#1A1A1A;border-color:#2A2A2A}#mth-hub-chat .mth-head-brand b{color:#F5F5F5}#mth-hub-chat .mth-close{color:#F5F5F5}#mth-hub-chat .mth-msg.bot .mth-bubble{background:#1E1E1E;color:#F0F0F0}#mth-hub-chat .mth-form{border-color:#2A2A2A}#mth-hub-chat .mth-form textarea{background:#1A1A1A;border-color:#2A2A2A;color:#F0F0F0}}";
    var style = document.createElement("style");
    style.id = "mth-chat-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
