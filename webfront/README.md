# ShotLama public website

Run `python3 -m http.server 4310 --directory webfront` and open
`http://localhost:4310`. The site is plain HTML, CSS and JavaScript with no
build step, analytics, cookies or third-party requests. It is published at
`https://devmil.de/shotlama/`.

## Content

The page follows the ShotLama brand of Meridian (light and dark from
`prefers-color-scheme`) and the two materials of the app: veil for everything
that sits over a screen, islands on the graphite ground for the rest. The
ivory Lama appears only on the brand ground (hero stage, privacy and download
islands); the footer carries the single-ink signature. Copy stays plain and
factual: no superlatives, and features after the first release are marked
*Later*.

`site.js` runs three models of the app, all built for this page:

- The hero stage is a small screen. A guided capture frames the Lama in the
  icon's crop corners: the screen dims, a selection with handles, dimension
  pill, loupe and capture bar is drawn, the shutter flashes and a snapshot
  flies into a Quick Access card (SL-M1). Visitors can drag their own
  selection with a mouse or pen, then Copy, Save, Close, swipe or Pin the
  card. Snapshots are clones of the stage content, so a card shows exactly
  the selected region. Tapping the Lama plays a gag from `lama-antics.js`.
- The Annotate section is an editor with a made-up dashboard. Tools toggle
  annotation layers; colour, backdrop, padding, corners and shadow follow the
  Background inspector of `docs/design-system/specs/04-annotate.md`.
- Scroll reveals, and small animations in the three flow cards.

Reduced motion stops autoplay and replaces flights with fades. Geometry,
labels and states come from the design-system specs and tokens; keep them in
step when the app changes, and compare with app captures once the native
surfaces exist.

## Languages and legal pages

English is the source text in the HTML. `language.js` swaps the main pages
(index, release notes) to German in place: an element with `data-de` holds
its German text (plain text only; `--check` rejects markup inside it), and
`data-de-<attribute>` a German `aria-label`, `alt`, `title`, `content` or
`href`. Text that `site.js` and `releases.js` write picks its language through
`ShotLamaLanguage.pick(en, de)`; `releases.js` re-renders on the
`shotlama:language` event. The choice is stored in `localStorage` under
`preferred-language`, shared by every Devmil site on `devmil.de`; without one,
a German browser language picks German. German copy uses neutral wording, and
"Sie" on the legal pages.

The imprint and privacy policy are static files per language:
`imprint.html` and `privacy.html` in English, `de/imprint.html` and
`de/privacy.html` in German. Their switch links to the counterpart and stores
the choice; they never redirect. Every page's footer links to the legal pages
of its language without JavaScript, and `--check` enforces that and the
sitemap entry. The contact address appears only as an obfuscated
`.contact-email` span that `language.js` turns into a link assembled on
click; `--check` fails if the joined address or a literal mailto link appears
in any published file. Keep section 6 of the privacy policy in step with the
app: it states that the current builds make no internet connections and that
the update check is still planned.

## Downloads

`releases.js` reads `_data/releases.json`. Until a release exists the index
lists none and the page shows the planned platforms. The release workflow will
write the index in GitLama's format (`schema_version`, `product`, `latest`,
`releases`; each asset has `platform`, `format`, `file`, `architecture`,
`minimum_system`, `bytes`, `sha256`, `url`). Links are rendered only for
unauthenticated `https://github.com/` URLs. Supported formats: macOS `dmg`,
Windows `msi` or `exe`, Linux `flatpak`, `AppImage`, `deb`, `rpm`, `tar.gz`.

## Assets

`python3 scripts/generate_website.py` copies brand-derived files (Lama poses,
`lama-antics.js/.css`, app icons, feature graphic) from `resources/brand`,
`assets/brand` and `resources/marketing`; never edit those copies.
`--check` verifies them, the marketing pin, the ownership marker, the release
index and that every local reference resolves and nothing loads from another
origin. Icons in `assets/icons/` are Lucide 1.8.0 (ISC, `assets/icons/LICENSE`).
Platform marks in `assets/platform/` come from Simple Icons (CC0) except the
Windows mark; they label the matching downloads only. `JetBrainsMono-Regular`
is the Latin subset used by GitLama; `Caveat-Latin` is a Latin subset of the
app's bundled Caveat, made with `pyftsubset --flavor=woff2`. Both are OFL.

## Publication

Forgejo is authoritative and the public GitHub repository is a mirror.
`.forgejo/workflows/sync-website.yml` runs on pushes to `main` that touch the
site. It checks the site, then `scripts/sync_website.py publish` mirrors
`webfront/` into the `webfront/` directory of `GH_REPO_URL` (owner/name) with
`GH_SYNC_TOKEN`, together with `.github/workflows/shotlama-pages.yml`, which
deploys it with GitHub Pages. The mirror owns only the files recorded in
`.shotlama-managed-files.json` in a directory carrying the exact
`.shotlama-site-owner` marker, and a Pages workflow carrying its ownership
line. It never force-pushes. GitHub Pages must deploy from GitHub Actions in
the mirror's settings.
