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
 */

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
  const { action, copy, asks = [], paths = {}, tag = 'jtk-lead' } = props;
  if (typeof action !== 'string' || action === '') throw new TypeError('renderLeadForm: action is where /api/lead is from this page');
  if (!copy || typeof copy !== 'object') throw new TypeError('renderLeadForm: copy is the form\'s words');

  const form = `<form class="lead" method="post" action="${esc(action)}" novalidate data-lead-form${attr('data-success', copy.success)}${attr('data-error', copy.error)}${attr('data-sending', copy.sending)}>
  <div class="lead__head">
    ${copy.title ? `<h2 class="lead__title"${at(paths.title)}>${esc(copy.title)}</h2>` : ''}
    ${copy.lead ? `<p class="lead__lead"${at(paths.lead)}>${esc(copy.lead)}</p>` : ''}
  </div>

  <div class="field">
    <label class="field__label" for="lead-name">${copy.name ? `<span${at(paths.name_label)}>${esc(copy.name)}</span>` : ''} <span aria-hidden="true">*</span></label>
    <input class="field__input" id="lead-name" name="name" type="text" autocomplete="name" required maxlength="120"${attr('data-message', copy.invalidName)}>
    <p class="field__error" data-error-for="name" hidden></p>
  </div>

  <div class="field">
    <label class="field__label" for="lead-contact">${copy.contact ? `<span${at(paths.contact_label)}>${esc(copy.contact)}</span>` : ''} <span aria-hidden="true">*</span></label>
    <input class="field__input" id="lead-contact" name="contact" type="text" inputmode="tel" autocomplete="tel" required maxlength="120"${attr('data-message', copy.invalidContact)}>
    <p class="field__error" data-error-for="contact" hidden></p>
  </div>

  <div class="field">
    <label class="field__label" for="lead-message">${copy.message ? `<span${at(paths.message_label)}>${esc(copy.message)}</span>` : ''}</label>
    <textarea class="field__input field__input--area" id="lead-message" name="message" rows="4" maxlength="2000"></textarea>
  </div>

  ${asks.map((ask) => `<div class="field">
    <label class="field__label" for="lead-${esc(ask.key)}"${ask.path ? at(ask.path) : ' data-jtk-fixed'}>${esc(ask.label)}${ask.required ? ' <span aria-hidden="true">*</span>' : ''}</label>
    ${askControl(ask)}
  </div>`).join('\n  ')}

  <div class="trap" aria-hidden="true" data-jtk-fixed>
    <label for="lead-website">Website</label>
    <input id="lead-website" name="website" type="text" tabindex="-1" autocomplete="off">
  </div>

  ${copy.requiredNote ? `<p class="lead__legal"${at(paths.required_note)}>${esc(copy.requiredNote)}</p>` : ''}

  <div class="lead__foot">
    <button class="btn" type="submit" data-submit>${copy.submit ? `<span data-submit-label${at(paths.cta_label)}>${esc(copy.submit)}</span>` : ''}</button>
    <p class="lead__status" role="status" data-status></p>
  </div>
</form>`;

  return tag ? `<${tag}>${form}</${tag}>` : form;
}
