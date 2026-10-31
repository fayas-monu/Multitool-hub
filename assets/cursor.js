/* MULTI TOOL HUB — scoped Venom web animation.
   The elastic strands exist only while the pointer is over the Hub Assistant button.
   No page-wide cursor tracking or random trail. */
(function () {
  "use strict";
  if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var SELECTOR = ".mth-fab";
  var canvas, ctx, W = 0, H = 0, dpr = 1;
  var pointer = { x: 0, y: 0 };
  var activeEl = null, strands = [], fade = 0, raf = 0;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.id = "mth-venom-cursor";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:99998;";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize, { passive: true });
  }
  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function anchors(el) {
    var r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    return [
      [r.left,r.top],[x,r.top],[r.right,r.top],[r.right,y],
      [r.right,r.bottom],[x,r.bottom],[r.left,r.bottom],[r.left,y]
    ];
  }
  function enter(el, e) {
    ensureCanvas();
    activeEl = el; pointer.x = e.clientX; pointer.y = e.clientY;
    strands = anchors(el).map(function (a) {
      return { ax:a[0], ay:a[1], x:pointer.x, y:pointer.y, vx:0, vy:0 };
    });
    if (!raf) raf = requestAnimationFrame(draw);
  }
  function move(e) {
    if (!activeEl) return;
    pointer.x = e.clientX; pointer.y = e.clientY;
  }
  function leave() { activeEl = null; }
  function draw() {
    raf = 0;
    if (!ctx) return;
    fade += ((activeEl ? 1 : 0) - fade) * 0.22;
    ctx.clearRect(0,0,W,H);
    if (activeEl && document.body.contains(activeEl)) {
      anchors(activeEl).forEach(function(a,i){ if(strands[i]){strands[i].ax=a[0];strands[i].ay=a[1];} });
    } else if (!activeEl && fade < 0.015) {
      fade = 0; strands = []; return;
    }
    if (fade > 0.005) {
      strands.forEach(function(s) {
        var dx=pointer.x-s.x, dy=pointer.y-s.y;
        s.vx=(s.vx+dx*.14)*.76; s.vy=(s.vy+dy*.14)*.76;
        s.x+=s.vx; s.y+=s.vy;
        var mx=(s.ax+s.x)/2, my=(s.ay+s.y)/2;
        var sag=Math.min(22,Math.hypot(s.x-s.ax,s.y-s.ay)*.06);
        ctx.beginPath();ctx.moveTo(s.ax,s.ay);ctx.quadraticCurveTo(mx,my+sag,s.x,s.y);
        ctx.strokeStyle="rgba(0,0,0,"+(0.42*fade)+")";ctx.lineWidth=1.25;ctx.stroke();
      });
      ctx.strokeStyle="rgba(0,0,0,"+(0.2*fade)+")";ctx.lineWidth=.85;
      for(var i=0;i<strands.length;i++){
        var a=strands[i],b=strands[(i+1)%strands.length];
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }
    }
    raf = requestAnimationFrame(draw);
  }
  function bindFab(el) {
    if (el.__mthVenomBound) return;
    el.__mthVenomBound = true;
    el.addEventListener("pointerenter", function(e){ if(e.pointerType!=="touch") enter(el,e); });
    el.addEventListener("pointermove", move, { passive:true });
    el.addEventListener("pointerleave", leave);
    el.addEventListener("pointercancel", leave);
  }
  function scan() {
    document.querySelectorAll(SELECTOR).forEach(bindFab);
  }
  function init() {
    scan();
    new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init);
  else init();
})();
