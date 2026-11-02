/**
 * The words of the photo control on the enquiry form, in the languages sites
 * are built in — carried by the kit, so a form that declares `photos` works on
 * a site scaffolded before the control existed, with no strings to add.
 *
 * A site that wants its own words passes them in the form's `copy`
 * (`photosLabel`, `photosNote`, …); these are what is drawn otherwise.
 *
 * `{n}` is the number the form declared. `privacy` is the sentence the site's
 * privacy page says about them — the platform's part of it, which the
 * business's notice must carry when its form takes pictures.
 */

/** @typedef {{ label: string; note: string; remove: string; tooMany: string; tooLarge: string; notPicture: string; failed: string; privacy: string }} PhotoWords */

/** @type {Record<string, PhotoWords>} */
export const PHOTO_WORDS = {
  en: {
    label: 'Photos (up to {n})',
    note: 'Only photos you have the rights to — and if people are in them, with their consent. They are kept with your enquiry.',
    remove: 'Remove',
    tooMany: 'At most {n} photos.',
    tooLarge: 'A photo is larger than 10 MB.',
    notPicture: 'Only JPEG, PNG or WebP pictures.',
    failed: 'A photo could not be sent. Try again.',
    privacy: 'Photos you attach to an enquiry are saved again without the location and camera details a phone writes into them, kept privately in the EU, shown only to us, and deleted with the enquiry.',
  },
  de: {
    label: 'Fotos (bis zu {n})',
    note: 'Nur Fotos, an denen Sie die Rechte haben — und sind Personen darauf, mit deren Einverständnis. Sie werden mit Ihrer Anfrage aufbewahrt.',
    remove: 'Entfernen',
    tooMany: 'Höchstens {n} Fotos.',
    tooLarge: 'Ein Foto ist grösser als 10 MB.',
    notPicture: 'Nur Bilder im Format JPEG, PNG oder WebP.',
    failed: 'Ein Foto konnte nicht gesendet werden. Versuchen Sie es noch einmal.',
    privacy: 'Fotos, die Sie einer Anfrage beifügen, werden ohne die Standort- und Kameradaten, die ein Telefon hineinschreibt, neu gespeichert, vertraulich in der EU aufbewahrt, nur uns gezeigt und mit der Anfrage gelöscht.',
  },
  fr: {
    label: 'Photos (jusqu’à {n})',
    note: 'Uniquement des photos dont vous avez les droits — et si des personnes y figurent, avec leur accord. Elles sont conservées avec votre demande.',
    remove: 'Retirer',
    tooMany: '{n} photos au maximum.',
    tooLarge: 'Une photo dépasse 10 Mo.',
    notPicture: 'Uniquement des images JPEG, PNG ou WebP.',
    failed: 'Une photo n’a pas pu être envoyée. Réessayez.',
    privacy: 'Les photos jointes à une demande sont réenregistrées sans la position ni les données d’appareil qu’un téléphone y inscrit, conservées de façon confidentielle dans l’UE, montrées à nous seuls et supprimées avec la demande.',
  },
  it: {
    label: 'Foto (fino a {n})',
    note: 'Solo foto di cui ha i diritti — e se ritraggono persone, con il loro consenso. Vengono conservate con la Sua richiesta.',
    remove: 'Rimuovi',
    tooMany: 'Al massimo {n} foto.',
    tooLarge: 'Una foto supera i 10 MB.',
    notPicture: 'Solo immagini JPEG, PNG o WebP.',
    failed: 'Non è stato possibile inviare una foto. Riprovi.',
    privacy: 'Le foto allegate a una richiesta vengono salvate di nuovo senza la posizione e i dati della fotocamera che un telefono vi scrive, conservate in modo riservato nell’UE, mostrate solo a noi ed eliminate con la richiesta.',
  },
  es: {
    label: 'Fotos (hasta {n})',
    note: 'Solo fotos sobre las que tenga derechos — y si aparecen personas, con su consentimiento. Se guardan con su solicitud.',
    remove: 'Quitar',
    tooMany: 'Como máximo {n} fotos.',
    tooLarge: 'Una foto supera los 10 MB.',
    notPicture: 'Solo imágenes JPEG, PNG o WebP.',
    failed: 'No se pudo enviar una foto. Inténtelo de nuevo.',
    privacy: 'Las fotos que adjunte a una solicitud se guardan de nuevo sin la ubicación ni los datos de la cámara que un teléfono escribe en ellas, se conservan de forma confidencial en la UE, solo las vemos nosotros y se eliminan con la solicitud.',
  },
  pt: {
    label: 'Fotografias (até {n})',
    note: 'Apenas fotografias sobre as quais tenha direitos — e, se nelas aparecerem pessoas, com o seu consentimento. São guardadas com o seu pedido.',
    remove: 'Remover',
    tooMany: 'No máximo {n} fotografias.',
    tooLarge: 'Uma fotografia tem mais de 10 MB.',
    notPicture: 'Apenas imagens JPEG, PNG ou WebP.',
    failed: 'Não foi possível enviar uma fotografia. Tente novamente.',
    privacy: 'As fotografias que juntar a um pedido são guardadas de novo sem a localização e os dados da câmara que um telemóvel nelas escreve, mantidas de forma confidencial na UE, mostradas apenas a nós e apagadas com o pedido.',
  },
  uk: {
    label: 'Фото (до {n})',
    note: 'Лише фото, на які у вас є права, — а якщо на них люди, то з їхньої згоди. Вони зберігаються разом із вашою заявкою.',
    remove: 'Прибрати',
    tooMany: 'Не більше {n} фото.',
    tooLarge: 'Фото більше за 10 МБ.',
    notPicture: 'Лише зображення JPEG, PNG або WebP.',
    failed: 'Не вдалося надіслати фото. Спробуйте ще раз.',
    privacy: 'Фото, які ви додаєте до заявки, зберігаються наново — без геолокації та даних камери, які записує телефон, — конфіденційно в ЄС, показуються лише нам і видаляються разом із заявкою.',
  },
  ru: {
    label: 'Фото (до {n})',
    note: 'Только фото, на которые у вас есть права, — а если на них люди, то с их согласия. Они хранятся вместе с вашей заявкой.',
    remove: 'Убрать',
    tooMany: 'Не больше {n} фото.',
    tooLarge: 'Фото больше 10 МБ.',
    notPicture: 'Только изображения JPEG, PNG или WebP.',
    failed: 'Не удалось отправить фото. Попробуйте ещё раз.',
    privacy: 'Фото, которые вы прикладываете к заявке, сохраняются заново — без геолокации и данных камеры, которые записывает телефон, — конфиденциально в ЕС, показываются только нам и удаляются вместе с заявкой.',
  },
};

/** The most photographs one enquiry carries — the platform's PhotosMax. */
export const PHOTOS_MAX = 7;

/** The largest picture taken — the platform's upload limit. */
export const PHOTO_BYTES_MAX = 10 * 1024 * 1024;

/** The picture types the platform takes. */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * The words for a language — `de-CH` reads `de`, an unknown one English.
 * @param {string} [lang]
 * @returns {PhotoWords}
 */
export function photoWords(lang = 'en') {
  const base = String(lang).toLowerCase().split(/[-_]/)[0] ?? 'en';
  return PHOTO_WORDS[base] ?? PHOTO_WORDS.en;
}
