#!/usr/bin/env node
/**
 * MULTI TOOL HUB - assistant proxy (Groq)
 * Developed by chank!nd3 p4d4y41! l FAYAS MONU
 *
 * Runs two jobs with nothing but Node's standard library:
 *   1. Serves the static site (so the app and API share an origin).
 *   2. Proxies chat text to Groq with the API key kept on the server.
 *
 * The browser never sees GROQ_API_KEY. Uploaded files never reach this
 * server: only the chat text the visitor explicitly sends is forwarded.
 * Supports both a single-response reply and a streamed SSE passthrough
 * (POST body {stream:true}) for the floating Hub Assistant widget.
 *
 * Requires Node.js 18 or newer (built-in fetch).
 */
"use strict";

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");

/* Load server/.env without adding a dependency. Existing env vars win. */
(function loadEnv() {
  try {
    const file = path.join(__dirname, ".env");
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || m[1] in process.env) continue;
      let value = m[2];
      if (/^["'].*["']$/.test(value)) value = value.slice(1, -1);
      process.env[m[1]] = value;
    }
  } catch {
    /* .env is optional */
  }
})();

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */
const PORT = toInt(process.env.PORT, 8787);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = path.resolve(__dirname, "..");
const API_KEY = (process.env.GROQ_API_KEY || "").trim();
const MODEL = (process.env.GROQ_MODEL || "llama-3.3-70b-versatile").trim();
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const CLIENT_TOKEN = (process.env.CLIENT_TOKEN || "").trim();
const RATE_LIMIT = Math.max(1, toInt(process.env.RATE_LIMIT, 20));
const RATE_WINDOW_MS = Math.max(1000, toInt(process.env.RATE_WINDOW_SECONDS, 60) * 1000);
const BODY_LIMIT = 64 * 1024;
const MAX_MESSAGES = 16;
const MAX_CHARS = 4000;
const UPSTREAM_TIMEOUT = 28000;
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SYSTEM_PROMPT = [
  "You are the MULTI TOOL HUB assistant: a calm, practical guide to a private, browser-based file toolkit.",
  "The hub has 18 tools: Merge PDF, Split PDF, Compress PDF, PDF Editor, Crop PDF, Rotate PDF, Organize Pages,",
  "Page Numbers, Watermark PDF, JPG to PDF, PDF to JPG, PDF to Word, PDF to Text, PDF Password Unlocker,",
  "Image Compressor, Video to MP3, YouTube Downloader and Instagram Downloader.",
  "Most PDF and image tools run entirely on the visitor's device; files are not uploaded. The two link downloaders",
  "send only the pasted public URL to Loader.to. The PDF Password Unlocker only removes protection when the",
  "visitor supplies the correct password themselves — never suggest or imply a way to bypass or crack a password",
  "you don't know. Every chat sent here goes only to Groq as text; never claim to have opened, read, stored or",
  "seen a file.",
  "Answer in short, clear paragraphs. Use plain language. Give numbered steps for procedures. If a question is",
  "outside file tools, say briefly that you focus on MULTI TOOL HUB and offer the closest relevant tool.",
  "Never invent a feature that does not exist. Do not ask for passwords, payment details or personal data.",
].join(" ");

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function toInt(v, fallback) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}
function sendJson(res, status, payload, origin) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...corsHeaders(origin),
  });
  res.end(body);
}
function corsHeaders(origin) {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return null; // same-origin navigations and curl
  if (ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) return origin;
  // Same-origin browser requests still send Origin for POST.
  const host = req.headers.host || "";
  try {
    if (new URL(origin).host === host) return origin;
  } catch {
    /* ignore */
  }
  return false;
}
function clientIp(req) {
  if (TRUST_PROXY) {
    const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (fwd) return fwd;
  }
  return req.socket.remoteAddress || "unknown";
}
function tokenMatches(given) {
  if (!CLIENT_TOKEN) return true;
  const a = Buffer.from(String(given || ""));
  const b = Buffer.from(CLIENT_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* Simple in-memory sliding window. Enough for a single-instance proxy. */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (!times.length || now - times[times.length - 1] > RATE_WINDOW_MS) hits.delete(key);
    }
  }
  return false;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function cleanMessages(input) {
  if (!Array.isArray(input)) throw Object.assign(new Error("Send a messages array."), { status: 400 });
  const out = [];
  for (const item of input.slice(-MAX_MESSAGES)) {
    if (!item || typeof item !== "object") continue;
    const role = item.role === "assistant" || item.role === "model" ? "model" : "user";
    const text = String(item.content == null ? "" : item.content).replace(/\u0000/g, "").trim();
    if (!text) continue;
    out.push({ role, text: text.slice(0, MAX_CHARS) });
  }
  while (out.length && out[0].role === "model") out.shift();
  if (!out.length) throw Object.assign(new Error("There is no message to send."), { status: 400 });
  const total = out.reduce((n, m) => n + m.text.length, 0);
  if (total > MAX_CHARS * 4) throw Object.assign(new Error("That conversation is too long. Start a new chat."), { status: 413 });
  return out;
}

/* ------------------------------------------------------------------ */
/* Groq request                                                        */
/* ------------------------------------------------------------------ */
function groqPayload(messages, stream) {
  return JSON.stringify({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role === "model" ? "assistant" : "user", content: m.text })),
    ],
    temperature: 0.55,
    max_tokens: 1200,
    stream: !!stream,
  });
}

function friendlyGroqError(status) {
  if (status === 429) return "Groq is receiving too many requests. Please wait a moment and try again.";
  if (status === 400 || status === 401 || status === 403) return "Groq rejected the request. Check the server's API key and model name.";
  return "Groq could not answer right now. Please try again.";
}

function askGroq(messages) {
  return new Promise((resolve, reject) => {
    const url = new URL(GROQ_URL);
    const payload = groqPayload(messages, false);
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: UPSTREAM_TIMEOUT,
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (d) => { if (raw.length < 512 * 1024) raw += d; });
        res.on("end", () => {
          let data = {};
          try { data = JSON.parse(raw || "{}"); } catch { /* handled below */ }
          if (res.statusCode !== 200) {
            reject(Object.assign(new Error(friendlyGroqError(res.statusCode)), { status: res.statusCode === 429 ? 429 : 502 }));
            return;
          }
          const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          if (!text) {
            reject(Object.assign(new Error("Groq sent an empty reply."), { status: 502 }));
            return;
          }
          resolve({ text: String(text).trim(), model: MODEL });
        });
      }
    );
    req.on("timeout", () => req.destroy(Object.assign(new Error("Groq took too long to answer."), { status: 504 })));
    req.on("error", (err) => {
      if (err.status) reject(err);
      else reject(Object.assign(new Error("Could not reach Groq from the server."), { status: 502 }));
    });
    req.end(payload);
  });
}

/* Streams Groq's raw SSE chunks straight through to the client response,
   which chat.js parses incrementally to render markdown as it arrives. */
function streamGroq(messages, res, corsHdrs) {
  const url = new URL(GROQ_URL);
  const payload = groqPayload(messages, true);
  const upstream = https.request(
    {
      method: "POST",
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: UPSTREAM_TIMEOUT,
    },
    (upRes) => {
      if (upRes.statusCode !== 200) {
        let raw = "";
        upRes.on("data", (d) => (raw += d));
        upRes.on("end", () => {
          sendJson(res, 502, { ok: false, error: friendlyGroqError(upRes.statusCode) });
        });
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...corsHdrs,
      });
      upRes.pipe(res);
    }
  );
  upstream.on("timeout", () => upstream.destroy());
  upstream.on("error", () => {
    if (!res.headersSent) sendJson(res, 502, { ok: false, error: "Could not reach Groq from the server." });
    else res.end();
  });
  upstream.end(payload);
}

/* ------------------------------------------------------------------ */
/* Static files                                                        */
/* ------------------------------------------------------------------ */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
};

async function serveStatic(req, res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return sendJson(res, 400, { ok: false, error: "Bad path." });
  }
  if (rel.endsWith("/")) rel += "index.html";
  if (rel === "/") rel = "/index.html";
  if (rel.includes("\0")) return sendJson(res, 400, { ok: false, error: "Bad path." });

  const file = path.resolve(ROOT, "." + rel);
  const inside = file === ROOT || file.startsWith(ROOT + path.sep);
  const first = path.relative(ROOT, file).split(path.sep)[0];
  if (!inside || first === "server" || path.basename(file).startsWith(".")) {
    return sendJson(res, 404, { ok: false, error: "Not found." });
  }

  let stat;
  try {
    stat = await fsp.stat(file);
  } catch {
    return sendJson(res, 404, { ok: false, error: "Not found." });
  }
  if (!stat.isFile()) return sendJson(res, 404, { ok: false, error: "Not found." });

  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, { ETag: etag, "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=300" });
    return res.end();
  }
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": stat.size,
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=300",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */
const server = http.createServer(async (req, res) => {
  const origin = originAllowed(req);
  if (origin === false) {
    return sendJson(res, 403, { ok: false, error: "This origin is not allowed to use the assistant." });
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(origin || "*"));
    return res.end();
  }

  let pathname = "/";
  try {
    pathname = new URL(req.url, "http://localhost").pathname;
  } catch {
    return sendJson(res, 400, { ok: false, error: "Bad request." }, origin);
  }

  /* Health / connection probe used by the Hub Assistant widget. */
  if (pathname === "/api/assistant" && req.method === "GET") {
    if (!tokenMatches((req.headers.authorization || "").replace(/^Bearer\s+/i, ""))) {
      return sendJson(res, 401, { ok: false, error: "The access token is missing or incorrect." }, origin);
    }
    if (!API_KEY) {
      return sendJson(
        res,
        503,
        { ok: false, error: "The server is running but GROQ_API_KEY is not set." },
        origin
      );
    }
    return sendJson(res, 200, { ok: true, service: "MULTI TOOL HUB assistant", model: MODEL }, origin);
  }

  /* Chat completion — buffered reply, or a streamed SSE passthrough when
     the client sends {stream:true}. */
  if (pathname === "/api/assistant" && req.method === "POST") {
    if (!tokenMatches((req.headers.authorization || "").replace(/^Bearer\s+/i, ""))) {
      return sendJson(res, 401, { ok: false, error: "The access token is missing or incorrect." }, origin);
    }
    if (!API_KEY) {
      return sendJson(
        res,
        503,
        { ok: false, error: "The server is running but GROQ_API_KEY is not set." },
        origin
      );
    }
    const ip = clientIp(req);
    if (rateLimited(ip)) {
      return sendJson(res, 429, { ok: false, error: "Too many messages. Please wait a minute and try again." }, origin);
    }
    if (!/^application\/json\b/i.test(req.headers["content-type"] || "")) {
      return sendJson(res, 415, { ok: false, error: "Send JSON with a Content-Type of application/json." }, origin);
    }
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch (err) {
      return sendJson(res, err.status || 400, { ok: false, error: err.message || "Invalid JSON." }, origin);
    }
    let messages;
    try {
      messages = cleanMessages(payload && payload.messages);
    } catch (err) {
      return sendJson(res, err.status || 400, { ok: false, error: err.message }, origin);
    }
    if (payload && payload.stream) {
      return streamGroq(messages, res, corsHeaders(origin));
    }
    try {
      const answer = await askGroq(messages);
      return sendJson(res, 200, { ok: true, reply: answer.text, text: answer.text, model: answer.model }, origin);
    } catch (err) {
      return sendJson(res, err.status || 502, { ok: false, error: err.message || "The assistant is unavailable." }, origin);
    }
  }

  if (pathname.startsWith("/api/")) {
    return sendJson(res, 404, { ok: false, error: "Unknown API endpoint." }, origin);
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed." }, origin);
  }
  return serveStatic(req, res, pathname);
});

server.requestTimeout = 35000;
server.headersTimeout = 12000;
server.on("clientError", (err, socket) => {
  if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
});

server.listen(PORT, HOST, () => {
  console.log(`MULTI TOOL HUB server: http://${HOST}:${PORT}`);
  console.log(`Static root: ${ROOT}`);
  if (!API_KEY) console.log("Assistant: disabled (set GROQ_API_KEY in server/.env to enable the Hub Assistant)");
  else console.log(`Assistant: enabled · model ${MODEL}`);
  console.log(`Access token: ${CLIENT_TOKEN ? "required" : "not set (only do this on a trusted network)"}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(", ") : "same origin only"}`);
});
