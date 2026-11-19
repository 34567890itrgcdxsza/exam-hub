(function () {
  "use strict";

  function injectStyles() {
    if (document.getElementById("all-questions-bank-style")) return;
    var style = document.createElement("style");
    style.id = "all-questions-bank-style";
    style.textContent = [
      ".all-bank-card {",
      "  grid-column: 1 / -1;",
      "  background: var(--card);",
      "  border: 1.5px solid var(--primary);",
      "  color: var(--text);",
      "  box-shadow: var(--sh);",
      "  position: relative;",
      "}",
      ".all-bank-card > .art {",
      "  background: linear-gradient(135deg, var(--surface-inset), var(--card));",
      "  color: var(--primary);",
      "  border-bottom: 1px solid var(--line);",
      "}",
      ".all-bank-card .ring {",
      "  background: conic-gradient(var(--primary) 100%, var(--line) 0);",
      "}",
      ".all-bank-card b {",
      "  font-family: var(--font-ar);",
      "  font-size: 19px;",
      "  font-weight: 800;",
      "  color: var(--primary);",
      "}",
      '[data-theme="dark"] .all-bank-card b { color: var(--text); }',
      ".all-bank-card span {",
      "  font-family: var(--font-sans);",
      "  font-size: 14px;",
      "  color: var(--text-sec);",
      "}",
      ".all-bank-card small {",
      "  color: var(--primary);",
      "  font-weight: 700;",
      "  font-size: 13.5px;",
      "}",
      '[data-theme="dark"] .all-bank-card small { color: var(--gold); }',
      ".q-head-meta {",
      "  display: flex;",
      "  align-items: center;",
      "  gap: 8px;",
      "  flex-wrap: wrap;",
      "}",
      ".q-source-badge {",
      "  display: inline-flex;",
      "  align-items: center;",
      "  gap: 5px;",
      "  padding: 3px 10px;",
      "  border-radius: 999px;",
      "  font-family: var(--font-ar);",
      "  font-size: 12px;",
      "  font-weight: 700;",
      "  color: var(--text);",
      "  background: var(--surface-inset);",
      "  border: 1px solid var(--line);",
      "  border-inline-start: 3px solid var(--badge-c, var(--primary));",
      "  white-space: nowrap;",
      "}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function getBaseCount() {
    if (typeof BASE_SECTIONS !== "undefined") return BASE_SECTIONS;
    return typeof L !== "undefined" && Array.isArray(L) ? L.length : 0;
  }

  function getAccentColor(idx) {
    if (typeof acs !== "undefined" && Array.isArray(acs) && acs[idx]) {
      return acs[idx];
    }
    return "var(--primary)";
  }

  function launchCombinedBank() {
    if (typeof L === "undefined" || !Array.isArray(L) || typeof start !== "function") {
      return;
    }
    var baseCount = getBaseCount();
    while (L.length > baseCount) L.pop();

    var combinedQuestions = [];
    for (var sIdx = 0; sIdx < baseCount && sIdx < L.length; sIdx++) {
      var sec = L[sIdx];
      if (!sec || !Array.isArray(sec.q)) continue;
      for (var qIdx = 0; qIdx < sec.q.length; qIdx++) {
        var item = sec.q[qIdx];
        combinedQuestions.push(Object.assign({}, item, {
          _sourceName: sec.n,
          _sourceColor: getAccentColor(sIdx),
          _isEssay: Boolean(sec.essay || item.isEssay || item.type === "essay" || (item.o == null && item.a != null)),
          _isCode: Boolean(item.isCode || sec.isCode)
        }));
      }
    }

    if (!combinedQuestions.length) return;

    L.push({
      n: "بنك الأسئلة الشامل",
      s: "All Questions Combined — Complete Question Bank",
      combined: true,
      q: combinedQuestions
    });
    start(L.length - 1);
  }

  function injectHomeCard() {
    if (typeof L === "undefined" || !Array.isArray(L)) return;
    var grid = document.querySelector("#app .grid");
    if (!grid) return;
    if (document.getElementById("all-bank")) return;

    var baseCount = getBaseCount();
    var totalQuestions = 0;
    for (var i = 0; i < baseCount && i < L.length; i++) {
      if (L[i] && Array.isArray(L[i].q)) {
        totalQuestions += L[i].q.length;
      }
    }

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lec all-bank-card";
    btn.id = "all-bank";
    btn.style.setProperty("--ac", "var(--primary)");
    btn.style.setProperty("--d", "0ms");
    btn.innerHTML =
      '<div class="art">' +
        '<svg viewBox="0 0 200 110"><g fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M40 34l60-18 60 18-60 18z" fill="currentColor" opacity=".14"/>' +
        '<path d="M40 34l60-18 60 18-60 18z"/>' +
        '<path d="M40 55l60 18 60-18"/>' +
        '<path d="M40 76l60 18 60-18"/>' +
        '</g><circle cx="100" cy="34" r="3.5" fill="currentColor"/></svg>' +
      "</div>" +
      '<div class="ring" style="--p:100"><div class="badge">📚</div></div>' +
      "<div>" +
        "<b>📚 بنك الأسئلة الشامل (كل الأقسام)</b>" +
        "<span>All Questions Combined — Complete Question Bank</span>" +
        "<small>" + totalQuestions + " سؤال · جميع أسئلة CCNA R&S IV مجمّعة بالترتيب في مكان واحد (الشيتات والأسئلة المولّدة)</small>" +
        '<i class="mini"><b style="width:100%"></b></i>' +
      "</div>";

    btn.onclick = launchCombinedBank;
    grid.insertBefore(btn, grid.firstChild);
  }

  function ensureSourceBadge() {
    if (typeof L === "undefined" || typeof li === "undefined" || typeof qi === "undefined") return;
    var sec = L[li];
    if (!sec || !sec.combined || !sec.q || !sec.q[qi]) return;
    var q = sec.q[qi];
    if (!q._sourceName) return;

    var head = document.querySelector("#app .q .q-card-head");
    if (!head || head.querySelector(".q-source-badge")) return;

    var kind = head.querySelector(".kind");
    var badge = document.createElement("span");
    badge.className = "q-source-badge";
    badge.style.setProperty("--badge-c", q._sourceColor || "var(--primary)");
    badge.textContent = "📂 " + q._sourceName;

    if (kind && kind.parentNode) {
      var wrap = document.createElement("div");
      wrap.className = "q-head-meta";
      kind.parentNode.insertBefore(wrap, kind);
      wrap.appendChild(kind);
      wrap.appendChild(badge);
    } else {
      head.insertBefore(badge, head.firstChild);
    }
  }

  function syncUI() {
    injectStyles();
    injectHomeCard();
    ensureSourceBadge();
  }

  function init() {
    syncUI();
    var appEl = document.getElementById("app");
    if (appEl && typeof MutationObserver !== "undefined") {
      var observer = new MutationObserver(function () {
        syncUI();
      });
      observer.observe(appEl, { childList: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
