# The shop

The shop is the platform's; the page draws it. Four addresses on the site's
own host — what is left, a cart priced, the checkout, the order after payment —
answer everything a buyer needs, and nothing about stock, price, shipping or
VAT is computed in the repository: the owner changes a price or sells out in
the admin and the next buyer reads it, with no rebuild.

Components: `src/components/shop/` — **a working base to copy and dress in the
site's design.** There are five, one for each piece of a storefront (a product's
page, the cart, the checkout step, the page after payment, a listing), laid by
`jtk add shop` ([units.md](units.md)). The markup is written out in each file,
every hook of it, with the scaffold's look in a `<style>` beside it; the
behaviour is [`@jtakeit/kit`](https://github.com/jtakeit/jtakeit-kit/tree/main/kit)'s
five elements, imported at the bottom of each. The markup, its classes, its
order and its look are the site's; the behaviour is the platform's protocol,
`shop/1`, and is the kit's to keep, not the site's to rewrite. The contract in
full is the platform's `jtakeit:///guides/shop-on-the-site.md` and
`jtakeit:///reference/shop-protocol.md`, read through its MCP server.

A site on another generator takes the same elements and writes the markup
itself ([On another generator](#on-another-generator)).

## Turning it on: `jtk add shop`

```
npx @jtakeit/astro add shop [--kit <file>] [--country <XX>] [--api <url>] [--dry-run]
npx @jtakeit/astro remove shop [--force]
```

The shop is added to a site, never copied into every one: `jtk create` makes
none. It works on a contract-3 site that `jtk create` laid out, and a salon
may add it beside its booking kit. The kit is the platform's, asked of it
(`GET /v1/kits/shop` at `https://api.jtakeit.com`, or the `--api` or
`JTK_API_URL` given) or read from a file with `--kit`. It lays:

- **the declaration** — in `src/content/blocks.ts`, under a line that says
  *The shop kit: yours from here on*, the `product` type in `BLOCKS`, the
  `products` collection in `COLLECTIONS` (its pages at `/shop/<slug>`, its
  listing at `/shop`), and `shop: { products: 'products' }` in `MODULES`. Run
  `npx @jtakeit/astro schema` after it;
- **the settings** — `jtk/modules/shop.json`: one zone, `home`, whose country is
  the site's (`--country CH` says another; otherwise the region of the locale,
  `de-CH` is `CH`, otherwise the shared contacts' country), and two methods in
  it, `post` and `pickup`, **with no price** — what the business charges to
  send is a fact only the business has. `kit` and `kit_version` record which
  kit they came from, as the booking kit's do, so that a later fix reaches the
  site as `JTK_W_KIT_BEHIND`;
- **the storefront** — the five components, the cart's page, the page after
  payment and the listing's page (`src/pages/[...lang]/cart.astro`,
  `order.astro`, `shop/index.astro`), written where the site has none, and
  «Cart» in the header's menu;
- no product. The products are the business's, by hand or by
  [`jtk import products`](#jtk-import-products), and their stock is the
  platform's (`set_stock`).

What the kit asks of the business is printed, as `add booking` prints it: ask,
never make up — the catalogue, whether any product has variants or
customizations, where it ships and each method's price, pick-up, and which
products VAT treats differently. What a person does, never an agent, is the
panel's: link the business's Stripe account, link where new orders go, and
switch VAT on.

`jtk add shop` changes **no file the scaffold owns**. A site laid out before
this release is told the lines to add instead: `devShop` in
`jtakeit-meta.mjs` ([On localhost](#on-localhost)), and the two lines of
`src/pages/[...entry].astro` that hand a product to `Product.astro`. A
component or a page the site already has is left as it is.

`remove shop` takes out what the kit added, each element found by the line
above it, and refuses while `jtk/entries/products/` holds a product — the
products are the business's: move or delete them first. The settings are
deleted only where they are still as the kit laid them; one with a rate, a band
or a second country is yours now, and is left and named. A storefront file the
site has not changed is deleted; one it has is left and named, and `--force`
deletes it.

## The products

A product is an entry of the collection `products`; the module reads it by its
fields (`jtk/entries/products/<slug>.json`, a translation beside it as
`<slug>.<locale>.json`). Prices are whole minor units of the site's one
currency — `{ "minor": 2990 }` is CHF 29.90 — and the currency is the site's,
never the page's ([booking.md](booking.md) says why).

| field | kind | |
| --- | --- | --- |
| `title`, `description` | text | what the owner writes, in each language the site has |
| `cover`, `pictures` | media | the cover and the others; the library's keys, never files in git ([media.md](media.md)) |
| `options` | list | `name`, and `values`, each with a `label`: *Size* — S, M |
| `variants` | list, required | `sku`, `price`, `weight` (whole grams), `picks` (a value of each option), `on_sale` |
| `customizations` | list | what the buyer is asked: `name`, `kind` (`choice`, `yes_no`, `text`), `required`, `max`, `choices` (each with a `label` and what it `adds`), `adds` |
| `tracked` | bool | whether stock is counted; `false` is made to order and is never sold out. Counted unless it says otherwise |
| `size_class` | select | `letter`, `parcel`, `bulky`: what a shipping method's bands are by; `parcel` unless it says otherwise |
| `tax_code`, `tariff_number` | text | the owner's facts for Stripe and customs: edited on the product's card and **drawn nowhere** for a buyer (`no_tap_target`) |
| `made_in` | text | where it is made, said on the product's page under its label |

**A simple product** has one variant and no option (the entry's `fields`):

```json
{ "title": "Becher", "variants": [{ "_key": "v1", "sku": "MUG-1", "price": { "minor": 1450 }, "weight": 350 }] }
```

**One with options** has a variant for each combination, and each variant's
`picks` names an option and its value **by `_key`**:

```json
"options": [
  { "_key": "size", "name": "Size", "values": [{ "_key": "s", "label": "S" }, { "_key": "m", "label": "M" }] },
  { "_key": "colour", "name": "Colour", "values": [{ "_key": "red", "label": "Red" }, { "_key": "blue", "label": "Blue" }] }
],
"variants": [
  { "_key": "v1", "sku": "FOX-S-RED", "price": { "minor": 2990 }, "weight": 180, "picks": { "size": "s", "colour": "red" } }
]
```

A `_key` that was minted is valid and means nothing, and `picks` is the one
place that depends on one: an option or a value whose key changes leaves every
variant that picks it picking nothing. Keep the keys; a product has at most
2,000 variants and any number of options. `picks` is the same in every language,
and the door (`@jtakeit/kit/content`) reads it as `{ option: value }` — a
`picks` that is malformed reads as nothing picked, and the platform's judge
(`validate_schema`) says the fault.

**Customizations** are questions on the page that change the line, never the
product: a *choice* (a select; each choice may add to the price), a *yes-or-no*
(a checkbox that adds an amount, never required) and a *text* (with the most
characters it takes, 1 to 500). A required one the buyer leaves unanswered is
said beside its field and sends nothing. In the panel they are under *Advanced*,
opened only for a product that has them.

**A SKU** is the business's own and unique to the site, in any case (`Mug` and
`MUG` are one). It is immutable once an order names it: a variant with history
is taken off sale (`"on_sale": false`), never reused. **Stock is never
content**: it is the platform's ledger, by SKU, set with `set_stock`
and corrected by the owner in the panel, and there is no field for it. A counted
product is sold out until its stock is set.

## The five pieces

| piece | component | element | its root hook | it asks `shop/1` |
| --- | --- | --- | --- | --- |
| a product's page | `Product.astro` | `<jtk-product>` | `form[data-product]` | what is left |
| the cart | `Cart.astro` | `<jtk-cart>` | `[data-cart]` | the cart priced |
| the checkout step | `Checkout.astro` | `<jtk-checkout>` | `form[data-checkout]` | the cart priced, then the checkout |
| the page after payment | `OrderAfter.astro` | `<jtk-order>` | `[data-order]` | the order |
| a listing | `ProductListing.astro` | `<jtk-listing>` | `[data-listing]` | what is left, for the tiles |

Each element is a module of `@jtakeit/kit` (`@jtakeit/kit/elements/shop-product`,
`shop-cart`, `shop-checkout`, `shop-order`, `shop-listing`) that the
component imports once at the bottom. A root inside the element is wired by the
element's own lifecycle, which also covers markup the panel places later
(`fl:placed`); one written bare is wired by `onAlive`.

The product's page is drawn by the entry page, `src/pages/[...entry].astro`,
with the site's `src/components/shop/Product.astro` where it has one. The cart
and the checkout step are two elements on one page, `/cart` and `/<lang>/cart`:
the checkout is hidden until the cart's *To checkout* hands on. The page after
payment is `/order`, the `return` the checkout names: Stripe sends the buyer back
to it. The listing is `/shop`.

### Copy it, keep the hooks, design the rest

An element finds everything in its piece by a **hook** — a `data-*` attribute or
a control's `name` — and never by a class. So a storefront can be rebuilt from
the components in any design: rename every class, draw the options as swatches
or a select, put the address beside the buyer, move the price. Keep the hooks
and it sells. The list, with what each is for, is `@jtakeit/kit/shop/hooks`
(`PRODUCT`, `CART`, `CHECKOUT`, `ORDER`, `LISTING`, each `{ always, said }`):

- **Always** — the piece cannot work without them. Each element says in the
  browser's console which is missing when it wires one; the part the hook stands
  for does nothing. The platform's `preflight` reads none of these hooks: a
  storefront that lost one is found by its element and by `jtk a11y`, not by the
  platform.
- **Said** — where the element writes what happened or what is left: the price
  «from», the customs notice, the order's number. Left out, that line is not
  said and nothing else changes.

**The product** — `form[data-product]` (the entry's `id`, with `data-api`,
`data-locale`, `data-facts`, `data-words` and `data-jtk-fixed` on it);
`[name^="option:"]` (a radio group or a `<select>` for each option, named
`option:<key>`, the value of each a value's `_key`); `[data-price]`;
`[data-stock]`; `[name=qty]`; `[data-add]`; `[data-product-error]`; a hidden
`[data-added]`. Said: `[name^="answer:"]` (one control for each customization,
named `answer:<key>`) and `[data-from]`.

**The cart** — `[data-cart]` (`data-api`, `data-locale`, `data-countries`,
`data-words`); `[data-cart-lines]`, empty; a hidden `[data-cart-empty]`;
`[name=country]`; `[data-methods]`, empty; `[data-subtotal]`;
`[data-cart-error]`; `[data-to-checkout]`. Said: `[data-abroad]`, `[data-vat]`,
`[data-cannot-send]` and `[data-cart-retry]`, hidden until they hold.

**The checkout** — `form[data-checkout]`, `hidden` until the cart hands on
(`data-api`, `data-locale`, `data-return`, `data-words`); `[name=name]`,
`[name=email]`, `[name=phone]`; `[data-address]` around `[name=line1]`,
`[name=line2]`, `[name=postal_code]` and `[name=city]`; `[data-total]`; an
empty, hidden `[data-challenge]`; `[data-checkout-error]`; `[data-pay]`, a
submit. Said: `[data-abroad]`, `[data-vat]`, `[data-own-currency]`.

**The page after payment** — `[data-order]` (`data-api`, `data-locale`,
`data-words`); `[data-order-state]`; `[data-order-lines]`, empty;
`[data-order-total]`; `[data-pay-again]`, a hidden link. Said:
`[data-order-number]`, `[data-order-method]`, `[data-back-to-cart]`.

**The listing** — `[data-listing]` (`data-api`, and `data-hide-sold-out` where
the site chooses it) around each product's `[data-product-tile]` (`data-product`,
the entry's `id`). Said: `[data-listing-group]` around a heading and its tiles,
and `[data-listing-empty]`.

Each root also says what it is drawing in `data-state`, for the site's CSS to
show a part by and for a walk to wait on:

| root | `data-state` |
| --- | --- |
| cart | `pricing`, `priced`, `stale` (the shop could not be asked again: the last rows, held), `empty`, `failed` |
| checkout | `pricing`, `priced`, `stale`, `failed`, `refused`, `empty`, `paying` |
| order | `loading`, `waiting`, `stopped` (still waiting after two minutes of asking), `paid`, `lapsed`, `cancelled`, `unknown` |

**What an element draws itself** carries a data attribute, never a class, to
style: `data-cart-line`, `data-line-title`, `data-line-qty`, `data-line-total`,
`data-line-remove`, `data-method-choice` in the cart, `data-order-line`,
`data-order-line-title`, `data-order-line-qty`, `data-order-line-total` on the
order's. Style a drawn part by attribute, and reach it from Astro's scoped
`<style>` as `.cart :global([data-cart-line])` — what the element draws has no
scope attribute. The rules the behaviour cannot work without — `[hidden]` means
hidden, and a focus ring where the site draws none — are put on the page by the
element itself (`<style data-jtk-cart>`, first in `<head>`, the ring at the
lowest weight), so a storefront restyled from nothing keeps them.

### What each piece asks of `shop/1`, and in what order

Every request names the protocol, `X-Jtk-Shop: 1`, and is never cached.

1. **The product** asks once, when it is wired: `GET /api/stock?product=<id>`.
   It draws which value of which option is sold out («Sold out», «3 left»,
   «In stock») and holds *Add* while the chosen variant cannot be bought. A read
   that fails says nothing and leaves *Add* on — the checkout holds the stock
   either way. *Add* asks nothing: it holds the answers to what the product
   asks, each fault said beside its field, and puts the line in the browser's
   cart, then says `jtk:cart` on the document.
2. **The cart** asks `POST /api/shipping { lines, country, locale }` when it is
   shown, when a line or the country changes, and when another tab or the page
   says the cart changed. A cart with no line asks nothing. A line the shop
   refuses is said with its reason and taken out by the buyer; *To checkout*
   is held until nothing is refused. Pressed, it writes the country and the
   method into the cart and says `jtk:to-checkout`. No quote passes from the
   cart to the checkout.
3. **The checkout step**, on `jtk:to-checkout`, shows itself, takes the focus
   to its heading, asks `GET /api/turnstile` for the challenge's key (a host
   with none sends nothing) and `POST /api/shipping` again with the stored cart —
   so the `total` it shows is what the shop prices *now* — and again whenever
   the cart changes while it is open. *Pay* sends `POST /api/checkout` with the
   buyer, the address unless a pick-up, the `total` as shown, one `attempt` and
   the page to come back to; the answer is Stripe's page. Every other answer of
   the protocol is acted on: a new price shown, a short stock said, an order
   already paid shown, a detail refused said beside its field, a lost answer
   asked again with the order's token. After `422 address` the order is
   given up and the buyer checks the address and starts again.
4. **The page after payment** asks `GET /api/order?token=<order>` from the
   token on its own address, every three seconds while the order waits, for two
   minutes at most; then it says it is still waiting and stops. While it waits
   it offers Stripe's page again (`pay_url`). Once the order is paid it empties
   the cart. A page with no token on its address asks nothing and says no order
   was found.
5. **A listing** asks only where it says `data-hide-sold-out`: once, as the page
   loads, `GET /api/stock?product=…` for its tiles, a hundred at a time, and sets
   `hidden` on each tile whose product nobody can buy, and on a group left
   with no tile. The built page lists every product either way.

### The rules behind it

- **A press is one order.** *Pay* is for one body: the lines, the country and
  method, the buyer, the address and the total. The same body pressed again —
  the answer was lost, the button pressed twice — is the same `attempt` and so
  the same order, with one hold; any other body is a new press with a new
  `attempt`. A press whose answer was `201` is over. The press is kept in the
  tab, `sessionStorage["jtk:checkout:" + api]`, as a digest of its body and none
  of the buyer's details.
- **A buyer back from Stripe's page without paying** is offered it again
  (`pay_url`) and keeps the cart. The page after payment empties the cart only
  for the order this tab's press sent to Stripe: a paid order's link opened
  later, or on another device, leaves the cart where it is.
- **The page after payment needs no cart.** It reads the order from its token
  alone: the lines as they were frozen, the number, never the buyer's contact or
  address. A token that is nobody's says so rather than waiting.
- **The price is the shop's, every time.** What the page shows is what the shop
  priced when the step was opened, and the checkout holds it to that `total`:
  a price that changed in between is refused with the new one and shown.
- **A listing never hides a product from the built page.** A crawler, a reader
  whose script never ran and a buyer whose stock read failed see every product.
  Only the element hides, and only where the site chose it: `HIDE_SOLD_OUT` in
  the listing's page, `false` as `jtk add shop` lays it.
- **The buyer's language** is the page's: `locale` goes on the shipping and the
  checkout, the order's lines are frozen in it where the product has it and the
  site's own words otherwise, and the buyer's letters are in it. A language the
  site has not got is the site's own, never a refusal.
- **Abroad.** Where the answer says `abroad` — the parcel leaves the business's
  customs area — the checkout says the customs notice beside the total, never for
  a pick-up. Where it says `vat_included`, *incl. VAT* stands beside a price;
  where `own_currency`, *You can pay in your own currency* beside the pay button.

## The words

The storefront's words are `@jtakeit/kit/shop/words`: `shopWordsFor(locale)`
gives what every piece says — *Sold out*, *Add to cart*, *To checkout*, the
reason a line was refused, the order's states — in the kit's eight languages
(`uk`, `de`, `en`, `ru`, `es`, `it`, `pt`, `fr`), English for any other. A
regional tag reads its language's words, so `de-CH` is German. A word may hold
a placeholder in braces, `{n}`, `{max}`, `{title}`, `{number}`, the same in
every language; a test holds every language to every key and to the same
placeholders. A sentence has no full stop at the end, so the markup may add its
own. They are plain on purpose: have a native speaker read them before a site
goes live.

A component draws its labels from them and hands the same words to its element
as `data-words`, so the markup and the element say one thing. The element reads
the kit's own under `data-words` for any a page left out; a site that wants
other words for a sentence writes its own into that object. Prices are the
door's (`site.money`, or `money` and `priceWords` from `@jtakeit/kit/money`:
«from CHF 29.90»).

## The cart's storage, and why it holds no price

The cart lives in the browser as `localStorage["jtk:cart:" + api]`, holding
`{ v: 1, lines: [{ product, variant, qty, answers }], country, method }`: the
protocol's own line and nothing else — **no title and no price.** So a cart
kept for a week can say nothing stale. Whatever the cart shows is the last
`POST /api/shipping` answer: the title in the buyer's language, the price today,
a line the shop no longer sells refused with its reason. `api` is the page's
base, `/api/` on the site's host and `/p/<slug>/api/` on a preview, so a
preview has a cart of its own and never shares one with the live site.

What is read from storage is held to that shape whatever was written there — by
another page of the site, an older kit, or by hand. A browser that keeps no
cart (site data blocked) is said to the buyer and not hidden: *Add* adds
nothing there. The cart is the kit's: `@jtakeit/kit/shop/cart` gives its pure
functions (`readCart`, `addLine`, `setQty`, `removeLine`, `shippingBody`, up to
`MAX_LINES` = 100 lines of at most `MAX_QTY` = 999).

## `X-Jtk-Shop: 1`

Every request an element makes says which protocol it speaks, `X-Jtk-Shop: 1`
(`SHOP_PROTOCOL` in `@jtakeit/kit/elements/shop-wire`), and carries
`cache: "no-store"`: what is left, and what a cart comes to, change with every
checkout, and a count a minute old sends a buyer to pay for the last item
somebody else is holding. A page is a file in a build — a site keeps the kit it
was built with — and the platform answers it by this number for as long as a
live site speaks it. The number moves only with a change the platform cannot
make by adding; within a version a field may be added and nothing is renamed.
A request that names none is read as version 1, and `jtk a11y` fails a page
that sent one without it (*every request names the protocol version*), as it
does for the booking form's `X-Jtk-Booking`.

A field a page sends that the protocol does not name is refused to somebody the
site knows (a preview, the studio, its agent), and dropped for a stranger, so a
buyer is never turned away for the page's mistake. Try the checkout on the
preview first; `get_site` says what a stranger's page dropped, in `shop_drops`.

## Its look is the site's to give

The components' `<style>` is the scaffold's look: neutral, legible, in the
site's tokens. **Restyle it before it goes out.** There is no stylesheet of the
kit's to import — the booking form has `booking.css`, the storefront has none:
every rule that makes a piece look like anything is in the component, scoped to
it, and the rules its behaviour needs are put on the page by the element. The
classes in the files are yours to rename; the hooks are what the elements read.

A storefront in the scaffold's clothes on a page designed otherwise is the
first thing the studio sees: the site's own fields and buttons, its own tile for
a product, its own words around the price. A price, and the stock beside it,
are what the shop says; the design decides how they are drawn, never what they
are.

## On localhost

`astro dev` answers the shop's four addresses itself: `jtakeit-meta.mjs` mounts
`@jtakeit/kit/devshop` at `/api`, beside `devDiary`, and reads the products
(the entries of the collection the schema binds the shop's `products` role to)
and the zones and methods (`jtk/modules/shop.json`) fresh on every request — an
edit shows at once. A storefront can be walked end to end while it is written:
the product chosen and added, the cart priced, a country and a method chosen, the
checkout filled in, a payment made on a page of the dev server's own
(`/api/dev-pay`, which says nothing is charged and offers *Pay* and *Leave
without paying*), and the page after payment.

It is a stand-in, close to the platform's and not the same:

- **No counts.** The files carry no stock, so every variant on sale of a counted
  product is in stock, and none says how many are left.
- **No VAT and no own currency** — `vat_included` and `own_currency` are false:
  localhost has neither switch. So *incl. VAT* and *You can pay in your own
  currency* are never drawn there; read them on the preview.
- **No Stripe.** The order is kept in memory until the server stops and nothing
  is asked of Stripe, of the platform or of anybody else. No hold on stock, no
  challenge, no limit on checkouts, no tax code in the order, and an order never
  lapses.
- What the platform decides and this repeats — which variant does not hold, a
  cart priced by weight band and free above an amount, the customs areas, what a
  buyer's details may be, a press kept to its buyer, a language that chooses
  words and never what is sold — is pinned by the kit's tests.

`preflight` with `try_order` is still the test of the real shop. The platform's
own twin of a dev session answers the four addresses `404`: only the site itself
or a preview of it takes orders.

## `jtk import products`

```
npx @jtakeit/astro import products <file.csv> --map <mapping.json>
    [--root <dir>] [--currency <xxx>] [--words] [--media '<link>'] [--dry-run]
```

A catalogue is a spreadsheet: a WooCommerce or a Shopify export, or any CSV.
The command reads it through a **mapping** that says which column is which
field of a product, and writes what the door reads: `jtk/entries/products/<slug>.json`
for each product, `<slug>.<locale>.json` for the words the sheet has in
another language. It is for a contract-3 site with the shop on; a site on
contract 2 is refused (`jtk upgrade contract-3` first).

**Everything is read and judged before anything is written or fetched.** A
sheet with one fault leaves the tree as it was, and every fault names its row
— the line of the sheet, the header being line 1 — and its column. An import
that writes wrong data into a business's catalogue is worse than one that writes
none.

The sheet is **CSV UTF-8**: quotes as RFC 4180 has them, a line break inside a
quoted cell, a BOM taken off, the delimiter read off the header or said in the
mapping. UTF-16 and any other encoding are refused, so that no word is read as
another. The prices are read in the minor unit of the site's currency
(`jtk/site.json`'s `currency`, or `--currency` where the site has none; one that
contradicts the site's is refused).

### The mapping, whole

```jsonc
{
  "v": 1,
  "decimal": ".",                       // required: how the sheet writes 12.50
  "collection": "products",             // optional: where the products go
  "delimiter": ";",                     // optional: "," ";" "\t" or "tab"
  "group":  { "by": "Handle" },         // optional: how rows make products
  "skip":   { "column": "Type", "values": ["grouped"] },   // optional
  "fields": { … }
}
```

Nothing in it is guessed. A key the import does not read is refused — a
misspelt `"prize"` is a price the business never gets — and so is a column the
sheet has not got, or has twice, naming the key that names it. A column is the
name of one of the sheet's, in quotes.

| key | says |
| --- | --- |
| `v` | `1` |
| `decimal` | `"."` or `","`, and the mapping **must** say it: a price is never guessed |
| `collection` | the collection the products go into; left out, the shop's `products` |
| `delimiter` | `","`, `";"`, `"\t"` (or `"tab"`); left out, the one of the three that divides the header most |
| `group` | none: a row a product. `{ "by": "<column>" }`: rows with one value are one product (Shopify's `Handle`); the first is the product's own, and a row with none is refused. `{ "parent": "<column>", "of": ["<column>", …] }`: a row names its parent by a value another row has in one of those columns — WooCommerce's `id:20`, or a SKU — and a row that names none is a product |
| `skip` | `{ "column", "values" }`: a row whose cell in that column is one of the values, compared without regard to case or the spaces round it, is **left out, and each is said** — WooCommerce's grouped and external products. A variation that names a skipped row as its parent is refused |

`fields` (a column is a string):

| field | says |
| --- | --- |
| `title` | **required.** A column, or `{ "<language>": "<column>" }` for each language the sheet has the words in. A column alone is the site's own language, and the site's own language must have one; every language named must be one the site has |
| `description` | the same. HTML is made text ([below](#the-words-and-the-numbers)) |
| `slug` | the column of the product's address; where it is empty, one is made from the title |
| `sku` | the variant's SKU |
| `price` | **required.** A row with a price is a variant |
| `options` | a list of `{ "name": "<column>" \| { "is": "<name>" }, "value": "<column>", "none"?: ["…"] }`, one for each option a product may have: the column of the option's name (or the name itself, `{ "is": "Size" }`), the column of its value, and `none`, the words that say *no value* — Shopify's `"Default Title"` for the only variant of a product with no options |
| `weight` | a column of grams, or `{ "column", "unit": "g" \| "kg" }` |
| `size_class` | `letter`, `parcel` or `bulky` |
| `tax_code` | Stripe's tax code: `txcd_` and eight digits |
| `tariff_number`, `made_in` | text; the owner's facts for customs |
| `pictures` | a column of addresses and paths; a bare column string splits a cell on `,`; `{ "column", "split": ";" }` says the text between them where it is not a comma ([Pictures](#pictures)) |
| `stock` | the starting stock, a whole number from 0 to 999,999 ([Stock](#stock)) |
| `on_sale`, `visible`, `tracked` | a switch. A column alone reads `yes`/`no`, `true`/`false`, `1`/`0`, `on`/`off`, and any other word is refused with the key to say it; `{ "column", "yes": ["active"] }` says which values are yes, every other no. An empty cell says nothing: a new product has its default and a matched one keeps what it has |

### A WooCommerce export

The kit's repository holds this mapping as `test/fixtures/import/woocommerce.json`,
with `woocommerce.csv`, the export's columns it was written for, beside it. A
variable product's variations name their parent as `id:20`, so they are grouped
by `Parent` and looked up in `ID` or `SKU`; WooCommerce's grouped and external
products are left out; the weight is in kilograms; the site is in German with
English beside it:

```json
{
  "v": 1,
  "decimal": ".",
  "group": { "parent": "Parent", "of": ["ID", "SKU"] },
  "skip": { "column": "Type", "values": ["grouped", "external"] },
  "fields": {
    "title": { "de-CH": "Name", "en": "Name (EN)" },
    "description": "Description",
    "sku": "SKU",
    "price": "Regular price",
    "weight": { "column": "Weight (kg)", "unit": "kg" },
    "stock": "Stock",
    "visible": { "column": "Published", "yes": ["1"] },
    "options": [
      { "name": "Attribute 1 name", "value": "Attribute 1 value(s)" },
      { "name": "Attribute 2 name", "value": "Attribute 2 value(s)" }
    ]
  }
}
```

### A Shopify export

The repository's `test/fixtures/import/shopify.json`, with `shopify.csv`. A product is the rows with one `Handle`;
the handle is its address; Shopify's `Default Title` says a product has no option;
the weight is in grams; `active` is the only status that shows:

```json
{
  "v": 1,
  "decimal": ".",
  "group": { "by": "Handle" },
  "fields": {
    "title": "Title",
    "description": "Body (HTML)",
    "slug": "Handle",
    "sku": "Variant SKU",
    "price": "Variant Price",
    "weight": "Variant Grams",
    "stock": "Variant Inventory Qty",
    "visible": { "column": "Status", "yes": ["active"] },
    "options": [
      { "name": "Option1 Name", "value": "Option1 Value", "none": ["Default Title"] },
      { "name": "Option2 Name", "value": "Option2 Value" }
    ]
  }
}
```

It names no `pictures`. Add `"pictures": "Image Src"` to take the export's
photographs: a product's rows, the extra ones that only carry a picture
included, each name one.

### What a row is

- **A variant is a row with a price.** A parent row of variations with none,
  and a row that only adds a picture, are no variant; a row with a SKU or an
  option value and no price is **refused** — a variant is sold at a price or not
  at all. A product has at most 2,000 variants.
- **A variation's values pair with its product's options by the attribute name
  in its own row**, compared trimmed and case-blind. WooCommerce numbers a
  variation's attributes from 1 over the variation's own, so the third pair of a
  row is not the third attribute of its parent: `size` pairs with the parent's
  `Size`. Where a row's name cell is empty, by the position of the pair, as
  Shopify writes the names on a product's first row alone. A name the first row
  does not have is refused with its row and column; an attribute no variation
  uses is left out and said.
- **A simple product's attributes make no options.** WooCommerce's attributes of
  a product with no variations describe it; the import leaves them out and says
  so.
- **Two rows with one SKU** (a SKU is one variant's, in any case) are refused,
  naming both rows; so are two variants of one product that pick the same
  values.
- **Under `group.parent`, an empty weight is the parent's.** A variation's size
  class or tax code is the product's, the parent row's: an empty cell is that,
  and one that differs is refused.

### SKUs and keys

The business's SKUs are kept. A variant the sheet leaves without one is given
the SKU the platform would have made — the product's slug and its values' keys,
capitals, joined by dashes: `T-SHIRT-FOX-M-BLUE` — numbered `-2`, `-3`… where
the site or the sheet has taken it. An option and a value get the key the panel
would give from their names: *Size* is `size`, *Extra large* is `extra-large`, a
shoe's 42 is `x42`. The two are held to the platform's own cases (`@jtakeit/kit/shop/skus`,
a copy), so an import and a person in the panel never disagree about what a
thing is called, and the keys are kept: `picks` depends on them.

### A second import

Import the same file again — or an updated one — and it **matches by SKU** (in
any case; a variant with no SKU by the product's address and its picks) and
updates what the file says. The sheet's numbers and switches are taken: prices,
weights, `on_sale`, `visible`, `tracked`, the size class, the tax code and the
customs fields. What the owner did stays:

- the `id`, every `_key` and the `rank`;
- **the owner's words.** A title, a description, an option's name or a value's
  label the entry holds that differs from the sheet's is kept, and each is said:
  an owner who renamed a product in the panel does not have it renamed back.
  `--words` takes the sheet's;
- every variant the sheet does not name, and a **product the file does not name
  is left alone**: not read again, let alone written;
- the pictures a product already has: the sheet's are not fetched again;
- anything a cell leaves empty: an empty cell erases nothing.

A SKU is never changed: a row that names a SKU the product does not hold for the
picks of a variant that holds another is said and skipped. A variant the sheet
adds is added where it picks values of the product's options (a new value is
added to its option); an option the product does not have is refused — the
options of a product are the owner's to change in the panel, since each variant
picks a value of each. One product of the sheet that is two of the site's, or two
of the sheet's that are one of the site's, is refused, naming both.

### The words and the numbers

- **Slugs are made as the panel makes them** (a copy of its `slugify`, held to
  the panel's cases): lowercase, Ukrainian first — `и` is `y`, `ї` is `yi` — then
  Russian, German (`ä` is `ae`) and Polish letters, an accent stripped, at most 60
  characters. A `slug` column gives the address itself, in lowercase letters,
  digits and single dashes, at most 80 characters. A made address that is taken is
  numbered, `-2`; a given one that is taken is refused. `media` is no address: the folder beside an entry
  holds the pictures a build fetches there.
- **A description's HTML is made text, its tags known by their shape.** A tag is
  a name after a bracket — `<p>`, `<br>`, `<o:p>`, `<my-element>`; a `<script>`,
  a `<style>` and a `<template>` go with what they hold; a paragraph or a `<br>`
  is a line break, and whitespace collapses as a page collapses it. Entities are
  read **after** the tags are out, so `Tom &amp; Jerry` is `Tom & Jerry` and
  `&lt;abc&gt;` is the text `<abc>`. A `<` that begins no tag is a character:
  `<info@shop.ch>`, `a < b`, `<3`. A description holds at most 4,000
  characters, a name 120.
- **An amount is digits and the mapping's decimal.** No sign, no thousands
  separator, no currency. **More digits after the separator than the currency has
  is refused, zeros included**: `12.500` is no 12.50, and with `"decimal": ","`
  `1,250` in CHF is no 1.25 and no 1250 — three digits after a comma is also how a
  thousands separator looks, so it is said so, and nothing is rounded.
  `12,50` with `","` is 1250, and `12,50` without it is refused with the hint.
- **A weight is whole grams.** `0.18` kg is 180 g; at most **three decimals in
  kilograms** and **none in grams**, zeros included (`0.1800` kg and `180.0` g are
  refused). A weight with more is never rounded.

### Pictures

A `pictures` column names a product's photographs by address or by path. They are
fetched **on this machine, never by the platform**, into
`src/assets/products/<slug>-<n>.<ext>` and named in the entry as slots — the
first is the cover, the others its pictures — and `jtk media push` then writes the
library's key in each slot's place and moves the file to `.jtakeit/adopted/`
([media.md](media.md)). A picture never reaches git.

- **A picture is taken by what its first bytes are**, never by its name or the type
  an address says it is: a JPEG, a PNG, a WebP or an AVIF. A page that answers an
  address is none, and a path that leads to any other file is none.
- **No SVG**: a drawing from a stranger's sheet may carry script the library would
  serve, so it is added by hand. A **HEIC** photograph is said as one — export it
  as a JPEG. A video is said to be one.
- **An address is fetched over `http:` or `https:` only**, for at most **20 seconds**
  a file, and at most what the library takes a file: 8 MB. It is read as it comes
  and stopped there, never fetched whole and then measured.
- **A path is read only inside the sheet's folder**: no absolute path, no `..`
  out of it, no link out of it, and only a file.
- **An address several products name is fetched once.**
- **`src/assets/products/` is git-ignored before the first file is written.**
- What cannot be had is **said, with its row and its address, and the product
  is written without it**: a 404, a page, a file over the most, a slow address. The
  summary says how many were left out, and a few of them.

`--media '<link>'` — `media_link`'s, quoted — then runs the push in the same run:

```
npx @jtakeit/astro import products catalogue.csv --map mapping.json --media '<media_link url>'
```

Two things to say plainly, to the developer and to yourself:

1. **`--media` runs the whole `jtk media push`**, not only the import's pictures:
   everything the content names that is not a key of this site goes with them, so
   **a fresh site's example photographs are sent with the import's** — to the
   site's library, at the site's hourly budget. Run `npx @jtakeit/astro media
   push --dry-run` first to see the plan.
2. **A stranger's sheet — a supplier's catalogue — can make this machine ask any
   address it names**, the developer's own `localhost` and link-local addresses
   included: the import sends a GET to each address of the `pictures` column, from
   this machine, whatever the address is. Only an image is ever kept — any other
   answer is dropped and said — but the request has been made.
   **Read a stranger's sheet before importing it.**

The push is stopped by the link's fifteen minutes or the site's hourly budget
(300 files, 250 MB); what reached the library has its key written. The import
says how many pictures are still files on this machine only, **exits 1**, and
says that a commit before they are pushed builds the site without them — the
platform builds from git. Run the same command again with a new `media_link`:
nothing is fetched again, and the keys are written for the rest. Without `--media`
the same is said of every picture, and the push is yours.

### Stock

Stock is never content, so the sheet's `stock` column goes to a file for
`set_stock`, never a field of the site: `.jtakeit/stock.txt`, one SKU and its count
a line — `FOX-S-RED 5` — in the sheet's order, at most 5,000 lines to a file (the
tool's limit; the next file is `stock-2.txt`). The import adds `.jtakeit/stock*.txt`
to `.gitignore`: a count committed is a stale one. The files are this import's,
replaced whole; one of an earlier import this one has no lines for is taken away,
and a mapping with no `stock` column says that an earlier file holds another
sheet's counts.

Send the text of each file to `set_stock` with the site's id. It sets how many
are on hand for the SKUs that have not sold yet; **a SKU that has sold is the
owner's**, corrected in the panel, and `set_stock` leaves it as it is and names
it. A counted product is sold out until its stock is set, so set it before the
site is looked at.

### `--dry-run`

```
npx @jtakeit/astro import products catalogue.csv --map mapping.json --dry-run
```

says what it would do and does none of it — nothing written, nothing fetched.
Each product it would make, update or leave as it is, the SKUs it would make,
every change of a second import as *before → after*, what it would skip and
leave out, the pictures it would fetch, the lines of the stock file and what it
would add to `.gitignore`. A sheet that would be refused is refused the same.
Run it first.

```
jtk import products --dry-run: this is what it would do, and nothing is written or fetched.
  would make becher (row 2, 1 variant)
  would make t-shirt-fox (row 3, 4 variants)
    t-shirt-fox: v4 SKU T-SHIRT-FOX-M-BLUE made
  row 8 skipped: «Type» is «grouped»
  row 9 skipped: «Type» is «external»
  would write .jtakeit/stock.txt, 5 lines, for set_stock:
    MUG-1 12
    …
```

Then: `npx @jtakeit/astro schema --judge` (or `validate_schema`) judges the site
with its products before anything is pushed, and `set_stock` stocks them.

## On another generator

The storefront is not Astro's: its behaviour is `@jtakeit/kit`, and the Astro
components are the model for the markup. A site on Eleventy, a Next export, Nuxt
or SvelteKit takes:

```html
<script type="module">
  import '@jtakeit/kit/elements/shop-product';   // and shop-cart, shop-checkout, shop-order, shop-listing
</script>
```

once on each page that has the piece, and **writes the markup itself**: there is
no `renderProduct`, as there is a `renderBookingForm` — the markup, its classes
and its look are the site's, and the hooks above (`@jtakeit/kit/shop/hooks`) are
the whole contract between a piece's markup and its element. Wrap each piece in
its element (`<jtk-product>`, …) or leave it bare: importing a module defines its
element and wires every root of its piece on the page, at load and again on the
panel's `fl:placed`, found by its root hook.

What the kit gives to write it from:

- `@jtakeit/kit/shop` — `productFacts(entry, currency)`, the product's options,
  variants and customizations as the page needs them, read through the door
  (`@jtakeit/kit/content`), and `fromPrice`, `variantFor`, `valueStates` and
  `answersOf`: the decisions that need no document;
- `@jtakeit/kit/shop/words` — the words in the eight languages;
- `@jtakeit/kit/shop/hooks` — what each element reads;
- `@jtakeit/kit/shop/cart`, `/checkout`, `/order`, `/listing` — the pure parts of
  each piece, tested under Node;
- `@jtakeit/kit/money` — a price as the page says it;
- `@jtakeit/kit/devshop` — the dev server's stand-in:
  `server.middlewares.use('/api', devShop(process.cwd()))` on any server that
  takes Connect's middleware.

`jtk add shop` is Astro's — it edits `src/content/blocks.ts` — and
`npx @jtakeit/kit apply --kit shop` refuses the shop's kit and says so. On another
generator the kit is laid by hand: the platform's page for it
(`jtakeit:///kits/shop.md`) gives it whole. `jtk import products` is not Astro's: it
is run from `@jtakeit/astro`'s `jtk`, reads `jtk/schema.json` and writes entries,
on any contract-3 site.

`npx @jtakeit/astro a11y` drives each piece it finds on a built page by its root
hook, whatever generator wrote it ([accessibility.md](accessibility.md)).

## What not to do

- **Do not work out a price on the page.** Not a total, not a sum of two prices,
  not a discount, not shipping. The shop prices every line and the cart again each
  time it is shown, and the checkout holds the buyer to the `total` it priced.
  What the page may draw is the variant's price, which the shop prices again.
- **Do not keep a price in the cart**, nor a title: the cart holds the protocol's
  line and nothing else, and what it shows is the last shipping answer.
- **Do not show a count as content.** What is left changes with every checkout:
  it is read live, from `/api/stock`, never written into a page or an entry, and
  never cached. A product's «3 left» in the build is a lie by the next minute.
- **Do not leave out a hook.** An element whose piece lost one says so in the
  console and the part it stands for does nothing; `jtk a11y` finds the storefront
  that cannot sell. A restyled copy keeps every one of the *always*.
- Do not hide a sold-out product from the built page; that is the listing's
  element, once the page has loaded, and only where the site chose it.
- Do not put a Turnstile key or a Stripe key in the repository. The challenge's
  key is asked of the platform when the step opens.
- Do not write stock into a product's file or a page: it is the platform's
  ledger, and no file of the site says it.
