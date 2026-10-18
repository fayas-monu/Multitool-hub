# Upgrade notes — PDF EDIT TOOL

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

## Still on the old design (next batch)
compress-pdf, crop-pdf, jpg-to-pdf, editor, pdf-to-word, video-to-mp3, youtube-downloader, instagram-downloader.
They can use the same head block and assets/style.css + assets/app.js as the four new pages.
