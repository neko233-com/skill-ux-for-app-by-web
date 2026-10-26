/* ux-core.js — skill-ux-for-app-by-web 运行时（构建时内联） */
(function () {
  "use strict";
  var doc = document;
  var app = doc.getElementById("ux-app");
  if (!app) return;

  var screens = {};
  var screenEls = [];
  var history = [];
  var current = null;

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  function collect() {
    screenEls = $$(".ux-screen", app);
    screenEls.forEach(function (el) {
      screens[el.getAttribute("data-screen")] = el;
    });
  }

  function setActiveTab(id) {
    $$("[data-goto-tab]").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-goto-tab") === id);
    });
  }

  function runScreenHooks(el) {
    if (!el) return;
    // progress bars
    $$(".ux-progress__bar[data-value]", el).forEach(function (bar) {
      var v = parseFloat(bar.getAttribute("data-value")) || 0;
      bar.style.width = "0%";
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { bar.style.width = Math.max(0, Math.min(100, v * 100)) + "%"; });
      });
    });
    // chart bars
    $$(".ux-chart__bar[data-h]", el).forEach(function (bar) {
      var h = parseFloat(bar.getAttribute("data-h")) || 0;
      bar.style.height = "0%";
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { bar.style.height = Math.max(2, Math.min(100, h)) + "%"; });
      });
    });
    // exp / hp fills
    $$(".ux-player__exp > i[data-value], .ux-hp__fill[data-value]", el).forEach(function (fill) {
      var v = parseFloat(fill.getAttribute("data-value")) || 0;
      var target = Math.max(0, Math.min(100, v * 100)) + "%";
      fill.style.width = "0%";
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { fill.style.width = target; });
      });
    });
    // demo: hp drain
    if (app.getAttribute("data-demo-hp") === "1") {
      $$("[data-demo-drain]", el).forEach(function (fill) {
        var v = parseFloat(fill.getAttribute("data-value")) || 1;
        setTimeout(function () { fill.style.width = Math.max(8, v * 0.62 * 100) + "%"; }, 900);
      });
    }
  }

  function go(id, opts) {
    opts = opts || {};
    if (!screens[id] || id === current) {
      if (id === current && opts.force) { /* noop */ } else { return; }
    }
    var from = current ? screens[current] : null;
    var to = screens[id];
    if (from && !opts.back) history.push(current);
    if (from) {
      from.classList.remove("is-active");
      from.classList.toggle("is-back", !opts.back);
    }
    to.classList.remove("is-back");
    to.classList.add("is-active");
    var sc = $(".ux-scroll", to);
    if (sc && !opts.keepScroll) sc.scrollTop = 0;
    current = id;
    setActiveTab(id);
    runScreenHooks(to);
    try { doc.title = (app.getAttribute("data-title") || "原型") + " · " + (to.getAttribute("data-title") || id); } catch (e) {}
  }

  function back() {
    if (history.length > 1) {
      history.pop();
      var prev = history[history.length - 1];
      go(prev, { back: true, force: true });
    } else if (history.length === 1) {
      history.pop();
      var first = screenEls.length ? screenEls[0].getAttribute("data-screen") : current;
      go(first, { back: true, force: true });
    }
  }

  /* toast */
  var toastEl = $(".ux-toast", app);
  var toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-open");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-open"); }, 1900);
  }

  /* modal */
  var modalEl = $(".ux-modal", app);
  function openModal(title, body, okLabel, onOk) {
    if (!modalEl) { toast(title); return; }
    $(".ux-modal__title", modalEl).textContent = title || "";
    $(".ux-modal__body", modalEl).textContent = body || "";
    var okBtn = $("[data-modal-ok]", modalEl);
    if (okLabel) okBtn.textContent = okLabel;
    modalEl.classList.add("is-open");
    modalEl._onOk = onOk || null;
  }
  function closeModal() { if (modalEl) modalEl.classList.remove("is-open"); }
  if (modalEl) {
    $$("[data-modal-close]", modalEl).forEach(function (b) {
      b.addEventListener("click", function () { closeModal(); });
    });
    var okb = $("[data-modal-ok]", modalEl);
    if (okb) okb.addEventListener("click", function () {
      var fn = modalEl._onOk;
      closeModal();
      if (typeof fn === "function") fn();
    });
  }

  /* segmented control */
  function wireSegs(root) {
    $$(".ux-seg", root || app).forEach(function (seg) {
      $$(".ux-seg__item", seg).forEach(function (item) {
        item.addEventListener("click", function () {
          $$(".ux-seg__item", seg).forEach(function (i) { i.classList.remove("is-active"); });
          item.classList.add("is-active");
        });
      });
    });
  }

  /* toggles */
  function wireToggles(root) {
    $$(".ux-toggle", root || app).forEach(function (t) {
      if (t._wired) return;
      t._wired = true;
      t.setAttribute("role", "switch");
      t.setAttribute("tabindex", "0");
      function flip() {
        t.classList.toggle("is-on");
        t.setAttribute("aria-checked", t.classList.contains("is-on") ? "true" : "false");
      }
      t.addEventListener("click", flip);
      t.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); }
      });
    });
  }

  /* global click delegation */
  app.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-goto],[data-act],[data-goto-tab]") : null;
    if (!t) return;
    var tab = t.getAttribute("data-goto-tab");
    var goto = t.getAttribute("data-goto");
    var act = t.getAttribute("data-act");
    if (tab) {
      history.length = 0;
      go(tab, { force: true });
      history.push(tab);
      return;
    }
    if (goto) { go(goto); return; }
    if (act === "back") { e.preventDefault(); back(); return; }
    if (act === "toast") {
      e.preventDefault();
      toast(t.getAttribute("data-toast") || "已触发");
      return;
    }
    if (act === "modal") {
      e.preventDefault();
      openModal(t.getAttribute("data-modal-title") || "提示", t.getAttribute("data-modal-body") || "", t.getAttribute("data-modal-ok") || "确定");
      return;
    }
    if (act === "form") {
      e.preventDefault();
      toast(t.getAttribute("data-toast") || "提交成功");
      return;
    }
    if (act === "skill") {
      e.preventDefault();
      var cd = t.getAttribute("data-cd");
      toast((t.getAttribute("data-name") || "技能") + (cd ? " 冷却中 " + cd + "s" : " 已释放"));
      return;
    }
  });

  /* form submit */
  $$("form.ux-form", app).forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      toast(f.getAttribute("data-toast") || "提交成功");
    });
  });

  collect();
  if (screenEls.length) {
    var firstId = screenEls[0].getAttribute("data-screen");
    // honor data-initial
    var initial = app.getAttribute("data-initial");
    var start = initial && screens[initial] ? initial : firstId;
    screens[start].classList.add("is-active");
    current = start;
    history.push(start);
    setActiveTab(start);
    runScreenHooks(screens[start]);
  }
  wireSegs();
  wireToggles();

  // expose tiny API for debugging
  window.UX = { go: go, back: back, toast: toast };
})();
