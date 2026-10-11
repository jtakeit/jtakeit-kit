/**
 * The page's own card: where the site is, bottom right, on the dev server
 * only (jtakeit-core, wiki/73 · §7).
 *
 * A scaffold just made is an empty page, and a developer looking at
 * localhost while the agent writes sees nothing of what is happening. This
 * card says it on the page itself: the seven phases the panel's «What the
 * agent is doing» shows, by the same rules (lib/phases.mjs), and — through
 * the dev session — the steps of the panel's setting up the developer can
 * take meanwhile. It reads `/_jtk/state.json` from the dev server, its own
 * origin, every three seconds; nothing crosses an origin and nothing is
 * declared. The scaffold's integration puts it on every page under `astro
 * dev` and on none of a build.
 *
 * Collapsed, it is a pill with the phase; a press opens it; the choice is
 * remembered in this browser.
 */
import { PHASES, PHASE_NAMES, phasesOf, sayPhase, meanwhile } from '../lib/phases.mjs';

const STORE = 'jtk-writing:collapsed';

const CSS = `
:host{position:fixed;right:16px;bottom:16px;z-index:2147483000;font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;
  --bg:#fbfaf7;--ink:#1d1b17;--ink2:#3f3b33;--muted:#6b665c;--faint:#9b958a;--line:#e6e1d6;--line2:#d8d2c4;--ok:#2f7d5a;--attn:#9a6b1c;--shadow:0 12px 36px rgba(30,25,15,.16),0 2px 6px rgba(30,25,15,.08)}
@media (prefers-color-scheme:dark){:host{--bg:#1c1b18;--ink:#f1ede5;--ink2:#d9d3c7;--muted:#a8a295;--faint:#716c62;--line:#33302a;--line2:#443f36;--ok:#5bb38a;--attn:#d4a24a;--shadow:0 12px 36px rgba(0,0,0,.5)}}
*{box-sizing:border-box;margin:0;padding:0}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
a{color:var(--ink);text-decoration:underline;text-decoration-color:var(--line2);text-underline-offset:3px}
a:hover{text-decoration-color:var(--ink)}
.pill{display:flex;align-items:center;gap:10px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:9px 14px 9px 12px;box-shadow:var(--shadow);transition:transform .18s ease}
.pill:hover{transform:translateY(-1px)}
.mini{display:flex;gap:3px}.mini i{display:block;width:7px;height:7px;border-radius:999px;background:var(--line2)}
.pill .dev{font-size:10px;color:var(--faint);margin-left:2px}
.devnote{margin-top:8px;color:var(--faint);font-size:10.5px}
.card{width:min(372px,calc(100vw - 32px));background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:14px 16px 12px}
.card.enter{animation:in .22s cubic-bezier(.22,.61,.36,1)}
@keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.head{display:flex;align-items:baseline;gap:10px}.title{font-weight:600;font-size:14px}.count{margin-left:auto;color:var(--muted);font-variant-numeric:tabular-nums;font-size:12px}
.hide{color:var(--faint);line-height:1;padding:2px 4px;border-radius:6px;margin-right:-4px}.hide:hover{color:var(--ink);background:var(--line)}
.strip{display:flex;gap:4px;margin-top:12px;list-style:none}.seg{flex:1;height:5px;border-radius:999px;background:var(--line2)}
.seg.done,.mini i.done{background:var(--ok)}.seg.current,.mini i.current{background:var(--attn)}.seg.current{animation:pulse 2.4s ease-in-out infinite}
.seg.unseen{background:transparent;border:1px solid var(--line2)}
@keyframes pulse{50%{opacity:.45}}@media (prefers-reduced-motion:reduce){.seg.current,.card.enter{animation:none}}
.names{display:flex;gap:4px;margin-top:6px}.names span{flex:1;min-width:0;font-size:10px;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.names .current{color:var(--ink);font-weight:600}.names .done{color:var(--muted)}
.say{display:flex;gap:9px;align-items:flex-start;margin-top:12px;font-weight:600;font-size:13.5px;line-height:1.35}.say i{flex:none;width:8px;height:8px;border-radius:999px;background:var(--attn);margin-top:5px}
.todo{list-style:none;margin:6px 0 0 17px;color:var(--muted);font-size:12.5px}.todo li+li{margin-top:2px}
.rule{height:1px;background:var(--line);margin:12px 0 10px}
.label{font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.steps{list-style:none;margin-top:6px}.steps li{display:flex;gap:8px;align-items:baseline;font-size:12.5px;color:var(--ink2)}.steps li+li{margin-top:3px}
.steps .o{flex:none;width:12px;height:12px;border-radius:999px;border:1.5px solid var(--line2);transform:translateY(1.5px)}
.steps .done{color:var(--faint);text-decoration:line-through}.steps .done .o{border-color:var(--ok);background:var(--ok)}
.note{margin-top:6px;color:var(--muted);font-size:12.5px}code{font:11.5px ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--line);padding:1px 5px;border-radius:5px}
.panel{display:inline-block;margin-top:8px;font-size:12.5px}
.foot{margin-top:10px;color:var(--faint);font-size:11px}
`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function ago(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

function until(iso) {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

class JtkWriting extends HTMLElement {
  constructor() {
    super();
    this.state = null;
    this.failed = false;
    this.timer = 0;
    // What is on the page now: a poll that changes nothing redraws nothing,
    // so the card does not blink every three seconds — and the entrance
    // animation plays on a press, not on every reading.
    this.shown = '';
    this.enter = false;
    let collapsed = false;
    try { collapsed = localStorage.getItem(STORE) === '1'; } catch { /* a browser without storage shows it open */ }
    this.collapsed = collapsed;
  }

  connectedCallback() {
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    this.box = document.createElement('div');
    root.append(style, this.box);
    root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-toggle]') : null;
      if (!target) return;
      this.collapsed = !this.collapsed;
      this.enter = !this.collapsed;
      try { localStorage.setItem(STORE, this.collapsed ? '1' : '0'); } catch { /* fine */ }
      this.render();
    });
    this.render();
    this.poll();
  }

  disconnectedCallback() { clearTimeout(this.timer); }

  async poll() {
    try {
      const answer = await fetch('/_jtk/state.json', { cache: 'no-store' });
      if (!answer.ok) throw new Error(`the dev server answered ${answer.status}`);
      this.state = await answer.json();
      this.failed = false;
    } catch {
      this.failed = true;
    }
    this.render();
    this.timer = setTimeout(() => this.poll(), this.failed ? 30000 : 3000);
  }

  render() {
    const progress = this.state?.progress ?? null;
    const platform = this.state?.platform ?? null;
    const connected = platform !== null && platform.connected === true;
    const half = connected && platform.error === undefined ? platform : null;
    const where = phasesOf(progress, half);
    const n = where.index + 1;

    if (this.collapsed) {
      this.show(`<button class="pill" data-toggle aria-expanded="false" aria-label="Where the site is: phase ${n} of 7">
        <span class="mini">${where.phases.map((p) => `<i class="${p.state}"></i>`).join('')}</span>
        <span>Being written · ${n} of 7</span><span class="dev">dev only</span></button>`);
      return;
    }

    const say = sayPhase(where, progress, half);
    const todo = progress?.missing ?? [];
    const steps = meanwhile(half);
    const stepsHTML = half
      ? (steps.open.length + steps.done.length === 0
          ? `<p class="note">Nothing left in the panel.</p>`
          : `<ul class="steps">${[...steps.open, ...steps.done].map((s) =>
              `<li class="${s.done ? 'done' : ''}"><i class="o"></i><span>${esc(s.name)}</span></li>`).join('')}</ul>`)
        + (half.panel ? `<a class="panel" href="${esc(half.panel)}" target="_blank" rel="noopener">Open the panel ↗</a>` : '')
      : connected
        ? `<p class="note">The platform could not be read: ${esc(platform.error)}</p>`
        : `<p class="note">Not connected to the platform yet — in the working tree: <code>npx jtkit session &lt;session_id&gt; &lt;watch_key&gt;</code>, both from the session's answer.</p>`;

    const foot = [
      this.failed ? 'the dev server did not answer' : progress?.changedAt ? `read from the files, changed ${ago(progress.changedAt)}` : 'read from the files',
      half?.until ? `platform through the session until ${until(half.until)}` : '',
    ].filter(Boolean).join(' · ');

    this.show(`<section class="card${this.enter ? ' enter' : ''}" aria-label="Where the site is">
      <div class="head"><span class="title">What the agent is doing</span><span class="count">phase ${n} of 7</span><button class="hide" data-toggle aria-label="Collapse">–</button></div>
      <ol class="strip" aria-label="The seven phases">${where.phases.map((p, i) => `<li class="seg ${p.state}" title="${i + 1}. ${PHASE_NAMES[p.key]}"></li>`).join('')}</ol>
      <div class="names" aria-hidden="true">${where.phases.map((p, i) => `<span class="${p.state}">${i + 1}. ${PHASE_NAMES[p.key]}</span>`).join('')}</div>
      <p class="say"><i></i><span>${esc(say)}</span></p>
      ${todo.length > 0 && where.current !== 'preview'
        ? `<ul class="todo">${todo.slice(0, 4).map((line) => `<li>${esc(line)}</li>`).join('')}${todo.length > 4 ? `<li>+ ${todo.length - 4} more — <code>jtkit progress</code></li>` : ''}</ul>`
        : ''}
      <div class="rule"></div>
      <p class="label">Meanwhile, in the panel</p>
      ${stepsHTML}
      <p class="foot">${esc(foot)}</p>
      <p class="devnote">Shown on the dev server only, while the site is being written — never in a build.</p>
    </section>`);
  }

  /** Put this on the page, unless it is what is there already. */
  show(html) {
    const key = html.replace(' enter', '');
    if (key === this.shown) return;
    this.shown = key;
    this.box.innerHTML = html;
    this.enter = false;
  }
}

if (!customElements.get('jtk-writing')) customElements.define('jtk-writing', JtkWriting);

function mount() {
  if (document.querySelector('jtk-writing')) return;
  document.body.append(document.createElement('jtk-writing'));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
// Astro's view transitions swap the body: put it back.
document.addEventListener('astro:page-load', mount);

export { JtkWriting, PHASES };
