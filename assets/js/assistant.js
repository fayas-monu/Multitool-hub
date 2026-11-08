/* ==========================================================================
   MULTI TOOL HUB — Hub Assistant v6
   Local-first intelligence: memory, intent routing, utilities, tool guides,
   optional bring-your-own-key model streaming. No hub server is involved.
   ========================================================================== */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH || !MTH.tools || window.__mthAssistant) return;
  window.__mthAssistant = 1;

  /* ------------------------------------------------------------------ store */
  var LS = window.localStorage;
  var HKEY = "mth.ai.history.v6";
  var MKEY = "mth.ai.memory.v6";
  var CKEY = "mth.ai.cfg.v6";
  var GREET_KEY = "mth.ai.greet.session";

  function get(key, fallback) {
    try { var raw = LS.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function set(key, value) { try { LS.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function now() { return Date.now(); }
  function uid() { return "m" + now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var memory = get(MKEY, null);
  if (!memory || typeof memory !== "object") {
    memory = {
      name: "", facts: [], favourites: [], dislikes: [],
      prefs: { units: "metric", tone: "professional", density: "comfortable" },
      lastTool: "", lastQuery: "", lastResults: [],
      toolCounts: {}, visits: 0, interactions: 0,
      createdAt: now(), lastSeen: now()
    };
  }
  memory.prefs = memory.prefs || { units: "metric", tone: "professional", density: "comfortable" };
  memory.facts = Array.isArray(memory.facts) ? memory.facts : [];
  memory.favourites = Array.isArray(memory.favourites) ? memory.favourites : [];
  memory.dislikes = Array.isArray(memory.dislikes) ? memory.dislikes : [];
  memory.toolCounts = memory.toolCounts || {};
  memory.lastResults = Array.isArray(memory.lastResults) ? memory.lastResults : [];
  if (!memory.createdAt) memory.createdAt = now();
  memory.visits = (memory.visits || 0) + 1;
  memory.lastSeen = now();
  set(MKEY, memory);

  var history = get(HKEY, []);
  if (!Array.isArray(history)) history = [];
  var cfg = get(CKEY, {
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    key: "",
    useModel: true
  });
  cfg.useModel = cfg.useModel !== false;

  var ctx = { lastTool: memory.lastTool || "", lastResults: memory.lastResults.slice(), lastTopic: "" };
  var busy = false;
  var panel = null, logEl = null, inputEl = null, sendBtn = null;

  /* ------------------------------------------------------------- utilities */
  var TOOL_HREF = function (t) { return MTH.sitePath(t.href); };
  function esc(s) { return MTH.esc(String(s == null ? "" : s)); }
  function clean(s) { return String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim(); }
  function titleCase(s) { return String(s).replace(/\w\S*/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }); }
  function fmt(n, digits) {
    if (!isFinite(n)) return "—";
    var r = Math.round(n * Math.pow(10, digits == null ? 4 : digits)) / Math.pow(10, digits == null ? 4 : digits);
    return String(r).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function timeGreeting() {
    var h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }
  function categoryName(id) {
    var c = (MTH.categories || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.name : id;
  }
  function toolById(id) { return MTH.toolById ? MTH.toolById(id) : (MTH.tools.filter(function (t) { return t.id === id; })[0] || null); }
  function linkTool(t) {
    return '<a class="m-tool" href="' + esc(TOOL_HREF(t)) + '">' + MTH.ui.icon(t.icon, "", 11) + esc(t.short || t.title) + "</a>";
  }
  function toolChips(list) {
    if (!list || !list.length) return "";
    return '<div class="m-tools">' + list.slice(0, 4).map(linkTool).join("") + "</div>";
  }

  /* --------------------------------------------------------- memory engine */
  function addFact(text, tag) {
    text = String(text || "").trim().replace(/^that\s+/i, "");
    if (!text || text.length < 2) return false;
    var norm = clean(text);
    if (memory.facts.some(function (f) { return clean(f.text) === norm; })) return false;
    memory.facts.push({ id: uid(), text: text, tag: tag || "note", at: now() });
    if (memory.facts.length > 60) memory.facts.shift();
    set(MKEY, memory);
    return true;
  }
  function forgetFact(fragment) {
    var q = clean(fragment);
    var before = memory.facts.length;
    memory.facts = memory.facts.filter(function (f) { return clean(f.text).indexOf(q) === -1; });
    set(MKEY, memory);
    return before !== memory.facts.length;
  }
  function rememberTool(t) {
    if (!t) return;
    memory.lastTool = t.id;
    memory.lastQuery = ctx.lastTopic || memory.lastQuery;
    memory.toolCounts[t.id] = (memory.toolCounts[t.id] || 0) + 1;
    memory.lastResults = ctx.lastResults.slice(0, 5);
    set(MKEY, memory);
  }

  function extractMemory(text) {
    var l = clean(text), changed = [];
    var m;
    if ((m = l.match(/\b(?:my name is|call me|you can call me)\s+([a-z][a-z .'-]{1,28})/))) {
      var name = titleCase(m[1].replace(/[.!?].*$/, "").trim());
      if (name && name !== memory.name) { memory.name = name; changed.push("name"); }
    }
    if (/\b(i prefer|use|switch to)\b.*\bmetric\b/.test(l) || /\bmetric units?\b/.test(l)) {
      memory.prefs.units = "metric"; changed.push("units");
    }
    if (/\b(i prefer|use|switch to)\b.*\bimperial\b/.test(l) || /\bimperial units?\b/.test(l) || /\b(feet|inches|pounds|lbs)\b/.test(l) && /prefer/.test(l)) {
      memory.prefs.units = "imperial"; changed.push("units");
    }
    if (/\bremember (that )?(.+)/.test(l)) {
      var fact = text.replace(/^.*?\bremember (that )?/i, "").trim();
      if (fact.length > 2 && addFact(fact, "remembered")) changed.push("fact");
    }
    if (/\bnote (that )?(.+)/.test(l) && /\b(remember|keep|save)\b/.test(l)) {
      addFact(text.replace(/^.*?\bnote (that )?/i, "").trim(), "remembered");
    }
    if ((m = l.match(/\bmy (?:favourite|favorite) (?:tool|workspace|thing) is (?:the )?(.+)/))) {
      var ft = rank(m[1])[0];
      if (ft) {
        memory.favourites = [ft.t.id].concat(memory.favourites.filter(function (x) { return x !== ft.t.id; })).slice(0, 8);
        changed.push("favourite");
      }
    }
    if ((m = l.match(/\b(?:i don't like|i hate|i dislike|never show me)\s+(.+)/))) {
      addFact("Dislikes: " + m[1].trim(), "dislike");
      changed.push("dislike");
    }
    if (/\bforget everything\b|\bclear (your )?memory\b|\bstart over\b/.test(l)) {
      memory.name = "";
      memory.facts = [];
      memory.favourites = [];
      memory.dislikes = [];
      memory.prefs = { units: "metric", tone: "professional", density: "comfortable" };
      memory.lastTool = "";
      memory.lastResults = [];
      changed.push("cleared");
    } else if ((m = l.match(/\bforget (?:that )?(.+)/))) {
      if (forgetFact(m[1])) changed.push("forgot");
    }
    if (changed.length) set(MKEY, memory);
    return changed;
  }

  function memorySummary() {
    var lines = [];
    lines.push("**Name:** " + (memory.name || "not set"));
    lines.push("**Units:** " + memory.prefs.units);
    lines.push("**Last tool:** " + (memory.lastTool && toolById(memory.lastTool) ? toolById(memory.lastTool).title : "none yet"));
    if (memory.favourites.length) {
      lines.push("**Favourites:** " + memory.favourites.map(function (id) {
        var t = toolById(id); return t ? t.title : id;
      }).join(", "));
    }
    if (memory.facts.length) {
      lines.push("**Remembered:**");
      memory.facts.slice(-12).forEach(function (f) { lines.push("- " + f.text); });
    }
    if (!memory.name && !memory.facts.length && !memory.favourites.length) {
      lines.push("I have not stored any personal details yet. Try “my name is …” or “remember that I prep invoices every Friday”.");
    }
    return lines.join("\n");
  }

  /* ------------------------------------------------------------- search */
  var STOP = { a: 1, an: 1, the: 1, to: 1, for: 1, of: 1, and: 1, in: 1, on: 1, with: 1, from: 1, me: 1, my: 1, i: 1, can: 1, you: 1, please: 1, how: 1, do: 1, does: 1, want: 1, need: 1, would: 1, like: 1, help: 1, use: 1, is: 1, there: 1, tool: 1, tools: 1 };
  function words(s) {
    return clean(s).replace(/[^a-z0-9+ ]/g, " ").split(/\s+/).filter(function (w) { return w && !STOP[w]; }).map(function (w) { return w.replace(/s$/, ""); });
  }
  function hay(t) {
    return clean([t.title, t.short, t.desc, (t.tags || []).join(" "), t.aliases, categoryName(t.cat)].join(" "));
  }
  function rank(q) {
    var qw = words(q), ql = clean(q);
    if (!qw.length) return [];
    var scored = MTH.tools.map(function (t) {
      var h = hay(t), title = clean(t.title + " " + t.short), sc = 0, hit = 0;
      qw.forEach(function (w) {
        if (title.indexOf(w) > -1) { sc += 7; hit++; }
        else if (h.indexOf(w) > -1) { sc += 4; hit++; }
        else if (h.split(" ").some(function (x) { return x.indexOf(w) === 0; })) { sc += 2; hit++; }
      });
      if (hit < Math.ceil(qw.length * .6)) sc = 0;
      var dir = ql.match(/([a-z0-9]+)\s+to\s+([a-z0-9]+)/);
      if (dir) {
        if (t.aliases.indexOf(dir[1] + " to " + dir[2]) > -1) sc += 10;
        else if (t.aliases.indexOf(dir[2] + " to " + dir[1]) > -1) sc -= 7;
      }
      if (title.indexOf(ql) > -1) sc += 9;
      if (memory.favourites.indexOf(t.id) > -1) sc += 1.5;
      return { t: t, s: sc };
    }).filter(function (x) { return x.s > 2; });
    scored.sort(function (a, b) { return b.s - a.s || a.t.title.localeCompare(b.t.title); });
    return scored.slice(0, 6);
  }
  function describeTool(t) {
    return "**" + t.title + "** — " + t.desc + "\n\n" +
      "Workspace: " + categoryName(t.cat) + " · Tags: " + (t.tags || []).join(", ") + ". " +
      (t.cat === "download" ? "This tool sends only the public link to the partner API." : "Runs locally in this tab.");
  }

  /* ---------------------------------------------------------- calculators */
  function calc(q) {
    var raw = clean(q), m, n;
    if ((m = raw.match(/^(?:what is|calculate|calc|compute|solve)?\s*([-+*/().\d\s%^]+)$/)) && /\d/.test(m[1])) {
      var e = m[1].replace(/\^/g, "**").replace(/x/g, "*").replace(/÷/g, "/");
      if (/[\d)]\s*[-+*/%]\s*[\d(]/.test(e) || /^\s*[-+(]/.test(e)) {
        try {
          var r = Function('"use strict";return (' + e + ")")();
          if (isFinite(r)) return { text: "**" + fmt(r, 8) + "**" };
        } catch (err) {}
      }
    }
    if ((m = raw.match(/([\d.]+)\s*%\s*(?:of|off|discount on|discount of)\s*([\d.]+)/))) {
      var p = +m[1], v = +m[2];
      if (/%\s*off|discount/.test(m[0])) return { text: "**" + fmt(v * (1 - p / 100), 2) + "** after " + p + "% off " + fmt(v) + " (you save " + fmt(v * p / 100, 2) + ")." };
      return { text: p + "% of " + fmt(v) + " = **" + fmt(v * p / 100, 2) + "**" };
    }
    if ((m = raw.match(/(?:tip|gratuity)\s*(?:on|for)?\s*([\d.]+)\s*(?:at|of)?\s*([\d.]+)\s*%/))) {
      var bill = +m[1], tip = +m[2], tipAmt = bill * tip / 100;
      return { text: "A " + tip + "% tip on " + fmt(bill, 2) + " is **" + fmt(tipAmt, 2) + "**, for a total of **" + fmt(bill + tipAmt, 2) + "**." };
    }
    if ((m = raw.match(/(?:split|share|divide)\s*([\d.]+)\s*(?:between|among|by|with|into)?\s*(\d+)/))) {
      var total = +m[1], people = Math.max(1, +m[2]);
      return { text: fmt(total, 2) + " split " + people + " ways = **" + fmt(total / people, 2) + "** each." };
    }
    if ((m = raw.match(/(?:increase|decrease)\s*([\d.]+)\s*by\s*([\d.]+)\s*%/))) {
      var base = +m[1], pct = +m[2], up = /^increase/.test(m[0]);
      var out = up ? base * (1 + pct / 100) : base * (1 - pct / 100);
      return { text: fmt(base) + (up ? " increased" : " decreased") + " by " + pct + "% = **" + fmt(out, 2) + "**." };
    }
    if ((m = raw.match(/(?:percent(?:age)? (?:change|difference)|change)\s*(?:from)?\s*([\d.]+)\s*(?:to|and)\s*([\d.]+)/))) {
      var a = +m[1], b = +m[2];
      if (a === 0) return { text: "A percentage change from zero is undefined." };
      var change = (b - a) / Math.abs(a) * 100;
      return { text: "From " + fmt(a) + " to " + fmt(b) + " is a **" + fmt(change, 2) + "%** " + (change >= 0 ? "increase" : "decrease") + "." };
    }
    if ((m = raw.match(/^(?:average|mean)\s+(?:of\s+)?([\d.\s,]+)/))) {
      var nums = m[1].split(/[\s,]+/).map(Number).filter(function (x) { return isFinite(x); });
      if (nums.length) return { text: "Average of " + nums.length + " values = **" + fmt(nums.reduce(function (x, y) { return x + y; }, 0) / nums.length, 4) + "**." };
    }
    return null;
  }

  /* ------------------------------------------------------------- converters */
  var UNITS = {
    // data
    b: [1, "data", "bytes"], kb: [1024, "data", "kilobytes"], mb: [1048576, "data", "megabytes"], gb: [1073741824, "data", "gigabytes"], tb: [1099511627776, "data", "terabytes"],
    // length
    mm: [.001, "length", "millimetres"], cm: [.01, "length", "centimetres"], m: [1, "length", "metres"], km: [1000, "length", "kilometres"], in: [.0254, "length", "inches"], ft: [.3048, "length", "feet"], yd: [.9144, "length", "yards"], mi: [1609.344, "length", "miles"],
    // mass
    mg: [.000001, "mass", "milligrams"], g: [.001, "mass", "grams"], kg: [1, "mass", "kilograms"], t: [1000, "mass", "tonnes"], oz: [.028349523125, "mass", "ounces"], lb: [.45359237, "mass", "pounds"], st: [6.35029318, "mass", "stone"],
    // time
    ms: [.001, "time", "milliseconds"], s: [1, "time", "seconds"], sec: [1, "time", "seconds"], min: [60, "time", "minutes"], h: [3600, "time", "hours"], hr: [3600, "time", "hours"], d: [86400, "time", "days"], wk: [604800, "time", "weeks"],
    // volume
    ml: [.001, "volume", "millilitres"], l: [1, "volume", "litres"], gal: [3.785411784, "volume", "US gallons"], qt: [.946352946, "volume", "US quarts"], pt: [.473176473, "volume", "US pints"], cup: [.2365882365, "volume", "US cups"], floz: [.0295735296, "volume", "US fluid ounces"],
    // speed
    mps: [1, "speed", "metres per second"], kmh: [.277777778, "speed", "kilometres per hour"], mph: [.44704, "speed", "miles per hour"], kn: [.514444444, "speed", "knots"]
  };
  function convert(q) {
    var raw = clean(q), m;
    if ((m = raw.match(/(-?[\d.]+)\s*(?:degrees?\s*)?(c|f|k)\b\s*(?:to|in|into)\s*(?:degrees?\s*)?(c|f|k)\b/))) {
      var v = +m[1], a = m[2], b = m[3], celsius = a === "c" ? v : a === "f" ? (v - 32) * 5 / 9 : v - 273.15;
      var out = b === "c" ? celsius : b === "f" ? celsius * 9 / 5 + 32 : celsius + 273.15;
      var sym = { c: "°C", f: "°F", k: "K" };
      return "**" + fmt(v, 2) + " " + sym[a] + " = " + fmt(out, 2) + " " + sym[b] + "**";
    }
    if ((m = raw.match(/(-?[\d.]+)\s*([a-z]{1,4})\s*(?:to|in|into)\s*([a-z]{1,4})\b/))) {
      var val = +m[1], from = m[2], to = m[3];
      if (from === "l" && to === "ml") return "**" + fmt(val * 1000) + " ml**";
      if (UNITS[from] && UNITS[to] && UNITS[from][1] === UNITS[to][1]) {
        var result = val * UNITS[from][0] / UNITS[to][0];
        return "**" + fmt(val) + " " + from + " = " + fmt(result, 6) + " " + to + "**";
      }
    }
    return null;
  }

  /* --------------------------------------------------------------- text toys */
  function password(len) {
    len = Math.max(8, Math.min(64, len || 18));
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?";
    var out = "", buf = new Uint32Array(len);
    try { (window.crypto || window.msCrypto).getRandomValues(buf); } catch (e) { for (var k = 0; k < len; k++) buf[k] = Math.floor(Math.random() * 1e9); }
    for (var i = 0; i < len; i++) out += chars[buf[i] % chars.length];
    return out;
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 3 | 8);
      return v.toString(16);
    });
  }
  function b64(s) { try { return btoa(unescape(encodeURIComponent(s))); } catch (e) { return "That text could not be encoded."; } }
  function unb64(s) { try { return decodeURIComponent(escape(atob(s))); } catch (e) { return "That is not valid Base64."; } }
  async function sha256(s) {
    if (!(window.crypto && crypto.subtle)) return null;
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  /* ------------------------------------------------------------- date maths */
  function parseDate(s) {
    s = String(s || "").trim();
    var m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/);
    if (m) { var y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return new Date(y, +m[2] - 1, +m[1]); }
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function dateFmt(d) {
    try { return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }); }
    catch (e) { return d.toDateString(); }
  }
  function dateAnswer(q) {
    var raw = clean(q), m, d;
    if (/\b(what|which|today'?s?) (time|date|day)\b|\btime is it\b|\bdate today\b/.test(raw)) {
      var n = new Date();
      return "It is **" + n.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) + "** on **" + dateFmt(n) + "**.";
    }
    if ((m = raw.match(/(?:days?|how many days)\s*(?:until|till|to)\s+(.+)/))) {
      var target = parseDate(m[1]);
      if (target) {
        var days = Math.ceil((new Date(target.getFullYear(), target.getMonth(), target.getDate()) - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000);
        return "**" + Math.abs(days) + " day" + (Math.abs(days) === 1 ? "" : "s") + "** " + (days >= 0 ? "until" : "since") + " " + dateFmt(target) + ".";
      }
    }
    if ((m = raw.match(/(?:date|day)\s+(?:in|after)\s+(\d+)\s+days?/))) {
      d = new Date(); d.setDate(d.getDate() + +m[1]);
      return "**" + dateFmt(d) + "** is " + m[1] + " days from today.";
    }
    if ((m = raw.match(/(?:age|how old)\b.*?(?:born|birthday|birth)\s*(?:on|is|:)?\s*(.+)/))) {
      var born = parseDate(m[1]);
      if (born) {
        var today = new Date(), age = today.getFullYear() - born.getFullYear();
        var mo = today.getMonth() - born.getMonth();
        if (mo < 0 || (mo === 0 && today.getDate() < born.getDate())) age--;
        return "If the birth date is **" + dateFmt(born) + "**, the age is **" + age + "**.";
      }
    }
    var week = raw.match(/\b(?:week|week number)\s*(\d+)\b/);
    if (week) {
      var y = new Date().getFullYear();
      var first = new Date(y, 0, 1);
      var day = first.getDay() || 7;
      var monday = new Date(y, 0, 1 + (day === 1 ? 0 : 8 - day));
      monday.setDate(monday.getDate() + (+week[1] - 1) * 7);
      return "Week " + week[1] + " of " + y + " starts around **" + dateFmt(monday) + "**.";
    }
    return null;
  }

  /* ------------------------------------------------------------ FAQ library */
  var FAQ = [
    [/privacy|upload|safe|secure|server|my files|leaves/, "Your files never leave this device. PDF, image and media tools run entirely in your browser using the File API, Canvas, PDF.js and pdf-lib. The only third-party calls are the YouTube and Instagram downloaders, which receive only the public link you paste.", ["Privacy policy", "privacy"]],
    [/offline|install|pwa|service worker/, "MULTI TOOL HUB is an installable progressive web app. After the first visit the service worker caches the interface and vendored engines, so local file tools keep working offline. The downloaders still need a connection.", ["Open the hub", "home"]],
    [/ocr|scanned|scan text|image text/, "OCR is not included. PDF to Word, Text and Excel read the PDF's existing text layer. A scanned page is an image, so annotate it in the Viewer instead, or run OCR elsewhere first.", ["PDF to Text", "pdf-to-text"]],
    [/password|encrypt|protect|unlock/, "Unlock PDF removes protection only when you already know the password. It never guesses, cracks, uploads or bypasses anything. Password-protected files open read-only in the Viewer until unlocked.", ["Unlock PDF", "unlock"]],
    [/shortcut|keyboard|hotkey/, "Press Ctrl/⌘+K or / to jump to tool search. Ctrl/⌘+J opens this assistant. Esc closes panels, and in the Viewer Ctrl/⌘+Z undoes, Ctrl/⌘+S exports and arrow keys change pages.", ["Show shortcuts", "shortcuts"]],
    [/who made|credit|developer|author|owner|created/, "MULTI TOOL HUB is a local-first build. The developer credit is: " + MTH.credit + ".", ["About the build", "about"]],
    [/watermark.*(mine|my|added|output)|output.*watermark|limit|quota|paid|price|free/, "There is no hub watermark, export quota or paid tier. A watermark appears only when you add one yourself. Your practical limits are this device's memory and CPU.", ["Watermark PDF", "watermark"]],
    [/browser|safari|firefox|chrome|edge/, "Current Chrome, Edge, Firefox and Safari are supported. MediaRecorder and Web Audio features vary slightly by browser; when a capability is missing the tool says so instead of failing silently.", ["Video Compressor", "video-compress"]],
    [/youtube|instagram|downloader|loader\.to|legal.*download/, "The downloaders check a public link, then open a Loader.to card in a new tab. That provider receives the public URL; no file, account or password is sent. Save only content you own or have permission to keep.", ["YouTube Downloader", "youtube-downloader"]],
    [/memory|remember|what do you know about me|personal/, "I keep a small memory in this browser's local storage: your name if you share it, preferences, favourites and facts you ask me to remember. Nothing is sent to a server. Use the Memory button to inspect or clear it.", ["Open my memory", "memory"]],
    [/ai|model|api key|groq|openai|llm/, "Local mode needs no key. If you add your own provider key in Settings, messages go directly from this tab to that endpoint. The key stays in local storage and is never sent to the hub.", ["Open settings", "settings"]],
    [/after hours|ambient|soundscape|rain|focus music|chromatic|palette|entertainment|game/, "After Hours is the optional downtime wing: Ambient Studio generates rain, ocean, forest and deep-focus sound with Web Audio; Chromatic Lab builds palettes and gradients; Focus Studio keeps a Pomodoro timer and task list. No games, no accounts.", ["Open After Hours", "entertainment"]],
    [/pdf editor|annotate|signature|redact|sticky|comment|underline|strike/, "The Viewer & Editor can add text, shapes, highlights, ink, images, watermarks, underline, strike-through, sticky comments, redaction/whiteout, signatures and blank pages. It also rotates, reorders, duplicates, splits and merges pages, then exports vector or flattened PDF.", ["Open Viewer & Editor", "viewer"]],
    [/compress.*pdf|reduce.*pdf|shrink.*pdf/, "Compress PDF has two modes: a lossless structure clean-up, or a lower-resolution rebuild for a much smaller file. Start lossless; if it is still too large, rebuild at 150–200 DPI.", ["Compress PDF", "compress"]],
    [/image.*size|compress.*image|target size|200 kb|photo/, "Image Compressor can target a quality level or a file size. For a 200 KB target, use JPG or WebP, keep the long edge around 1600–2000 px, and let the target-size pass tune quality for you.", ["Image Compressor", "image-compress"]],
    [/convert.*pdf.*word|pdf.*docx|editable.*pdf/, "PDF to Word rebuilds a real .docx from the PDF text layer with headings and page breaks. Scanned PDFs need OCR first. Complex layouts may need tidying in Word.", ["PDF to Word", "pdf-to-word"]],
    [/merge|combine.*pdf|join.*pdf/, "Merge PDF copies pages in the order you choose across multiple documents. Use the Viewer for visual reordering and annotations before export.", ["Merge PDF", "merge"]],
    [/split|extract.*page|separate.*pdf/, "Split PDF extracts ranges, splits every page, or creates fixed-size chunks and downloads a ZIP. The Viewer can also extract the current range with annotations included.", ["Split PDF", "split"]],
    [/crop|trim|margin/, "Crop PDF gives you eight handles plus an auto-trim pass, and can apply the crop to one page or a range. The Viewer's export flattens the visible area, so preview before saving.", ["Crop PDF", "crop"]],
    [/video.*mp3|audio.*video|extract.*audio/, "Video to Audio extracts the audio track locally, with trim and fades, and exports WAV or MP3. Long videos use more memory because encoding happens on your device.", ["Video to Audio", "video-to-audio"]],
    [/video.*compress|reduce.*video|webm/, "Video Compressor re-encodes with MediaRecorder, choosing resolution, bitrate and trim range. WebM is the most reliable output across browsers.", ["Video Compressor", "video-compress"]],
    [/background|transparent|cut ?out/, "Background Remover uses an edge-aware Canvas algorithm for flat or near-flat backgrounds. It works best on product shots and portraits with clean separation; complex scenes may need manual masking.", ["Background Remover", "background-remove"]]
  ];
  function faq(q) {
    var l = clean(q);
    for (var i = 0; i < FAQ.length; i++) if (FAQ[i][0].test(l)) return FAQ[i];
    return null;
  }

  /* -------------------------------------------------------------- phrasing */
  function toolLine(t) {
    return '**' + esc(t.title) + "** — " + esc(t.desc);
  }
  function recommendation(list, intro) {
    if (!list.length) return null;
    var top = list[0].t || list[0];
    var rest = list.slice(1).map(function (x) { return x.t || x; });
    ctx.lastTool = top.id;
    ctx.lastResults = list.map(function (x) { return (x.t || x).id; });
    memory.lastResults = ctx.lastResults;
    memory.lastQuery = ctx.lastTopic || "";
    set(MKEY, memory);
    return {
      text: (intro || ("**" + top.title + "** is the closest fit.")) + "\n\n" + top.desc +
        (rest.length ? "\n\nAlso relevant: " + rest.slice(0, 3).map(function (t) { return t.title; }).join(", ") + "." : "") +
        "\n\nSay “open it” to launch it, or “explain it” for details.",
      tools: [top].concat(rest.slice(0, 3)),
      actions: [
        { label: "Open " + top.short, prompt: "open " + top.title },
        { label: "Explain it", prompt: "explain " + top.title },
        { label: "More options", prompt: "more options" }
      ],
      speak: top.title + ". " + top.desc
    };
  }

  /* --------------------------------------------------------------- handlers */
  var HELP_TEXT = [
    "**I am the Hub Assistant.** I can:",
    "- Find, explain and open any of the " + MTH.tools.length + " tools",
    "- Calculate, convert units, split bills and work with dates",
    "- Count, transform and encode text; generate passwords and UUIDs",
    "- Remember your name, preferences, favourites and notes on this device",
    "- Answer privacy, format, OCR and downloader questions",
    "- Stream an answer from your own model key when local intent cannot help",
    "",
    "Try: “merge two PDFs”, “compress a photo to 200 KB”, “18% tip on 84”, “my name is Alex”, or “open Ambient Studio”."
  ].join("\n");

  function localReply(q) {
    var raw = q.trim(), l = clean(raw), m, res, t;

    /* identity / greeting */
    if (/^(hi|hello|hey|yo|salam|hola|good (morning|afternoon|evening))\b/.test(l)) {
      var g = timeGreeting() + (memory.name ? ", " + memory.name : "") + ".";
      var extra = memory.lastTool && toolById(memory.lastTool)
        ? " Last time we looked at **" + toolById(memory.lastTool).title + "**."
        : "";
      return { text: g + extra + " What are you working on? I can find a tool, do a quick calculation, or just talk through the job.", actions: [{ label: "Show all tools", prompt: "list all tools" }, { label: "What can you do?", prompt: "what can you do" }] };
    }
    if (/^(thanks|thank you|cheers|ta)\b/.test(l)) {
      return { text: "You are welcome" + (memory.name ? ", " + memory.name : "") + ". I will keep your preferences and recent context on this device for next time.", actions: [{ label: "Keep exploring", prompt: "list all tools" }] };
    }
    if (/^(bye|goodbye|see you|good night)\b/.test(l)) {
      return { text: "Goodbye" + (memory.name ? ", " + memory.name : "") + ". Your files stay exactly where they are — on this device." };
    }
    if (/^(who are you|what are you|your name)\b/.test(l)) {
      return { text: "I am the **Hub Assistant** for MULTI TOOL HUB v6. I run locally in this tab, remember useful context on this device, and only contact a model if you add your own API key. I am not a general cloud chatbot by default.", actions: [{ label: "What can you do?", prompt: "what can you do" }] };
    }

    /* memory commands */
    if (/^what do you remember|show (your )?memory|open (my )?memory|memory$/.test(l)) {
      return { text: memorySummary(), actions: [{ label: "Manage memory", prompt: "__memory__" }, { label: "Forget everything", prompt: "forget everything" }] };
    }
    if (/^forget everything|^clear (your )?memory|^start over/.test(l)) {
      extractMemory(q);
      return { text: "Memory cleared. I no longer know your name, preferences, favourites or saved notes. The tool catalogue is untouched.", actions: [{ label: "Start again", prompt: "my name is " }] };
    }
    if (/^remember\b|^note that\b/.test(l)) {
      var ch = extractMemory(q);
      if (ch.indexOf("fact") > -1) return { text: "Noted. I will keep that on this device and use it for context. You can review it any time with the Memory button.", actions: [{ label: "View memory", prompt: "what do you remember" }] };
      return { text: "Tell me what to remember, for example: “remember that I invoice clients every Friday.”" };
    }
    if (/^my name is\b|^call me\b/.test(l)) {
      extractMemory(q);
      return { text: memory.name ? "Pleased to meet you, **" + esc(memory.name) + "**. I will use your name in this browser from now on." : "I could not catch the name. Try “call me Alex”." };
    }

    /* help / lists */
    if (/^(help|what can you do|commands|capabilities|how do you work|\/help)\b/.test(l)) {
      return { text: HELP_TEXT, actions: [{ label: "List tools", prompt: "list all tools" }, { label: "After Hours", prompt: "after hours" }] };
    }
    if (/^(list|show|see) (all )?(the )?tools|^what tools|^tool list|^catalogue$/.test(l) || l === "tools") {
      var cats = {};
      MTH.tools.forEach(function (t) { (cats[t.cat] = cats[t.cat] || []).push(t); });
      var body = "**" + MTH.tools.length + " tools across " + MTH.categories.length + " workspaces:**\n" +
        MTH.categories.map(function (c) {
          return "\n**" + c.name + "**\n" + (cats[c.id] || []).map(function (t) { return "- " + t.title; }).join("\n");
        }).join("\n");
      return { text: body, tools: MTH.tools.slice(0, 4), actions: [{ label: "Open catalogue", prompt: "__home__" }] };
    }
    if ((m = l.match(/^(?:list|show|what(?:'s| is) in) (?:the )?(pdf|image|media|download|focus|after hours)\b/))) {
      var cid = m[1] === "after hours" ? "focus" : m[1];
      var list = MTH.tools.filter(function (x) { return x.cat === cid; });
      return { text: "**" + categoryName(cid) + "** has " + list.length + " tools:\n" + list.map(function (x) { return "- **" + x.title + "** — " + x.desc; }).join("\n"), tools: list.slice(0, 4) };
    }
    if (/^(list|show).*(shortcuts?|keys?)/.test(l)) {
      return { text: "**Keyboard shortcuts**\n- Ctrl/⌘+K or / — search tools\n- Ctrl/⌘+J — open this assistant\n- Esc — close panels\n- Viewer: Ctrl/⌘+Z undo, Ctrl/⌘+S export, arrows change page\n- Viewer tools: V select, T text, R rectangle, H highlight, P pen" };
    }

    /* special UI actions */
    if (/^(shortcuts?|about|settings|__settings__)$/.test(l)) {
      if (l === "settings") { return { text: "Open the assistant Settings drawer to add an optional endpoint, model and key. Local mode works without any key.", ui: "settings" }; }
      if (l === "about") return { text: "MULTI TOOL HUB v6 — a local-first utility suite for PDF, image, media and After Hours work.\n\n" + MTH.credit, tools: [] };
      return { text: "**Shortcuts:** Ctrl/⌘+K search · Ctrl/⌘+J assistant · Esc close · Ctrl/⌘+Z undo in Viewer · Ctrl/⌘+S export in Viewer." };
    }
    if (/^__memory__$/.test(l)) return { text: memorySummary(), ui: "memory" };

    /* after-hours guide */
    if (/after hours|ambient|soundscape|rain|ocean|chromatic|palette|breathing|entertainment/.test(l)) {
      return {
        text: "**After Hours** is the optional downtime wing, built with the same local-first rules.\n\n- **Ambient Studio** — generative rain, ocean, forest, deep-focus and night soundscapes with a live visualiser and fade timer.\n- **Chromatic Lab** — seed a palette, explore harmonies, copy CSS and export a PNG board.\n- **Focus Studio** — Pomodoro timer and a persistent task list, with a direct link to a break soundscape.\n\nNo games, no accounts, no uploads.",
        tools: MTH.tools.filter(function (x) { return x.cat === "focus"; }),
        actions: [{ label: "Open Ambient Studio", prompt: "open ambient studio" }, { label: "Open Chromatic Lab", prompt: "open chromatic lab" }]
      };
    }

    /* open / navigate */
    if ((m = l.match(/^(?:open|launch|start|go to|take me to)\s+(?:the\s+)?(.+)/))) {
      var target = m[1].replace(/\s+(tool|page)$/, "");
      if (/^(it|that|this|that one|this one)$/.test(target)) {
        if (ctx.lastTool) return { text: "Opening **" + toolById(ctx.lastTool).title + "**…", go: TOOL_HREF(toolById(ctx.lastTool)) };
        return { text: "Tell me which tool first, for example “open Merge PDF”." };
      }
      var r = rank(target);
      if (!r.length) return { text: "I could not find a tool called “" + esc(target) + "”. Try “merge pdf”, “image compressor”, or say “list all tools”." };
      t = r[0].t;
      rememberTool(t);
      return { text: "Opening **" + t.title + "**…", go: TOOL_HREF(t), tools: [t] };
    }
    if (/^(open|go|home|homepage|catalogue)$/.test(l) || l === "__home__") {
      return { text: "Opening the tool catalogue…", go: MTH.sitePath("index.html#tools") };
    }

    /* explain */
    if ((m = l.match(/^(?:explain|what is|what does|tell me about|details? (?:on|for))\s+(.+)/))) {
      var ex = m[1].replace(/\s+(tool|do|work)$/, "");
      if (/^(it|that|this|that one|this one)$/.test(ex) && ctx.lastTool) t = toolById(ctx.lastTool);
      else { var rr = rank(ex); t = rr.length ? rr[0].t : null; }
      if (t) {
        ctx.lastTool = t.id; ctx.lastTopic = "explain:" + t.id;
        return { text: describeTool(t), tools: [t], actions: [{ label: "Open it", prompt: "open " + t.title }, { label: "Related tools", prompt: "tools like " + t.title }] };
      }
    }

    /* follow-ups */
    if (/^(it|that|this|that one|this one|the first|first one|number one)$/.test(l)) {
      if (ctx.lastTool) { t = toolById(ctx.lastTool); return { text: "**" + t.title + "** — " + t.desc, tools: [t], actions: [{ label: "Open it", prompt: "open it" }] }; }
    }
    if ((m = l.match(/^(?:the )?(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)(?: one| option| result)?$/))) {
      var idx = { first: 0, "1st": 0, second: 1, "2nd": 1, third: 2, "3rd": 2, fourth: 3, "4th": 3, fifth: 4, "5th": 4 }[m[1]];
      var id = ctx.lastResults[idx];
      t = id ? toolById(id) : null;
      if (t) { ctx.lastTool = t.id; return { text: "**" + t.title + "** — " + t.desc, tools: [t], actions: [{ label: "Open it", prompt: "open " + t.title }] }; }
    }
    if (/^(open it|do it|launch it|go there)$/.test(l) && ctx.lastTool) {
      t = toolById(ctx.lastTool); return { text: "Opening **" + t.title + "**…", go: TOOL_HREF(t) };
    }
    if (/^(why|why that|why this)\b/.test(l) && ctx.lastTool) {
      t = toolById(ctx.lastTool);
      return { text: "I suggested **" + t.title + "** because its job matches the words in your request: " + (t.tags || []).join(", ") + ". " + (t.cat === "download" ? "It uses the disclosed partner API rather than local processing." : "It processes the file locally in this tab.") };
    }
    if (/^(more|more options|anything else|other options|alternatives?)$/.test(l)) {
      var more = ctx.lastResults.map(toolById).filter(Boolean);
      if (more.length) return { text: "Other tools that may fit:\n" + more.slice(1).map(function (x) { return "- **" + x.title + "** — " + x.desc; }).join("\n"), tools: more.slice(1, 5) };
    }

    /* calculator / converters */
    res = calc(raw);
    if (res) return res;
    res = convert(raw);
    if (res) return { text: res };
    res = dateAnswer(raw);
    if (res) return { text: res };

    /* text utilities */
    if ((m = raw.match(/^(?:count|word count|words?)\s*[:\-]\s*([\s\S]+)/i))) {
      var tx = m[1];
      var chars = tx.replace(/\s/g, "").length, wordsN = tx.trim() ? tx.trim().split(/\s+/).length : 0;
      return { text: "**" + wordsN + "** words · **" + tx.length + "** characters · **" + chars + "** without spaces · **" + tx.split(/\r?\n/).length + "** lines." };
    }
    if ((m = raw.match(/^(uppercase|upper)\s*[:\-]\s*([\s\S]+)/i))) return { text: m[2].toUpperCase() };
    if ((m = raw.match(/^(lowercase|lower)\s*[:\-]\s*([\s\S]+)/i))) return { text: m[2].toLowerCase() };
    if ((m = raw.match(/^(title case|titlecase)\s*[:\-]\s*([\s\S]+)/i))) return { text: titleCase(m[2]) };
    if ((m = raw.match(/^(reverse|flip)\s*[:\-]\s*([\s\S]+)/i))) return { text: m[2].split("").reverse().join("") };
    if ((m = raw.match(/^(slug|slugify)\s*[:\-]\s*([\s\S]+)/i))) return { text: m[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") };
    if ((m = raw.match(/^(base64|encode)\s*[:\-]\s*([\s\S]+)/i))) return { text: "`" + b64(m[2]) + "`" };
    if ((m = raw.match(/^(unbase64|decode)\s*[:\-]\s*([\s\S]+)/i))) return { text: unb64(m[2].trim()) };
    if ((m = raw.match(/^(?:sha-?256|hash)\s*[:\-]\s*([\s\S]+)/i))) {
      return sha256(m[1]).then(function (h) { return { text: h ? "`" + h + "`" : "This browser does not expose Web Crypto in this context." }; });
    }
    if ((m = l.match(/(?:generate|make|create|give me)?\s*(?:a\s+)?(?:strong\s+)?password(?:\s+(?:of\s+)?(\d+))?/))) {
      var len = m[1] ? +m[1] : 18, pw = password(len);
      return { text: "Generated locally with Web Crypto:\n`" + pw + "`\n\nUse a password manager and never reuse it.", actions: [{ label: "Copy password", copy: pw }, { label: "Another", prompt: "generate password " + len }] };
    }
    if (/\b(uuid|guid)\b/.test(l)) { var id2 = uuid(); return { text: "`" + id2 + "`", actions: [{ label: "Copy UUID", copy: id2 }, { label: "Another", prompt: "uuid" }] }; }
    if ((m = l.match(/^(?:pick|choose|select)\s+(?:from\s+)?(.+)/))) {
      var opts = m[1].split(/\s*(?:\||,| or )\s*/).filter(Boolean);
      if (opts.length > 1) return { text: "I pick **" + opts[Math.floor(Math.random() * opts.length)] + "**." };
    }
    if (/\b(flip|toss) (a )?coin\b/.test(l)) return { text: "🪙 **" + (Math.random() < .5 ? "Heads" : "Tails") + "**." };
    if ((m = l.match(/\b(?:roll|throw)\s+(?:a\s+)?(?:d(\d+)|dice)\b/))) {
      var sides = m[1] ? +m[1] : 6, roll = Math.floor(Math.random() * sides) + 1;
      return { text: "🎲 d" + sides + " → **" + roll + "**." };
    }
    if ((m = l.match(/\brandom (?:number|integer)\s*(?:between|from)?\s*(\d+)\s*(?:and|to|-)\s*(\d+)/))) {
      var lo = Math.min(+m[1], +m[2]), hi = Math.max(+m[1], +m[2]);
      return { text: "**" + (Math.floor(Math.random() * (hi - lo + 1)) + lo) + "** (inclusive, " + lo + "–" + hi + ")." };
    }

    /* aspect / file-size helpers */
    if ((m = l.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?).*?(?:width|wide)\s*(?:of|is|=)?\s*(\d+)/))) {
      var aw = +m[1], ah = +m[2], width = +m[3], height = Math.round(width * ah / aw);
      return { text: "At **" + width + " px** wide, a **" + aw + ":" + ah + "** frame is **" + height + " px** tall." };
    }
    if ((m = l.match(/(?:upload|download|transfer)\s*(?:of\s*)?([\d.]+)\s*(kb|mb|gb)\s*(?:at|on)\s*([\d.]+)\s*(kbps|mbps|gbps|mb\/s|kb\/s)/))) {
      var sizeMb = +m[1] * (m[2] === "gb" ? 1024 : m[2] === "kb" ? 1 / 1024 : 1);
      var rate = +m[3] * (m[4].indexOf("gb") === 0 ? 1024 : m[4].indexOf("kb") === 0 ? 1 / 1024 : 1);
      var secs = sizeMb * 8 / rate;
      return { text: "Transferring **" + m[1] + " " + m[2].toUpperCase() + "** at **" + m[3] + " " + m[4].toUpperCase() + "** takes about **" + (secs < 60 ? fmt(secs, 1) + " seconds" : secs < 3600 ? fmt(secs / 60, 1) + " minutes" : fmt(secs / 3600, 2) + " hours") + "** at ideal speed." };
    }

    /* preferences */
    if (/\b(dark mode|dark theme|switch to dark)\b/.test(l)) {
      try { MTH.theme.set("dark"); } catch (e) { document.documentElement.dataset.theme = "dark"; }
      memory.prefs.theme = "dark"; set(MKEY, memory);
      return { text: "Dark theme enabled. I will remember that this is your preference on this device." };
    }
    if (/\b(light mode|light theme|switch to light)\b/.test(l)) {
      try { MTH.theme.set("light"); } catch (e) { document.documentElement.dataset.theme = "light"; }
      memory.prefs.theme = "light"; set(MKEY, memory);
      return { text: "Light theme enabled. I will remember that this is your preference on this device." };
    }

    /* FAQ */
    var f = faq(raw);
    if (f) {
      var acts = [];
      if (f[1] && f[1].indexOf("Open") === 0) acts.push({ label: f[1], prompt: f[1] });
      return { text: f[1], actions: acts };
    }

    /* recommendations */
    ctx.lastTopic = raw;
    var ranked = rank(raw);
    if (ranked.length) {
      var rec = recommendation(ranked);
      var openNow = /^(open|launch|start|go)\b/.test(l);
      if (openNow && ranked[0]) { rememberTool(ranked[0].t); rec.go = TOOL_HREF(ranked[0].t); }
      return rec;
    }

    /* unknown */
    return {
      text: "I could not match that to a tool or a local command. Try describing the file and the result — for example “convert a PDF to Word” or “make a photo smaller than 500 KB”.\n\nI can also calculate (`18% of 840`), convert units (`5 mb to kb`), and manage memory (`my name is …`)." +
        (cfg.key && cfg.useModel ? "\n\nI will ask your connected model for a broader answer." : "\n\nAdd your own API key in Settings if you want open-ended model answers."),
      unresolved: true,
      actions: [{ label: "Show all tools", prompt: "list all tools" }, { label: "Open settings", prompt: "settings" }]
    };
  }

  /* --------------------------------------------------------------- LLM layer */
  function memoryForModel() {
    var lines = ["The user is using MULTI TOOL HUB v6, a local-first browser toolkit."];
    if (memory.name) lines.push("User name: " + memory.name + ".");
    lines.push("Preferred units: " + memory.prefs.units + ".");
    if (memory.favourites.length) lines.push("Favourite tools: " + memory.favourites.map(function (id) { var t = toolById(id); return t ? t.title : id; }).join(", ") + ".");
    if (memory.facts.length) lines.push("Remembered notes: " + memory.facts.slice(-10).map(function (f) { return f.text; }).join(" | ") + ".");
    if (memory.lastTool) { var lt = toolById(memory.lastTool); if (lt) lines.push("Recently used tool: " + lt.title + "."); }
    return lines.join(" ");
  }
  function modelMessages() {
    var sys = "You are the Hub Assistant inside MULTI TOOL HUB, a local-first browser toolkit. Be concise, practical and accurate. Recommend the most relevant tool by name when useful. Never claim to upload or inspect files — you cannot see them. Never invent tools. Tools: " +
      MTH.tools.map(function (t) { return t.title + " (" + t.href + ")"; }).join("; ") + ". Current page: " + location.pathname + ". " + memoryForModel();
    return [{ role: "system", content: sys }].concat(history.slice(-12).map(function (h) { return { role: h.role, content: h.content }; }));
  }
  async function streamModel(onToken) {
    if (!cfg.key) throw new Error("Add your own API key in Settings first.");
    var res = await fetch(cfg.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
      body: JSON.stringify({ model: cfg.model, stream: true, temperature: .4, messages: modelMessages() })
    });
    if (!res.ok) throw new Error("Provider returned HTTP " + res.status + ". Check the endpoint, model and key.");
    if (!res.body || !res.body.getReader) {
      var data = await res.json();
      var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!text) throw new Error("The provider returned no text.");
      onToken(text); return text;
    }
    var reader = res.body.getReader(), dec = new TextDecoder(), buf = "", out = "";
    for (;;) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += dec.decode(chunk.value, { stream: true });
      var lines = buf.split("\n");
      buf = lines.pop();
      lines.forEach(function (line) {
        line = line.trim();
        if (!line || line.indexOf("data:") !== 0) return;
        var payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          var delta = JSON.parse(payload).choices[0].delta || {};
          var piece = delta.content || "";
          if (piece) { out += piece; onToken(out); }
        } catch (e) {}
      });
    }
    return out;
  }

  /* --------------------------------------------------------------- markdown */
  function md(src) {
    var s = esc(src);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<i>$2</i>");
    s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    var blocks = s.split(/\n{2,}/);
    return blocks.map(function (block) {
      var lines = block.split("\n");
      if (lines.every(function (x) { return /^\s*[-•]\s+/.test(x); })) {
        return "<ul>" + lines.map(function (x) { return "<li>" + x.replace(/^\s*[-•]\s+/, "") + "</li>"; }).join("") + "</ul>";
      }
      return "<p>" + lines.join("<br>") + "</p>";
    }).join("");
  }

  /* -------------------------------------------------------------------- UI */
  function buildUI() {
    if (panel) return;
    panel = document.createElement("div");
    panel.id = "mthai";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Hub Assistant");
    panel.innerHTML =
      '<div class="ai-head">' +
        '<span class="ai-orb-sm" aria-hidden="true">MTH</span>' +
        '<div class="ai-title"><b>Hub Assistant</b><small data-ai-mode>Local intelligence · memory on</small></div>' +
        '<button type="button" data-ai-drawer="memory" aria-label="Memory" title="Memory">' + MTH.ui.icon("shield", "", 14) + '</button>' +
        '<button type="button" data-ai-drawer="settings" aria-label="Settings" title="Settings">' + MTH.ui.icon("settings", "", 14) + '</button>' +
        '<button type="button" data-ai-export aria-label="Export chat" title="Export chat">' + MTH.ui.icon("download", "", 14) + '</button>' +
        '<button type="button" data-ai-clear aria-label="Clear chat" title="Clear chat">' + MTH.ui.icon("trash", "", 14) + '</button>' +
        '<button type="button" data-ai-close aria-label="Close assistant" title="Close">' + MTH.ui.icon("close", "", 14) + '</button>' +
      '</div>' +
      '<div class="ai-subbar">' +
        '<button type="button" data-ai-prompt="what can you do">Capabilities</button>' +
        '<button type="button" data-ai-prompt="what do you remember">Memory</button>' +
        '<span class="ai-status" data-ai-status>Ready</span>' +
      '</div>' +
      '<div class="log" aria-live="polite" role="log"></div>' +
      '<div class="ai-chips" data-ai-chips></div>' +
      '<div class="ai-drawer" data-ai-drawer-panel></div>' +
      '<form data-ai-form><textarea data-ai-input rows="1" placeholder="Ask anything or describe a file task…" aria-label="Message the assistant"></textarea><button type="submit" data-ai-send aria-label="Send message">' + MTH.ui.icon("arrow-right", "", 16) + '</button></form>';

    var btn = document.createElement("button");
    btn.id = "mthai-b";
    btn.type = "button";
    btn.setAttribute("aria-label", "Open Hub Assistant");
    btn.innerHTML = '<span>AI</span>';

    document.body.appendChild(panel);
    document.body.appendChild(btn);
    logEl = panel.querySelector(".log");
    inputEl = panel.querySelector("[data-ai-input]");
    sendBtn = panel.querySelector("[data-ai-send]");

    btn.addEventListener("click", function () { toggle(); });
    panel.querySelector("[data-ai-close]").addEventListener("click", function () { toggle(false); });
    panel.querySelector("[data-ai-clear]").addEventListener("click", clearChat);
    panel.querySelector("[data-ai-export]").addEventListener("click", exportChat);
    panel.querySelectorAll("[data-ai-drawer]").forEach(function (b) {
      b.addEventListener("click", function () { openDrawer(b.dataset.aiDrawer); });
    });
    panel.addEventListener("click", function (e) {
      var prompt = e.target.closest("[data-ai-prompt]");
      if (prompt) { e.preventDefault(); ask(prompt.dataset.aiPrompt); return; }
      var copy = e.target.closest("[data-ai-copy]");
      if (copy) { MTH.copy(copy.dataset.aiCopy, "Copied"); return; }
      var act = e.target.closest("[data-ai-act]");
      if (act) {
        var p = act.dataset.aiAct;
        if (p === "__memory__") openDrawer("memory");
        else if (p === "__settings__") openDrawer("settings");
        else if (p === "__home__") location.href = MTH.sitePath("index.html#tools");
        else if (act.dataset.aiGo) location.href = act.dataset.aiGo;
        else ask(p);
      }
    });
    panel.querySelector("[data-ai-form]").addEventListener("submit", function (e) {
      e.preventDefault();
      var q = inputEl.value.trim();
      if (!q || busy) return;
      inputEl.value = ""; autoGrow();
      ask(q);
    });
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); panel.querySelector("[data-ai-form]").dispatchEvent(new Event("submit", { cancelable: true })); }
    });
    inputEl.addEventListener("input", autoGrow);
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") { e.preventDefault(); toggle(); }
      if (e.key === "Escape" && panel.classList.contains("on")) toggle(false);
    });
    window.addEventListener("mth:ai-open", function (e) {
      open((e.detail && e.detail.seed) || "");
    });
    window.MTHAssistant = { open: open, close: function () { toggle(false); }, toggle: toggle, ask: ask, memory: function () { return JSON.parse(JSON.stringify(memory)); } };
    MTH.assistant = window.MTHAssistant;

    renderChips();
    restoreHistory();
    updateMode();
  }

  function autoGrow() {
    if (!inputEl) return;
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(110, Math.max(40, inputEl.scrollHeight)) + "px";
  }

  function renderChips() {
    var host = panel.querySelector("[data-ai-chips]");
    if (!host) return;
    var chips = memory.name
      ? ["What can you do?", "Merge two PDFs", "Compress a photo to 200 KB", "Open Ambient Studio", "What do you remember?"]
      : ["What can you do?", "Merge two PDFs", "18% tip on 84", "Compress an image", "Open After Hours"];
    host.innerHTML = chips.map(function (c) { return '<button type="button" data-ai-prompt="' + esc(c) + '">' + esc(c) + "</button>"; }).join("");
  }

  function updateMode() {
    var mode = panel.querySelector("[data-ai-mode]");
    var status = panel.querySelector("[data-ai-status]");
    if (mode) mode.textContent = cfg.key ? "Local + your model · memory on" : "Local intelligence · memory on";
    if (status) status.textContent = cfg.key ? "Model ready" : "Ready";
  }

  function greetingText() {
    if (!history.length) {
      var g = timeGreeting() + (memory.name ? ", " + memory.name : "") + ".";
      var lead = memory.lastTool && toolById(memory.lastTool)
        ? " Welcome back. Last time we looked at **" + toolById(memory.lastTool).title + "**."
        : "";
      return g + lead + "\n\nI am your Hub Assistant. I know every tool in this build, I can calculate and convert, and I keep useful context in this browser. What are you working on?";
    }
    return "Welcome back" + (memory.name ? ", " + memory.name : "") + ". Your conversation and memory are still here. Pick up where you left off, or ask for something new.";
  }

  function restoreHistory() {
    logEl.innerHTML = "";
    if (!history.length) {
      addMessage("assistant", greetingText());
      return;
    }
    history.slice(-40).forEach(function (h) {
      addMessage(h.role === "user" ? "user" : "assistant", h.content, h.tools || null, null, true);
    });
    var last = history[history.length - 1];
    if (last && last.role === "user") addMessage("assistant", "I am ready. Continue whenever you like.");
  }

  function addMessage(role, text, tools, actions, quiet) {
    var wrap = document.createElement("div");
    wrap.className = "m " + (role === "user" ? "u" : "a");
    if (role === "user") {
      wrap.textContent = text;
    } else {
      var body = document.createElement("div");
      body.className = "m-body";
      body.innerHTML = md(text || "");
      wrap.appendChild(body);
      if (tools && tools.length) {
        var tc = document.createElement("div");
        tc.className = "m-tools";
        tc.innerHTML = tools.map(function (t) { return linkTool(t); }).join("");
        wrap.appendChild(tc);
      }
      if (actions && actions.length) {
        var ac = document.createElement("div");
        ac.className = "m-actions";
        ac.innerHTML = actions.map(function (a) {
          if (a.copy) return '<button type="button" class="m-act" data-ai-copy="' + esc(a.copy) + '">' + esc(a.label) + "</button>";
          return '<button type="button" class="m-act" data-ai-act="' + esc(a.prompt || a.label) + '">' + esc(a.label) + "</button>";
        }).join("");
        wrap.appendChild(ac);
      }
      var speak = document.createElement("button");
      speak.type = "button";
      speak.className = "m-speak";
      speak.setAttribute("aria-label", "Read aloud");
      speak.title = "Read aloud";
      speak.innerHTML = MTH.ui.icon("volume", "", 12) || "🔊";
      speak.addEventListener("click", function () { speakText(text); });
      wrap.appendChild(speak);
    }
    logEl.appendChild(wrap);
    if (!quiet) logEl.scrollTop = logEl.scrollHeight;
    return wrap;
  }

  function speakText(text) {
    if (!("speechSynthesis" in window)) { MTH.toast("Speech is not available in this browser.", "warn"); return; }
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text).replace(/[*`#]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1"));
      u.rate = 1.02; u.pitch = 1;
      speechSynthesis.speak(u);
    } catch (e) {}
  }

  function setStatus(text) {
    var el = panel && panel.querySelector("[data-ai-status]");
    if (el) el.textContent = text;
  }

  async function ask(q) {
    if (!panel) buildUI();
    if (busy) return;
    q = String(q || "").trim();
    if (!q) return;
    toggle(true);
    extractMemory(q);
    addMessage("user", q);
    history.push({ role: "user", content: q, at: now() });
    persistHistory();
    memory.interactions = (memory.interactions || 0) + 1;
    set(MKEY, memory);
    busy = true;
    sendBtn.disabled = true;
    setStatus("Thinking");
    var typing = addMessage("assistant", "");
    typing.querySelector(".m-body").innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    var reply;
    try { reply = await Promise.resolve(localReply(q)); }
    catch (e) { reply = { text: "Something went wrong while handling that: " + e.message }; }
    if (!reply) reply = { text: "I could not parse that request." };

    if (reply.go) {
      // Give the user a beat to read before navigating.
      setTimeout(function () { location.href = reply.go; }, 520);
    }
    if (reply.ui === "memory") setTimeout(function () { openDrawer("memory"); }, 120);
    if (reply.ui === "settings") setTimeout(function () { openDrawer("settings"); }, 120);

    if (reply.unresolved && cfg.key && cfg.useModel) {
      setStatus("Asking model");
      typing.querySelector(".m-body").innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
      try {
        var streamed = await streamModel(function (partial) {
          typing.querySelector(".m-body").innerHTML = md(partial);
          logEl.scrollTop = logEl.scrollHeight;
        });
        if (streamed) {
          typing.querySelector(".m-body").innerHTML = md(streamed);
          history.push({ role: "assistant", content: streamed, at: now() });
          persistHistory();
          busy = false; sendBtn.disabled = false; setStatus("Ready");
          return;
        }
      } catch (err) {
        typing.querySelector(".m-body").innerHTML = md("I could not reach your model: " + err.message + "\n\n" + reply.text);
        busy = false; sendBtn.disabled = false; setStatus("Model error");
        return;
      }
    }

    typing.querySelector(".m-body").innerHTML = md(reply.text || "");
    if (reply.tools && reply.tools.length) {
      var tc = document.createElement("div");
      tc.className = "m-tools";
      tc.innerHTML = reply.tools.map(function (t) { return linkTool(t); }).join("");
      typing.appendChild(tc);
    }
    if (reply.actions && reply.actions.length) {
      var ac = document.createElement("div");
      ac.className = "m-actions";
      ac.innerHTML = reply.actions.map(function (a) {
        if (a.copy) return '<button type="button" class="m-act" data-ai-copy="' + esc(a.copy) + '">' + esc(a.label) + "</button>";
        return '<button type="button" class="m-act" data-ai-act="' + esc(a.prompt || a.label) + '">' + esc(a.label) + "</button>";
      }).join("");
      typing.appendChild(ac);
    }
    history.push({ role: "assistant", content: reply.text || "", tools: (reply.tools || []).map(function (t) { return t.id; }), at: now() });
    persistHistory();
    logEl.scrollTop = logEl.scrollHeight;
    busy = false;
    sendBtn.disabled = false;
    setStatus(cfg.key ? "Model ready" : "Ready");
    if (memory.name) renderChips();
    if (reply.go) setTimeout(function () { location.href = reply.go; }, 650);
  }

  function persistHistory() {
    if (history.length > 80) history = history.slice(-80);
    set(HKEY, history);
  }

  function clearChat() {
    history = [];
    set(HKEY, history);
    logEl.innerHTML = "";
    addMessage("assistant", greetingText());
    MTH.toast("Conversation cleared. Memory is unchanged.", "ok");
  }

  function exportChat() {
    if (!history.length) { MTH.toast("There is no conversation to export yet.", "info"); return; }
    var out = "MULTI TOOL HUB — Hub Assistant transcript\n" + new Date().toLocaleString() + "\n\n" +
      history.map(function (h) { return (h.role === "user" ? "You: " : "Assistant: ") + h.content; }).join("\n\n") +
      "\n\n" + MTH.credit;
    MTH.download(out, "mth-assistant-transcript.txt", "text/plain");
  }

  function toggle(force) {
    if (!panel) buildUI();
    var on = typeof force === "boolean" ? force : !panel.classList.contains("on");
    panel.classList.toggle("on", on);
    if (on) {
      setTimeout(function () { inputEl.focus(); }, 60);
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  function open(seed) {
    if (!panel) buildUI();
    toggle(true);
    if (seed) {
      if (seed === "__memory__") { openDrawer("memory"); return; }
      if (seed === "__settings__") { openDrawer("settings"); return; }
      inputEl.value = seed;
      autoGrow();
      inputEl.focus();
      if (seed.indexOf("explain") === 0 || seed.indexOf("open ") === 0) {
        // let the visual settle before sending a prefilled command
        setTimeout(function () { var v = inputEl.value; inputEl.value = ""; autoGrow(); ask(v); }, 90);
      }
    }
  }

  /* -------------------------------------------------------------- drawers */
  function openDrawer(kind) {
    var d = panel.querySelector("[data-ai-drawer-panel]");
    if (!d) return;
    var isOpen = d.classList.contains("on") && d.dataset.kind === kind;
    if (isOpen) { d.classList.remove("on"); d.dataset.kind = ""; return; }
    d.dataset.kind = kind;
    d.classList.add("on");
    if (kind === "settings") {
      d.innerHTML =
        "<h4>Optional model connection</h4>" +
        '<div class="hint">Local mode works with no key. If you add a key, each message goes straight from this tab to your provider — never to a hub server. The key stays in this browser.</div>' +
        '<label>Endpoint<input data-cfg-url value="' + esc(cfg.url) + '" spellcheck="false"></label>' +
        '<label>Model<input data-cfg-model value="' + esc(cfg.model) + '" spellcheck="false"></label>' +
        '<label>API key<input data-cfg-key type="password" value="' + esc(cfg.key) + '" placeholder="Optional — stored locally" autocomplete="off"></label>' +
        '<label class="check-line" style="display:flex;flex-direction:row;align-items:center;gap:7px;font-weight:600"><input type="checkbox" data-cfg-use ' + (cfg.useModel ? "checked" : "") + '> Use the model when local intent cannot answer</label>' +
        '<div class="drawer-actions"><button type="button" class="btn btn--sm" data-cfg-save>Save</button><button type="button" class="btn btn--sm btn--ghost" data-cfg-close>Close</button><button type="button" class="btn btn--sm btn--danger" data-cfg-wipe>Remove key</button></div>';
      d.querySelector("[data-cfg-save]").onclick = function () {
        cfg.url = d.querySelector("[data-cfg-url]").value.trim() || cfg.url;
        cfg.model = d.querySelector("[data-cfg-model]").value.trim() || cfg.model;
        cfg.key = d.querySelector("[data-cfg-key]").value.trim();
        cfg.useModel = d.querySelector("[data-cfg-use]").checked;
        set(CKEY, cfg);
        updateMode();
        MTH.toast(cfg.key ? "Model settings saved locally." : "Saved. Local-only mode is active.", "ok");
      };
      d.querySelector("[data-cfg-wipe]").onclick = function () {
        cfg.key = ""; set(CKEY, cfg); updateMode();
        d.querySelector("[data-cfg-key]").value = "";
        MTH.toast("API key removed from this browser.", "ok");
      };
      d.querySelector("[data-cfg-close]").onclick = function () { d.classList.remove("on"); d.dataset.kind = ""; };
    } else if (kind === "memory") {
      d.innerHTML =
        "<h4>Memory on this device</h4>" +
        '<div class="hint">' + (memory.name ? "Name: **" + esc(memory.name) + "**" : "No name stored yet.") + " · " + memory.facts.length + " remembered note" + (memory.facts.length === 1 ? "" : "s") + " · " + memory.visits + " visit" + (memory.visits === 1 ? "" : "s") + ".</div>" +
        '<div class="row2"><label>Your name<input data-mem-name value="' + esc(memory.name) + '" placeholder="Optional"></label><label>Units<select data-mem-units><option value="metric"' + (memory.prefs.units === "metric" ? " selected" : "") + '>Metric</option><option value="imperial"' + (memory.prefs.units === "imperial" ? " selected" : "") + '>Imperial</option></select></label></div>' +
        '<div class="mem-list">' + (memory.facts.length ? memory.facts.slice().reverse().map(function (f) {
          return '<div class="mem-item"><span>' + esc(f.text) + '</span><button type="button" data-mem-del="' + esc(f.id) + '" aria-label="Forget">×</button></div>';
        }).join("") : '<div class="hint">Ask me to remember something, for example “remember that I export invoices on Fridays”.</div>') + "</div>" +
        '<div class="drawer-actions"><button type="button" class="btn btn--sm" data-mem-save>Save preferences</button><button type="button" class="btn btn--sm btn--ghost" data-mem-close>Close</button><button type="button" class="btn btn--sm btn--danger" data-mem-clear>Forget everything</button></div>';
      d.querySelector("[data-mem-save]").onclick = function () {
        memory.name = d.querySelector("[data-mem-name]").value.trim();
        memory.prefs.units = d.querySelector("[data-mem-units]").value;
        set(MKEY, memory); renderChips();
        MTH.toast("Memory preferences saved.", "ok");
      };
      d.querySelector("[data-mem-close]").onclick = function () { d.classList.remove("on"); d.dataset.kind = ""; };
      d.querySelector("[data-mem-clear]").onclick = function () {
        memory.name = ""; memory.facts = []; memory.favourites = []; memory.dislikes = []; memory.prefs = { units: "metric", tone: "professional", density: "comfortable" }; memory.lastTool = ""; memory.lastResults = [];
        set(MKEY, memory);
        d.innerHTML = '<h4>Memory cleared</h4><div class="hint">Nothing personal is stored in this browser now. The tool catalogue and conversation are unaffected.</div><div class="drawer-actions"><button type="button" class="btn btn--sm" data-mem-close>Done</button></div>';
        d.querySelector("[data-mem-close]").onclick = function () { d.classList.remove("on"); d.dataset.kind = ""; };
        renderChips();
      };
      d.querySelectorAll("[data-mem-del]").forEach(function (b) {
        b.onclick = function () {
          memory.facts = memory.facts.filter(function (f) { return f.id !== b.dataset.memDel; });
          set(MKEY, memory); openDrawer("memory"); openDrawer("memory");
        };
      });
    }
  }

  /* ---------------------------------------------------------------- boot */
  function boot() {
    buildUI();
    window.dispatchEvent(new CustomEvent("mth:ai-ready"));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
