/**
 * What the admin may edit on this site.
 *
 * ── the contract, before the essay ──────────────────────────────────────────
 *
 *   BLOCKS          every block type a page renders: type, v: 1, label, fields
 *   fields          key, label, kind; client_editable: true for what the owner edits,
 *                   and every such field is rendered with data-jtk-path on the page
 *   COLLECTIONS     name, label, prefix, type; pages: false for records without a page
 *   MODULES         { bookings: { services: '<collection>', resources: '<collection>' } }
 *   PAGE_SEO        the title and description of every page
 *   BUSINESS_FACTS  what the owner types once for the whole site
 *
 *   `npx @jtakeit/astro catalogue` writes jtk/catalogue.json from this file and
 *   seeds jtk/bookings.json (one bookings_config block) when MODULES turns
 *   bookings on. Push, then `validate_catalogue` by site and ref judges the
 *   whole commit. The platform's reference/contract.md has every rule in one
 *   line each, with the code that refuses it.
 *
 * ── the one file that decides whether a bespoke site is editable ────────────
 *
 * The studio's admin edits a site by tapping the text on it. It can do that for
 * any site, however that site is built, because it reads a *catalogue* — this
 * file, emitted to `jtk/catalogue.json` — rather than knowing anything
 * about these components. That is the whole reason a site built here can look
 * like nothing else and still be handed to its owner.
 *
 * So the division is:
 *
 *   src/          the design. Yours, or the agent's. Anything at all.
 *   jtk/          the values. The owner's, edited in the admin.
 *   this file     which values there are, and what each one is
 *
 * **Declare a field here and the owner can edit it. Leave it out and it is part
 * of the design.** Both are legitimate — a headline is content, a section's
 * layout is not — and that decision is yours to make per field rather than
 * something a framework makes for you.
 *
 * `fl-catalogue` emits the JSON and then checks it against the built HTML: every
 * field declared here has to appear on the page carrying its `data-jtk-path`,
 * and every annotated path on the page has to be declared here. The two cannot
 * drift, which is what stops an owner tapping a heading that never opens.
 *
 * ── a label is the words ────────────────────────────────────────────────────
 *
 * The words themselves, in the site's language, and the admin shows them as
 * written. There are no locale keys anywhere any more — the admin's own blocks
 * carried them until 30 August 2026 and now do the same as this file, so our
 * blocks and yours are drawn by one code path.
 *
 * A site in more than one language writes the label per language instead:
 *
 *     label: 'Заголовок'
 *     label: { uk: 'Заголовок', en: 'Heading' }
 *
 * Which languages a site has is `LOCALE` and `LOCALES` at the foot of this
 * file; a label naming a language the site does not have is simply never shown.
 *
 * ── the labels below are English, and that is the scaffold speaking ─────────
 *
 * They arrive in English whatever `--locale` the site was scaffolded with,
 * because they are a **starting point rather than an answer**: the design pass
 * rewrites this file for the business it is building, and it writes the labels
 * in the language the owner will read them in.
 *
 * They used to arrive in Ukrainian, which was invisible while every site was
 * Ukrainian and wrong the first time one was not — a Swiss client opening the
 * panel found their blocks labelled in a language they do not read, and
 * nothing in the build said so. English is not a translation, it is an
 * admission that the scaffold does not know yet.
 *
 * The strings a visitor sees are the other way round: those are in
 * `src/copy/`, they are interface rather than seed, nothing rewrites them, and
 * `fl-init` fills them in per locale.
 */

/**
 * The words on a control: written once for a site in one language, and per
 * language for a site in several. See the note on labels above.
 */
export type Text = string | Record<string, string>;

/**
 * A `Text` as one string, for the places that can only take one.
 *
 * A feed's `<title>`, an attribute, anything written into markup: those cannot
 * hold a map of languages, and handing them one produced `[object Object]` in
 * the output and a type error at the call site. `words()` is where that choice
 * is made once.
 *
 * The order is the site's language first, then the site's other languages in
 * the order they are declared, then whatever the map happens to hold. The last
 * step matters more than it looks: a label written only in a language the site
 * has since dropped is still better than an empty title.
 */
export function words(text: Text | undefined, locale: string = LOCALE): string {
  if (text === undefined) return '';
  if (typeof text === 'string') return text;

  const found = text[locale];
  if (found !== undefined && found !== '') return found;

  for (const other of LOCALES) {
    const next = text[other];
    if (next !== undefined && next !== '') return next;
  }
  return Object.values(text).find((one) => one !== '') ?? '';
}

/** The shapes a field can take. The admin has a control for each. */
export type Kind =
  | 'text'
  | 'textarea'
  | 'richtext_lite'
  | 'number'
  /**
   * An amount of money, as a whole number of **minor units**: 25000 is 250.00.
   *
   * Never a decimal. A JSON number is a float on both sides of the wire, and
   * money that is a float is money that is wrong the day somebody sums a
   * column; minor units are also what Stripe is handed later, so the value
   * stored is the value passed on rather than a conversion to remember.
   *
   * The currency is the site's and is not part of the value — two prices on one
   * page must not be able to disagree about it. The template writes the symbol
   * beside the amount it renders.
   */
  | 'money'
  /**
   * A length of time in whole **minutes**: 90 is an hour and a half.
   *
   * Minutes because that is the unit slot arithmetic works in, and a unit
   * nothing converts is a unit nothing converts wrongly. The panel reads it
   * back in hours beneath the box, so a mistyped 900 looks like fifteen hours
   * rather than like any other number.
   */
  | 'duration'
  /**
   * A time on a clock face, as whole minutes from local midnight: 540 is nine
   * in the morning.
   *
   * Its own kind rather than a duration because the control is the whole
   * difference: a duration answers "9 год" to "when do you open", which is
   * true of a length and false of a time. No zone travels with it — the zone
   * is the site's, declared once.
   */
  | 'time_of_day'
  | 'tel'
  | 'url'
  | 'email'
  | 'date'
  | 'select'
  | 'bool'
  | 'media'
  | 'list'
  /**
   * A reference to an entry of one of this catalogue's own collections — the
   * service a master does, the range a product is in. The field carries `ref`,
   * the collection it points into, and its value is an entry's slug.
   */
  | 'ref'
  /**
   * A document rather than a field: the body of an entry in a collection.
   *
   * Markdown, and stored as markdown — the owner never sees the syntax (the
   * admin's editor shows the result and puts pictures in at the cursor), but
   * what lands in `jtk/content/` is a file with a diff a person can read,
   * which an agent can write and Astro's own pipeline renders.
   *
   * A picture inside one is ordinary markdown, and its address is a media key
   * exactly as everywhere else:
   *
   *   ![Через два тижні](media/<site>/<hash>.jpg "Через два тижні")
   *
   * The alt text is for whoever cannot see it; the title is the caption. Where
   * on the page a picture sits is the *design's* answer, not the owner's —
   * they choose which paragraph it follows and nothing else.
   */
  | 'markdown';

export interface Field {
  /** `[a-z][a-z0-9_]*`, and permanent: it is the key in the content document. */
  key: string;
  /** What the owner sees above the control, in their language. */
  label: Text;
  kind: Kind;
  /** For a `ref` field: the collection it points into, by name. */
  ref?: string;
  /** A sentence under the control, where the field needs one. */
  hint?: Text;
  required?: boolean;
  /** Characters for text, items for a list, the value itself for a number. */
  max?: number;
  min?: number;
  /** For `select`, and only for it. */
  options?: string[];
  /** The words a select shows for each option, keyed by the option's value. */
  option_labels?: Record<string, Text>;
  /** For `list`: the fields of one row. */
  of?: Field[];
  /**
   * For `media`, and only for it: what this slot holds.
   *
   * `image` is the default and the assumption everywhere it is left out.
   * `video` is a short silent loop — see the clips of `docs/photos.md` — and it is declared
   * because what the page does with one is different: it autoplays, it loops,
   * it carries no audio track at all, and it needs a poster frame to fail to.
   *
   * **`video` is always `multiple`**, one clip included: a clip is stored with
   * its poster, and a single media field is one key with nowhere to keep one.
   * One clip is `multiple: true, max: 1`.
   */
  accept?: 'image' | 'video';
  /**
   * For `media`, and only for it: the frame this picture is shown in — '3:2',
   * '1:1', '16:9'.
   *
   * ── the frame is yours and the subject is theirs ─────────────────────────
   *
   * A client uploads a photograph in whatever shape their camera gave it and
   * the page has a slot of its own. Declaring the slot is how a row of cards
   * stops being pushed apart by one tall portrait — and it is declared *here*
   * rather than chosen in the admin because how a page is proportioned is the
   * design's answer, not something two pages of one site should differ over.
   *
   * What the owner says is which part of their picture must survive it: a
   * framed field gives every item a `focus`, and they press the subject. There
   * is no stretching, ever — a photograph with its geometry changed is a
   * spoiled photograph.
   *
   * **A framed field is always `multiple`**, one picture included, for the same
   * reason a clip is: the focus is stored beside the picture.
   */
  ratio?: string;
  /**
   * For `media`, and only for it: this slot holds *many*, in order.
   *
   * A gallery is one thing, not thirty-seven things. Declared as a `list` of
   * rows it becomes a repeater — add a row, open the row, choose a file, close
   * the row, thirty-seven times — which is the wrong shape for what it actually
   * is: a collection you drop pictures into and take pictures out of.
   *
   * So it is one field, and its value is an ordered array of items:
   *
   *   work:  [{ src: 'media/<site>/<hash>.jpg', alt: 'Дракон, передпліччя' }]
   *   clips: [{ src: 'media/<site>/<hash>.mp4',
   *             poster: 'media/<site>/<hash>.jpg', alt: 'Стенсіл' }]
   *
   * `src`, `alt`, `poster`, and nothing else — the three keys are the admin's,
   * not this file's, so they cannot be renamed per site. Each item carries its
   * own `alt` because a photograph with no alt text is announced as a file
   * name. Order is position: the array is the page.
   *
   * One picture is annotated as `blocks[3].work[7].src`, and the container is
   * not annotated at all. `alt` and `poster` never appear on the page as
   * themselves, so they carry no annotation either.
   *
   * A `list` of rows is still the right shape where every piece has *words*
   * beside it and the words are the point — see the `index` arrangement in
   * references/gallery.md. The difference is whether the owner is editing
   * entries or filling a bag.
   */
  multiple?: boolean;
  /**
   * Whether the *client* may edit it, as opposed to the studio.
   *
   * A headline is theirs. A button's destination usually is not — it points at
   * a section of a page they did not build.
   */
  client_editable?: boolean;
  /**
   * A field whose value never appears as its own element: a message a script
   * writes later, a string that lands in an attribute, a label only a screen
   * reader hears. It is edited in the panel beside the preview, so the
   * annotation check must not look for a tap target.
   */
  no_tap_target?: boolean;
  /** Shown with a warning that changing it moves the page in search results. */
  seo_sensitive?: boolean;
}

export interface Block {
  /** `[a-z][a-z0-9_]*`, and permanent: it is written into the content. */
  type: string;
  /** Bump when a field's meaning changes, never when one is added. */
  v: number;
  label: Text;
  hint?: Text;
  fields: Field[];
  /**
   * The arrangements this block may be shown in, where it has more than one.
   *
   * ── the designer writes the menu, the owner orders from it ────────────────
   *
   * How work is arranged is still the design's answer, for the reason that has
   * not changed: a handle an owner can drag is a handle two pages of one site
   * come out different through. But a page that draws pictures three ways — a
   * row of three, one large beside two small, a strip that scrolls — was
   * offering three *sanctioned* arrangements the owner could not reach: each
   * was a separate block type, and changing your mind meant deleting the
   * pictures and putting them back.
   *
   * So the menu is written here, by whoever designed the page. The owner picks
   * from it and can invent nothing.
   *
   * Only a block with one gallery in it may declare these, and then the
   * gallery must not carry its own `min`, `max` or `ratio`: they belong to the
   * arrangement, because they are not the same in each. Three side by side
   * stops being photographs of work at four; a strip that scrolls is pointless
   * under five.
   *
   * Render the chosen one: it arrives as `view` on the block, and it is always
   * one of these — a block written before the menu existed reads as the first.
   */
  views?: View[];

  /**
   * Whether this block puts a form in front of visitors and keeps what they
   * type. `'enquiry'` is the only value, and it is what the platform's
   * launch gate reads: a site that collects must have somewhere to send
   * what it collects. Say it on the block that carries the form.
   */
  collects?: 'enquiry';

  /**
   * What the form asks a visitor for, beyond what every enquiry has.
   *
   * ── the structure is the platform's, the questions are the site's ─────────
   *
   * Every enquiry has a name, a way back to the sender and a message; those
   * controls are `name`, `contact` (or `phone` / `email`), `message`, and
   * the honeypot `website`. Everything else the form asks — a wished date, a
   * service, a number of guests — is the site's own, and is declared here,
   * as fields, so the panel, the notification and the export can say what
   * each value is instead of showing a key. `LeadForm.astro` renders these;
   * a control the build finds on the form and nobody declared here fails a
   * live build with `JTK_E_FORM_FIELD_UNDECLARED`.
   *
   * Kinds a visitor can type into: text, textarea, number, bool, select,
   * tel, email, url, date, time_of_day. The structure's own keys are refused.
   */
  asks?: Field[];
}

/** One arrangement, with the limits that belong to it. */
export interface View {
  /** `[a-z][a-z0-9_]*`, and permanent: it is written into the content. */
  key: string;
  /** What the owner sees in the menu. Their language. */
  label: Text;
  /** How many pictures this arrangement holds. */
  min?: number;
  max?: number;
  /** The frame they are cropped to — see `Field.ratio`. */
  ratio?: string;
  /**
   * A page of this site where this arrangement can already be seen.
   *
   * The admin frames that page at the block and shows it in the menu, so that
   * "One large beside two small" is a picture of the thing rather than a
   * sentence somebody has to try. Costs the site nothing: no artwork to draw,
   * nothing to keep in step with the CSS, and what the owner sees is their own
   * site.
   */
  sample?: string;
  /**
   * This one cannot be shown until it is built. Rare, and worth understanding.
   *
   * The admin's preview stands in for a block the build has not made yet by
   * taking *this site's* markup from a page the build drew one on — so a
   * gallery put into a post appears immediately, in this site's own
   * arrangement, without a rebuild.
   *
   * It works for anything a browser draws from markup and CSS. It does not work
   * where the arrangement is made by a script that reads the whole page: a copy
   * put in after the page loaded is a copy that script never saw. Two of the
   * three things that could go wrong are handled — a `fl:placed` event is fired
   * on the new node so `onAlive` can start it, and a resize follows so anything
   * that measured the page measures it again — but a script that cannot be
   * asked for one subtree cannot be helped.
   *
   * You know which of yours those are. Say so here and the preview will not
   * pretend; it will say the block appears with the next build.
   */
  needs_build?: boolean;
}

/**
 * This site's blocks.
 *
 * ── three have a fixed job. Every other block on the page is yours ──────────
 *
 * The scaffold ships the three a landing page cannot do without, and they are
 * required because each one is the page failing without it, not because a
 * template says so:
 *
 *   hero        what this is, for whom, and one action. Without it a visitor
 *               arriving from a search does not know what they are looking at.
 *   cta_banner  the form. A page that sells and cannot be answered is a leaflet.
 *   questions   the questions block. It is what a hesitating visitor reads last
 *               and what an assistant lifts a paragraph out of — see
 *               `docs/pages.md` of @jtakeit/astro. It is the page's whole generative weight.
 *
 * **Everything between them is chosen, and its name is this business's own.**
 * Not `features`, `about`, `benefits`: a tattooist's page had `plates`,
 * `letter`, `conviction`, `process` and `artist`, and a page whose block names
 * could be pasted into any other site is a page that will look like it.
 *
 * The type name is permanent once content exists under it, so it is worth the
 * minute it takes to name it after what it *is* on this page.
 *
 * And a block is a job, not a band. An angle can be carried by a photograph
 * with three words on it, one sentence set across the full width, or a
 * quotation — the shape is `docs/shapes.md` of @jtakeit/astro, and
 * nothing here asks for a heading, a lead and a grid of three.
 */
export const BLOCKS: Block[] = [
  {
    /*
     * A run of prose inside a post, and the reason a post is a sequence.
     *
     * The writing used to be one markdown field, which meant everything else a
     * post could hold came *after* it: a gallery between the fourth paragraph
     * and the fifth could not be expressed at all. Putting one there is a
     * sentence about the writing, so a post is a sequence now — prose, a
     * gallery, more prose — and this is what the runs after the first are.
     *
     * The first run stays on the post itself (`post.body`), because that is
     * what the feed and the search result quote.
     *
     * Prose only. A picture in a post is a block, chosen from the menu the
     * blocks below declare, and not an `![]()` written into the text: two ways
     * to put a photograph in a page is two sets of rules for how it may look,
     * and only one of them is something this repository decided.
     *
     * Every collection that declares a `body` must name this type in it, or
     * the writing cannot be broken by anything at all.
     */
    type: 'text',
    v: 1,
    label: 'Text',
    fields: [{ key: 'body', label: 'Text', kind: 'markdown', max: 40000, client_editable: true }],
  },
  {
    type: 'hero',
    v: 1,
    label: 'Opening screen',
    fields: [
      { key: 'eyebrow', label: 'Line above the heading', kind: 'text', max: 60, client_editable: true },
      {
        key: 'title',
        label: 'Heading',
        kind: 'text',
        required: true,
        max: 80,
        client_editable: true,
        seo_sensitive: true,
      },
      {
        key: 'lead',
        label: 'Subheading',
        kind: 'textarea',
        max: 240,
        client_editable: true,
        seo_sensitive: true,
      },
      { key: 'cta_label', label: 'Button text', kind: 'text', max: 40, client_editable: true },
      { key: 'cta_href', label: 'Button link', kind: 'url', no_tap_target: true },
      { key: 'image', label: 'Photograph', kind: 'media', client_editable: true },
      {
        key: 'image_alt',
        label: 'Photograph description',
        kind: 'text',
        max: 120,
        client_editable: true,
        seo_sensitive: true,
        no_tap_target: true,
      },
    ],
  },
  {
    type: 'cta_banner',
    v: 1,
    label: 'Call to action and form',
    collects: 'enquiry',
    /*
     * One question of the site's own, as a starting point. The scaffold's
     * form asks what the message is about; a salon asks for a service, a
     * restaurant for a number of guests. Rewrite it for the business, or
     * take it out — a field the owner never reads costs a visitor for nothing.
     */
    asks: [{ key: 'topic', label: 'What it is about', kind: 'text', max: 120 }],
    fields: [
      { key: 'title', label: 'Heading', kind: 'text', required: true, max: 80, client_editable: true },
      { key: 'lead', label: 'Subheading', kind: 'textarea', max: 240, client_editable: true },
      { key: 'cta_label', label: 'Button text', kind: 'text', max: 40, client_editable: true },
      { key: 'cta_href', label: 'Button link', kind: 'url', no_tap_target: true },
      { key: 'form', label: 'Show the form', kind: 'bool', no_tap_target: true },

      /*
       * What the form asks for, in the business's own words.
       *
       * These are not interface. "Розкажіть про ідею, де на тілі і приблизно
       * який розмір" is a tattooist deciding what she needs to know before she
       * can answer, and the next business needs something else entirely — a
       * date, a number of guests, a car's registration. A visitor reads them
       * and the owner is the only person who knows what they should say.
       *
       * What stays out of the catalogue is the machinery around them: "Sending…",
       * "Sent.", the message a browser shows for an empty field. There is
       * nothing an owner wants to say in those, and the server has its own copy
       * of the refusals anyway.
       */
      { key: 'name_label', label: 'Label for the “name” field', kind: 'text', max: 60, client_editable: true },
      { key: 'contact_label', label: 'Label for the “how to reach you” field', kind: 'text', max: 90, client_editable: true },
      { key: 'message_label', label: 'Label for the “message” field', kind: 'text', max: 120, client_editable: true },
      { key: 'required_note', label: 'Line under the form', kind: 'text', max: 140, client_editable: true },
    ],
  },
  {
    /*
     * The questions, and the reason they are one of the three.
     *
     * Each answer has to stand up lifted out of the page, because that is
     * exactly what happens to it: an assistant quotes one paragraph with no
     * page around it. So an answer that begins "Так, звісно" answers nothing
     * once it is somewhere else. `docs/pages.md` of @jtakeit/astro has what the block and its
     * FAQPage markup must meet — and on a speculative build the markup waits
     * until a human has confirmed the answers.
     */
    type: 'questions',
    v: 1,
    label: 'Questions and answers',
    hint: 'Each answer has to read on its own, away from the page.',
    fields: [
      { key: 'title', label: 'Heading', kind: 'text', max: 80, client_editable: true },
      {
        key: 'items',
        label: 'Questions',
        kind: 'list',
        max: 12,
        of: [
          {
            key: 'question',
            label: 'Question',
            kind: 'text',
            required: true,
            max: 140,
            client_editable: true,
            seo_sensitive: true,
          },
          {
            key: 'answer',
            label: 'Answer',
            kind: 'textarea',
            required: true,
            max: 600,
            client_editable: true,
            seo_sensitive: true,
          },
        ],
      },
    ],
  },
];

/**
 * The sets of entries the owner may create.
 *
 * ── the one place the admin creates something the repository did not ────────
 *
 * Everywhere else, which pages a site has is this repository's to say: they
 * arrive by import, and there is no "add a page" in the admin, because a page
 * is a file somebody wrote. A collection moves exactly one thing across that
 * line, and names it:
 *
 *   this repository declares the shape    a prefix, a block type, an order
 *   the admin creates the entries         and nothing else
 *
 * So there is no "blog feature" on the platform. A blog is one collection whose
 * prefix is `/blog` and whose entries are ordered by date; a portfolio, a price
 * list, a menu or a vacancy board are the same mechanism with different words,
 * and adding one is this array plus the two routes that render it.
 *
 * ── the two routes you owe a collection ─────────────────────────────────────
 *
 *   src/pages/blog/index.astro      the listing — an ordinary page of yours
 *   src/pages/blog/[...slug].astro  one entry, from the content collection
 *
 * `fl-catalogue` checks the declaration; the build checks the rendering, the
 * same way it checks every other annotated field.
 *
 * ── the reserved keys ───────────────────────────────────────────────────────
 *
 * An entry's block type may declare whatever this business needs, but five keys
 * are spoken for, because the listing, the feed, the sitemap, the card a
 * messenger draws and the admin's own list all read them by name:
 *
 *   title    text, and required. Everything above needs one.
 *   date     date. Required if the collection is ordered by it.
 *   excerpt  textarea. The sentence under the title in the listing.
 *   cover    media, one picture. The card, the listing, og:image.
 *   body     markdown. The entry itself.
 *
 * Leave any of them out where they make no sense — a set of works has no
 * excerpt. What you may not do is give one of those names to something else.
 *
 * An entry is stored as a page whose document opens with one block of the
 * declared type, so `blocks[0].body` is an ordinary annotation path and
 * everything else — versions, drafts, publishing, media — already applies.
 *
 * ── only when it was asked for ──────────────────────────────────────────────
 *
 * **The scaffold declares none, and that is the right state for almost every
 * site.** Do not add one because a site could have one.
 *
 * A collection is a standing weekly obligation on the person who owns the site.
 * An empty blog on a live page says the business stopped caring in March, and
 * three posts from a year ago say it louder; a page that never mentions one
 * says nothing at all. The bar is a sentence in the brief that names the
 * thing — not a vertical it would suit, not room in the design, not «for
 * later». If the brief is silent, this array stays empty.
 *
 * A site that declares none shows no trace of them in the admin.
 */
export interface Collection {
  /** `[a-z][a-z0-9_]*`, and permanent once entries exist under it. */
  name: string;
  /** What the owner sees in the admin's sidebar. Their language. */
  label: Text;
  /**
   * What one entry is called — «авто», «майстер» — on the admin's button and
   * over its form. Left out, the admin says "entry", or the module's own word
   * for a collection a module is pointed at.
   */
  one?: Text;
  /** The sentence under the collection's title in the admin. */
  intro?: Text;
  /** A `select` field of `type` the entries are grouped by — a menu's courses. */
  group?: string;
  /** Where entries live: `/blog` gives `/blog/aftercare`. No trailing slash. */
  prefix: string;
  /** The block type an entry's document opens with. */
  type: string;
  /**
   * The mark beside this collection in the admin's sidebar. Name an icon of
   * Lucide — `lucide:table-2`, `lucide:scissors`, any of lucide.dev/icons —
   * or, for a mark nobody has drawn, path data on the admin's own 20×20
   * grid: `path:M4 4.2h12 M4 8h12`. Path data only, never markup; the
   * platform refuses anything that is not one of the two. Left out, the
   * admin's generic list mark.
   */
  icon?: string;
  /**
   * Which block types a post may hold besides its own.
   *
   * ── the one place an owner adds a block ─────────────────────────────────
   *
   * Which blocks a *page* has is this repository's to say, always. A post is
   * the exception: it is **written**, not designed, and "a gallery here,
   * between these two paragraphs" is a sentence about the writing. So the
   * vocabulary is declared here and the arranging happens in the admin.
   *
   * A post is a *sequence*: its opening prose, then whatever is named here in
   * the order the owner put it in — a gallery, more prose, another gallery.
   * `text` must be in this list, or the writing cannot be broken by anything;
   * everything else in it is this site's own vocabulary.
   *
   * Left out means a post is prose and nothing else, which is the right answer
   * for most collections. Name a type and this repository has to render it in
   * `[...entry].astro` — a type named here and not rendered there is a block
   * the owner can add and nobody can see.
   */
  body?: string[];
  /**
   * How the site lists them. Left out means arranged by hand, which is the
   * honest default: a set of works has no natural order, and inventing one from
   * a creation date would put the newest photograph first for ever with nobody
   * having asked for that.
   *
   * `by` names a field of `type`, and it must be a date or a number, and it
   * must be required — sorting by something an entry may not have puts those
   * entries wherever the database felt like.
   */
  order?: { by: string; desc?: boolean };
  /** Paginate the listing. Absent means one page, however many there are. */
  per_page?: number;
  /**
   * `false` for a collection whose entries have no page of their own — a
   * price list, the masters of a workshop, the tables of a restaurant: rows a
   * page lists and the diary reads, never a route each. The default is a page
   * per entry, which is what a blog wants.
   */
  pages?: boolean;
}

export const COLLECTIONS: Collection[] = [];

/**
 * A blog, ready to turn on — not on: a blog is a commitment somebody asked
 * for (docs/collections.md), and a site that never posts says so louder than
 * one without a blog.
 *
 * On is two lines at the foot of this file, which `jtk create --blog` writes:
 *
 *   BLOCKS.push(BLOG_POST);
 *   COLLECTIONS.push(BLOG_COLLECTION);
 *
 * Then the posts are `jtk/content/blog/<slug>.json` (and
 * `jtk/content/de/blog/<slug>.json` for one in German), the listing is
 * `src/pages/[...lang]/blog/index.astro`, a post's page is `[...entry].astro`,
 * the feed `/blog/rss.xml`. The five reserved keys of an entry are all here;
 * `date` and `excerpt` are drawn on the listing and are no tap targets.
 */
export const BLOG_POST: Block = {
  "type": "post",
  "v": 1,
  "label": {
    "uk": "Допис",
    "en": "Post",
    "de": "Beitrag",
    "ru": "Запись",
    "es": "Entrada",
    "it": "Articolo",
    "pt": "Artigo",
    "fr": "Article"
  },
  "fields": [
    {
      "key": "title",
      "label": {
        "uk": "Заголовок",
        "en": "Title",
        "de": "Titel",
        "ru": "Заголовок",
        "es": "Título",
        "it": "Titolo",
        "pt": "Título",
        "fr": "Titre"
      },
      "kind": "text",
      "required": true,
      "max": 90,
      "client_editable": true,
      "seo_sensitive": true
    },
    {
      "key": "date",
      "label": {
        "uk": "Дата",
        "en": "Date",
        "de": "Datum",
        "ru": "Дата",
        "es": "Fecha",
        "it": "Data",
        "pt": "Data",
        "fr": "Date"
      },
      "kind": "date",
      "required": true,
      "client_editable": true,
      "no_tap_target": true
    },
    {
      "key": "excerpt",
      "label": {
        "uk": "Анонс",
        "en": "Excerpt",
        "de": "Anriss",
        "ru": "Анонс",
        "es": "Extracto",
        "it": "Estratto",
        "pt": "Resumo",
        "fr": "Chapeau"
      },
      "kind": "textarea",
      "max": 200,
      "client_editable": true,
      "no_tap_target": true
    },
    {
      "key": "cover",
      "label": {
        "uk": "Обкладинка",
        "en": "Cover",
        "de": "Titelbild",
        "ru": "Обложка",
        "es": "Portada",
        "it": "Copertina",
        "pt": "Capa",
        "fr": "Couverture"
      },
      "kind": "media",
      "client_editable": true
    },
    {
      "key": "body",
      "label": {
        "uk": "Текст допису",
        "en": "Text",
        "de": "Text",
        "ru": "Текст записи",
        "es": "Texto",
        "it": "Testo",
        "pt": "Texto",
        "fr": "Texte"
      },
      "kind": "markdown",
      "max": 40000,
      "client_editable": true
    }
  ]
};

export const BLOG_COLLECTION: Collection = {
  "name": "blog",
  "label": {
    "uk": "Блог",
    "en": "Blog",
    "de": "Blog",
    "ru": "Блог",
    "es": "Blog",
    "it": "Blog",
    "pt": "Blog",
    "fr": "Blog"
  },
  "one": {
    "uk": "допис",
    "en": "post",
    "de": "Beitrag",
    "ru": "запись",
    "es": "entrada",
    "it": "articolo",
    "pt": "artigo",
    "fr": "article"
  },
  "icon": "lucide:newspaper",
  "prefix": "/blog",
  "type": "post",
  "order": {
    "by": "date",
    "desc": true
  },
  "per_page": 10,
  "body": [
    "text"
  ]
};

/**
 * The domain modules this site turns on, and what each is pointed at:
 *
 *   export const MODULES: Modules = { bookings: { services: 'services', resources: 'masters' } };
 *
 * One door. A module is on because it is named here, and everything that
 * follows — the settings document `jtk/bookings.json`, the diary, the form's
 * endpoints, the gate at the launch — asks this one question. The modules
 * reference on the platform says what each module wants pointed at it.
 *
 * The settings document has one shape — a document of one `bookings_config`
 * block, the settings as its fields — and `jtk catalogue` seeds an empty one
 * beside the catalogue when it is missing. Fill in the block; do not write
 * the settings as top-level keys, which the platform refuses on import.
 */
export type Modules = Record<string, Record<string, string>>;
export const MODULES: Modules = {};

/**
 * The language this site is written in.
 *
 * `META.lang` in `src/copy/` is this value, and `<html lang>` is that — one
 * declaration, read by the page and by the platform. Set by `fl-init`; change
 * it only if the site itself changes language.
 *
 * It is here, beside the others, because **a site declares every language it
 * has in one place.** It used to live only in the admin's own record of the
 * site, set when the site was created and changeable by nobody, so a site
 * written in English could carry a record saying Ukrainian — and every screen
 * that named a language named the wrong one.
 */
/**
 * Where the platform says what it does with what this site's form collects.
 *
 * ── why a link and not a paragraph ──────────────────────────────────────────
 *
 * This used to be a version number beside six paragraphs of our text, written
 * into every site in every language it is built in. Two things were wrong with
 * that. It had to be translated, by us, for every language anybody ever builds
 * in — and it went stale: the day the platform changes what it keeps or for how
 * long, every site in the world is carrying a sentence that is no longer true
 * and has to be rebuilt to stop.
 *
 * A link cannot go stale. The text lives where the thing it describes lives,
 * and there is nothing on this side to keep in step.
 *
 * It also makes the check real. Prose cannot be verified; an address can — the
 * platform reads the built artifact and looks for this string, rather than
 * believing a number the build reported about itself.
 *
 * ── what is asked, and what is not ──────────────────────────────────────────
 *
 * **One link on a page that opens.** Nothing about what else that page says,
 * how it is worded, or which language it is in — that is the business's, and
 * grading it is neither our job nor within our competence.
 *
 * And it is a warning rather than a refusal. A site without it goes live and
 * somebody is told. The only thing publishing refuses over is a form with
 * nowhere to send what people write in it, which is a broken product rather
 * than an opinion about anybody's legal position. See wiki/34.
 */
export const PROCESSING_URL = 'https://jtakeit.com/processing';

export const LOCALE = '{{LANG}}';

/**
 * The languages this site has **besides** the one above.
 *
 * Declared once, here, and everything derives from it: where an entry's address
 * goes, which languages the admin offers, which translations it reports as
 * missing. A fact repeated in three places is a fact that is eventually three
 * different facts.
 *
 * Empty is almost every site. A second language is a second site to keep
 * written — every page, every post, every footer, for ever — so it is a
 * commitment somebody asked for, never a feature that seemed nice.
 *
 * The address pattern that follows is fixed, and so is everything after it:
 *
 *   /prices        /ru/prices
 *   /blog/healing  /ru/blog/healing
 *
 * The whole address is the same in every language, with the language in front.
 * That is what pairs the two — nothing is declared, so nothing can be misspelt,
 * and `fl-check` can answer "are these the same page" by looking. The price is
 * one segment of one address reading in the site's own language.
 */
export const LOCALES: string[] = [];

/** The page's own SEO. Every site has these two, whatever else it has. */
export const PAGE_SEO: Field[] = [
  {
    key: 'title',
    label: 'Page title',
    kind: 'text',
    required: true,
    max: 60,
    client_editable: true,
    seo_sensitive: true,
    no_tap_target: true,
  },
  {
    key: 'description',
    label: 'Description for search results',
    kind: 'textarea',
    max: 160,
    client_editable: true,
    seo_sensitive: true,
    no_tap_target: true,
  },
];

/** The business's own facts, which the layout reads and the owner may correct. */
export const BUSINESS_FACTS: Field[] = [
  { key: 'name', label: 'Name', kind: 'text', max: 80, client_editable: true, no_tap_target: true },
  { key: 'city', label: 'City', kind: 'text', max: 60, client_editable: true, no_tap_target: true },
  { key: 'phone', label: 'Phone', kind: 'tel', client_editable: true, no_tap_target: true },
  { key: 'email', label: 'Email', kind: 'email', client_editable: true, no_tap_target: true },
];
