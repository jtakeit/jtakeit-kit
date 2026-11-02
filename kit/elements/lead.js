/**
 * `<jtk-lead>` — the enquiry form, spared the navigation.
 *
 * Progressive enhancement only. Every branch here has a working no-JS
 * equivalent: without this module the browser posts the form and the
 * platform answers with a page. What this adds is the answer in place — the
 * sentence the form carries in `data-success` or `data-error`, and the
 * platform's two refusals by name put beside the field they are about.
 *
 * Import once on the page and every `<form data-lead-form>` is wired: the
 * ones inside a `<jtk-lead>` by the element's lifecycle, which also covers
 * markup the panel places later (`fl:placed`); the ones written bare by a
 * walk of the document at load.
 */

/** The picture types and size the platform takes (`@jtakeit/kit/lead`'s photos.mjs). */
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_BYTES_MAX = 10 * 1024 * 1024;

/** An upload the platform refused, by the code it named. */
class PhotoRefused extends Error {
  /** @param {string | undefined} code */
  constructor(code) {
    super(code ?? 'failed');
    this.code = code;
  }
}

/**
 * Wires one form. Idempotent: a form already wired is left alone.
 * @param {HTMLFormElement} form
 */
export function wireLead(form) {
  if (form.dataset.jtkWired === '1') return;
  form.dataset.jtkWired = '1';

  /** @type {HTMLElement | null} */ const status = form.querySelector('[data-status]');
  /** @type {HTMLButtonElement | null} */ const button = form.querySelector('[data-submit]');
  /** @type {HTMLElement | null} */ const label = form.querySelector('[data-submit-label]');
  if (!status || !button) return;
  const original = label?.textContent ?? '';

  /*
   * A sentence about a field is said on the field (WCAG 3.3.1): the input is
   * marked invalid and described by the sentence, so a screen reader reads
   * it when the field is reached and not only when it appears. It was drawn
   * under the field and tied to nothing (12 October 2026).
   */
  /** @param {string} field */
  const inputOf = (field) => /** @type {HTMLInputElement | null} */ (form.elements.namedItem(field));

  /** @param {string} field @param {string} message */
  const showError = (field, message) => {
    /** @type {HTMLElement | null} */ const el = form.querySelector(`[data-error-for="${field}"]`);
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
    const input = inputOf(field);
    if (!input || !message) return;
    if (!el.id) el.id = `${form.id || 'lead'}-${field}-error`;
    input.setAttribute('aria-invalid', 'true');
    const described = (input.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    if (!described.includes(el.id)) input.setAttribute('aria-describedby', [...described, el.id].join(' '));
  };

  const clearErrors = () => {
    for (const el of /** @type {NodeListOf<HTMLElement>} */ (form.querySelectorAll('[data-error-for]'))) {
      el.textContent = '';
      el.hidden = true;
      const input = inputOf(el.dataset.errorFor ?? '');
      if (!input) continue;
      input.removeAttribute('aria-invalid');
      const rest = (input.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id && id !== el.id);
      if (rest.length) input.setAttribute('aria-describedby', rest.join(' '));
      else input.removeAttribute('aria-describedby');
    }
  };

  /*
   * The photographs (wiki/87 on the platform), when the form declared any.
   * Chosen here, checked here for what is cheap to check — the platform checks
   * everything again — drawn as small previews with a way to take one out,
   * and uploaded one by one to `/api/upload` when the form is sent; the tokens
   * go into the enquiry as `attachments`.
   */
  /** @type {HTMLElement | null} */ const photosField = form.querySelector('[data-photos]');
  /** @type {HTMLInputElement | null} */ const photoInput = photosField?.querySelector('[data-photos-input]') ?? null;
  /** @type {HTMLElement | null} */ const photoList = photosField?.querySelector('[data-photos-list]') ?? null;
  const photosMax = Number(photosField?.dataset.photos ?? 0);
  /** @type {{ file: File; url: string }[]} */ let chosen = [];

  const drawPhotos = () => {
    if (!photoList) return;
    photoList.replaceChildren(...chosen.map((one, index) => {
      const item = document.createElement('li');
      item.className = 'lead__photo';
      const img = document.createElement('img');
      img.src = one.url;
      img.alt = one.file.name;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'lead__photo-remove';
      remove.textContent = photosField?.dataset.remove ?? '×';
      remove.setAttribute('aria-label', `${photosField?.dataset.remove ?? ''} ${one.file.name}`.trim());
      remove.addEventListener('click', () => {
        URL.revokeObjectURL(one.url);
        chosen = chosen.filter((_, i) => i !== index);
        drawPhotos();
      });
      item.append(img, remove);
      return item;
    }));
  };

  photoInput?.addEventListener('change', () => {
    showError('photos', '');
    for (const file of Array.from(photoInput.files ?? [])) {
      if (!PHOTO_TYPES.includes(file.type)) { showError('photos', photosField?.dataset.notPicture ?? ''); continue; }
      if (file.size > PHOTO_BYTES_MAX) { showError('photos', photosField?.dataset.tooLarge ?? ''); continue; }
      if (chosen.length >= photosMax) { showError('photos', photosField?.dataset.tooMany ?? ''); break; }
      chosen.push({ file, url: URL.createObjectURL(file) });
    }
    // Cleared, so the same picture can be chosen again after it was taken out.
    photoInput.value = '';
    drawPhotos();
  });

  /** @param {string | undefined} code */
  const photoFailure = (code) =>
    code === 'too_large' ? photosField?.dataset.tooLarge
      : code === 'not_a_picture' ? photosField?.dataset.notPicture
        : code === 'too_many' ? photosField?.dataset.tooMany
          : photosField?.dataset.failed;

  /** Each chosen picture to `/api/upload`, in order; its token, or a refusal. */
  const uploadPhotos = async () => {
    const at = form.action.replace(/\/api\/lead(?=$|\?)/, '/api/upload');
    /** @type {string[]} */ const tokens = [];
    for (const one of chosen) {
      const response = await fetch(at, { method: 'POST', headers: { 'content-type': one.file.type }, body: one.file });
      /** @type {{ token?: string; error?: string }} */ let body = {};
      try { body = await response.json(); } catch { /* said as «failed» */ }
      if (!response.ok || !body.token) throw new PhotoRefused(body.error);
      tokens.push(body.token);
    }
    return tokens;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();
    status.textContent = '';
    form.removeAttribute('data-state');

    const data = new FormData(form);
    /** @type {HTMLInputElement | null} */ let first = null;
    for (const field of ['name', 'contact']) {
      const input = inputOf(field);
      if (!input?.value.trim()) {
        showError(field, input?.dataset.message ?? '');
        first ??= input;
      }
    }
    // And the visitor is taken to the first thing to fix (3.3.1).
    if (first) { first.focus(); return; }

    button.disabled = true;
    if (label) label.textContent = form.dataset.sending ?? original;

    try {
      if (chosen.length > 0) {
        for (const token of await uploadPhotos()) data.append('attachments', token);
      }
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: data,
      });
      const body = await response.json();

      if (response.ok && body.ok) {
        form.reset();
        for (const one of chosen) URL.revokeObjectURL(one.url);
        chosen = [];
        drawPhotos();
        status.textContent = form.dataset.success ?? '';
        // Preview only: the destination is not connected, so nothing was
        // delivered. Visible to the studio, meaningless to a visitor. It
        // disappears in production.
        if (body.demo) status.textContent += ' ⚠︎';
      } else if (body.error === 'anonymous' || body.error === 'unreachable') {
        // The platform refuses by name — no name, no way back to the sender —
        // and the sentence for each is the one the field already carries.
        const field = body.error === 'anonymous' ? 'name' : 'contact';
        const input = /** @type {HTMLInputElement | null} */ (form.elements.namedItem(field));
        showError(field, input?.dataset.message ?? '');
        input?.focus();
      } else if (body.error === 'photos') {
        // A photo's token was not taken — late, or used: send them again.
        form.setAttribute('data-state', 'error');
        showError('photos', photosField?.dataset.failed ?? '');
      } else {
        form.setAttribute('data-state', 'error');
        status.textContent = body.message ?? form.dataset.error ?? '';
      }
    } catch (error) {
      if (error instanceof PhotoRefused) {
        form.setAttribute('data-state', 'error');
        showError('photos', photoFailure(error.code) ?? '');
        return;
      }
      form.setAttribute('data-state', 'error');
      status.textContent = form.dataset.error ?? '';
    } finally {
      button.disabled = false;
      if (label) label.textContent = original;
    }
  });
}

/**
 * Wires every enquiry form under a root that is not wired yet.
 * @param {ParentNode} [root]
 */
export function wireAll(root = document) {
  for (const form of /** @type {NodeListOf<HTMLFormElement>} */ (root.querySelectorAll('form[data-lead-form]'))) wireLead(form);
  if (root instanceof HTMLFormElement && root.matches('[data-lead-form]')) wireLead(root);
}

const BaseElement = typeof HTMLElement === 'undefined' ? class {} : HTMLElement;

/** `<jtk-lead>` wraps the form `renderLeadForm` wrote and wires it when it reaches the document. */
export class JtkLead extends BaseElement {
  connectedCallback() {
    wireAll(/** @type {any} */ (this));
  }
}

/** @param {string} [name] */
export function defineLead(name = 'jtk-lead') {
  if (typeof customElements === 'undefined' || customElements.get(name)) return;
  customElements.define(name, JtkLead);
}

if (typeof document !== 'undefined') {
  defineLead();
  const start = () => wireAll(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  document.addEventListener('fl:placed', (event) => {
    const at = event.target;
    if (at instanceof Element) wireAll(at);
  });
}
