import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeMeta } from '@jtakeit/kit/meta';
import { readProgress } from '@jtakeit/kit/progress';
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
        // developer can do in the panel meanwhile (wiki/73 · §7). On every
        // page under `astro dev`, on none of a build.
        if (command === 'dev') injectScript('page', "import '@jtakeit/kit/writing';");
      },
      // `/_jtk/progress.json` on the dev server: where the site is, read off
      // the files on every request (jtakeit-core, wiki/73). The panel reads it
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
        server.middlewares.use('/_jtk/state.json', async (req, res) => {
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Content-Type', 'application/json');
          try {
            const [progress, platform] = await Promise.all([readProgress(process.cwd()), platformHalf(process.cwd())]);
            res.end(JSON.stringify({ version: 1, progress, platform }));
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
        const meta = await writeMeta(fileURLToPath(dir), {
          collections: COLLECTIONS,
          blocks: BLOCKS,
          locales: LOCALES,
          immutable: ['/_astro/'],
        });
        const drafts = meta.drafts.length;
        if (drafts > 0) {
          logger.info(`${drafts} unfinished entr${drafts === 1 ? 'y' : 'ies'} and specimen page(s) — served only to an editing session`);
        }
      },
    },
  };
}
