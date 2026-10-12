#!/usr/bin/env node
// Builds the portfolio into ./dist from site.json + games/<folder>/data.json.
// Usage: node build.js            -> build
//        node build.js --serve    -> build, then preview at http://localhost:8080
//        node build.js --drafts   -> also include folders starting with "_"
//        node build.js --watch    -> rebuild whenever games/, src/ or site.json change

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const GAMES_DIR = path.join(ROOT, "games");
const SRC_DIR = path.join(ROOT, "src");
const OUT_DIR = path.join(ROOT, "dist");
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
const THUMB_NAME = /^(thumb|thumbnail|cover|icon)\.[a-z]+$/i;
const args = new Set(process.argv.slice(2));

let warnings = 0;
const warn = (msg) => {
  warnings++;
  console.warn(`  ⚠ ${msg}`);
};

// ---------- helpers ----------

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`${path.relative(ROOT, file)}: ${e.message}`);
  }
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const toArray = (v) => (v == null || v === "" ? [] : Array.isArray(v) ? v : [v]);

const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "game";

// Only allow http(s), mailto and relative URLs in href/src.
const safeUrl = (u) => {
  const s = String(u ?? "").trim();
  if (!s) return "";
  if (/^(https?:|mailto:)/i.test(s) || !/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  return "";
};

const paragraphs = (text) =>
  toArray(text)
    .flatMap((t) => String(t).split(/\n\s*\n/))
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");

const firstParagraph = (text) => String(toArray(text)[0] ?? "").split(/\n\s*\n/)[0].trim();

const PLATFORM_LABEL = { desktop: "Desktop", mobile: "Mobile", tablet: "Tablet" };
const platformLabel = (p) => PLATFORM_LABEL[String(p).toLowerCase()] || String(p);

// ---------- load data ----------

function loadSite() {
  const file = path.join(ROOT, "site.json");
  return fs.existsSync(file) ? readJson(file) : {};
}

function loadGames() {
  if (!fs.existsSync(GAMES_DIR)) return [];
  const games = [];
  const usedSlugs = new Set();

  for (const entry of fs.readdirSync(GAMES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("_") && !args.has("--drafts")) continue;

    const dir = path.join(GAMES_DIR, entry.name);
    const dataFile = path.join(dir, "data.json");
    if (!fs.existsSync(dataFile)) {
      warn(`games/${entry.name}: no data.json, skipped`);
      continue;
    }
    const data = readJson(dataFile);
    if (data.hidden) continue;

    const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
    const screenshots = toArray(data.screenshots).filter((f) => {
      if (files.includes(f)) return true;
      warn(`games/${entry.name}: screenshot "${f}" not found`);
      return false;
    });

    let thumbnail = data.thumbnail;
    if (thumbnail && !files.includes(thumbnail)) {
      warn(`games/${entry.name}: thumbnail "${thumbnail}" not found`);
      thumbnail = null;
    }
    thumbnail ||=
      files.find((f) => THUMB_NAME.test(f) && IMAGE_EXT.test(f)) ||
      files.find((f) => IMAGE_EXT.test(f) && !screenshots.includes(f));
    if (!thumbnail) warn(`games/${entry.name}: no thumbnail image found`);

    if (!data.name) warn(`games/${entry.name}: missing "name"`);
    const stores = toArray(data.store)
      .map((st) => ({ label: st?.label || "Store", url: safeUrl(st?.url) }))
      .filter((st) => st.url);
    if (!safeUrl(data.link) && !stores.length) warn(`games/${entry.name}: missing "link" (or "store")`);

    let slug = slugify(data.slug || entry.name.replace(/^_/, ""));
    while (usedSlugs.has(slug)) slug += "-2";
    usedSlugs.add(slug);

    games.push({
      ...data,
      folder: entry.name,
      dir,
      files,
      slug,
      name: data.name || entry.name,
      link: safeUrl(data.link),
      stores,
      categories: toArray(data.categories).map(String),
      platforms: toArray(data.platforms),
      screenshots,
      thumbnail,
    });
  }

  return games.sort(
    (a, b) =>
      (a.order ?? Infinity) - (b.order ?? Infinity) ||
      String(b.released ?? "").localeCompare(String(a.released ?? "")) ||
      a.name.localeCompare(b.name)
  );
}

// ---------- templates ----------

const assetUrl = (game, file, prefix = "") =>
  file ? `${prefix}games/${game.slug}/${encodeURIComponent(file)}` : "";

const absolute = (site, rel) => {
  if (!site.url || !rel) return "";
  return site.url.replace(/\/+$/, "") + "/" + rel.replace(/^\.?\/*/, "");
};

function layout({ site, title, description, body, prefix = "", ogImage = "", pagePath = "" }) {
  const canonical = absolute(site, pagePath || "./");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">\n<link rel="canonical" href="${esc(canonical)}">` : ""}
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">\n<meta name="twitter:card" content="summary_large_image">` : ""}
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎮</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${prefix}styles.css">
<style>:root{--thumb-aspect:${esc(site.thumbnailAspect || "1 / 1")}}</style>
</head>
<body>
${body}
<footer class="site-footer"><div class="wrap">
  ${site.about ? `<div class="footer-about">${paragraphs(site.about)}</div>` : ""}
  <span>© ${new Date().getFullYear()} ${esc(site.name || "")}</span>
  ${site.email ? `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>` : ""}
</div></footer>
<script src="${prefix}app.js" defer></script>
</body>
</html>
`;
}

const tagList = (cats, cls = "tags") =>
  cats.length ? `<ul class="${cls}">${cats.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : "";

const storeButton = (st, cls) =>
  `<a class="btn ${cls}" href="${esc(st.url)}" target="_blank" rel="noopener">${esc(st.label)} ↗</a>`;

// Primary action: web Play link if there is one, otherwise the first store link.
// With all = true (game page), every store link is added as a secondary button.
const playButton = (game, extraClass = "", all = false) => {
  const stores = all ? game.stores : game.link ? [] : game.stores.slice(0, 1);
  const buttons = stores.map((st, i) => storeButton(st, `${!game.link && i === 0 ? "btn-play" : "btn-ghost"} ${extraClass}`));
  if (game.link) {
    buttons.unshift(`<a class="btn btn-play ${extraClass}" href="${esc(game.link)}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>Play</a>`);
  }
  return buttons.join("\n") || `<span class="btn btn-disabled">Coming soon</span>`;
};

function card(game) {
  const href = `games/${game.slug}/`;
  const thumb = game.thumbnail
    ? `<img src="${esc(assetUrl(game, game.thumbnail))}" alt="${esc(game.name)}" loading="lazy">`
    : `<span class="thumb-fallback">${esc(game.name.slice(0, 1))}</span>`;

  return `<li class="card" data-categories="${esc(game.categories.join("|").toLowerCase())}">
  <a class="card-thumb" href="${href}" tabindex="-1" aria-hidden="true">
    ${thumb}
    ${game.status ? `<span class="badge badge-status">${esc(game.status)}</span>` : ""}
    ${game.platforms.length ? `<span class="badge badge-platforms">${game.platforms.map((p) => esc(platformLabel(p))).join(" · ")}</span>` : ""}
  </a>
  <div class="card-body">
    <h2 class="card-title"><a href="${href}">${esc(game.name)}</a></h2>
    <p class="card-desc">${esc(game.tagline || firstParagraph(game.description))}</p>
    ${tagList(game.categories)}
    <div class="card-actions">
      ${playButton(game)}
      <a class="btn btn-ghost" href="${href}">Details</a>
    </div>
  </div>
</li>`;
}

function indexPage(site, games) {
  const counts = new Map();
  for (const g of games) for (const c of g.categories) counts.set(c, (counts.get(c) || 0) + 1);
  const categories = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const links = toArray(site.links).filter((l) => safeUrl(l?.url));

  const body = `
<header class="topbar">
  <div class="wrap topbar-inner">
    <div class="brand">
      <h1>${esc(site.name || "My Games")}</h1>
      ${site.tagline ? `<p class="tagline">${esc(site.tagline)}</p>` : ""}
    </div>
    <nav class="top-links">
      ${links.map((l) => `<a class="btn btn-ghost btn-sm" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.label || l.url)}</a>`).join("\n      ")}
      ${
        site.email
          ? `<div class="contact">
        <button type="button" class="btn btn-play btn-sm" aria-expanded="false" aria-controls="contact-pop" aria-label="Contact me">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2.4V17h16V7.4l-8 5.3-8-5.3zM5.6 7l6.4 4.3L18.4 7H5.6z"/></svg><span class="hide-sm">Contact</span></button>
        <div class="contact-pop" id="contact-pop" hidden>
          <p class="contact-label">Email me at</p>
          <p class="contact-email">${esc(site.email)}</p>
          <div class="contact-actions">
            <button type="button" class="btn btn-play btn-sm" data-copy="${esc(site.email)}">Copy</button>
            <a class="btn btn-ghost btn-sm" href="mailto:${esc(site.email)}">Open mail app</a>
          </div>
        </div>
      </div>`
          : ""
      }
    </nav>
  </div>
</header>

<main class="wrap">
  ${
    games.length
      ? `<div class="toolbar">
    ${
      categories.length
        ? `<div class="chips" role="group" aria-label="Filter by category">
      <button type="button" class="chip is-active" data-filter="">All <span>${games.length}</span></button>
      ${categories.map(([c, n]) => `<button type="button" class="chip" data-filter="${esc(c.toLowerCase())}">${esc(c)} <span>${n}</span></button>`).join("\n      ")}
    </div>`
        : ""
    }
  </div>
  <ul class="grid" id="grid">
${games.map(card).join("\n")}
  </ul>
  <p class="empty" id="empty" hidden>No games match your filters.</p>`
      : `<p class="empty">No games yet. Add a folder to <code>games/</code> and rebuild.</p>`
  }
</main>`;

  const first = games.find((g) => g.thumbnail);
  return layout({
    site,
    title: site.name ? `${site.name} · Games` : "Games",
    description: site.tagline || site.about || "Game portfolio",
    body,
    ogImage: first ? absolute(site, assetUrl(first, first.thumbnail)) : "",
  });
}

function gamePage(site, game, games) {
  const prefix = "../../";
  const thumbSrc = game.thumbnail ? esc(assetUrl(game, game.thumbnail, prefix)) : "";

  const details = [
    ["Status", game.status],
    ["Platforms", game.platforms.map(platformLabel).join(", ")],
    ["Orientation", game.orientation],
    ["Controls", toArray(game.controls).join(", ")],
    ["Publisher", game.publisher],
    ["Engine", game.engine],
    ["Released", game.released],
    ["Version", game.version],
    ["Build size", game.size],
    ["Languages", toArray(game.languages).join(", ")],
    ...Object.entries(game.details || {}).map(([k, v]) => [k, toArray(v).join(", ")]),
  ].filter(([, v]) => v != null && String(v).trim() !== "");

  const extraLinks = toArray(game.links).filter((l) => safeUrl(l?.url));
  const notes = toArray(game.notes);
  const idx = games.indexOf(game);
  const prev = games[(idx - 1 + games.length) % games.length];
  const next = games[(idx + 1) % games.length];

  const body = `
<main class="wrap detail">
  <a class="back" href="${prefix}">← All games</a>

  <div class="detail-top">
    <div class="detail-media">
      ${thumbSrc ? `<img src="${thumbSrc}" alt="${esc(game.name)}">` : `<span class="thumb-fallback">${esc(game.name.slice(0, 1))}</span>`}
    </div>
    <div class="detail-info">
      <h1>${esc(game.name)}</h1>
      ${game.tagline ? `<p class="tagline">${esc(game.tagline)}</p>` : ""}
      ${tagList(game.categories)}
      <div class="detail-actions">
        ${playButton(game, "btn-lg", true)}
        ${game.link ? `<button type="button" class="btn btn-ghost btn-lg" data-copy="${esc(game.link)}">Copy game link</button>` : ""}
      </div>
      ${extraLinks.length ? `<div class="extra-links">${extraLinks.map((l) => `<a href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.label || l.url)} ↗</a>`).join("")}</div>` : ""}
      ${details.length ? `<dl class="details">${details.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
    </div>
  </div>

  ${
    game.embed && game.link
      ? `<section class="section">
    <h2>Play here</h2>
    <div class="embed" data-src="${esc(game.link)}" data-orientation="${esc(String(game.orientation || "").toLowerCase())}">
      <button type="button" class="btn btn-play btn-lg">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>Load game</button>
    </div>
  </section>`
      : ""
  }

  ${game.description ? `<section class="section prose"><h2>About the game</h2>${paragraphs(game.description)}</section>` : ""}

  ${game.howToPlay ? `<section class="section prose"><h2>How to play</h2>${paragraphs(game.howToPlay)}</section>` : ""}

  ${
    notes.length
      ? `<section class="section prose notes"><h2>Notes</h2>${
          notes.length > 1 ? `<ul>${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : paragraphs(notes[0])
        }</section>`
      : ""
  }

  ${
    game.screenshots.length
      ? `<section class="section"><h2>Screenshots</h2><div class="shots">${game.screenshots
          .map((s) => `<a href="${esc(assetUrl(game, s, prefix))}" target="_blank"><img src="${esc(assetUrl(game, s, prefix))}" alt="${esc(game.name)} screenshot" loading="lazy"></a>`)
          .join("")}</div></section>`
      : ""
  }

  ${
    games.length > 1
      ? `<nav class="pager">
    <a href="${prefix}games/${prev.slug}/">← ${esc(prev.name)}</a>
    <a href="${prefix}games/${next.slug}/">${esc(next.name)} →</a>
  </nav>`
      : ""
  }
</main>`;

  return layout({
    site,
    title: `${game.name}${site.name ? ` · ${site.name}` : ""}`,
    description: game.tagline || firstParagraph(game.description) || game.name,
    body,
    prefix,
    pagePath: `games/${game.slug}/`,
    ogImage: game.thumbnail ? absolute(site, assetUrl(game, game.thumbnail)) : "",
  });
}

// ---------- build ----------

function build() {
  warnings = 0;
  const site = loadSite();
  const games = loadGames();

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const f of fs.readdirSync(SRC_DIR)) fs.copyFileSync(path.join(SRC_DIR, f), path.join(OUT_DIR, f));
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), indexPage(site, games));

  for (const game of games) {
    const out = path.join(OUT_DIR, "games", game.slug);
    fs.mkdirSync(out, { recursive: true });
    // Publish only images (data.json and any other private files stay local).
    for (const f of game.files) {
      if (IMAGE_EXT.test(f)) fs.copyFileSync(path.join(game.dir, f), path.join(out, f));
    }
    fs.writeFileSync(path.join(out, "index.html"), gamePage(site, game, games));
  }

  console.log(`✓ Built ${games.length} game${games.length === 1 ? "" : "s"} into dist/${warnings ? ` (${warnings} warning${warnings === 1 ? "" : "s"})` : ""}`);
}

function serve(port = 8080) {
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif" };
  require("http")
    .createServer((req, res) => {
      let p = path.join(OUT_DIR, decodeURIComponent(req.url.split("?")[0]));
      if (!p.startsWith(OUT_DIR)) return res.writeHead(403).end();
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
      if (!fs.existsSync(p)) return res.writeHead(404).end("Not found");
      res.writeHead(200, { "Content-Type": types[path.extname(p).toLowerCase()] || "application/octet-stream" });
      fs.createReadStream(p).pipe(res);
    })
    .listen(port, () => console.log(`→ Preview at http://localhost:${port}`));
}

function watch() {
  let timer;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        build();
      } catch (e) {
        console.error(`  ✗ ${e.message}`);
      }
    }, 200);
  };
  for (const target of [GAMES_DIR, SRC_DIR, path.join(ROOT, "site.json")]) {
    if (fs.existsSync(target)) fs.watch(target, { recursive: true }, (_, file) => !/\.DS_Store$/.test(file || "") && rebuild());
  }
  console.log("→ Watching games/, src/ and site.json for changes");
}

build();
if (args.has("--serve")) serve();
if (args.has("--watch")) watch();
