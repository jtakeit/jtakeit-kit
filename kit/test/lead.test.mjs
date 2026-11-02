// The enquiry form, as the kit renders it and as its element reads it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderLeadForm, inputType } from '../lib/lead/render.mjs';
import { wireLead, wireAll, defineLead, JtkLead } from '../elements/lead.js';

const copy = {
  title: 'Write to us', lead: 'We answer the same day.',
  name: 'Your name', contact: 'Phone or email', message: 'Message',
  requiredNote: '* required', submit: 'Send', sending: 'Sending…', success: 'Sent.', error: 'Not sent.',
  invalidName: 'Tell us your name.', invalidContact: 'How do we reach you?',
};
const paths = { title: 'blocks[3].title', lead: 'blocks[3].lead', name_label: 'blocks[3].name_label', contact_label: 'blocks[3].contact_label', message_label: 'blocks[3].message_label', required_note: 'blocks[3].required_note', cta_label: 'blocks[3].cta_label' };

test('the form is what the lint holds an enquiry form to: name, contact, the honeypot, and only the declared asks', () => {
  const html = renderLeadForm({ action: '/p/salon/api/lead', copy, paths });
  assert.match(html, /^<jtk-lead><form class="lead" method="post" action="\/p\/salon\/api\/lead" novalidate data-lead-form /);
  assert.ok(html.includes('name="name" type="text" autocomplete="name" required maxlength="120" data-message="Tell us your name."'));
  assert.ok(html.includes('name="contact" type="text" inputmode="tel" autocomplete="tel" required maxlength="120" data-message="How do we reach you?"'));
  assert.ok(html.includes('<div class="trap" aria-hidden="true" data-jtk-fixed>'));
  assert.ok(html.includes('name="website" type="text" tabindex="-1" autocomplete="off"'));
  assert.ok(html.includes('data-success="Sent." data-error="Not sent." data-sending="Sending…"'));
  // The block's own fields carry their paths; the owner edits them by tapping.
  assert.ok(html.includes('<h2 class="lead__title" data-jtk-path="blocks[3].title">Write to us</h2>'));
  assert.ok(html.includes('<span data-jtk-path="blocks[3].name_label">Your name</span>'));
  assert.ok(html.includes('<span data-submit-label data-jtk-path="blocks[3].cta_label">Send</span>'));
  assert.ok(html.includes('<p class="lead__legal" data-jtk-path="blocks[3].required_note">* required</p>'));
});

test('a build without annotations carries no path, and an empty word no element', () => {
  const html = renderLeadForm({ action: '/api/lead', copy: { ...copy, lead: '', requiredNote: undefined } });
  assert.ok(!html.includes('data-jtk-path'));
  assert.ok(!html.includes('lead__lead'));
  assert.ok(!html.includes('lead__legal'));
});

test('the asks from the catalogue are drawn by kind, fixed, and nothing else is asked', () => {
  const asks = [
    { key: 'topic', label: 'What it is about', kind: 'text', max: 120 },
    { key: 'wished', label: 'A day that suits', kind: 'date', required: true },
    { key: 'guests', label: 'How many', kind: 'number', min: 1, max: 12 },
    { key: 'service', label: 'Service', kind: 'select', options: [{ value: 'cut', label: 'Haircut' }, { value: 'colour', label: '' }] },
    { key: 'details', label: 'Details', kind: 'textarea', max: 500 },
    { key: 'callback', label: 'Call me back', kind: 'bool' },
    { key: 'at', label: 'Time', kind: 'time_of_day' },
  ];
  const html = renderLeadForm({ action: '/api/lead', copy, asks });
  assert.ok(html.includes('<label class="field__label" for="lead-topic" data-jtk-fixed>What it is about</label>'));
  assert.ok(html.includes('<input class="field__input" id="lead-topic" name="topic" type="text" maxlength="120">'));
  assert.ok(html.includes('<label class="field__label" for="lead-wished" data-jtk-fixed>A day that suits <span aria-hidden="true">*</span></label>'));
  assert.ok(html.includes('id="lead-wished" name="wished" type="date" required>'));
  assert.ok(html.includes('id="lead-guests" name="guests" type="number" min="1" max="12">'));
  assert.ok(html.includes('<option value="cut" data-jtk-fixed>Haircut</option>'));
  assert.ok(html.includes('<option value="colour" data-jtk-fixed>colour</option>'), 'an option without a label is its value');
  assert.ok(html.includes('<textarea class="field__input field__input--area" id="lead-details" name="details" rows="3" maxlength="500"></textarea>'));
  assert.ok(html.includes('id="lead-callback" name="callback" type="checkbox" value="yes">'));
  assert.ok(html.includes('id="lead-at" name="at" type="time">'));
  assert.equal(inputType('url'), 'url');
  assert.equal(inputType('richtext_lite'), 'text');
});

test('words are escaped, the wrapper may be left off, and a form with nowhere to post is refused', () => {
  const html = renderLeadForm({ action: '/api/lead', copy: { ...copy, title: 'A <b>bold</b> "title"' }, tag: '' });
  assert.ok(html.startsWith('<form class="lead"'));
  assert.ok(html.includes('A &lt;b&gt;bold&lt;/b&gt; &quot;title&quot;'));
  assert.throws(() => renderLeadForm({ copy }), TypeError);
  assert.throws(() => renderLeadForm({ action: '/api/lead' }), TypeError);
});

test('the module loads where there is no document, and exports the element for one', () => {
  assert.equal(typeof wireLead, 'function');
  assert.equal(typeof wireAll, 'function');
  assert.equal(typeof JtkLead, 'function');
  assert.doesNotThrow(() => defineLead());
});

test('a form that takes photos draws a picker with no name, its words in the page\'s language, and nothing for a form that takes none', async () => {
  const { photoWords, PHOTOS_MAX } = await import('../lib/lead/render.mjs');
  const html = renderLeadForm({ action: '/api/lead', copy, photos: 7, lang: 'de-CH' });
  assert.ok(html.includes('<div class="field field--photos" data-photos="7" data-jtk-fixed'));
  assert.ok(html.includes('type="file" accept="image/jpeg,image/png,image/webp" multiple data-photos-input'));
  assert.ok(!/type="file"[^>]*\sname=/.test(html), 'a named file control would post the bytes to /api/lead without JavaScript');
  assert.ok(html.includes('Fotos (bis zu 7)'));
  assert.ok(html.includes('data-too-many="Höchstens 7 Fotos."'));

  const own = renderLeadForm({ action: '/api/lead', copy: { ...copy, photosLabel: 'Your salon, in up to {n} pictures' }, photos: 3 });
  assert.ok(own.includes('Your salon, in up to 3 pictures'), "the site's own words win");

  assert.ok(!renderLeadForm({ action: '/api/lead', copy }).includes('data-photos'));
  assert.throws(() => renderLeadForm({ action: '/api/lead', copy, photos: 8 }), TypeError);
  assert.equal(PHOTOS_MAX, 7);
  assert.equal(photoWords('pt-PT').remove, 'Remover');
  assert.equal(photoWords('xx').label, 'Photos (up to {n})');
});
