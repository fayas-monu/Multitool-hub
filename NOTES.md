# Upgrade notes — MULTI TOOL HUB

## Replace / add
- index.html, manifest.webmanifest, assets/ (logo.svg, style.css, app.js)
- tools/merge-pdf.html, rotate-pdf.html, watermark.html, pdf-to-jpg.html

## Do now (security)
- tools/pdf-to-word.html contains a hard-coded ConvertAPI secret (CONVERT_API_SECRET). It is public in your repo.
  Revoke/rotate it in your ConvertAPI dashboard. Client-side code cannot keep a secret; use the browser-only
  engine or put the call behind a small server/worker.
- That mode also uploads the user's PDF to a third party, so "nothing is uploaded" is not true for it.

## Bugs found in the old code
- video-to-mp3: writes WAV data but names the file .mp3 (use .wav, or add an MP3 encoder such as lamejs).
- pdf-to-jpg: many automatic downloads in a loop get blocked by browsers (now one ZIP).
- merge: file names inserted with innerHTML (script injection risk), no ordering, no error handling.
- rotate: no left rotation or reset, no error handling.
- watermark: text was off-centre, fixed size, no opacity control.
- Script.js, pdf-engine.js, style.css in the repo root are from the old home page and are no longer used. Safe to delete.
- chatbot/index.html: q.includes('ad') matches "download", "head", etc. (fixed in the new index.html chat).

## Batch 2 (new design)
video-to-mp3 (real MP3 via lamejs, WAV fallback), youtube-downloader, instagram-downloader, jpg-to-pdf, compress-pdf.

## Batch 3 (new design)
pdf-to-word (browser-only, ConvertAPI key and upload removed; still revoke the old key), crop-pdf (margin sliders with live preview; handles rotated pages).

## Still on the old design
editor.html (text editor, keep for now), chatbot/index.html (duplicate of the home page assistant; consider deleting).
They can use the same head block and assets/style.css + assets/app.js as the four new pages.

## Batch 4 (new features)
- New tools: Split PDF (range / every page / parts of N), Organize Pages (thumbnails, reorder, rotate, delete), Page Numbers.
- Offline: sw.js caches the site and CDN libraries after the first visit. Downloader requests are never cached.
- PE.ranges() in assets/app.js parses "1-3, 5, 8-" for any tool.
- Home page now lists Split, Organize, Page Numbers, PDF to Word and PDF Editor as live tools. Only Protect PDF is still "Coming soon".
- Protect PDF needs real encryption, which pdf-lib cannot do. Use a library that supports it (for example qpdf compiled to WebAssembly) before building it.
- Keep sw.js at the site root. Bump V in sw.js when you change files, so visitors get the update.

## Batch 5 (rename, 3D logo, assistant, live previews, editor)
- Name is now MULTI TOOL HUB everywhere. New 3D isometric-cube logo in assets/logo.svg (also the favicon, home-screen icon and chat button).
- Hub Assistant is now assets/chat.js and appears on every page. It finds tools from plain sentences, answers FAQs, switches dark/light mode, keeps the chat for the session and runs fully in the browser.
- Downloaders keep the Loader.to API. The wording is friendlier, and the Privacy Policy still discloses it (required for honesty and for most legal regimes).
- terms.html and privacy.html are full pages linked from every footer. They are a general template: have a legal professional review them before you rely on them.
- Watermark: live preview, text or image/logo, tiled or single, angle, colour, opacity, page range.
- Page Numbers: live preview, position, style, size, colour, margin, skip cover.
- PDF to Word: now builds a real .docx (headings, paragraphs, bullets, tables) with a preview first. Falls back to .doc if the docx library cannot load.
- PDF Editor (tools/editor.html): edit existing text, add text, highlight, draw, box, ellipse, whiteout, images, drawn signature, undo/redo, zoom, page navigation, keyboard shortcuts.
  Limits: pages with a /Rotate value are blocked; editing existing text covers the old text with white (it remains in the file underneath, so it is not redaction); fonts are Helvetica, Times and Courier (Latin characters only).
- Still not built: Protect PDF (needs real encryption), OCR for scanned PDFs, form-field filling, merging/reordering inside the editor.
