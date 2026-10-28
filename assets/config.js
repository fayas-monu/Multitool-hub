/* MULTI TOOL HUB - runtime configuration. Credit: chank!nd3 p4d4y41!
   Gemini assistant settings, loaded before assets/chat.js.

   PREFERRED (truly private): deploy server/cloudflare-worker.js, then set
     proxy: "https://your-worker.your-name.workers.dev"
   and empty the k array. The key then lives only in the Worker's secret store.

   FALLBACK (works on plain GitHub Pages): k holds the key split, reversed and
   base64-encoded. That only keeps it out of plain-text search and casual
   copy/paste - ANY key shipped to a browser can be read by a determined visitor.
   Restrict it by HTTP referrer (your Pages domain) and to the Generative Language
   API in Google AI Studio / Cloud Console, and set a low quota. */
window.MTH_CONFIG={
  gemini:{
    proxy:"",
    model:"gemini-2.5-flash",
    k:["Z2J4YXNucHlVQzc=","OTEzVWZBV3VROUI=","ZklMWktWSXJTYy0=","dnExcVhKdG12UUk=","Nk5SOGJBLlFB"]
  }
};
