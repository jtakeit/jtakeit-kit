/**
 * `jtk create` — scaffold a site for jtakeit.
 *
 * Copies the template, fills in the tokens, and stops. It does not decide what
 * the site looks like: the template is a working Astro project with the
 * platform's contract in it — the schema derived from `src/content/blocks.ts`,
 * every editable field annotated through the kit's door, the lead form posting
 * to `/api/lead`, the flags read as `import.meta.env` — and every component in
 * it is yours to replace.
 *
 *   npx @jtakeit/astro create <slug> --name "The Business" --locale de-CH
 *   npx @jtakeit/astro create <slug> --out ./sites/<slug> --schema-type HairSalon
 *   npx @jtakeit/astro create <slug> --locale de-CH --locales en,fr   a site in three languages
 *
 * The slug becomes the directory and the package name; the site's address on
 * the platform comes from `create_site`, not from here.
 *
 * ── which contract ──────────────────────────────────────────────────────────
 *
 * Contract 3 by default (jtakeit-core wiki/98; the owner, 12 November 2026):
 * `jtk/schema.json`, written by `jtk schema` from a declaration that says
 * `CONTRACT = 3`; pages under `jtk/pages/`, entries under `jtk/entries/`, the
 * business's facts in `jtk/shared.json`, a module's settings at
 * `jtk/modules/<module>.json`; no `jtk/catalogue.json`. The template is one
 * for both contracts — its pages read through the kit's door — but for the
 * files that are a contract's own: contract 2's stay where they always were
 * (`src/content/blocks.ts`, `jtk/content/`), and contract 3's are laid from
 * `template/contract-3/` in their place, written for contract 3 directly
 * rather than moved there by `jtk upgrade contract-3`, whose codemod needs the
 * site's TypeScript and whose words are the old contract's. A booking kit,
 * which the platform serves in contract 2's words, is put in contract 3's by
 * the same mapping the upgrade uses (`@jtakeit/kit/upgrade`), in memory,
 * before a file is written. `jtk/site.json` is the platform's: the currency
 * is given to `create_site`, and nothing here writes it.
 *
 * `--contract 2` lays out exactly what it always did — `jtk/catalogue.json`
 * by `jtk catalogue`, pages and entries under `jtk/content/` — in one
 * language, the others added by hand as docs/languages.md says. It is not
 * offered — not in `--help`, the next steps or the docs: a new site is
 * always laid out on the latest contract, and an older one exists only for
 * a site not moved yet (the owner, 12 November 2026). It stays for the
 * kit's own tests — the same tree as `jtk upgrade contract-3` makes
 * (test/create3.mjs), test/a11y.mjs — and for rehearsing a move.
 *
 * ── several languages (M3) ──────────────────────────────────────────────────
 *
 * Contract 3 keeps one document in the site's own language and, beside it, a
 * translation holding only words (jtakeit-core wiki/95, wiki/98 §4.4). So
 * `--locale de-CH --locales en` lays out what one language does, with
 * `LOCALES` saying the others in `src/content/blocks.ts`, and each other
 * language's words that are not content — the form's, the privacy page's —
 * in `src/copy/<locale>.ts`, in the kit's words for it (lib/copies.mjs, as
 * `npx @jtakeit/astro copy <locale>` writes one). Its pages are there from the
 * first build, in the original's words, marked, until somebody translates
 * them.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contractOf } from '@jtakeit/kit/content/node';
import { API, catalogueIn2, kitIn3, layKitFiles, loadKit } from '@jtakeit/kit/kits';
import { nameOfPage } from '@jtakeit/kit/upgrade';
import { ownListingsOf } from './upgrade.mjs';
import { seedFormWords, writeCopy } from './copies.mjs';
import { canonicalLocale } from '@jtakeit/kit/content';
import { SECTIONS as EXAMPLE_SECTIONS } from './units/units.mjs';
import { addUnit, layContent, layFiles, treeOf } from './units/index.mjs';

/** The looks `--look` knows: one, Brumy's, which the example is drawn in (jtakeit-core wiki/110 §2.4). */
export const LOOKS = ['brumy'];

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, '..', 'template');
/** Contract 3's own files, laid over the template in place of contract 2's (`CONTRACT_2_ONLY`). */
const CONTRACT_3 = 'contract-3';
/** The template's files that are contract 2's alone, by their path in it: a contract-3 site has others in their place. */
const CONTRACT_2_ONLY = new Set(['src/content/blocks.ts', 'jtk/content', 'src/components/LeadForm.astro']);

/**
 * The few sentences of the template's shared files that name contract 2's
 * files, said in contract 3's words for a contract-3 site — by the template's
 * path, each `[what it says, what a contract-3 site says]`. A contract-2 site
 * is given them as they are written. Every one must still be found, or create
 * says so: a sentence reworded in the template and not here would leave a
 * contract-3 site taught contract 2.
 */
const CONTRACT_3_WORDS = {
  gitignore: [
    ["# Assembled at build time by the platform's pipeline from jtk/content/*.json.", "# Assembled at build time by the platform's pipeline from the files under jtk/."],
    ['\njtk/content/**/media/\n', '\njtk/entries/**/media/\n'],
  ],
  'src/content.config.ts': [["`jtk/catalogue.json`'s and the content's", "`jtk/schema.json`'s and the content's"]],
  'src/lib/site.ts': [['The schema is `jtk/catalogue.json`, the file `npx @jtakeit/astro catalogue`', 'The schema is `jtk/schema.json`, the file `npx @jtakeit/astro schema`']],
  'src/lib/locale.ts': [['written into `jtk/catalogue.json`.', 'written into `jtk/schema.json`.']],
  'src/components/BookingForm.astro': [['`jtk/bookings.json`', '`jtk/modules/bookings.json`']],
  'src/components/OpeningHours.astro': [
    [
      " * Read through the kit's door (`site.module('bookings')`): the settings are\n * the document's `bookings_config` block, found by its type rather than by\n * being first. A repository nobody has published yet has no\n * `jtk/bookings.json`,",
      " * Read through the kit's door (`site.module('bookings')`): the settings are\n * the document's `settings`. A repository nobody has published yet has no\n * `jtk/modules/bookings.json`,",
    ],
    ['`jtk/bookings.json`', '`jtk/modules/bookings.json`'],
  ],
  'src/copy/LOCALE.ts': [
    [
      ' * `jtk/content/index.json` is committed with empty strings in it, and that\n * is deliberate: a fresh project must `npm run build` on a laptop the minute\n * `jtk create` finishes, and a page with nothing written draws nothing rather\n * than nothing at all. The first publish from the admin replaces it.',
      ' * `jtk/pages/index.json` is committed with its blocks and nothing written in\n * them, and that is deliberate: a fresh project must `npm run build` on a\n * laptop the minute `jtk create` finishes, and a page with nothing written\n * draws nothing rather than nothing at all. The first publish from the admin\n * replaces it.',
    ],
    [
      ' * `jtk/catalogue.json` — which blocks a site has, and what the door reads the\n * content by — is written from `src/content/blocks.ts` by `jtk create`, by the\n * dev server whenever that file is saved, and by `npx @jtakeit/astro\n * catalogue`, which is what to run before a commit.',
      ' * `jtk/schema.json` — which blocks a site has, and what the door reads the\n * content by — is written from `src/content/blocks.ts` by `jtk create`, by the\n * dev server whenever that file is saved, and by `npx @jtakeit/astro\n * schema`, which is what to run before a commit.',
    ],
  ],
};

/**
 * A shared file's text as a contract-3 site has it (`CONTRACT_3_WORDS`).
 * @param {string} path the file's path in the template
 * @param {string} text
 * @returns {string | { missing: string }}
 */
export function contract3Words(path, text) {
  let out = text;
  for (const [said, three] of CONTRACT_3_WORDS[path] ?? []) {
    if (!out.includes(said)) return { missing: said };
    out = out.replaceAll(said, three);
  }
  return out;
}

/**
 * What the form, the privacy page and a listing's few words say, in the site's own language.
 *
 * `askTopic`, `nameLabel`, `contactLabel`, `messageLabel` and `submit` are the
 * form's words a visitor reads, which on contract 3 are content: `jtk create`
 * and `jtk copy` write them into the form's block, in the site's language and
 * in each other language's translation (lib/copies.mjs, `seedFormWords`).
 * They are the words `@jtakeit/kit/lead`'s renderer stands in with where the
 * block leaves its own empty (`LEAD_WORDS`), and Polish besides.
 */
export const UI = {
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
    askTopic: 'What it is about',
    nameLabel: 'Name',
    contactLabel: 'Phone or email',
    messageLabel: 'Message',
    submit: 'Send',
    more: 'And {n} more',
    previous: 'Previous',
    next: 'Next',
    pageOf: 'Page {n} of {total}',
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
    askTopic: 'Про що йдеться',
    nameLabel: 'Імʼя',
    contactLabel: 'Телефон або пошта',
    messageLabel: 'Повідомлення',
    submit: 'Надіслати',
    more: 'І ще {n}',
    previous: 'Попередня',
    next: 'Наступна',
    pageOf: 'Сторінка {n} з {total}',
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
    askTopic: 'О чём речь',
    nameLabel: 'Имя',
    contactLabel: 'Телефон или почта',
    messageLabel: 'Сообщение',
    submit: 'Отправить',
    more: 'И ещё {n}',
    previous: 'Предыдущая',
    next: 'Следующая',
    pageOf: 'Страница {n} из {total}',
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
    askTopic: 'Worum es geht',
    nameLabel: 'Name',
    contactLabel: 'Telefon oder E-Mail',
    messageLabel: 'Nachricht',
    submit: 'Senden',
    more: 'Und {n} weitere',
    previous: 'Zurück',
    next: 'Weiter',
    pageOf: 'Seite {n} von {total}',
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
    askTopic: 'Czego dotyczy',
    nameLabel: 'Imię',
    contactLabel: 'Telefon lub e-mail',
    messageLabel: 'Wiadomość',
    submit: 'Wyślij',
    more: 'I jeszcze {n}',
    previous: 'Poprzednia',
    next: 'Następna',
    pageOf: 'Strona {n} z {total}',
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
    askTopic: "De qué se trata",
    nameLabel: "Nombre",
    contactLabel: "Teléfono o correo electrónico",
    messageLabel: "Mensaje",
    submit: "Enviar",
    more: "Y {n} más",
    previous: "Anterior",
    next: "Siguiente",
    pageOf: "Página {n} de {total}",
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
    askTopic: "Di cosa si tratta",
    nameLabel: "Nome",
    contactLabel: "Telefono o email",
    messageLabel: "Messaggio",
    submit: "Invia",
    more: "E altri {n}",
    previous: "Precedente",
    next: "Successiva",
    pageOf: "Pagina {n} di {total}",
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
    askTopic: "De que se trata",
    nameLabel: "Nome",
    contactLabel: "Telefone ou e-mail",
    messageLabel: "Mensagem",
    submit: "Enviar",
    more: "E mais {n}",
    previous: "Anterior",
    next: "Seguinte",
    pageOf: "Página {n} de {total}",
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
    askTopic: "De quoi il s’agit",
    nameLabel: "Nom",
    contactLabel: "Téléphone ou e-mail",
    messageLabel: "Message",
    submit: "Envoyer",
    more: "Et {n} de plus",
    previous: "Précédente",
    next: "Suivante",
    pageOf: "Page {n} sur {total}",
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

export const LOCALE_MAP = {
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
           [--without team,testimonials] [--schema-type LocalBusiness] [--out <dir>] [--no-git] [--force] [--dry-run]

  slug        lowercase letters, digits and dashes — the directory, and the name in package.json
  --locale    the site's own language: uk, ru, en, de, de-CH, de-AT, pl, es, it, it-CH, pt, fr, fr-CH;
              anything else falls back to English words
  --locales   contract 3: its other languages, en,fr — each a translation beside every page
              and entry, its words that are not content written in src/copy/<locale>.ts;
              --locale de-CH,en says the same
  --kit       a booking kit: its kind — hotel, car_rental, … — asked of the platform
              (GET /v1/kits/<kind>), or a file of its JSON; --kind <kind> is the same
  --api       the platform asked for a kit, ${API} by default (or JTK_API_URL)
  --blog      a blog: the post type and the collection turned on, its listing at /blog
              (docs/collections.md) — only when the brief asked for one
  --without   sections of the example the brief does not name: hero, values, services,
              gallery, team, testimonials, questions, contact (docs/units.md)
  --out       where to write; the slug under the current directory by default
  --no-git    do not run git init and the first commit

  The site is an example in the design system of Brumy (brumy.ch), the company that
  makes jtakeit: eight sections, /services, privacy and imprint, header and footer,
  every word and photograph the example's until replaced. Say so; it may be kept,
  and is meant to be adapted (src/styles/tokens.css, docs/scaffold.md).

  The site is laid out on contract 3, the latest: jtk/schema.json, written by
  npx @jtakeit/astro schema; pages under jtk/pages, entries under jtk/entries, the business's
  facts in jtk/shared.json, a module's settings at jtk/modules/<module>.json (jtakeit-core
  wiki/98), and several languages as translations beside the originals.
  The currency is the site's setting: give it to create_site; jtk/site.json is the platform's.`;
}

/**
 * What comes after `jtk create`, in the platform's order — its
 * jtakeit:///guides/start.md and its MCP server's instructions: the site made
 * first, the dev session open before a line is written, the tree judged
 * before the push, and the first push where the copy says — no GitHub remote,
 * the code on jtakeit. A from-scratch rehearsal on staging was told «push the
 * repository, then create_site and attach_repo» here, the order from
 * before push_code (12 November 2026). Printed at the end, and written into the
 * scaffold's README in the same words.
 *
 * @param {2 | 3} contract
 * @param {string} dev  how the dev server is started from where it is read
 */
function platformOrder(contract, dev) {
  const tool = contract === 2 ? 'catalogue' : 'schema';
  return [
    "`create_site`, if the site is not made yet — with the brief's currency; `jtk/site.json` is the platform's",
    `\`${dev}\`, then \`open_dev_session\` with its address and the \`run\` command its answer gives — before writing a line; tell the developer the localhost`,
    `edit \`src/content/blocks.ts\`, then: \`npx @jtakeit/astro ${tool}\``,
    `\`validate_schema\` with \`jtk/${tool}.json\`, the \`jtk/\` files and the \`site_id\` — before the push`,
    "the code: no GitHub remote in the copy → `push_code`, then `npx @jtakeit/astro push '<url>'`; " +
      'a GitHub remote → ask the developer once, then our GitHub App on it (a person installs it) and `attach_repo` — `import_branch` after a later push',
    '`commit_and_build` — nothing public; `get_build` until it settles; `preflight` before saying done',
  ];
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
 *
 * Contract 2's declaration, so the kit's in contract 2's words: a key only
 * contract 3 has — a person's name `"localized": false` — is left out
 * (`catalogueIn2`), since the platform refuses a contract-2 schema that
 * writes one; `layKit3` carries it over.
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
  const { blocks, collections, modules } = catalogueIn2(kit.catalogue);
  const literal = (value) => JSON.stringify(value, null, 2);
  source = source
    .replace(COLLECTIONS, [
      `// The booking kit «${kit.kind}», laid out by \`jtk create --kit\` from the`,
      `// platform's (jtakeit:///kits/${kit.kind}.md): its block types, its collections`,
      '// and, below, the diary pointed at them. Yours from here on: rename, add a',
      '// field, drop what this business has not got.',
      `BLOCKS.push(${blocks.map(literal).join(', ')});`,
      '',
      `export const COLLECTIONS: Collection[] = ${literal(collections)};`,
    ].join('\n'))
    .replace(MODULES, `export const MODULES: Modules = ${literal(modules)};`);
  writeFileSync(blocksFile, source, 'utf8');
  written.push(blocksFile);

  // The settings and the rates: the kit's files, as any repository gets them.
  written.push(...layKitFiles(target, kit, { locale, catalogue: false }));
  return written;
}

/**
 * Lays a kit out in a fresh contract-3 scaffold. The platform serves a kit in
 * contract 2's words, so it is put in contract 3's by the upgrade's own
 * mapping, in memory, before anything is written — `@jtakeit/kit/kits`'s
 * `kitIn3`, the one `jtkit apply` lays a kit into another generator's
 * `jtk/schema.json` by:
 *
 *   the declaration   its block types, collections and module, as `tablesOf`
 *                     says them — a reference `{ to }`, `does` one reference
 *                     to many, a collection's `route` and `shown_on`, the
 *                     counts a module reads `integer` — into src/content/blocks.ts
 *   the documents     its settings and its rates, laid out as contract 2's
 *                     files would be and moved by `documentsOf`: the settings
 *                     to jtk/modules/bookings.json, `{ v, settings }`; each rate
 *                     to jtk/entries/<collection>/<slug>.json with its id, its
 *                     rank and its values under `fields`, money as `{ minor }`;
 *                     the page the services are shown on, jtk/pages/<prefix>.json
 *
 * The same as `jtk create --contract 2 --kit` and then `jtk upgrade
 * contract-3` lays out, ids aside (test/create3.mjs holds the two equal), and
 * as `jtkit apply --kit` lays into an empty tree.
 *
 * @returns {{ written: string[]; questions: { what: string; where: string; ask: string }[] }}
 */
function layKit3(target, kit, locale, lang, die) {
  const written = [];
  const blocksFile = join(target, 'src', 'content', 'blocks.ts');
  let source = readFileSync(blocksFile, 'utf8');
  const COLLECTIONS = 'export const COLLECTIONS: Collection[] = [];';
  const MODULES = 'export const MODULES: Modules = {};';
  if (!source.includes(COLLECTIONS) || !source.includes(MODULES)) {
    die(`src/content/blocks.ts is not the scaffold's — lay the kit out by hand from its page`);
  }
  const laid = kitIn3(kit, { locale, lang, ownListings: ownListingsOf(target) });
  if (laid.refused) die(`the «${kit.kind}» kit cannot be put in contract 3's words: ${laid.refused}`);
  const { blocks, collections, modules } = laid;
  const literal = (value) => JSON.stringify(value, null, 2);
  source = source
    .replace(COLLECTIONS, [
      `// The booking kit «${kit.kind}», laid out by \`jtk create --kit\` from the`,
      `// platform's (jtakeit:///kits/${kit.kind}.md) in contract 3's words: its block`,
      '// types, its collections and, below, the diary pointed at them. Yours from',
      '// here on: rename, add a field, drop what this business has not got.',
      `BLOCKS.push(${blocks.map(literal).join(', ')});`,
      '',
      `export const COLLECTIONS: Collection[] = ${literal(collections)};`,
    ].join('\n'))
    .replace(MODULES, `export const MODULES: Modules = ${literal(modules)};`);
  writeFileSync(blocksFile, source, 'utf8');
  written.push(blocksFile);

  // The settings, the rates and the page the services are shown on.
  for (const [file, doc] of Object.entries(laid.write)) {
    const at = join(target, ...file.split('/').filter(Boolean));
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, `${literal(doc)}\n`, 'utf8');
    written.push(at);
  }
  return { written, questions: laid.questions };
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
  if (has('help') || argv.includes('-h')) {
    console.log(usage());
    return;
  }

  const slug = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1]?.startsWith('--') !== true);
  if (!slug) die(`needs a slug\n\n${usage()}`);
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug)) {
    die(`slug "${slug}" must be 3–40 characters of a–z, 0–9 and dashes — the platform's create_site takes the same shape`);
  }

  // Contract 3 unless asked for 2 (the owner, 12 November 2026).
  const asked3 = has('contract') ? flag('contract', '') : '3';
  if (asked3 !== '2' && asked3 !== '3') die(`--contract takes 3 (the default) or 2, not "${asked3 ?? ''}"`);
  const contract = Number(asked3);

  // The site's own language first, then the others. Contract 3 lays them
  // out as translations beside the originals (M3); contract 2 in one, the
  // others added by hand.
  const said = (names) => argv.flatMap((one, i) => (names.includes(one) ? String(argv[i + 1] ?? '').split(/[\s,;]+/) : [])).filter(Boolean);
  const own = said(['--locale']);
  const languages = [...new Set([...(own.length > 0 ? own : ['en']), ...said(['--locales', '--languages'])])];
  if (languages.length > 1 && contract === 2) {
    die(`the scaffold is laid out in one language on contract 2, and this asks for ${languages.join(', ')} — --locale ${languages[0]}, then the others as docs/languages.md says; or contract 3, the default, which lays them all out`);
  }
  // Each other language as the platform spells it (`fr-CH`), once, and never the site's own.
  const others = [];
  for (const one of languages.slice(1)) {
    const tag = canonicalLocale(one);
    if (tag === null) die(`--locales: «${one}» is not a language — two letters, or two and a region (fr-CH)`);
    if (tag !== canonicalLocale(languages[0]) && !others.includes(tag)) others.push(tag);
  }

  const name = flag('name', slug);
  const locale = languages[0];
  // The example site (wiki/110): every section, but those the brief left out.
  // `--bare` lays the template alone, as the scaffold was before the
  // example — the kit's own tests' and a move's rehearsal's, not offered.
  const bare = contract === 2 || has('bare');
  const without = said(['--without']).map((one) => one.toLowerCase());
  const sectionNames = EXAMPLE_SECTIONS.map((one) => one.name);
  for (const one of without) {
    if (!sectionNames.includes(one)) die(`--without: «${one}» is not a section of the example — ${sectionNames.join(', ')}`);
  }
  if (without.length > 0 && bare) die('--without takes sections of the example, and --bare lays none');
  const look = has('look') ? flag('look', '') : 'brumy';
  if (!LOOKS.includes(look)) die(`--look: «${look ?? ''}» is not a look the kit has — ${LOOKS.join(', ')}; the design is adapted from it (src/styles/tokens.css)`);
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
  // Not even with --force: a site is there. Laid over a contract-3 tree, the
  // scaffold writes a page without its id over one the platform knows, or
  // contract 2's files beside contract 3's; laid on contract 3 over a
  // contract-2 tree, jtk/schema.json beside jtk/catalogue.json — a tree the
  // platform refuses either way (wiki/98 §16).
  if (existsSync(target) && contractOf(target) === 3) {
    die(`${join(target, 'jtk', 'schema.json')} says contract 3: a site is laid out there already — scaffold into an empty directory.`);
  }
  if (existsSync(target) && contract === 3 && (existsSync(join(target, 'jtk', 'catalogue.json')) || existsSync(join(target, 'jtk', 'content')))) {
    die(
      `${join(target, 'jtk')} holds a contract-2 site (jtk/catalogue.json, jtk/content/), and contract 3's files beside it are a tree the platform refuses (wiki/98 §16) — ` +
        'scaffold into an empty directory, or move that site with npx @jtakeit/astro upgrade contract-3.',
    );
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
    UI_ASK_TOPIC: ui.askTopic,
    UI_MORE: ui.more,
    UI_PREVIOUS: ui.previous,
    UI_NEXT: ui.next,
    UI_PAGE_OF: ui.pageOf,
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
    // The home page's name, which contract 3 requires of a page (wiki/98 §4.1).
    HOME_NAME: nameOfPage({}, '/', loc.lang),
  };
  const substitute = (text) => text.replace(/\{\{([A-Z_]+)\}\}/g, (m, t) => (t in tokens ? tokens[t] : m));

  const written = [];
  /**
   * The template's files under `from`, by their path in it (`at`), into `to`:
   * every one but contract 3's own, and on contract 3 but contract 2's own,
   * whose places contract 3's take; a shared file in the contract's words.
   */
  function copyTree(from, to, at = '', own3 = false) {
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      const path = at === '' ? entry.name : `${at}/${entry.name}`;
      if (!own3 && (path === CONTRACT_3 || (contract === 3 && CONTRACT_2_ONLY.has(path)))) continue;
      const src = join(from, entry.name);
      const outName = entry.name === 'gitignore' ? '.gitignore' : entry.name;
      const dest = join(to, outName);
      if (entry.isDirectory()) {
        if (!dryRun) mkdirSync(dest, { recursive: true });
        copyTree(src, dest, path, own3);
        continue;
      }
      if (BINARY.test(entry.name)) {
        if (!dryRun) cpSync(src, dest);
      } else if (!dryRun) {
        let text = substitute(readFileSync(src, 'utf8'));
        if (contract === 3 && !own3) {
          const three = contract3Words(path, text);
          if (typeof three !== 'string') die(`template/${path} no longer says «${three.missing.trim()}», which a contract-3 site is told in its own words — CONTRACT_3_WORDS in lib/create.mjs`);
          text = three;
        }
        writeFileSync(dest, text, 'utf8');
      }
      written.push(dest);
    }
  }

  if (!dryRun) mkdirSync(target, { recursive: true });
  copyTree(TEMPLATE, target);
  if (contract === 3) copyTree(join(TEMPLATE, CONTRACT_3), target, '', true);

  // The example's own files over the template's: its declaration, its look,
  // its header, footer and imprint (example/files/, lib/units/).
  if (!bare) {
    const tree = treeOf(target);
    layFiles(tree, substitute);
    if (dryRun) written.push(...[...tree.changed.keys()].map((one) => join(target, one)));
    else for (const file of tree.commit()) if (!written.includes(join(target, file))) written.push(join(target, file));
  }

  // The copy module is named for the site's language.
  const copyFrom = join(target, 'src', 'copy', 'LOCALE.ts');
  const copyTo = join(target, 'src', 'copy', `${locale}.ts`);
  if (!dryRun && existsSync(copyFrom)) renameSync(copyFrom, copyTo);

  // The other languages (contract 3): said in the declaration, and each
  // one's words that are not content written beside the site's own, in the
  // kit's words for it — as `npx @jtakeit/astro copy <locale>` writes them.
  const untold = [];
  if (!dryRun && others.length > 0) {
    const blocksFile = join(target, 'src', 'content', 'blocks.ts');
    const source = readFileSync(blocksFile, 'utf8');
    const none = 'export const LOCALES: string[] = [];';
    if (!source.includes(none)) die(`src/content/blocks.ts has no «${none}» to say ${others.join(', ')} in — template/contract-3`);
    writeFileSync(blocksFile, source.replace(none, `export const LOCALES: string[] = [${others.map((one) => `'${one}'`).join(', ')}];`), 'utf8');
    for (const tag of others) {
      const done = writeCopy(target, tag);
      if (done === 'written') written.push(join(target, 'src', 'copy', `${tag}.ts`));
      else untold.push(tag);
    }
  }

  // The example's words and photographs, section by section, in the site's
  // language and each other language the example is written in — the same
  // units `npx @jtakeit/astro add` lays one at a time. A booking kit brings
  // its own price list and people, so the example's `services` and `team`
  // give way to it.
  if (!bare && !dryRun) {
    const tree = treeOf(target);
    layContent(tree, name);
    const leftOut = new Set([...without, ...(kit ? ['services', 'team'] : [])]);
    for (const unit of EXAMPLE_SECTIONS) if (!leftOut.has(unit.name)) addUnit(tree, unit);
    for (const file of tree.commit()) if (!written.includes(join(target, file))) written.push(join(target, file));
  }

  let kitQuestions = [];
  if (kit && !dryRun && contract === 2) written.push(...layKit(target, kit, locale, die));
  if (kit && !dryRun && contract === 3) {
    const laid = layKit3(target, kit, locale, loc.lang, die);
    written.push(...laid.written);
    kitQuestions = laid.questions;
  }

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

  // The schema the pages render from: `jtk/catalogue.json`, written from
  // `src/content/blocks.ts` as `jtk catalogue --emit-only` writes it. The
  // kit's door reads the content by it (src/lib/site.ts), so a scaffold
  // without one would build a blog with no posts and a diary with no
  // services until somebody ran the tool — and this file's header has always
  // said the catalogue was there.
  if (!dryRun && contract === 2) {
    try {
      execFileSync(process.execPath, [join(HERE, '..', 'bin', 'jtk.mjs'), 'catalogue', '--emit-only', '--root', target], { stdio: 'pipe' });
      written.push(join(target, 'jtk', 'catalogue.json'));
    } catch (why) {
      console.error(`jtk create: jtk/catalogue.json was not written — run npx @jtakeit/astro catalogue in the site\n${String(why.stderr ?? why.message).trim()}`);
    }
  }
  // Contract 3's: `jtk/schema.json`, as `jtk schema --emit-only` writes it —
  // judged offline as the platform judges it, the home page given its id,
  // every block its `_key` where the file lacks one, a module the schema
  // turns on given its settings' file where it has none.
  if (!dryRun && contract === 3) {
    try {
      execFileSync(process.execPath, [join(HERE, '..', 'bin', 'jtk.mjs'), 'schema', '--emit-only', '--root', target], { stdio: 'pipe' });
      written.push(join(target, 'jtk', 'schema.json'));
    } catch (why) {
      console.error(`jtk create: jtk/schema.json was not written — run npx @jtakeit/astro schema in the site\n${String(`${why.stdout ?? ''}${why.stderr ?? ''}` || why.message).trim()}`);
    }
    // The form's words, content: the labels over its fields and questions and
    // its button, in the site's language on the home page and in each other
    // language's translation beside it, in the kit's words — tappable and
    // translatable like every other word on the page, once the home page has
    // the id a translation names it by (lib/copies.mjs).
    for (const file of seedFormWords(target).written) if (!written.includes(join(target, file))) written.push(join(target, file));
  }

  // The platform's order, as the end of this command prints it.
  const onThePlatform = `On the platform, in its order (\`jtakeit:///guides/start.md\`):\n\n${platformOrder(contract, 'npm ci && npm run dev').map((step, at) => `${at + 1}. ${step}\n`).join('')}\n`;
  if (!dryRun && contract === 2) {
    writeFileSync(
      join(target, 'README.md'),
      `# ${name}\n\nA site on jtakeit, scaffolded by @jtakeit/astro.\n\n` +
        '```bash\nnpm ci            # the lockfile is pinned; npm install would drift it\nnpm run dev\nnpm run check\nnpx @jtakeit/astro catalogue   # write jtk/catalogue.json and check it against the build\n```\n\n' +
        onThePlatform +
        'What the platform expects of this repository is in `node_modules/@jtakeit/astro/docs/` once\n' +
        'the package is installed, and at https://github.com/jtakeit/jtakeit-kit.\n',
      'utf8',
    );
  }
  if (!dryRun && contract === 3) {
    writeFileSync(
      join(target, 'README.md'),
      `# ${name}\n\nA site on jtakeit, scaffolded by @jtakeit/astro, on contract 3.\n\n` +
        '```bash\nnpm ci            # the lockfile is pinned; npm install would drift it\nnpm run dev\nnpm run check\nnpx @jtakeit/astro schema   # write jtk/schema.json and check it against the build\n```\n\n' +
        '```\n' +
        'src/content/blocks.ts                  what the owner may edit, declared (CONTRACT = 3)\n' +
        'jtk/schema.json                        written from it by npx @jtakeit/astro schema\n' +
        'jtk/pages/<path>.json                  a page, `/` as index.json\n' +
        'jtk/entries/<collection>/<slug>.json   an entry of a collection\n' +
        'jtk/shared.json                        the text on every page: the business\'s contacts\n' +
        'jtk/modules/<module>.json              a module\'s settings — the diary\'s, bookings.json\n' +
        '```\n\n' +
        '`jtk/site.json` is the platform\'s, written by its saves: the site\'s currency is given\n' +
        'once, to `create_site`. Another language is a translation beside each original\n' +
        '(`jtk/pages/index.en.json`), named in `LOCALES`, its words that are not content in\n' +
        '`src/copy/<locale>.ts` (`npx @jtakeit/astro copy <locale>`).\n\n' +
        onThePlatform +
        'What the platform expects of this repository is in `node_modules/@jtakeit/astro/docs/` once\n' +
        'the package is installed, and at https://github.com/jtakeit/jtakeit-kit.\n',
      'utf8',
    );
  }

  // The brief, as a document from the first answer rather than after the
  // last: its shape is the guide's (jtakeit:///guides/the-brief.md, «Where
  // it is written»), its «Done when» the guide's list and the kit's asks as
  // a task list the agent keeps — and the panel reads the file's fill as
  // progress, so a brief that exists early is a
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
          ...(bare
            ? []
            : [
                '- [ ] the design: adapted to this business, or the developer said to keep the example\'s look (Brumy\'s)',
                '- [ ] the sections: the ones the brief names kept, the others removed (npx @jtakeit/astro remove <section>)',
                '- [ ] nothing of the example\'s words or photographs left, or each one kept by the developer\'s say',
              ]),
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
  if (!bare) {
    console.log(
      '\nThe site is an example in the design system of Brumy (brumy.ch), the company that makes jtakeit —' +
        '\nsay so to the developer: it may be kept, and is meant to be adapted or redone for this business' +
        '\n(src/styles/tokens.css). Its words and photographs are the example\'s until replaced; keep the' +
        '\nsections the brief names (npx @jtakeit/astro units, then remove <section> / add <module>).',
    );
  }
  console.log('\nNext, in the platform\'s order (jtakeit:///guides/start.md):');
  platformOrder(contract, `cd ${relative(process.cwd(), target) || '.'} && npm ci && npm run dev`).forEach((step, at) => console.log(`  ${at + 1}. ${step.replaceAll('`', '')}`));
  if (contract === 3) {
    if (others.length > 0) console.log(`  ${others.join(', ')}: a translation beside each page and entry (docs/languages.md) — until then its pages say the original's words, marked`);
    for (const tag of untold) console.log(`  the kit has no words for ${tag}: write src/copy/${tag}.ts (copy src/copy/${locale}.ts and translate it)`);
  }
  if (kit) {
    console.log(`\nThe «${kit.kind}» kit is laid out. Ask, never make up:`);
    for (const line of kit.ask ?? []) console.log(`  - ${line}`);
    for (const one of kitQuestions) console.log(`  - ${one.ask}`);
    // The kit's other list — what it chose for the business, to be said back
    // and confirmed — is made from its settings on the platform's side.
    console.log(`What the kit chose for the business — say each back and get a yes: jtakeit:///kits/${kit.kind}.md, «Taken by default».`);
    console.log('The kit is laid out whole: anything taken out of it is said to the developer. The conversation: jtakeit:///guides/the-brief.md');
  }
}
