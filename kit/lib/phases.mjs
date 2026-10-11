/**
 * The seven phases of a site being written, from two halves (jtakeit-core,
 * wiki/73 · §4 and §7).
 *
 * The kit's half is `readProgress` — the brief, the layout, the writing,
 * read off the files. The platform's half — the judge's word, the
 * repository, the build, the preview, and the panel's setting up — comes
 * through the dev session (`jtkit session`). This turns the two into the
 * strip the page shows, by the same rules the panel's own card uses
 * (entities/site/writing.ts there): a phase is a fact; a later phase
 * counts only once every phase before it does; written means the kit's
 * still-to-do list is empty, not that the required fields are filled.
 */

export const PHASES = ['brief', 'laidOut', 'writing', 'judged', 'attached', 'building', 'preview'];

export const PHASE_NAMES = {
  brief: 'Brief',
  laidOut: 'Laid out',
  writing: 'Writing',
  judged: 'Checked',
  attached: 'Attached',
  building: 'Building',
  preview: 'Preview',
};

/** The panel's steps, as the page names them; `agent` ones are not the developer's. */
export const STEP_NAMES = {
  build: 'The agent builds it',
  diary: 'Bookings: the rules and what is booked',
  business: 'Who owns this site',
  notifications: 'Where enquiries and bookings go',
  subscription: 'The subscription',
  access: 'What the studio may do',
  payee: 'Who gets paid',
  launch: 'First publish',
};

/**
 * Where the site is.
 *
 * @param {import('./progress.mjs').Progress | null | undefined} progress the kit's reading, or null where none
 * @param {object | null | undefined} platform the session's answer (`/v1/dev-sessions/{id}/progress`), or null where not connected
 */
export function phasesOf(progress, platform) {
  const seen = progress !== null && progress !== undefined;
  const known = platform !== null && platform !== undefined && platform.error === undefined;
  const attached = known && platform.attached === true;
  const served = known && platform.served === true;
  const build = known && platform.build ? platform.build : null;

  const briefDone = seen
    ? progress.brief !== null && progress.brief.facts > 0 && progress.brief.sections['Decisions'] === true
    : attached;
  const laidOutDone = seen ? progress.kit !== null || progress.catalogue === true : attached;
  const writingDone = seen
    ? progress.pages.length > 0 &&
      progress.pages.every((one) => one.written) &&
      Object.values(progress.collections).every((one) => one.entries >= one.expected) &&
      progress.missing.length === 0
    : attached;
  const judgedDone = known && platform.judged?.ok === true;
  const buildingDone = served || build?.status === 'ok';
  const buildingCurrent = build !== null && (build.status === 'running' || build.status === 'queued' || build.status === 'failed');

  const done = {
    brief: briefDone,
    laidOut: laidOutDone,
    writing: writingDone,
    judged: judgedDone,
    attached,
    building: buildingDone,
    preview: served,
  };
  // In order: a later phase counts only once every phase before it does.
  let before = true;
  for (const key of PHASES) {
    done[key] = done[key] && before;
    before = done[key];
  }

  const current = buildingCurrent && !served ? 'building' : (PHASES.find((key) => !done[key]) ?? 'preview');
  const index = PHASES.indexOf(current);
  const phases = PHASES.map((key, i) => {
    let state;
    if (key === current) state = 'current';
    else if (done[key]) state = 'done';
    else if (!seen && !attached && i < 3) state = 'unseen';
    else if (!known && i >= 3) state = 'unseen';
    else if (i < index) state = 'unseen';
    else state = 'left';
    return { key, state };
  });
  return { phases, current, index, known, seen };
}

/** The sentence under the strip, for the current phase. */
export function sayPhase(where, progress, platform) {
  const known = platform !== null && platform !== undefined && platform.error === undefined;
  switch (where.current) {
    case 'brief':
      return 'Collecting the brief';
    case 'laidOut':
      return 'Laying the site out';
    case 'writing': {
      const pages = progress?.pages ?? [];
      const written = pages.filter((one) => one.written).length;
      return `Writing the pages — ${written} of ${pages.length} with their text · still to do: ${progress?.missing.length ?? 0}`;
    }
    case 'judged':
      if (!known || !platform.judged) return 'To be checked before the push';
      return platform.judged.ok ? 'Checked, clean' : `Checked — findings to fix: ${platform.judged.findings}`;
    case 'attached':
      return 'To be pushed and attached';
    case 'building': {
      const build = known ? platform.build : null;
      if (!build) return 'To be built';
      if (build.status === 'failed') return `The build failed — ${build.error || 'see its log in the panel'}`;
      if (build.status === 'queued') return 'A build is queued';
      return build.stage_of ? `Building — step ${build.stage_num} of ${build.stage_of}` : 'Building';
    }
    default:
      return 'The preview is ready';
  }
}

/**
 * What the developer can do in the panel meanwhile: the setting up's steps
 * that are not the agent's — open first, then done.
 */
export function meanwhile(platform) {
  const steps = platform?.steps ?? [];
  const named = (step) => ({ key: step.key, name: STEP_NAMES[step.key] ?? step.key, done: step.done === true });
  const theirs = steps.filter((step) => step.whose !== 'agent');
  return {
    open: theirs.filter((step) => !step.done).map(named),
    done: theirs.filter((step) => step.done).map(named),
  };
}
