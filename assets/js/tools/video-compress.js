/* Video Compressor — MediaRecorder + Canvas capture, entirely local */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var state = {
    file: null,
    url: null,
    video: null,
    duration: 0,
    width: 0,
    height: 0,
    busy: false,
    cancelled: false,
    result: null,
    audioCtx: null,
    audioSource: null,
    audioDest: null,
    recorder: null,
    stream: null
  };

  function stage() { return MTH.tool.stage(); }

  function fmtTime(s) {
    s = Math.max(0, s || 0);
    var m = Math.floor(s / 60), sec = s - m * 60;
    return m + ":" + (sec < 10 ? "0" : "") + sec.toFixed(1);
  }

  function shell() {
    MTH.tool.mount(
      MTH.ui.dropzone({ accept: "video/*,.mp4,.webm,.mov,.m4v,.ogv", icon: "video", title: "Drop a video to re-encode", hint: "Trim, resize and compress with the browser\'s own encoder. Nothing is uploaded.", meta: ["MP4", "WebM", "Trim", "Local only"] }) +
      '<section class="panel" data-workspace hidden>' +
      '<div class="panel-head"><div><h2 data-file-name>Video</h2><p data-file-meta></p></div><div class="panel-actions"><button class="btn btn--sm btn--ghost" data-change>Choose another</button></div></div>' +
      '<div class="panel-body">' +
      '<div class="media-frame"><video data-video controls playsinline preload="metadata"></video></div>' +
      '<div class="media-info" data-info style="margin-top:12px"></div>' +
      "</div>" +
      '<div class="settings">' +
      '<div class="settings-section">' +
      '<h3>Trim range</h3>' +
      '<div class="trim-row">' +
      '<div class="field"><label for="vc-start">Start (seconds)</label><input class="input" id="vc-start" data-start type="number" min="0" step="0.1" value="0"></div>' +
      '<div class="field"><label for="vc-end">End (seconds)</label><input class="input" id="vc-end" data-end type="number" min="0" step="0.1" value="0"></div>' +
      "</div>" +
      '<div class="inline"><button class="btn btn--sm btn--ghost" data-set-start>Set from playhead</button><button class="btn btn--sm btn--ghost" data-set-end>Set end from playhead</button><span class=\"action-note\" data-range-note></span></div>' +
      "</div>" +
      '<div class="settings-section">' +
      '<h3>Output settings</h3>' +
      '<div class="settings-grid settings-grid--3">' +
      '<div class="field"><label for="vc-resolution">Resolution</label><select class="select" id="vc-resolution" data-resolution><option value="0">Keep original</option><option value="1080">1080p · Full HD</option><option value="720" selected>720p · HD</option><option value="480">480p · SD</option><option value="360">360p · Small</option></select></div>' +
      '<div class="field"><label for="vc-bitrate">Video bitrate</label><select class="select" id="vc-bitrate" data-bitrate><option value="800000">0.8 Mbps · smallest</option><option value="1500000" selected>1.5 Mbps · balanced</option><option value="2500000">2.5 Mbps · crisp</option><option value="4000000">4 Mbps · high</option><option value="6000000">6 Mbps · maximum</option></select></div>' +
      '<div class="field"><label for="vc-fps">Frame rate</label><select class="select" id="vc-fps" data-fps><option value="0" selected>Original / auto</option><option value="24">24 fps · cinematic</option><option value="30">30 fps · standard</option><option value="60">60 fps · smooth</option></select></div>' +
      "</div>" +
      '<div class="settings-grid">' +
      '<div class="field"><label for="vc-format">Container</label><select class="select" id="vc-format" data-format></select></div>' +
      '<div class="field"><label>Audio</label><label class="check" style="margin-top:9px"><input type="checkbox" data-audio checked> Include the audio track</label></div>' +
      "</div>" +
      '<div class="notice">' + MTH.ui.icon("info") + " Compression happens in real time using your device\'s encoder. A two-minute clip takes about two minutes. Keep this tab visible while it runs.</div>" +
      "</div>" +
      "</div>" +
      '<div class="action-bar"><button class="btn" data-run>' + MTH.ui.icon("compress") + "Compress video</button><button class=\"btn btn--ghost\" data-cancel hidden>Cancel</button><span class=\"grow\"></span><span class=\"action-note\" data-estimate>—</span></div>" +
      '<div style="padding:0 16px 16px">' + MTH.ui.progress("vc-prog", "Ready") + MTH.ui.status("vc-status") + "</div>" +
      '<div class="panel-body" data-result-wrap hidden style="border-top:1px solid var(--line)">' +
      '<div class="settings-title"><h3>Compressed result</h3></div>' +
      '<div class="media-frame"><video data-result-video controls playsinline></video></div>' +
      '<div class="media-info" data-result-info style="margin-top:12px"></div>' +
      '<div class="inline" style="margin-top:12px"><button class="btn" data-download-result>' + MTH.ui.icon("download") + "Download video</button></div>" +
      "</div>" +
      "</section>" +
      '<div data-result></div>'
    );

    MTH.tool.bindDrop(stage(), { accept: "video/*,.mp4,.webm,.mov,.m4v,.ogv", onFiles: function (files) { load(files[0]); } });
    stage().querySelector("[data-change]").addEventListener("click", async function () {
      var files = await MTH.pick("video/*,.mp4,.webm,.mov,.m4v,.ogv", false);
      if (files.length) load(files[0]);
    });
    stage().querySelector("[data-set-start]").addEventListener("click", function () {
      if (!state.video) return;
      stage().querySelector("[data-start]").value = state.video.currentTime.toFixed(1);
      syncRange();
    });
    stage().querySelector("[data-set-end]").addEventListener("click", function () {
      if (!state.video) return;
      stage().querySelector("[data-end]").value = state.video.currentTime.toFixed(1);
      syncRange();
    });
    ["[data-start]", "[data-end]"].forEach(function (sel) {
      stage().querySelector(sel).addEventListener("input", syncRange);
    });
    stage().querySelector("[data-resolution]").addEventListener("change", updateEstimate);
    stage().querySelector("[data-bitrate]").addEventListener("change", updateEstimate);
    stage().querySelector("[data-run]").addEventListener("click", run);
    stage().querySelector("[data-cancel]").addEventListener("click", function () {
      state.cancelled = true;
      if (state.recorder && state.recorder.state !== "inactive") {
        try { state.recorder.stop(); } catch (e) {}
      }
    });
    stage().querySelector("[data-download-result]").addEventListener("click", function () {
      if (state.result) MTH.download(state.result.blob, state.result.name, state.result.blob.type);
    });
    populateFormats();
  }

  function populateFormats() {
    var select = stage().querySelector("[data-format]");
    if (!select) return;
    var candidates = [
      { type: "video/webm;codecs=vp9,opus", label: "WebM · VP9 + Opus" },
      { type: "video/webm;codecs=vp8,opus", label: "WebM · VP8 + Opus" },
      { type: "video/webm", label: "WebM · browser default" },
      { type: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", label: "MP4 · H.264 + AAC" },
      { type: "video/mp4", label: "MP4 · browser default" }
    ];
    var any = false;
    select.innerHTML = candidates.filter(function (c) {
      if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return false;
      return MediaRecorder.isTypeSupported(c.type);
    }).map(function (c) {
      if (!any) { any = true; return '<option value="' + MTH.esc(c.type) + '" selected>' + MTH.esc(c.label) + "</option>"; }
      return '<option value="' + MTH.esc(c.type) + '">' + MTH.esc(c.label) + "</option>";
    }).join("");
    if (!any) {
      select.innerHTML = '<option value="">No recorder available</option>';
      stage().querySelector("[data-run]").disabled = true;
      stage().querySelector("[data-run]").title = "This browser does not support MediaRecorder.";
    }
  }

  async function load(file) {
    if (!file) return;
    if (state.url) URL.revokeObjectURL(state.url);
    if (state.result && state.result.url) URL.revokeObjectURL(state.result.url);
    state.result = null;
    state.file = file;
    var ws = stage().querySelector("[data-workspace]");
    ws.hidden = false;
    stage().querySelector("[data-result-wrap]").hidden = true;
    stage().querySelector("[data-result]").innerHTML = "";
    stage().querySelector("[data-file-name]").textContent = file.name;
    stage().querySelector("[data-file-meta]").textContent = "Reading video…";
    MTH.status("vc-status", "Opening " + file.name + "…");
    var video = stage().querySelector("[data-video]");
    state.video = video;
    state.url = URL.createObjectURL(file);
    video.src = state.url;
    try {
      await new Promise(function (resolve, reject) {
        var done = false;
        function ok() { if (done) return; done = true; resolve(); }
        function fail() { if (done) return; done = true; reject(new Error("This video could not be decoded by the browser. Try MP4 (H.264) or WebM.")); }
        video.addEventListener("loadedmetadata", ok, { once: true });
        video.addEventListener("error", fail, { once: true });
        setTimeout(function () { if (video.readyState >= 1) ok(); }, 1200);
      });
      state.duration = video.duration || 0;
      state.width = video.videoWidth || 0;
      state.height = video.videoHeight || 0;
      stage().querySelector("[data-file-meta]").textContent = MTH.fmtBytes(file.size) + " · " + state.width + " × " + state.height + " · " + fmtTime(state.duration);
      stage().querySelector("[data-info]").innerHTML =
        MTH.ui.stat("Duration", fmtTime(state.duration)) +
        MTH.ui.stat("Resolution", state.width + " × " + state.height) +
        MTH.ui.stat("Source size", MTH.fmtBytes(file.size)) +
        MTH.ui.stat("Type", (file.type || "video").replace("video/", "").toUpperCase() || "VIDEO");
      stage().querySelector("[data-start]").value = "0";
      stage().querySelector("[data-start]").max = state.duration.toFixed(1);
      stage().querySelector("[data-end]").value = state.duration.toFixed(1);
      stage().querySelector("[data-end]").max = state.duration.toFixed(1);
      syncRange();
      MTH.status("vc-status", "Choose a trim range and output settings, then compress.", "ok");
      stage().querySelector("[data-result-wrap]").hidden = true;
    } catch (e) {
      MTH.status("vc-status", MTH.friendlyError(e), "err");
      MTH.reportError(e, "video-compress-load");
    }
  }

  function currentRange() {
    var duration = state.duration || 0;
    var start = MTH.clamp(+stage().querySelector("[data-start]").value || 0, 0, duration);
    var end = MTH.clamp(+stage().querySelector("[data-end]").value || duration, 0, duration);
    if (end <= start) end = Math.min(duration, start + .1);
    return { start: start, end: end, length: Math.max(.1, end - start) };
  }

  function syncRange() {
    var r = currentRange();
    stage().querySelector("[data-range-note]").textContent = fmtTime(r.start) + " → " + fmtTime(r.end) + " · " + fmtTime(r.length) + " output";
    updateEstimate();
  }

  function updateEstimate() {
    var r = currentRange();
    var bitrate = +stage().querySelector("[data-bitrate]").value || 1500000;
    var bytes = bitrate / 8 * r.length + 12000 * r.length;
    stage().querySelector("[data-estimate]").textContent = "≈ " + MTH.fmtBytes(bytes) + " output · real-time encode";
  }

  function targetSize() {
    var h = +stage().querySelector("[data-resolution]").value || state.height || 720;
    if (!state.height) return { w: Math.round(h * 16 / 9), h: h };
    var scale = Math.min(1, h / state.height);
    return { w: Math.max(2, Math.round(state.width * scale / 2) * 2), h: Math.max(2, Math.round(state.height * scale / 2) * 2) };
  }

  async function run() {
    if (state.busy || !state.video || !state.duration) return;
    if (typeof MediaRecorder === "undefined") {
      MTH.status("vc-status", "This browser cannot record video. Try Chrome, Edge, Firefox or Safari 16+.", "err");
      return;
    }
    var mime = stage().querySelector("[data-format]").value;
    if (!mime || !MediaRecorder.isTypeSupported(mime)) {
      MTH.status("vc-status", "No supported video container was found. Try another browser.", "err");
      return;
    }
    var r = currentRange();
    var size = targetSize();
    var fpsChoice = +stage().querySelector("[data-fps]").value || 0;
    var fps = fpsChoice || 30;
    var includeAudio = stage().querySelector("[data-audio]").checked;
    var bitrate = +stage().querySelector("[data-bitrate]").value || 1500000;
    var video = state.video;

    state.busy = true;
    state.cancelled = false;
    var btn = stage().querySelector("[data-run]");
    var cancelBtn = stage().querySelector("[data-cancel]");
    MTH.busy(btn, true); btn.dataset.busyText = "Encoding…";
    MTH.busy(cancelBtn, true);
    cancelBtn.hidden = false;
    MTH.progress("vc-prog", 0, "Preparing encoder…");
    MTH.status("vc-status", "Seeking to the trim start…");

    var canvas = document.createElement("canvas");
    canvas.width = size.w; canvas.height = size.h;
    var ctx = canvas.getContext("2d", { alpha: false });
    var recorder = null, stream = null, chunks = [], cancelled = false;
    var drawTimer = null, stopTimer = null;
    var startedAt = 0;
    var localDest = null;

    function cleanup() {
      if (drawTimer) cancelAnimationFrame(drawTimer);
      if (stopTimer) clearTimeout(stopTimer);
      try { video.pause(); } catch (e) {}
      if (stream) stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      if (localDest) {
        try { if (state.audioSource && state.audioSource.disconnect) state.audioSource.disconnect(localDest); } catch (e) {}
        try { localDest.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        localDest = null;
      }
      try { video.muted = false; } catch (e) {}
      state.recorder = null;
      state.stream = null;
    }

    try {
      video.pause();
      await new Promise(function (resolve) {
        if (Math.abs(video.currentTime - r.start) < .08) return resolve();
        var done = false;
        function ok() { if (done) return; done = true; video.removeEventListener("seeked", ok); resolve(); }
        video.addEventListener("seeked", ok);
        video.currentTime = r.start;
        setTimeout(ok, 1600);
      });
      if (state.cancelled) throw new Error("Cancelled");

      var videoStream = canvas.captureStream(fps);
      var tracks = videoStream.getVideoTracks();
      video.muted = !includeAudio;
      if (includeAudio) {
        try {
          if (!state.audioCtx) {
            state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            state.audioSource = state.audioCtx.createMediaElementSource(video);
          }
          if (state.audioCtx.state === "suspended") await state.audioCtx.resume();
          localDest = state.audioCtx.createMediaStreamDestination();
          state.audioSource.connect(localDest);
          localDest.stream.getAudioTracks().forEach(function (t) { tracks.push(t); });
        } catch (e) {
          MTH.toast("Audio could not be captured. The video will be silent.", "warn");
        }
      }
      stream = new MediaStream(tracks);
      state.stream = stream;
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: 128000 });
      state.recorder = recorder;
      recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      var stopped = new Promise(function (resolve) { recorder.onstop = resolve; });
      recorder.onerror = function (e) { MTH.reportError(e.error || new Error("The video encoder stopped unexpectedly."), "video-compress-recorder"); };

      recorder.start(1000);
      startedAt = performance.now();
      MTH.status("vc-status", "Encoding in real time. Keep this tab visible…");

      var lastDraw = 0;
      var frameInterval = 1000 / fps;
      function draw(now) {
        if (!state.busy || state.cancelled) return;
        if (now - lastDraw >= frameInterval - 2) {
          lastDraw = now;
          if (video.readyState >= 2) {
            try { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); } catch (e) {}
          }
        }
        var elapsed = (performance.now() - startedAt) / 1000;
        var pct = MTH.clamp(elapsed / r.length, 0, .99);
        MTH.progress("vc-prog", pct, "Encoding " + Math.round(pct * 100) + "% · " + fmtTime(elapsed) + " of " + fmtTime(r.length));
        if (video.ended || video.currentTime >= r.end - .03 || elapsed >= r.length + .25) {
          if (recorder.state !== "inactive") recorder.stop();
          return;
        }
        drawTimer = requestAnimationFrame(draw);
      }

      await video.play();
      drawTimer = requestAnimationFrame(draw);
      stopTimer = setTimeout(function () {
        if (recorder.state !== "inactive") { try { recorder.stop(); } catch (e) {} }
      }, (r.length + 1.2) * 1000);

      await stopped;
      cleanup();
      if (state.cancelled) throw new Error("Cancelled");
      if (!chunks.length) throw new Error("The encoder produced an empty file. Try a lower resolution or a different container.");
      var blob = new Blob(chunks, { type: mime.split(";")[0] });
      if (!blob.size) throw new Error("The encoder produced an empty file. Try a different container or a smaller resolution.");
      var ext = /mp4/.test(mime) ? ".mp4" : ".webm";
      var name = MTH.baseName(state.file.name) + "-compressed" + ext;
      if (state.result && state.result.url) URL.revokeObjectURL(state.result.url);
      var url = URL.createObjectURL(blob);
      state.result = { blob: blob, url: url, name: name, w: canvas.width, h: canvas.height, length: r.length, mime: mime };
      stage().querySelector("[data-result-wrap]").hidden = false;
      var outVideo = stage().querySelector("[data-result-video]");
      outVideo.src = url;
      stage().querySelector("[data-result-info]").innerHTML =
        MTH.ui.stat("Output size", MTH.fmtBytes(blob.size)) +
        MTH.ui.stat("Change", MTH.fmtBytes(state.file.size) + " → " + MTH.fmtBytes(blob.size)) +
        MTH.ui.stat("Resolution", canvas.width + " × " + canvas.height) +
        MTH.ui.stat("Duration", fmtTime(r.length)) +
        MTH.ui.stat("Saved", Math.max(0, Math.round((1 - blob.size / state.file.size) * 100)) + "%");
      MTH.progress("vc-prog", 1, "Complete");
      MTH.status("vc-status", "Compressed to " + MTH.fmtBytes(blob.size) + " from " + MTH.fmtBytes(state.file.size) + ". The video is ready to download.", "ok");
      MTH.toast("Video compressed", "ok");
      stage().querySelector("[data-result-wrap]").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (e) {
      cleanup();
      MTH.progress("vc-prog", null);
      if (state.cancelled || /Cancelled/i.test(e && e.message || "")) {
        MTH.status("vc-status", "Compression cancelled. Nothing was downloaded.", "warn");
      } else if (/NotSupported|codec|MediaRecorder/i.test(e && e.message || "")) {
        MTH.status("vc-status", "This browser cannot encode that video format. Try WebM or a different browser.", "err");
      } else {
        MTH.status("vc-status", MTH.friendlyError(e), "err");
        MTH.reportError(e, "video-compress");
      }
    } finally {
      state.busy = false;
      MTH.busy(btn, false);
      MTH.busy(cancelBtn, false);
      cancelBtn.hidden = true;
      try { if (state.video) state.video.muted = false; } catch (e) {}
    }
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
