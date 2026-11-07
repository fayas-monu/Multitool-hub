/* ==========================================================================
   MULTI TOOL HUB — service worker
   Caches the static app shell, vendored engines and every tool page so the
   local tools keep working without a connection. Your files are never cached:
   they live in memory inside the page and are not fetched by this worker.
   ========================================================================== */
"use strict";

var VERSION = "mth-v5.0.0";
var SHELL_CACHE = VERSION + "-shell";
var RUNTIME_CACHE = VERSION + "-runtime";

var SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./404.html",
  "./manifest.webmanifest",

  "./assets/css/tokens.css",
  "./assets/css/base.css",
  "./assets/css/home.css",
  "./assets/css/tool.css",
  "./assets/css/legal.css",

  "./assets/js/core.js",
  "./assets/js/registry.js",
  "./assets/js/pages/home.js",
  "./assets/js/tools/shared.js",

  "./assets/logo-mark.svg",
  "./assets/og-cover.png",
  "./assets/icons/favicon-64.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/apple-touch-icon.png",

  "./legal/terms.html",
  "./legal/privacy.html"
];

var TOOL_PAGES = [
  "background-remove",
  "compress",
  "crop",
  "focus-studio",
  "image-compress",
  "image-convert",
  "images-to-pdf",
  "instagram-downloader",
  "merge",
  "organize",
  "page-numbers",
  "pdf-to-excel",
  "pdf-to-images",
  "pdf-to-text",
  "pdf-to-word",
  "rotate",
  "split",
  "unlock",
  "video-compress",
  "video-to-audio",
  "viewer",
  "watermark",
  "youtube-downloader"
];

var TOOL_SCRIPTS = TOOL_PAGES.map(function (id) {
  return "./assets/js/tools/" + id + ".js";
});

SHELL = SHELL.concat(
  TOOL_PAGES.map(function (id) { return "./tools/" + id + ".html"; }),
  TOOL_SCRIPTS
);

/* Vendored engines are large. They are cached on first use instead of during
   install so the very first visit is not punished, then served cache-first. */
var VENDOR = [
  "./assets/vendor/pdfjs/pdf.min.js",
  "./assets/vendor/pdfjs/pdf.worker.min.js",
  "./assets/vendor/pdf-lib.min.js",
  "./assets/vendor/jszip.min.js",
  "./assets/vendor/docx.umd.js",
  "./assets/vendor/xlsx.full.min.js",
  "./assets/vendor/lame.min.js"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(SHELL).catch(function (error) {
        console.warn("[MTH] Shell precache incomplete", error);
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== SHELL_CACHE && key !== RUNTIME_CACHE) return caches.delete(key);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isSameOrigin(url) {
  try { return new URL(url, self.location.href).origin === self.location.origin; }
  catch (e) { return false; }
}

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (response) {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      });
    });
  });
}

function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (hit) {
      var network = fetch(request).then(function (response) {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      }).catch(function () { return hit; });
      return hit || network;
    });
  });
}

function networkFirstNavigation(request) {
  return fetch(request).then(function (response) {
    if (response && response.ok) {
      var copy = response.clone();
      caches.open(RUNTIME_CACHE).then(function (cache) { cache.put(request, copy); });
    }
    return response;
  }).catch(function () {
    return caches.match(request).then(function (hit) {
      if (hit) return hit;
      return caches.match("./offline.html").then(function (offline) {
        return offline || new Response(
          "<!doctype html><meta charset=\"utf-8\"><title>Offline</title>" +
          "<h1>You are offline</h1><p>Reconnect once so MULTI TOOL HUB can cache its app shell.</p>",
          { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      });
    });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url;
  try { url = new URL(request.url); } catch (e) { return; }

  /* Third-party requests (YouTube thumbnails, Loader.to) are never cached or
     intercepted. Only same-origin static files are handled here. */
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (/\/assets\/vendor\//.test(url.pathname)) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  if (/\.(css|js|svg|png|jpe?g|webp|woff2?|ttf|webmanifest)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

self.addEventListener("message", function (event) {
  var data = event.data || {};
  if (data.type === "SKIP_WAITING") self.skipWaiting();
});
