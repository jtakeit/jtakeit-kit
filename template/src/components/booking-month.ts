/**
 * The booking form's month: the strip of days shows a week, and the month's
 * name over it — or «More dates» beside it — opens the whole month, a card
 * over the page (a sheet from the foot on a phone). The past and what lies
 * beyond the diary's horizon cannot be chosen; nor can a day the business is
 * closed (the form's `data-open`). Picking a day chooses it in the form, by
 * the form's own field (`input[name=day]`, which the kit's element reads), and
 * brings the strip to its week; Escape and a press beside the card close it.
 *
 * As the panel's teaser drew it before the teaser became the template itself
 * (the owner, 24–25 November 2026).
 */

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (value: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const capital = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

const MORE: Record<string, [string, string, string, string]> = {
  // more dates, previous month, next month, close
  en: ['More dates', 'Previous month', 'Next month', 'Close'],
  de: ['Weitere Daten', 'Vorheriger Monat', 'Nächster Monat', 'Schliessen'],
  fr: ['Autres dates', 'Mois précédent', 'Mois suivant', 'Fermer'],
  it: ['Altre date', 'Mese precedente', 'Mese successivo', 'Chiudi'],
  es: ['Más fechas', 'Mes anterior', 'Mes siguiente', 'Cerrar'],
  pt: ['Mais datas', 'Mês anterior', 'Mês seguinte', 'Fechar'],
  pl: ['Więcej terminów', 'Poprzedni miesiąc', 'Następny miesiąc', 'Zamknij'],
  uk: ['Інші дати', 'Попередній місяць', 'Наступний місяць', 'Закрити'],
  ru: ['Другие даты', 'Предыдущий месяц', 'Следующий месяц', 'Закрыть'],
};

function attach(form: HTMLFormElement): void {
  if (form.dataset.month) return;
  const input = form.querySelector<HTMLInputElement>('input[name="day"]');
  if (!input) return;
  form.dataset.month = '1';

  const lang = document.documentElement.lang || 'en';
  const [moreWord, prevWord, nextWord, closeWord] = MORE[lang.slice(0, 2)] ?? MORE.en;
  const open = new Set((form.dataset.open ?? '').split(',').filter(Boolean));
  const isOpen = (d: Date) => open.size === 0 || open.has(DAY_NAMES[(d.getDay() + 6) % 7]);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const min = parse(input.min);
  const floor = min && min > today ? min : today;
  const max = parse(input.max) ?? new Date(floor.getFullYear(), floor.getMonth() + 2, floor.getDate());
  const monthName = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' });
  const fullDay = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(new Date(2026, 0, 5 + i)).replace(/\.$/, ''),
  );

  // ── the card ────────────────────────────────────────────────────────────────
  const dialog = document.createElement('dialog');
  dialog.className = 'bmc';
  dialog.setAttribute('lang', lang);
  form.closest('jtk-booking')?.append(dialog);
  let shown = new Date(floor.getFullYear(), floor.getMonth(), 1);

  const draw = () => {
    const first = new Date(shown.getFullYear(), shown.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(1 - lead);
    const chosen = input.value;
    const canBack = new Date(shown.getFullYear(), shown.getMonth(), 0) >= floor;
    const canOn = new Date(shown.getFullYear(), shown.getMonth() + 1, 1) <= max;
    const cells = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = ymd(d);
      const other = d.getMonth() !== shown.getMonth();
      const ok = d >= floor && d <= max && isOpen(d);
      return `<button type="button" class="bmc__day${other ? ' is-other' : ''}${key === chosen ? ' is-on' : ''}${key === ymd(today) ? ' is-today' : ''}" data-pick="${key}" aria-label="${fullDay.format(d)}" aria-pressed="${key === chosen}"${ok ? '' : ' disabled'}>${d.getDate()}</button>`;
    }).join('');
    dialog.innerHTML = `
      <div class="bmc__card" role="document">
        <div class="bmc__head">
          <button type="button" class="bmc__arrow" data-month="-1" aria-label="${prevWord}"${canBack ? '' : ' disabled'}>‹</button>
          <p class="bmc__month" aria-live="polite">${capital(monthName.format(first))}</p>
          <button type="button" class="bmc__arrow" data-month="1" aria-label="${nextWord}"${canOn ? '' : ' disabled'}>›</button>
        </div>
        <div class="bmc__grid">
          ${weekdays.map((name) => `<span class="bmc__wd" aria-hidden="true">${name}</span>`).join('')}
          ${cells}
        </div>
        <button type="button" class="bmc__close" data-close aria-label="${closeWord}">×</button>
      </div>`;
  };

  const openCard = () => {
    const chosen = parse(input.value);
    const at = chosen ?? floor;
    shown = new Date(at.getFullYear(), at.getMonth(), 1);
    draw();
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('.bmc__day.is-on:not(:disabled), .bmc__day:not(:disabled)')?.focus();
  };

  // The strip brought to the chosen day's week, by its own arrows.
  const bringStrip = (key: string) => {
    for (let i = 0; i < 80; i++) {
      const days = form.querySelector('.booking__days');
      if (!days || days.querySelector(`[data-day="${key}"]`)) return;
      const firstDay = days.querySelector<HTMLElement>('[data-day]')?.dataset.day ?? '';
      const arrow = days.querySelector<HTMLButtonElement>(key > firstDay ? '[data-go="7"]' : '[data-go="-7"]');
      if (!arrow || arrow.disabled) return;
      arrow.click();
    }
  };

  dialog.addEventListener('click', (event) => {
    const target = event.target as Element;
    if (target === dialog || target.closest('[data-close]')) return dialog.close();
    const step = target.closest<HTMLButtonElement>('[data-month]');
    if (step && !step.disabled) {
      shown = new Date(shown.getFullYear(), shown.getMonth() + Number(step.dataset.month), 1);
      draw();
      dialog.querySelector<HTMLButtonElement>(`[data-month="${step.dataset.month}"]:not(:disabled)`)?.focus();
      return;
    }
    const day = target.closest<HTMLButtonElement>('[data-pick]');
    if (day && !day.disabled) {
      const key = day.dataset.pick ?? '';
      input.value = key;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      dialog.close();
      bringStrip(key);
      form.querySelector<HTMLButtonElement>(`.booking__days [data-day="${key}"]`)?.focus();
    }
  });

  // ── the door to it: the month's name, and «More dates» beside the arrows ───
  // The strip is drawn again on every change, so the door is laid on after each
  // drawing, and found by a delegated press.
  const decorate = () => {
    const head = form.querySelector('.booking__days-head');
    if (!head || head.querySelector('[data-month-open]')) return;
    const name = head.querySelector<HTMLElement>('.booking__days-month');
    if (name) {
      name.setAttribute('role', 'button');
      name.tabIndex = 0;
      name.dataset.monthOpen = '';
      name.setAttribute('aria-haspopup', 'dialog');
    }
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'booking__days-more';
    more.dataset.monthOpen = '';
    more.setAttribute('aria-haspopup', 'dialog');
    more.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><span>${moreWord}</span>`;
    head.querySelector('.booking__days-nav')?.prepend(more);
  };
  new MutationObserver(decorate).observe(form, { childList: true, subtree: true });
  decorate();
  form.addEventListener('click', (event) => {
    if ((event.target as Element).closest('[data-month-open]')) openCard();
  });
  form.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement;
    if ((event.key === 'Enter' || event.key === ' ') && target.matches('.booking__days-month[data-month-open]')) {
      event.preventDefault();
      openCard();
    }
  });
}

export function months(): void {
  document.querySelectorAll<HTMLFormElement>('jtk-booking form').forEach(attach);
}
