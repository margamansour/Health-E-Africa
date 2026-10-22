/**
 * Medicine-to-medicine interaction checks.
 *
 * Decision support only: a short list of well-known, clinically important interactions for
 * medicines commonly used in Kenya (HIV, TB and malaria treatment, blood pressure, diabetes,
 * blood thinners, painkillers, contraception). It is not complete. The pharmacist always checks.
 * Clinical content to be reviewed by a pharmacist before launch.
 */

export type Severity = "major" | "moderate";

/** Medicine groups → generic and common brand names (lower case). */
export const DRUG_GROUPS: Record<string, string[]> = {
  warfarin: ["warfarin", "coumadin", "marevan"],
  nsaid: ["ibuprofen", "brufen", "diclofenac", "voltaren", "naproxen", "mefenamic", "ponstan", "indomethacin", "piroxicam", "meloxicam", "celecoxib", "etoricoxib", "ketoprofen", "aceclofenac"],
  aspirin: ["aspirin", "disprin", "ecotrin", "cardiprin"],
  clopidogrel: ["clopidogrel", "plavix"],
  ssri: ["fluoxetine", "prozac", "sertraline", "zoloft", "citalopram", "escitalopram", "paroxetine"],
  tricyclic: ["amitriptyline", "imipramine", "clomipramine"],
  tramadol: ["tramadol", "tramal"],
  opioid: ["morphine", "codeine", "pethidine", "oxycodone", "tramadol", "tramal", "fentanyl", "methadone"],
  benzodiazepine: ["diazepam", "valium", "lorazepam", "alprazolam", "midazolam", "clonazepam", "bromazepam"],
  aceInhibitor: ["enalapril", "lisinopril", "captopril", "ramipril", "perindopril"],
  arb: ["losartan", "cozaar", "valsartan", "telmisartan", "irbesartan", "candesartan", "olmesartan"],
  potassiumSparing: ["spironolactone", "aldactone", "amiloride", "eplerenone"],
  potassium: ["potassium chloride", "slow-k", "sando-k", "potassium supplement"],
  thiazide: ["hydrochlorothiazide", "bendroflumethiazide", "indapamide", "chlorthalidone"],
  loopDiuretic: ["furosemide", "frusemide", "lasix", "torsemide"],
  betaBlocker: ["atenolol", "metoprolol", "bisoprolol", "carvedilol", "propranolol", "nebivolol"],
  rateCcb: ["verapamil", "diltiazem"],
  dihydropyridine: ["amlodipine", "norvasc", "nifedipine", "felodipine"],
  nitrate: ["isosorbide", "glyceryl trinitrate", "nitroglycerin", "gtn"],
  pde5: ["sildenafil", "viagra", "tadalafil", "cialis"],
  digoxin: ["digoxin", "lanoxin"],
  amiodarone: ["amiodarone", "cordarone"],
  simvastatin: ["simvastatin"],
  statin: ["simvastatin", "atorvastatin", "lipitor", "rosuvastatin", "crestor", "pravastatin"],
  metformin: ["metformin", "glucophage"],
  sulfonylurea: ["glibenclamide", "daonil", "gliclazide", "diamicron", "glimepiride", "amaryl", "glipizide"],
  insulin: ["insulin", "mixtard", "actrapid", "lantus", "novorapid", "humulin", "insulatard"],
  corticosteroid: ["prednisolone", "prednisone", "dexamethasone", "hydrocortisone", "methylprednisolone"],
  levothyroxine: ["levothyroxine", "eltroxin", "thyroxine"],
  mineral: ["ferrous", "iron", "calcium", "antacid", "magnesium", "aluminium hydroxide", "zinc", "gaviscon", "relcer"],
  ppi: ["omeprazole", "losec", "esomeprazole", "nexium", "pantoprazole", "lansoprazole", "rabeprazole"],
  clarithromycin: ["clarithromycin", "erythromycin"],
  macrolide: ["clarithromycin", "erythromycin", "azithromycin", "zithromax"],
  quinolone: ["ciprofloxacin", "ciproxin", "levofloxacin", "norfloxacin", "ofloxacin", "moxifloxacin"],
  tetracycline: ["doxycycline", "tetracycline"],
  metronidazole: ["metronidazole", "flagyl", "tinidazole"],
  cotrimoxazole: ["co-trimoxazole", "cotrimoxazole", "septrin", "bactrim", "trimethoprim", "sulfamethoxazole"],
  azole: ["fluconazole", "diflucan", "itraconazole", "ketoconazole", "voriconazole"],
  rifampicin: ["rifampicin", "rifampin", "rhze", "rifafour", "rifinah"],
  isoniazid: ["isoniazid", "rhze", "rifinah"],
  dolutegravir: ["dolutegravir", "tld", "tivicay"],
  efavirenz: ["efavirenz", "tle", "atripla"],
  nevirapine: ["nevirapine"],
  boostedPi: ["lopinavir", "kaletra", "aluvia", "ritonavir", "atazanavir", "darunavir"],
  artemether: ["artemether", "lumefantrine", "coartem"],
  qtAntimalarial: ["artemether", "lumefantrine", "coartem", "quinine", "chloroquine", "mefloquine", "halofantrine", "dihydroartemisinin", "piperaquine", "duo-cotecxin"],
  qtOther: ["ondansetron", "haloperidol", "chlorpromazine", "domperidone", "amitriptyline", "methadone"],
  hormonalContraceptive: ["microgynon", "combined pill", "contraceptive pill", "levonorgestrel", "norethisterone", "ethinylestradiol", "desogestrel", "implanon", "jadelle", "etonogestrel", "depo-provera", "medroxyprogesterone", "sayana"],
  enzymeInducerAed: ["carbamazepine", "tegretol", "phenytoin", "epanutin", "phenobarbital", "phenobarbitone"],
  methotrexate: ["methotrexate"],
  lithium: ["lithium"],
  allopurinol: ["allopurinol", "zyloric"],
  azathioprine: ["azathioprine", "mercaptopurine"],
  theophylline: ["theophylline", "aminophylline"],
  paracetamol: ["paracetamol", "acetaminophen", "panadol", "calpol", "mara moja", "hedex", "cetal"],
};

interface Rule {
  a: string;
  b: string;
  severity: Severity;
  /** What could happen, in plain words. */
  effect: string;
  /** What to do. */
  advice: string;
}

const ASK = "Don't stop either medicine on your own. Ask your pharmacist or doctor before taking them together.";

const RULES: Rule[] = [
  // Bleeding
  { a: "warfarin", b: "nsaid", severity: "major", effect: "Much higher risk of serious bleeding.", advice: "Avoid together unless your doctor says so. Paracetamol is usually a safer painkiller." },
  { a: "warfarin", b: "aspirin", severity: "major", effect: "Much higher risk of serious bleeding.", advice: ASK },
  { a: "warfarin", b: "metronidazole", severity: "major", effect: "Warfarin becomes much stronger: risk of bleeding.", advice: "Your INR blood test may need checking more often. " + ASK },
  { a: "warfarin", b: "cotrimoxazole", severity: "major", effect: "Warfarin becomes much stronger: risk of bleeding.", advice: "Your INR blood test may need checking more often. " + ASK },
  { a: "warfarin", b: "azole", severity: "major", effect: "Warfarin becomes much stronger: risk of bleeding.", advice: "Your INR blood test may need checking more often. " + ASK },
  { a: "warfarin", b: "quinolone", severity: "moderate", effect: "Warfarin may become stronger: risk of bleeding.", advice: "Your INR blood test may need checking. " + ASK },
  { a: "warfarin", b: "macrolide", severity: "moderate", effect: "Warfarin may become stronger: risk of bleeding.", advice: "Your INR blood test may need checking. " + ASK },
  { a: "warfarin", b: "rifampicin", severity: "major", effect: "Warfarin stops working as well: risk of clots.", advice: "Your warfarin dose and INR need close checking. " + ASK },
  { a: "warfarin", b: "enzymeInducerAed", severity: "moderate", effect: "Warfarin may work less well.", advice: "Your INR blood test may need checking. " + ASK },
  { a: "nsaid", b: "aspirin", severity: "moderate", effect: "More risk of stomach bleeding, and aspirin may protect the heart less.", advice: ASK },
  { a: "nsaid", b: "clopidogrel", severity: "moderate", effect: "More risk of bleeding.", advice: ASK },
  { a: "nsaid", b: "ssri", severity: "moderate", effect: "More risk of stomach bleeding.", advice: ASK },
  { a: "nsaid", b: "corticosteroid", severity: "moderate", effect: "More risk of stomach ulcers and bleeding.", advice: "A stomach-protecting medicine may be needed. " + ASK },
  { a: "clopidogrel", b: "ppi", severity: "moderate", effect: "Omeprazole and esomeprazole can make clopidogrel work less well.", advice: "Pantoprazole is usually preferred. " + ASK },
  // Kidneys, potassium, blood pressure
  { a: "aceInhibitor", b: "arb", severity: "major", effect: "Two medicines that block the same system: risk of kidney damage and high potassium.", advice: "These are rarely used together. " + ASK },
  { a: "aceInhibitor", b: "potassiumSparing", severity: "major", effect: "Potassium can rise to dangerous levels.", advice: "Regular blood tests for potassium are needed. " + ASK },
  { a: "arb", b: "potassiumSparing", severity: "major", effect: "Potassium can rise to dangerous levels.", advice: "Regular blood tests for potassium are needed. " + ASK },
  { a: "aceInhibitor", b: "potassium", severity: "major", effect: "Potassium can rise to dangerous levels.", advice: ASK },
  { a: "arb", b: "potassium", severity: "major", effect: "Potassium can rise to dangerous levels.", advice: ASK },
  { a: "potassiumSparing", b: "potassium", severity: "major", effect: "Potassium can rise to dangerous levels.", advice: ASK },
  { a: "aceInhibitor", b: "nsaid", severity: "moderate", effect: "Can harm the kidneys and make blood pressure medicine work less well.", advice: "Avoid regular use of anti-inflammatory painkillers. " + ASK },
  { a: "arb", b: "nsaid", severity: "moderate", effect: "Can harm the kidneys and make blood pressure medicine work less well.", advice: "Avoid regular use of anti-inflammatory painkillers. " + ASK },
  { a: "betaBlocker", b: "rateCcb", severity: "major", effect: "The heart can slow down too much.", advice: ASK },
  { a: "nitrate", b: "pde5", severity: "major", effect: "Blood pressure can drop dangerously low.", advice: "Never take these together." },
  { a: "digoxin", b: "amiodarone", severity: "major", effect: "Digoxin can build up to toxic levels.", advice: "The digoxin dose usually needs lowering. " + ASK },
  { a: "digoxin", b: "clarithromycin", severity: "major", effect: "Digoxin can build up to toxic levels.", advice: ASK },
  { a: "digoxin", b: "rateCcb", severity: "moderate", effect: "Digoxin levels rise and the heart can slow down.", advice: ASK },
  { a: "digoxin", b: "loopDiuretic", severity: "moderate", effect: "Low potassium from the water tablet makes digoxin side effects more likely.", advice: "Potassium should be checked regularly." },
  { a: "lithium", b: "nsaid", severity: "major", effect: "Lithium can build up to toxic levels.", advice: ASK },
  { a: "lithium", b: "aceInhibitor", severity: "major", effect: "Lithium can build up to toxic levels.", advice: ASK },
  { a: "lithium", b: "thiazide", severity: "major", effect: "Lithium can build up to toxic levels.", advice: ASK },
  // Statins
  { a: "simvastatin", b: "clarithromycin", severity: "major", effect: "Risk of serious muscle damage.", advice: "Simvastatin is usually paused during the antibiotic course. " + ASK },
  { a: "simvastatin", b: "boostedPi", severity: "major", effect: "Risk of serious muscle damage.", advice: "Simvastatin shouldn't be used with these HIV medicines. " + ASK },
  { a: "simvastatin", b: "azole", severity: "major", effect: "Risk of serious muscle damage.", advice: ASK },
  { a: "simvastatin", b: "amiodarone", severity: "moderate", effect: "Higher risk of muscle damage.", advice: "The simvastatin dose may need to be lower. " + ASK },
  { a: "simvastatin", b: "dihydropyridine", severity: "moderate", effect: "Higher risk of muscle pain or damage.", advice: "Simvastatin is usually kept at 20 mg or less with amlodipine. " + ASK },
  { a: "statin", b: "boostedPi", severity: "moderate", effect: "Higher statin levels and risk of muscle pain.", advice: "A lower statin dose may be needed. " + ASK },
  { a: "statin", b: "clarithromycin", severity: "moderate", effect: "Higher statin levels and risk of muscle pain.", advice: ASK },
  // Diabetes
  { a: "dolutegravir", b: "metformin", severity: "moderate", effect: "Dolutegravir raises metformin levels.", advice: "Metformin is usually kept at 1 g a day or less, with blood sugar checks. " + ASK },
  { a: "sulfonylurea", b: "cotrimoxazole", severity: "moderate", effect: "Blood sugar can drop too low.", advice: "Check your blood sugar more often during the course." },
  { a: "sulfonylurea", b: "azole", severity: "moderate", effect: "Blood sugar can drop too low.", advice: "Check your blood sugar more often." },
  { a: "sulfonylurea", b: "quinolone", severity: "moderate", effect: "Blood sugar can go too low or too high.", advice: "Check your blood sugar more often." },
  { a: "insulin", b: "betaBlocker", severity: "moderate", effect: "Beta-blockers can hide the warning signs of low blood sugar.", advice: "Check your blood sugar regularly." },
  { a: "sulfonylurea", b: "betaBlocker", severity: "moderate", effect: "Beta-blockers can hide the warning signs of low blood sugar.", advice: "Check your blood sugar regularly." },
  { a: "corticosteroid", b: "insulin", severity: "moderate", effect: "Steroids raise blood sugar.", advice: "Check your blood sugar more often; your dose may need adjusting." },
  { a: "corticosteroid", b: "metformin", severity: "moderate", effect: "Steroids raise blood sugar.", advice: "Check your blood sugar more often." },
  { a: "corticosteroid", b: "sulfonylurea", severity: "moderate", effect: "Steroids raise blood sugar.", advice: "Check your blood sugar more often." },
  // HIV, TB, malaria
  { a: "rifampicin", b: "dolutegravir", severity: "major", effect: "Rifampicin lowers dolutegravir levels, so HIV treatment may fail.", advice: "Dolutegravir is usually taken twice a day during TB treatment and for 2 weeks after. Your clinic must know about both." },
  { a: "rifampicin", b: "boostedPi", severity: "major", effect: "Rifampicin stops these HIV medicines working.", advice: "Your HIV clinic needs to change your treatment during TB treatment." },
  { a: "rifampicin", b: "nevirapine", severity: "major", effect: "Rifampicin lowers nevirapine levels, so HIV treatment may fail.", advice: "Your HIV clinic needs to know about both." },
  { a: "rifampicin", b: "efavirenz", severity: "moderate", effect: "Rifampicin can lower efavirenz levels.", advice: "Usually continued at the normal dose; your clinic should know about both." },
  { a: "rifampicin", b: "hormonalContraceptive", severity: "major", effect: "Contraception may fail: risk of pregnancy.", advice: "Use condoms or a copper coil (IUD) as well. Depo injections every 8 weeks or an IUD are better options." },
  { a: "rifampicin", b: "azole", severity: "moderate", effect: "Rifampicin lowers fluconazole levels.", advice: "A higher fluconazole dose may be needed. " + ASK },
  { a: "rifampicin", b: "dihydropyridine", severity: "moderate", effect: "Blood pressure medicine works less well.", advice: "Check your blood pressure during TB treatment." },
  { a: "rifampicin", b: "corticosteroid", severity: "moderate", effect: "Steroids work less well.", advice: "The steroid dose may need increasing. " + ASK },
  { a: "rifampicin", b: "sulfonylurea", severity: "moderate", effect: "Diabetes tablets may work less well.", advice: "Check your blood sugar more often during TB treatment." },
  { a: "rifampicin", b: "levothyroxine", severity: "moderate", effect: "Thyroid medicine may work less well.", advice: "Your thyroid blood test may need checking." },
  { a: "isoniazid", b: "enzymeInducerAed", severity: "moderate", effect: "Epilepsy medicine levels can change.", advice: ASK },
  { a: "efavirenz", b: "hormonalContraceptive", severity: "major", effect: "Contraception (especially the implant) may fail: risk of pregnancy.", advice: "Use condoms as well, or choose Depo, a copper coil or a hormonal coil." },
  { a: "nevirapine", b: "hormonalContraceptive", severity: "moderate", effect: "The pill may work less well.", advice: "Use condoms as well. " + ASK },
  { a: "enzymeInducerAed", b: "hormonalContraceptive", severity: "major", effect: "Contraception may fail: risk of pregnancy.", advice: "Use condoms, Depo or a coil instead. " + ASK },
  { a: "enzymeInducerAed", b: "dolutegravir", severity: "major", effect: "Dolutegravir levels drop, so HIV treatment may fail.", advice: "Your HIV clinic needs to know; the dose or medicine may need changing." },
  { a: "dolutegravir", b: "mineral", severity: "moderate", effect: "Iron, calcium, zinc and antacids stop dolutegravir being absorbed.", advice: "Take dolutegravir 2 hours before or 6 hours after these." },
  { a: "efavirenz", b: "artemether", severity: "moderate", effect: "Efavirenz lowers antimalarial levels, so malaria treatment may fail.", advice: "Complete the full course and go back if symptoms continue." },
  { a: "boostedPi", b: "artemether", severity: "moderate", effect: "Raised antimalarial levels.", advice: ASK },
  { a: "qtAntimalarial", b: "quinolone", severity: "moderate", effect: "Both can affect the heart's rhythm.", advice: ASK },
  { a: "qtAntimalarial", b: "macrolide", severity: "moderate", effect: "Both can affect the heart's rhythm.", advice: ASK },
  { a: "qtAntimalarial", b: "qtOther", severity: "moderate", effect: "Both can affect the heart's rhythm.", advice: ASK },
  { a: "quinolone", b: "macrolide", severity: "moderate", effect: "Both can affect the heart's rhythm.", advice: ASK },
  // Absorption
  { a: "quinolone", b: "mineral", severity: "moderate", effect: "Iron, calcium, zinc and antacids stop the antibiotic being absorbed.", advice: "Take the antibiotic 2 hours before or 6 hours after these." },
  { a: "tetracycline", b: "mineral", severity: "moderate", effect: "Iron, calcium and antacids stop the antibiotic being absorbed.", advice: "Take the antibiotic 2 hours before or 3 hours after these." },
  { a: "levothyroxine", b: "mineral", severity: "moderate", effect: "Iron, calcium and antacids stop thyroid medicine being absorbed.", advice: "Take levothyroxine on an empty stomach, 4 hours apart from these." },
  // Other
  { a: "methotrexate", b: "cotrimoxazole", severity: "major", effect: "Methotrexate can become toxic and harm the bone marrow.", advice: "Avoid together. " + ASK },
  { a: "methotrexate", b: "nsaid", severity: "major", effect: "Methotrexate can build up to toxic levels.", advice: ASK },
  { a: "allopurinol", b: "azathioprine", severity: "major", effect: "Azathioprine can build up and harm the bone marrow.", advice: "The dose must be greatly reduced if used together. " + ASK },
  { a: "theophylline", b: "quinolone", severity: "major", effect: "Theophylline can build up to toxic levels (fits, fast heartbeat).", advice: ASK },
  { a: "opioid", b: "benzodiazepine", severity: "major", effect: "Together they can slow or stop breathing.", advice: "Only take together if your doctor has said so, and don't drink alcohol." },
  { a: "tramadol", b: "ssri", severity: "moderate", effect: "Risk of serotonin syndrome (agitation, fever, shaking) and fits.", advice: ASK },
  { a: "tramadol", b: "tricyclic", severity: "moderate", effect: "Risk of serotonin syndrome and fits.", advice: ASK },
  { a: "ssri", b: "tricyclic", severity: "moderate", effect: "Risk of serotonin syndrome.", advice: ASK },
];

/** Two medicines from the same group: usually a duplicate (e.g. two anti-inflammatory painkillers). */
const DUPLICATE_GROUPS: Record<string, string> = {
  nsaid: "anti-inflammatory painkillers (NSAIDs)",
  aceInhibitor: "ACE inhibitors (blood pressure)",
  arb: "ARBs (blood pressure)",
  statin: "statins (cholesterol)",
  ppi: "stomach acid medicines (PPIs)",
  sulfonylurea: "sulfonylureas (diabetes)",
  benzodiazepine: "benzodiazepines (sedatives)",
  betaBlocker: "beta-blockers",
  dihydropyridine: "calcium-channel blockers",
  paracetamol: "paracetamol products",
  opioid: "opioid painkillers",
  ssri: "SSRI antidepressants",
};

export interface Interaction {
  /** The two medicines, as named in the patient's list. */
  meds: [string, string];
  severity: Severity;
  kind: "interaction" | "duplicate";
  effect: string;
  advice: string;
}

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9-]+/g, " ").trim()} `;

/** Medicine groups a name belongs to (by generic or brand name). */
export function groupsOf(name: string): string[] {
  const n = norm(name);
  return Object.entries(DRUG_GROUPS)
    // Short names (e.g. "tld") must match a whole word; longer ones can start a word ("ferrous sulphate").
    .filter(([, members]) => members.some((m) => (m.length <= 5 ? n.includes(` ${m} `) : n.includes(` ${m}`))))
    .map(([g]) => g);
}

/** Check one pair of medicines. */
export function checkPair(a: string, b: string): Interaction[] {
  if (norm(a) === norm(b)) return [];
  const ga = groupsOf(a);
  const gb = groupsOf(b);
  const out: Interaction[] = [];
  for (const r of RULES) {
    if ((ga.includes(r.a) && gb.includes(r.b)) || (ga.includes(r.b) && gb.includes(r.a))) {
      out.push({ meds: [a, b], severity: r.severity, kind: "interaction", effect: r.effect, advice: r.advice });
      break; // one message per pair: rules are ordered most specific first
    }
  }
  if (!out.length) {
    const dup = Object.keys(DUPLICATE_GROUPS).find((g) => ga.includes(g) && gb.includes(g));
    if (dup)
      out.push({
        meds: [a, b],
        severity: "moderate",
        kind: "duplicate",
        effect: `Both are ${DUPLICATE_GROUPS[dup]}: taking two can mean a double dose.`,
        advice: "Check with your pharmacist whether you should take both.",
      });
  }
  return out;
}

/** Every interaction among a list of medicines (each pair once), most serious first. */
export function findInteractions(names: string[]): Interaction[] {
  const list = [...new Set(names.filter(Boolean))];
  const out: Interaction[] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push(...checkPair(list[i]!, list[j]!));
  return out.sort((x, y) => (x.severity === y.severity ? 0 : x.severity === "major" ? -1 : 1));
}

/** Interactions between one medicine and the patient's other medicines. */
export function interactionsWith(name: string, others: string[]): Interaction[] {
  return others.flatMap((o) => checkPair(name, o)).sort((x, y) => (x.severity === y.severity ? 0 : x.severity === "major" ? -1 : 1));
}
