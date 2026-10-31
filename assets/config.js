/* MULTI TOOL HUB — static frontend configuration.
   No backend/proxy is required. The user supplies their own Groq API key
   in the browser when first using the assistant. Never commit API keys. */
(function () {
  "use strict";
  window.MTH_CONFIG = {
    groq: {
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      model: "llama-3.3-70b-versatile",
      modelLabel: "Groq · Llama 3.3 70B",
      temperature: 0.7,
      maxTokens: 1024
    }
  };
})();
