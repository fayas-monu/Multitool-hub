/* MULTI TOOL HUB — Hub Assistant (local-first). Offline engine + optional BYO-key LLM, no server. */
(function () {
  "use strict";
  var MTH = window.MTH; if (!MTH || !MTH.tools || window.__mthAssistant) return; window.__mthAssistant = 1;
  var SS = window.sessionStorage, LS = window.localStorage;
  function jget(st, k, d) { try { return JSON.parse(st.getItem(k)) || d; } catch (e) { return d; } }
  function jset(st, k, v) { try { st.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var hist = jget(SS, "mth.ai.hist", []), cfg = jget(LS, "mth.ai.cfg", { url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", key: "" });
  var ctx = jget(SS, "mth.ai.ctx", { last: null });
  var inTools = /\/tools\//.test(location.pathname);
  function href(t) { return MTH.sitePath(t.href); }

  /* ---------- local intelligence ---------- */
  var STOP = /\b(a|an|the|to|my|me|i|can|you|please|how|do|does|for|of|on|in|with|want|need|would|like|help|tool|use|is|there)\b/g;
  function words(s) { return s.toLowerCase().replace(STOP, " ").replace(/[^a-z0-9+ ]/g, " ").split(/\s+/).filter(Boolean).map(function (w) { return w.replace(/s$/, ""); }); }
  function rank(q) {
    var qw = words(q), ql = q.toLowerCase();
    return MTH.tools.map(function (t) {
      var hay = (t.title + " " + t.aliases + " " + t.tags.join(" ")).toLowerCase(), sc = 0;
      qw.forEach(function (w) { if (hay.indexOf(w) > -1) sc += w.length > 3 ? 3 : 1; if (t.title.toLowerCase().indexOf(w) > -1) sc += 2; });
      var m = ql.match(/(\w+) to (\w+)/); if (m && t.aliases.indexOf(m[1] + " to " + m[2]) > -1) sc += 8; else if (m && t.aliases.indexOf(m[2] + " to " + m[1]) > -1 && m[1] !== m[2]) sc -= 6;
      return { t: t, s: sc };
    }).filter(function (x) { return x.s > 2; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 3);
  }
  var U = { b: 1, kb: 1024, mb: 1048576, gb: 1073741824, mm: .001, cm: .01, m: 1, km: 1000, in: .0254, ft: .3048, mi: 1609.344, g: .001, kg: 1, lb: .45359237, oz: .0283495 };
  var GRP = { b: "d", kb: "d", mb: "d", gb: "d", mm: "l", cm: "l", m: "l", km: "l", in: "l", ft: "l", mi: "l", g: "w", kg: "w", lb: "w", oz: "w" };
  function convert(q) {
    var m = q.toLowerCase().match(/(-?\d+(?:\.\d+)?)\s*(°?[cf]|[a-z]{1,2})\s*(?:to|in|into)\s*(°?[cf]|[a-z]{1,2})\b/); if (!m) return null;
    var v = +m[1], a = m[2].replace("°", ""), b = m[3].replace("°", "");
    if (a === "c" && b === "f") return v + "°C = " + (v * 9 / 5 + 32).toFixed(2) + "°F";
    if (a === "f" && b === "c") return v + "°F = " + ((v - 32) * 5 / 9).toFixed(2) + "°C";
    if (U[a] && U[b] && GRP[a] === GRP[b]) return v + " " + a + " = " + +(v * U[a] / U[b]).toPrecision(8) + " " + b; return null;
  }
  function calc(q) {
    var e = q.replace(/^\s*(calc(ulate)?|what is|=)\s*/i, "").replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/gi, "($1/100*$2)").replace(/\^/g, "**").replace(/x/gi, "*");
    if (!/^[\d+\-*/().%\s]+$/.test(e) || !/\d\s*[-+*/%]/.test(e)) return null;
    try { var r = Function('"use strict";return (' + e + ")")(); return isFinite(r) ? e.trim() + " = " + +r.toPrecision(12) : null; } catch (x) { return null; }
  }
  var FAQ = [
    [/privacy|upload|safe|secure|server|my files/, "Your files never leave this device: PDF, image and media tools run entirely in your browser. Only the YouTube and Instagram helpers send the link you paste to a third-party service, and the assistant only contacts a model if you add your own API key in Settings."],
    [/offline|install|pwa|app/, "This hub is an installable app and caches its tools, so the local tools keep working offline after your first visit. Use your browser’s Install option."],
    [/scan|ocr/, "Scanned PDFs have no text layer, so PDF to Word / Text / Excel can’t extract text from them. OCR isn’t included."],
    [/password|encrypt|protect/, "Unlock PDF removes a password only when you already know it. Nothing is guessed or uploaded."],
    [/shortcut|keyboard/, "Press Ctrl/⌘+K to search tools, and Esc to close panels. The assistant opens with Ctrl/⌘+J."],
    [/who made|credit|developer|author/, MTH.credit]
  ];
  function local(q) {
    var t = q.trim(), l = t.toLowerCase(), c;
    if (/^(hi|hello|hey|salam|hola)\b/.test(l)) return { text: "Hello. Tell me what you want to do with a file — for example “merge two PDFs” or “shrink a photo to 200 KB” — and I’ll open the right tool." };
    if (/^\/?tools$|list (all )?tools|what can you do|what tools/.test(l)) return { text: "**" + MTH.tools.length + " tools:**\n" + MTH.tools.map(function (x) { return "- " + x.title; }).join("\n"), links: MTH.tools.slice(0, 6) };
    if ((c = calc(t))) return { text: c };
    if ((c = convert(t))) return { text: c };
    if (/^(it|that|this one|open it|open that|go)$/.test(l) && ctx.last) { var lt = MTH.toolById(ctx.last); if (lt) return { text: "Opening " + lt.title + "…", go: href(lt) }; }
    var wc = l.match(/^(?:count|word count)\s*[:\-]?\s*([\s\S]+)/); if (wc) { var tx = wc[1]; return { text: "Words: " + (tx.trim().split(/\s+/).length) + " · Characters: " + tx.length + " · Lines: " + tx.split("\n").length }; }
    for (var i = 0; i < FAQ.length; i++) if (FAQ[i][0].test(l)) return { text: FAQ[i][1] };
    var r = rank(t);
    if (r.length) { ctx.last = r[0].t.id; jset(SS, "mth.ai.ctx", ctx); var go = /^(open|go to|launch|start)\b/.test(l) ? href(r[0].t) : null;
      return { text: "**" + r[0].t.title + "** fits best. " + r[0].t.desc + (r[1] ? "\n\nAlso relevant: " + r.slice(1).map(function (x) { return x.t.title; }).join(", ") + "." : "") + "\n\nSay “open it” to go there.", links: r.map(function (x) { return x.t; }), go: go }; }
    return { text: "I couldn’t match that to a tool. Try describing the file and the result, like “convert PDF to Word”. I can also calculate (`12% of 840`), convert units (`5 mb to kb`) and count text (`count: your text`). Add an API key in Settings for open-ended questions." };
  }

  /* ---------- optional LLM (direct from browser, user's own key) ---------- */
  async function llm(msgs, onTok) {
    var sys = "You are the Hub Assistant for MULTI TOOL HUB, a local-first browser toolkit. Available tools: " + MTH.tools.map(function (t) { return t.title + " (" + t.href + ")"; }).join("; ") + ". Be concise and accurate; recommend the right tool when relevant. Current page: " + location.pathname + ".";
    var res = await fetch(cfg.url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key }, body: JSON.stringify({ model: cfg.model, stream: true, messages: [{ role: "system", content: sys }].concat(msgs.slice(-16)) }) });
    if (!res.ok) throw new Error("Provider returned " + res.status);
    var rd = res.body.getReader(), dec = new TextDecoder(), buf = "", out = "";
    for (;;) { var x = await rd.read(); if (x.done) break; buf += dec.decode(x.value, { stream: true }); var ln = buf.split("\n"); buf = ln.pop();
      ln.forEach(function (L) { L = L.trim(); if (L.indexOf("data:") !== 0 || L.indexOf("[DONE]") > -1) return; try { var d = JSON.parse(L.slice(5)).choices[0].delta.content; if (d) { out += d; onTok(out); } } catch (e) {} }); }
    return out;
  }

  /* ---------- UI ---------- */
  var css = document.createElement("style"); css.textContent =
    "#mthai-b{position:fixed;right:20px;bottom:20px;z-index:9000;width:52px;height:52px;border-radius:12px;border:0;background:var(--accent);color:var(--accent-ink);font:700 15px var(--font-body);cursor:pointer;box-shadow:var(--shadow-lg)}" +
    "#mthai-b:focus-visible,#mthai input:focus-visible{outline:none;box-shadow:var(--ring)}" +
    "#mthai{position:fixed;right:20px;bottom:84px;z-index:9001;width:min(420px,calc(100vw - 24px));height:min(600px,calc(100vh - 110px));display:none;flex-direction:column;background:var(--surface);color:var(--ink);border:1px solid var(--line-strong);border-radius:12px;box-shadow:var(--shadow-lg);font:14px/1.5 var(--font-body);overflow:hidden}#mthai.on{display:flex}" +
    "#mthai header{display:flex;align-items:center;gap:8px;padding:12px 14px;background:var(--accent);color:var(--accent-ink);font-weight:600}#mthai header span{flex:1}#mthai header button{background:transparent;border:0;color:inherit;cursor:pointer;font-size:12px;opacity:.85}" +
    "#mthai .log{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px}#mthai .m{max-width:88%;padding:9px 12px;border-radius:10px;white-space:pre-wrap;word-wrap:break-word}" +
    "#mthai .u{align-self:flex-end;background:var(--accent);color:var(--accent-ink)}#mthai .a{align-self:flex-start;background:var(--surface-2);border:1px solid var(--line)}" +
    "#mthai .a a{display:inline-block;margin:6px 6px 0 0;padding:3px 9px;border-radius:6px;background:var(--accent-soft);color:var(--accent);text-decoration:none;font-weight:600;font-size:12px}" +
    "#mthai form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line)}#mthai input{flex:1;padding:10px 12px;border:1px solid var(--line-strong);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit}" +
    "#mthai form button{padding:0 16px;border:0;border-radius:8px;background:var(--accent);color:var(--accent-ink);font-weight:600;cursor:pointer}#mthai .set{display:none;padding:12px;border-top:1px solid var(--line);gap:6px;flex-direction:column}#mthai .set.on{display:flex}#mthai .set input{width:100%}";
  document.head.appendChild(css);
  var box = document.createElement("div"); box.id = "mthai"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Hub Assistant");
  box.innerHTML = '<header><span>Hub Assistant</span><button data-s>Settings</button><button data-x aria-label="Clear chat">Clear</button><button data-c aria-label="Close">✕</button></header><div class="log" aria-live="polite"></div><div class="set"><input data-k type="password" placeholder="Optional API key (stored on this device only)"><input data-u placeholder="Endpoint"><input data-m placeholder="Model"><small style="color:var(--muted)">Local mode works without a key. With a key, messages go straight from your browser to the endpoint you set.</small></div><form><input placeholder="Ask or describe a task…" aria-label="Message" autocomplete="off"><button>Send</button></form>';
  var btn = document.createElement("button"); btn.id = "mthai-b"; btn.textContent = "AI"; btn.setAttribute("aria-label", "Open Hub Assistant");
  var log = box.querySelector(".log"), inp = box.querySelector("form input");
  function esc(s) { return MTH.esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/^- /gm, "• "); }
  function add(role, html) { var d = document.createElement("div"); d.className = "m " + (role === "u" ? "u" : "a"); d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
  function links(ts) { return ts ? "<br>" + ts.map(function (t) { return '<a href="' + href(t) + '">' + MTH.esc(t.title) + "</a>"; }).join("") : ""; }
  hist.forEach(function (h) { add(h.role === "user" ? "u" : "a", h.role === "user" ? MTH.esc(h.content) : esc(h.content)); });
  if (!hist.length) add("a", esc("I’m the Hub Assistant. I can find and open the right tool, calculate, convert units and answer questions about privacy and formats. What are you working on?"));
  var set = box.querySelector(".set"); ["k", "u", "m"].forEach(function (k) { var el = box.querySelector("[data-" + k + "]"); el.value = { k: cfg.key, u: cfg.url, m: cfg.model }[k]; el.onchange = function () { cfg[{ k: "key", u: "url", m: "model" }[k]] = el.value.trim(); jset(LS, "mth.ai.cfg", cfg); }; });
  box.querySelector("[data-s]").onclick = function () { set.classList.toggle("on"); };
  box.querySelector("[data-x]").onclick = function () { hist = []; jset(SS, "mth.ai.hist", hist); log.innerHTML = ""; add("a", "Chat cleared."); };
  function toggle(v) { box.classList.toggle("on", v); if (box.classList.contains("on")) inp.focus(); }
  btn.onclick = function () { toggle(); }; box.querySelector("[data-c]").onclick = function () { toggle(false); };
  document.addEventListener("keydown", function (e) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") { e.preventDefault(); toggle(); } if (e.key === "Escape") toggle(false); });
  box.querySelector("form").onsubmit = async function (e) {
    e.preventDefault(); var q = inp.value.trim(); if (!q) return; inp.value = ""; add("u", MTH.esc(q)); hist.push({ role: "user", content: q });
    var res = local(q), bubble = add("a", "…"), text = res.text;
    if (res.text.indexOf("couldn’t match") > -1 && cfg.key) { try { text = await llm(hist, function (t) { bubble.innerHTML = esc(t); log.scrollTop = log.scrollHeight; }); res = { text: text }; } catch (err) { text = res.text + "\n\n(LLM error: " + err.message + ")"; } }
    bubble.innerHTML = esc(text) + links(res.links); hist.push({ role: "assistant", content: text }); jset(SS, "mth.ai.hist", hist.slice(-30));
    if (res.go) setTimeout(function () { location.href = res.go; }, 600);
  };
  document.body.appendChild(box); document.body.appendChild(btn);
})();
