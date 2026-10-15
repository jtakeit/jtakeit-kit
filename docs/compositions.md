# Compositions — the sections under the hero

[shapes.md](shapes.md) has the hero and the page form. This is the catalogue for
what comes between the hero and the footer: **how one section is built**. Pick
one per section, by what the section has to do, and never the same one twice in
a row — `jt-check` compares neighbouring sections and fails two built alike.

It exists because of what happens without it. Every section of the 8001 Barber
and Schorem specs was the same object: a heading and a paragraph in one column,
a picture or a form in the other, left and right swapped now and then. Read top
to bottom it is one block said nine times, and «Who is behind the chair» above
«Ask the shop something» reads as a template with two fills.

`jtk showroom` draws every one of these live.

## The catalogue

| composition | what it is | wants | not next to |
| --- | --- | --- | --- |
| **split-media** | Words in one column, a photograph filling the other edge to edge, the section's full height. | One picture that earns half the screen. | another split-media — alternate with anything below |
| **bleed** | A photograph across the whole width, a short statement set on it with a scrim. | A wide, quiet picture; one sentence. | the hero, if the hero is a photograph too |
| **statement** | One large sentence alone, centred or flush, a lot of air around it. | A belief about the work, said in a line. | another statement |
| **numbers** | Two to four large figures with a line under each. | Facts that are numbers and are *theirs* — never invented. | numbers |
| **tiles** | Three or four cards in a row, a picture on top of each, words under it. | Services, rooms, products — things that are siblings. | people (cards beside cards) |
| **ledger** | A price list as rows: name, a line of description, length and price at the right, rules between rows. Padding inside every row. | A menu of services with prices. | a table of anything else |
| **overlap** | A large photograph with a card that overlaps its edge, half on the picture, half on the ground. | A picture and three or four lines that belong to it. | split-media |
| **steps** | Numbered stages down a line: what happens first, next, last. | A process a customer goes through — booking, a treatment, a build. | a list of anything that is not ordered |
| **people** | Portrait cards in a row that scrolls sideways on a phone; a monogram where there is no photograph. | The team. | tiles |
| **quote** | One pull quote, large, with who said it. | Words worth quoting — their own, marked as theirs. | statement |
| **sticky** | A heading that stays on the left while a list scrolls past on the right. | A long list with one idea over it: questions, rules, what is included. | another sticky |
| **closing** | A band with one sentence and the one action. The last section before the footer. | Nothing else to say — that is the point. | the footer's own content |

Each one is markup the site owns; nothing here is a component to import. The
skeletons below are where to start, in the site's own tokens.

## The rules

- **Never the same composition twice in a row.** Two of the same anywhere on a
  page is fine; neighbours are what reads as a template.
- **No two neighbours with the heading on the same side** if both are
  two-column. Alternating left and right does not make two split-medias two
  compositions — it makes one composition twice.
- **One composition carries the page's signature.** Usually `bleed`, `overlap`
  or `statement`: the section someone remembers. Spend the design there.
- **A frame keeps its padding.** A `ledger` row, a `tile`, a `people` card: the
  text inside never touches the border or the fill — `jt-check` measures it.
- **The hero is not a composition here** — it is [shapes.md](shapes.md). Its
  own two rules: the headline is at most three lines on a laptop and five on a
  phone, and the one action is on the first screen in a 1440×780 window.

## Skeletons

### split-media

```astro
<section class="split" data-reveal>
  <div class="split__words"><h2>…</h2><p>…</p><a class="btn">…</a></div>
  <figure class="split__media"><Shot name="room" alt="…" /></figure>
</section>
<style>
  .split { display: grid; min-block-size: min(80svh, 46rem); }
  @media (min-width: 62rem) { .split { grid-template-columns: 1fr 1fr; } }
  .split__words { align-self: center; padding: clamp(2rem, 6vw, 6rem); }
  .split__media { margin: 0; }
  .split__media :global(img) { inline-size: 100%; block-size: 100%; object-fit: cover; }
</style>
```

### bleed

```astro
<section class="bleed">
  <Shot name="floor" alt="" decorative class="bleed__picture" />
  <p class="bleed__line">…one sentence…</p>
</section>
<style>
  .bleed { position: relative; display: grid; place-items: end start; min-block-size: 70svh; isolation: isolate; }
  .bleed :global(.bleed__picture) { position: absolute; inset: 0; z-index: -1; }
  .bleed :global(.bleed__picture img) { inline-size: 100%; block-size: 100%; object-fit: cover; }
  .bleed::after { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(to top, rgb(0 0 0 / 0.65), transparent 60%); }
  .bleed__line { max-inline-size: 22ch; margin: clamp(1.5rem, 5vw, 4rem); font-size: clamp(2rem, 1rem + 4vw, 4.5rem); line-height: 1; color: #fff; }
</style>
```

### ledger

```astro
<ol class="ledger">
  {services.map((s) => (
    <li class="ledger__row">
      <div><h3>{s.title}</h3><p>{s.excerpt}</p></div>
      <p class="ledger__price">{s.takes} min · {money(s.costs)}</p>
    </li>
  ))}
</ol>
<style>
  .ledger { margin: 0; padding: 0; list-style: none; border-block-start: 1px solid var(--line); }
  .ledger__row { display: grid; gap: 0.5rem 2rem; grid-template-columns: 1fr auto; align-items: baseline;
    padding: clamp(1rem, 2.5vw, 1.5rem) clamp(0.75rem, 2vw, 1.25rem); border-block-end: 1px solid var(--line); }
  .ledger__row h3 { margin: 0; }
  .ledger__row p { margin: 0.25rem 0 0; color: var(--ink-quiet); }
  .ledger__price { font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
```

### overlap

```astro
<section class="overlap">
  <Shot name="chair" alt="…" class="overlap__picture" />
  <div class="overlap__card"><h2>…</h2><p>…</p></div>
</section>
<style>
  .overlap { display: grid; }
  @media (min-width: 62rem) {
    .overlap { grid-template-columns: repeat(12, 1fr); align-items: end; }
    .overlap :global(.overlap__picture) { grid-column: 1 / 9; grid-row: 1; }
    .overlap__card { grid-column: 7 / 13; grid-row: 1; margin-block-end: -4rem; }
  }
  .overlap__card { position: relative; padding: clamp(1.5rem, 4vw, 3rem); background: var(--panel); border-radius: var(--r-3, 1rem); }
</style>
```

### people

```astro
<ul class="people">
  {team.map((m) => (
    <li class="people__card">
      {m.photo ? <Shot name={m.photo} alt={m.name} ratio="4 / 5" /> : <span class="people__mono" aria-hidden="true">{m.name.slice(0, 1)}</span>}
      <h3>{m.name}</h3><p>{m.line}</p>
    </li>
  ))}
</ul>
<style>
  .people { display: grid; grid-auto-flow: column; grid-auto-columns: min(16rem, 70vw); gap: 1rem;
    overflow-x: auto; scroll-snap-type: x mandatory; margin: 0; padding: 0 0 0.5rem; list-style: none; }
  .people__card { scroll-snap-align: start; padding: 0.75rem 0.75rem 1.25rem; background: var(--panel); border-radius: var(--r-3, 1rem); }
  .people__mono { display: grid; place-items: center; aspect-ratio: 4 / 5; border-radius: var(--r-2, 0.75rem);
    background: color-mix(in srgb, var(--accent) 22%, var(--panel)); font-size: 4rem; }
</style>
```

The rest — `statement`, `numbers`, `tiles`, `steps`, `quote`, `sticky`,
`closing` — are drawn in the showroom with their markup a view-source away.
They are simple on purpose: the composition is the decision, the CSS is twenty
lines.
