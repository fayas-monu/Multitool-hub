# Optional assistant server

MULTI TOOL HUB works completely without this folder. The assistant is local by
default. This small server is only needed when you want the optional
floating **Hub Assistant** chat widget.

It does two things:

1. Serves the static site, so the app and API share an origin.
2. Proxies chat text to Groq while the API key stays on the server (streaming or buffered).

**Local file tools never touch this server.** PDFs, images, signatures and audio
are processed in the visitor's browser. This proxy only receives the chat
messages a visitor sends to the Hub Assistant.

---

## Requirements

- Node.js 18 or newer (uses the built-in `fetch` and `node:` modules)
- A Groq API key from [console.groq.com/keys](https://console.groq.com/keys)

No npm install is required.

## Quick start

```bash
cd server
cp .env.example .env
# edit .env and set GROQ_API_KEY
node server.js
```

On Windows PowerShell:

```powershell
cd server
Copy-Item .env.example .env
notepad .env
node server.js
```

Open <http://127.0.0.1:8787>. The whole site is served from there, including the
tools. The assistant works automatically once assets/config.js points at this server:

```
http://127.0.0.1:8787/api/assistant
```

Add the access token if you set `CLIENT_TOKEN`. Press **Connect**.

To use a different host or port, change `HOST` and `PORT` in `server/.env`, then
open the matching address.

## What the server exposes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/assistant` | Connection check used by the Connect dialog |
| `POST` | `/api/assistant` | Sends chat text to Groq. `{stream:false}` (default) returns `{ ok, reply, model }`; `{stream:true}` returns a forwarded `text/event-stream`. |
| `GET` | everything else | Static files from the project root |

`GET /api/assistant` returns `503` when `GROQ_API_KEY` is missing, so the UI can
explain the problem instead of failing silently.

The POST body is intentionally small:

```json
{
  "messages": [
    { "role": "user", "content": "How do I crop a page?" }
  ],
  "page": "/tools/crop-pdf.html"
}
```

Limits: 16 messages, 4,000 characters per message, 64 KB request body, 28 second
upstream timeout.

## Security notes

- **The key stays server-side.** It is never written into HTML or JavaScript and
  never returned to the browser.
- **Optional access token.** Set `CLIENT_TOKEN` in `server/.env`. Every request
  must then send `Authorization: Bearer <token>`. Use a long random value:

  ```bash
  node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
  ```

- **Rate limiting.** Defaults to 20 requests per IP per 60 seconds. Adjust with
  `RATE_LIMIT` and `RATE_WINDOW_SECONDS`. This is in-memory and per process; use
  a shared limiter if you run several instances.
- **Origins.** By default only same-origin requests are accepted. If the static
  site is hosted elsewhere, list the exact origins in `ALLOWED_ORIGINS`:

  ```
  ALLOWED_ORIGINS=https://tools.example.com,https://www.tools.example.com
  ```

  Avoid `*` on a public deployment.
- **No message logging.** The proxy does not write chat text to disk or print it
  to the console. Reverse proxies and hosting platforms may keep their own
  access logs; disable body logging there if that matters to you.
- **Network binding.** `HOST=127.0.0.1` keeps the server on your machine. For a
  public deployment, put it behind HTTPS and a reverse proxy, keep the token
  enabled, and restrict origins.
- **Path safety.** Static serving is limited to the project folder. The
  `server/` directory, dotfiles and `.env` are never served.
- **Headers.** Responses include `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options` and a restrictive `Permissions-Policy`.
- **Rotate the key** immediately if it is ever pasted into chat, committed, or
  exposed in a screenshot.

## Deploying

Any Node 18+ host works (a VPS, Render, Railway, Fly.io, a container, etc.).

1. Upload the project, including `server/`.
2. Set the environment variables in the hosting dashboard, or create
   `server/.env` on the machine.
3. Start with `node server/server.js` (or `npm start` inside `server/`).
4. Put HTTPS in front of it.
5. Set `ALLOWED_ORIGINS` to your real site and keep `CLIENT_TOKEN` enabled.

If you only want the static tools on a CDN and the API elsewhere, host the site
normally and point the Connect dialog at
`https://api.example.com/api/assistant`. In that case the API server must list
the site's origin in `ALLOWED_ORIGINS`. The API does not need to serve static
files, but this server serves both by default.

### Health check

```bash
curl -i http://127.0.0.1:8787/api/assistant
```

With a token:

```bash
curl -i -H "Authorization: Bearer YOUR_TOKEN" http://127.0.0.1:8787/api/assistant
```

## Privacy and legal

The chat text sent to the Hub Assistant is processed by Groq's API
under Google's terms. Do not send confidential documents, personal data,
passwords or payment details. The assistant is a convenience feature, not
professional advice. See the site's [Privacy Policy](../privacy.html) and
[Terms of Use](../terms.html).

The server itself is provided as an integration example. You are responsible
for the hosting, API costs, access control and any regional requirements that
apply to you, including India's DPDP Act 2023 and the UAE PDPL (Federal
Decree-Law No. 45 of 2021).
