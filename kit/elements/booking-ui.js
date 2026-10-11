/**
 * The booking form's look, by default: what a visitor on a phone between
 * two appointments needs, drawn over the kit's own markup.
 *
 *   steps   two steps — what and when, then who is coming — with the choice
 *           summarised beside the name, and a way back
 *   week    the day as a row of seven, rolling from today, closed days
 *           struck out, never yesterday
 *   parts   the times by the part of the day — morning, afternoon, evening —
 *           one part showing at a time, so thirty pills become a dozen and
 *           nothing scrolls; a part of one or two times joins its neighbour
 *   select  the choice of whom as a drawn list rather than the browser's own
 *
 * `renderBookingForm` turns all four on with `data-ui` on the form; a site
 * passes `ui: false` for the plain form, or names the ones it wants. Every
 * piece reads the element's hooks and leaves them where they are — the
 * native day input is still what is submitted, the kit's pills are still the
 * pills — so the protocol is untouched and `preflight` reads the same form.
 *
 * The look is the kit's reference and the site's to restyle: `booking.css`
 * makes it legible, the scaffold's `global.css` makes it the site's.
 */
import { PARTS, partsOf, parseDay, ymd, DAY_NAMES, to24 } from '../lib/booking/parts.mjs';

/**
 * @param {HTMLFormElement} form
 * @param {Record<string, string>} words
 */
export function dressBooking(form, words) {
  if (form.dataset.dressed === '1') return;
  form.dataset.dressed = '1';
  const wants = new Set((form.dataset.ui ?? '').split(/\s+/).filter(Boolean));
  const lang = document.documentElement.lang || form.dataset.locale || 'en';
  if (wants.has('select')) {
    for (const select of /** @type {NodeListOf<HTMLSelectElement>} */ (form.querySelectorAll('select[name=resource], select[name=service]'))) drawnSelect(select);
  }
  if (wants.has('week')) {
    const day = /** @type {HTMLInputElement | null} */ (form.querySelector('input[name=day]'));
    if (day) weekStrip(day, { open: (form.dataset.open ?? '').split(',').filter(Boolean), lang, words });
  }
  if (wants.has('parts')) partsOfDay(form, words);
  if (wants.has('steps')) twoSteps(form, words, lang);
}

/**
 * A week of days in a row: seven chips from the first day that can be
 * booked, the month above them, arrows for the next and the previous week.
 * The native input stays — hidden — and is what the form submits; a press on
 * a day sets it and fires `change`, which is what the element listens to.
 *
 * @param {HTMLInputElement} input
 * @param {{ open: string[]; lang: string; words: Record<string, string> }} options
 */
export function weekStrip(input, options) {
  if (input.dataset.week === '1') return;
  input.dataset.week = '1';
  const open = new Set(options.open.length > 0 ? options.open : DAY_NAMES);
  // Today is the browser's, not the build's: `min` was written when the
  // site was built, and a site built on Friday is read on Saturday.
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const minSaid = parseDay(input.min);
  const floor = minSaid && minSaid > today ? minSaid : today;
  const max = parseDay(input.max) ?? new Date(floor.getFullYear(), floor.getMonth() + 2, floor.getDate());
  const monthName = new Intl.DateTimeFormat(options.lang, { month: 'long', year: 'numeric' });
  const weekday = new Intl.DateTimeFormat(options.lang, { weekday: 'short' });
  const plus = (d, n) => { const out = new Date(d); out.setDate(out.getDate() + n); return out; };
  const choosable = (d) => d >= floor && d <= max && open.has(DAY_NAMES[(d.getDay() + 6) % 7]);

  const root = document.createElement('div');
  root.className = 'booking__days';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', input.labels?.[0]?.textContent?.trim() || options.words.day || 'Day');
  input.classList.add('is-replaced');
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;
  input.insertAdjacentElement('afterend', root);
  const chosenAtStart = parseDay(input.value);
  let start = chosenAtStart && chosenAtStart >= floor && chosenAtStart > plus(floor, 6) ? chosenAtStart : new Date(floor);

  function draw() {
    const chosen = input.value;
    const week = Array.from({ length: 7 }, (_, i) => plus(start, i));
    const span = week[0].getMonth() === week[6].getMonth()
      ? monthName.format(week[0])
      : `${monthName.format(week[0]).split(' ')[0]} – ${monthName.format(week[6])}`;
    root.innerHTML = `
      <div class="booking__days-head">
        <span class="booking__days-month">${span}</span>
        <span class="booking__days-nav">
          <button type="button" class="booking__days-arrow" data-go="-7" aria-label="${options.words.prevWeek ?? 'Previous week'}"${plus(start, -1) >= floor ? '' : ' disabled'}>‹</button>
          <button type="button" class="booking__days-arrow" data-go="7" aria-label="${options.words.nextWeek ?? 'Next week'}"${plus(start, 7) <= max ? '' : ' disabled'}>›</button>
        </span>
      </div>
      <div class="booking__days-row">
        ${week.map((d) => {
          const value = ymd(d);
          const ok = choosable(d);
          return `<button type="button" class="booking__day${value === chosen ? ' is-chosen' : ''}" data-day="${value}"${ok ? '' : ' disabled'} aria-pressed="${value === chosen}"><span class="booking__day-wd">${weekday.format(d)}</span><span class="booking__day-n">${d.getDate()}</span></button>`;
        }).join('')}
      </div>`;
  }
  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const arrow = target?.closest('[data-go]');
    if (arrow instanceof HTMLButtonElement) {
      start = plus(start, Number(arrow.dataset.go));
      if (start < floor) start = new Date(floor);
      draw();
      return;
    }
    const dayButton = target?.closest('[data-day]');
    if (dayButton instanceof HTMLButtonElement && !dayButton.disabled) {
      input.value = dayButton.dataset.day ?? '';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      draw();
    }
  });
  input.addEventListener('change', draw);
  draw();
}

/**
 * The times by the part of the day, one part showing at a time. The element
 * writes the pills; this sorts them as they arrive. A pill the element has
 * chosen decides which part shows.
 *
 * @param {HTMLFormElement} form
 * @param {Record<string, string>} words
 */
export function partsOfDay(form, words) {
  const slots = /** @type {HTMLElement | null} */ (form.querySelector('[data-slots]'));
  if (!slots || slots.dataset.parts === '1') return;
  slots.dataset.parts = '1';
  const tabs = document.createElement('div');
  tabs.className = 'booking__parts';
  tabs.setAttribute('role', 'tablist');
  tabs.hidden = true;
  slots.insertAdjacentElement('beforebegin', tabs);
  const timeOf = (pill) => to24((pill.textContent ?? '').trim()).slice(0, 5);
  const hourOf = (pill) => Number(timeOf(pill).slice(0, 2));
  /** @type {WeakMap<HTMLElement, string>} */
  const parts = new WeakMap();
  let current = '';

  const show = () => {
    for (const pill of /** @type {NodeListOf<HTMLElement>} */ (slots.querySelectorAll('.booking__slot'))) {
      pill.hidden = current !== '' && parts.get(pill) !== current;
    }
    for (const tab of /** @type {NodeListOf<HTMLElement>} */ (tabs.querySelectorAll('.booking__part'))) {
      tab.classList.toggle('is-current', tab.dataset.part === current);
      tab.setAttribute('aria-selected', String(tab.dataset.part === current));
    }
  };
  const sort = () => {
    const pills = /** @type {HTMLElement[]} */ ([...slots.querySelectorAll('.booking__slot')]);
    // A time on the pill is the platform's clock in the site's language;
    // the hour read off it on 24 hours whatever that clock says.
    const sorted = partsOf(pills.map(hourOf));
    pills.forEach((pill, i) => parts.set(pill, sorted[i]));
    const have = new Set(sorted);
    const chosen = pills.find((pill) => pill.classList.contains('is-chosen'));
    tabs.innerHTML = PARTS.filter((part) => have.has(part))
      .map((part) => {
        const own = pills.filter((pill) => parts.get(pill) === part).map(timeOf);
        return `<button type="button" class="booking__part" role="tab" data-part="${part}">${words[part] ?? part}<span class="booking__part-n">${own[0]}–${own[own.length - 1]}</span></button>`;
      })
      .join('');
    tabs.hidden = have.size < 2;
    current = chosen ? parts.get(chosen) ?? '' : have.has(/** @type {never} */ (current)) ? current : [...have][0] ?? '';
    show();
  };
  tabs.addEventListener('click', (event) => {
    const tab = event.target instanceof Element ? event.target.closest('[data-part]') : null;
    if (!(tab instanceof HTMLElement)) return;
    current = tab.dataset.part ?? '';
    show();
  });
  new MutationObserver(sort).observe(slots, { childList: true });
  sort();
}

/**
 * The form in two steps: the services, whom, the day and the time first; the
 * name and the rest once those are chosen, with the choice summarised beside
 * them and a way back. One form throughout — every field keeps its place,
 * the element keeps reading them — so with scripts off it is the one form,
 * whole. The success is a step of its own: the element shows its box, this
 * takes the steps and the summary away.
 *
 * @param {HTMLFormElement} form
 * @param {Record<string, string>} words
 * @param {string} lang
 */
export function twoSteps(form, words, lang) {
  if (form.dataset.steps === '1') return;
  form.dataset.steps = '1';
  const firstHalf = new Set(['service', 'resource', 'day', 'back', 'hours', 'party', 'quantity', 'class']);
  for (const child of /** @type {HTMLElement[]} */ ([...form.children])) {
    const control = child.querySelector('input, select, textarea');
    const name = control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement ? control.name : '';
    const first = child.matches('[data-times]') || firstHalf.has(name) || child.tagName === 'NOSCRIPT' || child.matches('[data-done]');
    child.dataset.step = first ? '1' : '2';
  }
  for (const el of form.querySelectorAll('[data-done], [data-booking-error]')) /** @type {HTMLElement} */ (el).dataset.step = 'both';

  const stepper = document.createElement('ol');
  stepper.className = 'booking__stepper';
  stepper.innerHTML = [words.stepWhat ?? 'What and when', words.stepWho ?? 'Who is coming']
    .map((name, i) => `<li class="booking__step" data-at="${i + 1}"><span class="booking__step-n">${i + 1}</span>${name}</li>`)
    .join('');
  form.prepend(stepper);

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'booking__next';
  next.dataset.step = '1';
  next.textContent = words.next ?? 'Continue';
  const need = document.createElement('p');
  need.className = 'booking__need';
  need.dataset.step = '1';
  need.hidden = true;
  need.textContent = words.needAll ?? 'Pick a service, a day and a time first.';
  const times = form.querySelector('[data-times]');
  times?.insertAdjacentElement('afterend', need);
  need.insertAdjacentElement('afterend', next);

  const summary = document.createElement('div');
  summary.className = 'booking__summary';
  summary.dataset.step = '2';
  form.insertBefore(summary, form.querySelector('[data-step="2"]'));

  const chosen = () => {
    const names = /** @type {HTMLInputElement[]} */ ([...form.querySelectorAll('input[name=service]:checked')])
      .map((box) => box.closest('.booking__service')?.querySelector('.booking__service-name')?.textContent?.trim() ?? box.value);
    const single = /** @type {HTMLSelectElement | null} */ (form.querySelector('select[name=service]'));
    if (single) names.push(single.options[single.selectedIndex]?.textContent?.trim() ?? '');
    const who = /** @type {HTMLSelectElement | null} */ (form.querySelector('select[name=resource]'));
    const dayValue = /** @type {HTMLInputElement | null} */ (form.querySelector('input[name=day]'))?.value ?? '';
    const dayDate = parseDay(dayValue);
    const slot = /** @type {HTMLElement | null} */ (form.querySelector('.booking__slot.is-chosen'));
    const ends = /** @type {HTMLElement | null} */ (form.querySelector('[data-ends]'));
    return {
      services: names.filter(Boolean),
      who: who ? who.options[who.selectedIndex]?.textContent?.trim() ?? '' : '',
      day: dayDate ? new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'long' }).format(dayDate) : dayValue,
      time: slot ? to24((slot.textContent ?? '').trim()).split('·')[0].trim() : '',
      until: ends && !ends.hidden ? ends.dataset.clock ?? '' : '',
      takes: ends && !ends.hidden ? ends.dataset.length ?? '' : '',
    };
  };

  const stage = (to) => {
    // A move between the steps brings the form into view; the first stage,
    // set as the page loads, must not — it scrolled every visitor to the
    // form the moment the page opened (10 October 2026).
    const moved = form.dataset.stage !== undefined && form.dataset.stage !== to;
    form.dataset.stage = to;
    for (const step of /** @type {NodeListOf<HTMLElement>} */ (stepper.querySelectorAll('.booking__step'))) {
      step.classList.toggle('is-current', step.dataset.at === to);
      step.classList.toggle('is-done', to === 'done' || Number(step.dataset.at) < Number(to));
    }
    if (to === '2') {
      const c = chosen();
      const row = (label, value) => (value ? `<div class="booking__summary-row"><dt>${label}</dt><dd>${value}</dd></div>` : '');
      summary.innerHTML = `
        <p class="booking__summary-label">${words.summary ?? 'Your booking'}</p>
        <dl class="booking__summary-list">
          ${row(words.what ?? 'What', c.services.join(', '))}
          ${row(words.resource ?? 'With', c.who)}
          ${row(words.when ?? 'When', `${c.day}${c.time ? `, ${c.time}${c.until ? `–${c.until}` : ''}` : ''}`)}
          ${row(words.takes ?? 'Takes', c.takes)}
        </dl>
        <button type="button" class="booking__back">${words.change ?? 'Change'}</button>`;
      summary.querySelector('.booking__back')?.addEventListener('click', () => stage('1'));
      /** @type {HTMLInputElement | null} */ (form.querySelector('input[name=name]'))?.focus({ preventScroll: true });
    }
    if (moved && to !== 'done') form.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  next.addEventListener('click', () => {
    const c = chosen();
    const ready = c.services.length > 0 && /** @type {HTMLInputElement | null} */ (form.querySelector('input[name=day]'))?.value && c.time;
    need.hidden = Boolean(ready);
    if (ready) stage('2');
  });
  form.addEventListener('change', () => {
    if (form.dataset.stage === '2') stage('2');
  });
  const done = /** @type {HTMLElement | null} */ (form.querySelector('[data-done]'));
  if (done) {
    const settle = () => {
      if (done.hidden || form.dataset.stage === 'done') return;
      stage('done');
      form.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    new MutationObserver(settle).observe(done, { attributes: true, attributeFilter: ['hidden'] });
    settle();
  }
  stage('1');
}

/**
 * A `<select>` as a drawn list: the native one stays, hidden, and is what
 * the form reads; its options are mirrored as they change (the element
 * rewrites whom from every availability answer), and a pick sets the native
 * value and fires `change`.
 *
 * @param {HTMLSelectElement} select
 */
export function drawnSelect(select) {
  if (select.dataset.drawn === '1') return;
  select.dataset.drawn = '1';
  const root = document.createElement('div');
  root.className = 'booking__dd';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'booking__dd-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const list = document.createElement('div');
  list.className = 'booking__dd-list';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  root.append(trigger, list);
  select.classList.add('is-replaced');
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;
  select.insertAdjacentElement('afterend', root);
  const label = select.labels?.[0];
  if (label) trigger.setAttribute('aria-label', label.textContent?.trim() ?? '');

  const draw = () => {
    const current = select.options[select.selectedIndex];
    trigger.innerHTML = `<span class="booking__dd-value">${current?.textContent ?? ''}</span><span class="booking__dd-mark" aria-hidden="true">▾</span>`;
    list.innerHTML = [...select.options]
      .map((o) => `<button type="button" class="booking__dd-option${o.selected ? ' is-chosen' : ''}" role="option" aria-selected="${o.selected}" data-value="${o.value.replace(/"/g, '&quot;')}"${o.disabled ? ' disabled' : ''}>${o.textContent}</button>`)
      .join('');
  };
  const open = (yes) => {
    list.hidden = !yes;
    trigger.setAttribute('aria-expanded', String(yes));
    if (yes) /** @type {HTMLElement | null} */ (list.querySelector('.is-chosen:not(:disabled), .booking__dd-option:not(:disabled)'))?.focus();
  };
  trigger.addEventListener('click', () => open(list.hidden));
  list.addEventListener('click', (event) => {
    const option = event.target instanceof Element ? event.target.closest('[data-value]') : null;
    if (!(option instanceof HTMLButtonElement) || option.disabled) return;
    select.value = option.dataset.value ?? '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    draw();
    open(false);
    trigger.focus();
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { open(false); trigger.focus(); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.hidden) { open(true); return; }
      const options = /** @type {HTMLButtonElement[]} */ ([...list.querySelectorAll('.booking__dd-option:not(:disabled)')]);
      const at = options.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
      options[(at + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length]?.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!list.hidden && event.target instanceof Node && !root.contains(event.target)) open(false);
  });
  new MutationObserver(draw).observe(select, { childList: true, subtree: true, attributes: true });
  select.addEventListener('change', draw);
  draw();
}
