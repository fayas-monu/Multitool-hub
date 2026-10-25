# Maintainer notes — MULTI TOOL HUB 4.1

Release date: 25 October 2026
Credit: (hank!nd3 p4d4y41! | FAYAS MONU

This file is for whoever maintains the site. The user-facing documentation is in `README.md`.

## Shipping checklist

1. Keep `sw.js` in the site root. It must be served over HTTPS (or localhost).
2. Bump `const CACHE = "mth-v13";` in `sw.js` on every release that changes HTML, CSS or JS.
   The activate handler deletes every older cache.
3. Replace `https://multitoolhub.example/` in `sitemap.xml` and `robots.txt` with the real domain.
4. Test in a private window so an old service worker does not serve stale files.
5. Verify the four PWA icons exist at the paths listed in `manifest.webmanifest`.
6. Open every page once and check DevTools → Console for errors.
7. If the optional Gemini proxy is used, deploy `server/` over HTTPS and set `GEMINI_API_KEY` in its environment — never in client code.

## Testing locally

No build tools are required. Serve the folder with any static server, for example:

```powershell
python -m http.server 8080
```

Useful manual checks:

- View every page at 390 px wide and confirm `document.documentElement.scrollWidth` is not wider than the viewport. The home category rail scrolls horizontally by design; that is not page overflow.
- Toggle light and dark on the home page, a complex tool (editor/crop) and a legal page. All visible text should stay readable in both themes. Check with transitions disabled if testing a background tab, because Chrome freezes transitions there and reports the old colours.
- Search `pdf to word`, `photo to pdf`, `compress image`, `sign`, `scan` and a typo such as `compres pdf`; confirm the intended tool appears and `word to pdf` correctly shows the no-results state.
- Drop a real, multi-page PDF into the editor; add text and a signature; set X/Y/W/H, font size and line spacing numerically; rotate one page; undo/redo; save the current page and all pages; reopen the output.
- Crop a multi-page PDF with each of the eight handles, then with numeric %/mm insets; test 1:1, auto-trim, page ranges and download.
- Expand the preview on watermark, page numbers, crop, PDF to JPG and image compressor. The enlarged canvas must keep its aspect ratio and include the overlay layer.
- Export a text PDF to Word and open the `.docx` in Word or LibreOffice; check paragraph order, tables and page breaks.
- Export a scanned PDF to Word/Text; confirm the “no text layer” warning appears.
- Apply a watermark to a rotated page; confirm the angle and position look right.
- Compress a large PDF with both “lossless re-save” and a raster preset; compare size and legibility.
- Split/merge and confirm the page order and page count.
- Check Video to MP3 with a real video/audio file, including trim, fades and the WAV fallback.
- In the assistant: open, send a message, press browser back (it should close the panel, not leave the page), refresh (it should reset in place), clear/reset, and try an invalid Gemini endpoint (readable error, local mode still works).
- Install the PWA, go offline, and reopen a previously visited tool.

## Architecture notes

- Every tool is a standalone HTML file. Shared behaviour comes from `assets/style.css` and `assets/app.js`.
- `PE.openPdf(file)` is async and handles File, Blob and ArrayBuffer inputs. It returns a pdf.js document.
- `PE.preview` renders display-oriented pages (page rotation is respected); canvas internal size is `vp.width * devicePixelRatio`.
- Editor page state is `{uid, s, p, rot, blank, w?, h?}` where `s` is the source index. pdf-lib is loaded lazily only when saving.
- For rotated-page exports, text angle = page rotation + desired display counter-clockwise angle; convert display points with `viewport.convertToPdfPoint`.
- The editor's “edit existing text” feature covers old glyphs; it is **not** redaction. Use the editor's Redact tool (a solid box that is flattened on save) when content must actually be removed. The cover colour is sampled from the rendered page around the text, so tinted or off-white pages do not get white patches.
- Editor text boxes store `w` (wrap width, `0` = auto), `align` (`l/c/r`), `lh` (line spacing), `italic`, `dash` and `bg` (text background). Wrapping, alignment and baseline math are shared between the live editor and the pdf-lib export, so what you see is what is written.
- Editor fonts use one registry (`FONTS`). Arial and Courier New map to the metric-compatible Helvetica/Courier PDF standard fonts and stay selectable; other common families, and any characters outside WinAnsi, are drawn to a high-resolution canvas and embedded as an image so they render faithfully.
- Shape strokes support solid, dashed and dotted styles in the editor and in the export (`borderDashArray` / `dashArray`).
- Watermark and page-number placement use relative page fractions so they survive different page sizes and rotations.
- The assistant (`assets/chat.js`) is local by default. Its answers come from the `TOOLS` knowledge and rule tables embedded in the script. Optional Gemini replies go through a same-deployment proxy (`server/server.js`); the browser stores only the endpoint, never an API key. Local mode remains available if the proxy fails.
- Search on the home page uses `SEARCH_STOP`, `SEARCH_PLURALS`, `searchTerms`, `fuzzyWord`, `directionOf`, `scoreTool` and `fuzzyScore`. It scores word-level strong fields (name, aliases, formats), requires maximum coverage, narrows on exact names, then falls back to fuzzy matching. `FMT`/`FORMATS` enforce conversion direction: `pdf to word` matches PDF→Word, while `word to pdf` has no matching tool and must show the empty state.
- `PE.openPreview` composites stacked canvases through `alignedLayers`/`compositeLayers`; this is why watermark, page-number and crop overlays appear in the expanded modal and not just the small preview.
- Global preview CSS keeps `max-width:100%`, removes max-height clamping and sets `height:auto` so every canvas keeps its intrinsic aspect ratio. Do not re-add a global max-height.
- The crop tool uses eight independent handles plus numeric insets. Insets are stored as percentages of the page and converted to points on export; changing one edge must not move the opposite edge.
- Editor geometry is numeric (`X`, `Y`, `W`, `H`, font size, line spacing, opacity). Keep the property panel authoritative; drag handles are shortcuts, not the only way to set a value.
- Theme switching is intentionally instant (`body` has `transition:none`). A fading body background briefly pairs new light text with the old light surface, which reads as a contrast glitch in dark mode.
- When a navigation is not cached, `sw.js` redirects to `offline.html` instead of returning it at the requested URL, so the page's relative CSS, logo and links resolve correctly from any folder depth.
- The Image Compressor keeps the original file when a "keep format, no resize" re-encode would be larger, so it never hands back a bigger file.
- Downloader tooling deliberately keeps the Loader.to iframe/API. Do not remove it; it is disclosed in the UI, Privacy Policy and Terms.

## Known limits (intentional)

- No PDF encryption/protection: pdf-lib cannot write encrypted PDFs.
- No OCR: scanned PDFs require an OCR engine, which would add a large dependency.
- Editor text is limited to the bundled font registry; exotic or licensed typefaces are not loaded. Fonts without a PDF-standard metric equivalent export as high-resolution images (visually exact, not selectable).
- Very large PDFs are limited by device RAM/canvas size; tools report failures instead of writing corrupt files.
- MP3 encoding needs a browser that can decode the source audio codec; WAV is offered as a fallback.

## Historical fixes (do not regress)

- Removed the hard-coded ConvertAPI secret from PDF to Word; conversion is now browser-only.
- Fixed WAV data being downloaded with an `.mp3` name; real MP3 via lamejs is used.
- Fixed JPG-to-PDF triggering dozens of automatic downloads; output is one PDF.
- Fixed `PE.openPdf(File)` reading empty bytes for File inputs.
- Fixed merge inserting filenames with `innerHTML` (injection risk).
- Fixed the old chatbot's substring matching (`includes("ad")` matched “download”).
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
- Added (v10): the official SVG logo is inlined in every header so `currentColor` follows the theme (`--text-color` is bound to `--ink`). `assets/logo.svg` remains the file used for favicon, manifest and social images.
- Removed (v10): duplicate `tools/chat.js` and stray `assets/n`.
- India/UAE legal sections are now Terms section 23 and Privacy section 22. They are templates, not legal advice; have counsel review before commercial use.

## 4.1 release notes

- Added an optional Gemini connection through `server/server.js`. The key stays server-side; auth, origin allow-list, rate limits, timeouts and security headers are in the proxy. The local assistant remains the default.
- Added an expandable preview modal with canvas compositing, so watermark, page-number and crop overlays appear in the enlarged view.
- Added eight-handle PDF cropping with numeric insets, aspect presets, auto-trim and multi-page output.
- Added numeric editor geometry and focus mode; removed drag-only sizing as the sole path.
- Reworked home search for direction-aware conversions, plurals, stopwords, typo tolerance and exact-name narrowing.
- Refined both themes, added mobile-first header/drawer behaviour, and fixed mobile overflow from the category rail's intrinsic width.
- Removed the body background transition so theme changes never flash light text on a light surface.
- Fixed PDF to JPG staying on “Reading the PDF…” after a successful preview.
- Made the editor header actions icon-only below 560 px so the theme toggle cannot collapse.
- Removed the stale, unreferenced `tools/chat.js`.
- Bumped the service worker cache to `mth-v13`.

## QA summary (4.1)

- Search: `sign`, `shrink`, `pdf to word`, `combine`, `scan`, `image`, `instagram`, `watermark`, `compress pdf`, `jpg`, `pdf to text`, `edit a pdf`, `compress image`, `photo to pdf`, `compres pdf` (typo); direction checks for `pdf to jpg`, `pdf to image`, `scan to pdf`, `video to mp3`; `word to pdf` correctly returns no results.
- Index: 17 tools, category filtering, favourites, recents, drawer open/select/close, Escape, keyboard shortcuts, zero console errors.
- Themes: 152 visible text nodes on the home page and all representative tool pages pass WCAG AA contrast in both themes once transitions settle; Lighthouse accessibility 100.
- Crop: file load, eight independent handles, numeric %/mm insets, 1:1, auto-trim, page ranges, 3-page export.
- Editor: 3-page open, text annotation, numeric X/Y/W/H and font/spacing/opacity, focus mode, undo/redo, page navigation, save dialog validation, all-page and current-page export, baked-in annotation.
- Previews: compress, page numbers, watermark and JPG-to-PDF keep their aspect ratios; expanded modal fits the viewport and closes with Escape; overlay drift is zero.
- Generations: 6-page merge, 2-page JPG-to-PDF, valid 7.5 KB `.docx`, compress correctly reports when a tiny PDF grows, and no unintended auto-download.
- Remaining pages: rotate, split, organize, PDF to JPG, PDF to text, image compressor, video to MP3, YouTube and Instagram load with no console errors; PDF pages render at 3/3 and previews stay proportional; Video to MP3 produced a valid 1-second MP3 from a synthetic WAV; URL validation shows readable errors.
- Mobile: all 21 pages checked at 390 px — no horizontal page overflow; editor and crop load a PDF, keep the canvas proportional and fit the toolbar; assistant panel fits the viewport and answers a local query.
