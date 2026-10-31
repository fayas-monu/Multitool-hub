/* MULTI TOOL HUB - Groq proxy for Cloudflare Workers.
   Developed by chank!nd3 p4d4y41! l FAYAS MONU

   Keeps the Groq API key private — it lives only in this Worker's secret
   store and is never sent to, or readable from, the browser.

   Deploy:
     1. wrangler init / paste this file into a new Worker
     2. wrangler secret put GROQ_API_KEY
     3. (optional) set var ALLOWED_ORIGIN = https://YOUR-NAME.github.io
     4. put the Worker URL in assets/config.js -> groq.proxy

   Contract matches assets/chat.js:
     GET                       -> health check
     POST {messages:[...]}     -> {ok:true, reply:"..."} (non-streaming)
     POST {messages:[...], stream:true}
                                -> text/event-stream of raw Groq SSE chunks,
                                   forwarded through untouched so the client
                                   can render markdown as it streams in. */

const MODEL = "llama-3.3-70b-versatile";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const SYSTEM =
  "You are the Hub Assistant for MULTI TOOL HUB, a browser-based PDF, image and audio toolkit. " +
  "Be brief and practical. Point people to the right tool (Merge, Split, Compress, Crop, Rotate, Watermark, " +
  "Page Numbers, PDF Editor, PDF to Word/Text/JPG, JPG to PDF, PDF Password Unlocker, Image Compressor, Video to MP3). " +
  "Never ask for passwords, payment details or API keys, and never claim to have seen a user's file.";

function cors(env, req) {
  const o = req.headers.get("Origin") || "";
  const allow = env.ALLOWED_ORIGIN ? (o === env.ALLOWED_ORIGIN ? o : "") : "*";
  return {
    "Access-Control-Allow-Origin": allow || "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin"
  };
}
const json = (obj, status, h) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...h } });

export default {
  async fetch(req, env) {
    const h = cors(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (req.method === "GET") return json({ ok: true, model: MODEL }, 200, h);
    if (req.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405, h);
    if (env.ALLOWED_ORIGIN && h["Access-Control-Allow-Origin"] === "null")
      return json({ ok: false, error: "Origin not allowed." }, 403, h);
    if (env.CLIENT_TOKEN) {
      const auth = req.headers.get("Authorization") || "";
      if (auth !== `Bearer ${env.CLIENT_TOKEN}`) return json({ ok: false, error: "Unauthorized." }, 401, h);
    }
    if (!env.GROQ_API_KEY) return json({ ok: false, error: "Server key is not configured." }, 500, h);

    let body;
    try { body = await req.json(); } catch { return json({ ok: false, error: "Send JSON." }, 400, h); }

    const msgs = (Array.isArray(body.messages) ? body.messages : [])
      .slice(-16)
      .map((m) => ({
        role: m.role === "assistant" || m.role === "model" ? "assistant" : "user",
        content: String(m.content || m.text || "").slice(0, 4000)
      }))
      .filter((m) => m.content);
    if (!msgs.length) return json({ ok: false, error: "Send a messages array." }, 400, h);

    const wantsStream = !!body.stream;
    const payload = {
      model: MODEL,
      messages: [{ role: "system", content: SYSTEM }, ...msgs],
      temperature: 0.6,
      max_tokens: 1000,
      stream: wantsStream
    };

    const upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify(payload)
    });

    if (wantsStream) {
      if (!upstream.ok || !upstream.body) {
        const d = await upstream.json().catch(() => ({}));
        return json({ ok: false, error: (d.error && d.error.message) || `Groq HTTP ${upstream.status}` }, 502, h);
      }
      // Forward the SSE stream through untouched; chat.js parses Groq's
      // OpenAI-style delta chunks and renders markdown as text arrives.
      return new Response(upstream.body, {
        status: 200,
        headers: { ...h, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
      });
    }

    const d = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return json({ ok: false, error: (d.error && d.error.message) || `Groq HTTP ${upstream.status}` }, 502, h);
    const text = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    return text
      ? json({ ok: true, reply: String(text).trim(), model: MODEL }, 200, h)
      : json({ ok: false, error: "Groq sent an empty reply." }, 502, h);
  }
};
