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

  /* ── 屏幕方向 ───────────────────────────────── */
  var orientationPolicy = doc.documentElement.getAttribute("data-orientation") || "portrait";

  function currentOrientation() {
    if (orientationPolicy === "auto") {
      return window.matchMedia && window.matchMedia("(orientation: landscape)").matches ? "landscape" : "portrait";
    }
    return orientationPolicy === "landscape" ? "landscape" : "portrait";
  }

  function applyOrientation() {
    var value = currentOrientation();
    doc.documentElement.setAttribute("data-orientation-view", value);
    app.setAttribute("data-orientation", value);
    return value;
  }

  function setOrientation(value) {
    if (["portrait", "landscape", "auto"].indexOf(value) === -1) return currentOrientation();
    orientationPolicy = value;
    doc.documentElement.setAttribute("data-orientation", value);
    return applyOrientation();
  }

  function toggleOrientation() {
    return setOrientation(currentOrientation() === "landscape" ? "portrait" : "landscape");
  }

  if (window.matchMedia) {
    var orientationMedia = window.matchMedia("(orientation: landscape)");
    var onOrientationChange = function () { if (orientationPolicy === "auto") applyOrientation(); };
    if (orientationMedia.addEventListener) orientationMedia.addEventListener("change", onOrientationChange);
    else if (orientationMedia.addListener) orientationMedia.addListener(onOrientationChange);
  }
  applyOrientation();

  /* ── Tween 引擎 ─────────────────────────────── */
  var Ease = {
    linear: function (t) { return t; },
    quadIn: function (t) { return t * t; },
    quadOut: function (t) { return t * (2 - t); },
    quadInOut: function (t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; },
    cubicIn: function (t) { return t * t * t; },
    cubicOut: function (t) { return (--t) * t * t + 1; },
    cubicInOut: function (t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; },
    backOut: function (t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    elasticOut: function (t) {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
    },
    bounceOut: function (t) {
      if (t < 1 / 2.75) return 7.5625 * t * t;
      if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
      if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    },
  };

  var COLOR_PROPS = /^(background|backgroundColor|color|borderColor|boxShadow|outlineColor)$/;

  function parseColor(str) {
    str = String(str).trim();
    var m;
    if ((m = str.match(/^#([0-9a-f]{3,8})$/i))) {
      var h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return {
        r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16),
        a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      };
    }
    if ((m = str.match(/^rgba?\(([^)]+)\)$/i))) {
      var p = m[1].split(",").map(function (x) { return parseFloat(x); });
      return { r: p[0] || 0, g: p[1] || 0, b: p[2] || 0, a: p.length > 3 ? p[3] : 1 };
    }
    return null;
  }
  function fmtColor(c) {
    return "rgba(" + Math.round(c.r) + "," + Math.round(c.g) + "," + Math.round(c.b) + "," + (c.a == null ? 1 : Math.max(0, Math.min(1, c.a))) + ")";
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function tween(el, props, opts) {
    opts = opts || {};
    var dur = opts.duration != null ? opts.duration : 300;
    var delay = opts.delay || 0;
    var ease = typeof opts.ease === "function" ? opts.ease : Ease[opts.ease] || Ease.cubicOut;
    var onDone = opts.onDone;
    if (!el) { if (onDone) onDone(); return; }

    var keys = Object.keys(props);
    var startVals = {};
    var endVals = {};
    var cs = getComputedStyle(el);

    keys.forEach(function (k) {
      var end = props[k];
      if (COLOR_PROPS.test(k)) {
        var c0 = parseColor(cs.getPropertyValue(k.replace(/[A-Z]/g, function (m2) { return "-" + m2.toLowerCase(); })) || cs[k] || "#000");
        var c1 = parseColor(end);
        if (c0 && c1) { startVals[k] = c0; endVals[k] = c1; return; }
      }
      var s = parseFloat(cs[k]);
      var e = parseFloat(end);
      if (!isNaN(s) && !isNaN(e)) {
        var unit = String(end).replace(/[-\d.]/g, "") || (String(cs[k]).match(/[a-z%]+$/) || [""])[0];
        startVals[k] = s; endVals[k] = { v: e, u: unit };
      } else {
        el.style[k] = end;
      }
    });

    if (dur <= 0) {
      keys.forEach(function (k) {
        if (endVals[k] && typeof endVals[k] === "object" && "v" in endVals[k]) el.style[k] = endVals[k].v + endVals[k].u;
        else if (endVals[k] && endVals[k].r != null) el.style[k] = fmtColor(endVals[k]);
        else el.style[k] = props[k];
      });
      if (onDone) onDone();
      return;
    }

    var t0 = null;
    var raf = 0;
    function frame(ts) {
      if (t0 == null) t0 = ts;
      var elapsed = ts - t0 - delay;
      if (elapsed < 0) { raf = requestAnimationFrame(frame); return; }
      var p = Math.min(1, elapsed / dur);
      var e = ease(p);
      keys.forEach(function (k) {
        var sv = startVals[k], ev = endVals[k];
        if (ev && ev.r != null) {
          el.style[k] = fmtColor({
            r: lerp(sv.r, ev.r, e), g: lerp(sv.g, ev.g, e), b: lerp(sv.b, ev.b, e),
            a: lerp(sv.a == null ? 1 : sv.a, ev.a == null ? 1 : ev.a, e),
          });
        } else if (ev && "v" in ev) {
          el.style[k] = lerp(sv, ev.v, e) + ev.u;
        } else {
          el.style[k] = props[k];
        }
      });
      if (p < 1) raf = requestAnimationFrame(frame);
      else if (onDone) onDone();
    }
    raf = requestAnimationFrame(frame);
    return function cancel() { cancelAnimationFrame(raf); };
  }

  function countTo(el, to, opts) {
    opts = opts || {};
    var from = opts.from != null ? opts.from : (parseFloat(String(el.textContent).replace(/[^\d.-]/g, "")) || 0);
    var dur = opts.duration != null ? opts.duration : 600;
    var ease = typeof opts.ease === "function" ? opts.ease : Ease.cubicOut;
    var decimals = opts.decimals != null ? opts.decimals : 0;
    var prefix = opts.prefix || "";
    var suffix = opts.suffix || "";
    var sep = opts.sep !== false;
    function fmt(n) {
      var s = Math.abs(n).toFixed(decimals);
      if (sep) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return (n < 0 ? "-" : "") + prefix + s + suffix;
    }
    if (!el) return;
    if (dur <= 0) { el.textContent = fmt(to); return; }
    var t0 = null, raf = 0;
    function frame(ts) {
      if (t0 == null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      el.textContent = fmt(from + (to - from) * ease(p));
      if (p < 1) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return function cancel() { cancelAnimationFrame(raf); };
  }

  function seq(fns, gap) {
    gap = gap == null ? 80 : gap;
    var i = 0;
    function next() {
      if (i >= fns.length) return;
      var fn = fns[i++];
      try { fn(); } catch (e) { /* keep going */ }
      if (i < fns.length) setTimeout(next, gap);
    }
    next();
  }

  window.UXTween = { to: tween, count: countTo, seq: seq, ease: Ease };

  /* ── 屏幕路由 ───────────────────────────────── */
  function collect() {
    screenEls = $$(".ux-screen", app);
    screenEls.forEach(function (el) {
      screens[el.getAttribute("data-screen")] = el;
    });
  }

  function setActiveTab(id) {
    $$("[data-goto-tab]", app).forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-goto-tab") === id);
    });
  }

  function runScreenHooks(el) {
    if (!el) return;
    // progress bars
    $$(".ux-progress__bar[data-value]", el).forEach(function (bar) {
      if (bar.classList.contains("is-indeterminate")) return;
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
    // number counters
    $$("[data-count-to]", el).forEach(function (n) {
      var to = parseFloat(n.getAttribute("data-count-to"));
      var from = parseFloat(n.getAttribute("data-count-from") || "0");
      if (!isNaN(to)) countTo(n, to, { from: from, duration: 700, prefix: n.getAttribute("data-count-prefix") || "", suffix: n.getAttribute("data-count-suffix") || "" });
    });
    // stagger containers
    $$("[data-stagger]", el).forEach(function (c) {
      // restart animation by reflow
      c.style.animation = "none";
      void c.offsetWidth;
      c.style.animation = "";
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
    if (!screens[id]) return;
    if (id === current && !opts.force) return;
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
  function openModal(title, body, okLabel, onOk, iconName) {
    if (!modalEl) { toast(title); return; }
    $(".ux-modal__title", modalEl).textContent = title || "";
    var bodyEl = $(".ux-modal__body", modalEl);
    bodyEl.textContent = body || "";
    bodyEl.style.whiteSpace = body && body.indexOf("\n") >= 0 ? "pre-line" : "";
    var iconEl = $(".ux-modal__icon", modalEl);
    if (iconEl) {
      if (iconName) { iconEl.innerHTML = "";
        if (doc.getElementById("uxi-" + iconName)) {
          var svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("class", "ux-icon");
          svg.setAttribute("width", "22");
          svg.setAttribute("height", "22");
          var use = doc.createElementNS("http://www.w3.org/2000/svg", "use");
          use.setAttribute("href", "#uxi-" + iconName);
          svg.appendChild(use);
          iconEl.appendChild(svg);
        } else {
          iconEl.textContent = iconName;
        } iconEl.hidden = false; }
      else { iconEl.hidden = true; iconEl.textContent = ""; }
    }
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

  /* state switcher */
  function wireStateSwitchers(root) {
    $$(".ux-state-switch", root || app).forEach(function (sw) {
      var hostId = sw.getAttribute("data-for");
      var host = hostId ? doc.getElementById(hostId) : sw.parentElement.querySelector(".ux-state-host");
      if (!host) return;
      var btns = $$(".ux-state-switch__btn", sw);
      btns.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var state = btn.getAttribute("data-state") || "ready";
          btns.forEach(function (b) { b.classList.toggle("is-active", b === btn); });
          $$(".ux-state-view", host).forEach(function (v) {
            v.classList.toggle("is-shown", v.getAttribute("data-state") === state);
          });
          var shown = host.querySelector('.ux-state-view.is-shown [data-value], .ux-state-view.is-shown .ux-progress__bar');
          runScreenHooks(host);
        });
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
    if (act === "orientation") {
      e.preventDefault();
      var nextOrientation = toggleOrientation();
      toast(nextOrientation === "landscape" ? "已切换横屏" : "已切换竖屏");
      return;
    }
    if (act === "toast") {
      e.preventDefault();
      toast(t.getAttribute("data-toast") || "已触发");
      if (t.classList.contains("anim-once") || t.getAttribute("data-anim-once")) {
        var cls = t.getAttribute("data-anim-once") || "anim-pop";
        t.classList.remove(cls);
        void t.offsetWidth;
        t.classList.add(cls);
      }
      return;
    }
    if (act === "modal") {
      e.preventDefault();
      openModal(t.getAttribute("data-modal-title") || "详情", t.getAttribute("data-modal-body") || "", t.getAttribute("data-modal-ok") || "确定", null, t.getAttribute("data-modal-icon") || "");
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
      t.classList.remove("anim-pop");
      void t.offsetWidth;
      t.classList.add("anim-pop");
      return;
    }
    if (act === "shake") {
      e.preventDefault();
      var target = t.getAttribute("data-shake-target") ? doc.querySelector(t.getAttribute("data-shake-target")) : t;
      if (target) {
        target.classList.remove("anim-shake");
        void target.offsetWidth;
        target.classList.add("anim-shake");
      }
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
  wireStateSwitchers();

  window.UX = { go: go, back: back, toast: toast, tween: tween, count: countTo, seq: seq, ease: Ease, openModal: openModal, closeModal: closeModal, setOrientation: setOrientation, toggleOrientation: toggleOrientation };
})();
