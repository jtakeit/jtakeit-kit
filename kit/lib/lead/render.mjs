/**
 * The enquiry form, as markup — made at build time by whatever builds the
 * site, and spared the navigation by `@jtakeit/kit/elements/lead`.
 *
 * It is a real `<form method="post">` first and an in-place submission
 * second: with JavaScript off the browser posts to the same endpoint and the
 * platform answers with a plain page. Every rule enforced on the page is
 * enforced again by the platform behind `/api/lead` — the endpoint is public
 * and the browser's checks are a convenience, not a gate.
 *
 * What the platform holds the form to (the build's lint, JTK_E_FORM_*): a
 * `name` control, one of `contact`, `phone` or `email`, the honeypot
 * `website`, and nothing else that the collecting block does not declare in
 * `asks`. The words on it are the site's: the block's own fields (title,
 * lead, the labels), annotated with their paths so the owner edits them by
 * tapping, and the `asks` from the catalogue, fixed.
 */

/**
 * @typedef {object} Ask
 * @property {string} key                        the control's name — and the key the inbox labels by
 * @property {string} label                      in the site's language, already resolved
 * @property {string} kind                       text, textarea, number, tel, email, url, date, time_of_day, select, bool
 * @property {boolean} [required]
 * @property {number} [max]
 * @property {number} [min]
 * @property {{ value: string; label: string }[]} [options]  for a select
 * @property {string} [lang]                     the label's language where it is not the page's — words the declaration wrote once, in the site's own
 */

/**
 * @typedef {object} LeadCopy
 * @property {string} [title]
 * @property {string} [lead]
 * @property {string} [name]         the name field's label
 * @property {string} [contact]      the contact field's label
 * @property {string} [message]      the message field's label
 * @property {string} [requiredNote]
 * @property {string} [submit]
 * @property {string} [sending]
 * @property {string} [success]
 * @property {string} [error]
 * @property {string} [invalidName]
 * @property {string} [invalidContact]
 */

/**
 * @typedef {object} LeadPaths
 * The `data-jtk-path` of each of the block's fields the form renders, or
 * nothing for a build without annotations. Keys: title, lead, name_label,
 * contact_label, message_label, required_note, cta_label.
 * @property {string} [title]
 * @property {string} [lead]
 * @property {string} [name_label]
 * @property {string} [contact_label]
 * @property {string} [message_label]
 * @property {string} [required_note]
 * @property {string} [cta_label]
 */

/**
 * @typedef {object} LeadFormProps
 * @property {string} action       where `/api/lead` is from this page — under the preview the site is served at `/p/<slug>/`
 * @property {LeadCopy} copy
 * @property {Ask[]} [asks]
 * @property {LeadPaths} [paths]
 * @property {string} [tag]        the element's name around the form, `jtk-lead`; `''` for none
 * @property {number} [photos]     how many photographs the form takes, 1 to 7 — what the collecting block declares as `photos`; absent is none
 * @property {string} [lang]       the page's language, for the photo control's words when `copy` does not carry them, and the labels and the button where it leaves them empty
 * @property {string} [wordsLang]  the language of `copy`'s messages where it is not the page's — the site's own, for a language the site has no copy of: the status line and the field errors, which say only them, carry it
 */

import { PHOTOS_MAX, PHOTO_TYPES, photoWords } from './photos.mjs';

export { photoWords, PHOTOS_MAX } from './photos.mjs';

/**
 * The form's own labels and its button, in the kit's eight languages: what a
 * control says while the collecting block's own words (`name_label`,
 * `contact_label`, `message_label`, `cta_label`) are empty — a fresh
 * scaffold's are, and the form went out with three bare asterisks and a
 * button with nothing on it (the contract-3 rehearsal, 11 November 2026). A
 * control with no name is one a screen reader cannot say (WCAG 4.1.2).
 *
 * The owner's words replace them: where the page annotates the field, the
 * stand-in carries its path, so a tap on it opens the field it stands for.
 *
 * @typedef {{ name: string; contact: string; message: string; submit: string }} LeadWords
 * @type {Record<string, LeadWords>}
 */
export const LEAD_WORDS = {
  en: { name: 'Name', contact: 'Phone or email', message: 'Message', submit: 'Send' },
  de: { name: 'Name', contact: 'Telefon oder E-Mail', message: 'Nachricht', submit: 'Senden' },
  fr: { name: 'Nom', contact: 'Téléphone ou e-mail', message: 'Message', submit: 'Envoyer' },
  it: { name: 'Nome', contact: 'Telefono o email', message: 'Messaggio', submit: 'Invia' },
  es: { name: 'Nombre', contact: 'Teléfono o correo electrónico', message: 'Mensaje', submit: 'Enviar' },
  pt: { name: 'Nome', contact: 'Telefone ou e-mail', message: 'Mensagem', submit: 'Enviar' },
  uk: { name: 'Імʼя', contact: 'Телефон або пошта', message: 'Повідомлення', submit: 'Надіслати' },
  ru: { name: 'Имя', contact: 'Телефон или почта', message: 'Сообщение', submit: 'Отправить' },
};

/**
 * The words for a language — `de-CH` reads `de`, an unknown one English.
 * @param {string} [lang]
 * @returns {LeadWords}
 */
export function leadWords(lang = 'en') {
  const base = String(lang).toLowerCase().split(/[-_]/)[0] ?? 'en';
  return LEAD_WORDS[base] ?? LEAD_WORDS.en;
}

const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** @param {unknown} value */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPE[c]);
}
/** @param {string} name @param {unknown} value */
function attr(name, value) {
  return value === undefined || value === null || value === '' || value === false ? '' : value === true ? ` ${name}` : ` ${name}="${esc(value)}"`;
}
/** A `data-jtk-path`, or nothing. @param {string | undefined} path */
const at = (path) => attr('data-jtk-path', path);

/** The `<input type>` a visitor types this kind into. @param {string} kind */
export function inputType(kind) {
  switch (kind) {
    case 'number': return 'number';
    case 'tel': return 'tel';
    case 'email': return 'email';
    case 'url': return 'url';
    case 'date': return 'date';
    case 'time_of_day': return 'time';
    default: return 'text';
  }
}

/** @param {Ask} ask */
function askControl(ask) {
  const id = `lead-${ask.key}`;
  if (ask.kind === 'textarea') {
    return `<textarea class="field__input field__input--area" id="${esc(id)}" name="${esc(ask.key)}" rows="3"${attr('required', ask.required)}${attr('maxlength', ask.max)}></textarea>`;
  }
  if (ask.kind === 'select') {
    return `<select class="field__input" id="${esc(id)}" name="${esc(ask.key)}"${attr('required', ask.required)}>
        <option value=""></option>
        ${(ask.options ?? []).map((o) => `<option value="${esc(o.value)}" data-jtk-fixed>${esc(o.label || o.value)}</option>`).join('\n')}
      </select>`;
  }
  if (ask.kind === 'bool') {
    return `<input class="field__check" id="${esc(id)}" name="${esc(ask.key)}" type="checkbox" value="yes">`;
  }
  const number = ask.kind === 'number';
  return `<input class="field__input" id="${esc(id)}" name="${esc(ask.key)}" type="${inputType(ask.kind)}"${attr('required', ask.required)}${attr('maxlength', number ? undefined : ask.max)}${attr('min', number ? ask.min : undefined)}${attr('max', number ? ask.max : undefined)}>`;
}

/**
 * The enquiry form as HTML.
 *
 * @param {LeadFormProps} props
 * @returns {string}
 */
export function renderLeadForm(props) {
  const { action, copy, asks = [], paths = {}, tag = 'jtk-lead', photos = 0, lang = 'en', wordsLang = '' } = props;
  // The messages' language, on what says only them, where it is not the page's.
  const said_in = wordsLang ? ` lang="${esc(wordsLang)}"` : '';
  if (typeof action !== 'string' || action === '') throw new TypeError('renderLeadForm: action is where /api/lead is from this page');
  if (!copy || typeof copy !== 'object') throw new TypeError('renderLeadForm: copy is the form\'s words');
  if (!Number.isInteger(photos) || photos < 0 || photos > PHOTOS_MAX) {
    throw new TypeError(`renderLeadForm: photos is how many the form takes, 0 to ${PHOTOS_MAX}`);
  }

  // A label the block leaves empty says the kit's word, tappable where the page annotates the field, fixed where it does not.
  const words = leadWords(lang);
  const said = (/** @type {string | undefined} */ own, /** @type {string | undefined} */ path, /** @type {string} */ fallback, extra = '') =>
    own ? `<span${extra}${at(path)}>${esc(own)}</span>` : `<span${extra}${path ? at(path) : ' data-jtk-fixed'}>${esc(fallback)}</span>`;

  const form = `<form class="lead" method="post" action="${esc(action)}" novalidate data-lead-form${attr('data-success', copy.success)}${attr('data-error', copy.error)}${attr('data-sending', copy.sending)}>
  <div class="lead__head">
    ${copy.title ? `<h2 class="lead__title"${at(paths.title)}>${esc(copy.title)}</h2>` : ''}
    ${copy.lead ? `<p class="lead__lead"${at(paths.lead)}>${esc(copy.lead)}</p>` : ''}
  </div>

  <div class="field">
    <label class="field__label" for="lead-name">${said(copy.name, paths.name_label, words.name)} <span aria-hidden="true">*</span></label>
    <input class="field__input" id="lead-name" name="name" type="text" autocomplete="name" required maxlength="120"${attr('data-message', copy.invalidName)}>
    <p class="field__error" data-error-for="name"${said_in} hidden></p>
  </div>

  <div class="field">
    <label class="field__label" for="lead-contact">${said(copy.contact, paths.contact_label, words.contact)} <span aria-hidden="true">*</span></label>
    <input class="field__input" id="lead-contact" name="contact" type="text" inputmode="tel" autocomplete="tel" required maxlength="120"${attr('data-message', copy.invalidContact)}>
    <p class="field__error" data-error-for="contact"${said_in} hidden></p>
  </div>

  <div class="field">
    <label class="field__label" for="lead-message">${said(copy.message, paths.message_label, words.message)}</label>
    <textarea class="field__input field__input--area" id="lead-message" name="message" rows="4" maxlength="2000"></textarea>
  </div>

  ${asks.map((ask) => `<div class="field">
    <label class="field__label" for="lead-${esc(ask.key)}"${ask.path ? at(ask.path) : ' data-jtk-fixed'}${ask.lang ? ` lang="${esc(ask.lang)}"` : ''}>${esc(ask.label)}${ask.required ? ' <span aria-hidden="true">*</span>' : ''}</label>
    ${askControl(ask)}
  </div>`).join('\n  ')}

${photos > 0 ? photoControl(photos, copy, lang) : ''}

  <div class="trap" aria-hidden="true" data-jtk-fixed>
    <label for="lead-website">Website</label>
    <input id="lead-website" name="website" type="text" tabindex="-1" autocomplete="off">
  </div>

  ${copy.requiredNote ? `<p class="lead__legal"${at(paths.required_note)}>${esc(copy.requiredNote)}</p>` : ''}

  <div class="lead__foot">
    <button class="btn" type="submit" data-submit>${said(copy.submit, paths.cta_label, words.submit, ' data-submit-label')}</button>
    <p class="lead__status" role="status" data-status${said_in}></p>
  </div>
</form>`;

  return tag ? `<${tag}>${form}</${tag}>` : form;
}

/**
 * The photo control (wiki/87 on the platform): a file picker with no `name`,
 * so a form posted without JavaScript sends what it always did, and the
 * element uploads each picture to `/api/upload` and puts the tokens in the
 * enquiry. Its words are fixed — the kit's, in the page's language, unless
 * the site's copy carries its own.
 *
 * @param {number} n @param {LeadCopy & Record<string, string | undefined>} copy @param {string} lang
 */
function photoControl(n, copy, lang) {
  const w = photoWords(lang);
  const say = (/** @type {string} */ own, /** @type {string} */ fallback) => (copy[own] ?? fallback).replaceAll('{n}', String(n));
  return `<div class="field field--photos" data-photos="${n}" data-jtk-fixed${attr('data-too-many', say('photosTooMany', w.tooMany))}${attr('data-too-large', say('photosTooLarge', w.tooLarge))}${attr('data-not-picture', say('photosNotPicture', w.notPicture))}${attr('data-failed', say('photosFailed', w.failed))}${attr('data-remove', say('photosRemove', w.remove))}>
    <label class="field__label" for="lead-photos">${esc(say('photosLabel', w.label))}</label>
    <input class="field__input field__input--file" id="lead-photos" type="file" accept="${PHOTO_TYPES.join(',')}" multiple data-photos-input aria-describedby="lead-photos-note">
    <p class="field__hint" id="lead-photos-note">${esc(say('photosNote', w.note))}</p>
    <ul class="lead__photos" data-photos-list></ul>
    <p class="field__error" data-error-for="photos" hidden></p>
  </div>`;
}
