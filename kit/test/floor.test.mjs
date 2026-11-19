import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { floorAdvice, fontFaults, screenHeightsIn } from '../lib/floor.mjs';

// F1 (wiki/115 §2): a height in vh, svh or dvh follows the in-app browsers'
// bar; the screen is var(--screen), and its fallback is the one viewport
// unit that belongs.
test('a height in vh, svh or dvh is advised against, with its line and the token it should be', () => {
  const css = ['.hero {', '  min-height: 100vh;', '  max-block-size: 70svh;', '}', '.a { block-size: min(80dvh, 46rem); height: 2rem }'].join('\n');
  const found = screenHeightsIn(css, 'src/styles/site.css');
  assert.deepEqual(found.map((one) => one.where), ['src/styles/site.css:2', 'src/styles/site.css:3', 'src/styles/site.css:5']);
  assert.match(found[0].says, /^min-height: 100vh — 100vh follows the bar of the in-app browsers \(Telegram, Instagram, WhatsApp\)/);
  assert.match(found[0].says, /: var\(--screen\)$/);
  assert.match(found[1].says, /: calc\(var\(--screen\) \* 0\.7\)$/);
  assert.match(found[2].says, /: min\(calc\(var\(--screen\) \* 0\.8\), 46rem\)$/);
});

test('the token, its fallback, a padding, a width and a comment are not heights in viewport units', () => {
  const css = [
    '/* min-height: 100vh was the old hero */',
    '.hero { min-block-size: min(var(--screen, 100svh), 56rem); }',
    '.b { block-size: calc(var(--screen, 100svh) * 0.6); padding-block: clamp(3rem, 9vh, 7rem); }',
    '.c { inline-size: 50vw; max-inline-size: calc((100svh - 9rem) * 0.8); }',
    ':root { --screen: 100svh; }',
  ].join('\n');
  assert.deepEqual(screenHeightsIn(css, 'x.css'), []);
});

test('in a component, its <style> and its style attributes are read, never its script or its prose', () => {
  const astro = [
    '---',
    '// a first screen of min-height: 100svh filled the thumbnail',
    "const tall = 'height: 100vh';",
    '---',
    '<section style="min-height: 90svh">…</section>',
    '<style>',
    '  .x { max-height: 50dvh; }',
    '</style>',
  ].join('\n');
  assert.deepEqual(screenHeightsIn(astro, 'src/Hero.astro').map((one) => one.where), ['src/Hero.astro:5', 'src/Hero.astro:7']);
});

// F2: a family named first and never loaded — Brumy's headings named
// Instrument Sans and loaded nothing of the kind (18 November 2026).
test('a family named first in a stack and provided by no @font-face is advised; a loaded, a system and a generic one are not', () => {
  const css = [
    "@font-face { font-family: 'Space Grotesk'; src: url(/_astro/sg.woff2) format('woff2'); }",
    "@font-face { font-family: 'Space Grotesk Fallback'; src: local('Arial'); size-adjust: 102%; ascent-override: 96%; }",
    "h1 { font-family: 'Instrument Sans', 'Inter', system-ui, sans-serif; }",
    "h2 { font-family: 'Space Grotesk', 'Space Grotesk Fallback', sans-serif; }",
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
    'code { font-family: ui-monospace, Menlo, monospace; }',
    ":root { --font-display: 'Brand Display', ui-sans-serif, sans-serif; --font-weight: 600; --font-text: var(--font-display); }",
  ].join('\n');
  const found = fontFaults({ css: [{ where: 'dist/_astro/a.css', text: css }], html: [{ where: 'dist/index.html', text: '<link rel="preload" href="/_astro/sg.woff2" as="font" type="font/woff2" crossorigin>' }] });
  assert.deepEqual(
    found.map((one) => one.says.slice(0, one.says.indexOf('»') + 1)),
    ['«Instrument Sans»', '«Brand Display»'],
  );
  assert.equal(found[0].where, 'dist/_astro/a.css:3');
  assert.match(found[0].says, /no @font-face provides it, so every visitor reads the face after it instead/);
});

test("a face from a third party's host is advised once a host, and the families it names are its own", () => {
  const link = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600&amp;family=Inter:wght@400&amp;display=swap">';
  const pages = [
    { where: 'dist/index.html', text: `<head><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>${link}</head>` },
    { where: 'dist/de/index.html', text: link },
  ];
  const css = [{ where: 'dist/_astro/a.css', text: "h1{font-family:Space Grotesk,sans-serif}p{font-family:Inter,sans-serif}.x{font-family:'Instrument Sans',sans-serif}" }];
  const found = fontFaults({ css, html: pages });
  assert.deepEqual(found.map((one) => one.says.split(':')[0]), ['«Instrument Sans» is named first in a font stack and no @font-face provides it, so every visitor reads the face after it instead. Load it — its own woff2, or an @fontsource package — or name the face that is loaded', 'a font is fetched from fonts.googleapis.com']);
  assert.equal(found[1].where, 'dist/index.html');
  assert.match(found[1].says, /LG München I/);

  const imported = fontFaults({ css: [{ where: 'src/site.css', text: "@import url('https://fonts.bunny.net/css?family=inter:400');\nbody { font-family: 'Inter', sans-serif; }" }] });
  assert.deepEqual(imported.map((one) => one.says.slice(0, 40)), ['a font is fetched from fonts.bunny.net: '], 'a host whose families cannot be read: the host is said, the family is not');
});

test("the site's own faces with no preload and no measured stand-in are advised", () => {
  const css = [{ where: 'dist/_astro/a.css', text: "@font-face{font-family:Inter;src:url(/_astro/inter.woff2) format('woff2')}body{font-family:Inter,sans-serif}" }];
  const found = fontFaults({ css, html: [{ where: 'dist/index.html', text: '<html><head></head></html>' }] });
  assert.equal(found.length, 2);
  assert.match(found[0].says, /not preloaded/);
  assert.match(found[1].says, /no stand-in is measured for the swap.*npx @jtakeit\/astro fonts/);
  assert.deepEqual(fontFaults({ css: [{ where: 'a.css', text: 'body{font-family:system-ui,sans-serif}' }], html: [{ where: 'dist/index.html', text: '' }] }), [], 'the system face: nothing to load, nothing to say');
});

test('floorAdvice reads the heights off src/ and the type off the build', () => {
  const root = mkdtempSync(join(tmpdir(), 'jtk-floor-'));
  try {
    mkdirSync(join(root, 'src', 'styles'), { recursive: true });
    mkdirSync(join(root, 'dist', '_astro'), { recursive: true });
    writeFileSync(join(root, 'src', 'styles', 'site.css'), '.hero { min-height: 100dvh; }\n');
    writeFileSync(join(root, 'dist', '_astro', 'a.css'), '.hero{min-height:100dvh}h1{font-family:Ghost Grotesk,sans-serif}');
    writeFileSync(join(root, 'dist', 'index.html'), '<html></html>');
    const found = floorAdvice(root, join(root, 'dist'));
    assert.deepEqual(found.map((one) => one.where), ['src/styles/site.css:1', 'dist/_astro/a.css:1']);
    assert.deepEqual(floorAdvice(root).map((one) => one.where), ['src/styles/site.css:1'], 'without a build, src/ and public/ alone');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
