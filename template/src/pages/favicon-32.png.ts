/** The tab icon, rendered from the site's icon at build time — see src/lib/icon.ts. */
import type { APIRoute } from 'astro';
import { iconPng } from '../lib/icon';

export const GET: APIRoute = async () =>
  new Response(await iconPng(32), { headers: { 'content-type': 'image/png' } });
