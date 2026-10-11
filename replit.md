# PDF EDIT TOOL

## Running on Replit

Click **Run** to start the **Start application** workflow, or run:

```sh
node server.cjs
```

The server listens on `0.0.0.0:5000`. Open Preview to use the site.
Run `npm install` after cloning or importing the project. There is no build step.
Run `npm test` to run the PDF endpoint tests.

The existing HTML/CSS/JavaScript layout is preserved. The PDF editor previews
pages in the browser and sends its text edit instructions and source PDF to the
Express API at `POST /api/pdf/edit`. The server applies text replacements,
deletions, and additions with `pdf-lib` and returns the edited PDF. Uploaded
PDFs are processed in memory and are not saved to disk. Uploads are limited to
25 MB, 500 pages, and 20 edits per minute per client IP.

The server exposes only the website's public files, not workspace configuration,
Git data, or other project files. PDF responses disable caching.

## External dependencies and known limitations

- Fonts, icons, pdf-lib, and PDF.js load from external CDNs and require internet access.
- Replacements and deletions cover the original text with a white rectangle before
  drawing replacement text. This avoids visible ghost text, but it is not secure
  redaction: the original text remains in the PDF content underneath the mask.
  Do not use this editor to permanently remove confidential content.
- The built-in Helvetica font supports a limited character set. Some Unicode
  text cannot be added or substituted.
- The AI assistant and high-quality PDF-to-Word conversion call external APIs.
  Their imported HTML includes embedded credentials. Do not publish before
  removing those credentials, rotating them with their providers, and moving
  authenticated requests to a secure backend. These API features have not been
  verified, and no replacement credentials have been configured.
- The YouTube downloader embeds a third-party service; its availability is
  outside this project's control.
- The imported Video to MP3 implementation encodes WAV audio but names it `.mp3`;
  serving the site does not resolve that existing conversion issue.

Keep the existing stack and layout unless the user requests broader changes.
