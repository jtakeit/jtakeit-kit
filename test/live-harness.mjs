// The live check, as the platform makes it (backend/api/sitebuild/live.mjs),
// for any site the tests lay out: built static, built for a server
// (`JTK_RENDER=live`), and every page the static build made drawn from the
// site's own files and held to its built twin — asset names, picture files and
// which stylesheet a rule is in set aside, every rule of the built page's
// styles there live (jtakeit-core wiki/89 §12; docs/live.md).
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const STEPS = [
  ['asset names', (s) => s.replace(/(\/_astro\/[^"'\s)?,]+?)\.[A-Za-z0-9_-]{8}\.(css|js|mjs)\b/g, '$1.$2')],
  ['picture files', (s) => s.replace(/<(img|source)\b[^>]*>/g, (tag) => tag.replace(/\s(src|srcset|sizes)="[^"]*"/g, ''))],
  ['stylesheets', (s) => s.replace(/<link rel="stylesheet" href="[^"]*">/g, '').replace(/<style>[\s\S]*?<\/style>/g, '')],
];

export function rulesOf(css) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) {
      out.push(css.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  return out;
}

export const stylesOf = (html, root) =>
  [...html.matchAll(/<link rel="stylesheet" href="([^"]*)">/g)].map(([, href]) => readFileSync(join(root, href), 'utf8')).join('\n') +
  [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(([, css]) => css).join('\n');

export function compare(built, live) {
  let a = built;
  let b = live;
  for (const [, step] of STEPS) {
    if (a === b) break;
    a = step(a);
    b = step(b);
  }
  if (a === b) return null;
  let at = 0;
  while (a[at] === b[at]) at++;
  return `built «${a.slice(Math.max(0, at - 60), at + 100)}» live «${b.slice(Math.max(0, at - 60), at + 100)}»`;
}

/**
 * Build `site` both ways and hold every page live to its built twin. Returns a
 * way to draw a page from a draft (`page`), the draft itself to change, and
 * `close`.
 *
 * @param {string} site
 * @param {{ url: string; fail: (m: string) => never; said: string }} how
 */
let builds = 0;
export async function liveCheck(site, { url, fail, said }) {
  // A server build of its own each time: Node keeps a module it imported once, by its path.
  const out = `.jtk-live/dist-${++builds}`;
  const env = { ...process.env, SITE_URL: url, ASTRO_TELEMETRY_DISABLED: '1' };
  let run = spawnSync('npx', ['astro', 'build'], { cwd: site, encoding: 'utf8', env });
  if (run.status !== 0) fail(`${said}: does not build static:\n${run.stdout}\n${run.stderr}`);
  run = spawnSync('npx', ['astro', 'build', '--outDir', out], { cwd: site, encoding: 'utf8', env: { ...env, JTK_RENDER: 'live' } });
  if (run.status !== 0) fail(`${said}: does not build for a server:\n${run.stdout}\n${run.stderr}`);
  const { readJtk } = await import(pathToFileURL(join(site, 'node_modules', '@jtakeit', 'kit', 'lib', 'content', 'node.mjs')).href);
  const { handler } = await import(pathToFileURL(join(site, out, 'server', 'entry.mjs')).href);
  const state = { draft: await readJtk(site), media: {} };
  const server = createServer((req, res) =>
    handler(req, res, () => {
      res.writeHead(404);
      res.end();
    }, { jtkDraft: { files: state.draft, media: state.media } }),
  );
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = async (path) => {
    const answer = await fetch(base + path);
    return { status: answer.status, text: await answer.text() };
  };

  const dist = join(site, 'dist');
  const pages = [];
  const walk = (at) => {
    for (const one of readdirSync(at, { withFileTypes: true })) {
      if (one.isDirectory()) walk(join(at, one.name));
      else if (one.name === 'index.html' && !/\/_fl-/.test(at.split(sep).join('/'))) pages.push(`/${relative(dist, at).split(sep).join('/')}`.replace(/\/?$/, '/').replace(/^\/\/$/, '/'));
    }
  };
  walk(dist);
  for (const path of pages) {
    const built = readFileSync(join(dist, path, 'index.html'), 'utf8');
    const live = await page(path);
    if (live.status !== 200) fail(`${said}: ${path} answered ${live.status} under the server build:\n${live.text.slice(0, 400)}`);
    const differs = compare(built, live.text);
    if (differs !== null) fail(`${said}: ${path} drawn live is not the built page: ${differs}`);
    const lives = new Set(rulesOf(stylesOf(live.text, join(site, out, 'client'))));
    const lacks = rulesOf(stylesOf(built, dist)).find((rule) => !lives.has(rule));
    if (lacks !== undefined) fail(`${said}: ${path} drawn live lacks a rule of the built page's styles: ${lacks.slice(0, 160)}`);
  }
  return { pages, page, state, close: () => server.close() };
}
