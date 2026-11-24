# The booking page

One page a specialist books from — a nail artist, a hairdresser, a barber, a
lash and brow studio, a masseur, a cosmetologist, a tattooist, a coach, a
trainer, a therapist — made by the business's own Claude from its Instagram,
in a few writes and few words, on a free plan. Not a site: one page, with what
the law asks beside it, that grows into a site later without starting over.

```
npx @jtakeit/astro create <slug> --kind booking-page --vertical nails --name "Studio Muster" --locale de-CH
```

| option | |
| --- | --- |
| `--kind booking-page` | this kind; without it `jtk create` lays a full site, as always |
| `--vertical` | nails, hair, barber, lashes, massage, cosmetology, tattoo, coach, trainer, therapist (and their usual words: manicure, brows, spa, tattooist, personal-trainer, psychologist…) — chooses the palette and the trade's example photographs; none is a nail studio's |
| `--kit` | the booking kit the diary is: `salon` by default — appointments with somebody who does them, one person laid out who does every service — or another kind, or a file of one (`--kit ./salon.json`, which is how the platform runs it offline). `sessions` for classes (a coach's, a trainer's groups): the price list is on the page the same way, written as the kit's classes, and each class's timetable is the brief's — never made up |
| `--name`, `--locale`, `--locales`, `--photos`, `--look`, `--out`, `--no-git` | as for any site ([scaffold.md](scaffold.md)) |

`--blog` and `--without` are refused: the page lays its own sections; add or
take away after it is laid. Any other `--kind` is a booking kit's, as it
always was; one that is neither is refused and said as such.

On the platform, `create_site` with the kind `booking-page` runs the same
command in its builder, offline, with what it passes for a full site:

```
jtk create [<slug>] --kind booking-page --kit <kit-file> --photos <set> --locale <xx> --name <name> --no-git --out <dir>
```

The slug may be left out there: it is then the directory `--out` names, else
the business's name made one. Nothing prompts. No currency is needed to build
or to preview — the prices read as plain numbers until `jtk/site.json` says
one, as the agent sets it from the business's price list.

## What is on the page

Top to bottom, every word and picture content — none of it in a component:

| | what | where it is written |
| --- | --- | --- |
| **Hero** | the name, one line, «Book a time» and «Prices»; the best photograph in an arch, on the right — on a phone first, a compact rounded portrait about two fifths of the screen high, cropped on its `focus` or its upper middle, the name in two lines at most and the lead in three, so the buttons are in the first screen; the Instagram link — on liquid lacquer | `jtk/pages/index.json`, block `hero0001` (`title`, `lead`, `eyebrow`, `cta_label`, `more_label`, `image`); the link from the contacts' `social` |
| **Services and prices** | a card each: photograph, name, a line, how long, the price, «Book» — which chooses it in the form | `jtk/entries/services/<slug>.json` (`title`, `about`, `photo`, `takes` in minutes, `costs` as `{ "minor": 9500 }`); the head in block `serv0001` |
| **The booking** | the template's booking form, under the services, at `#book` | the diary: `jtk/modules/bookings.json` (`page: "/"`, the hours, the rules); who does the services: `jtk/entries/masters/<slug>.json` — one entry is a solo business |
| **Latest posts** | the business's Instagram posts from the media library, a wall: a picture with its post opens the post in a new tab, a small Instagram glyph over it on hover; one without opens whole (lightbox, a swipe between them on a phone, a tilt under a mouse); `@handle` beside the heading, linked to the profile | block `gall0001`: `title`, `instagram`, `images`: `[{ "_key", "src": "media/<site>/<hash>.jpg", "alt", "href" }]` — see [the posts](#the-posts) |
| **Location** | the address and a map link, the hours with «open now», the telephone and email, Instagram | `jtk/shared.json`: `contacts` (`street`, `postal_code`, `city`, `country`, `phone`, `email`, `maps`, `social`); the hours are the diary's (`jtk/modules/bookings.json`, `hours`); the heading in block `ctab0001` |
| **Legal** | the imprint and the privacy page, linked from the foot | `jtk/pages/imprint.json` — the business's own lines; the privacy page is the template's, with the platform's processing link (`PROCESSING_URL`; jtakeit-core wiki/116) |

Every one of them is placeholder until written: «Studio Muster», Musterstrasse
1, «One line about what you do and for whom — say it in your own words», the
example's prices, the trade's example photographs, the handle `your_instagram`
and its posts `https://www.instagram.com/p/your_post_1/` and on. The platform's advice says
a page still shows them (`JTK_W_EXAMPLE_LEFT`).

### The posts

The gallery block, `gall0001` in `jtk/pages/index.json`, is what the platform
writes when it builds the page from the business's Instagram (the owner,
24 November 2026):

| field | where | |
| --- | --- | --- |
| `instagram` | on the block | the handle, without `@` — `"annas.nails"`. Shows `@annas.nails` with the Instagram glyph beside the heading, linked to `https://www.instagram.com/annas.nails/`. Declared in `src/content/blocks.ts` as an optional text field (`client_editable`, `no_tap_target`, `beside: 'title'`, `localized: false`): the owner changes it in the panel from the heading; a translation never gives it |
| `href` | on each picture in `images` | the post's address — `https://www.instagram.com/p/ABC123/`. A tap opens it in a new tab (`target="_blank" rel="noopener"`), never the lightbox; a key and a screen reader hear «Open this post on Instagram» in the page's language (`post` in `src/components/site/words.ts`), then the picture's own `alt`. Only an `https://` address is followed. A picture without one keeps the lightbox. Not declared: a gallery's picture is the platform's `{ _key, src, alt }`, and `href` rides on it; a translation's pictures are the original's, so the posts are the same in every language |
| `title` | on the block | «Latest posts» in the site's language — «Neueste Beiträge», «Derniers posts», «Ultimi post», «Últimas publicaciones», «Últimas publicações», «Последние посты», «Najnowsze posty», «Останні пости» — the same words the platform writes, so never counted as the example's |

```json
{
  "_key": "gall0001",
  "type": "gallery",
  "v": 1,
  "title": "Latest posts",
  "instagram": "annas.nails",
  "arrangement": "ragged",
  "images": [
    { "_key": "gall0101", "src": "media/<site>/<hash>.jpg", "alt": "French manicure, almond shape", "href": "https://www.instagram.com/p/ABC123/" }
  ]
}
```

The links are the gloss look's wall (`arrangement: "ragged"`, the page's);
another arrangement draws the template's Gallery, which opens every picture
in the lightbox.

## Three questions

An agent builds a booking page on three answers, asked in one message, and
nothing else — the rest it reads from the Instagram profile and says back:

1. **Photos.** The best one for the first screen, and up to twelve of the
   work. From their Instagram (the profile the conversation started from), or
   their own through `media_link`. They go into the site's media library and
   their keys into `image` and `images` — a post's address into its picture's
   `href`, the handle into the block's `instagram`.
2. **Services and prices.** Each one's name, how long it takes and what it
   costs — and the currency, which is `create_site`'s. One entry a service in
   `jtk/entries/services/`, the example's five replaced, not added to.
3. **Palette.** Their colours — or the palette widget's «Use the palette …»:
   `bg`, `surface`, `ink`, `muted`, `accent`, `accentInk`, `lacquerA`,
   `lacquerB`, into `palette` in `jtk/design.json` name for name
   ([looks.md](looks.md#the-palette)). Without an answer the vertical's palette
   stays.

From the profile, said back rather than asked: the name, the line under it,
the address, the hours, the telephone, the Instagram link, who does the work.

Then, with no terminal: `write_files` with those content files —
`jtk/pages/index.json` and its translation, `jtk/shared.json`,
`jtk/entries/services/*.json`, `jtk/entries/masters/*.json`,
`jtk/modules/bookings.json` (the hours), `jtk/design.json` (the palette),
`jtk/pages/imprint.json` — then `commit_and_build`, `get_built_page`, and
`preflight` with `try_booking`. A service the business no longer offers is
its file deleted; a new one is a new file. No component is opened.

## The look, and what moves

The page is laid in the `gloss` look ([looks.md](looks.md)) — a porcelain
page, Fraunces over Inter, its colours the palette — with motion on by
default and every bit of it safe to lose:

- **The hero field `lacquer`** ([hero-motion.md](hero-motion.md)): liquid
  polish in the palette's `lacquerA` and `lacquerB`, the light leaning to
  the pointer. Compiled only after the page has loaded and faded in over a
  still ground of the same colours: the heading, the button and the
  photograph paint first. No WebGL, a software renderer, reduced motion, a
  lost context: the still ground stays. `"field": ""` in `jtk/design.json`
  puts the hero on the page's own paper instead.
- **Entrances, `float`** ([surface.md](surface.md)): every block is drawn at
  rest and readable; only one below the screen is armed to rise into place
  as it is reached. Nothing in the first screen ever waits.
- **The gallery** ([gallery.md](gallery.md)): a lightbox, a tilt under a mouse,
  a swipe on a phone — the row itself one to swipe there; a picture that is a
  post leans into a faint veil and its Instagram glyph instead.
- **`prefers-reduced-motion`**: the finished page — no field running, no
  entrance, no tilt, no slide in the lightbox.

## The kind's files

Laid by `jtk create --kind booking-page` over the template every site has:

```
jtk/design.json                         the look (gloss), the field (lacquer), the palette
jtk/pages/index.json                    the page: hero, services_list, gallery, cta_banner
jtk/pages/index.<locale>.json           its words in another language
jtk/pages/imprint.json                  the imprint (+ translation)
jtk/shared.json                         contacts, header (three anchors and «Book a time»), footer (+ translation)
jtk/entries/services/<slug>.json        the price list, shown on the page (shown_on /#services-{slug})
jtk/entries/masters/alex-muster.json    the one who does every service
jtk/modules/bookings.json               the diary: the salon kit's settings, page "/", the hours
jtk/schema.json                         written from src/content/blocks.ts
src/content/blocks.ts                   the declaration: the example's types, the kit's, MODULES.bookings
src/components/sections/                Hero, ServicesList, GallerySection, Contact (the gloss look's), Intro
src/components/site/                    Look, Header (gloss); Footer, Button, Hours, Label, Page, words
src/styles/tokens.css, look.css         the gloss look's tokens and what is made of them
BRIEF.md                                the brief, with the three questions
```

The kind itself is `lib/units/bookingPage.mjs`; the palettes
`lib/units/palettes.mjs`; the look `example/looks/gloss/`. The template's
pieces it uses are every site's: `HeroField` with `lacquer`,
`gallery/Lightbox.astro`, the `float` entrance, the palette in `Layout.astro`.

## Growing it into a site

The page is the example site cut to four sections, by the same units, so the
rest is added rather than rebuilt ([units.md](units.md)):

```
npx @jtakeit/astro add blog          a journal at /blog, «Journal» in the menu
npx @jtakeit/astro add shop          the platform's shop: products, cart, checkout
npx @jtakeit/astro add team          the people (the masters stay the diary's)
npx @jtakeit/astro add questions     five questions and answers
npx @jtakeit/astro add values        what the business holds to
```

Without a terminal the platform's kit job runs the same. A section added comes
in the gloss look's colours and type. Gift cards are not a unit of the kit
yet; when they are, they are added the same way. A page of its own
for the price list is `jtk/pages/services.json` with `intro` and
`services_all` blocks, the services collection's `shown_on` moved to
`/services#services-{slug}` and `page` in `jtk/modules/bookings.json` with it
— the form then follows the list there.
