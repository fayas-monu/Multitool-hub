/* MULTI TOOL HUB — runtime configuration.
   Keep the Groq API key on the server; never place it in this file. */
window.MTH_CONFIG = {
  // Set this to your deployed Worker URL, or keep /api/assistant when
  // serving the bundled Node server from the same origin.
  groqProxyUrl: "/api/assistant",
  groq: {
    // Optional override; when omitted, groqProxyUrl is used.
    token: "",
    modelLabel: "Groq · Llama 3.3 70B"
  }
};
