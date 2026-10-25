# MULTI TOOL HUB

A fast, privacy-first collection of **17 browser tools** for PDFs, images and media. No account, no server upload for local tools, no watermarks on your output.

> **Credit:** (hank!nd3 p4d4y41! | FAYAS MONU  
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

- **PDF Editor** — select and edit text, add wrapped text boxes with a 19-font picker, bold/italic, alignment, line spacing, text background, highlight, underline, strike, freehand pen, lines, arrows, rectangles, ellipses, solid/dashed/dotted strokes, whiteout, true redaction boxes, images, typed or drawn signatures, sticky comments and PDF form fields. Text-edit covers sample the page background so tinted pages stay clean. Geometry is set with exact numbers — X, Y, width, height, font size, spacing and opacity — rather than fiddly drag handles. Also reorder, duplicate, arrange, delete, rotate, insert blank pages, merge another PDF, extract pages, focus the canvas, undo/redo, and save the current page or every page as a flattened copy.
- **Precision PDF crop** — eight independent handles (four edges and four corners), numeric insets in %, mm, in or pt, aspect presets including 1:1, auto-trim of detected margins, page-range controls and a live result preview.
- **PDF to Word** — builds a real `.docx` with headings, paragraphs, lists and tables. Uses the correct page viewport, so text lands in the right place, and warns you when a page is scanned instead of silently producing an empty file.
- **Exact image sizing** — set inserted images to exact mm, cm, inches or pixels, with an aspect-ratio lock.
- **Honest, expandable previews** — Watermark, Page Numbers, Crop, PDF to JPG, Image Compressor and Video to MP3 preview the result before you commit. Canvases keep their true page/image proportions, and the expand button opens a large, composited view that includes watermark, page-number and crop layers.
- **Search built for intent** — word-level matching, plural and stopword handling, exact source→target direction (so “pdf to word” never returns “word to pdf”), typo tolerance, category filtering, favourites, recent tools and keyboard navigation.
- **Hub Assistant** — a local, rule-based assistant that finds the right tool from a plain sentence, explains steps, checks file types and sizes, supports voice input, and can switch the theme. It runs entirely in your browser.
- **Optional Gemini connection** — when the bundled proxy is deployed, you can explicitly connect Gemini from the chat header. The API key stays on the server; only the chat text you send leaves the browser. The local assistant remains the default and the fallback.
- **Installable PWA** — works from the home screen and keeps previously opened pages available offline.
- **Dark / light theme**, keyboard shortcuts, drag-and-drop, mobile-first layouts, a mobile navigation drawer, reduced-motion support and full text-contrast checks in both themes.

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

> The PDF, image and audio engines load from public CDNs (pdf.js, pdf-lib, JSZip, docx, lamejs, Font Awesome, Google Fonts). The pdf.js worker is self-hosted (`assets/pdf.worker.min.js`), so rendering keeps working offline. The first visit needs an internet connection for the CDN libraries; afterwards the service worker caches them.

### Optional: connect Gemini safely

The assistant is local by default and needs no account or key. If you want Gemini replies, deploy the small proxy in `server/` (Node.js 18+), set `GEMINI_API_KEY` in its environment, and follow `server/README.md`. In the app, open **Assistant → Gemini**, enter the proxy URL and connect. The key stays on the server; it is never written into `assets/chat.js` or any other client file.

---

## Deploying

The site is plain HTML, CSS and JavaScript — no build step.

- **GitHub Pages:** upload the folder contents to the repository root and enable Pages.
- **Netlify / Cloudflare Pages / Vercel:** drag the folder in, or connect the repository. No build command; publish directory is the folder root.
- **Any shared host:** upload all files, keeping the folder structure.

### Before going live

1. **Replace the placeholder domain.** `sitemap.xml` and `robots.txt` use `https://multitoolhub.example/`. Replace it with your real domain. If you do not want a sitemap, delete both files.
2. **Keep `sw.js` at the site root.** Service workers only control pages at or below their own folder.
3. **Bump the cache name** in `sw.js` (`const CACHE = "mth-v13";`) whenever you change HTML, CSS or JS. This forces visitors to receive the new files.
4. **HTTPS is required** for the service worker and installation (localhost is exempt).

---

## Privacy model

- **Local tools** read files with the browser's File API and process them in memory. Nothing is uploaded.
- **YouTube and Instagram helpers** are the only tools that contact a third party. They send the public link you paste to the **Loader.to** API to fetch download options. This is disclosed on the pages, in the assistant and in the Privacy Policy.
- **Gemini is opt-in.** If the optional proxy is configured and you press Connect, your chat text, the page path and normal request metadata are sent to Gemini through that proxy. The API key stays server-side. No file is ever sent. If you never connect, the assistant stays fully local.
- **Site files** (HTML, CSS, JS, icons) are served by your host or CDN, which will see normal request data such as IP address and user agent.
- **No analytics, no advertising, no accounts, no tracking pixels** are included.
- Chat history, favourites, theme and recent tools are stored in `localStorage` on your device. Legal pages list every key used.

The v4.1 legal pages cover India (DPDP Act 2023, IT Act and rules, Consumer Protection Act) and the UAE (PDPL and consumer-protection rules), including the optional Gemini connection. They are detailed templates, not legal advice.

The full text is in [privacy.html](privacy.html) and [terms.html](terms.html).

---

## Project structure

```text
index.html                  Home page, tool grid, favourites and recents
manifest.webmanifest        Installable app metadata
sw.js                       Offline cache (root scope)
offline.html                 Offline fallback
404.html                    Not-found page
terms.html / privacy.html   Legal pages
robots.txt / sitemap.xml    Search-engine files
assets/
  logo.svg                  Official MULTI TOOL HUB logo (also inlined in page headers)
  gemini.svg                Gemini mark used in the assistant and connection dialog
  icon-192.png              Home-screen icon
  icon-512.png              Large icon
  icon-maskable-512.png     Android adaptive icon
  og-cover.png              Social sharing image
  style.css                 Design system and shared components
  app.js                    Shared helpers (PE.*) and preview compositor
  pdf.worker.min.js         Self-hosted pdf.js worker (works offline)
  chat.js                   Hub Assistant (local rules + optional Gemini client)
tools/                      One self-contained HTML file per tool
server/                     Optional Node.js static host + secure Gemini proxy
  server.js                 No dependencies; key stays in the server env
  README.md                 Deployment and security notes
  .env.example              Copy to .env and add GEMINI_API_KEY
```

`assets/app.js` exposes small helpers used by every tool:

- `PE.openPdf(file)` — read a File/Blob safely with pdf.js
- `PE.preview(...)` — render page thumbnails/previews
- `PE.ranges("1-3,5,8-")` — parse page ranges
- `PE.zip(files, name)` — build a ZIP
- `PE.download`, `PE.toast`, `PE.status`, `PE.progress`, `PE.run` — UI and error handling

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
- Protect PDF (encryption) is intentionally not offered because pdf-lib cannot write encryption. A broken “protection” button would be worse than no button.
- The legal pages are detailed general templates, not legal advice. Have them reviewed for your jurisdiction if you rely on the site commercially.

---

## Credits

Designed and built for **MULTI TOOL HUB** by **FAYAS MONU**.

Credit line: `(hank!nd3 p4d4y41! | FAYAS MONU`

Open-source libraries: [pdf.js](https://mozilla.github.io/pdf.js/), [pdf-lib](https://pdf-lib.js.org/), [JSZip](https://stuk.github.io/jszip/), [docx](https://docx.js.org/), [lamejs](https://github.com/zhuker/lamejs), [Font Awesome](https://fontawesome.com/), Google Fonts (Fraunces and Plus Jakarta Sans), and the optional [Gemini API](https://ai.google.dev/).

---

© 2026 MULTI TOOL HUB. Free to use; please keep the credit line.
