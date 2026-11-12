// `@jtakeit/kit/live`: the door is the request's while a request with a draft
// renders, and the build's at every other moment (jtakeit-core wiki/89 §12).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draft, fromBucket, inDraft, live, rendering, sizeOf } from '../lib/live.mjs';

const doorOf = (files) => ({ title: () => files['/jtk/pages/index.json']?.title ?? '', files });
const built = doorOf({ '/jtk/pages/index.json': { title: 'built' } });

test('without a draft, the door is the build\'s and nothing is made', async () => {
  const site = live(built, doorOf);
  assert.equal(site.title(), 'built');
  assert.equal(draft(), undefined);
  assert.equal(inDraft('x', () => 1), undefined);
  assert.equal(fromBucket('media/a/b.jpg'), undefined);
  const answer = await rendering({}, async () => new Response('as it was'));
  assert.equal(await answer.text(), 'as it was');
});

test('a request with a draft renders from it, the whole body inside it, and the next one from its own', async () => {
  const site = live(built, doorOf);
  let made = 0;
  const page = async (title) =>
    rendering({ jtkDraft: { files: { '/jtk/pages/index.json': { title }, '/jtk/site.json': { media_base: 'https://media.example' } }, media: { 'media/s/p.jpg': { width: 40, height: 30 } } } }, async () => {
      // A body streamed in pieces: the last piece still reads the draft.
      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(new TextEncoder().encode(`${site.title()}|`));
          await new Promise((r) => setTimeout(r, 5));
          controller.enqueue(new TextEncoder().encode(`${site.title()}|${inDraft('copy', () => ++made)}|${inDraft('copy', () => ++made)}|${fromBucket('media/s/p.jpg')}|${sizeOf('media/s/p.jpg')?.width}`));
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { 'x-said': 'kept' } });
    });
  const [one, two] = await Promise.all([page('first'), page('second')]);
  assert.equal(await one.text(), `first|first|1|1|https://media.example/media/s/p.jpg|40`);
  assert.equal(await two.text(), `second|second|2|2|https://media.example/media/s/p.jpg|40`);
  assert.equal(one.headers.get('x-said'), 'kept');
  assert.equal(site.title(), 'built');
});
