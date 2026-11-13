/**
 * Pictures under server output, where nothing is resized (jtakeit-meta.mjs
 * sets this service when `JTK_RENDER=live`; a static build keeps Astro's own,
 * and every picture of it is optimised as it always was).
 *
 * A draft rendered live is drawn on request, and a picture resized on request
 * took 130–220 ms of sharp each, for a page that renders in a few
 * milliseconds (jtakeit-core wiki/89 §9.1). So a picture is served as it is:
 * one the repository ships, or one a build fetched, from the file the server
 * build emitted beside it; one uploaded in the draft since, from the
 * platform's bucket (src/lib/uploads.ts). The width and height a page gives
 * it are the ones Astro would have written, so the page keeps its shape; the
 * preview loses only the smaller copies a phone would have been sent.
 */
import { baseService } from 'astro/assets';
import type { ExternalImageService } from 'astro';

const asItIs: ExternalImageService = {
  validateOptions: baseService.validateOptions,
  getHTMLAttributes: baseService.getHTMLAttributes,
  getURL(options) {
    return typeof options.src === 'string' ? options.src : options.src.src;
  },
};

export default asItIs;
