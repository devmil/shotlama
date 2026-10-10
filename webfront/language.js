// The language switch and contact addresses, on every page.
//
// English is the source text in the HTML. An element with data-de carries
// its German text, and data-de-<attribute> a German attribute value. The
// English original is kept in data-en (data-en-<attribute>) the first time
// it is replaced, so clones keep both. Text always goes in as textContent.
//
// The choice is stored under "preferred-language", which every Devmil site
// on this origin shares. Without a stored choice, a browser language that
// starts with "de" picks German. Legal pages are separate files per
// language (data-page-language on <html>): their switch links to the
// counterpart and only stores the choice; opening one never redirects.
(function () {
  "use strict";

  const KEY = "preferred-language";
  const LANGUAGES = ["en", "de"];
  const ATTRIBUTES = ["aria-label", "alt", "title", "content", "href"];
  const root = document.documentElement;
  const fixed = root.dataset.pageLanguage || null;

  function stored() {
    try {
      const value = window.localStorage.getItem(KEY);
      return LANGUAGES.includes(value) ? value : null;
    } catch (_) {
      return null;
    }
  }

  function store(language) {
    try {
      window.localStorage.setItem(KEY, language);
    } catch (_) {
      // Storage may be disabled; the switch still works for this page.
    }
  }

  function preferred() {
    const value = stored();
    if (value) return value;
    return /^de\b/i.test(navigator.language || "") ? "de" : "en";
  }

  let current = fixed || "en";

  // Templates hold markup that site.js clones later, so they follow too.
  function scopes() {
    return [document, ...Array.from(document.querySelectorAll("template"), (t) => t.content)];
  }

  function translate(language) {
    for (const scope of scopes()) {
      for (const node of scope.querySelectorAll("[data-de]")) {
        if (!("en" in node.dataset)) node.dataset.en = node.textContent;
        node.textContent = language === "de" ? node.dataset.de : node.dataset.en;
      }
      for (const name of ATTRIBUTES) {
        for (const node of scope.querySelectorAll(`[data-de-${name}]`)) {
          const original = `data-en-${name}`;
          if (!node.hasAttribute(original)) node.setAttribute(original, node.getAttribute(name) || "");
          node.setAttribute(name, node.getAttribute(language === "de" ? `data-de-${name}` : original));
        }
      }
    }
  }

  function mark(language) {
    for (const control of document.querySelectorAll(".lang-switch [data-language]")) {
      const active = control.dataset.language === language;
      if (control.tagName === "BUTTON") control.setAttribute("aria-pressed", String(active));
      else if (active) control.setAttribute("aria-current", "page");
      else control.removeAttribute("aria-current");
    }
  }

  function apply(language) {
    current = language;
    translate(language);
    root.lang = language;
    mark(language);
    document.dispatchEvent(new CustomEvent("shotlama:language", { detail: { language } }));
  }

  for (const control of document.querySelectorAll(".lang-switch [data-language]")) {
    control.addEventListener("click", () => {
      const language = control.dataset.language;
      if (!LANGUAGES.includes(language)) return;
      store(language);
      // A link goes to the counterpart page; a button swaps this page.
      if (control.tagName === "BUTTON" && !fixed) apply(language);
    });
  }

  if (fixed) mark(fixed);
  else apply(preferred());

  // The address is never in the markup as one string. Its visible text
  // stays obfuscated, and the mailto link is put together only on click.
  for (const span of document.querySelectorAll(".contact-email")) {
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = span.textContent;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const d = span.dataset;
      window.location.href = "mail" + "to:" + d.user + "@" + d.domain + "." + d.tld;
    });
    span.replaceChildren(link);
  }

  window.ShotLamaLanguage = {
    current: () => current,
    pick: (en, de) => (current === "de" ? de : en),
  };
})();
