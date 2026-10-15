# The lead form

One form, one endpoint: `/api/lead`, which the platform serves beside the site on
every host it answers on, and under the preview at `/p/<slug>/api/lead`. Where an
enquiry goes — a Telegram chat, an address, the panel's inbox — is the owner's
setting in the panel, never the repository's; what the form collects is the
site's, declared in the catalogue (`collects: enquiry`, and the block's `asks`).

Template: `src/components/LeadForm.astro` — a wrapper over
[`@jtakeit/kit`](https://github.com/jtakeit/jtakeit-kit/tree/main/kit): the markup
from `renderLeadForm`, the in-place submission from the `<jtk-lead>` element,
the legible minimum from `@jtakeit/kit/lead.css`. The component reads the
block's words and the catalogue's `asks` and says where `/api/lead` is from
the page; a site on another generator calls the same two pieces without
Astro. Restyle the markup; keep the control names, the honeypot and the
`data-*` hooks.

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
