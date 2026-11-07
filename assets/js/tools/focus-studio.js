/* Focus Studio — timer, checklist and Schulte grid */
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
    tasks: [],
    game: { size: 5, next: 1, running: false, startedAt: 0, mistakes: 0, timer: null, values: [] }
  };

  function stage() { return MTH.tool.stage(); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  function fmtMs(ms) { return (ms / 1000).toFixed(1) + " s"; }

  function shell() {
    MTH.tool.mount(
      '<section class="panel">' +
      '<div class="focus-tabs" role="tablist" aria-label="Focus Studio sections">' +
      '<button type="button" class="on" data-tab="timer" role="tab" aria-selected="true">' + MTH.ui.icon("timer") + " Timer</button>" +
      '<button type="button" data-tab="tasks" role="tab" aria-selected="false">' + MTH.ui.icon("check") + " Checklist</button>" +
      '<button type="button" data-tab="game" role="tab" aria-selected="false">' + MTH.ui.icon("grid") + " Number Grid</button>" +
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
      '<div class="focus-panel" data-panel="game" role="tabpanel">' +
      '<div class="game-head"><div><div class="settings-title" style="margin-bottom:4px"><h3>Schulte number grid</h3></div><p class="small muted">Click the numbers in order as fast as you can. It trains visual search and peripheral attention.</p></div>' +
      '<div class="inline"><select class="select" data-game-size style="width:150px" aria-label="Grid size"><option value="3">3 × 3 · warm up</option><option value="4">4 × 4</option><option value="5" selected>5 × 5 · classic</option><option value="6">6 × 6 · hard</option></select><button class="btn" data-game-start>' + MTH.ui.icon("play") + "Start</button></div></div>" +
      '<div class="game-stats" style="margin-top:16px">' +
      MTH.ui.stat("Next", "—") + MTH.ui.stat("Time", "0.0 s") + MTH.ui.stat("Best", "—") + MTH.ui.stat("Mistakes", "0") +
      "</div>" +
      '<div class="game-grid" data-game-grid aria-label="Number grid"></div>' +
      '<div class="status" data-game-status></div>' +
      "</div>" +
      "</section>"
    );

    bindTabs();
    bindTimer();
    bindTasks();
    bindGame();
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
    state.tab = tab;
    MTH.store.set("focus.tab", tab);
    MTH.$$("[data-tab]", stage()).forEach(function (b) {
      var on = b.dataset.tab === tab;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    MTH.$$("[data-panel]", stage()).forEach(function (p) { p.classList.toggle("on", p.dataset.panel === tab); });
    if (tab === "game") renderGame();
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

  /* ---------------- game ---------------- */
  function bindGame() {
    stage().querySelector("[data-game-size]").addEventListener("change", function (e) {
      state.game.size = +e.target.value || 5;
      MTH.store.set("focus.grid", state.game.size);
      resetGame();
    });
    stage().querySelector("[data-game-start]").addEventListener("click", startGame);
    stage().querySelector("[data-game-grid]").addEventListener("click", function (e) {
      var cell = e.target.closest("[data-num]");
      if (!cell || !state.game.running) return;
      var num = +cell.dataset.num;
      if (num === state.game.next) {
        cell.classList.add("hit");
        cell.classList.remove("miss");
        cell.disabled = true;
        state.game.next++;
        paintGameStats();
        if (state.game.next > state.game.size * state.game.size) finishGame();
      } else {
        state.game.mistakes++;
        cell.classList.add("miss");
        setTimeout(function () { cell.classList.remove("miss"); }, 400);
        paintGameStats();
      }
    });
  }

  function resetGame() {
    if (state.game.timer) { clearInterval(state.game.timer); state.game.timer = null; }
    state.game.running = false;
    state.game.next = 1;
    state.game.mistakes = 0;
    state.game.startedAt = 0;
    stage().querySelector("[data-game-status]").textContent = "";
    renderGame();
    paintGameStats();
  }

  function shuffled(size) {
    var total = size * size;
    var values = [];
    for (var i = 1; i <= total; i++) values.push(i);
    for (var k = values.length - 1; k > 0; k--) {
      var j = Math.floor(Math.random() * (k + 1));
      var tmp = values[k]; values[k] = values[j]; values[j] = tmp;
    }
    return values;
  }

  function renderGame() {
    var grid = stage().querySelector("[data-game-grid]");
    if (!grid) return;
    var size = state.game.size;
    if (!state.game.values.length || state.game.values.length !== size * size) state.game.values = shuffled(size);
    grid.style.gridTemplateColumns = "repeat(" + size + ", minmax(0, 1fr))";
    grid.innerHTML = state.game.values.map(function (n) {
      return '<button type="button" class="game-cell" data-num="' + n + '">' + n + "</button>";
    }).join("");
  }

  function startGame() {
    if (state.game.timer) clearInterval(state.game.timer);
    state.game.size = +stage().querySelector("[data-game-size]").value || 5;
    state.game.values = shuffled(state.game.size);
    state.game.running = true;
    state.game.next = 1;
    state.game.mistakes = 0;
    state.game.startedAt = performance.now();
    renderGame();
    paintGameStats();
    stage().querySelector("[data-game-status]").textContent = "Find 1 first. The timer is running.";
    state.game.timer = setInterval(function () {
      if (!state.game.running) return;
      var t = (performance.now() - state.game.startedAt) / 1000;
      var stats = MTH.$$(".game-stats .stat b", stage());
      if (stats[1]) stats[1].textContent = t.toFixed(1) + " s";
    }, 80);
  }

  function finishGame() {
    state.game.running = false;
    if (state.game.timer) { clearInterval(state.game.timer); state.game.timer = null; }
    var elapsed = performance.now() - state.game.startedAt;
    var key = "grid" + state.game.size;
    var best = MTH.store.get("focus.best", {});
    if (!best || typeof best !== "object") best = {};
    var isBest = !best[key] || elapsed < best[key];
    if (isBest) { best[key] = elapsed; MTH.store.set("focus.best", best); }
    paintGameStats();
    var msg = "Complete in " + fmtMs(elapsed) + " with " + state.game.mistakes + " mistake" + (state.game.mistakes === 1 ? "" : "s") + "." + (isBest ? " New personal best!" : "");
    stage().querySelector("[data-game-status]").textContent = msg;
    MTH.toast(isBest ? "New best time!" : "Grid complete", "ok", 3600);
    beep(false);
  }

  function paintGameStats() {
    var host = stage();
    if (!host) return;
    var stats = MTH.$$(".game-stats .stat b", host);
    if (!stats.length) return;
    stats[0].textContent = state.game.running ? state.game.next : "—";
    if (!state.game.running) stats[1].textContent = "0.0 s";
    stats[3].textContent = state.game.mistakes;
    var best = MTH.store.get("focus.best", {});
    var key = "grid" + state.game.size;
    stats[2].textContent = best && best[key] ? fmtMs(best[key]) : "—";
  }

  /* ---------------- restore ---------------- */
  function restore() {
    var tab = MTH.store.get("focus.tab", "timer");
    if (["timer", "tasks", "game"].indexOf(tab) === -1) tab = "timer";
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
    var size = MTH.store.get("focus.grid", 5);
    if ([3, 4, 5, 6].indexOf(size) === -1) size = 5;
    state.game.size = size;
    var sizeSelect = stage().querySelector("[data-game-size]");
    if (sizeSelect) sizeSelect.value = String(size);
    setTab(tab);
    paintTimer();
    paintStats();
    renderGame();
    paintGameStats();
  }

  function init() { shell(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
