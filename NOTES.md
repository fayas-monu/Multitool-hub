# Maintainer notes - MULTI TOOL HUB 4.2

Release date: 26 October 2026
Credit: `chank!nd3 p4d4y41!.I FAYAS MONU`

This file is for whoever maintains the site. The user-facing documentation is in `README.md`.

## Shipping checklist

1. Keep `sw.js` in the site root. It must be served over HTTPS (or localhost).
2. Bump `const CACHE = "mth-v16";` in `sw.js` on every release that changes HTML, CSS or JS.
   The activate handler deletes every older cache.
3. Replace `https://multitoolhub.example/` in `sitemap.xml`, `robots.txt` and the canonical/Open Graph tags with the real domain.
4. Test in a private window so an old service worker does not serve stale files.
5. Verify the PWA icons exist at the paths listed in `manifest.webmanifest` and match the navy/blue identity.
6. Open every page once and check DevTools > Console for errors.
7. If the optional Gemini proxy is used, deploy `server/` over HTTPS and set `GEMINI_API_KEY` in its environment - never in client code.
8. If a Gemini key has ever been exposed, revoke it before shipping. Never put a key in `assets/chat.js`, HTML, `localStorage` or a commit.

## Testing locally

No build tools are required. Serve the folder with any static server, for example:

```powershell
python -m http.server 8080
```

Useful manual checks:

- View every page at 390 px wide and confirm `document.documentElement.scrollWidth` is not wider than the viewport. The home category rail scrolls horizontally by design; that is not page overflow.
- Toggle light and dark on the home page, a complex tool (editor/crop) and a legal page. All visible text should stay readable in both themes, including the header logo. The dark logo must replace the navy wordmark in dark mode.
- Search `pdf to word`, `photo to pdf`, `compress image`, `sign`, `scan` and a typo such as `compres pdf`; confirm the intended tool appears and `word to pdf` correctly shows the no-results state.
- Drop a real, multi-page PDF into the editor; add text and a signature; set X/Y/W/H, font size and line spacing numerically; rotate one page; undo/redo; save the current page and all pages; reopen the output.
- Rotate a page in the editor, then add text, an image and a comment; export and confirm every layer stays in the same place.
- Crop a multi-page PDF with each of the eight handles, then with numeric %/mm insets; test 1:1, auto-trim, page ranges and download.
- Expand the preview on watermark, page numbers, crop, PDF to JPG and image compressor. The enlarged canvas must keep its aspect ratio, include the overlay layer, and support zoom, fit, actual size, pan and Escape.
- Export a text PDF to Word and open the `.docx` in Word or LibreOffice; check paragraph order, tables and page breaks.
- Export a scanned PDF to Word/Text; confirm the "no text layer" warning appears.
- Apply a watermark and page numbers to portrait, landscape and rotated pages; confirm the angle and position match the preview.
- Compress a large PDF with both "clean up" and a raster preset; compare size and legibility.
- Split/merge and confirm page order and page count.
- Check Video to MP3 with a real video/audio file, including trim, fades, mono/stereo and the WAV fallback.
- In the assistant: open, send a message, press browser back (it should close the panel, not leave the page), refresh (it should reset in place), clear/reset, and try an invalid Gemini endpoint (readable error, local mode still works). Test Browser key mode with mock/real traffic and confirm the key never appears in `localStorage` or the URL/history.
- Install the PWA, go offline, and reopen a previously visited tool.
- Serve the site from a subpath (for example `http://localhost:8080/MULTI-TOOL-HUB/`) and confirm the 404 page still loads its CSS, logo and links.

## Architecture notes

- Every tool is a standalone HTML file. Shared behaviour comes from `assets/style.css` and `assets/app.js`.
- `PE.openPdf(file)` is async and handles File, Blob and ArrayBuffer inputs. It returns a pdf.js document.
- `PE.preview` renders display-oriented pages (page rotation is respected); canvas internal size is `vp.width * devicePixelRatio`, CSS size is `vp.width` px.
- Editor page state is `{uid, s, p, rot, blank, w?, h?}` where `s` is the source index. pdf-lib is loaded lazily only when saving.
- For rotated-page exports, text angle = page rotation + desired display counter-clockwise angle; convert display points with `viewport.convertToPdfPoint`.
- The editor's "edit existing text" feature covers old glyphs; it is **not** redaction. Use the editor's Redact tool (a solid box that is flattened on save) when content must actually be removed. The cover colour is sampled from the rendered page around the text, so tinted or off-white pages do not get white patches.
- Editor text boxes store `w` (wrap width, `0` = auto), `align` (`l/c/r`), `lh` (line spacing), `italic`, `dash` and `bg` (text background). Wrapping, alignment and baseline math are shared between the live editor and the pdf-lib export, so what you see is what is written.
- Editor fonts use one registry (`FONTS`). Arial and Courier New map to the metric-compatible Helvetica/Courier PDF standard fonts and stay selectable; other common families, and any characters outside WinAnsi, are drawn to a high-resolution canvas and embedded as an image so they render faithfully.
- Shape strokes support solid, dashed and dotted styles in the editor and in the export (`borderDashArray` / `dashArray`).
- Watermark and page-number placement use relative page fractions so they survive different page sizes and rotations. Their preview overlays and PDF exports both convert display points through the page viewport.
- The assistant (`assets/chat.js`) is local by default. Its answers come from the `TOOLS` knowledge and rule tables embedded in the script. Optional Gemini replies use either a browser-held key (direct to Google) or a same-deployment proxy (`server/server.js`).
- Gemini constants: `STORE="mth.gemini.session.v1"`, `DIRECT_ROOT="https://generativelanguage.googleapis.com/v1beta"`, `MODELS` beginning with `gemini-2.5-flash`. The direct request is `POST /models/{model}:generateContent` with `x-goog-api-key`; the proxy health check is `GET` and chat is `POST` with an optional `Authorization: Bearer` token.
- The Gemini key and proxy token are session-only. Direct mode never writes to `localStorage`; a rejected key (HTTP 401/403) is cleared automatically. `Forget key` and `Disconnect` return to local mode.
- Search on the home page uses `SEARCH_STOP`, `SEARCH_PLURALS`, `searchTerms`, `fuzzyWord`, `directionOf`, `scoreTool` and `fuzzyScore`. It scores word-level strong fields (name, aliases, formats), requires maximum coverage, narrows on exact names, then falls back to fuzzy matching. `FMT`/`FORMATS` enforce conversion direction: `pdf to word` matches PDF-to-Word, while `word to pdf` has no matching tool and must show the empty state.
- `PE.openPreview` composites stacked canvases through `alignedLayers`/`compositeLayers`; this is why watermark, page-number and crop overlays appear in the expanded modal and not just the small preview.
- Global preview CSS keeps `max-width:100%`, removes max-height clamping and sets `height:auto` so every canvas keeps its intrinsic aspect ratio. Do not re-add a global max-height.
- The crop tool uses eight independent handles plus numeric insets. Insets are stored as percentages of the page and converted to points on export; changing one edge must not move the opposite edge.
- Editor geometry is numeric (`X`, `Y`, `W`, `H`, font size, line spacing, opacity). Keep the property panel authoritative; drag handles are shortcuts, not the only way to set a value.
- The header uses two logo files: `assets/logo.svg` for light surfaces and `assets/logo-dark.svg` for dark surfaces. CSS shows one at a time; do not collapse this back to a single fixed-colour wordmark or it will disappear in one theme.
- Theme switching is intentionally instant (`body` has `transition:none`). A fading body background briefly pairs new light text with the old light surface, which reads as a contrast glitch in dark mode.
- When a navigation is not cached, `sw.js` redirects to `offline.html` instead of returning it at the requested URL, so the page's relative CSS, logo and links resolve correctly from any folder depth.
- `404.html` and `offline.html` install a `<base>` element before asset links. The base comes from the service worker scope when available, then from a GitHub Pages project-path heuristic, then from the site root. This keeps a GitHub Pages project 404 working at `/repository/missing-path`.
- The Image Compressor keeps the original file when a "keep format, no resize" re-encode would be larger, so it never hands back a bigger file.
- The YouTube and Instagram downloaders open the Loader.to card in a new tab. Do not restore the inline iframe: Loader.to sends `X-Frame-Options: SAMEORIGIN`, so embedding it only produces a blocked frame and a console warning. The external card is disclosed in the UI, Privacy Policy and Terms.

## Known limits (intentional)

- No PDF encryption/protection: pdf-lib cannot write encrypted PDFs.
- No OCR: scanned PDFs require an OCR engine, which would add a large dependency.
- Editor text is limited to the bundled font registry; exotic or licensed typefaces are not loaded. Fonts without a PDF-standard metric equivalent export as high-resolution images (visually exact, not selectable).
- Very large PDFs are limited by device RAM/canvas size; tools report failures instead of writing corrupt files.
- MP3 encoding needs a browser that can decode the source audio codec; WAV is offered as a fallback. Multichannel sources are capped to stereo for MP3.
- The downloaders depend on a third-party service and can break without any change to this repository.

## Historical fixes (do not regress)

- Removed the hard-coded ConvertAPI secret from PDF to Word; conversion is now browser-only.
- Fixed WAV data being downloaded with an `.mp3` name; real MP3 via lamejs is used.
- Fixed JPG-to-PDF triggering dozens of automatic downloads; output is one PDF.
- Fixed `PE.openPdf(File)` reading empty bytes for File inputs.
- Fixed merge inserting filenames with `innerHTML` (injection risk).
- Fixed the old chatbot's substring matching (`includes("ad")` matched "download").
- Fixed PDF-to-Word line reconstruction, spacing, table detection and header/footer noise.
- Fixed editor annotations on rotated blank pages exporting in the wrong place.
- Fixed editor undo/redo leaving stale page thumbnails, and stale comment page numbers after reordering pages.
- Fixed editor text-edit covers using hard-coded white on tinted pages; the colour is now sampled from the page.
- Fixed font switching/size drift in the editor: the selected font, size, style, alignment and spacing now round-trip through the annotation model, and live Bold/Italic while typing keeps the caret.
- Added wrapped text boxes, text alignment/line spacing/background, shape stroke styles, duplicate and bring-front/send-back controls to the editor.
- Fixed (v10): `index.html` and `tools/editor.html` scripts, plus `assets/chat.js`, had syntax errors, so the tool grid, editor and assistant did not run. Always run a parse check on every inline script before release.
- Fixed (v10): UTF-8 mojibake across all tool pages (this corrupted bullet/hyphen regexes in PDF to Word). Keep files UTF-8; never round-trip them through cp1252.
- Fixed (v10): PDF to Word no longer deletes real hyphens at line ends (only lowercase continuations are de-hyphenated).
- Added (v10): exact image sizing in the PDF Editor (mm / cm / in / px). Annotation units are PDF points (1/72 in); "px" means CSS pixels at 96 dpi.
- Added (v10): the official SVG logo is inlined in every header so `currentColor` follows the theme. That inline approach was later replaced by the light/dark lockup pair.
- Removed (v10): duplicate `tools/chat.js` and stray `assets/n`.
- India/UAE legal sections are now Terms section 23 and Privacy section 22. They are templates, not legal advice; have counsel review before commercial use.

## 4.2 release notes

- Replaced the cream/pastel editorial look with a corporate navy, blue and white design system. Removed decorative fonts, gradients, paper/tape/stamp visuals and the floating "Built for careful work in India & the UAE" homepage block. The statement now lives in Terms section 23 and Privacy section 22.
- Rebuilt the MTH identity as a flat vector lockup with a light version and a dedicated dark version. Added a flat Gemini spark. Removed all Google Fonts requests; the interface now uses a system font stack.
- Added a large interactive preview modal with zoom, fit, actual size, pan, a live state indicator and a composited overlay image. Fixed preview aspect-ratio drift and overlay alignment.
- Reworked the Hub Assistant: local mode by default, optional Browser key mode (sessionStorage only) and optional proxy mode. Added key validation, show/hide, `Forget key`, `Disconnect`, `Reconnect`, model selection, timeouts and readable HTTP errors. Removed the old default `/api/assistant` request.
- Added the elastic SVG cursor thread: a spring-drawn line that stretches toward a nearby pointer, retracts when the pointer leaves, respects `prefers-reduced-motion`, and hides while the chat is open.
- Fixed `PE.esc` quote handling and `PE.ranges` to return 0-based indices by default, with a `oneBased` option. Added missing `$$` aliases in merge and organize.
- Fixed WebP output in `PE.imageBytes` (correct MIME, PNG fallback) and added a clear error if the browser returns no blob.
- Fixed JPG-to-PDF preview rotation for 90/270 images and corrected the margin hint.
- Fixed PDF-to-Word exporting stale debounced blocks; the latest range/options are rebuilt before export.
- Fixed PDF-to-JPG retaining old result object URLs after a new file was loaded.
- Fixed Organize Pages retaining selection keys for deleted pages.
- Fixed the editor comment "View" action selecting the first note instead of the clicked note.
- Fixed the editor zoom-percentage label so clicking it fits the page.
- Tokenised the YouTube and Instagram card-opening flow so an older click cannot overwrite the current link or status.
- Fixed Video to MP3 handling of more than two channels: MP3 is capped at stereo, mono downmix works, and 6-channel WAV remains possible.
- Fixed Split PDF stale document/selection state after a failed load.
- Replaced the blocked Loader.to iframes in the YouTube and Instagram downloaders with an external "Open download options" card; invalid links still show an inline error.
- Updated the service worker cache to `mth-v16`, removed Google Fonts hosts from runtime caching, and corrected the credit.
- Updated the manifest to a white background and navy theme colour, refreshed the description, and regenerated the PWA icons and social cover in the new identity.
- Made `404.html` and `offline.html` resolve their site root so they work on GitHub Pages project paths.
- Removed the unreferenced duplicate `tools/chat.js`.

## QA summary (4.2)

- Static parse and structure checks pass on every HTML page, `assets/app.js`, `assets/chat.js` and `sw.js`. All source text files are valid UTF-8 with no BOM and no U+FFFD replacement characters.
- Home: 17 tools, category filtering, favourites, recents, drawer, keyboard search, light/dark theme, no horizontal overflow at 390 px.
- Assistant: local reply, elastic thread, Browser key request shape (endpoint, `x-goog-api-key`, body), proxy health/chat shape, `Forget key`, rejected-key clearing, and no key in `localStorage` or the URL.
- PDF tools: merge, split, organize, rotate, compress, crop, page numbers, watermark, editor, PDF to Word, PDF to Text, PDF to JPG/PNG/WebP and JPG to PDF tested with generated PDFs and images; console clean and exports re-open.
- Editor save paths: vector save keeps annotation and note text, page count and rotation; flatten-to-images produces image-only pages with no text layer; page-range, current-page and delete-then-save-all exports produce the expected page counts, dimensions and rotations.
- Regression cases: Organize Pages keeps blank-page dimensions (including after reset); JPG to PDF snapshots its page settings so a mid-export format change cannot affect the current run; PDF to Text preserves a paragraph break after headings.
- Image: image compressor verified with stats, "keep original when larger" behaviour, preview fit/zoom/actual-size and Escape close.
- Downloaders: invalid links show the correct inline error; valid links set the Loader.to card URL and open it in a new tab with no frame-blocked console warning. The direct card was confirmed in a browser tab.
- Previews: fit/zoom/actual-size/pan, Escape close, mobile toolbar and overlay compositing verified on watermark, page numbers, crop and PDF to JPG.
- PWA: install metadata, offline fallback, and the `404.html`/`offline.html` base-path logic were verified under a nested project scope such as `/_qa-sub/repo/`.
- All 22 pages were opened at desktop width and at ~390 px: no broken images, no document-level horizontal overflow, and no console errors.
