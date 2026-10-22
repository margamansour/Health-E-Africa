import { GROUPS } from "@/domain/allergy";

/** Things people are commonly allergic to, besides the medicine groups in domain/allergy. */
const OTHER_ALLERGENS = [
  // Medicines
  "metronidazole", "flagyl", "chloroquine", "quinine", "artemether", "coartem", "fansidar", "carbamazepine", "phenytoin",
  "lamotrigine", "allopurinol", "nevirapine", "efavirenz", "abacavir", "dolutegravir", "isoniazid", "rifampicin", "streptomycin",
  "gentamicin", "vancomycin", "clindamycin", "doxycycline", "tetracycline", "nitrofurantoin", "trimethoprim", "paracetamol",
  "metformin", "heparin", "insulin", "iodine", "contrast", "x-ray dye", "anaesthetic", "lidocaine", "lignocaine", "chlorhexidine",
  "latex", "plaster", "adhesive", "elastoplast", "antibiotics", "vaccine", "egg protein", "statins", "aspirin", "nsaids",
  // Foods
  "peanut", "peanuts", "nuts", "tree nuts", "groundnuts", "shellfish", "prawns", "fish", "egg", "eggs", "milk", "dairy", "lactose",
  "wheat", "gluten", "soy", "soya", "sesame", "strawberries", "tomatoes", "beef", "pork", "chicken",
  // Environment and stings
  "dust", "dust mites", "house dust mite", "pollen", "grass", "hay fever", "mould", "mold", "bee sting", "bee stings", "bees",
  "wasp", "wasps", "insect stings", "insect bites", "cats", "cat dander", "dogs", "animal dander", "feathers", "nickel", "perfume",
];

/** Word endings shared by medicine families (e.g. amoxi-cillin, cipro-floxacin, ibu-profen). */
const DRUG_FORM = /(cillin|ceph|cef[a-z]+|mycin|micin|floxacin|oxacin|cycline|sulf|sulph|profen|fenac|azole|olol|pril|sartan|statin|caine|vir|thiazide|semide|dipine|triptan|prazole|tidine|zepam|azepam|codone|morphine|done|xicam|coxib)/i;

/** Words that show a line is a heading, instruction or note rather than a substance. */
const NOT_ALLERGEN =
  /\b(action|actions|gp|plan|review|refer\w*|follow|please|patient|doctor|dr|nurse|clinic|hospital|result|results|history|note|notes|advice|advised|discharge\w*|request\w*|to do|todo|check|monitor\w*|repeat|continue|start|stop|appointment|weeks?|days?|months?|examination|investigation\w*|diagnos\w*|impression|summary|signature|signed|regards|date|tel|phone|email|address|current|medications?|medicines|prescription|none|nil|unknown|not known|nka|nkda)\b/i;

const KNOWN = [...new Set([...Object.keys(GROUPS), ...Object.values(GROUPS).flat(), ...OTHER_ALLERGENS])];

/** Remove "allergic to", "allergy" and similar wording around the substance. */
export function cleanSubstance(s: string): string {
  return s
    .replace(/^(known\s+)?(drug\s+)?(allerg(y|ies|ic)\s*(to|:)?|sensitivity to|intoleran(ce|t) (to|of))\s*/i, "")
    .replace(/\s+(allergy|allergies|sensitivity|intolerance)$/i, "")
    .replace(/[.,;:]+$/, "")
    .trim();
}

/** True when the text names something a person can be allergic to (a medicine, food, sting, material…). */
export function isAllergen(substance: string): boolean {
  const s = cleanSubstance(substance).toLowerCase();
  if (s.length < 3 || s.split(/\s+/).length > 4) return false;
  if (NOT_ALLERGEN.test(s)) return false;
  if (KNOWN.some((k) => new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(s))) return true;
  // An unlisted medicine name: one or two words with a medicine-family ending.
  return s.split(/\s+/).length <= 2 && /^[a-z][a-z\- ]+$/.test(s) && DRUG_FORM.test(s);
}

/** True when a saved allergy was clearly not a substance (e.g. "Actions for GP"). Unknown words are kept, to be safe. */
export function isClearlyNotAllergen(substance: string): boolean {
  return NOT_ALLERGEN.test(cleanSubstance(substance).toLowerCase());
}
