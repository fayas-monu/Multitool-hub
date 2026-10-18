/* MULTI TOOLS HUB — offline cache. Credit: (hank!nd3 p4d4y41! | FAYAS MONU */
const V="mth-v2";
self.addEventListener("install",e=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;
  const u=new URL(r.url),same=u.origin===location.origin,lib=/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(u.host);
  if(!same&&!lib)return;                       /* never cache downloader/API calls */
  const fresh=same&&(r.mode==="navigate"||/\.(html|js|css)$/.test(u.pathname));
  e.respondWith(fresh
    ? fetch(r).then(x=>{const c=x.clone();caches.open(V).then(h=>h.put(r,c));return x}).catch(()=>caches.match(r))
    : caches.match(r).then(h=>h||fetch(r).then(x=>{if(x.ok||x.type==="opaque"){const c=x.clone();caches.open(V).then(h=>h.put(r,c))}return x})));
});
