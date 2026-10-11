# PDF EDIT TOOL

## Running on Replit

Click **Run** to start the **Start application** workflow, or run:

```sh
node server.cjs
```

The server listens on `0.0.0.0:5000`. Open Preview to use the site.
No npm packages or build step are required. The imported HTML/CSS/JavaScript
structure and existing browser-side features are preserved.

The server exposes only the website's public files, not workspace configuration,
Git data, or other project files. Responses disable caching during development.

## External dependencies and known limitations

- Fonts, icons, pdf-lib, and PDF.js load from external CDNs and require internet access.
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
