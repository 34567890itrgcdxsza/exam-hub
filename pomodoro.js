(function () {
  "use strict";

  const PREFS_KEY = "ccna4_timer_prefs";
  const PRESETS = [
    { f: 25, b: 5, label: "🍅 25/5" },
    { f: 50, b: 10, label: "⚡ 50/10" },
    { f: 52, b: 17, label: "🧠 52/17" },
    { f: 90, b: 20, label: "🌊 90/20" }
  ];

  // State & Preferences
  let prefs = { focusMins: 25, breakMins: 5, sessions: 0, collapsed: false };
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    if (saved && typeof saved === "object") {
      if (saved.focusMins >= 1 && saved.focusMins <= 180) prefs.focusMins = Math.round(saved.focusMins);
      if (saved.breakMins >= 1 && saved.breakMins <= 60) prefs.breakMins = Math.round(saved.breakMins);
      if (saved.sessions >= 0) prefs.sessions = Math.floor(saved.sessions);
      if (typeof saved.collapsed === "boolean") prefs.collapsed = saved.collapsed;
    }
  } catch (e) {}

  let phase = "focus"; // "focus" | "break"
  let remaining = prefs.focusMins * 60;
  let running = false;
  let intervalId = null;
  let alertType = null; // null | "focus_done" | "break_done"
  let audioCtx = null;

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {}
  }

  function unlockAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioCtx) audioCtx = new AudioCtx();
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    } catch (e) {
      return null;
    }
  }

  document.addEventListener("pointerdown", unlockAudio, { once: true, passive: true });
  document.addEventListener("keydown", unlockAudio, { once: true, passive: true });

  // Pleasant relaxing completion chime (Focus ends)
  function playFocusChime() {
    const ctx = unlockAudio();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const start = t + i * 0.16;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.56);
      });
    } catch (e) {}
  }

  // Distinct energetic multi-beep wake-up alarm (Break ends)
  function playBreakWakeupChime() {
    const ctx = unlockAudio();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      for (let rep = 0; rep < 3; rep++) {
        const base = t + rep * 0.46;
        const o1 = ctx.createOscillator();
        const g1 = ctx.createGain();
        o1.type = "triangle";
        o1.frequency.setValueAtTime(880, base);
        g1.gain.setValueAtTime(0.001, base);
        g1.gain.linearRampToValueAtTime(0.28, base + 0.015);
        g1.gain.exponentialRampToValueAtTime(0.0001, base + 0.16);
        o1.connect(g1);
        g1.connect(ctx.destination);
        o1.start(base);
        o1.stop(base + 0.17);

        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.type = "triangle";
        o2.frequency.setValueAtTime(1174.66, base + 0.16);
        g2.gain.setValueAtTime(0.001, base + 0.16);
        g2.gain.linearRampToValueAtTime(0.32, base + 0.175);
        g2.gain.exponentialRampToValueAtTime(0.0001, base + 0.36);
        o2.connect(g2);
        g2.connect(ctx.destination);
        o2.start(base + 0.16);
        o2.stop(base + 0.37);
      }
    } catch (e) {}
  }

  function formatMMSS(sec) {
    const s = Math.max(0, Math.floor(sec));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  }

  function injectStyles() {
    if (document.getElementById("ai-pomo-styles")) return;
    const style = document.createElement("style");
    style.id = "ai-pomo-styles";
    style.textContent = `
      #ai-pomo-dock {
        position: fixed;
        bottom: 16px;
        left: 16px;
        z-index: 9990;
        direction: rtl;
        font-family: var(--font-ar, "Tajawal", system-ui, sans-serif);
        max-width: calc(100vw - 32px);
      }
      .pomo-card {
        background: var(--card, #f2ebe2);
        color: var(--text, #111);
        border: 1.5px solid var(--line, #dcd5cc);
        border-radius: 12px;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        transition: border-color 0.25s ease, background 0.25s ease, transform 0.2s ease;
      }
      .pomo-card.is-break {
        border-color: var(--ok, #115e3b);
        background: var(--okbg, #dcf2e6);
      }
      .pomo-card.is-warning {
        border-color: var(--bad, #9e1c1c) !important;
        background: var(--badbg, #f9e1e1) !important;
        animation: aiPomoPulse 1.2s infinite ease-in-out;
      }
      @keyframes aiPomoPulse {
        0%, 100% { box-shadow: 0 6px 20px rgba(158, 28, 28, 0.22); }
        50% { box-shadow: 0 6px 28px rgba(158, 28, 28, 0.48); }
      }
      .pomo-top-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
      }
      .pomo-badges {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .pomo-phase-pill {
        font-size: 12px;
        font-weight: 700;
        padding: 3px 9px;
        border-radius: 999px;
        background: var(--surface-inset, #e8e0d5);
        border: 1px solid var(--line, #dcd5cc);
        color: var(--primary, #7a1f33);
        white-space: nowrap;
      }
      .pomo-card.is-break .pomo-phase-pill {
        color: var(--ok, #115e3b);
        border-color: var(--ok, #115e3b);
        background: var(--card, #fff);
      }
      .pomo-sessions-pill {
        font-family: var(--font-code, monospace);
        font-size: 11.5px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 999px;
        background: var(--surface-inset, #e8e0d5);
        border: 1px solid var(--line, #dcd5cc);
        color: var(--text-sec, #393939);
        white-space: nowrap;
      }
      .pomo-clock-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .pomo-digits {
        font-family: var(--font-code, ui-monospace, monospace);
        font-size: 20px;
        font-weight: 800;
        letter-spacing: 0.6px;
        color: var(--text, #000);
        font-variant-numeric: tabular-nums;
        direction: ltr;
        min-width: 62px;
        text-align: center;
      }
      .pomo-card.is-warning .pomo-digits {
        color: var(--bad, #9e1c1c);
      }
      .pomo-btn-group {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .pomo-btn {
        background: var(--surface-inset, #e8e0d5);
        color: var(--text, #111);
        border: 1px solid var(--line, #dcd5cc);
        border-radius: 7px;
        height: 30px;
        min-width: 30px;
        padding: 0 8px;
        font-family: inherit;
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        touch-action: manipulation;
      }
      .pomo-btn:hover {
        border-color: var(--primary, #7a1f33);
        color: var(--primary, #7a1f33);
        background: var(--card, #fff);
      }
      .pomo-btn.primary {
        background: var(--primary, #7a1f33);
        border-color: var(--primary, #7a1f33);
        color: var(--primary-text, #fff);
      }
      .pomo-btn.primary:hover {
        background: var(--primary-hover, #5e1827);
        color: var(--primary-text, #fff);
      }
      .pomo-settings-row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding-top: 7px;
        border-top: 1px dashed var(--line, #dcd5cc);
        flex-wrap: wrap;
      }
      .pomo-preset {
        background: var(--surface-inset, #e8e0d5);
        color: var(--text-sec, #393939);
        border: 1px solid var(--line, #dcd5cc);
        border-radius: 6px;
        padding: 3px 7px;
        font-family: inherit;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
      }
      .pomo-preset:hover {
        border-color: var(--primary, #7a1f33);
        color: var(--primary, #7a1f33);
      }
      .pomo-preset.active {
        background: var(--primary, #7a1f33);
        color: var(--primary-text, #fff);
        border-color: var(--primary, #7a1f33);
      }
      .pomo-inputs {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding-inline-start: 6px;
        border-inline-start: 1px solid var(--line, #dcd5cc);
      }
      .pomo-input-lbl {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11.5px;
        font-weight: 700;
        color: var(--muted, #525151);
      }
      .pomo-num {
        width: 46px;
        padding: 3px 4px;
        border-radius: 6px;
        border: 1px solid var(--line, #dcd5cc);
        background: var(--surface-inset, #e8e0d5);
        color: var(--text, #000);
        font-family: var(--font-code, monospace);
        font-size: 12px;
        font-weight: 700;
        text-align: center;
        direction: ltr;
      }
      .pomo-num:focus {
        outline: 2px solid var(--primary, #7a1f33);
        border-color: var(--primary, #7a1f33);
      }
      .pomo-collapsed-pill {
        background: var(--card, #f2ebe2);
        color: var(--text, #111);
        border: 1.5px solid var(--primary, #7a1f33);
        border-radius: 999px;
        padding: 7px 14px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-weight: 700;
        font-size: 13px;
        touch-action: manipulation;
      }
      .pomo-collapsed-pill.is-break {
        border-color: var(--ok, #115e3b);
        background: var(--okbg, #dcf2e6);
      }
      #ai-pomo-banner {
        position: fixed;
        top: 14px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        width: min(640px, calc(100vw - 24px));
        direction: rtl;
        font-family: var(--font-ar, "Tajawal", system-ui, sans-serif);
      }
      .pomo-alert {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 13px 16px;
        border-radius: 12px;
        border: 2px solid var(--bad, #9e1c1c);
        background: var(--badbg, #f9e1e1);
        color: var(--text, #111);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
        flex-wrap: wrap;
        animation: aiPomoDrop 0.28s ease-out;
      }
      .pomo-alert.focus-done {
        border-color: var(--ok, #115e3b);
        background: var(--okbg, #dcf2e6);
      }
      @keyframes aiPomoDrop {
        from { opacity: 0; transform: translateY(-12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .pomo-alert-title {
        font-size: 15px;
        font-weight: 800;
        color: var(--bad, #9e1c1c);
        margin-bottom: 2px;
      }
      .pomo-alert.focus-done .pomo-alert-title {
        color: var(--ok, #115e3b);
      }
      .pomo-alert-sub {
        font-size: 13px;
        color: var(--text-sec, #333);
        margin: 0;
      }
      .pomo-alert-acts {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .pomo-alert-btn {
        border: none;
        border-radius: 8px;
        padding: 8px 14px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        background: var(--bad, #9e1c1c);
        color: #fff;
      }
      .pomo-alert.focus-done .pomo-alert-btn {
        background: var(--ok, #115e3b);
      }
      .pomo-alert-btn.ghost {
        background: var(--card, #fff);
        color: var(--text, #111);
        border: 1px solid var(--line, #ccc);
      }
      @media (max-width: 640px) {
        #ai-pomo-dock {
          bottom: 10px;
          left: 10px;
          right: 10px;
          max-width: none;
        }
        .pomo-card {
          padding: 9px 10px;
        }
        .pomo-top-row {
          justify-content: space-between;
        }
        .pomo-inputs {
          border-inline-start: none;
          padding-inline-start: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .pomo-card.is-warning { animation: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function startInterval() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(tick, 1000);
  }

  function stopInterval() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function switchPhase(nextPhase, autoStart) {
    unlockAudio();
    phase = nextPhase;
    remaining = (nextPhase === "focus" ? prefs.focusMins : prefs.breakMins) * 60;
    alertType = null;
    running = !!autoStart;
    if (running) startInterval();
    else stopInterval();
    renderBanner();
    renderDock();
  }

  function tick() {
    if (!running) return;
    if (remaining > 0) {
      remaining--;
      if (remaining === 0) {
        running = false;
        stopInterval();
        if (phase === "focus") {
          prefs.sessions++;
          savePrefs();
          alertType = "focus_done";
          playFocusChime();
        } else {
          alertType = "break_done";
          playBreakWakeupChime();
        }
        renderBanner();
        renderDock();
        return;
      }
    }
    updateDigitsOnly();
  }

  function updateDigitsOnly() {
    const el = document.getElementById("ai-pomo-digits");
    if (el) el.textContent = formatMMSS(remaining);
    const card = document.getElementById("ai-pomo-card");
    if (card) {
      card.classList.toggle("is-warning", remaining <= 60 && remaining > 0);
    }
  }

  function renderBanner() {
    let wrap = document.getElementById("ai-pomo-banner");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "ai-pomo-banner";
      document.body.appendChild(wrap);
    }
    if (!alertType) {
      wrap.innerHTML = "";
      return;
    }
    if (alertType === "focus_done") {
      wrap.innerHTML = `
        <div class="pomo-alert focus-done" role="alert">
          <div>
            <div class="pomo-alert-title">أحسنت! انتهت جلسة التركيز 🎉</div>
            <p class="pomo-alert-sub">إجمالي الجلسات المكتملة: 🍅 ${prefs.sessions} · استمتع باستراحة لمدة ${prefs.breakMins} دقيقة.</p>
          </div>
          <div class="pomo-alert-acts">
            <button type="button" class="pomo-alert-btn" id="pomo-start-next">▶ بدء الاستراحة</button>
            <button type="button" class="pomo-alert-btn ghost" id="pomo-close-alert">إغلاق</button>
          </div>
        </div>
      `;
    } else {
      wrap.innerHTML = `
        <div class="pomo-alert break-done" role="alert">
          <div>
            <div class="pomo-alert-title">انتهى وقت الراحة! 🔔 ارجع للمذاكرة</div>
            <p class="pomo-alert-sub">حان وقت بدء جلسة التركيز الجديدة (${prefs.focusMins} دقيقة).</p>
          </div>
          <div class="pomo-alert-acts">
            <button type="button" class="pomo-alert-btn" id="pomo-start-next">▶ بدء جلسة التركيز الآن</button>
            <button type="button" class="pomo-alert-btn ghost" id="pomo-close-alert">إغلاق</button>
          </div>
        </div>
      `;
    }

    const nextBtn = document.getElementById("pomo-start-next");
    if (nextBtn) {
      nextBtn.onclick = () => switchPhase(alertType === "focus_done" ? "break" : "focus", true);
    }
    const closeBtn = document.getElementById("pomo-close-alert");
    if (closeBtn) {
      closeBtn.onclick = () => {
        alertType = null;
        renderBanner();
      };
    }
  }

  function renderDock() {
    let dock = document.getElementById("ai-pomo-dock");
    if (!dock) {
      dock = document.createElement("div");
      dock.id = "ai-pomo-dock";
      document.body.appendChild(dock);
    }

    const isBreak = phase === "break";
    const isWarn = remaining <= 60 && remaining > 0;

    if (prefs.collapsed) {
      dock.innerHTML = `
        <button type="button" class="pomo-collapsed-pill ${isBreak ? "is-break" : ""}" id="pomo-expand-btn" title="توسيع مؤقت البومودورو">
          <span>${isBreak ? "☕" : "🔥"}</span>
          <span id="ai-pomo-digits" style="font-family:var(--font-code,monospace);direction:ltr;">${formatMMSS(remaining)}</span>
          <span>🍅 ${prefs.sessions}</span>
          <span>▴</span>
        </button>
      `;
      document.getElementById("pomo-expand-btn").onclick = () => {
        unlockAudio();
        prefs.collapsed = false;
        savePrefs();
        renderDock();
      };
      return;
    }

    dock.innerHTML = `
      <div class="pomo-card ${isBreak ? "is-break" : ""} ${isWarn ? "is-warning" : ""}" id="ai-pomo-card">
        <div class="pomo-top-row">
          <div class="pomo-badges">
            <span class="pomo-phase-pill">${isBreak ? "☕ وقت استراحة" : "🔥 جلسة تركيز"}</span>
            <span class="pomo-sessions-pill" title="جلسات التركيز المكتملة">🍅 ${prefs.sessions}</span>
          </div>
          <div class="pomo-clock-row">
            <span class="pomo-digits" id="ai-pomo-digits" aria-live="polite">${formatMMSS(remaining)}</span>
            <div class="pomo-btn-group">
              <button type="button" class="pomo-btn primary" id="pomo-toggle" title="${running ? "إيقاف مؤقت" : "تشغيل"}">${running ? "⏸ إيقاف" : "▶ تشغيل"}</button>
              <button type="button" class="pomo-btn" id="pomo-reset" title="إعادة ضبط">↺</button>
              <button type="button" class="pomo-btn" id="pomo-skip" title="تخطي إلى ${isBreak ? "جلسة التركيز" : "وقت الاستراحة"}">⏭</button>
              <button type="button" class="pomo-btn" id="pomo-test-sound" title="تجربة الصوت">🔔</button>
              <button type="button" class="pomo-btn" id="pomo-collapse" title="تصغير الشريط">▾</button>
            </div>
          </div>
        </div>
        <div class="pomo-settings-row">
          ${PRESETS.map(p => `<button type="button" class="pomo-preset ${prefs.focusMins === p.f && prefs.breakMins === p.b ? "active" : ""}" data-f="${p.f}" data-b="${p.b}">${p.label}</button>`).join("")}
          <div class="pomo-inputs">
            <label class="pomo-input-lbl">
              <span>تركيز</span>
              <input type="number" class="pomo-num" id="pomo-focus-in" min="1" max="180" value="${prefs.focusMins}" aria-label="دقائق التركيز">
            </label>
            <label class="pomo-input-lbl">
              <span>راحة</span>
              <input type="number" class="pomo-num" id="pomo-break-in" min="1" max="60" value="${prefs.breakMins}" aria-label="دقائق الراحة">
            </label>
          </div>
        </div>
      </div>
    `;

    document.getElementById("pomo-toggle").onclick = () => {
      unlockAudio();
      if (remaining <= 0) {
        remaining = (phase === "focus" ? prefs.focusMins : prefs.breakMins) * 60;
        alertType = null;
        renderBanner();
      }
      running = !running;
      if (running) startInterval();
      else stopInterval();
      renderDock();
    };

    document.getElementById("pomo-reset").onclick = () => {
      unlockAudio();
      running = false;
      stopInterval();
      remaining = (phase === "focus" ? prefs.focusMins : prefs.breakMins) * 60;
      alertType = null;
      renderBanner();
      renderDock();
    };

    document.getElementById("pomo-skip").onclick = () => {
      switchPhase(phase === "focus" ? "break" : "focus", running);
    };

    document.getElementById("pomo-test-sound").onclick = () => {
      unlockAudio();
      if (phase === "break") playFocusChime();
      else playBreakWakeupChime();
    };

    document.getElementById("pomo-collapse").onclick = () => {
      unlockAudio();
      prefs.collapsed = true;
      savePrefs();
      renderDock();
    };

    dock.querySelectorAll(".pomo-preset").forEach(btn => {
      btn.onclick = () => {
        unlockAudio();
        prefs.focusMins = +btn.dataset.f;
        prefs.breakMins = +btn.dataset.b;
        savePrefs();
        remaining = (phase === "focus" ? prefs.focusMins : prefs.breakMins) * 60;
        alertType = null;
        renderBanner();
        renderDock();
      };
    });

    const fIn = document.getElementById("pomo-focus-in");
    fIn.onchange = () => {
      unlockAudio();
      const val = parseInt(fIn.value, 10);
      if (!isNaN(val) && val >= 1 && val <= 180) {
        prefs.focusMins = val;
        savePrefs();
        if (phase === "focus") {
          remaining = val * 60;
          alertType = null;
          renderBanner();
        }
        renderDock();
      } else {
        fIn.value = prefs.focusMins;
      }
    };

    const bIn = document.getElementById("pomo-break-in");
    bIn.onchange = () => {
      unlockAudio();
      const val = parseInt(bIn.value, 10);
      if (!isNaN(val) && val >= 1 && val <= 60) {
        prefs.breakMins = val;
        savePrefs();
        if (phase === "break") {
          remaining = val * 60;
          alertType = null;
          renderBanner();
        }
        renderDock();
      } else {
        bIn.value = prefs.breakMins;
      }
    };
  }

  function init() {
    injectStyles();
    renderDock();
    renderBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
