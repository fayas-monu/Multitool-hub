/* Focus Studio — timer, checklist and deliberate break rituals */
(function () {
  "use strict";
  var MTH = window.MTH;
  if (!MTH) return;

  var CIRC = 2 * Math.PI * 45;
  var state = {
    tab: "timer",
    timer: { minutes: 25, remaining: 25 * 60, running: false, endAt: 0, mode: "focus" },
    tick: null,
    audioCtx: null,
    tasks: []
  };

  function stage() { return MTH.tool.stage(); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function shell() {
    MTH.tool.mount(
      '<section class="panel">' +
      '<div class="focus-tabs" role="tablist" aria-label="Focus Studio sections">' +
      '<button type="button" class="on" data-tab="timer" role="tab" aria-selected="true">' + MTH.ui.icon("timer") + " Timer</button>" +
      '<button type="button" data-tab="tasks" role="tab" aria-selected="false">' + MTH.ui.icon("check") + " Checklist</button>" +
      '<button type="button" data-tab="breaks" role="tab" aria-selected="false">' + MTH.ui.icon("spark") + " Breaks</button>" +
      "</div>" +
      '<div class="focus-panel on" data-panel="timer" role="tabpanel">' +
      '<div class="timer-wrap">' +
      '<div>' +
      '<div class="timer-presets" data-presets>' +
      '<button class="chip" data-preset="25">25 min focus</button>' +
      '<button class="chip" data-preset="15">15 min</button>' +
      '<button class="chip" data-preset="45">45 min</button>' +
      '<button class="chip" data-preset="50">50 min</button>' +
      '<button class="chip" data-preset="5" data-break="1">5 min break</button>' +
      "</div>" +
      '<div class="timer-dial">' +
      '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="45"></circle><circle class="bar" cx="50" cy="50" r="45" stroke-dasharray="' + CIRC.toFixed(2) + '" stroke-dashoffset="0"></circle></svg>' +
      '<div class="timer-time"><b data-time>25:00</b><span data-phase>Focus session</span></div>' +
      "</div>" +
      '<div class="timer-controls">' +
      '<button class="btn" data-start>' + MTH.ui.icon("play") + "Start</button>" +
      '<button class="btn btn--ghost" data-reset>' + MTH.ui.icon("reset") + "Reset</button>" +
      '<button class="btn btn--subtle" data-skip>Skip</button>' +
      "</div>" +
      '<div class="inline" style="justify-content:center;margin-top:14px"><span class="small muted">Custom</span><input class="input" data-custom type="number" min="1" max="180" value="25" style="width:92px" aria-label="Custom minutes"><button class="btn btn--sm btn--ghost" data-set-custom>Set</button></div>' +
      "</div>" +
      '<div class="timer-stats">' +
      MTH.ui.stat("Sessions today", "0", "") +
      MTH.ui.stat("Focused today", "0 min") +
      MTH.ui.stat("Current streak", "0") +
      '<div class="notice" style="margin-top:4px">' + MTH.ui.icon("info") + " The timer keeps running when you switch tabs or reload the page. Progress is saved only on this device.</div>" +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="focus-panel" data-panel="tasks" role="tabpanel">' +
      '<div class="tasks-input"><input class="input" data-task-input placeholder="Add a small, finishable task…" maxlength="160" aria-label="New task"><button class="btn" data-task-add>' + MTH.ui.icon("plus") + "Add</button></div>" +
      '<ul class="task-list" data-task-list></ul>' +
      '<div class="task-progress"><div class="progress show"><span data-task-bar></span></div><div class="progress-label"><span data-task-count>0 of 0 complete</span><button class="btn btn--sm btn--subtle" data-clear-done>Clear completed</button></div></div>' +
      '<div class="empty-state" data-task-empty><strong>Nothing on the list yet</strong><p>Add the next small step. A short, concrete task is easier to start than a large one.</p></div>' +
      "</div>" +
      '<div class="focus-panel" data-panel="breaks" role="tabpanel">' +
      '<div class="break-hero">' +
      '<span class="eyebrow">After hours, on purpose</span>' +
      '<h3>Step away properly</h3>' +
      '<p>A break is not a failure of focus. It is the reset that makes the next block possible. Choose a short ritual below, or open the After Hours room for soundscapes, breathing and colour work.</p>' +
      '<div class="break-actions">' +
      '<button class="btn" type="button" data-break-min="5">' + MTH.ui.icon("timer") + " Five-minute reset</button>" +
      '<button class="btn btn--ghost" type="button" data-break-min="10">' + MTH.ui.icon("timer") + " Ten-minute break</button>" +
      '<a class="btn btn--ghost" href="' + MTH.esc(MTH.sitePath("entertainment.html#ambient")) + '">' + MTH.ui.icon("audio") + " Open Ambient Studio</a>" +
      "</div></div>" +
      '<div class="break-grid">' +
      '<a class="break-card" href="' + MTH.esc(MTH.sitePath("entertainment.html#ambient")) + '"><span class="break-ico" data-icon="audio" data-icon-size="23"></span><strong>Ambient Studio</strong><span>Layer rain, ocean, forest or a warm night hum while you work or rest.</span><em>Open soundscapes</em></a>' +
      '<a class="break-card" href="' + MTH.esc(MTH.sitePath("entertainment.html#breathing")) + '"><span class="break-ico" data-icon="spark" data-icon-size="23"></span><strong>Breathing Room</strong><span>Follow a paced box-breath or 4-7-8 rhythm for two quiet minutes.</span><em>Start breathing</em></a>' +
      '<a class="break-card" href="' + MTH.esc(MTH.sitePath("entertainment.html#chromatic")) + '"><span class="break-ico" data-icon="palette" data-icon-size="23"></span><strong>Chromatic Lab</strong><span>Build a calm palette or a gradient board when your eyes need something else.</span><em>Explore colour</em></a>' +
      "</div>" +
      '<div class="break-notes">' +
      '<div><span class="break-kicker">20 · 20 · 20</span><p>Every twenty minutes, look at something twenty feet away for twenty seconds. It is the cheapest screen break there is.</p></div>' +
      '<div><span class="break-kicker">Move before you scroll</span><p>Stand, roll your shoulders and take five slow breaths before opening another tab. Motion first, feed second.</p></div>' +
      '<div><span class="break-kicker">Leave the desk</span><p>A real break changes your posture. Water, daylight and a short walk beat another short video.</p></div>' +
      "</div>" +
      "</div>" +
      "</section>"
    );

    MTH.ui.hydrateIcons(stage());
    bindTabs();
    bindTimer();
    bindTasks();
    bindBreaks();
    restore();
  }

  function bindTabs() {
    stage().querySelector(".focus-tabs").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-tab]");
      if (!btn) return;
      setTab(btn.dataset.tab);
    });
  }
  function setTab(tab) {
    if (["timer", "tasks", "breaks"].indexOf(tab) === -1) tab = "timer";
    state.tab = tab;
    MTH.store.set("focus.tab", tab);
    MTH.$$("[data-tab]", stage()).forEach(function (b) {
      var on = b.dataset.tab === tab;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    MTH.$$("[data-panel]", stage()).forEach(function (p) { p.classList.toggle("on", p.dataset.panel === tab); });
  }

  /* ---------------- timer ---------------- */
  function bindTimer() {
    stage().querySelector("[data-presets]").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-preset]");
      if (!btn) return;
      var mins = +btn.dataset.preset;
      setTimer(mins, btn.dataset.break ? "break" : "focus", false);
    });
    stage().querySelector("[data-start]").addEventListener("click", toggleTimer);
    stage().querySelector("[data-reset]").addEventListener("click", function () {
      stopTicking();
      state.timer.running = false;
      state.timer.remaining = state.timer.minutes * 60;
      state.timer.endAt = 0;
      saveTimer();
      paintTimer();
      MTH.toast("Timer reset", "info", 1800);
    });
    stage().querySelector("[data-skip]").addEventListener("click", function () {
      completeTimer(true);
    });
    stage().querySelector("[data-set-custom]").addEventListener("click", function () {
      var v = MTH.clamp(+stage().querySelector("[data-custom]").value || 25, 1, 180);
      setTimer(v, "focus", false);
    });
    stage().querySelector("[data-custom]").addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var v = MTH.clamp(+e.target.value || 25, 1, 180);
        setTimer(v, "focus", false);
      }
    });
  }

  function bindBreaks() {
    stage().querySelectorAll("[data-break-min]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var mins = MTH.clamp(+btn.dataset.breakMin || 5, 1, 60);
        setTimer(mins, "break", true);
        setTab("timer");
        MTH.toast("Break started. Leave the desk if you can.", "ok", 2600);
      });
    });
  }

  function setTimer(minutes, mode, autostart) {
    stopTicking();
    state.timer.minutes = Math.max(1, Math.round(minutes));
    state.timer.remaining = state.timer.minutes * 60;
    state.timer.mode = mode || "focus";
    state.timer.running = false;
    state.timer.endAt = 0;
    saveTimer();
    paintTimer();
    if (autostart) startTimer();
  }

  function toggleTimer() {
    if (state.timer.running) pauseTimer(); else startTimer();
  }

  function startTimer() {
    if (!state.timer.remaining) state.timer.remaining = state.timer.minutes * 60;
    state.timer.running = true;
    state.timer.endAt = Date.now() + state.timer.remaining * 1000;
    ensureAudio();
    saveTimer();
    paintTimer();
    startTicking();
    MTH.toast(state.timer.mode === "break" ? "Break started" : "Focus session started", "ok", 1800);
  }

  function pauseTimer() {
    state.timer.remaining = Math.max(0, (state.timer.endAt - Date.now()) / 1000);
    state.timer.running = false;
    state.timer.endAt = 0;
    stopTicking();
    saveTimer();
    paintTimer();
    MTH.toast("Timer paused", "info", 1600);
  }

  function startTicking() {
    stopTicking();
    state.tick = setInterval(function () {
      if (!state.timer.running) return;
      var left = (state.timer.endAt - Date.now()) / 1000;
      state.timer.remaining = Math.max(0, left);
      paintTimer();
      if (left <= 0) completeTimer(false);
    }, 250);
  }
  function stopTicking() {
    if (state.tick) { clearInterval(state.tick); state.tick = null; }
  }

  function completeTimer(skipped) {
    stopTicking();
    var wasBreak = state.timer.mode === "break";
    var minutes = Math.round(state.timer.minutes);
    if (!skipped && !wasBreak) {
      var stats = statsToday();
      stats.sessions += 1;
      stats.minutes += minutes;
      stats.streak = (stats.streak || 0) + 1;
      MTH.store.set("focus.stats", stats);
    }
    if (!skipped) {
      beep(wasBreak);
      try {
        var note = MTH.store.get("focus.notify", false);
        if (note && window.Notification && Notification.permission === "granted") {
          new Notification(wasBreak ? "Break finished" : "Focus session complete", { body: wasBreak ? "Ready to get back to work?" : "Nice work. Take a short break.", icon: MTH.asset("icons/icon-192.png") });
        }
      } catch (e) {}
      MTH.toast(wasBreak ? "Break finished — ready for the next session?" : "Focus session complete. Take a breather.", "ok", 6000);
    }
    if (wasBreak) setTimer(25, "focus", false);
    else setTimer(5, "break", false);
    paintStats();
  }

  function saveTimer() {
    MTH.store.set("focus.timer", {
      minutes: state.timer.minutes,
      remaining: state.timer.remaining,
      running: state.timer.running,
      endAt: state.timer.endAt,
      mode: state.timer.mode
    });
  }

  function paintTimer() {
    var sec = state.timer.running ? Math.max(0, (state.timer.endAt - Date.now()) / 1000) : state.timer.remaining;
    var total = state.timer.minutes * 60;
    var pct = total ? MTH.clamp(1 - sec / total, 0, 1) : 0;
    var timeEl = stage().querySelector("[data-time]");
    var phaseEl = stage().querySelector("[data-phase]");
    var bar = stage().querySelector(".timer-dial .bar");
    var startBtn = stage().querySelector("[data-start]");
    if (!timeEl) return;
    timeEl.textContent = fmt(sec);
    phaseEl.textContent = state.timer.mode === "break" ? "Break" : state.timer.running ? "Focus · running" : "Focus session";
    if (bar) bar.setAttribute("stroke-dashoffset", String(CIRC * (1 - pct)));
    startBtn.innerHTML = MTH.ui.icon(state.timer.running ? "pause" : "play") + (state.timer.running ? "Pause" : "Start");
    startBtn.classList.toggle("btn--ghost", state.timer.running);
    paintStats();
  }

  function statsToday() {
    var s = MTH.store.get("focus.stats", null);
    if (!s || s.date !== today()) s = { date: today(), sessions: 0, minutes: 0, streak: 0 };
    return s;
  }
  function paintStats() {
    var s = statsToday();
    var host = stage().querySelector("[data-panel=timer]");
    if (!host) return;
    var stats = MTH.$$(".timer-stats .stat b", host);
    if (stats[0]) stats[0].textContent = s.sessions;
    if (stats[1]) stats[1].textContent = s.minutes + " min";
    if (stats[2]) stats[2].textContent = s.streak;
  }

  function ensureAudio() {
    if (state.audioCtx) {
      if (state.audioCtx.state === "suspended") state.audioCtx.resume().catch(function () {});
      return;
    }
    try {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (state.audioCtx.state === "suspended") state.audioCtx.resume().catch(function () {});
    } catch (e) {}
  }
  function beep(isBreak) {
    var ctx = state.audioCtx;
    if (!ctx) return;
    var t = ctx.currentTime;
    var notes = isBreak ? [523.25, 659.25] : [659.25, 880];
    notes.forEach(function (freq, i) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t + i * .22);
      gain.gain.linearRampToValueAtTime(.16, t + i * .22 + .03);
      gain.gain.exponentialRampToValueAtTime(.001, t + i * .22 + .35);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t + i * .22); osc.stop(t + i * .22 + .4);
    });
  }

  /* ---------------- checklist ---------------- */
  function bindTasks() {
    var input = stage().querySelector("[data-task-input]");
    function add() {
      var text = input.value.trim();
      if (!text) { input.focus(); return; }
      state.tasks.push({ id: MTH.uid(), text: text, done: false, at: Date.now() });
      input.value = "";
      saveTasks();
      renderTasks();
      input.focus();
    }
    stage().querySelector("[data-task-add]").addEventListener("click", add);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); add(); } });
    stage().querySelector("[data-task-list]").addEventListener("click", function (e) {
      var del = e.target.closest("[data-task-del]");
      if (del) {
        state.tasks = state.tasks.filter(function (t) { return t.id !== del.dataset.taskDel; });
        saveTasks(); renderTasks(); return;
      }
      var row = e.target.closest("[data-task-id]");
      if (!row) return;
      var task = state.tasks.filter(function (t) { return t.id === row.dataset.taskId; })[0];
      if (task && e.target.matches("input[type=checkbox]")) {
        task.done = e.target.checked;
        saveTasks(); renderTasks();
      }
    });
    stage().querySelector("[data-clear-done]").addEventListener("click", function () {
      state.tasks = state.tasks.filter(function (t) { return !t.done; });
      saveTasks(); renderTasks();
    });
  }
  function saveTasks() { MTH.store.set("focus.tasks", state.tasks); }
  function renderTasks() {
    var list = stage().querySelector("[data-task-list]");
    var empty = stage().querySelector("[data-task-empty]");
    if (!list) return;
    list.innerHTML = state.tasks.map(function (t) {
      return '<li class="task-item' + (t.done ? " done" : "") + '" data-task-id="' + MTH.esc(t.id) + '">' +
        '<input type="checkbox" aria-label="Mark task complete"' + (t.done ? " checked" : "") + ">" +
        '<span class="task-text">' + MTH.esc(t.text) + "</span>" +
        '<button type="button" data-task-del="' + MTH.esc(t.id) + '" aria-label="Delete task">' + MTH.ui.icon("trash") + "</button></li>";
    }).join("");
    var done = state.tasks.filter(function (t) { return t.done; }).length;
    var pct = state.tasks.length ? done / state.tasks.length : 0;
    var bar = stage().querySelector("[data-task-bar]");
    if (bar) bar.style.width = Math.round(pct * 100) + "%";
    var count = stage().querySelector("[data-task-count]");
    if (count) count.textContent = done + " of " + state.tasks.length + " complete";
    if (empty) empty.hidden = state.tasks.length > 0;
    if (list) list.hidden = state.tasks.length === 0;
  }

  /* ---------------- restore ---------------- */
  function restore() {
    var tab = MTH.store.get("focus.tab", "timer");
    if (["timer", "tasks", "breaks"].indexOf(tab) === -1) tab = "timer";
    state.tasks = MTH.store.get("focus.tasks", []);
    if (!Array.isArray(state.tasks)) state.tasks = [];
    renderTasks();
    var t = MTH.store.get("focus.timer", null);
    if (t && typeof t === "object" && t.minutes > 0) {
      state.timer.minutes = MTH.clamp(t.minutes, 1, 180);
      state.timer.mode = t.mode === "break" ? "break" : "focus";
      if (t.running && t.endAt) {
        var left = (t.endAt - Date.now()) / 1000;
        if (left > 0) {
          state.timer.running = true;
          state.timer.endAt = t.endAt;
          state.timer.remaining = left;
          startTicking();
        } else {
          state.timer.running = false;
          state.timer.remaining = state.timer.minutes * 60;
          state.timer.endAt = 0;
          saveTimer();
        }
      } else {
        state.timer.remaining = MTH.clamp(t.remaining || state.timer.minutes * 60, 0, state.timer.minutes * 60);
      }
    }
    setTab(tab);
    paintTimer();
    paintStats();
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
