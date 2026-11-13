/**
 * A request that carries a draft is rendered inside it — under server output
 * only (jtakeit-meta.mjs adds this middleware when `JTK_RENDER=live`; a static
 * build has none).
 *
 * The platform's renderer hands the draft over as `locals.jtkDraft`: every
 * file of its `jtk/`, keyed as the door reads them. `rendering` makes the door
 * of those files the one `site` answers for the length of the request, the
 * whole body read inside it (`@jtakeit/kit/live`). A request without one —
 * the platform's check of the server build against the static one, at build —
 * renders from the build's own files.
 */
import { rendering } from '@jtakeit/kit/live';

export const onRequest = (context: { locals: Record<string, unknown> }, next: () => Promise<Response>) => rendering(context.locals, next);
