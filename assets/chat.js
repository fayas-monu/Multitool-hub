/* MULTI TOOL HUB — Hub Assistant (direct Groq API; static frontend only).
   The API key is requested from the user and kept in sessionStorage for this
   browser tab/session. It is never embedded in source code.
   NOTE: Browser-side API keys are visible to the browser user and are not
   suitable for a public multi-user deployment. Use a backend for that case. */
(function () {
  "use strict";

  var cfg = window.MTH_CONFIG && window.MTH_CONFIG.groq ? window.MTH_CONFIG.groq : {};
  var ENDPOINT = typeof cfg.endpoint === "string" && cfg.endpoint
    ? cfg.endpoint : "https://api.groq.com/openai/v1/chat/completions";
  var MODEL = typeof cfg.model === "string" && cfg.model
    ? cfg.model : "llama-3.3-70b-versatile";
  var MODEL_LABEL = cfg.modelLabel || "Groq · Llama 3.3 70B";
  var STORE_KEY = "mth.hub.chat.history.v1";
  var API_KEY_STORAGE = "mth.groq.apiKey.session";
  var root, panel, list, form, input, sendBtn, statusEl, fab, keyBtn;
  var history = loadHistory();
  var busy = false;

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
    s = s.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>");
    s = s.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
    return "<p>" + s + "</p>";
  }

  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }
  function saveHistory() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-24))); } catch (e) {}
  }
  function getApiKey() {
    try { return sessionStorage.getItem(API_KEY_STORAGE) || ""; } catch (e) { return ""; }
  }
  function setApiKey(value) {
    try {
      if (value) sessionStorage.setItem(API_KEY_STORAGE, value);
      else sessionStorage.removeItem(API_KEY_STORAGE);
    } catch (e) {
      throw new Error("This browser does not allow session storage. Enable site storage and try again.");
    }
  }
  function requestApiKey() {
    var existing = getApiKey();
    var entered = window.prompt(
      "Enter your Groq API key. It will be kept only in this browser tab session, not in the project files.",
      existing
    );
    if (entered === null) return "";
    entered = entered.trim();
    if (!entered) {
      setApiKey("");
      return "";
    }
    setApiKey(entered);
    return entered;
  }

  function build() {
    root = document.createElement("div");
    root.id = "mth-hub-chat";
    root.innerHTML =
      '<button type="button" class="mth-fab" aria-label="Open Hub Assistant" title="Ask the Hub Assistant">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-11.2 6.5L4 19.5l1.5-4.5A7.5 7.5 0 1 1 20 11.5Z"/></svg>' +
      '</button>' +
      '<div class="mth-panel" hidden role="dialog" aria-label="Hub Assistant">' +
        '<div class="mth-head"><div class="mth-head-brand"><b>Hub Assistant</b><small></small></div>' +
          '<div class="mth-head-actions"><button type="button" class="mth-key" title="Set or change Groq API key">API key</button>' +
          '<button type="button" class="mth-close" aria-label="Close assistant">&times;</button></div></div>' +
        '<div class="mth-list" aria-live="polite"></div><div class="mth-status" hidden></div>' +
        '<form class="mth-form"><textarea rows="1" placeholder="Ask about any tool…" aria-label="Message"></textarea>' +
          '<button type="submit" aria-label="Send"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></form>' +
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
    keyBtn = root.querySelector(".mth-key");
    root.querySelector(".mth-head-brand small").textContent = MODEL_LABEL;

    fab.addEventListener("click", function () { open(true); });
    root.querySelector(".mth-close").addEventListener("click", function () { open(false); });
    keyBtn.addEventListener("click", function () {
      var key = requestApiKey();
      showStatus(key ? "Groq API key saved for this browser session." : "No API key is set.", key ? "ok" : "warn");
    });
    form.addEventListener("submit", onSubmit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });
    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(120, input.scrollHeight) + "px";
    });

    if (!history.length) {
      addMessage("bot", "Hi! I'm the Hub Assistant. Ask me which tool to use or how a tool works. Select **API key** to enter your Groq key before sending your first message.");
    } else {
      history.forEach(function (m) { addMessage(m.role === "user" ? "me" : "bot", m.content); });
    }
    window.openHubChat = function () { open(true); };
  }

  function open(show) {
    panel.hidden = !show;
    fab.setAttribute("aria-expanded", show ? "true" : "false");
    if (show) { input.focus(); list.scrollTop = list.scrollHeight; }
  }
  function showStatus(message, kind) {
    statusEl.hidden = !message;
    statusEl.textContent = message || "";
    statusEl.className = "mth-status" + (kind ? " " + kind : "");
  }
  function addMessage(who, text) {
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

  function readResponse(res) {
    return res.text().then(function (raw) {
      var contentType = (res.headers.get("content-type") || "").toLowerCase();
      var data;
      if (contentType.indexOf("application/json") === -1) {
        if (/^\s*</.test(raw)) {
          throw new Error("The API returned an HTML page instead of JSON. Check the API endpoint, internet connection, and browser extensions.");
        }
        throw new Error("The API returned an unexpected response format.");
      }
      try { data = JSON.parse(raw); }
      catch (e) { throw new Error("The API response was not valid JSON."); }
      if (!res.ok) {
        var apiMessage = data && data.error && data.error.message;
        throw new Error(apiMessage || ("Groq request failed (HTTP " + res.status + ")."));
      }
      var answer = data && data.choices && data.choices[0] &&
        data.choices[0].message && data.choices[0].message.content;
      if (typeof answer !== "string" || !answer.trim()) {
        throw new Error("Groq returned an empty response.");
      }
      return answer;
    });
  }

  function onSubmit(e) {
    e.preventDefault();
    var message = input.value.trim();
    if (!message || busy) return;
    var apiKey = getApiKey();
    if (!apiKey) apiKey = requestApiKey();
    if (!apiKey) {
      showStatus("Enter your Groq API key using the API key button before sending.", "warn");
      return;
    }

    input.value = "";
    input.style.height = "auto";
    addMessage("me", message);
    history.push({ role: "user", content: message });
    saveHistory();
    busy = true;
    sendBtn.disabled = true;
    var botBubble = addMessage("bot", "…thinking");
    showStatus("Connecting directly to Groq…");

    var messages = history.slice(-24).map(function (m) {
      return { role: m.role, content: m.content };
    });
    fetch(ENDPOINT, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        temperature: typeof cfg.temperature === "number" ? cfg.temperature : 0.7,
        max_tokens: typeof cfg.maxTokens === "number" ? cfg.maxTokens : 1024,
        stream: false
      })
    })
    .then(readResponse)
    .then(function (answer) {
      botBubble.innerHTML = renderMarkdown(answer);
      history.push({ role: "assistant", content: answer });
      saveHistory();
      showStatus("");
      list.scrollTop = list.scrollHeight;
    })
    .catch(function (err) {
      var msg = err && err.message ? err.message : "Unknown network error.";
      botBubble.innerHTML = renderMarkdown("Sorry — " + msg);
      showStatus(
        /failed to fetch|networkerror|load failed/i.test(msg)
          ? "Network/CORS error. Check your internet connection and confirm Groq allows this browser request."
          : "Request failed. Check the API key, model name, and Groq account limits.",
        "err"
      );
    })
    .then(function () {
      busy = false;
      sendBtn.disabled = false;
      input.focus();
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
      "#mth-hub-chat .mth-head-actions{display:flex;align-items:center;gap:8px}" +
      "#mth-hub-chat .mth-key{border:1px solid #ddd;border-radius:7px;background:#fff;color:#333;padding:5px 8px;font-size:11px;cursor:pointer}" +
      "#mth-hub-chat .mth-close{background:none;border:none;font-size:20px;line-height:1;cursor:pointer;color:#111;padding:4px 8px}" +
      "#mth-hub-chat .mth-list{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}" +
      "#mth-hub-chat .mth-msg{display:flex}#mth-hub-chat .mth-msg.me{justify-content:flex-end}" +
      "#mth-hub-chat .mth-bubble{max-width:82%;padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.5}" +
      "#mth-hub-chat .mth-bubble p{margin:0 0 6px}#mth-hub-chat .mth-bubble p:last-child{margin-bottom:0}" +
      "#mth-hub-chat .mth-bubble pre{background:#111;color:#fff;padding:8px 10px;border-radius:8px;overflow-x:auto;font-size:12px}" +
      "#mth-hub-chat .mth-bubble code{background:#F0F0F0;padding:1px 5px;border-radius:5px;font-size:12px}" +
      "#mth-hub-chat .mth-msg.me .mth-bubble{background:#000;color:#fff;border-bottom-right-radius:4px}" +
      "#mth-hub-chat .mth-msg.bot .mth-bubble{background:#F3F3F3;color:#111;border-bottom-left-radius:4px}" +
      "#mth-hub-chat .mth-status{padding:6px 14px;font-size:11.5px;color:#8a5a00;background:#FFF8E8;border-top:1px solid #F0E6C8}" +
      "#mth-hub-chat .mth-status.ok{color:#166534;background:#ECFDF3;border-color:#BBF7D0}" +
      "#mth-hub-chat .mth-status.err{color:#b91c1c;background:#FDECEC;border-color:#F6CACA}" +
      "#mth-hub-chat .mth-form{display:flex;gap:8px;padding:10px;border-top:1px solid #EAEAEA}" +
      "#mth-hub-chat .mth-form textarea{flex:1;resize:none;border:1px solid #EAEAEA;border-radius:10px;padding:9px 11px;font:inherit;font-size:13.5px;max-height:120px}" +
      "#mth-hub-chat .mth-form button{background:#000;color:#fff;border:none;border-radius:10px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}" +
      "#mth-hub-chat .mth-form button:disabled{opacity:.5;cursor:default}" +
      "@media(prefers-color-scheme:dark){#mth-hub-chat .mth-panel{background:#111;border-color:#2A2A2A}#mth-hub-chat .mth-head{background:#1A1A1A;border-color:#2A2A2A}#mth-hub-chat .mth-head-brand b{color:#F5F5F5}#mth-hub-chat .mth-close{color:#F5F5F5}#mth-hub-chat .mth-key{background:#222;color:#eee;border-color:#444}#mth-hub-chat .mth-msg.bot .mth-bubble{background:#1E1E1E;color:#F0F0F0}#mth-hub-chat .mth-form{border-color:#2A2A2A}#mth-hub-chat .mth-form textarea{background:#1A1A1A;border-color:#2A2A2A;color:#F0F0F0}}";
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
