export interface Ask {
  key: string;
  label: string;
  /**
   * Where the words over the field come from, when the site keeps them in
   * its content (a `<key>_label` field of the collecting block, say) and
   * the owner may tap them. Without it the label is drawn fixed, as the
   * catalogue declared it.
   */
  path?: string;
  kind: string;
  required?: boolean;
  max?: number;
  min?: number;
  options?: { value: string; label: string }[];
}

export interface LeadCopy {
  title?: string;
  lead?: string;
  name?: string;
  contact?: string;
  message?: string;
  requiredNote?: string;
  submit?: string;
  sending?: string;
  success?: string;
  error?: string;
  invalidName?: string;
  invalidContact?: string;
  /** The photo control's words; the kit's own in the page's language when absent. `{n}` is the number declared. */
  photosLabel?: string;
  photosNote?: string;
  photosRemove?: string;
  photosTooMany?: string;
  photosTooLarge?: string;
  photosNotPicture?: string;
  photosFailed?: string;
  [other: string]: string | undefined;
}

export interface LeadPaths {
  title?: string;
  lead?: string;
  name_label?: string;
  contact_label?: string;
  message_label?: string;
  required_note?: string;
  cta_label?: string;
}

export interface LeadFormProps {
  /** Where `/api/lead` is from this page. */
  action: string;
  copy: LeadCopy;
  asks?: Ask[];
  paths?: LeadPaths;
  /** The element around the form, `jtk-lead`; `''` for none. */
  tag?: string;
  /** How many photographs the form takes, 1 to 7 — the collecting block's `photos`. Absent is none. */
  photos?: number;
  /** The page's language, for the photo control's words, and for the labels and the button where `copy` leaves them empty (`leadWords`). */
  lang?: string;
}

/** The form's own labels and its button, said where the collecting block leaves its words empty. */
export interface LeadWords {
  name: string;
  contact: string;
  message: string;
  submit: string;
}
/** The kit's words, by language: en, de, fr, it, es, pt, uk, ru. */
export const LEAD_WORDS: Record<string, LeadWords>;
/** The words for a language — `de-CH` reads `de`, an unknown one English. */
export function leadWords(lang?: string): LeadWords;

export function inputType(kind: string): 'number' | 'tel' | 'email' | 'url' | 'date' | 'time' | 'text';
/** The enquiry form as HTML, wrapped in `<jtk-lead>`. */
export function renderLeadForm(props: LeadFormProps): string;

export interface PhotoWords {
  label: string;
  note: string;
  remove: string;
  tooMany: string;
  tooLarge: string;
  notPicture: string;
  failed: string;
  /** The sentence a site's privacy page says about the photographs. */
  privacy: string;
}
/** The photo control's words for a language (`de-CH` reads `de`); English otherwise. */
export function photoWords(lang?: string): PhotoWords;
export const PHOTOS_MAX: number;
