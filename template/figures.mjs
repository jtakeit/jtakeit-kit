/**
 * A picture in a post is a figure, and pictures side by side are a row.
 *
 * ── the shape, and why it is not a new syntax ───────────────────────────────
 *
 * Markdown gives a body one shape of picture: `![alt](x.jpg)`, alone, as wide
 * as the stylesheet says. There is no caption and no way to say "these three
 * belong together" — and inventing a syntax for it would make the body a
 * private dialect. A `.md` file in `jtk/content/` is committed, read by
 * people and written by agents, and the one thing it has to stay is markdown.
 *
 * It turns out CommonMark says both things already, and nobody was listening:
 *
 *   ![](one.jpg)             one paragraph, one image   → a figure
 *
 *   ![](one.jpg)             ONE paragraph, three       → a row
 *   ![](two.jpg)
 *   ![](three.jpg)
 *
 * Images on consecutive lines with no blank line between them are a single
 * paragraph. That is plain CommonMark, it renders anywhere, and it is already
 * an honest statement that they belong together — so it is the row, with
 * nothing added. A blank line between them is somebody saying they are
 * separate, and this believes them.
 *
 * The caption is the title slot, which CommonMark has had all along:
 *
 *   ![A healed sleeve](healed.jpg "Three weeks later, unretouched")
 *
 * `alt` stays the description somebody hears; the title becomes the caption
 * somebody reads. Two jobs that already had two slots. Left alone it would
 * render as a tooltip, which is nobody's idea of a caption.
 *
 * ── what comes out ─────────────────────────────────────────────────────────
 *
 *   <figure class="jtk-figure"><img …><figcaption>…</figcaption></figure>
 *
 *   <div class="jtk-row jtk-row--3">
 *     <figure class="jtk-figure"><img …></figure>
 *     …
 *   </div>
 *
 * `jtk-row--2`, `--3`, `--4`; four means four or more and the stylesheet wraps.
 * Those two class names are the whole surface — a site restyles them and does
 * not invent others, which is what keeps "what a body can look like" a decision
 * the kit made once rather than one every site makes again.
 *
 * ── where it sits in the pipeline ──────────────────────────────────────────
 *
 * A user hast plugin runs **before** Astro's image marker, which is what makes
 * this safe: the marker finds `<img>` by tag anywhere in the tree, so wrapping
 * one changes nothing about how it is optimised. It also strips every property
 * off an `<img>` except `className`, which is why the caption has to be taken
 * off the picture here rather than read off the built page later.
 */

/** How many pictures a row names before the stylesheet is left to wrap them. */
const WIDEST = 4;

export function figures() {
  return {
    name: 'jtakeit-figures',
    element: {
      filter: ['p'],
      visit(node, ctx) {
        const pictures = onlyPictures(node);
        if (pictures === null) return;

        const made = pictures.map(figureOf);
        ctx.replaceNode(node, made.length === 1 ? made[0] : rowOf(made));
      },
    },
  };
}

/**
 * The pictures in this paragraph, if that is all it holds.
 *
 * A paragraph with a picture and a sentence is a paragraph with a picture in
 * it, and turning that into a figure would take the sentence out of the text it
 * belongs to. The whitespace is what the newlines left behind, not content.
 */
function onlyPictures(node) {
  const pictures = [];

  for (const child of node.children ?? []) {
    if (child.type === 'text' && String(child.value ?? '').trim() === '') continue;
    if (child.type === 'element' && child.tagName === 'img') {
      pictures.push(child);
      continue;
    }
    return null;
  }

  return pictures.length === 0 ? null : pictures;
}

function figureOf(image) {
  const { title, ...rest } = image.properties ?? {};
  const said = typeof title === 'string' ? title.trim() : '';

  const children = [{ type: 'element', tagName: 'img', properties: rest, children: [] }];
  if (said !== '') {
    children.push({
      type: 'element',
      tagName: 'figcaption',
      properties: {},
      children: [{ type: 'text', value: said }],
    });
  }

  return { type: 'element', tagName: 'figure', properties: { className: ['jtk-figure'] }, children };
}

function rowOf(made) {
  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['jtk-row', `jtk-row--${Math.min(made.length, WIDEST)}`] },
    children: made,
  };
}
