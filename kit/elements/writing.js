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
 *
 * ── the stage, while the page has no words ──────────────────────────────────
 *
 * A scaffold just laid out is a page of empty fields and asterisks, and a
 * developer who opens localhost to watch the agent saw that and nothing else
 * (13 October 2026). So while the page being looked at has not one word in it
 * yet, the element covers it with a stage: a page assembling itself, what the
 * agent is on, what is left, the panel's steps meanwhile, and the promise that
 * the page will appear here by itself. The moment the page has its first
 * words, the stage goes and the page is loaded again — nobody presses
 * anything. A page the files do not know (a listing, an entry) is never
 * covered, nor is any page when the dev server cannot be read.
 */
import { PHASES, PHASE_NAMES, phasesOf, sayPhase, meanwhile, blankHere } from '../lib/phases.mjs';

const STORE = 'jtk-writing:collapsed';

const CSS = `
:host{position:fixed;right:16px;bottom:16px;z-index:2147483000;font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;
  --paper:#f4f1ea;--glow:rgba(212,162,74,.16);--bg:#fbfaf7;--ink:#1d1b17;--ink2:#3f3b33;--muted:#6b665c;--faint:#9b958a;--line:#e6e1d6;--line2:#d8d2c4;--ok:#2f7d5a;--attn:#9a6b1c;--shadow:0 12px 36px rgba(30,25,15,.16),0 2px 6px rgba(30,25,15,.08)}
@media (prefers-color-scheme:dark){:host{--paper:#141311;--glow:rgba(212,162,74,.12);--bg:#1c1b18;--ink:#f1ede5;--ink2:#d9d3c7;--muted:#a8a295;--faint:#716c62;--line:#33302a;--line2:#443f36;--ok:#5bb38a;--attn:#d4a24a;--shadow:0 12px 36px rgba(0,0,0,.5)}}
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
/* One line under the strip: the phase it is in, whole, and the one after —
   seven names in 340 px were seven ellipses (13 October 2026). */
.names{display:flex;gap:8px;align-items:baseline;margin-top:7px;font-size:12px}.names .current{color:var(--ink);font-weight:600}.names .next{color:var(--faint)}
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

const STAGE_CSS = `
.stage{position:fixed;inset:0;z-index:2147482999;display:grid;place-items:center;overflow:auto;padding:32px 20px;
  background:radial-gradient(1200px 600px at 50% -10%,var(--glow),transparent 60%),var(--paper);color:var(--ink);
  font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;animation:fade .4s ease both}
.stage.leaving{animation:out .35s ease both}
@keyframes fade{from{opacity:0}to{opacity:1}}@keyframes out{to{opacity:0}}
.wrap{width:min(560px,100%);display:grid;gap:22px}
.sheet{position:relative;height:210px;border-radius:18px;background:var(--bg);border:1px solid var(--line);box-shadow:var(--shadow);overflow:hidden;padding:18px}
.bar{height:10px;width:34%;border-radius:999px}
.row{display:flex;gap:8px;margin-top:22px}.row b{display:block;height:9px;border-radius:999px}
.hero{height:46px;width:72%;border-radius:12px;margin-top:18px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.cards b{display:block;height:46px;border-radius:10px}
.sk{background:linear-gradient(90deg,var(--line) 0%,var(--line2) 50%,var(--line) 100%);background-size:200% 100%;animation:shine 1.8s linear infinite;opacity:0;transform:translateY(6px)}
.sk{animation:shine 1.8s linear infinite,rise .6s cubic-bezier(.22,.61,.36,1) forwards}
.d1{animation-delay:0s,.1s}.d2{animation-delay:.1s,.35s}.d3{animation-delay:.2s,.6s}.d4{animation-delay:.3s,.85s}.d5{animation-delay:.4s,1.1s}.d6{animation-delay:.5s,1.35s}
@keyframes shine{to{background-position:-200% 0}}@keyframes rise{to{opacity:1;transform:none}}
.caret{position:absolute;right:18px;bottom:16px;display:flex;gap:5px}.caret i{width:6px;height:6px;border-radius:999px;background:var(--attn);animation:dot 1.2s ease-in-out infinite}
.caret i:nth-child(2){animation-delay:.15s}.caret i:nth-child(3){animation-delay:.3s}@keyframes dot{50%{opacity:.25;transform:translateY(-3px)}}
.kicker{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
.big{font-size:clamp(24px,4vw,32px);line-height:1.15;font-weight:650;letter-spacing:-.01em;margin-top:6px}
.now{display:flex;gap:10px;align-items:flex-start;margin-top:10px;color:var(--ink2)}.now i{flex:none;width:9px;height:9px;border-radius:999px;background:var(--attn);margin-top:7px;animation:pulse 2.4s ease-in-out infinite}
.promise{color:var(--muted);font-size:14px}
.right{margin:6px 0 0 19px;color:var(--muted);font-size:13px}
.stage .strip{margin-top:0}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}@media (max-width:560px){.cols{grid-template-columns:1fr}}
.stage .todo{margin:6px 0 0;padding-left:16px;list-style:disc}
@media (prefers-reduced-motion:reduce){.stage,.stage.leaving,.sk,.caret i,.now i{animation:none!important}.sk{opacity:1;transform:none}}
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
    style.textContent = CSS + STAGE_CSS;
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

    // The stage, while this page has not one word in it (see the top).
    const blank = !this.failed && blankHere(progress);
    if (this.wasBlank && !blank && progress !== null) {
      // Its first words: let the page be the page.
      this.leave();
      return;
    }
    this.wasBlank = blank;
    if (blank) {
      this.stage(where, progress, half);
      return;
    }

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

    const last = this.state?.lastChange ?? null;
    const foot = [
      this.failed ? 'the dev server did not answer'
        : last ? `last change: ${last.path.split('/').slice(-2).join('/')} · ${ago(last.at)}`
        : progress?.changedAt ? `read from the files, changed ${ago(progress.changedAt)}` : 'read from the files',
      half?.until ? `platform through the session until ${until(half.until)}` : '',
    ].filter(Boolean).join(' · ');

    this.show(`<section class="card${this.enter ? ' enter' : ''}" aria-label="Where the site is">
      <div class="head"><span class="title">What the agent is doing</span><span class="count">phase ${n} of 7</span><button class="hide" data-toggle aria-label="Collapse">–</button></div>
      <ol class="strip" aria-label="The seven phases">${where.phases.map((p, i) => `<li class="seg ${p.state}" title="${i + 1}. ${PHASE_NAMES[p.key]}"></li>`).join('')}</ol>
      <p class="names"><span class="current">${n}. ${esc(PHASE_NAMES[where.current] ?? '')}</span>${where.index < 6 ? `<span class="next">next: ${esc(PHASE_NAMES[where.phases[where.index + 1].key])}</span>` : ''}</p>
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

  /** The stage over a page with no words yet: what is happening, and that it will appear. */
  stage(where, progress, half) {
    const say = sayPhase(where, progress, half);
    const todo = (progress?.missing ?? []).slice(0, 4);
    const steps = meanwhile(half);
    const open = half ? steps.open : [];
    document.documentElement.style.overflow = 'hidden';
    this.show(`<section class="stage" role="status" aria-live="polite" aria-label="The site is being written">
      <div class="wrap">
        <div class="sheet" aria-hidden="true">
          <div class="bar sk d1"></div>
          <div class="hero sk d2"></div>
          <div class="row"><b class="sk d3" style="width:58%"></b><b class="sk d3" style="width:24%"></b></div>
          <div class="cards"><b class="sk d4"></b><b class="sk d5"></b><b class="sk d6"></b></div>
          <div class="caret"><i></i><i></i><i></i></div>
        </div>
        <div>
          <p class="kicker">Phase ${where.index + 1} of 7 · ${esc(PHASE_NAMES[where.current] ?? '')}</p>
          <h1 class="big">The site is being written</h1>
          <p class="now"><i></i><span>${esc(say)}</span></p>
          ${this.state?.lastChange ? `<p class="right">right now: <code>${esc(this.state.lastChange.path)}</code> · ${esc(ago(this.state.lastChange.at))}</p>` : ''}
        </div>
        <ol class="strip" aria-hidden="true">${where.phases.map((p) => `<li class="seg ${p.state}"></li>`).join('')}</ol>
        <div class="cols">
          ${todo.length > 0 ? `<div><p class="label">Still to do</p><ul class="todo">${todo.map((line) => `<li>${esc(line)}</li>`).join('')}</ul></div>` : ''}
          ${open.length > 0
            ? `<div><p class="label">Meanwhile, in the panel</p><ul class="steps">${open.map((s) => `<li><i class="o"></i><span>${esc(s.name)}</span></li>`).join('')}</ul>${half?.panel ? `<a class="panel" href="${esc(half.panel)}" target="_blank" rel="noopener">Open the panel ↗</a>` : ''}</div>`
            : ''}
        </div>
        <p class="promise">This page appears here by itself the moment it has its first words — leave the tab open.</p>
      </div>
    </section>`);
  }

  /** The page has its words: the stage fades and the page is read again. */
  leave() {
    this.wasBlank = false;
    const stage = this.box.querySelector('.stage');
    stage?.classList.add('leaving');
    setTimeout(() => location.reload(), stage ? 350 : 0);
  }

  /** Put this on the page, unless it is what is there already. */
  show(html) {
    const key = html.replace(' enter', '');
    if (key === this.shown) return;
    this.shown = key;
    this.box.innerHTML = html;
    this.enter = false;
    if (!html.includes('class="stage"')) document.documentElement.style.removeProperty('overflow');
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
