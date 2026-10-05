// Renders downloads and release notes from the release index in
// _data/releases.json, which the release workflow writes in the same format
// as GitLama's. Until a release exists the index lists none, and the page
// keeps its planned state. Every value reaches the page through textContent,
// and a link is rendered only for an unauthenticated https://github.com/ URL.
(function () {
  "use strict";

  const status = document.getElementById("release-status");
  const planned = document.getElementById("planned-grid");
  const downloads = document.getElementById("download-grid");
  const extra = document.getElementById("download-extra");
  const releaseBar = document.getElementById("release-bar");
  const latestNotes = document.getElementById("latest-notes");
  const releaseList = document.getElementById("release-list");

  const formats = {
    macos: ["dmg"],
    windows: ["msi", "exe"],
    linux: ["flatpak", "AppImage", "deb", "rpm", "tar.gz"],
  };
  const order = ["dmg", "msi", "exe", "flatpak", "AppImage", "deb", "rpm", "tar.gz"];
  const platforms = {
    macos: { label: "macOS", icon: "apple" },
    windows: { label: "Windows", icon: "windows" },
    linux: { label: "Linux", icon: "linux" },
  };
  const packages = {
    dmg: { name: "Disk image", hint: "Apple silicon and Intel", icon: "platform/apple" },
    msi: { name: "Installer", hint: "64-bit Windows", icon: "platform/windows" },
    exe: { name: "Installer", hint: "64-bit Windows", icon: "platform/windows" },
    flatpak: { name: "Flatpak", hint: "Most distributions", icon: "icons/package" },
    AppImage: { name: "AppImage", hint: "One portable file", icon: "platform/appimage" },
    deb: { name: "DEB package", hint: "Debian, Ubuntu and derivatives", icon: "platform/debian" },
    rpm: { name: "RPM package", hint: "Fedora and other RPM-based distributions", icon: "platform/fedora" },
    "tar.gz": { name: "Tarball", hint: "Portable archive", icon: "platform/archive" },
  };

  function validAsset(a) {
    if (!a || typeof a !== "object" || !Object.hasOwn(formats, a.platform)
        || !formats[a.platform].includes(a.format) || typeof a.url !== "string"
        || typeof a.file !== "string") return false;
    try {
      const u = new URL(a.url);
      return u.protocol === "https:" && !u.username && !u.password && u.hostname === "github.com";
    } catch (_) {
      return false;
    }
  }

  function valid(d) {
    return d && d.schema_version === 1 && d.product === "ShotLama" && d.latest
      && Array.isArray(d.latest.assets) && d.latest.assets.length > 0
      && d.latest.assets.every(validAsset)
      && Array.isArray(d.releases) && d.releases.length > 0 && d.releases.length <= 10;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(path) {
    const node = element("span", "icon");
    node.style.setProperty("--icon", `url(${path})`);
    node.setAttribute("aria-hidden", "true");
    return node;
  }

  function megabytes(bytes) {
    return Number.isFinite(bytes) ? `${(bytes / 1048576).toFixed(1)} MB` : "";
  }

  // The visitor's desktop platform, or null on phones, tablets and unknowns.
  function detectPlatform() {
    const agent = navigator.userAgent || "";
    const name = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    if (/android|iphone|ipad|ipod/i.test(agent)) return null;
    if (/mac/i.test(name)) return navigator.maxTouchPoints > 1 ? null : "macos";
    if (/win/i.test(name)) return "windows";
    if (/linux|x11/i.test(name)) return "linux";
    return null;
  }

  function suggestedFormat(platform, assets) {
    const present = assets.map((a) => a.format);
    if (platform === "linux") {
      const agent = navigator.userAgent || "";
      if (/ubuntu|debian|mint/i.test(agent) && present.includes("deb")) return "deb";
      if (/fedora|red hat|suse/i.test(agent) && present.includes("rpm")) return "rpm";
    }
    return formats[platform].find((format) => present.includes(format)) || null;
  }

  function copyChecksum(button, asset) {
    const restore = () => { button.textContent = "SHA-256"; };
    const done = (text) => { button.textContent = text; setTimeout(restore, 1600); };
    if (!navigator.clipboard) { window.prompt("SHA-256", asset.sha256); return; }
    navigator.clipboard.writeText(asset.sha256).then(() => done("Copied"), () => done("Failed"));
  }

  function assetRow(asset, suggested) {
    const kind = packages[asset.format];
    const row = element("li", suggested ? "asset suggested" : "asset");
    const icons = element("span", "asset-icons");
    icons.append(icon(`assets/${kind.icon}.svg`));
    const text = element("span");
    const name = element("a", "asset-name", kind.name);
    name.href = asset.url;
    name.rel = "noopener";
    name.setAttribute("aria-label", `Download ${asset.file}`);
    text.append(name, element("span", "asset-hint", kind.hint));
    const meta = element("span", "asset-meta",
      [`.${asset.format}`, asset.architecture, megabytes(asset.bytes)].filter(Boolean).join(" · "));
    const tail = element("span", "asset-tail");
    if (/^[0-9a-f]{64}$/.test(asset.sha256 || "")) {
      const sha = element("button", "sha", "SHA-256");
      sha.type = "button";
      sha.title = asset.sha256;
      sha.setAttribute("aria-label", `Copy the SHA-256 checksum of ${asset.file}`);
      sha.addEventListener("click", () => copyChecksum(sha, asset));
      tail.append(sha);
    }
    const get = element("span", "asset-get");
    get.append(icon("assets/icons/download.svg"));
    tail.append(get);
    row.append(icons, text, meta, tail);
    return row;
  }

  function renderDownloads(r) {
    const detected = detectPlatform();
    status.hidden = true;
    planned.hidden = true;
    extra.hidden = false;

    const notes = element("a", "", "Release notes");
    notes.href = "releases.html";
    releaseBar.append(element("span", "chip", r.version),
      element("span", "", `Build ${r.build} · ${r.channel} channel`), notes);
    releaseBar.hidden = false;

    downloads.hidden = false;
    for (const platform of ["macos", "windows", "linux"]) {
      const assets = r.assets.filter((a) => a.platform === platform);
      const card = element("article", "platform");
      const head = element("div", "platform-head");
      const mark = element("span", "platform-mark");
      mark.append(icon(`assets/platform/${platforms[platform].icon}.svg`));
      const title = element("div");
      title.append(element("h3", "", platforms[platform].label),
        element("p", "", assets.length ? (assets[0].minimum_system || "") : "Not in this release"));
      head.append(mark, title);
      if (platform === detected) head.append(element("span", "chip plain", "Your system"));
      card.append(head);
      if (assets.length) {
        const list = element("ul", "assets");
        const suggested = platform === detected ? suggestedFormat(platform, assets) : null;
        assets.slice().sort((a, b) => order.indexOf(a.format) - order.indexOf(b.format))
          .forEach((asset) => list.append(assetRow(asset, asset.format === suggested)));
        card.append(list);
      } else {
        card.append(element("p", "platform-empty", "This platform follows in a later release."));
      }
      downloads.append(card);
    }

    const lead = document.getElementById("download-lead");
    if (lead) lead.textContent = `ShotLama ${r.version} is a ${r.channel} release. Pick the package for your system; each one lists its SHA-256 checksum.`;
    const headerRelease = document.getElementById("header-release");
    if (headerRelease) headerRelease.lastElementChild.textContent = r.version;
    const heroDownload = document.getElementById("hero-download");
    const hasDetected = detected && r.assets.some((a) => a.platform === detected);
    if (heroDownload) {
      heroDownload.lastElementChild.textContent = hasDetected ? `Download for ${platforms[detected].label}` : "Download";
    }

    if (latestNotes && Array.isArray(r.notes) && r.notes.length) {
      const list = element("ul");
      r.notes.slice(0, 3).forEach((note) => list.append(element("li", "", note)));
      const more = element("a", "", r.notes.length > 3 ? `All ${r.notes.length} changes` : "Release notes");
      more.href = "releases.html";
      latestNotes.append(element("h3", "", `Changed in ${r.version}`), list, more);
      latestNotes.hidden = false;
    }
  }

  function renderNotes(releases) {
    releaseList.textContent = "";
    for (const r of releases) {
      const record = element("article", "release-record");
      record.append(element("h2", "", `${r.version} · build ${r.build}`),
        element("p", "", `${r.channel} · ${r.tag}`));
      if (Array.isArray(r.notes) && r.notes.length) {
        const list = element("ul");
        r.notes.forEach((note) => list.append(element("li", "", note)));
        record.append(list);
      }
      const assets = Array.isArray(r.assets) ? r.assets.filter(validAsset) : [];
      assets.sort((a, b) => order.indexOf(a.format) - order.indexOf(b.format));
      if (assets.length) {
        const links = element("div", "formats");
        assets.forEach((asset) => {
          const anchor = element("a", "", `${platforms[asset.platform].label} .${asset.format}`);
          anchor.href = asset.url;
          anchor.rel = "noopener";
          links.append(anchor);
        });
        record.append(links);
      }
      releaseList.append(record);
    }
  }

  fetch("_data/releases.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("unavailable");
      return response.json();
    })
    .then((data) => {
      if (!valid(data)) throw new Error("no release");
      if (downloads) renderDownloads(data.latest);
      if (releaseList) renderNotes(data.releases);
    })
    .catch(() => {
      if (releaseList) releaseList.textContent = "No public release yet. ShotLama is in development.";
    });
})();
