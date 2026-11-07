/* Video to Audio — browser decode, trim, fades, WAV + MP3 */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var state = {
    file: null,
    buffer: null,
    url: null,
    name: "",
    start: 0,
    end: 0,
    dragging: null,
    peaks: null,
    busy: false,
    audioCtx: null,
    previewSource: null,
    result: null
  };

  function stage() { return MTH.tool.stage(); }
  function fmtTime(s) {
    s = Math.max(0, s || 0);
    var m = Math.floor(s / 60), sec = s - m * 60;
    return m + ":" + (sec < 10 ? "0" : "") + sec.toFixed(2);
  }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: "video/*,audio/*,.mp4,.webm,.mov,.m4v,.ogv,.mp3,.m4a,.aac,.wav,.ogg,.flac", icon: "audio", title: "Drop a video or audio file", hint: "Extract the soundtrack, trim it and export WAV or MP3 — all on this device.", meta: ["MP3", "WAV", "Trim", "Fade"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2 data-file-name>Media</h2><p data-file-meta></p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-change>Choose another</button></div></div>' +
      '<div class="panel-body">' +
      '<div class="media-info" data-info></div>' +
      '<div style="margin-top:14px"><div class="settings-title"><h3>Waveform</h3><span class="tag" data-selection-label>Full track</span></div>' +
      '<canvas class="waveform" data-wave height="110" aria-label="Audio waveform with trim handles"></canvas>' +
      '<div class="hint" style="margin-top:6px">Drag the brass handles to set the trim. Click anywhere on the waveform to move the nearest handle.</div></div>' +
      '<div class="trim-row" style="margin-top:14px">' +
      '<div class="field"><label for="va-start">Start (seconds)</label><input class="input" id="va-start" data-start type="number" min="0" step="0.01" value="0"></div>' +
      '<div class="field"><label for="va-end">End (seconds)</label><input class="input" id="va-end" data-end type="number" min="0" step="0.01" value="0"></div>' +
      "</div>" +
      '<div class="inline"><button class="btn btn--sm btn--ghost" data-play>' + MTH.ui.icon("play") + "Play selection</button><button class=\"btn btn--sm btn--subtle\" data-stop-play>Stop</button><span class=\"action-note\" data-duration-note></span></div>" +
      "</div>" +
      '<div class="settings">' +
      '<div class="settings-section">' +
      '<h3>Polish</h3>' +
      '<div class="settings-grid">' +
      '<div class="field"><label for="va-fade-in">Fade in <span class="range-val" data-fade-in-val>0.0 s</span></label><input id="va-fade-in" data-fade-in type="range" min="0" max="10" step="0.1" value="0"></div>' +
      '<div class="field"><label for="va-fade-out">Fade out <span class="range-val" data-fade-out-val>0.0 s</span></label><input id="va-fade-out" data-fade-out type="range" min="0" max="10" step="0.1" value="0"></div>' +
      "</div>" +
      '<div class="settings-grid">' +
      '<div class="field"><label for="va-format">Format</label><select class="select" id="va-format" data-format><option value="mp3">MP3 · 192 kbps</option><option value="wav">WAV · uncompressed 16-bit</option></select></div>' +
      '<div class="field"><label for="va-bitrate">MP3 quality</label><select class="select" id="va-bitrate" data-bitrate><option value="320">320 kbps · best</option><option value="192" selected>192 kbps · balanced</option><option value="128">128 kbps · compact</option><option value="96">96 kbps · small</option></select></div>' +
      "</div>" +
      '<div class="notice">' + MTH.ui.icon("shield") + " The audio is decoded and re-encoded in this tab. No part of the file leaves your device.</div>" +
      "</div>" +
      "</div>" +
      '<div class="action-bar"><button class="btn" data-run>' + MTH.ui.icon("audio") + "Export audio</button><span class=\"grow\"></span><span class=\"action-note\" data-estimate>—</span></div>" +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("va-prog", "Ready") + MTH.ui.status("va-status") + "</div>" +
      '<div class="panel-body" data-result-wrap hidden style="border-top:1px solid var(--line)">' +
      '<div class="settings-title"><h3>Audio ready</h3><span class="tag" data-result-tag>0:00</span></div>' +
      '<div class="media-frame"><audio data-result-audio controls></audio></div>' +
      '<div class="media-info" data-result-info style="margin-top:12px"></div>' +
      '<div class="inline" style="margin-top:12px"><button class="btn" data-download-result>' + MTH.ui.icon("download") + "Download audio</button></div>" +
      "</div>" +
      "</section>" +
      '<div data-result></div>'
    );

    MTH.tool.bindDrop(stage(), { accept: "video/*,audio/*,.mp4,.webm,.mov,.m4v,.ogv,.mp3,.m4a,.aac,.wav,.ogg,.flac", onFiles: function (files) { load(files[0]); } });
    stage().querySelector("[data-change]").addEventListener("click", async function () {
      var files = await MTH.pick("video/*,audio/*,.mp4,.webm,.mov,.m4v,.ogv,.mp3,.m4a,.aac,.wav,.ogg,.flac", false);
      if (files.length) load(files[0]);
    });
    ["[data-start]", "[data-end]"].forEach(function (sel) {
      stage().querySelector(sel).addEventListener("input", function () {
        syncRange(false);
        drawWave();
      });
    });
    stage().querySelector("[data-fade-in]").addEventListener("input", function (e) {
      stage().querySelector("[data-fade-in-val]").textContent = (+e.target.value).toFixed(1) + " s";
      updateEstimate();
    });
    stage().querySelector("[data-fade-out]").addEventListener("input", function (e) {
      stage().querySelector("[data-fade-out-val]").textContent = (+e.target.value).toFixed(1) + " s";
      updateEstimate();
    });
    stage().querySelector("[data-format]").addEventListener("change", updateEstimate);
    stage().querySelector("[data-bitrate]").addEventListener("change", updateEstimate);
    stage().querySelector("[data-play]").addEventListener("click", preview);
    stage().querySelector("[data-stop-play]").addEventListener("click", stopPreview);
    stage().querySelector("[data-run]").addEventListener("click", run);
    stage().querySelector("[data-download-result]").addEventListener("click", function () {
      if (state.result) MTH.download(state.result.blob, state.result.name, state.result.blob.type);
    });
    var wave = stage().querySelector("[data-wave]");
    wave.addEventListener("pointerdown", onWaveDown);
    wave.addEventListener("pointermove", onWaveMove);
    wave.addEventListener("pointerup", onWaveUp);
    wave.addEventListener("pointercancel", onWaveUp);
    var ro = new ResizeObserver(function () { drawWave(); });
    ro.observe(wave);
    window.addEventListener("mth:theme", function () { drawWave(); });
  }

  function ensureCtx() {
    if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return state.audioCtx;
  }

  async function load(file) {
    if (!file) return;
    state.file = file;
    state.result = null;
    state.buffer = null;
    state.peaks = null;
    var ws = stage().querySelector("[data-workspace]");
    ws.hidden = false;
    stage().querySelector("[data-result-wrap]").hidden = true;
    stage().querySelector("[data-result]").innerHTML = "";
    stage().querySelector("[data-file-name]").textContent = file.name;
    stage().querySelector("[data-file-meta]").textContent = "Decoding audio…";
    stage().querySelector("[data-info]").innerHTML = "";
    MTH.status("va-status", "Decoding " + file.name + " on this device…");
    MTH.progress("va-prog", 0, "Decoding…");
    try {
      var ctx = ensureCtx();
      var bytes = await MTH.read(file);
      var copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      var buffer = await new Promise(function (resolve, reject) {
        var p = ctx.decodeAudioData(copy, resolve, reject);
        if (p && p.then) p.then(resolve, reject);
      });
      if (!buffer) throw new Error("The audio could not be decoded.");
      state.buffer = buffer;
      state.name = MTH.baseName(file.name);
      state.start = 0;
      state.end = buffer.duration;
      stage().querySelector("[data-start]").value = "0";
      stage().querySelector("[data-start]").max = buffer.duration.toFixed(2);
      stage().querySelector("[data-end]").value = buffer.duration.toFixed(2);
      stage().querySelector("[data-end]").max = buffer.duration.toFixed(2);
      stage().querySelector("[data-file-meta]").textContent = MTH.fmtBytes(file.size) + " · " + fmtTime(buffer.duration) + " · " + buffer.numberOfChannels + " channel" + (buffer.numberOfChannels === 1 ? "" : "s") + " · " + buffer.sampleRate + " Hz";
      stage().querySelector("[data-info]").innerHTML =
        MTH.ui.stat("Duration", fmtTime(buffer.duration)) +
        MTH.ui.stat("Sample rate", buffer.sampleRate + " Hz") +
        MTH.ui.stat("Channels", buffer.numberOfChannels === 1 ? "Mono" : buffer.numberOfChannels === 2 ? "Stereo" : buffer.numberOfChannels + " ch") +
        MTH.ui.stat("Source size", MTH.fmtBytes(file.size));
      computePeaks();
      drawWave();
      syncRange(false);
      updateEstimate();
      MTH.progress("va-prog", 1, "Ready");
      MTH.status("va-status", "Set the trim and fades, then export. The preview plays only the selected range.", "ok");
    } catch (e) {
      MTH.progress("va-prog", null);
      var msg = /decode|EncodingError|Unable to decode/i.test(e && e.message || "") ? "This browser could not decode the audio track. Try an MP4 (AAC), MP3, WAV or WebM file." : MTH.friendlyError(e);
      MTH.status("va-status", msg, "err");
      stage().querySelector("[data-file-meta]").textContent = "Could not be decoded";
      MTH.reportError(e, "video-to-audio-load");
    }
  }

  function computePeaks() {
    var b = state.buffer;
    if (!b) return;
    var count = 1400;
    var ch = b.getChannelData(0);
    var peaks = new Float32Array(count);
    var block = Math.max(1, Math.floor(ch.length / count));
    for (var i = 0; i < count; i++) {
      var start = i * block, max = 0;
      for (var j = 0; j < block; j += 4) {
        var v = Math.abs(ch[start + j] || 0);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    state.peaks = peaks;
  }

  function drawWave() {
    var canvas = stage().querySelector("[data-wave]");
    if (!canvas || !state.buffer) return;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(110 * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var w = rect.width, h = 110;
    var style = getComputedStyle(document.documentElement);
    var line = style.getPropertyValue("--line").trim() || "#d8d2c4";
    var accent = style.getPropertyValue("--accent").trim() || "#17463b";
    var brass = style.getPropertyValue("--brass").trim() || "#a8782e";
    var muted = style.getPropertyValue("--muted").trim() || "#626b63";
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2 + .5);
    ctx.lineTo(w, h / 2 + .5);
    ctx.stroke();
    var peaks = state.peaks || [];
    if (!peaks.length) return;
    var sx = state.start / state.buffer.duration * w;
    var ex = state.end / state.buffer.duration * w;
    for (var x = 0; x < w; x++) {
      var i = Math.floor(x / w * peaks.length);
      var amp = Math.max(.012, peaks[i] || 0) * (h * .42);
      var selected = x >= sx && x <= ex;
      ctx.fillStyle = selected ? accent : line;
      ctx.globalAlpha = selected ? .85 : .6;
      ctx.fillRect(x, h / 2 - amp, 1, amp * 2);
    }
    ctx.globalAlpha = 1;
    // selection edges
    [sx, ex].forEach(function (x) {
      ctx.fillStyle = brass;
      ctx.fillRect(Math.max(0, Math.min(w - 2, x - 1)), 0, 2, h);
      ctx.beginPath();
      ctx.arc(Math.max(3, Math.min(w - 3, x)), h / 2, 5, 0, Math.PI * 2);
      ctx.fillStyle = brass;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    ctx.fillStyle = muted;
    ctx.font = "10px " + (style.getPropertyValue("--font-mono") || "monospace");
    ctx.fillText(fmtTime(state.start), 2, h - 4);
    var endLabel = fmtTime(state.end);
    ctx.fillText(endLabel, w - ctx.measureText(endLabel).width - 2, h - 4);
  }

  function onWaveDown(e) {
    if (!state.buffer) return;
    var rect = e.currentTarget.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var sx = state.start / state.buffer.duration * rect.width;
    var ex = state.end / state.buffer.duration * rect.width;
    if (Math.abs(x - sx) <= 12) state.dragging = "start";
    else if (Math.abs(x - ex) <= 12) state.dragging = "end";
    else state.dragging = x < (sx + ex) / 2 ? "start" : "end";
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    applyWaveX(x, rect.width);
  }
  function onWaveMove(e) {
    if (!state.dragging || !state.buffer) return;
    var rect = e.currentTarget.getBoundingClientRect();
    applyWaveX(e.clientX - rect.left, rect.width);
  }
  function onWaveUp(e) {
    if (!state.dragging) return;
    state.dragging = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  function applyWaveX(x, width) {
    var t = MTH.clamp(x / width, 0, 1) * state.buffer.duration;
    if (state.dragging === "start") state.start = MTH.clamp(t, 0, state.end - .05);
    else state.end = MTH.clamp(t, state.start + .05, state.buffer.duration);
    stage().querySelector("[data-start]").value = state.start.toFixed(2);
    stage().querySelector("[data-end]").value = state.end.toFixed(2);
    syncRange(true);
    drawWave();
  }

  function syncRange(fromWave) {
    if (!state.buffer) return;
    var duration = state.buffer.duration;
    if (!fromWave) {
      state.start = MTH.clamp(+stage().querySelector("[data-start]").value || 0, 0, duration - .05);
      state.end = MTH.clamp(+stage().querySelector("[data-end]").value || duration, state.start + .05, duration);
    }
    var len = state.end - state.start;
    stage().querySelector("[data-selection-label]").textContent = fmtTime(state.start) + " → " + fmtTime(state.end) + " · " + fmtTime(len);
    stage().querySelector("[data-duration-note]").textContent = fmtTime(len) + " selected of " + fmtTime(duration);
    updateEstimate();
  }

  function updateEstimate() {
    if (!state.buffer) return;
    var len = Math.max(.05, state.end - state.start);
    var format = stage().querySelector("[data-format]").value;
    var bitrate = +stage().querySelector("[data-bitrate]").value || 192;
    var bytes = format === "wav"
      ? len * state.buffer.sampleRate * Math.min(2, state.buffer.numberOfChannels) * 2 + 44
      : len * bitrate * 1000 / 8 + 4096;
    stage().querySelector("[data-estimate]").textContent = "≈ " + MTH.fmtBytes(bytes) + " " + format.toUpperCase() + " · " + fmtTime(len);
  }

  function trimmedChannels() {
    var b = state.buffer;
    var sr = b.sampleRate;
    var startSample = Math.max(0, Math.floor(state.start * sr));
    var endSample = Math.min(b.length, Math.ceil(state.end * sr));
    var length = Math.max(1, endSample - startSample);
    var fadeIn = MTH.clamp(+stage().querySelector("[data-fade-in]").value || 0, 0, (state.end - state.start) / 2);
    var fadeOut = MTH.clamp(+stage().querySelector("[data-fade-out]").value || 0, 0, (state.end - state.start) / 2);
    var fadeInSamples = Math.floor(fadeIn * sr);
    var fadeOutSamples = Math.floor(fadeOut * sr);
    var srcChannels = b.numberOfChannels;
    var outChannels = srcChannels >= 2 ? 2 : 1;
    var channels = [];
    for (var c = 0; c < outChannels; c++) {
      var src = b.getChannelData(c);
      var out = new Float32Array(length);
      for (var i = 0; i < length; i++) {
        var v = src[startSample + i] || 0;
        if (fadeInSamples && i < fadeInSamples) v *= i / fadeInSamples;
        if (fadeOutSamples && i >= length - fadeOutSamples) v *= (length - i) / fadeOutSamples;
        out[i] = v;
      }
      channels.push(out);
    }
    if (srcChannels > 2) {
      // Downmix extra channels into the stereo pair.
      for (var ch = 2; ch < srcChannels; ch++) {
        var extra = b.getChannelData(ch);
        for (var k = 0; k < length; k++) {
          var val = (extra[startSample + k] || 0) * .5;
          channels[0][k] += val;
          channels[1][k] += val;
        }
      }
      channels.forEach(function (arr) {
        for (var j = 0; j < arr.length; j++) arr[j] = MTH.clamp(arr[j], -1, 1);
      });
    }
    return { channels: channels, sampleRate: sr, length: length };
  }

  async function preview() {
    if (!state.buffer) return;
    stopPreview();
    try {
      var ctx = ensureCtx();
      if (ctx.state === "suspended") await ctx.resume();
      var t = trimmedChannels();
      var buffer = ctx.createBuffer(t.channels.length, t.length, t.sampleRate);
      t.channels.forEach(function (ch, i) { buffer.copyToChannel(ch, i); });
      var source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      state.previewSource = source;
      source.onended = function () { if (state.previewSource === source) state.previewSource = null; };
      source.start();
      MTH.toast("Playing the selected range", "info", 1800);
    } catch (e) {
      MTH.status("va-status", "The preview could not play: " + MTH.friendlyError(e), "err");
    }
  }
  function stopPreview() {
    if (state.previewSource) {
      try { state.previewSource.stop(); } catch (e) {}
      state.previewSource = null;
    }
  }

  function writeWav(channels, sampleRate) {
    var numCh = channels.length;
    var len = channels[0].length;
    var dataSize = len * numCh * 2;
    var buffer = new ArrayBuffer(44 + dataSize);
    var view = new DataView(buffer);
    function str(offset, s) { for (var i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); }
    str(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); str(8, "WAVE");
    str(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numCh * 2, true); view.setUint16(32, numCh * 2, true);
    view.setUint16(34, 16, true); str(36, "data"); view.setUint32(40, dataSize, true);
    var offset = 44;
    for (var i = 0; i < len; i++) {
      for (var c = 0; c < numCh; c++) {
        var v = MTH.clamp(channels[c][i], -1, 1);
        view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([buffer], { type: "audio/wav" });
  }

  async function encodeMp3(t, bitrate, onProgress) {
    if (typeof lamejs === "undefined" || !lamejs.Mp3Encoder) throw new Error("The MP3 encoder did not load. Refresh the page, or export WAV instead.");
    var channels = t.channels.length;
    var encoder = new lamejs.Mp3Encoder(channels, t.sampleRate, bitrate);
    var left = new Int16Array(t.length);
    var right = channels > 1 ? new Int16Array(t.length) : null;
    for (var i = 0; i < t.length; i++) {
      var l = MTH.clamp(t.channels[0][i], -1, 1);
      left[i] = l < 0 ? l * 0x8000 : l * 0x7fff;
      if (right) {
        var r = MTH.clamp(t.channels[1][i], -1, 1);
        right[i] = r < 0 ? r * 0x8000 : r * 0x7fff;
      }
    }
    var chunks = [];
    var block = 1152;
    for (var pos = 0; pos < t.length; pos += block) {
      var lchunk = left.subarray(pos, Math.min(t.length, pos + block));
      var buf;
      if (right) {
        var rchunk = right.subarray(pos, Math.min(t.length, pos + block));
        buf = encoder.encodeBuffer(lchunk, rchunk);
      } else {
        buf = encoder.encodeBuffer(lchunk);
      }
      if (buf.length) chunks.push(new Int8Array(buf));
      if (pos % (block * 120) === 0) {
        if (onProgress) onProgress(MTH.clamp(pos / t.length, 0, .98));
        await MTH.sleep(0);
      }
    }
    var end = encoder.flush();
    if (end.length) chunks.push(new Int8Array(end));
    return new Blob(chunks, { type: "audio/mpeg" });
  }

  async function run() {
    if (state.busy || !state.buffer) return;
    syncRange(false);
    var format = stage().querySelector("[data-format]").value;
    var bitrate = +stage().querySelector("[data-bitrate]").value || 192;
    var btn = stage().querySelector("[data-run]");
    state.busy = true;
    MTH.busy(btn, true); btn.dataset.busyText = format === "wav" ? "Writing WAV…" : "Encoding MP3…";
    MTH.progress("va-prog", 0, "Preparing " + format.toUpperCase() + "…");
    MTH.status("va-status", "Rendering " + fmtTime(state.end - state.start) + " of audio on this device…");
    try {
      var t = trimmedChannels();
      MTH.progress("va-prog", .1, "Applying fades…");
      await MTH.sleep(0);
      var blob;
      if (format === "wav") {
        blob = writeWav(t.channels, t.sampleRate);
        MTH.progress("va-prog", .95, "Writing WAV header…");
      } else {
        blob = await encodeMp3(t, bitrate, function (p) {
          MTH.progress("va-prog", .1 + p * .85, "Encoding MP3… " + Math.round(10 + p * 85) + "%");
        });
      }
      var ext = format === "wav" ? ".wav" : ".mp3";
      var name = state.name + "-audio" + ext;
      if (state.result && state.result.url) URL.revokeObjectURL(state.result.url);
      var url = URL.createObjectURL(blob);
      state.result = { blob: blob, url: url, name: name, format: format, length: t.length / t.sampleRate };
      stage().querySelector("[data-result-wrap]").hidden = false;
      stage().querySelector("[data-result-tag]").textContent = fmtTime(state.result.length);
      var audio = stage().querySelector("[data-result-audio]");
      audio.src = url;
      stage().querySelector("[data-result-info]").innerHTML =
        MTH.ui.stat("Format", format.toUpperCase()) +
        MTH.ui.stat("Size", MTH.fmtBytes(blob.size)) +
        MTH.ui.stat("Duration", fmtTime(state.result.length)) +
        MTH.ui.stat("Channels", t.channels.length === 1 ? "Mono" : "Stereo") +
        MTH.ui.stat("Sample rate", t.sampleRate + " Hz");
      MTH.progress("va-prog", 1, "Complete");
      MTH.status("va-status", format.toUpperCase() + " ready · " + fmtTime(state.result.length) + " · " + MTH.fmtBytes(blob.size) + ". Download it, or preview above.", "ok");
      MTH.toast("Audio exported", "ok");
    } catch (e) {
      MTH.progress("va-prog", null);
      MTH.status("va-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "video-to-audio");
    } finally {
      state.busy = false;
      MTH.busy(btn, false);
    }
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
