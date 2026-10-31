/* MULTI TOOL HUB — runtime configuration. Credit: chank!nd3 p4d4y41! l FAYAS MONU
   Groq assistant settings, loaded before assets/chat.js.

   The Groq API key NEVER goes here and never ships to the browser. Deploy
   one of the two proxies in /server and put its URL below:

     - server/cloudflare-worker.js  (recommended — wrangler secret put GROQ_API_KEY)
     - server/server.js             (Node — copy server/.env.example to server/.env)

   Both `groq.proxy` and the legacy `groqProxyUrl` alias are accepted. When
   neither is set, the assistant talks to the same-origin `/api/assistant`
   endpoint served by the bundled Node server. */
window.MTH_CONFIG = {
  groq: {
    // e.g. "https://mth-assistant.YOUR-SUBDOMAIN.workers.dev"
    // or "/api/assistant" for the bundled Node proxy (default).
    proxy: "/api/assistant",
    // Optional: only needed if your proxy sets CLIENT_TOKEN.
    token: "",
    modelLabel: "Groq · Llama 3.3 70B"
  },
  // Back-compat alias for older configs:
  groqProxyUrl: "/api/assistant"
};
