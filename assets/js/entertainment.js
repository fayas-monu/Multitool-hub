/* ==========================================================================
   MULTI TOOL HUB v6 — After Hours
   Ambient Studio (Web Audio), Chromatic Lab (Canvas), Breathing Room.
   Everything runs locally. No network calls, no accounts, no tracking.
   ========================================================================== */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function store(key, val) { return MTH.store.get("afterhours." + key, val); }
  function save(key, val) { MTH.store.set("afterhours." + key, val); }

  /* ======================================================================
     AMBIENT STUDIO
     ====================================================================== */
  function AmbientStudio() {
    var root = $("#ambient");
    if (!root) return;
    var els = {
      canvas: $("[data-ambient-canvas]", root),
      core: $("[data-ambient-core]", root),
      name: $("[data-ambient-name]", root),
      sub: $("[data-ambient-sub]", root),
      stateLabel: $("[data-ambient-state-label]", root),
      status: $("[data-ambient-status]", root),
      volume: $("[data-ambient-volume]", root),
      volumeVal: $("[data-ambient-volume-val]", root),
      fade: $("[data-ambient-fade]", root),
      countdown: $("[data-ambient-countdown]", root),
      toggle: $("[data-ambient-toggle]", root),
      stop: $("[data-ambient-stop]", root),
      presets: $$("[data-preset]", root)
    };
    var PRESETS = {
      focus: { name: "Deep Focus", sub: "Brown noise · warm pad · 55 Hz", core: "Focus", hue: [30, 50] },
      rain: { name: "Rain", sub: "Filtered rain · soft droplets", core: "Rain", hue: [195, 215] },
      ocean: { name: "Ocean", sub: "Slow swells · low surf", core: "Ocean", hue: [200, 225] },
      forest: { name: "Forest", sub: "Leaves · distant birds", core: "Forest", hue: [95, 140] },
      night: { name: "Night", sub: "Low air · distant crickets", core: "Night", hue: [230, 260] }
    };
    var state = {
      ctx: null, master: null, analyser: null, graph: null, timers: [],
      playing: false, preset: store("ambientPreset", "focus"),
      volume: store("ambientVolume", 62), fadeMinutes: store("ambientFade", 30),
      fadeEnd: 0, fadeTimer: null, viz: null, noise: null,
      startedAt: 0
    };

    function ensureContext() {
      if (state.ctx) {
        if (state.ctx.state === "suspended") state.ctx.resume().catch(function () {});
        return state.ctx;
      }
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) {
        setStatus("This browser does not expose the Web Audio API. Try a current Chrome, Edge, Firefox or Safari release.", "err");
        return null;
      }
      try {
        state.ctx = new C();
        state.master = state.ctx.createGain();
        state.master.gain.value = 0;
        state.analyser = state.ctx.createAnalyser();
        state.analyser.fftSize = 256;
        state.analyser.smoothingTimeConstant = .82;
        state.master.connect(state.analyser);
        state.analyser.connect(state.ctx.destination);
        if (state.ctx.state === "suspended") state.ctx.resume().catch(function () {});
      } catch (e) {
        setStatus("Audio could not start on this device. Check the browser's sound permissions and try again.", "err");
        return null;
      }
      return state.ctx;
    }

    function noiseBuffer() {
      if (state.noise) return state.noise;
      var ctx = state.ctx;
      var len = Math.max(1, Math.floor(ctx.sampleRate * 3));
      var buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) {
        var data = buf.getChannelData(c);
        for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      state.noise = buf;
      return buf;
    }

    function sourceNoise(filterType, freq, q, gainVal, detune) {
      var ctx = state.ctx;
      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer();
      src.loop = true;
      var filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      if (q != null) filter.Q.value = q;
      var gain = ctx.createGain();
      gain.gain.value = gainVal;
      src.connect(filter); filter.connect(gain); gain.connect(state.master);
      src.start();
      var nodes = [src, filter, gain];
      if (detune) {
        var lfo = ctx.createOscillator();
        var lfoGain = ctx.createGain();
        lfo.frequency.value = detune.rate || .08;
        lfoGain.gain.value = detune.amount || 200;
        lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
        lfo.start();
        nodes.push(lfo, lfoGain);
      }
      return { nodes: nodes, gain: gain, filter: filter };
    }

    function tone(freq, gainVal, type, destination) {
      var ctx = state.ctx;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || "sine";
      osc.frequency.value = freq;
      gain.gain.value = gainVal;
      osc.connect(gain);
      gain.connect(destination || state.master);
      osc.start();
      return { osc: osc, gain: gain, nodes: [osc, gain] };
    }

    function buildGraph(preset) {
      stopGraph(false);
      var ctx = ensureContext();
      if (!ctx) return;
      var parts = [];
      if (preset === "rain") {
        parts.push(sourceNoise("highpass", 900, .5, .22));
        parts.push(sourceNoise("lowpass", 6500, .4, .18));
        var drops = setInterval(function () {
          if (!state.playing) return;
          var now = state.ctx.currentTime;
          var osc = state.ctx.createOscillator();
          var g = state.ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(1400 + Math.random() * 2200, now);
          osc.frequency.exponentialRampToValueAtTime(700, now + .18);
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(.012 + Math.random() * .018, now + .01);
          g.gain.exponentialRampToValueAtTime(.0001, now + .22);
          osc.connect(g); g.connect(state.master);
          osc.start(now); osc.stop(now + .25);
        }, 420);
        state.timers.push(drops);
      } else if (preset === "ocean") {
        parts.push(sourceNoise("lowpass", 420, .6, .26, { rate: .075, amount: 160 }));
        parts.push(sourceNoise("bandpass", 800, .4, .07, { rate: .05, amount: 300 }));
        var swell = state.ctx.createOscillator();
        var swellGain = state.ctx.createGain();
        swell.frequency.value = .07;
        swellGain.gain.value = .09;
        swell.connect(swellGain);
        swellGain.connect(state.master.gain);
        swell.start();
        parts.push({ nodes: [swell, swellGain] });
      } else if (preset === "forest") {
        parts.push(sourceNoise("bandpass", 1200, .5, .12));
        parts.push(sourceNoise("lowpass", 900, .4, .08));
        var birds = setInterval(function () {
          if (!state.playing) return;
          var now = state.ctx.currentTime;
          var base = 1800 + Math.random() * 1600;
          var osc = state.ctx.createOscillator();
          var g = state.ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(base, now);
          osc.frequency.exponentialRampToValueAtTime(base * 1.5, now + .06);
          osc.frequency.exponentialRampToValueAtTime(base * 1.1, now + .18);
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(.012, now + .02);
          g.gain.exponentialRampToValueAtTime(.0001, now + .28);
          osc.connect(g); g.connect(state.master);
          osc.start(now); osc.stop(now + .3);
        }, 2800);
        state.timers.push(birds);
      } else if (preset === "night") {
        parts.push(sourceNoise("lowpass", 500, .5, .16));
        parts.push(sourceNoise("highpass", 2400, .4, .025));
        var crickets = setInterval(function () {
          if (!state.playing) return;
          var now = state.ctx.currentTime;
          for (var k = 0; k < 3; k++) {
            var osc = state.ctx.createOscillator();
            var g = state.ctx.createGain();
            osc.type = "square";
            osc.frequency.value = 3400 + Math.random() * 500;
            var at = now + k * .09;
            g.gain.setValueAtTime(0, at);
            g.gain.linearRampToValueAtTime(.006, at + .012);
            g.gain.exponentialRampToValueAtTime(.0001, at + .06);
            osc.connect(g); g.connect(state.master);
            osc.start(at); osc.stop(at + .08);
          }
        }, 1700);
        state.timers.push(crickets);
      } else {
        parts.push(sourceNoise("lowpass", 380, .7, .24));
        parts.push(sourceNoise("bandpass", 900, .6, .04));
        parts.push(tone(55, .035, "sine"));
        parts.push(tone(82.5, .022, "sine"));
        parts.push(tone(110, .012, "sine"));
        var drift = state.ctx.createOscillator();
        var driftGain = state.ctx.createGain();
        drift.frequency.value = .03;
        driftGain.gain.value = 12;
        drift.connect(driftGain);
        parts.push({ nodes: [drift, driftGain], connectTo: null });
        drift.start();
      }
      state.graph = parts;
      state.playing = true;
      state.startedAt = Date.now();
      paintPreset(preset);
      setStatus("Playing " + PRESETS[preset].name + " · synthesised locally.", "on");
      state.master.gain.cancelScheduledValues(state.ctx.currentTime);
      state.master.gain.setValueAtTime(0, state.ctx.currentTime);
      state.master.gain.linearRampToValueAtTime(volumeGain(), state.ctx.currentTime + 1.2);
      startVisualizer();
      startFadeTimer();
      updateToggle();
      save("ambientPreset", preset);
      root.dispatchEvent(new CustomEvent("mth:ambient-start"));
    }

    function stopGraph(silent) {
      clearTimers();
      if (state.graph && state.ctx) {
        var now = state.ctx.currentTime;
        try {
          state.master.gain.cancelScheduledValues(now);
          state.master.gain.setValueAtTime(state.master.gain.value || 0, now);
          state.master.gain.linearRampToValueAtTime(0, now + (silent ? .08 : .7));
        } catch (e) {}
        var old = state.graph;
        setTimeout(function () {
          old.forEach(function (part) {
            if (!part || !part.nodes) return;
            part.nodes.forEach(function (node) {
              try { if (node.stop) node.stop(); } catch (e) {}
              try { node.disconnect(); } catch (e) {}
            });
          });
        }, silent ? 100 : 780);
      }
      state.graph = null;
      state.playing = false;
      updateToggle();
      if (!silent) setStatus("Stopped. Your device is quiet again.", "on");
    }

    function clearTimers() {
      state.timers.forEach(function (t) { clearInterval(t); });
      state.timers = [];
    }

    function volumeGain() {
      var v = clamp(Number(els.volume.value) || 0, 0, 100) / 100;
      return v * v * .9;
    }

    function paintPreset(key) {
      var p = PRESETS[key] || PRESETS.focus;
      state.preset = key;
      els.name.textContent = p.name;
      els.sub.textContent = p.sub;
      els.core.textContent = p.core;
      els.stateLabel.textContent = state.playing ? "Live · " + p.name : "Idle · press play";
      els.presets.forEach(function (b) { b.classList.toggle("on", b.dataset.preset === key); });
      var hue = p.hue[0];
      var visual = root.querySelector(".ambient-visual");
      if (visual) visual.style.background = "radial-gradient(90% 130% at 24% 8%, hsl(" + hue + " 52% 24%), #06172c 72%)";
      paintVisualizer();
      save("ambientPreset", key);
    }

    function setStatus(message, kind) {
      if (!els.status) return;
      els.status.textContent = message;
      els.status.classList.toggle("on", kind === "on");
      els.status.style.color = kind === "err" ? "var(--err)" : "";
    }

    function updateToggle() {
      if (!els.toggle) return;
      els.toggle.innerHTML = MTH.ui.icon(state.playing ? "pause" : "play", "", 14) + (state.playing ? " Pause" : " Play");
      els.toggle.setAttribute("aria-pressed", state.playing ? "true" : "false");
      els.toggle.classList.toggle("btn--ghost", state.playing);
      root.classList.toggle("is-playing", state.playing);
      els.core.classList.toggle("is-live", state.playing);
    }

    function startFadeTimer() {
      stopFadeTimer(false);
      var mins = clamp(Number(els.fade.value) || 0, 0, 180);
      state.fadeMinutes = mins;
      save("ambientFade", mins);
      if (!mins) {
        els.countdown.textContent = "Off";
        return;
      }
      state.fadeEnd = Date.now() + mins * 60000;
      paintCountdown();
      state.fadeTimer = setInterval(paintCountdown, 500);
    }
    function stopFadeTimer(resetText) {
      if (state.fadeTimer) { clearInterval(state.fadeTimer); state.fadeTimer = null; }
      state.fadeEnd = 0;
      if (resetText && state.fadeMinutes) paintCountdown();
    }
    function paintCountdown() {
      if (!state.fadeEnd) {
        var mins = clamp(Number(els.fade.value) || 0, 0, 180);
        els.countdown.textContent = mins ? pad(mins) + ":00" : "Off";
        return;
      }
      var left = Math.max(0, state.fadeEnd - Date.now());
      var s = Math.ceil(left / 1000);
      els.countdown.textContent = pad(Math.floor(s / 60)) + ":" + pad(s % 60);
      if (left <= 0) {
        stopFadeTimer(false);
        if (state.playing) {
          setStatus("Fade-out complete. The soundscape has stopped.", "on");
          MTH.toast("Ambient fade-out complete", "info", 3200);
          stopGraph(false);
        }
      }
    }

    /* canvas visualiser */
    function sizeCanvas() {
      var c = els.canvas;
      if (!c) return;
      var r = c.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
    }
    function paintVisualizer() {
      var c = els.canvas;
      if (!c) return;
      var ctx = c.getContext("2d");
      if (!ctx) return;
      var w = c.width, h = c.height;
      ctx.clearRect(0, 0, w, h);
      var preset = PRESETS[state.preset] || PRESETS.focus;
      var hue = preset.hue[0];
      if (!state.analyser || !state.playing) {
        // idle: a slow, quiet contour so the panel never looks dead
        ctx.strokeStyle = "hsla(" + hue + ", 80%, 72%, .16)";
        ctx.lineWidth = Math.max(1, w / 700);
        for (var line = 0; line < 4; line++) {
          ctx.beginPath();
          var base = h * (.42 + line * .09);
          for (var x = 0; x <= w; x += Math.max(2, w / 220)) {
            var y = base + Math.sin((x / w) * Math.PI * (2.1 + line * .4) + line) * (h * .018) * (1 + line * .4);
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        return;
      }
      var data = new Uint8Array(state.analyser.frequencyBinCount);
      state.analyser.getByteFrequencyData(data);
      var avg = 0;
      for (var i = 0; i < data.length; i++) avg += data[i];
      avg = avg / Math.max(1, data.length);
      var bars = 56;
      var bw = w / bars;
      for (var b = 0; b < bars; b++) {
        var idx = Math.floor((b / bars) * data.length * .72);
        var v = data[idx] / 255;
        var bh = Math.max(h * .018, v * h * .5 * (1 + Math.sin(b * .7 + Date.now() / 900) * .04));
        var alpha = .10 + v * .38;
        ctx.fillStyle = "hsla(" + (hue + b * .6) + ", 78%, " + (56 + v * 18) + "%, " + alpha + ")";
        ctx.fillRect(b * bw + bw * .18, h * .52 - bh * .5, bw * .64, bh);
      }
      ctx.strokeStyle = "hsla(" + hue + ", 85%, 75%, " + (.18 + avg / 500) + ")";
      ctx.lineWidth = Math.max(1, w / 520);
      ctx.beginPath();
      for (var p = 0; p < data.length; p += 2) {
        var x = (p / data.length) * w;
        var amp = (data[p] / 255) * h * .18;
        var y = h * .76 + Math.sin(p * .19 + Date.now() / 700) * amp;
        if (p === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    function startVisualizer() {
      if (state.viz) return;
      var loop = function () {
        paintVisualizer();
        state.viz = requestAnimationFrame(loop);
      };
      state.viz = requestAnimationFrame(loop);
    }
    function stopVisualizer() {
      if (state.viz) { cancelAnimationFrame(state.viz); state.viz = null; }
      paintVisualizer();
    }

    /* events */
    els.presets.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var preset = btn.dataset.preset;
        if (!PRESETS[preset]) return;
        if (state.playing) buildGraph(preset);
        else { paintPreset(preset); setStatus("Ready: " + PRESETS[preset].name + ". Press play when you want sound.", "on"); }
      });
    });
    els.volume.addEventListener("input", function () {
      els.volumeVal.textContent = els.volume.value + "%";
      save("ambientVolume", Number(els.volume.value));
      if (state.master && state.ctx && state.playing) {
        state.master.gain.cancelScheduledValues(state.ctx.currentTime);
        state.master.gain.setVarvalue;
        try { state.master.gain.setTargetAtTime(volumeGain(), state.ctx.currentTime, .12); } catch (e) {}
      }
    });
    els.fade.addEventListener("change", function () {
      var v = clamp(Number(els.fade.value) || 0, 0, 180);
      els.fade.value = v;
      if (state.playing) startFadeTimer(); else { state.fadeMinutes = v; save("ambientFade", v); paintCountdown(); }
    });
    els.toggle.addEventListener("click", function () {
      if (state.playing) {
        stopGraph(false);
        stopFadeTimer(false);
        stopVisualizer();
        els.stateLabel.textContent = "Paused";
      } else {
        buildGraph(state.preset);
      }
    });
    els.stop.addEventListener("click", function () {
      stopGraph();
      stopFadeTimer(true);
      stopVisualizer();
      els.stateLabel.textContent = "Idle · press play";
    });
    window.addEventListener("resize", MTH.debounce(function () { sizeCanvas(); paintVisualizer(); }, 180));
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      sizeCanvas();
      paintVisualizer();
    });
    window.addEventListener("beforeunload", function () {
      if (state.ctx) { try { state.ctx.close(); } catch (e) {} }
    });

    /* restore */
    els.volume.value = state.volume;
    els.volumeVal.textContent = state.volume + "%";
    els.fade.value = state.fadeMinutes;
    state.fadeMinutes = state.fadeMinutes;
    paintCountdown();
    paintPreset(state.preset || "focus");
    sizeCanvas();
    updateToggle();
    setStatus("Audio begins only after you press play.");
  }

  /* ======================================================================
     CHROMATIC LAB
     ====================================================================== */
  function ChromaticLab() {
    var root = $("#chromatic");
    if (!root) return;
    var els = {
      swatches: $("[data-chroma-swatches]", root),
      gradient: $("[data-chroma-gradient]", root),
      code: $("[data-chroma-code]", root),
      seed: $("[data-chroma-seed]", root),
      hex: $("[data-chroma-hex]", root),
      harmony: $("[data-chroma-harmony]", root),
      angle: $("[data-chroma-angle]", root),
      angleVal: $("[data-chroma-angle-val]", root),
      copy: $("[data-chroma-copy]", root),
      png: $("[data-chroma-png]", root),
      saveBtn: $("[data-chroma-save]", root),
      saved: $("[data-chroma-saved]", root)
    };
    var state = {
      seed: store("chromaSeed", "#1e63c4"),
      harmony: store("chromaHarmony", "mono"),
      angle: store("chromaAngle", 118),
      colors: []
    };

    function normalizeHex(value) {
      var v = String(value || "").trim().replace(/^#/, "");
      if (/^[0-9a-f]{3}$/i.test(v)) v = v.split("").map(function (c) { return c + c; }).join("");
      if (!/^[0-9a-f]{6}$/i.test(v)) return null;
      return "#" + v.toLowerCase();
    }
    function hexToRgb(hex) {
      var v = normalizeHex(hex) || "#1e63c4";
      return { r: parseInt(v.slice(1, 3), 16), g: parseInt(v.slice(3, 5), 16), b: parseInt(v.slice(5, 7), 16) };
    }
    function rgbToHex(r, g, b) {
      function h(n) { var s = clamp(Math.round(n), 0, 255).toString(16); return s.length === 1 ? "0" + s : s; }
      return "#" + h(r) + h(g) + h(b);
    }
    function rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var h = 0, s = 0, l = (max + min) / 2;
      if (max !== min) {
        var d = max - min;
        s = l > .5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
      }
      return { h: h, s: s, l: l };
    }
    function hslToRgb(h, s, l) {
      h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
      var c = (1 - Math.abs(2 * l - 1)) * s;
      var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      var m = l - c / 2;
      var r = 0, g = 0, b = 0;
      if (h < 60) { r = c; g = x; }
      else if (h < 120) { r = x; g = c; }
      else if (h < 180) { g = c; b = x; }
      else if (h < 240) { g = x; b = c; }
      else if (h < 300) { r = x; b = c; }
      else { r = c; b = x; }
      return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
    }
    function hslHex(h, s, l) {
      var c = hslToRgb(h, s, l);
      return rgbToHex(c.r, c.g, c.b);
    }
    function luminance(hex) {
      var c = hexToRgb(hex);
      var a = [c.r, c.g, c.b].map(function (v) {
        v /= 255;
        return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);
      });
      return .2126 * a[0] + .7152 * a[1] + .0722 * a[2];
    }
    function readable(hex) { return luminance(hex) < .42; }

    function palette(seed, harmony) {
      var base = rgbToHsl(hexToRgb(seed).r, hexToRgb(seed).g, hexToRgb(seed).b);
      var h = base.h, s = Math.max(.32, base.s), out = [];
      if (harmony === "analogous") {
        [-38, -19, 0, 19, 38].forEach(function (d, i) {
          out.push(hslHex(h + d, clamp(s + .02 * (i - 2), .22, .9), [.24, .36, .5, .66, .82][i]));
        });
      } else if (harmony === "complementary") {
        out.push(hslHex(h, s, .26));
        out.push(hslHex(h, s * .9, .4));
        out.push(hslHex(h, clamp(s + .06, .3, .95), .56));
        out.push(hslHex(h + 180, s * .8, .6));
        out.push(hslHex(h + 180, s * .55, .82));
      } else if (harmony === "triadic") {
        [0, 120, 240].forEach(function (d, i) {
          out.push(hslHex(h + d, s, [.3, .48, .68][i]));
        });
        out.push(hslHex(h + 60, s * .7, .78));
        out.push(hslHex(h + 300, s * .55, .88));
      } else if (harmony === "split") {
        out.push(hslHex(h, s, .26));
        out.push(hslHex(h + 150, s * .85, .46));
        out.push(hslHex(h, s, .56));
        out.push(hslHex(h + 210, s * .7, .68));
        out.push(hslHex(h + 150, s * .5, .86));
      } else {
        [.16, .3, .44, .58, .74].forEach(function (l) {
          out.push(hslHex(h, clamp(s * (1 - (l - .44) * .35), .12, .92), l));
        });
      }
      return out;
    }

    function paint() {
      state.colors = palette(state.seed, state.harmony);
      els.seed.value = state.seed;
      els.hex.value = state.seed.toUpperCase();
      els.harmony.value = state.harmony;
      els.angle.value = state.angle;
      els.angleVal.textContent = state.angle + "\u00B0";
      els.swatches.innerHTML = state.colors.map(function (hex, i) {
        return '<button class="swatch' + (readable(hex) ? " dark" : "") + '" type="button" data-hex="' + hex + '" title="Copy ' + hex + '" aria-label="Copy ' + hex + '"><span>' + hex.toUpperCase() + "</span></button>";
      }).join("");
      var grad = "linear-gradient(" + state.angle + "deg, " + state.colors[0] + " 0%, " + state.colors[2] + " 52%, " + state.colors[4] + " 100%)";
      els.gradient.style.background = grad;
      els.code.textContent =
        ":root {\n" +
        "  --chroma-1: " + state.colors[0] + ";\n" +
        "  --chroma-2: " + state.colors[1] + ";\n" +
        "  --chroma-3: " + state.colors[2] + ";\n" +
        "  --chroma-4: " + state.colors[3] + ";\n" +
        "  --chroma-5: " + state.colors[4] + ";\n" +
        "  --chroma-gradient: " + grad + ";\n" +
        "}";
      save("chromaSeed", state.seed);
      save("chromaHarmony", state.harmony);
      save("chromaAngle", state.angle);
      paintSaved();
    }

    function paintSaved() {
      var list = store("palettes", []);
      if (!Array.isArray(list) || !list.length) {
        els.saved.innerHTML = '<span class="empty">No saved palettes yet.</span>';
        return;
      }
      els.saved.innerHTML = list.slice(0, 8).map(function (p, i) {
        var bg = "linear-gradient(118deg," + p.colors.join(",") + ")";
        return '<button type="button" data-saved="' + i + '" style="background:' + bg + '" title="Load palette ' + (i + 1) + '" aria-label="Load saved palette ' + (i + 1) + '"></button>';
      }).join("");
    }

    function setSeed(hex) {
      var n = normalizeHex(hex);
      if (!n) return false;
      state.seed = n;
      paint();
      return true;
    }

    function copyText(text, label) {
      function fallback() {
        try {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.style.cssText = "position:fixed;left:-9999px";
          document.body.appendChild(ta); ta.select();
          document.execCommand("copy"); ta.remove();
          MTH.toast(label + " copied", "ok", 2200);
        } catch (e) { MTH.toast("Copy failed. Select the CSS manually.", "warn"); }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { MTH.toast(label + " copied", "ok", 2200); }, fallback);
      } else fallback();
    }

    function exportPng() {
      var W = 1600, H = 900;
      var canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      var ctx = canvas.getContext("2d");
      if (!ctx) { MTH.toast("The browser could not create a canvas for the export.", "err"); return; }
      var bg = "#081727";
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // subtle grid
      ctx.strokeStyle = "rgba(255,255,255,.045)"; ctx.lineWidth = 1;
      for (var x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (var y = 0; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      // header
      ctx.fillStyle = "#d9eaff";
      ctx.font = '800 30px "Segoe UI", Arial, sans-serif';
      ctx.fillText("CHROMATIC LAB", 74, 96);
      ctx.fillStyle = "rgba(217,234,255,.55)";
      ctx.font = '500 17px "Segoe UI", Arial, sans-serif';
      ctx.fillText("Seed " + state.seed.toUpperCase() + "  ·  " + state.harmony + " harmony  ·  " + state.angle + "°", 74, 130);
      // swatches
      var pad = 74, gap = 18;
      var sw = (W - pad * 2 - gap * 4) / 5;
      var top = 200, sh = 420;
      state.colors.forEach(function (hex, i) {
        var cx = pad + i * (sw + gap);
        ctx.fillStyle = hex;
        roundRect(ctx, cx, top, sw, sh, 18); ctx.fill();
        ctx.fillStyle = readable(hex) ? "#ffffff" : "#081727";
        ctx.font = '800 21px "Segoe UI", Arial, sans-serif';
        ctx.fillText(hex.toUpperCase(), cx + 20, top + sh - 26);
        ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
        ctx.globalAlpha = .62;
        ctx.fillText("0" + (i + 1), cx + 20, top + 32);
        ctx.globalAlpha = 1;
      });
      // gradient bar
      var grad = ctx.createLinearGradient(pad, 690, W - pad, 690);
      grad.addColorStop(0, state.colors[0]);
      grad.addColorStop(.5, state.colors[2]);
      grad.addColorStop(1, state.colors[4]);
      ctx.fillStyle = grad;
      roundRect(ctx, pad, 672, W - pad * 2, 70, 14); ctx.fill();
      // footer
      ctx.fillStyle = "rgba(217,234,255,.62)";
      ctx.font = '600 15px "Segoe UI", Arial, sans-serif';
      ctx.fillText("Generated locally in MULTI TOOL HUB  ·  " + new Date().toLocaleDateString(), pad, 812);
      ctx.fillStyle = "rgba(217,234,255,.35)";
      ctx.font = '500 13px "Segoe UI", Arial, sans-serif';
      ctx.fillText("No uploads. No watermark. Palette values are ready for CSS, Figma or a slide deck.", pad, 838);
      canvas.toBlob(function (blob) {
        if (!blob) { MTH.toast("The PNG could not be encoded.", "err"); return; }
        MTH.download(blob, "chromatic-board-" + state.seed.slice(1) + ".png", "image/png");
        MTH.toast("PNG board exported", "ok", 2600);
      }, "image/png");
    }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    els.seed.addEventListener("input", function () { setSeed(els.seed.value); });
    els.hex.addEventListener("change", function () {
      if (!setSeed(els.hex.value)) MTH.toast("Enter a hex colour such as #1E63C4.", "warn");
    });
    els.hex.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); if (!setSeed(els.hex.value)) MTH.toast("Enter a six-digit hex colour.", "warn"); els.hex.blur(); }
    });
    els.harmony.addEventListener("change", function () { state.harmony = els.harmony.value; paint(); });
    els.angle.addEventListener("input", function () { state.angle = Number(els.angle.value); paint(); });
    els.swatches.addEventListener("click", function (e) {
      var b = e.target.closest("[data-hex]");
      if (!b) return;
      copyText(b.dataset.hex.toUpperCase(), "Colour");
    });
    els.copy.addEventListener("click", function () { copyText(els.code.textContent, "CSS palette"); });
    els.png.addEventListener("click", exportPng);
    els.saveBtn.addEventListener("click", function () {
      var list = store("palettes", []);
      if (!Array.isArray(list)) list = [];
      list.unshift({ seed: state.seed, harmony: state.harmony, angle: state.angle, colors: state.colors.slice(), at: Date.now() });
      list = list.slice(0, 24);
      save("palettes", list);
      paintSaved();
      MTH.toast("Palette saved on this device", "ok", 2400);
    });
    els.saved.addEventListener("click", function (e) {
      var b = e.target.closest("[data-saved]");
      if (!b) return;
      var list = store("palettes", []);
      var p = Array.isArray(list) ? list[Number(b.dataset.saved)] : null;
      if (!p) return;
      state.harmony = p.harmony || "mono";
      state.angle = p.angle == null ? 118 : p.angle;
      setSeed(p.seed || state.seed);
      MTH.toast("Saved palette loaded", "ok", 2000);
    });

    paint();
  }

  /* ======================================================================
     BREATHING ROOM
     ====================================================================== */
  function BreathingRoom() {
    var root = $("#reset");
    if (!root) return;
    var orb = $("[data-breath-orb]", root);
    var label = $("[data-breath-label]", root);
    var countEl = $("[data-breath-count]", root);
    var rhythm = $("[data-breath-rhythm]", root);
    var toggle = $("[data-breath-toggle]", root);
    var stop = $("[data-breath-stop]", root);
    if (!orb || !label) return;

    var RHYTHMS = {
      box: [["Inhale", 4], ["Hold", 4], ["Exhale", 4], ["Hold", 4]],
      calm: [["Inhale", 4], ["Hold", 2], ["Exhale", 6], ["Hold", 2]],
      extended: [["Inhale", 4], ["Exhale", 8]],
      coherent: [["Inhale", 5], ["Exhale", 5]]
    };
    var state = { running: false, phase: 0, left: 0, breaths: 0, timer: null, rhythm: store("breathRhythm", "box") };
    if (!RHYTHMS[state.rhythm]) state.rhythm = "box";
    rhythm.value = state.rhythm;

    function phases() { return RHYTHMS[state.rhythm] || RHYTHMS.box; }

    function setOrb(phaseName, seconds) {
      var scale = phaseName === "Inhale" ? 1.34 : phaseName === "Exhale" ? .86 : phaseName === "Hold" ? 1.14 : 1;
      var duration = Math.max(.3, seconds || 4);
      orb.style.transition = "transform " + duration + "s cubic-bezier(.37,0,.29,1), box-shadow " + duration + "s ease";
      orb.style.transform = "scale(" + scale + ")";
      orb.style.boxShadow = phaseName === "Inhale"
        ? "0 0 0 28px rgba(255,255,255,.06), 0 0 0 60px rgba(255,255,255,.035)"
        : "0 0 0 16px rgba(255,255,255,.035), 0 0 0 38px rgba(255,255,255,.02)";
      label.textContent = phaseName;
    }

    function start() {
      if (state.running) { pause(); return; }
      state.running = true;
      state.phase = 0;
      state.left = phases()[0][1];
      state.breaths = 0;
      countEl.textContent = "0 breaths";
      toggle.innerHTML = MTH.ui.icon("pause", "", 14) + " Pause";
      setOrb(phases()[0][0], phases()[0][1]);
      tick();
      state.timer = setInterval(tick, 1000);
    }
    function pause() {
      state.running = false;
      if (state.timer) { clearInterval(state.timer); state.timer = null; }
      toggle.innerHTML = MTH.ui.icon("play", "", 14) + " Resume";
      label.textContent = "Paused";
    }
    function stopAll() {
      state.running = false;
      if (state.timer) { clearInterval(state.timer); state.timer = null; }
      state.phase = 0;
      state.left = 0;
      state.breaths = 0;
      countEl.textContent = "0 breaths";
      label.textContent = "Ready";
      orb.style.transition = "transform .8s ease, box-shadow .8s ease";
      orb.style.transform = "scale(1)";
      orb.style.boxShadow = "0 0 0 18px rgba(255,255,255,.04), 0 0 0 40px rgba(255,255,255,.03)";
      toggle.innerHTML = MTH.ui.icon("play", "", 14) + " Begin";
    }
    function tick() {
      if (!state.running) return;
      var list = phases();
      if (state.left <= 0) {
        state.phase = (state.phase + 1) % list.length;
        if (state.phase === 0) {
          state.breaths++;
          countEl.textContent = state.breaths + (state.breaths === 1 ? " breath" : " breaths");
        }
        state.left = list[state.phase][1];
        setOrb(list[state.phase][0], list[state.phase][1]);
      }
      label.textContent = list[state.phase][0] + " · " + Math.max(0, state.left);
      state.left--;
    }

    toggle.addEventListener("click", start);
    stop.addEventListener("click", stopAll);
    rhythm.addEventListener("change", function () {
      state.rhythm = rhythm.value;
      save("breathRhythm", state.rhythm);
      stopAll();
    });
    stopAll();
  }

  function init() {
    if (!MTH.ui || !MTH.ui.icon) return;
    try { AmbientStudio(); } catch (e) { console.warn("Ambient Studio:", e); }
    try { ChromaticLab(); } catch (e) { console.warn("Chromatic Lab:", e); }
    try { BreathingRoom(); } catch (e) { console.warn("Breathing Room:", e); }
  }
  ready(init);
})();
