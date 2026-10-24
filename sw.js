/* MULTI TOOL HUB — offline cache & install support.
   Credit: (hank!nd3 p4d4y41! | FAYAS MONU
   Bump CACHE when you ship new files. Old caches are deleted automatically. */
const CACHE = "mth-v10";
const OFFLINE_URL = "./offline.html";

/* Everything the app needs to open and work offline. Paths are relative to the
   service-worker scope, so the site works in a sub-folder as well as at root. */
const PRECACHE = [
  "./",
  "./index.html",
  "./offline.html",
  "./404.html",
  "./terms.html",
  "./privacy.html",
  "./manifest.webmanifest",
  "./assets/style.css",
  "./assets/app.js",
  "./assets/chat.js",
  "./assets/pdf.worker.min.js",
  "./assets/logo.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/og-cover.png",
  "./tools/editor.html",
  "./tools/merge-pdf.html",
  "./tools/split-pdf.html",
  "./tools/compress-pdf.html",
  "./tools/organize-pdf.html",
  "./tools/rotate-pdf.html",
  "./tools/crop-pdf.html",
  "./tools/page-numbers.html",
  "./tools/watermark.html",
  "./tools/pdf-to-word.html",
  "./tools/pdf-to-text.html",
  "./tools/pdf-to-jpg.html",
  "./tools/jpg-to-pdf.html",
  "./tools/image-compressor.html",
  "./tools/video-to-mp3.html",
  "./tools/youtube-downloader.html",
  "./tools/instagram-downloader.html"
];

/* Third-party libraries are cached after the first successful load. API calls
   (Loader.to, YouTube thumbnails) are deliberately never cached. */
const LIB_HOSTS = /(^|\.)cdnjs\.cloudflare\.com$|(^|\.)cdn\.jsdelivr\.net$|(^|\.)fonts\.googleapis\.com$|(^|\.)fonts\.gstatic\.com$/;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* addAll fails the whole install if one file is missing, so add individually. */
    await Promise.all(PRECACHE.map(url =>
      cache.add(new Request(url, { cache: "reload" })).catch(() => null)
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.disable(); } catch (e) {}
    }
    await self.clients.claim();
  })());
});

function cachePut(request, response) {
  if (!response) return response;
  const cacheable = response.ok || response.type === "opaque";
  if (!cacheable) return response;
  const copy = response.clone();
  caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) return cachePut(request, response);
    return response;
  } catch (e) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const offline = await caches.match(OFFLINE_URL);
      /* Redirect to the real offline page so its relative CSS/logo links resolve
         correctly, even when the requested page was deep inside /tools/. */
      if (offline) return Response.redirect(new URL(OFFLINE_URL, self.registration.scope).href, 302);
      const home = await caches.match("./index.html");
      if (home) return home;
    }
    return new Response("You are offline and this file is not cached yet.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  return cachePut(request, response);
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !LIB_HOSTS.test(url.hostname)) return;

  /* Downloads and blobs are handled by the page, not the worker. */
  if (url.protocol === "blob:" || url.protocol === "data:") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  /* HTML, JS, CSS and the manifest change most often: try the network first. */
  const fresh = sameOrigin && /\.(?:html|js|css|webmanifest)$/i.test(url.pathname);
  event.respondWith(fresh ? networkFirst(request) : cacheFirst(request));
});

self.addEventListener("message", event => {
  if (event.data === "skip-waiting") self.skipWaiting();
});
