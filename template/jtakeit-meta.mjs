import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeMeta } from '@jtakeit/kit/meta';
import { keepByName } from '@jtakeit/kit/kept';
import { readProgress } from '@jtakeit/kit/progress';
import { devDiary } from '@jtakeit/kit/devdiary';
import { BLOCKS, COLLECTIONS, LOCALES } from './src/content/blocks.ts';

/**
 * `_meta.json` — what the edge needs to know that the HTML cannot say.
 *
 * The file is `@jtakeit/kit`'s (`writeMeta`): the unfinished entries read
 * off `jtk/content`, the specimen pages derived from the declaration, and
 * the directory this generator keeps its hashed files in — `/_astro/`, which
 * the edge caches for a year. This hook only says when to write it and
 * what Astro's answers to those are; a site on another generator calls the
 * same function from its own build step.
 *
 * ── the disclosure is not here any more ────────────────────────────────────
 *
 * It briefly was: a version number this file wrote, which the platform read
 * and believed. It is gone, and what replaced it is better in the way that
 * matters — the platform now reads the built pages and looks for the address
 * itself, so what used to be a claim is a check. See PROCESSING_URL in
 * src/content/blocks.ts.
 */
// The platform's half, asked at most every three seconds and remembered
// between: a page polling every three seconds is one request to the
// platform, not one per tab.
/*
 * Files a script picks by name live in `public/`, which the edge serves for a
 * minute — every returning visitor downloads the hero film again. Two ways
 * out, and the first is the one that costs nothing later:
 *
 *   KEPT_BY_NAME  directories of `public/` whose files are copied under
 *                 `/_astro/kept/` with a hash of their bytes in the name, and
 *                 every whole address of them in the build pointed at the
 *                 copy. Kept for a year; a new photograph is a new name.
 *                 Write the addresses out whole: one a script assembles
 *                 (`'/scenes/scene-' + i`) is not found, and the build says so.
 *   CACHE         a lifetime for a directory whose files keep their names.
 *                 The platform then holds each name to its contents for that
 *                 long once the site has an address — new bytes take a new
 *                 name, or the build is refused (JTK_E_CACHED_FILE_CHANGED).
 *                 A day for names that may be reused.
 */
const KEPT_BY_NAME = []; // e.g. ['clips']
const CACHE = []; // e.g. [{ prefix: '/clips/', maxAge: 86400 }]

let platformCache = { at: 0, value: null };
async function platformHalf(root) {
  let session;
  try {
    session = JSON.parse(await readFile(join(root, 'jtk', 'session.json'), 'utf8'));
  } catch {
    return { connected: false };
  }
  if (Date.now() - platformCache.at < 3000 && platformCache.value) return platformCache.value;
  const api = String(session.api || 'https://api.jtakeit.com').replace(/\/$/, '');
  let value;
  try {
    const control = new AbortController();
    const clock = setTimeout(() => control.abort(), 2500);
    const answer = await fetch(`${api}/v1/dev-sessions/${session.session}/progress`, {
      headers: { 'X-Watch-Key': String(session.key ?? '') },
      signal: control.signal,
    });
    clearTimeout(clock);
    if (answer.ok) value = { connected: true, ...(await answer.json()) };
    else value = { connected: true, error: answer.status === 404 ? 'the session is closed, or the key is not its' : `the platform answered ${answer.status}` };
  } catch (why) {
    value = { connected: true, error: why.name === 'AbortError' ? 'the platform did not answer in time' : why.message };
  }
  platformCache = { at: Date.now(), value };
  return value;
}

export function jtakeitMeta() {
  return {
    name: 'jtakeit-meta',
    hooks: {
      // The panel reads the dev server from the browser, across origins
      // (https://admin.jtakeit.com → http://localhost). Astro 7's dev server
      // refuses a cross-origin subresource request outright — 403, before
      // any middleware — unless the origin's host is in
      // `security.allowedDomains`; the platform's panels are, on either
      // environment. Only the dev server reads this: the built site is
      // static and has no forwarded host to validate.
      'astro:config:setup': ({ updateConfig, injectScript, command }) => {
        updateConfig({
          security: {
            allowedDomains: [
              { hostname: 'admin.jtakeit.com', protocol: 'https' },
              { hostname: 'admin.stg.jtakeit.com', protocol: 'https' },
            ],
          },
        });
        // The page's own card, bottom right: where the site is and what the
        // developer can do in the panel meanwhile. On every
        // page under `astro dev`, on none of a build.
        if (command === 'dev') injectScript('page', "import '@jtakeit/kit/writing';");
      },
      // `/_jtk/progress.json` on the dev server: where the site is, read off
      // the files on every request. The panel reads it
      // through a dev session the way it reads the pages, from the same
      // machine; `jtkit progress` prints the same reading for the agent. Open
      // to any origin because the panel is on another one, and because
      // nothing in it is a secret — counts, paths and sentences. Chrome asks
      // the person once before a public page may reach localhost (Local
      // Network Access, Chrome 142+) and may preflight; the private-network
      // header is the answer that preflight wants.
      'astro:server:setup': ({ server }) => {
        // `/_jtk/state.json`: both halves for the page's own card — the
        // reading above, and the platform's answer through the dev session
        // when `jtk/session.json` names one (jtkit session). The dev server
        // asks the platform, not the browser: one origin, no cookie, no
        // permission, and the key never reaches a page.
        // The last file saved in the working tree, whatever it is: the files
        // the reading above looks at are jtk/ and the brief, and an agent
        // writing a header or the catalogue's declarations for five minutes
        // read as «changed 5 min ago» on a card that said it was writing the
        // pages (13 October 2026). The dev server's own watcher sees every
        // save; the card says which, and when.
        let lastChange = null;
        const root = process.cwd();
        const noted = (file) => {
          const rel = file.startsWith(root) ? file.slice(root.length + 1) : file;
          if (rel === '' || /(^|\/)(node_modules|dist|\.astro|\.git)(\/|$)/.test(rel) || rel === 'jtk/session.json') return;
          lastChange = { path: rel, at: new Date().toISOString() };
        };
        server.watcher.on('change', noted);
        server.watcher.on('add', noted);
        server.watcher.on('unlink', noted);
        // The diary, answered from the site's own files, so a booking form can
        // be walked on localhost (@jtakeit/kit/devdiary). Nothing reaches the
        // platform; a booking lasts until the server stops.
        server.middlewares.use('/api', devDiary(process.cwd()));
        server.middlewares.use('/_jtk/state.json', async (req, res) => {
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Content-Type', 'application/json');
          try {
            const [progress, platform] = await Promise.all([readProgress(process.cwd()), platformHalf(process.cwd())]);
            res.end(JSON.stringify({ version: 1, progress, platform, lastChange }));
          } catch (why) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: why.message }));
          }
        });
        server.middlewares.use('/_jtk/progress.json', async (req, res) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Private-Network', 'true');
          res.setHeader('Cache-Control', 'no-store');
          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }
          try {
            const progress = await readProgress(process.cwd());
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(progress));
          } catch (why) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: why.message }));
          }
        });
      },
      'astro:build:done': async ({ dir, logger }) => {
        const kept = keepByName(fileURLToPath(dir), { dirs: KEPT_BY_NAME });
        if (kept.kept.length > 0) {
          logger.info(`${kept.kept.length} file(s) under a hashed name, ${kept.rewritten} reference(s) pointed at them`);
        }
        if (kept.unreferenced.length > 0) {
          logger.warn(
            `${kept.unreferenced.slice(0, 5).join(', ')}${kept.unreferenced.length > 5 ? ` +${kept.unreferenced.length - 5} more` : ''} ` +
              'named whole nowhere in the build — still served by name, for a minute. Write the address out in full where it is used.',
          );
        }
        const meta = await writeMeta(fileURLToPath(dir), {
          collections: COLLECTIONS,
          blocks: BLOCKS,
          locales: LOCALES,
          immutable: ['/_astro/'],
          cache: CACHE,
        });
        const drafts = meta.drafts.length;
        if (drafts > 0) {
          logger.info(`${drafts} unfinished entr${drafts === 1 ? 'y' : 'ies'} and specimen page(s) — served only to an editing session`);
        }
      },
    },
  };
}
