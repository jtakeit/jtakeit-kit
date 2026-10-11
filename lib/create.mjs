/**
 * `jtk create` — scaffold a site for jtakeit.
 *
 * Copies the template, fills in the tokens, and stops. It does not decide what
 * the site looks like: the template is a working Astro project with the
 * platform's contract in it — `jtk/catalogue.json` derived from
 * `src/content/blocks.ts`, every editable field annotated with `data-jtk-path`,
 * the lead form posting to `/api/lead`, the flags read as `import.meta.env` —
 * and every component in it is yours to replace.
 *
 *   npx @jtakeit/astro create <slug> --name "The Business" --locale de-CH
 *   npx @jtakeit/astro create <slug> --out ./sites/<slug> --schema-type HairSalon
 *
 * The slug becomes the directory and the package name; the site's address on
 * the platform comes from `create_site`, not from here.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, layKitFiles, loadKit } from '@jtakeit/kit/kits';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, '..', 'template');

/** What the form and the privacy page say, in the site's own language. */
const UI = {
  en: {
    skipToContent: 'Skip to content',
    required: 'Required',
    privacy: 'We use what you send only to answer you.',
    sending: 'Sending…',
    success: 'Thank you — we will be in touch.',
    error: 'That did not send. Please try again, or call us.',
    invalidName: 'Please give a name we can call you by.',
    invalidContact: 'Please leave a phone number or an email address.',
    invalidMessage: 'Please write a few words about what you need.',
    demoNote: 'This is a preview — the form does not send anything yet.',
    privacyTitle: 'Privacy',
    privacyIntro: 'This page says what happens to what you send through the form on this website. It is written to be read, not to be agreed to.',
    privacyFormTitle: 'When you write to us',
    privacyFormBody: 'We are given your name, the way you asked us to reach you — a telephone number, an email address, or both — and whatever you wrote. Nothing else: no location, nothing about the pages you looked at, and nothing that identifies you between visits.',
    privacyWhoTitle: 'Who else sees it',
    privacyWhoBody: 'This website runs on jtakeit, which stores what you send and passes it to us. What they do with it, and for how long, is set out here:',
    privacyAskTitle: 'Asking us',
    privacyAskBody: 'Write or ring, and we will tell you what we hold about you or delete it.',
    privacyOwnTitle: 'About us',
  },
  uk: {
    skipToContent: 'Перейти до вмісту',
    required: 'Обовʼязково',
    privacy: 'Ми використовуємо надіслане лише для того, щоб вам відповісти.',
    sending: 'Надсилаємо…',
    success: 'Дякуємо — ми звʼяжемося з вами.',
    error: 'Не вдалося надіслати. Спробуйте ще раз або зателефонуйте нам.',
    invalidName: 'Напишіть, будь ласка, як до вас звертатися.',
    invalidContact: 'Залиште, будь ласка, телефон або пошту.',
    invalidMessage: 'Напишіть, будь ласка, кілька слів про те, що потрібно.',
    demoNote: 'Це попередній перегляд — форма поки нічого не надсилає.',
    privacyTitle: 'Конфіденційність',
    privacyIntro: 'Ця сторінка пояснює, що відбувається з тим, що ви надсилаєте через форму на цьому сайті. Вона написана, щоб її прочитали, а не щоб з нею погодилися.',
    privacyFormTitle: 'Коли ви пишете нам',
    privacyFormBody: 'Ми отримуємо ваше імʼя, спосіб звʼязку, який ви залишили — телефон, пошту або те й інше — і те, що ви написали. Більше нічого: ні місця, ні того, які сторінки ви дивилися, ні того, що впізнало б вас між візитами.',
    privacyWhoTitle: 'Хто ще це бачить',
    privacyWhoBody: 'Сайт працює на jtakeit: вони зберігають надіслане і передають його нам. Що саме вони з цим роблять і як довго зберігають — написано тут:',
    privacyAskTitle: 'Запитати нас',
    privacyAskBody: 'Напишіть або зателефонуйте — скажемо, що саме про вас зберігається, або видалимо.',
    privacyOwnTitle: 'Про нас',
  },
  ru: {
    skipToContent: 'Перейти к содержимому',
    required: 'Обязательно',
    privacy: 'Мы используем отправленное только для того, чтобы вам ответить.',
    sending: 'Отправляем…',
    success: 'Спасибо — мы свяжемся с вами.',
    error: 'Не удалось отправить. Попробуйте ещё раз или позвоните нам.',
    invalidName: 'Напишите, пожалуйста, как к вам обращаться.',
    invalidContact: 'Оставьте, пожалуйста, телефон или почту.',
    invalidMessage: 'Напишите, пожалуйста, несколько слов о том, что нужно.',
    demoNote: 'Это предпросмотр — форма пока ничего не отправляет.',
    privacyTitle: 'Конфиденциальность',
    privacyIntro: 'Эта страница объясняет, что происходит с тем, что вы отправляете через форму на этом сайте. Она написана, чтобы её прочитали, а не чтобы с ней согласились.',
    privacyFormTitle: 'Когда вы пишете нам',
    privacyFormBody: 'Мы получаем ваше имя, оставленный вами способ связи — телефон, почту или и то и другое — и то, что вы написали. Больше ничего: ни места, ни того, какие страницы вы смотрели, ни того, что опознало бы вас между визитами.',
    privacyWhoTitle: 'Кто ещё это видит',
    privacyWhoBody: 'Сайт работает на jtakeit: они хранят отправленное и передают его нам. Что именно они с этим делают и сколько хранят — написано здесь:',
    privacyAskTitle: 'Спросить нас',
    privacyAskBody: 'Напишите или позвоните — скажем, что именно о вас хранится, или удалим.',
    privacyOwnTitle: 'О нас',
  },
  de: {
    skipToContent: 'Zum Inhalt springen',
    required: 'Pflichtfeld',
    privacy: 'Wir verwenden Ihre Angaben nur, um Ihnen zu antworten.',
    sending: 'Wird gesendet…',
    success: 'Danke — wir melden uns bei Ihnen.',
    error: 'Das Senden hat nicht geklappt. Bitte versuchen Sie es erneut oder rufen Sie uns an.',
    invalidName: 'Bitte geben Sie an, wie wir Sie ansprechen dürfen.',
    invalidContact: 'Bitte hinterlassen Sie eine Telefonnummer oder eine E-Mail-Adresse.',
    invalidMessage: 'Bitte schreiben Sie ein paar Worte dazu, worum es geht.',
    demoNote: 'Dies ist eine Vorschau — das Formular sendet noch nichts.',
    privacyTitle: 'Datenschutz',
    privacyIntro: 'Diese Seite erklärt, was mit dem geschieht, was Sie über das Formular auf dieser Website senden. Sie ist zum Lesen geschrieben, nicht zum Zustimmen.',
    privacyFormTitle: 'Wenn Sie uns schreiben',
    privacyFormBody: 'Wir erhalten Ihren Namen, den von Ihnen angegebenen Weg zu Ihnen — Telefonnummer, E-Mail-Adresse oder beides — und was Sie geschrieben haben. Sonst nichts: kein Ort, nichts über die Seiten, die Sie angesehen haben, und nichts, was Sie zwischen Besuchen wiedererkennt.',
    privacyWhoTitle: 'Wer es sonst sieht',
    privacyWhoBody: 'Diese Website läuft auf jtakeit: dort wird gespeichert, was Sie senden, und an uns weitergegeben. Was dort damit geschieht und wie lange, steht hier:',
    privacyAskTitle: 'Fragen Sie uns',
    privacyAskBody: 'Schreiben oder rufen Sie an — wir sagen Ihnen, was wir über Sie haben, oder löschen es.',
    privacyOwnTitle: 'Über uns',
  },
  pl: {
    skipToContent: 'Przejdź do treści',
    required: 'Wymagane',
    privacy: 'Podane dane wykorzystujemy wyłącznie po to, aby Ci odpowiedzieć.',
    sending: 'Wysyłanie…',
    success: 'Dziękujemy — odezwiemy się.',
    error: 'Nie udało się wysłać. Spróbuj ponownie lub zadzwoń do nas.',
    invalidName: 'Napisz, jak możemy się do Ciebie zwracać.',
    invalidContact: 'Zostaw numer telefonu lub adres e-mail.',
    invalidMessage: 'Napisz kilka słów o tym, czego potrzebujesz.',
    demoNote: 'To podgląd — formularz jeszcze nic nie wysyła.',
    privacyTitle: 'Prywatność',
    privacyIntro: 'Ta strona wyjaśnia, co dzieje się z tym, co wysyłasz przez formularz na tej stronie. Została napisana po to, by ją przeczytać, a nie po to, by się na nią zgodzić.',
    privacyFormTitle: 'Kiedy do nas piszesz',
    privacyFormBody: 'Otrzymujemy Twoje imię, pozostawiony sposób kontaktu — numer telefonu, adres e-mail albo oba — i to, co napisałeś. Nic więcej: ani miejsca, ani tego, jakie strony oglądałeś, ani niczego, co rozpoznałoby Cię między wizytami.',
    privacyWhoTitle: 'Kto jeszcze to widzi',
    privacyWhoBody: 'Ta strona działa na jtakeit: tam przechowywane jest to, co wysyłasz, i przekazywane nam. Co się z tym dzieje i jak długo, opisano tutaj:',
    privacyAskTitle: 'Zapytaj nas',
    privacyAskBody: 'Napisz lub zadzwoń — powiemy, co o Tobie mamy, albo to usuniemy.',
    privacyOwnTitle: 'O nas',
  },
  es: {
    skipToContent: "Ir al contenido",
    required: "Obligatorio",
    privacy: "Usamos lo que nos envía solo para responderle.",
    sending: "Enviando…",
    success: "Gracias — nos pondremos en contacto con usted.",
    error: "No se ha podido enviar. Inténtelo de nuevo o llámenos.",
    invalidName: "Indique, por favor, cómo podemos dirigirnos a usted.",
    invalidContact: "Deje, por favor, un número de teléfono o un correo electrónico.",
    invalidMessage: "Escriba, por favor, unas palabras sobre lo que necesita.",
    demoNote: "Esto es una vista previa: el formulario aún no envía nada.",
    privacyTitle: "Privacidad",
    privacyIntro: "Esta página explica qué ocurre con lo que usted envía a través del formulario de este sitio web. Está escrita para leerse, no para aceptarse.",
    privacyFormTitle: "Cuando nos escribe",
    privacyFormBody: "Recibimos su nombre, la forma de contacto que nos indicó — un número de teléfono, un correo electrónico o ambos — y lo que escribió. Nada más: ni su ubicación, ni las páginas que miró, ni nada que le identifique entre una visita y otra.",
    privacyWhoTitle: "Quién más lo ve",
    privacyWhoBody: "Este sitio web funciona sobre jtakeit, que guarda lo que usted envía y nos lo pasa. Qué hacen con ello, y durante cuánto tiempo, está explicado aquí:",
    privacyAskTitle: "Pregúntenos",
    privacyAskBody: "Escríbanos o llámenos y le diremos qué guardamos sobre usted, o lo borraremos.",
    privacyOwnTitle: "Sobre nosotros",
  },
  it: {
    skipToContent: "Vai al contenuto",
    required: "Obbligatorio",
    privacy: "Usiamo ciò che ci invia solo per risponderLe.",
    sending: "Invio…",
    success: "Grazie: La contatteremo.",
    error: "Non è stato inviato. Riprovi, o ci chiami.",
    invalidName: "Indichi un nome con cui chiamarLa.",
    invalidContact: "Lasci un numero di telefono o un indirizzo email.",
    invalidMessage: "Scriva qualche parola su ciò di cui ha bisogno.",
    demoNote: "Questa è un'anteprima: il modulo non invia ancora nulla.",
    privacyTitle: "Privacy",
    privacyIntro: "Questa pagina spiega cosa succede a ciò che invia tramite il modulo di questo sito. È scritta per essere letta, non per essere accettata.",
    privacyFormTitle: "Quando ci scrive",
    privacyFormBody: "Riceviamo il Suo nome, il modo in cui ci ha chiesto di contattarLa — un numero di telefono, un indirizzo email, o entrambi — e ciò che ha scritto. Nient'altro: nessuna posizione, niente sulle pagine che ha guardato, e niente che La riconosca tra una visita e l'altra.",
    privacyWhoTitle: "Chi altro lo vede",
    privacyWhoBody: "Questo sito funziona su jtakeit, che conserva ciò che invia e ce lo trasmette. Cosa ne fanno, e per quanto tempo, è spiegato qui:",
    privacyAskTitle: "Chiederci",
    privacyAskBody: "Ci scriva o ci chiami: Le diremo cosa conserviamo su di Lei, o lo cancelleremo.",
    privacyOwnTitle: "Chi siamo",
  },
  pt: {
    skipToContent: "Saltar para o conteúdo",
    required: "Obrigatório",
    privacy: "Usamos o que nos envia apenas para lhe responder.",
    sending: "A enviar…",
    success: "Obrigado — entraremos em contacto consigo.",
    error: "Não foi possível enviar. Tente de novo ou ligue-nos.",
    invalidName: "Indique um nome pelo qual o possamos tratar.",
    invalidContact: "Deixe um número de telefone ou um endereço de e-mail.",
    invalidMessage: "Escreva algumas palavras sobre o que precisa.",
    demoNote: "Isto é uma pré-visualização — o formulário ainda não envia nada.",
    privacyTitle: "Privacidade",
    privacyIntro: "Esta página explica o que acontece ao que envia pelo formulário deste site. Foi escrita para ser lida, não para ser aceite.",
    privacyFormTitle: "Quando nos escreve",
    privacyFormBody: "Recebemos o seu nome, a forma de contacto que nos deixou — um número de telefone, um endereço de e-mail ou ambos — e o que escreveu. Nada mais: nem a localização, nem as páginas que viu, nem nada que o identifique entre visitas.",
    privacyWhoTitle: "Quem mais o vê",
    privacyWhoBody: "Este site funciona na jtakeit, que guarda o que envia e no-lo entrega. O que fazem com isso, e por quanto tempo, está descrito aqui:",
    privacyAskTitle: "Perguntar-nos",
    privacyAskBody: "Escreva ou ligue, e dizemos-lhe o que guardamos sobre si ou apagamo-lo.",
    privacyOwnTitle: "Sobre nós",
  },
  fr: {
    skipToContent: "Aller au contenu",
    required: "Obligatoire",
    privacy: "Nous n’utilisons ce que vous envoyez que pour vous répondre.",
    sending: "Envoi…",
    success: "Merci — nous vous recontactons.",
    error: "L’envoi n’a pas fonctionné. Réessayez, ou appelez-nous.",
    invalidName: "Indiquez un nom par lequel nous pouvons vous appeler.",
    invalidContact: "Laissez un numéro de téléphone ou une adresse e-mail.",
    invalidMessage: "Écrivez quelques mots sur ce dont vous avez besoin.",
    demoNote: "Ceci est un aperçu — le formulaire n’envoie encore rien.",
    privacyTitle: "Confidentialité",
    privacyIntro: "Cette page dit ce qu’il advient de ce que vous envoyez par le formulaire de ce site. Elle est écrite pour être lue, pas pour être acceptée.",
    privacyFormTitle: "Quand vous nous écrivez",
    privacyFormBody: "Nous recevons votre nom, le moyen par lequel vous avez demandé à être joint — un numéro de téléphone, une adresse e-mail, ou les deux — et ce que vous avez écrit. Rien d’autre : pas de localisation, rien sur les pages que vous avez consultées, et rien qui vous identifie d’une visite à l’autre.",
    privacyWhoTitle: "Qui d’autre le voit",
    privacyWhoBody: "Ce site fonctionne sur jtakeit, qui conserve ce que vous envoyez et nous le transmet. Ce qu’ils en font, et pendant combien de temps, est décrit ici :",
    privacyAskTitle: "Nous interroger",
    privacyAskBody: "Écrivez ou appelez, et nous vous dirons ce que nous détenons sur vous, ou l’effacerons.",
    privacyOwnTitle: "À propos de nous",
  },
};

const LOCALE_MAP = {
  uk: { lang: 'uk', og: 'uk_UA', region: 'UA', ui: 'uk' },
  ru: { lang: 'ru', og: 'ru_RU', region: 'UA', ui: 'ru' },
  en: { lang: 'en', og: 'en_GB', region: 'GB', ui: 'en' },
  de: { lang: 'de', og: 'de_DE', region: 'DE', ui: 'de' },
  'de-CH': { lang: 'de-CH', og: 'de_CH', region: 'CH', ui: 'de' },
  'de-AT': { lang: 'de-AT', og: 'de_AT', region: 'AT', ui: 'de' },
  pl: { lang: 'pl', og: 'pl_PL', region: 'PL', ui: 'pl' },
  es: { lang: 'es', og: 'es_ES', region: 'ES', ui: 'es' },
  it: { lang: 'it', og: 'it_IT', region: 'IT', ui: 'it' },
  'it-CH': { lang: 'it-CH', og: 'it_CH', region: 'CH', ui: 'it' },
  pt: { lang: 'pt', og: 'pt_PT', region: 'PT', ui: 'pt' },
  fr: { lang: 'fr', og: 'fr_FR', region: 'FR', ui: 'fr' },
  'fr-CH': { lang: 'fr-CH', og: 'fr_CH', region: 'CH', ui: 'fr' },
};

const BINARY = /\.(png|jpe?g|webp|avif|gif|ico|woff2?|pdf|zip)$/i;

export function usage() {
  return `jtk create <slug> [--name "The Business"] [--locale de-CH] [--vertical salon] [--kit <kind>|<file>] [--blog]
           [--schema-type LocalBusiness] [--out <dir>] [--no-git] [--force] [--dry-run]

  slug        lowercase letters, digits and dashes — the directory, and the name in package.json
  --locale    uk, ru, en, de, de-CH, de-AT, pl, es, it, it-CH, pt, fr, fr-CH; anything else falls back to English words
  --kit       a booking kit: its kind — hotel, car_rental, … — asked of the platform
              (GET /v1/kits/<kind>), or a file of its JSON; --kind <kind> is the same
  --api       the platform asked for a kit, ${API} by default (or JTK_API_URL)
  --blog      a blog: the post type and the collection turned on, its listing at /blog
              (docs/collections.md) — only when the brief asked for one
  --out       where to write; the slug under the current directory by default
  --no-git    do not run git init and the first commit`;
}

/**
 * A booking kit — read from a file or asked of the platform by its kind,
 * checked, and (below) its `jtk/` files laid out — is `@jtakeit/kit`'s
 * (`@jtakeit/kit/kits`): the same for a site on any generator. What stays
 * here is the one thing that is this scaffold's: writing the kit's types,
 * collections and module into `src/content/blocks.ts`.
 */
/**
 * Lays a kit out in a fresh scaffold: its block types, collections and the
 * diary pointed at them into `src/content/blocks.ts`; its settings into
 * `jtk/bookings.json`, with `page` at the services' listing, where the form
 * is; its rates as entries in the site's language — the files the platform's
 * `kits.Files` describes, in the same shapes.
 *
 * Nothing it writes is a fact about the business: the rates carry no price and
 * the settings no zone and no hours. What the kit says to take from the brief
 * is printed at the end, for whoever runs this to do next.
 */
function layKit(target, kit, locale, die) {
  const written = [];
  const blocksFile = join(target, 'src', 'content', 'blocks.ts');
  let source = readFileSync(blocksFile, 'utf8');
  const COLLECTIONS = 'export const COLLECTIONS: Collection[] = [];';
  const MODULES = 'export const MODULES: Modules = {};';
  if (!source.includes(COLLECTIONS) || !source.includes(MODULES)) {
    die(`src/content/blocks.ts is not the scaffold's — lay the kit out by hand from its page`);
  }
  const literal = (value) => JSON.stringify(value, null, 2);
  source = source
    .replace(COLLECTIONS, [
      `// The booking kit «${kit.kind}», laid out by \`jtk create --kit\` from the`,
      `// platform's (jtakeit:///kits/${kit.kind}.md): its block types, its collections`,
      '// and, below, the diary pointed at them. Yours from here on: rename, add a',
      '// field, drop what this business has not got.',
      `BLOCKS.push(${kit.catalogue.blocks.map(literal).join(', ')});`,
      '',
      `export const COLLECTIONS: Collection[] = ${literal(kit.catalogue.collections)};`,
    ].join('\n'))
    .replace(MODULES, `export const MODULES: Modules = ${literal(kit.catalogue.modules)};`);
  writeFileSync(blocksFile, source, 'utf8');
  written.push(blocksFile);

  // The settings and the rates: the kit's files, as any repository gets them.
  written.push(...layKitFiles(target, kit, { locale, catalogue: false }));
  return written;
}

/**
 * The stand-in icon: the business's initials, light on dark, rounded — one or
 * two letters, the first of each of its first two words. The site's palette is
 * not decided yet when this is written, so it is ink and paper.
 * @param {string} name
 */
export function monogram(name) {
  const words = String(name).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const letters = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '·').slice(0, 1)).toLocaleUpperCase();
  const escaped = letters.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const size = letters.length > 1 ? 30 : 38;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" data-jtk-monogram="1">
  <rect width="64" height="64" rx="14" fill="#16130f"/>
  <text x="32" y="33" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="Georgia, 'Times New Roman', serif" font-size="${size}" font-weight="600">${escaped}</text>
</svg>
`;
}

export async function create(argv) {
  const has = (name) => argv.includes(`--${name}`);
  const flag = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? fallback : argv[i + 1];
  };
  const die = (message) => {
    console.error(`jtk create: ${message}`);
    process.exit(1);
  };

  const slug = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1]?.startsWith('--') !== true);
  if (!slug) die(`needs a slug\n\n${usage()}`);
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug)) {
    die(`slug "${slug}" must be 3–40 characters of a–z, 0–9 and dashes — the platform's create_site takes the same shape`);
  }

  const name = flag('name', slug);
  const locale = flag('locale', 'en');
  const vertical = flag('vertical', '');
  const target = resolve(flag('out', join(process.cwd(), slug)));
  const dryRun = has('dry-run');
  // A kit by its kind, asked of the platform, or a file of it.
  const asked = has('kit') ? flag('kit', '') : has('kind') ? flag('kind', '') : '';
  const api = flag('api', process.env.JTK_API_URL || API);
  let kit = null;
  if (asked !== '') {
    try {
      kit = await loadKit(asked, api);
    } catch (why) {
      die(why.message);
    }
  }

  // A file where the directory should be is said as that: it used to fall over
  // in readdirSync with a stack trace (7 October 2026, a /tmp/probe left
  // behind by something else).
  if (existsSync(target) && !statSync(target).isDirectory()) {
    die(`${target} is a file, not a directory — pass another --out, or move it away.`);
  }
  if (existsSync(target) && readdirSync(target).filter((f) => f !== '.git').length && !has('force')) {
    die(`${target} is not empty. Pass --force to scaffold into it anyway.`);
  }

  const loc = LOCALE_MAP[locale] ?? { lang: locale, og: locale.replace('-', '_'), region: 'GB', ui: 'en' };
  const ui = UI[loc.ui] ?? UI.en;
  const tokens = {
    SLUG: slug,
    NAME: name,
    LOCALE: locale,
    LANG: loc.lang,
    OG_LOCALE: loc.og,
    PHONE_REGION: loc.region,
    VERTICAL: vertical,
    // Where `astro dev` says it is until the platform gives the site an
    // address: every build the platform makes passes SITE_URL.
    PREVIEW_URL: 'http://localhost:4321/',
    SCHEMA_TYPE: flag('schema-type', 'LocalBusiness'),
    UI_SKIP_TO_CONTENT: ui.skipToContent,
    UI_REQUIRED: ui.required,
    UI_PRIVACY: ui.privacy,
    UI_SENDING: ui.sending,
    UI_SUCCESS: ui.success,
    UI_ERROR: ui.error,
    UI_INVALID_NAME: ui.invalidName,
    UI_INVALID_CONTACT: ui.invalidContact,
    UI_INVALID_MESSAGE: ui.invalidMessage,
    UI_DEMO_NOTE: ui.demoNote,
    UI_PRIVACY_TITLE: ui.privacyTitle,
    UI_PRIVACY_INTRO: ui.privacyIntro,
    UI_PRIVACY_FORM_TITLE: ui.privacyFormTitle,
    UI_PRIVACY_FORM_BODY: ui.privacyFormBody,
    UI_PRIVACY_WHO_TITLE: ui.privacyWhoTitle,
    UI_PRIVACY_WHO_BODY: ui.privacyWhoBody,
    UI_PRIVACY_ASK_TITLE: ui.privacyAskTitle,
    UI_PRIVACY_ASK_BODY: ui.privacyAskBody,
    UI_PRIVACY_OWN_TITLE: ui.privacyOwnTitle,
    YEAR: String(new Date().getFullYear()),
  };
  const substitute = (text) => text.replace(/\{\{([A-Z_]+)\}\}/g, (m, t) => (t in tokens ? tokens[t] : m));

  const written = [];
  function copyTree(from, to) {
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      const src = join(from, entry.name);
      const outName = entry.name === 'gitignore' ? '.gitignore' : entry.name;
      const dest = join(to, outName);
      if (entry.isDirectory()) {
        if (!dryRun) mkdirSync(dest, { recursive: true });
        copyTree(src, dest);
        continue;
      }
      if (BINARY.test(entry.name)) {
        if (!dryRun) cpSync(src, dest);
      } else if (!dryRun) {
        writeFileSync(dest, substitute(readFileSync(src, 'utf8')), 'utf8');
      }
      written.push(dest);
    }
  }

  if (!dryRun) mkdirSync(target, { recursive: true });
  copyTree(TEMPLATE, target);

  // The copy module is named for the site's language.
  const copyFrom = join(target, 'src', 'copy', 'LOCALE.ts');
  const copyTo = join(target, 'src', 'copy', `${locale}.ts`);
  if (!dryRun && existsSync(copyFrom)) renameSync(copyFrom, copyTo);

  if (kit && !dryRun) written.push(...layKit(target, kit, locale, die));

  // The icon. A site without one serves the browser's blank page in the tab
  // and three 404s for the links its layout writes — and nobody asked for it,
  // so nobody gave one (10 October 2026). Until the business's mark arrives,
  // a monogram from its name: the business's own letters, said back to the
  // developer and replaced by their logo (docs/pages.md, «The icon»). Marked,
  // so the platform's preflight can tell the stand-in from the real thing.
  if (!dryRun) {
    const icon = join(target, 'public', 'favicon.svg');
    if (!existsSync(icon)) {
      mkdirSync(join(target, 'public'), { recursive: true });
      writeFileSync(icon, monogram(name), 'utf8');
      written.push(icon);
    }
  }

  // A blog, where the brief asked for one: the two lines blocks.ts keeps
  // ready, written at its foot. The listing page builds itself once the
  // collection is there.
  if (has('blog') && !dryRun) {
    const blocksFile = join(target, 'src', 'content', 'blocks.ts');
    const source = readFileSync(blocksFile, 'utf8');
    if (!source.includes('BLOG_POST') || !source.includes('BLOG_COLLECTION')) {
      die('src/content/blocks.ts has no BLOG_POST and BLOG_COLLECTION to turn on — add the blog by hand (docs/collections.md)');
    }
    writeFileSync(
      blocksFile,
      `${source.trimEnd()}\n\n// The blog, turned on by \`jtk create --blog\` (docs/collections.md).\nBLOCKS.push(BLOG_POST);\nCOLLECTIONS.push(BLOG_COLLECTION);\n`,
      'utf8',
    );
    written.push(blocksFile);
  }

  if (!dryRun) {
    writeFileSync(
      join(target, 'README.md'),
      `# ${name}\n\nA site on jtakeit, scaffolded by @jtakeit/astro.\n\n` +
        '```bash\nnpm ci            # the lockfile is pinned; npm install would drift it\nnpm run dev\nnpm run check\nnpx @jtakeit/astro catalogue   # write jtk/catalogue.json and check it against the build\n```\n\n' +
        'What the platform expects of this repository is in `node_modules/@jtakeit/astro/docs/` once\n' +
        'the package is installed, and at https://github.com/jtakeit/jtakeit-kit.\n',
      'utf8',
    );
  }

  // The brief, as a document from the first answer rather than after the
  // last: its shape is the guide's (jtakeit:///guides/the-brief.md, «Where
  // it is written»), its «Done when» the guide's list and the kit's asks as
  // a task list the agent keeps — and the panel reads the file's fill as
  // progress (jtakeit-core, wiki/73), so a brief that exists early is a
  // row that says something early.
  if (!dryRun && !existsSync(join(target, 'BRIEF.md'))) {
    const asks = (kit?.ask ?? []).map((ask) => `- [ ] ${ask}`);
    writeFileSync(
      join(target, 'BRIEF.md'),
      `# ${name} — brief\n\nRead on <date>. Sources: developer <date>.\n\n` +
        '## In one sentence\n\n## The one action\n\n## Facts\n| Fact | Value | Source |\n| --- | --- | --- |\n\n' +
        `## Bookings\n${kit ? `The kit: ${kit.kind}, whole — or what was taken out, under Decisions.\n| Asked | Answer | Source |\n| --- | --- | --- |\n| Default | Confirmed / changed to | Source |\n| --- | --- | --- |\n` : ''}\n` +
        '## Decisions\n\n## Open — NEEDS CLIENT\n\n## Done when\n' +
        [
          '- [ ] every fact has a source, and every gap is NEEDS CLIENT',
          '- [ ] the kit is taken whole, or each thing taken out is under Decisions',
          '- [ ] every default has been said back and answered',
          '- [ ] the icon: the business\'s mark, or the monogram said back and accepted',
          '- [ ] the developer has read the brief and said yes',
          ...asks,
        ].join('\n') + '\n',
      'utf8',
    );
    written.push(join(target, 'BRIEF.md'));
  }

  if (dryRun) {
    console.log(`Would write ${written.length} files into ${target}:`);
    for (const f of written) console.log(`  ${relative(target, f)}`);
    return;
  }

  if (!has('no-git')) {
    const git = (...args) => execFileSync('git', args, { cwd: target, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!existsSync(join(target, '.git'))) git('init', '-q', '-b', 'main');
    git('add', '-A');
    try {
      git('commit', '-q', '-m', `scaffold: ${name} (@jtakeit/astro)`);
    } catch {
      // Nothing to commit, or no identity configured: the files are there either way.
    }
  }

  console.log(`${written.length} files written into ${relative(process.cwd(), target) || '.'}`);
  console.log('\nNext:');
  console.log(`  cd ${relative(process.cwd(), target) || '.'} && npm ci && npm run dev`);
  console.log('  edit src/content/blocks.ts, then: npx @jtakeit/astro catalogue');
  console.log('  push the repository, then create_site and attach_repo on the platform');
  if (kit) {
    console.log(`\nThe «${kit.kind}» kit is laid out. Ask, never make up:`);
    for (const line of kit.ask ?? []) console.log(`  - ${line}`);
    // The kit's other list — what it chose for the business, to be said back
    // and confirmed — is made from its settings on the platform's side.
    console.log(`What the kit chose for the business — say each back and get a yes: jtakeit:///kits/${kit.kind}.md, «Taken by default».`);
    console.log('The kit is laid out whole: anything taken out of it is said to the developer. The conversation: jtakeit:///guides/the-brief.md');
  }
}
