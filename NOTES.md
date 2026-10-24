# Maintainer notes — MULTI TOOL HUB 4.0

Release date: 22 October 2026
Credit: (hank!nd3 p4d4y41! | FAYAS MONU

This file is for whoever maintains the site. The user-facing documentation is in `README.md`.

## Shipping checklist

1. Keep `sw.js` in the site root. It must be served over HTTPS (or localhost).
2. Bump `const CACHE = "mth-v9";` in `sw.js` on every release that changes HTML, CSS or JS.
   The activate handler deletes every older cache.
3. Replace `https://multitoolhub.example/` in `sitemap.xml` and `robots.txt` with the real domain.
4. Test in a private window so an old service worker does not serve stale files.
5. Verify the four PWA icons exist at the paths listed in `manifest.webmanifest`.
6. Open every page once and check DevTools → Console for errors.

## Testing locally

No build tools are required. Serve the folder with any static server, for example:

```powershell
python -m http.server 8080
```

Useful manual checks:

- Drop a real, multi-page PDF into the editor; add text and a signature; rotate one page; save; reopen the output.
- Export a text PDF to Word and open the `.docx` in Word or LibreOffice; check paragraph order, tables and page breaks.
- Export a scanned PDF to Word/Text; confirm the “no text layer” warning appears.
- Apply a watermark to a rotated page; confirm the angle and position look right.
- Compress a large PDF with both “lossless re-save” and a raster preset; compare size and legibility.
- Split/merge and confirm the page order and page count.
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
- The assistant (`assets/chat.js`) is fully local. It reads the `TOOLS` knowledge embedded in the script, not an external AI API.
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
