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
}

export function inputType(kind: string): 'number' | 'tel' | 'email' | 'url' | 'date' | 'time' | 'text';
/** The enquiry form as HTML, wrapped in `<jtk-lead>`. */
export function renderLeadForm(props: LeadFormProps): string;
