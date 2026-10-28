/* MULTI TOOL HUB - Gemini proxy for Cloudflare Workers. Credit: chank!nd3 p4d4y41!
   Keeps the Gemini key private. Deploy:
     1. wrangler init / paste this file into a new Worker
     2. wrangler secret put GEMINI_API_KEY
     3. (optional) set var ALLOWED_ORIGIN = https://YOUR-NAME.github.io
     4. put the Worker URL in assets/config.js -> gemini.proxy
   Contract matches assets/chat.js: GET = health check, POST {messages:[{role,content}]} -> {ok,reply}. */
const MODEL = "gemini-2.5-flash";
const SYSTEM = "You are the Hub Assistant for MULTI TOOL HUB, a browser-based PDF, image and audio toolkit. " +
  "Be brief and practical. Point people to the right tool (Merge, Split, Compress, Crop, Rotate, Watermark, Page Numbers, PDF Editor, PDF to Word/Text/JPG, JPG to PDF, Image Compressor, Video to MP3). " +
  "Never ask for passwords, payment details or API keys, and never claim to have seen a user's file.";

function cors(env, req) {
  const o = req.headers.get("Origin") || "";
  const allow = env.ALLOWED_ORIGIN ? (o === env.ALLOWED_ORIGIN ? o : "") : "*";
  return {
    "Access-Control-Allow-Origin": allow || "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin"
  };
}
const json = (obj, status, h) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...h } });

export default {
  async fetch(req, env) {
    const h = cors(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (req.method === "GET") return json({ ok: true, model: MODEL }, 200, h);
    if (req.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405, h);
    if (env.ALLOWED_ORIGIN && h["Access-Control-Allow-Origin"] === "null") return json({ ok: false, error: "Origin not allowed." }, 403, h);
    if (!env.GEMINI_API_KEY) return json({ ok: false, error: "Server key is not configured." }, 500, h);
    let body; try { body = await req.json(); } catch (e) { return json({ ok: false, error: "Send JSON." }, 400, h); }
    const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-16).map(m => ({
      role: m.role === "assistant" || m.role === "model" ? "model" : "user",
      parts: [{ text: String(m.content || m.text || "").slice(0, 4000) }]
    })).filter(m => m.parts[0].text);
    if (!msgs.length) return json({ ok: false, error: "Send a messages array." }, 400, h);
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: msgs,
        generationConfig: { temperature: 0.6, maxOutputTokens: 1000 } })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return json({ ok: false, error: (d.error && d.error.message) || ("Gemini HTTP " + r.status) }, 502, h);
    const parts = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
    const text = Array.isArray(parts) ? parts.map(p => p.text || "").join("").trim() : "";
    return text ? json({ ok: true, reply: text, model: MODEL }, 200, h) : json({ ok: false, error: "Gemini sent an empty reply." }, 502, h);
  }
};
