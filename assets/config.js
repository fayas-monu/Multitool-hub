/* MULTI TOOL HUB — runtime configuration. Credit: chank!nd3 p4d4y41! l FAYAS MONU
   Groq assistant settings, loaded before assets/chat.js.

   The Groq API key NEVER goes here and never ships to the browser. Deploy
   one of the two proxies in /server and put its URL below:

     - server/cloudflare-worker.js  (recommended — wrangler secret put GROQ_API_KEY)
     - server/server.js             (Node — copy server/.env.example to server/.env)

   Until you deploy a proxy and set the URL, the assistant stays visible but
   shows a short "not configured yet" notice instead of a broken call. */
window.MTH_CONFIG = {
  groq: {
    // e.g. "https://mth-assistant.YOUR-SUBDOMAIN.workers.dev"
    // or, same-origin Node deploy: "/api/assistant"
    proxy: "",
    // Optional: only needed if your proxy sets CLIENT_TOKEN.
    token: "",
    modelLabel: "Groq · Llama 3.3 70B"
  }
};
