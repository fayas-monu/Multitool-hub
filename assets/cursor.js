/* MULTI TOOL HUB — Venom web cursor engine.
   Draws an elastic black web mesh that extends from a hovered interactive
   element toward the pointer. Idle elsewhere on the page: no trail, no
   random mouse-chasing. Skips touch devices and prefers-reduced-motion.
   Developed by chank!nd3 p4d4y41! l FAYAS MONU */
(function () {
  "use strict";

  if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var SELECTOR =
    'a, button, .btn, .card, .tool-card, [role="button"], input[type="submit"], ' +
    '.icobtn, .chip, .nav a, label.upload, .drop, select, .logo-container';

  var canvas, ctx, W = 0, H = 0, dpr = 1;
  var mouse = { x: -999, y: -999, tx: -999, ty: -999 };
  var activeEl = null;
  var strands = [];
  var fade = 0; // 0..1 intensity, eases in on hover / out on leave

  function build() {
    canvas = document.createElement("canvas");
    canvas.id = "mth-venom-cursor";
    canvas.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:99998;";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    requestAnimationFrame(step);
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function anchorsFor(el) {
    var r = el.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    return [
      { x: r.left, y: r.top }, { x: r.right, y: r.top },
      { x: r.left, y: r.bottom }, { x: r.right, y: r.bottom },
      { x: cx, y: r.top }, { x: cx, y: r.bottom },
      { x: r.left, y: cy }, { x: r.right, y: cy }
    ];
  }

  function spawn(el) {
    strands = anchorsFor(el).map(function (a) {
      return { ax: a.x, ay: a.y, x: mouse.tx, y: mouse.ty, vx: 0, vy: 0 };
    });
  }

  function onMove(e) {
    mouse.tx = e.clientX;
    mouse.ty = e.clientY;
    var el = e.target && e.target.closest ? e.target.closest(SELECTOR) : null;
    if (el !== activeEl) {
      activeEl = el;
      if (el) spawn(el);
    }
  }

  function onLeave() {
    activeEl = null;
  }

  function step() {
    mouse.x += (mouse.tx - mouse.x) * 0.3;
    mouse.y += (mouse.ty - mouse.y) * 0.3;

    var targetFade = activeEl ? 1 : 0;
    fade += (targetFade - fade) * 0.18;

    ctx.clearRect(0, 0, W, H);

    if (fade > 0.01 && strands.length) {
      if (activeEl && document.body.contains(activeEl)) {
        var fresh = anchorsFor(activeEl);
        strands.forEach(function (s, i) {
          if (fresh[i]) { s.ax = fresh[i].x; s.ay = fresh[i].y; }
        });
      }

      strands.forEach(function (s) {
        var dx = mouse.x - s.x, dy = mouse.y - s.y;
        var k = 0.12, damp = 0.78;
        s.vx = (s.vx + dx * k) * damp;
        s.vy = (s.vy + dy * k) * damp;
        s.x += s.vx;
        s.y += s.vy;

        var midx = (s.ax + s.x) / 2;
        var midy = (s.ay + s.y) / 2;
        var sag = Math.min(26, Math.hypot(s.x - s.ax, s.y - s.ay) * 0.08);

        ctx.beginPath();
        ctx.moveTo(s.ax, s.ay);
        ctx.quadraticCurveTo(midx, midy + sag, s.x, s.y);
        ctx.strokeStyle = "rgba(0,0,0," + (0.38 * fade).toFixed(3) + ")";
        ctx.lineWidth = 1.1;
        ctx.stroke();
      });

      // cross-links between adjacent strand tips for a mesh feel
      ctx.strokeStyle = "rgba(0,0,0," + (0.18 * fade).toFixed(3) + ")";
      ctx.lineWidth = 0.8;
      for (var i = 0; i < strands.length; i++) {
        var a = strands[i], b = strands[(i + 1) % strands.length];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0," + (0.55 * fade).toFixed(3) + ")";
      ctx.fill();
    }

    requestAnimationFrame(step);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
