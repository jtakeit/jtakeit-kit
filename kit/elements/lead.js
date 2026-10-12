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
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: data,
      });
      const body = await response.json();

      if (response.ok && body.ok) {
        form.reset();
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
      } else {
        form.setAttribute('data-state', 'error');
        status.textContent = body.message ?? form.dataset.error ?? '';
      }
    } catch {
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
