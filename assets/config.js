/* MULTI TOOL HUB — runtime configuration. Credit: chank!nd3 p4d4y41! l FAYAS MONU
   Groq assistant settings, loaded before assets/chat.js.

   The Groq API key NEVER goes here and never ships to the browser. Deploy
   one of the two proxies in /server and put its URL below:

     - server/cloudflare-worker.js  (recommended — wrangler secret put GROQ_API_KEY)
     - server/server.js             (Node — copy server/.env.example to server/.env)

   Both the modern `groq.proxy` key and the legacy `groqProxyUrl` alias are
   honoured by chat.js, so either form works. The default `/api/assistant`
   works out of the box with the bundled Node server (server/server.js). */
window.MTH_CONFIG = {
  groq: {
    // e.g. "https://mth-assistant.YOUR-SUBDOMAIN.workers.dev"
    // or, same-origin Node deploy: "/api/assistant"
    proxy: "/api/assistant",
    // Optional: only needed if your proxy sets CLIENT_TOKEN.
    token: "",
    modelLabel: "Groq · Llama 3.3 70B"
  },
  // Back-compat alias honoured by assets/chat.js:
  groqProxyUrl: "/api/assistant"
};
