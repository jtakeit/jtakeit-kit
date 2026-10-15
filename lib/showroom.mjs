/**
 * jtk showroom — every hero field, ground, edge, entrance and gallery this
 * version ships, live on one page, on the dev server.
 *
 *   jtk showroom [--photos <dir>] [--design <jtk/design.json>] [--port 4330] [--out <dir>]
 *
 * Run inside a project it takes that project's colours from its
 * jtk/design.json. The galleries are filled with the showroom's own stock
 * photographs (lib/showroom/photos, credited in CREDITS.md there) unless
 * `--photos <dir>` names others — a project's scraped feed is somebody's
 * work, and it is only shown when asked for by name.
 *
 * It never touches the project. The page lives in a scratch copy of the
 * scaffold, kept per version under the user's cache so the second run starts
 * in a second rather than after an install.
 */
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const RASTER = /\.(jpe?g|png|webp|avif)$/i;
const MOST = 60;

const npm = (name = 'npm') => (process.platform === 'win32' ? `${name}.cmd` : name);

/** @param {string[]} argv */
export async function showroom(argv) {
  const flag = (name) => {
    const at = argv.indexOf(`--${name}`);
    return at === -1 ? undefined : argv[at + 1];
  };
  const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  const cwd = process.cwd();
  const out = resolve(flag('out') ?? join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'jtakeit', `showroom-${version}`));
  const port = flag('port') ?? '4330';

  // ---- the scratch site, once per version ----------------------------------
  if (!existsSync(join(out, 'node_modules', 'astro'))) {
    rmSync(out, { recursive: true, force: true });
    mkdirSync(dirname(out), { recursive: true });
    console.log(`Laying out the showroom in ${out} (first run of ${version} only)…`);
    const made = spawnSync(process.execPath, [join(ROOT, 'bin', 'jtk.mjs'), 'create', 'showroom', '--name', 'Showroom', '--locale', 'en', '--out', out, '--no-git'], { stdio: 'inherit' });
    if (made.status !== 0) throw new Error('could not lay out the scaffold for the showroom');
    const installed = spawnSync(npm(), ['install', '--no-audit', '--no-fund'], { cwd: out, stdio: 'inherit' });
    if (installed.status !== 0) throw new Error(`npm install failed in ${out}`);
  }

  // ---- the page, fresh every run --------------------------------------------
  mkdirSync(join(out, 'src', 'pages'), { recursive: true });
  copyFileSync(join(HERE, 'showroom', 'showroom.astro'), join(out, 'src', 'pages', 'showroom.astro'));

  // ---- the photographs: the project's, where there is one -------------------
  const from = [flag('photos') ? resolve(flag('photos')) : join(HERE, 'showroom', 'photos')];
  const source = from.find((dir) => existsSync(dir) && readdirSync(dir).some((f) => RASTER.test(f)));
  const assets = join(out, 'src', 'assets');
  mkdirSync(assets, { recursive: true });
  for (const old of readdirSync(assets)) if (old.startsWith('sr-')) rmSync(join(assets, old));
  const photos = [];
  if (source) {
    const files = readdirSync(source).filter((f) => RASTER.test(f)).sort().slice(0, MOST);
    files.forEach((file, i) => {
      const name = `sr-${String(i + 1).padStart(2, '0')}`;
      copyFileSync(join(source, file), join(assets, name + extname(file).toLowerCase()));
      photos.push(name);
    });
  }

  // ---- the colours: the project's design, where there is one ----------------
  const designPath = flag('design') ? resolve(flag('design')) : join(cwd, 'jtk', 'design.json');
  let design = {};
  try {
    design = JSON.parse(readFileSync(designPath, 'utf8'));
  } catch {
    /* none: the sample palette */
  }
  const colors = Array.isArray(design.colors) && design.colors.length === 4 ? design.colors : [];
  let name = '';
  try {
    name = JSON.parse(readFileSync(join(cwd, 'jtk', 'site.json'), 'utf8')).name ?? '';
  } catch {
    /* not a site */
  }

  mkdirSync(join(out, 'src', 'data'), { recursive: true });
  writeFileSync(
    join(out, 'src', 'data', 'showroom.json'),
    `${JSON.stringify({ version, name, photos, stock: !flag('photos'), colors, ground: design.ground ?? '', field: design.field ?? '' }, null, 2)}\n`,
  );

  console.log(`\nShowroom · @jtakeit/astro ${version}`);
  console.log(`  colours    ${colors.length ? designPath.replace(cwd, '.') : 'a sample palette (no jtk/design.json here)'}`);
  console.log(`  photos     ${flag('photos') ? `${photos.length} from ${source.replace(cwd, '.')}` : `the showroom's ${photos.length} stock photographs (Pexels) — --photos <dir> for others`}`);
  console.log(`\n  http://localhost:${port}/showroom/\n`);

  const dev = spawn(npm('npx'), ['astro', 'dev', '--port', port], { cwd: out, stdio: 'inherit' });
  await new Promise((done) => dev.on('exit', done));
}
