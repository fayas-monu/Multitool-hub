# MULTI TOOL HUB

A fast, privacy-first collection of **18 browser tools** for PDFs, images and media. The interface is a clean corporate black-and-white workspace built for everyday office work, with a floating Groq-powered Hub Assistant. There is no account, no upload for the local tools, and no watermark added to your output.

> **Credit:** `Developed by chank!nd3 p4d4y41! l FAYAS MONU`
> **Instagram:** [@____fa_y_as_____](https://www.instagram.com/____fa_y_as_____)

![MULTI TOOL HUB](assets/og-cover.png)

---

## What is inside

| Area | Tools |
| --- | --- |
| **Organise** | Merge PDF · Split PDF · Organize Pages · Rotate PDF |
| **Optimise** | Compress PDF |
| **Convert** | PDF to Word · PDF to Text · PDF to JPG · JPG to PDF |
| **Edit** | PDF Editor · Crop PDF · Page Numbers · Watermark |
| **Images** | Image Compressor |
| **Media** | Video to MP3 · YouTube Downloader · Instagram Downloader |

### Highlights

- **A complete PDF editor** - edit existing text, add wrapped text boxes with a 19-font picker, bold/italic, alignment, line spacing, text background, highlight, underline, strike-through, freehand pen, lines, arrows, rectangles, ellipses, solid/dashed/dotted strokes, whiteout, true redaction boxes, images, typed or drawn signatures, sticky comments and PDF form fields. Text-edit covers sample the page background so tinted pages stay clean. Geometry is set with exact numbers - X, Y, width, height, font size, spacing and opacity - rather than fiddly drag handles. Reorder, duplicate, arrange, delete, rotate, insert blank pages, merge another PDF, extract pages, focus the canvas, undo/redo, and save the current page or every page as a flattened copy.
- **Precision PDF crop** - eight independent handles (four edges and four corners), numeric insets in %, mm, in or pt, aspect presets including 1:1, auto-trim of detected margins, page-range controls and a live result preview.
- **PDF to Word** - builds a real `.docx` with headings, paragraphs, lists and tables. It uses the correct page viewport, so text lands in the right place, and warns you when a page is scanned instead of silently producing an empty file.
- **Large, interactive previews** - Watermark, Page Numbers, Crop, PDF to JPG, Image Compressor and Video to MP3 preview before you commit. The expand control opens a viewport-sized modal with zoom, fit, actual size, pan, a live state indicator and a download button. Stacked overlay layers (watermark, page numbers, crop guides) are composited into the enlarged image.
- **Search built for intent** - word-level matching, plural and stopword handling, exact source-to-target direction (so "pdf to word" never returns "word to pdf"), typo tolerance, category filtering, favourites, recent tools and keyboard navigation.
- **Hub Assistant, powered by Groq** - a floating chat widget with streaming markdown replies (`llama-3.3-70b-versatile`). It talks only to a secure server-side proxy you deploy; the Groq API key is never present in the browser. Configured in `assets/config.js` (see below).
- **Installable PWA** - works from the home screen and keeps previously opened pages available offline.
- **Dark / light theme**, keyboard shortcuts, drag-and-drop, mobile-first layouts, a mobile navigation drawer, reduced-motion support and readable contrast in both themes.

---

## Quick start

1. Unzip or copy the whole folder.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari).
3. That is it. A local static server is optional, but recommended if you want the service worker, clipboard and some browser features to behave exactly as they do in production.

### Run a local server (optional)

Any static server works. Two easy options:

```powershell
# Python 3
python -m http.server 8080
```

```powershell
# Node.js
npx serve .
```

Then visit <http://localhost:8080>.

> The PDF, image and audio engines load from public CDNs (pdf.js, pdf-lib, JSZip, docx, lamejs, Font Awesome). The pdf.js worker is self-hosted (`assets/pdf.worker.min.js`), so rendering keeps working offline. The first visit needs an internet connection for the CDN libraries; afterwards the service worker caches them. The interface itself uses the system font stack - no Google Fonts request is made.

### Hub Assistant proxy (assets/config.js)

`assets/config.js` is loaded on every page before `chat.js` and points the floating Hub Assistant at your proxy. There is no browser-key mode — the Groq key is never shipped to the browser, by design.

1. Deploy one of the two included proxies:
   - **`server/cloudflare-worker.js`** (recommended) — `wrangler secret put GROQ_API_KEY`, deploy, then set `groq.proxy` in `assets/config.js` to the Worker URL.
   - **`server/server.js`** (Node 18+) — copy `server/.env.example` to `server/.env`, set `GROQ_API_KEY`, run `npm start`, then set `groq.proxy` to `/api/assistant` (same-origin) or the server's public URL.
2. Get a Groq API key at [console.groq.com/keys](https://console.groq.com/keys).
3. Optionally set `CLIENT_TOKEN` on the proxy and the matching `groq.token` in `assets/config.js` to require a shared secret.

The proxy exposes `GET /api/assistant` for a health check and `POST /api/assistant` for chat, with `{stream:true}` for a Server-Sent-Events stream the widget renders as markdown in real time, and a non-streaming fallback if the stream fails. See `server/README.md` for deployment, origin allow-listing, rate limits and security notes.

> **Security:** never commit an API key. If a key is ever exposed in a screenshot, chat, issue or commit, revoke it in the Groq console and create a new one.

---

## Deploying

The site is plain HTML, CSS and JavaScript - no build step.

- **GitHub Pages:** upload the folder contents to the repository root and enable Pages. The site uses relative paths and a service worker scoped to the folder, so it works at `https://user.github.io/repository/` as well as on a custom domain. `404.html` resolves the site root before loading assets.
- **Netlify / Cloudflare Pages / Vercel:** drag the folder in, or connect the repository. No build command; publish directory is the folder root.
- **Any shared host:** upload all files, keeping the folder structure.

### Before going live

1. **Replace the placeholder domain.** `sitemap.xml` and `robots.txt` use `https://multitoolhub.example/`. Replace it with your real domain. If you do not want a sitemap, delete it. Social images use relative paths so they resolve on any host; add absolute `og:url`/`og:image` URLs if your sharing platform requires them.
2. **Keep `sw.js` at the site root.** Service workers only control pages at or below their own folder.
3. **Bump the cache name** in `sw.js` (`const CACHE = "mth-v17";`) whenever you change HTML, CSS or JS. This forces visitors to receive the new files.
4. **HTTPS is required** for the service worker and installation (localhost is exempt).
5. **Test in a private window** after deployment so an older service worker does not serve stale files.

---

## Privacy model

- **Local tools** read files with the browser's File API and process them in memory. Nothing is uploaded.
- **YouTube and Instagram helpers** are the only tools that contact a third party. They send the public link you paste to the **Loader.to** API to fetch download options. This is disclosed on the pages, in the assistant and in the Privacy Policy.
- **The assistant sends nothing until you message it.** Once you type and send a message, your chat text and normal request metadata are sent to Groq through your own server-side proxy. The Groq key always stays on your server. No file is ever sent.
- **Site files** (HTML, CSS, JS, icons) are served by your host or CDN, which will see normal request data such as IP address and user agent.
- **No analytics, no advertising, no accounts, no tracking pixels** are included.
- Chat history, favourites, theme and recent tools are stored in `localStorage` on your device. The current Hub Assistant conversation is stored only in `sessionStorage` and cleared when the tab closes. The Groq key never touches browser storage at all — it lives only on your server. Legal pages list every key used.

The legal pages cover India (DPDP Act 2023, IT Act and rules, Consumer Protection Act) and the UAE (PDPL and consumer-protection rules), including the Hub Assistant / Groq data flow. They are detailed templates, not legal advice.

The full text is in [privacy.html](privacy.html) and [terms.html](terms.html).

---

## Project structure

```text
index.html                  Home page, tool grid, favourites and recents
manifest.webmanifest        Installable app metadata
sw.js                       Offline cache (root scope)
offline.html                Offline fallback
404.html                    Not-found page
terms.html / privacy.html   Legal pages
robots.txt / sitemap.xml    Search-engine files
assets/
  logo.svg                  Light-theme MULTI TOOL HUB lockup
  logo-dark.svg             Dark-theme lockup (white wordmark, blue mark)
  icon-192.png              Home-screen icon
  icon-512.png              Large icon
  icon-maskable-512.png     Android adaptive icon
  og-cover.png              Social sharing image
  style.css                 Design system and shared components
  app.js                    Shared helpers (PE.*) and preview compositor
  pdf.worker.min.js         Self-hosted pdf.js worker (works offline)
  chat.js                   Hub Assistant (floating widget; Groq via the proxy only)
  cursor.js                 Venom web cursor trail (hover-only, interactive elements)
  brand.js                  Injects the mandatory MTH logo + footer credit on every page
tools/                      One self-contained HTML file per tool
server/                     Optional Node.js static host + secure Groq proxy
  server.js                 No dependencies; key stays in the server env
  README.md                 Deployment and security notes
  .env.example              Copy to .env and add GROQ_API_KEY
```

`assets/app.js` exposes small helpers used by every tool:

- `PE.openPdf(file)` - read a File/Blob safely with pdf.js
- `PE.preview(...)` - render page previews
- `PE.ranges("1-3,5,8-")` - parse page ranges (0-based by default)
- `PE.zip(files, name)` - build a ZIP
- `PE.openPreview(...)` - open the large zoomable preview modal
- `PE.download`, `PE.toast`, `PE.status`, `PE.progress`, `PE.run` - UI and error handling

---

## Browser support

| Browser | Status |
| --- | --- |
| Chrome / Edge 100+ | Full support |
| Firefox 100+ | Full support (a few codecs depend on the OS) |
| Safari 15.4+ | Most tools; MP3 encoding and some canvas filters may vary |
| Mobile browsers | Responsive UI; very large PDFs may be limited by device memory |

Video to MP3 depends on the browser being able to decode the source codec. If the browser cannot decode a file, the tool tells you instead of producing a broken download.

---

## Notes and limits

- Editing existing text in the PDF Editor places a clean cover over the original glyphs. It looks correct, but the old text can still exist underneath. Use the **Redact** tool when content must be removed, and use **Flatten** when you need a single non-editable result.
- Scanned PDFs have no text layer. PDF to Word and PDF to Text will report this; OCR is not included.
- The PDF Editor offers Helvetica, Arial, Times New Roman, Courier New, Verdana, Georgia, Comic Sans, Trebuchet MS and other common families. Helvetica/Arial, Times New Roman and Courier New export as real vector text (Arial and Courier New use the metric-compatible PDF standard fonts), so the text stays selectable. Other fonts and characters outside the PDF standard Latin set are rendered into the page at high resolution: they look exactly as designed but are not selectable. The save dialog says how many boxes this affects.
- Protect PDF (encryption) is intentionally not offered because pdf-lib cannot write encryption. A broken "protection" button would be worse than no button.
- The downloaders depend on the third-party Loader.to service. If that service is unavailable or changes its rules, those two tools may stop working; the other 15 tools are unaffected.
- The legal pages are detailed general templates, not legal advice. Have them reviewed for your jurisdiction if you rely on the site commercially.

---

## Credits

Designed and built for **MULTI TOOL HUB** by **FAYAS MONU**.

Credit line: `chank!nd3 p4d4y41!`

Open-source libraries: [pdf.js](https://mozilla.github.io/pdf.js/), [pdf-lib](https://pdf-lib.js.org/), [JSZip](https://stuk.github.io/jszip/), [docx](https://docx.js.org/), [lamejs](https://github.com/zhuker/lamejs), [Font Awesome](https://fontawesome.com/), and the [Groq API](https://groq.com/) for the Hub Assistant. The interface uses the Arial system font stack; Google Fonts is not loaded.

---

&copy; 2026 MULTI TOOL HUB. Free to use; please keep the credit line.
