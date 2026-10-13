# Game Portfolio

A static portfolio of my games. No dependencies, just Node 18 or newer.

## Add a game

1. Create a folder in `games/`, e.g. `games/space-hopper/`. The folder name becomes the URL (`/games/space-hopper/`).
2. Add a `data.json` (copy `games/_example/data.json`).
3. Drop the thumbnail in the same folder as `thumbnail.png`, `.jpg`, `.webp` or `.svg`. You can also name it `cover.*` or `icon.*`, or set `"thumbnail": "file.png"`.
4. Run `node build.js --serve` and open http://localhost:8080.

While editing, run `node build.js --watch` to rebuild automatically on every change (Live Server is set to serve `dist/` and reloads with it). Add `--serve` too if you're not using Live Server.

Folders starting with `_` are skipped. Use `node build.js --drafts` to include them. Set `"hidden": true` to hide a game.

### data.json fields

Only `name` and `link` are required.

| Field | Shown as |
|---|---|
| `name` | Title |
| `link` | Play button URL |
| `tagline` | One-liner on the card and page |
| `description` | "About the game". Blank line = new paragraph |
| `categories` | Tags and the filter chips on the homepage |
| `platforms` | `desktop`, `mobile`, `tablet` |
| `orientation`, `controls`, `engine`, `status`, `released`, `version`, `size`, `languages` | Details grid |
| `details` | Any extra `{ "Label": "value" }` pairs for the details grid |
| `notes` | Highlighted "Notes" box. A string or a list |
| `links` | Extra links: `[{ "label": "...", "url": "..." }]` |
| `screenshots` | Image filenames in the same folder |
| `embed` | `true` adds a click-to-load iframe of `link` (only if the host allows iframes) |
| `order` | Sort order (lower comes first). Otherwise newest `released` first |
| `slug` | Override the URL name |

Only image files are published. `data.json` itself is never uploaded, so unknown fields stay private.

## Site settings

Edit `site.json` to set your name, tagline, about text, email and links. Set `url` (e.g. `https://games.example.com`) to get full share previews (Open Graph images).
`photo` (e.g. `"profile/picture.webp"`) shows a round profile photo next to your name; remove it to hide the photo.
`thumbnailAspect` controls the card image shape (`"1 / 1"`, `"16 / 9"`, `"4 / 3"`).

## Deploy to Cloudflare Pages

- **Upload manually:** run `node build.js`, then upload the `dist/` folder (Pages → Create → Direct Upload).
- **Or connect Git:** build command `node build.js`, output directory `dist`.
