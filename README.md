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

- **PDF Editor** — select and edit text, add text, highlight, underline, strike, freehand pen, lines, arrows, rectangles, ellipses, whiteout, true redaction boxes, images, typed or drawn signatures, sticky comments and PDF form fields. Also reorder, duplicate, delete, rotate, insert blank pages, merge another PDF, extract pages and save a flattened copy.
- **PDF to Word** — builds a real `.docx` with headings, paragraphs, lists and tables. Uses the correct page viewport, so text lands in the right place, and warns you when a page is scanned instead of silently producing an empty file.
- **Live previews** — Watermark, Page Numbers, Crop, PDF to JPG, Image Compressor and Video to MP3 show the result before you commit.
- **Hub Assistant** — a local assistant that finds the right tool from a plain sentence, explains steps, checks file types and sizes, supports voice input, and can switch the theme. It runs entirely in your browser.
- **Installable PWA** — works from the home screen and keeps previously opened pages available offline.
- **Dark / light theme**, keyboard shortcuts, drag-and-drop, mobile layouts, reduced-motion support.

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

---

## Deploying

The site is plain HTML, CSS and JavaScript — no build step.

- **GitHub Pages:** upload the folder contents to the repository root and enable Pages.
- **Netlify / Cloudflare Pages / Vercel:** drag the folder in, or connect the repository. No build command; publish directory is the folder root.
- **Any shared host:** upload all files, keeping the folder structure.

### Before going live

1. **Replace the placeholder domain.** `sitemap.xml` and `robots.txt` use `https://multitoolhub.example/`. Replace it with your real domain. If you do not want a sitemap, delete both files.
2. **Keep `sw.js` at the site root.** Service workers only control pages at or below their own folder.
3. **Bump the cache name** in `sw.js` (`const CACHE = "mth-v6";`) whenever you change HTML, CSS or JS. This forces visitors to receive the new files.
4. **HTTPS is required** for the service worker and installation (localhost is exempt).

---

## Privacy model

- **Local tools** read files with the browser's File API and process them in memory. Nothing is uploaded.
- **YouTube and Instagram helpers** are the only tools that contact a third party. They send the public link you paste to the **Loader.to** API to fetch download options. This is disclosed on the pages, in the assistant and in the Privacy Policy.
- **Site files** (HTML, CSS, JS, icons) are served by your host or CDN, which will see normal request data such as IP address and user agent.
- **No analytics, no advertising, no accounts, no tracking pixels** are included.
- Chat history, favourites, theme and recent tools are stored in `localStorage` on your device. Legal pages list every key used.

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
  logo.svg                  3D isometric cube logo
  icon-192.png              Home-screen icon
  icon-512.png              Large icon
  icon-maskable-512.png     Android adaptive icon
  og-cover.png              Social sharing image
  style.css                 Design system and shared components
  app.js                    Shared helpers (PE.*)
  pdf.worker.min.js         Self-hosted pdf.js worker (works offline)
  chat.js                   Hub Assistant
tools/                      One self-contained HTML file per tool
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
- Fonts in the editor are limited to Helvetica, Times and Courier with Latin characters, which keeps exports reliable without embedding font files.
- Protect PDF (encryption) is intentionally not offered because pdf-lib cannot write encryption. A broken “protection” button would be worse than no button.
- The legal pages are detailed general templates, not legal advice. Have them reviewed for your jurisdiction if you rely on the site commercially.

---

## Credits

Designed and built for **MULTI TOOL HUB** by **FAYAS MONU**.

Credit line: `(hank!nd3 p4d4y41! | FAYAS MONU`

Open-source libraries: [pdf.js](https://mozilla.github.io/pdf.js/), [pdf-lib](https://pdf-lib.js.org/), [JSZip](https://stuk.github.io/jszip/), [docx](https://docx.js.org/), [lamejs](https://github.com/zhuker/lamejs), [Font Awesome](https://fontawesome.com/), and Google Fonts (Bricolage Grotesque, Plus Jakarta Sans).

---

© 2026 MULTI TOOL HUB. Free to use; please keep the credit line.
