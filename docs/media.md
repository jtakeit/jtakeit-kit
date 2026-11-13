# Media: the site's library, from the command line

A picture the owner may change lives in the site's **media library**, and the
content names it by its key (jtakeit-core wiki/108):

```json
"image":   { "src": "media/7fd4aa8c-…/9e8d7c6b5a4f3e2d.jpg", "alt": "Heller Salon mit Holzboden" },
"gallery": [ { "_key": "p1", "src": "media/7fd4aa8c-…/a1b2c3d4e5f60718.jpg", "alt": "…" } ],
"loop":    [ { "_key": "c1", "src": "media/…/0f1e2d3c4b5a6978.mp4", "poster": "media/…/8796a5b4c3d2e1f0.jpg" } ]
```

and in an entry's body: `![Die Hände bei der Arbeit](./media/7fd4aa8c-…/1029384756abcdef.jpg)`.

That is every value of a `media` field — a hero, a portrait, a gallery, an
entry's cover, a clip and its poster, a page's SEO picture, a picture in a
module's settings — and every picture in a body. The owner sees each one in
the library, «used on» its pages, places it again elsewhere and goes back to
it after replacing it. What the code draws by itself — a texture, a logo baked
into the layout, an icon, a font — stays in the code ([photos.md](photos.md)).

**An agent never types a key.** It designs with a slot, a file name in
`src/assets/`, and the push writes the key over it; or it copies a key from the
library's index (`media pull` with a link).

## The commands

```
npx @jtakeit/astro media push '<url>' [files or dirs…] [--dry-run] [--alt words.json] [--no-tidy] [--root <dir>]
npx @jtakeit/astro media pull ['<url>'] [--root <dir>] [--media-base <url>]
npx @jtakeit/astro push '<code url>' [dir] --media '<media url>'
npx @jtakeit/astro pull '<code url>' [dir] [--no-media]
```

The URL is what the MCP tool `media_link` returns, `<api>/v1/media#t=<token>`.
**Quote it**: the token is after the `#`, which an unquoted shell may cut.
It is good for fifteen minutes and as many requests as fit, for one site's
library and nothing else; the token is sent only as a bearer and never
printed. `media_link`'s answer carries the command to run as it is.

## `media push`

In the site's directory:

1. **Finds every picture the content names** that is not a key of this site:
   - **a slot** — `"src": "atelier-raum"` → `src/assets/atelier-raum.jpg` (the
     first of `.jpg .jpeg .png .webp .avif .svg .mp4 .webm`, as `photos.ts`
     resolves it; `gallery/one` is `src/assets/gallery/one.jpg`);
   - **a path in an entry's body** — `../../../src/assets/healed.jpg`, relative
     to the entry's file;
   - **a key of another site** — `media/<other>/…`, as when a staging site's
     content is carried to its production twin, or `media/jtk-example/…`, the
     example's ([scaffold.md](scaffold.md)). Taken from `src/assets/media/`
     where it is on this machine, else from the public media host.

   In pages, entries, translations, the shared text and the modules' settings,
   at any depth; contract 2's bare strings and `<key>_alt` too.
2. **Adds the files and directories named on the command line** —
   `_photos/ _clips/` — whether or not anything names them yet: the owner
   finds them in the library, under «Not used anywhere». A clip and a still
   with one stem (`needle.mp4`, `needle.jpg`) go as a clip and its poster.
3. **Makes each ready as the panel does**: a picture over 300 KB and longer than
   2 400 px is scaled to 2 400 px (a JPEG stays a JPEG, a PNG or a WebP becomes
   a WebP and keeps its transparency), with the site's own `sharp`. A clip, an
   SVG and an AVIF go as they are. The platform takes the metadata out and
   measures the file.
4. **Asks the library which it holds already**, by the hash of the bytes as
   sent, and sends the rest, four at a time.
5. **Writes each key** over its slot, path or foreign key as soon as the
   library answers, keeping every other key of the picture (`_key`, `focus`,
   `poster`). A translation keeps its own words.
6. **Keeps the words** — and never overwrites any:
   - a field's own `alt` stays as it is;
   - an empty `alt` takes the library's words for the file (the owner's), or
     else the first the push knows: the field's elsewhere, the `PHOTOS`
     registry's for that slot, `--alt words.json`;
   - the library takes the push's words only for a file with none, and the
     content's words for a key of this site the same way, once.
7. **Keeps a copy** of each file at `src/assets/media/<site>/<hash>.<ext>` (and
   a body's beside its entry), where the dev server draws it.
8. **Tidies**: a file of `src/assets/` the push adopted that no code names any
   more — by its file name, or its slot quoted (`<Shot name="atelier-raum">`) —
   is **moved** to `.jtakeit/adopted/`, never deleted. A file the code still
   names is left where it is and listed: it is a design asset, or a photograph
   that wants a field. `--no-tidy` leaves everything.
9. Makes sure `.gitignore` keeps `src/assets/media/`, `.jtakeit/adopted/`,
   `.jtakeit/media.json` and the entries' `media/` out of git.

Then: `npx @jtakeit/astro schema`, `validate_schema` with the `site_id`, and
the code's push.

```
jtk media push: 23 pictures named by the content of 14 files, 2 files given
  the library holds 3 of 24 files already; 21 to send
  ↑ 1/21 src/assets/atelier-raum.jpg (412 KB, scaled to 2400 px) → media/7fd4aa8c-…/9e8d7c6b5a4f3e2d.jpg
  …
  moved to .jtakeit/adopted/ — nothing names them any more (never deleted; out of git and out of the build):
    src/assets/atelier-raum.jpg → .jtakeit/adopted/atelier-raum.jpg
  left in src/assets — the code still names them: …
    src/assets/logo.png — named by src/components/Header.astro
done: 21 sent (4.1 MB), 3 already in the library, 23 values rewritten in 14 files, 19 moved to .jtakeit/adopted/
next: npx @jtakeit/astro schema, then validate_schema with site_id — then the code's push
```

### Again, and after a stop

**A second run sends nothing**: the content names keys now, and the library
holds every file given. **A run that stops** — the link's fifteen minutes, the
site's hourly budget (300 files or 250 MB through links), the network — has
written the key of every file that reached the library. Ask `media_link` for a
new URL and run the same command: it carries on with the rest, and tidies what
the first run adopted.

When the platform asks it to slow down (429), the push waits as long as
`Retry-After` says, or longer each time without it, up to six times; the
hourly budget is not waited out — the push stops and says so.

### What is left, and said

- a slot that names no file in `src/assets/`;
- a GIF, a QuickTime movie, a HEIC — export a JPEG, a PNG or an MP4;
- a file over 8 MB — a clip is cut first (`jt-clips`);
- an address on the web — the library takes files, not addresses (yet):
  download it into `_photos/` and push that;
- anything the platform refuses, with its sentence.

Each is listed with its file and place; the rest goes on, and the command exits
1.

### `--dry-run`

The plan — every file, from where, where it is named, its size, whether it has
words, what would be moved and what left — with **no request and no write**.
It needs no URL.

## `media pull`

```
npx @jtakeit/astro media pull                 every key the content names, from the public host
npx @jtakeit/astro media pull '<url>'         and the whole library, and its index
```

Without a URL it needs no token: it reads `media_base` from `jtk/site.json` —
the public host the build reads — and downloads every key the content names
into `src/assets/media/` (a body's beside its entry). A file already here is
not fetched again.

With `media_link`'s URL it also writes the library's index into
`.jtakeit/media.json` — each file's key, name, words, size in pixels and bytes,
who put it there, where it is used, and its thumbnails' addresses
(`<key>.w160.webp`, `.w480.webp`, `.w960.webp` on the media host) — and
downloads the files nothing uses yet. That is how an agent finds the
photographs the owner uploaded, to place one on a new page: read the index,
look at a thumbnail, copy the key.

`jtk pull` runs the form without a URL at its end; `--no-media` skips it.

## On the dev server

`npm run dev` draws a key from `src/assets/media/`, as the build does. A key the
copy has no file for — a fresh clone nobody pulled, a photograph the owner
placed in the panel since — is fetched from the media host by the dev server
itself (`jtakeit-meta.mjs`), into the same place, and drawn when it arrives;
the placeholder until then. A static build never fetches: the platform's
pipeline downloads the keys before it builds.

## With the code

- **The code on jtakeit** (`push_code`): ask `push_code` and `media_link`, then
  `npx @jtakeit/astro push '<code url>' --media '<media url>'`. The media push
  runs first, so the files the code push sends name the keys. Without
  `--media`, a push whose content still names pictures outside the library
  says so before it sends.
- **The code on GitHub**: `media_link`, `npx @jtakeit/astro media push '<url>'`,
  then commit and push, and `import_branch`.

Nothing of the library is committed: the keys are in `jtk/`, the files are the
library's.

## Moving a site that has pictures in its code

One site at a time (wiki/108 §4.2): pull; `npx @jtakeit/astro upgrade
contract-3` where it is still on contract 2 — its last line says how many
pictures are in the code; `media_link` and `media push`; `schema` and
`validate_schema` with the `site_id`; push and build. The library then lists
every photograph the site shows.
