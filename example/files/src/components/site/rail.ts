/**
 * A rail: one row of cards the visitor scrolls sideways — by hand, or by the
 * two arrows beside the section's heading.
 *
 *   <div data-rail>                       the window, the full width of the page
 *     <ul data-rail-track> <li>…</li> …   the row, which scrolls (overflow-x)
 *   <button data-rail-prev data-rail-for="…">  <button data-rail-next …>
 *
 * The row starts at the text's edge, the first card whole. An arrow moves it
 * by what the screen shows less one card, so the card that was last is first
 * after it; it is switched off at that end of the row, and both are hidden
 * where everything is already in sight. Without a script the row is simply a
 * row to scroll, and the arrows are not shown.
 */

function start(rail: HTMLElement): void {
  if (rail.dataset.railOn) return;
  rail.dataset.railOn = '1';
  const track = rail.querySelector<HTMLElement>('[data-rail-track]');
  if (!track) return;
  const name = rail.id;
  const prev = name ? document.querySelector<HTMLButtonElement>(`[data-rail-prev][data-rail-for="${name}"]`) : null;
  const next = name ? document.querySelector<HTMLButtonElement>(`[data-rail-next][data-rail-for="${name}"]`) : null;
  const card = () => (track.children[0] as HTMLElement | undefined)?.getBoundingClientRect().width ?? 300;
  const gap = () => parseFloat(getComputedStyle(track).columnGap) || 16;

  const by = (direction: 1 | -1) => {
    const step = Math.max(card() + gap(), track.clientWidth - card() - gap() * 2);
    track.scrollBy({ left: direction * step, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  prev?.addEventListener('click', () => by(-1));
  next?.addEventListener('click', () => by(1));

  const mark = () => {
    const max = track.scrollWidth - track.clientWidth;
    const atStart = track.scrollLeft <= 2;
    const atEnd = track.scrollLeft >= max - 2;
    rail.toggleAttribute('data-at-end', atEnd);
    const scrolls = max > 2;
    for (const button of [prev, next]) {
      if (!button) continue;
      button.hidden = !scrolls;
      button.closest<HTMLElement>('[data-rail-arrows]')?.toggleAttribute('hidden', !scrolls);
    }
    if (prev) prev.disabled = atStart;
    if (next) next.disabled = atEnd;
  };
  track.addEventListener('scroll', mark, { passive: true });
  addEventListener('resize', mark, { passive: true });
  mark();
}

export function rails(): void {
  document.querySelectorAll<HTMLElement>('[data-rail]').forEach(start);
}
