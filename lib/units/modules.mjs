/**
 * The modules a site adds on a sentence in the brief: `blog`, `booking`
 * (jtakeit-core wiki/110 §3.5, §3.6). Filled in by `jtk add`.
 */
export const MODULES = {
  blog: { name: 'blog', kind: 'module', about: 'a journal: the blog collection, two example posts, the latest on the home page', present: (tree) => /^BLOCKS\.push\(BLOG_POST\);$/m.test(tree.read('src/content/blocks.ts') ?? '') },
  booking: { name: 'booking', kind: 'module', about: 'a booking kit of the platform\'s, laid over the example', present: (tree) => /bookings\s*:/.test(/^export const MODULES[^;]*;/ms.exec(tree.read('src/content/blocks.ts') ?? '')?.[0] ?? '') },
};
