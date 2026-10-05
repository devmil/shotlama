// The hero capture flow, its Quick Access cards and pins, the Lama, the
// annotation editor model and scroll reveals. Everything here is a model of
// the app built for this page; it loads no data and stores nothing.
(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const $ = (selector, root = document) => root.querySelector(selector);
  const clamp = (value, low, high) => Math.min(Math.max(value, low), high);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function tween(ms, step) {
    return new Promise((resolve) => {
      const start = performance.now();
      function frame(now) {
        const t = Math.min((now - start) / ms, 1);
        step(easeInOut(t));
        if (t < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  // ---------------------------------------------------------------- Lama
  // The Lama greets with a nod and settles proud. Tapping it plays a gag
  // from lama-antics.js; after a capture it hops.
  function heroLama() {
    const lama = $("#hero-lama");
    if (!lama) return () => {};
    setTimeout(() => lama.classList.remove("is-hello"), 1600);
    lama.addEventListener("animationend", () => lama.classList.remove("is-hopping"));
    let antics = null;
    if (window.LamaAntics) {
      antics = LamaAntics.attach(lama, {
        base: "assets/lama/",
        colors: ["#8F88FF", "#FFC2DA", "#B0ABFF", "#FFF8EB"],
        taps: {
          capture: async (antic) => {
            await antic.move("hop");
            if (!antic.reduced()) runAuto();
          },
        },
      });
    }
    return () => {
      if (reduced.matches) return;
      if (antics) { antics.play("hop"); return; }
      lama.classList.remove("is-hopping");
      void lama.offsetWidth;
      lama.classList.add("is-hopping");
    };
  }

  // ------------------------------------------------------------- Capture
  const stage = $("#stage");
  const content = $("#stage-content");
  const layer = $("#capture-layer");
  const stack = $("#qa-stack");
  const template = $("#qa-card-template");
  const status = $("#stage-status");
  let runAuto = () => {};

  function setupCapture(hop) {
    if (!stage || !content || !layer || !stack || !template) return;
    const selection = $(".selection", layer);
    const dimensions = $(".dimensions", layer);
    const crosshair = $(".crosshair", layer);
    const loupe = $(".loupe", layer);
    const lens = $(".lens", layer);
    const coords = $(".coords", layer);
    const flash = $(".flash", layer);
    const bar = $(".capture-bar", layer);
    const ZOOM = 8;
    let busy = false;
    let lensView = null;
    let lastTouched = -Infinity;

    function size() { return { w: stage.clientWidth, h: stage.clientHeight }; }
    function local(event) {
      const box = stage.getBoundingClientRect();
      return { x: clamp(event.clientX - box.left, 0, box.width), y: clamp(event.clientY - box.top, 0, box.height) };
    }
    function announce(text) { if (status) status.textContent = text; }

    // A snapshot is a clone of the stage content at its current size. Placed
    // with a transform, it shows any region at any scale, like a capture of
    // the frozen screen.
    function snapshot() {
      const { w, h } = size();
      const view = content.cloneNode(true);
      view.removeAttribute("id");
      view.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      view.classList.add("snapshot");
      view.setAttribute("aria-hidden", "true");
      view.inert = true;
      Object.assign(view.style, { width: `${w}px`, height: `${h}px`, right: "auto", bottom: "auto" });
      return view;
    }
    function place(view, rect, scale, dx = 0, dy = 0) {
      view.style.transform = `translate(${dx - rect.x * scale}px, ${dy - rect.y * scale}px) scale(${scale})`;
    }

    function begin(auto) {
      busy = true;
      stage.classList.add("is-capturing");
      layer.classList.toggle("is-auto", auto);
      lensView = snapshot();
      lens.textContent = "";
      lens.append(lensView);
    }
    function end() {
      stage.classList.remove("is-capturing", "show-loupe");
      layer.classList.remove("has-selection", "is-auto");
      lensView = null;
      busy = false;
    }
    function draw(rect) {
      layer.classList.add("has-selection");
      Object.assign(selection.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
      const ratio = window.devicePixelRatio || 1;
      dimensions.textContent = `${Math.round(rect.w * ratio)} × ${Math.round(rect.h * ratio)}`;
      coords.textContent = dimensions.textContent;
      // The capture bar sits under the dimension pill, centred on the
      // selection, or above the selection when there is no room below.
      const { w, h } = size();
      const width = bar.offsetWidth || 360;
      const below = rect.y + rect.h + 46;
      const y = below + 44 + 12 <= h ? below : Math.max(12, rect.y - 56);
      const x = clamp(rect.x + rect.w / 2 - width / 2, 12, w - width - 12);
      bar.style.transform = `translate(${x}px, ${y}px)`;
    }
    function aim(point) {
      const { w, h } = size();
      crosshair.style.transform = `translate(${point.x}px, ${point.y}px)`;
      if (!lensView || w < 520) { stage.classList.remove("show-loupe"); return; }
      stage.classList.add("show-loupe");
      place(lensView, point, ZOOM, 66, 66);
      const x = point.x + 24 + 132 > w ? point.x - 24 - 132 : point.x + 24;
      const y = point.y + 24 + 160 > h ? point.y - 24 - 160 : point.y + 24;
      loupe.style.transform = `translate(${x}px, ${y}px)`;
      if (!layer.classList.contains("has-selection")) {
        const ratio = window.devicePixelRatio || 1;
        coords.textContent = `X ${Math.round(point.x * ratio)}  Y ${Math.round(point.y * ratio)}`;
      }
    }
    function rectOf(a, b) {
      return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
    }

    // SL-M1: the selection flashes, the dim fades, and a snapshot of the
    // selection travels into the new card. Reduced motion: flash, then fade.
    async function shoot(rect) {
      flash.classList.remove("go");
      void flash.offsetWidth;
      flash.classList.add("go");
      const card = makeCard(rect);
      const thumb = $(".qa-thumb", card);
      const fit = card.fit;
      end();
      if (reduced.matches) {
        card.classList.remove("is-entering");
      } else {
        const stageBox = stage.getBoundingClientRect();
        const thumbBox = thumb.getBoundingClientRect();
        const flight = document.createElement("div");
        flight.className = "flight";
        Object.assign(flight.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
        const view = snapshot();
        place(view, rect, 1);
        view.style.position = "absolute";
        flight.append(view);
        stage.append(flight);
        const dx = thumbBox.left - stageBox.left + fit.ox - rect.x;
        const dy = thumbBox.top - stageBox.top + fit.oy - rect.y;
        const animation = flight.animate([
          { transform: "none", borderRadius: "0px", boxShadow: "0 0 0 1px rgba(255,255,255,0.9)" },
          { transform: `translate(${dx}px, ${dy}px) scale(${fit.k})`, borderRadius: `${12 / fit.k}px`, boxShadow: "0 0 0 0 rgba(0,0,0,0)" },
        ], { duration: 460, easing: "cubic-bezier(0.34, 1.2, 0.64, 1)", fill: "forwards" });
        setTimeout(() => card.classList.remove("is-entering"), 260);
        await animation.finished.catch(() => {});
        flight.remove();
      }
      announce(`Capture added to Quick Access, ${dimensions.textContent} pixels.`);
      hop();
    }

    function makeCard(rect) {
      const card = template.content.firstElementChild.cloneNode(true);
      const thumb = $(".qa-thumb", card);
      const width = stack.clientWidth - 12;
      const ratio = clamp(rect.h / rect.w, 0.5, 0.8);
      const box = { w: width, h: Math.round(width * ratio) };
      const k = Math.min(box.w / rect.w, box.h / rect.h);
      const fit = { k, ox: (box.w - rect.w * k) / 2, oy: (box.h - rect.h * k) / 2 };
      thumb.style.height = `${box.h}px`;
      const view = snapshot();
      place(view, rect, k, fit.ox, fit.oy);
      thumb.append(view);
      const ratioPx = window.devicePixelRatio || 1;
      const label = `${Math.round(rect.w * ratioPx)} × ${Math.round(rect.h * ratioPx)}`;
      $(".qa-meta", card).textContent = `${label} · PNG`;
      card.setAttribute("aria-label", `Capture, ${label} pixels`);
      card.fit = fit;
      card.rect = rect;
      card.classList.add("is-entering");
      wireCard(card);
      stack.append(card);
      const cards = stack.querySelectorAll(".qa-card:not(.is-leaving)");
      if (cards.length > 3) dismiss(cards[0]);
      return card;
    }

    // Cards close on their own after a while, but not while the pointer or
    // the keyboard focus is on the stack.
    let closeTimer = 0;
    function scheduleClose() {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        if (stack.matches(":hover") || stack.contains(document.activeElement)) { scheduleClose(); return; }
        const first = stack.querySelector(".qa-card:not(.is-leaving):not(.is-busy)");
        if (first) { dismiss(first); scheduleClose(); }
      }, 9000);
    }

    function dismiss(card, quiet) {
      if (card.classList.contains("is-leaving")) return;
      const focused = card.contains(document.activeElement);
      card.style.height = `${card.offsetHeight}px`;
      card.classList.add("is-leaving");
      setTimeout(() => {
        card.animate([{ height: card.style.height, marginTop: "0px" }, { height: "0px", marginTop: "-12px" }],
          { duration: reduced.matches ? 1 : 220, easing: "ease-out", fill: "forwards" }).finished
          .catch(() => {}).then(() => card.remove());
      }, reduced.matches ? 0 : 240);
      if (focused) $("#capture-demo").focus();
      if (!quiet) announce("Card closed.");
    }

    function confirm(card, button, word) {
      card.classList.add("is-busy");
      button.textContent = "";
      const icon = document.createElement("span");
      icon.className = "icon";
      icon.style.setProperty("--icon", "url(assets/icons/check.svg)");
      button.append(icon, word);
      button.classList.add("done");
      announce(word);
      setTimeout(() => dismiss(card, true), 1100);
    }

    function pin(card) {
      const rect = card.rect;
      const node = document.createElement("div");
      node.className = "pin";
      node.tabIndex = 0;
      node.setAttribute("role", "group");
      node.setAttribute("aria-label", "Pinned capture. Drag to move.");
      Object.assign(node.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
      const view = snapshot();
      place(view, rect, 1);
      const close = document.createElement("button");
      close.type = "button";
      close.className = "pin-close";
      close.setAttribute("aria-label", "Close pin");
      close.innerHTML = '<span class="icon" style="--icon:url(assets/icons/x.svg)"></span>';
      close.addEventListener("click", () => node.remove());
      node.append(view, close);
      let start = null;
      node.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button")) return;
        start = { x: event.clientX, y: event.clientY, left: node.offsetLeft, top: node.offsetTop };
        node.setPointerCapture(event.pointerId);
      });
      node.addEventListener("pointermove", (event) => {
        if (!start) return;
        const { w, h } = size();
        node.style.left = `${clamp(start.left + event.clientX - start.x, -rect.w / 2, w - rect.w / 2)}px`;
        node.style.top = `${clamp(start.top + event.clientY - start.y, -rect.h / 2, h - rect.h / 2)}px`;
      });
      node.addEventListener("pointerup", () => { start = null; });
      node.addEventListener("keydown", (event) => {
        if (event.key === "Escape" || event.key === "Delete" || event.key === "Backspace") { node.remove(); $("#capture-demo").focus(); }
      });
      const pins = stage.querySelectorAll(".pin");
      if (pins.length >= 3) pins[0].remove();
      stage.append(node);
      // The pin opens at the capture's rect, then floats a little aside so
      // it reads as its own window above the stage.
      if (!reduced.matches) {
        const { w } = size();
        const shift = rect.x > w / 2 ? -Math.min(160, rect.x * 0.25) : Math.min(160, (w - rect.x - rect.w) * 0.25);
        node.style.left = `${rect.x + shift}px`;
        node.style.top = `${rect.y + 28}px`;
        node.animate([{ transform: `translate(${-shift}px, -28px)` }, { transform: "none" }],
          { duration: 520, easing: "cubic-bezier(0.34, 1.36, 0.64, 1)" });
      }
      dismiss(card, true);
      announce("Pinned. Drag the pin to move it.");
    }

    function wireCard(card) {
      card.addEventListener("click", (event) => {
        const control = event.target.closest("[data-action]");
        if (!control || card.classList.contains("is-leaving")) return;
        const action = control.dataset.action;
        if (action === "copy") confirm(card, control, "Copied");
        else if (action === "save") confirm(card, control, "Saved");
        else if (action === "close") dismiss(card);
        else if (action === "pin") pin(card);
        else if (action === "annotate") dismiss(card, true);
      });
      card.addEventListener("keydown", (event) => {
        if (event.target !== card) return;
        if (event.key === "Escape" || event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); dismiss(card); }
      });
      // Swipe or flick outwards to dismiss, as on the desktop.
      let swipe = null;
      card.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button, a")) return;
        swipe = { x: event.clientX, time: performance.now(), dx: 0 };
        card.setPointerCapture(event.pointerId);
        card.style.transition = "none";
      });
      card.addEventListener("pointermove", (event) => {
        if (!swipe) return;
        swipe.dx = Math.max(0, event.clientX - swipe.x);
        card.style.transform = `translateX(${swipe.dx}px)`;
      });
      const release = () => {
        if (!swipe) return;
        const velocity = swipe.dx / Math.max(1, performance.now() - swipe.time) * 1000;
        const far = swipe.dx > card.offsetWidth * 0.35 || (swipe.dx > 12 && velocity > 650);
        card.style.transition = "";
        card.style.transform = "";
        swipe = null;
        if (far) dismiss(card);
      };
      card.addEventListener("pointerup", release);
      card.addEventListener("pointercancel", release);
      scheduleClose();
    }

    // Visitors drag a selection with a mouse or pen. A short press without
    // movement stays a click, so text and the Lama remain usable.
    let pending = null;
    stage.addEventListener("pointerdown", (event) => {
      if (busy || event.button !== 0 || event.pointerType === "touch") return;
      if (event.target.closest("a, button, input, .qa-stack, .pin, .hero-lama, .stage-hint")) return;
      pending = { start: local(event), id: event.pointerId, active: false };
    });
    stage.addEventListener("pointermove", (event) => {
      if (!pending || event.pointerId !== pending.id) return;
      const point = local(event);
      if (!pending.active) {
        if (Math.hypot(point.x - pending.start.x, point.y - pending.start.y) < 5) return;
        pending.active = true;
        stage.setPointerCapture(event.pointerId);
        window.getSelection()?.removeAllRanges();
        begin(false);
        lastTouched = performance.now();
      }
      draw(rectOf(pending.start, point));
      aim(point);
    });
    const finish = (event) => {
      if (!pending || event.pointerId !== pending.id) return;
      const was = pending;
      pending = null;
      if (!was.active) return;
      const rect = rectOf(was.start, local(event));
      if (rect.w < 12 || rect.h < 12) { end(); return; }
      shoot(rect);
    };
    stage.addEventListener("pointerup", finish);
    stage.addEventListener("pointercancel", () => { if (pending && pending.active) end(); pending = null; });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && pending && pending.active) { pending = null; end(); announce("Capture cancelled."); }
    });

    // The guided capture frames the Lama, the way the app icon does.
    async function auto() {
      if (busy) return;
      const frame = $(".crop-frame", content);
      const box = frame.getBoundingClientRect();
      const stageBox = stage.getBoundingClientRect();
      const pad = box.width * 0.04;
      const from = { x: box.left - stageBox.left - pad, y: box.top - stageBox.top - pad };
      const to = { x: box.right - stageBox.left + pad, y: box.bottom - stageBox.top + pad };
      begin(true);
      if (reduced.matches) {
        draw(rectOf(from, to));
        await sleep(500);
        shoot(rectOf(from, to));
        return;
      }
      const enter = { x: from.x - 70, y: from.y - 50 };
      await tween(520, (t) => aim({ x: enter.x + (from.x - enter.x) * t, y: enter.y + (from.y - enter.y) * t }));
      await sleep(160);
      await tween(1000, (t) => {
        const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
        draw(rectOf(from, point));
        aim(point);
      });
      await sleep(320);
      await shoot(rectOf(from, to));
    }
    runAuto = auto;

    const button = $("#capture-demo");
    if (button) button.addEventListener("click", () => { lastTouched = performance.now(); auto(); });

    // Play the guided capture once the visitor has had a moment to read,
    // then now and again while the stage is in view and left alone.
    let visible = true;
    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: 0.5 }).observe(stage);
    function idle(delay) {
      setTimeout(() => {
        const quiet = performance.now() - lastTouched > 25000;
        if (!reduced.matches && visible && quiet && !document.hidden && !stack.matches(":hover")) auto();
        idle(19000);
      }, delay);
    }
    idle(2600);
  }

  // ---------------------------------------------------------- Annotate
  // A radio group that moves with the arrow keys, as the platform ones do.
  function radioGroup(group, choose) {
    const options = Array.from(group.querySelectorAll('[role="radio"]'));
    function select(option, focus) {
      options.forEach((item) => {
        const on = item === option;
        item.setAttribute("aria-checked", String(on));
        item.tabIndex = on ? 0 : -1;
      });
      if (focus) option.focus();
      choose(option);
    }
    options.forEach((option, index) => {
      option.tabIndex = option.getAttribute("aria-checked") === "true" ? 0 : -1;
      option.addEventListener("click", () => select(option, false));
      option.addEventListener("keydown", (event) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        select(options[(index + step + options.length) % options.length], true);
      });
    });
  }

  function setupEditor() {
    const editor = $("#editor");
    if (!editor) return;
    const canvas = $("#canvas");
    const backdrop = $("#backdrop");
    const capture = $("#capture");
    const doc = $(".doc", editor);
    const pad = $("#pad");
    const radius = $("#radius");
    const size = $("#doc-size");
    let shadow = "deep";
    const W = 640, H = 420;

    function layout() {
      const style = getComputedStyle(canvas);
      const aw = canvas.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const ah = canvas.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const none = backdrop.dataset.bg === "none";
      const p = none ? 0 : Number(pad.value);
      const s = Math.min(aw / (W + 2 * p), ah / (H + 2 * p));
      Object.assign(backdrop.style, { width: `${(W + 2 * p) * s}px`, height: `${(H + 2 * p) * s}px`, padding: `${p * s}px` });
      capture.style.borderRadius = `${Number(radius.value) * s}px`;
      capture.style.boxShadow = none || shadow === "none" ? "none"
        : shadow === "soft" ? `0 ${2 * s}px ${6 * s}px rgba(0,0,0,.14), 0 ${8 * s}px ${22 * s}px rgba(0,0,0,.12)`
        : shadow === "medium" ? `0 ${3 * s}px ${9 * s}px rgba(0,0,0,.2), 0 ${16 * s}px ${42 * s}px rgba(0,0,0,.24)`
        : `0 ${4 * s}px ${12 * s}px rgba(0,0,0,.24), 0 ${26 * s}px ${64 * s}px rgba(0,0,0,.36)`;
      $("#pad-value").textContent = `${pad.value} pt`;
      $("#radius-value").textContent = `${radius.value} pt`;
      size.textContent = `${W + 2 * p} × ${H + 2 * p} pt · PNG`;
    }

    editor.querySelectorAll(".dock [data-layer]").forEach((button) => {
      button.addEventListener("click", () => {
        const on = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", String(on));
        const name = button.dataset.layer;
        doc.querySelector(`.layer[data-layer="${name}"]`).classList.toggle("off", !on);
        if (name === "conceal") doc.classList.toggle("concealed", on);
      });
    });
    editor.querySelectorAll(".dock [data-layer]").forEach((button) => {
      const on = button.getAttribute("aria-pressed") === "true";
      doc.querySelector(`.layer[data-layer="${button.dataset.layer}"]`).classList.toggle("off", !on);
      if (button.dataset.layer === "conceal") doc.classList.toggle("concealed", on);
    });
    radioGroup($(".palette", editor), (option) => doc.style.setProperty("--ann", option.dataset.color));
    radioGroup($(".swatches", editor), (option) => { backdrop.dataset.bg = option.dataset.bg; layout(); });
    radioGroup($(".segmented", editor), (option) => { shadow = option.dataset.shadow; layout(); });
    pad.addEventListener("input", layout);
    radius.addEventListener("input", layout);
    new ResizeObserver(layout).observe(canvas);
    layout();
  }

  // ------------------------------------------------------------ Reveals
  function reveals() {
    const targets = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      targets.forEach((target) => target.classList.add("in"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    targets.forEach((target) => observer.observe(target));
  }

  setupCapture(heroLama());
  setupEditor();
  reveals();
})();
