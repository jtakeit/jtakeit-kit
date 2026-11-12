# The lead form

One form, one endpoint: `/api/lead`, which the platform serves beside the site on
every host it answers on, and under the preview at `/p/<slug>/api/lead`. Where an
enquiry goes — a Telegram chat, an address, the panel's inbox — is the owner's
setting in the panel, never the repository's; what the form collects is the
site's, declared in the schema (`collects: enquiry`, and the block's `asks`).

Template: `src/components/LeadForm.astro` — a wrapper over
[`@jtakeit/kit`](https://github.com/jtakeit/jtakeit-kit/tree/main/kit): the markup
from `renderLeadForm`, the in-place submission from the `<jtk-lead>` element,
the legible minimum from `@jtakeit/kit/lead.css`. The component reads the
block's words and the schema's `asks` and says where `/api/lead` is from
the page; a site on another generator calls the same two pieces without
Astro. Restyle the markup; keep the control names, the honeypot and the
`data-*` hooks.

## Every word on it is the owner's

On contract 3 every word a visitor reads on the form is content, like any other
text on the page: the owner taps it, changes it, and translates it. They are
the collecting block's own fields —

| on the form | the block's field |
| --- | --- |
| the heading, the line under it | `title`, `lead` |
| over the name, the contact, the message | `name_label`, `contact_label`, `message_label` |
| the button | `cta_label` |
| over a question in `asks` | `<key>_label` — the scaffold's `topic` has `topic_label` |
| the line under the form | `required_note` |

— on the home page in the site's language (`jtk/pages/index.json`) and in each
other language's translation beside it (`jtk/pages/index.en.json`).
`jtk create` writes them in the kit's words for every language the site has;
`npx @jtakeit/astro copy <locale>` writes them for a language added later, and
`jtk upgrade contract-3` for a site that moves — each only where nobody has
written them, and into a translation only where the original says the kit's
words: a label the owner wrote their own way is theirs to translate. Until it
is, the page shows it in the original's words, marked with the original's
`lang`.

An ask's `label` in the declaration is what the owner's inbox, the
notification and the export name the answer by. The form draws it only for a
question whose block declares no `<key>_label` — fixed, as declared — and as
the stand-in, at the field's path, where the block leaves its words empty. So a
new question is two lines in `blocks.ts`: the ask, and its words.

```ts
asks: [{ key: 'guests', label: 'Personen', kind: 'number', min: 1, max: 12 }],
fields: [
  // …
  { key: 'guests_label', label: 'Label for the “guests” field', kind: 'text', max: 120, client_editable: true },
],
```

The options of a `select` question stay the declaration's (`options: [{ value,
label }]`, a label written per language where the site has several): the value
is what the inbox and the export keep, and an option the owner could add or
remove in the panel would be one the form sends and the declaration refuses.

Contract 2's form is as it was: its questions are drawn under the
declaration's label, fixed.

Which band draws the form is the block's `form` switch: a block whose
switch is on, and, where none is, the form's own block — the `cta_banner`
whose fields are its words — unless its switch says `false`. A switch
nobody wrote leaves the form where the scaffold put it, so the form's words
are on the page in every language whenever they are in the content: the
platform builds new code with every optional field taken out of the
originals and each translation as it is, and a form gone with its switch
left English's words drawn nowhere on `/en` (`JTK_E_UNANNOTATED_FIELD`).
To show that block as a button without the form, say `form: false`.

## The band it sits in

The form is a component; the band around it is a layout decision, and it is the
one that goes wrong on a wide screen. A 600px form centred in a 1920px band with
two thirds of the screen empty on either side is the commonest way a finished
page still looks unfinished — and it happens to the block the whole page exists
to deliver somebody to.

Either give the form something to stand beside — the contact details, the
opening line, a photograph of the room, the questions block — or let it use the
width: labels beside fields, name and contact on one row. `jt-check` fails a form
band that uses less than 45% of a 1920px screen.

## Shape

```
src/components/LeadForm.astro   <form method="post" action={under('/api/lead')}>
```

The platform's edge answers `/api/lead` on every host the site is served from,
and under the preview at `/p/<slug>/api/lead`. That is why the action goes
through `under()` like every other address the build writes — root-absolute, it
leaves the preview and lands in a 404 that reads as the form being broken.
Locally, under `astro dev`, there is nothing behind it and the form answers 404:
that is expected.

## The form is a form first

```html
<form method="post" action={under('/api/lead')} novalidate data-form>
```

A real POST target, so with JavaScript off the browser submits and the function
answers with a small self-contained HTML page. The script only spares a working
browser the navigation. `novalidate` because the messages are ours, in the
client's language, not the browser's in the browser's.

Fields: as few as the business actually needs. Name plus one contact channel is
usually the whole form. Every extra field costs conversions, and a field the
client never reads costs them for nothing.

## The contract with the platform

The form is the site's, and the platform does not know its field names. What
it holds the form to is the **structure** every enquiry has, and it checks it
twice — at build, on the page, and at the edge, on every post:

| control | what it is | if it is missing |
| --- | --- | --- |
| `name` | who is writing | the edge answers `400 {"error":"anonymous"}` |
| `contact`, or `phone` / `email` | a way back: a number or an address, told apart by the `@` | `400 {"error":"unreachable"}` |
| `message` | what they said; may be empty | — |
| `website` | the honeypot; a filled one is answered as sent and dropped | every bot gets through |

Every other control is the site's own question — a wished date, a service, a
number of guests — and is **declared in `asks`** on the block that carries
`collects: 'enquiry'` in `src/content/blocks.ts`, as an ordinary field with a
label and a kind. `LeadForm.astro` renders them from that declaration, and the
same declaration is what lets the owner's inbox, the Telegram message, the
email and the CSV say "Wished date" rather than `field_3`. The edge keeps
every extra by its control's name (twenty fields, two kilobytes each), and a
build for the site's own address refuses a form with a control nobody declared
(`JTK_E_FORM_FIELD_UNDECLARED`), a form missing one of the four above
(`JTK_E_FORM_INCOMPLETE`), or a form on a page where no block says it
collects (`JTK_E_FORM_UNDECLARED`). A preview build warns instead.

The other refusals the endpoint names are `too_long` (the name over 120, the
message over 2000, or the extras over the cap), `too_many` (the rate counter)
and `not_delivered` (kept, and not yet delivered — the site says to ring).
The scripted path reads the code from the JSON answer; the unscripted path
gets it back as `?enquiry=<code>` on the page it came from.

A honeypot, always: a labelled input that is off-screen and out of the
accessibility tree — `aria-hidden`, `tabindex="-1"`, not `display: none`, which
some bots detect. A filled honeypot is answered with the same success a human
gets. Telling a bot it was caught only teaches it to try again differently.

## Photographs with the enquiry

A form may let the visitor attach up to seven pictures — an order form for a
website, a quote from photographs of the job. Say so on the block that
collects, in `blocks.ts`:

```ts
{ type: 'cta_banner', collects: 'enquiry', photos: 7, /* … */ }
```

That is the whole of it on the site's side. `LeadForm` passes `photos` to
`renderLeadForm`, which draws a file picker with its words in the page's
language (`photoWords`, eight languages, or the site's own as
`copy.photosLabel` and the rest), and `<jtk-lead>` checks each picture for
type and size, shows small previews with a way to take one out, uploads them
one by one to `/api/upload` when the form is sent, and puts the tokens in the
enquiry. The privacy page adds its sentence about them by itself.

The platform holds the rest, and none of it is the site's to change: it takes
uploads only for a site whose schema declares `photos`, never more than
declared on one enquiry; it decodes and writes every picture again, so the
location a phone wrote into it is gone; keeps it privately in the EU; shows it
only to the people who may read the enquiry; and deletes it with the enquiry.
The picker has no `name`: without JavaScript the form posts what it always did,
without the pictures.

Ask for photographs only when the business needs them, and never for health
or other sensitive pictures — the platform's terms forbid it.

## Autofill repaints the fields

Chrome and Safari draw a filled field with their own background and their own
text colour. On a white form nobody notices; on a dark or tinted one the form
turns white and yellow the moment the browser helps, and it happens on the one
visit that matters — the one where the visitor's details are already saved.

There is no property that switches it off. `background` is ignored, `color` is
ignored; the background has to be painted over with a large inset shadow and the
text set through `-webkit-text-fill-color`. The base rule ships in
`src/styles/global.css` and is keyed to `--paper-deep` and `--ink`. A variant
that gives its inputs some other surface overrides those two properties rather
than deleting the rule.

Check it the way it breaks: fill the form once, submit, reload, then let the
browser autofill it. Do not check it by looking at an empty form.

## Before the stage ends

Submit the form on the deployed site and watch the message arrive. Not the local
build, not a `curl`. The full path — browser, function, secret, bot, chat —
tested once, by a person.
