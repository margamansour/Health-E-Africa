import type { Allergy } from "@/db/types";

/**
 * Allergy groups → medicine names that belong to them.
 * Decision support only: a pharmacist must always check.
 */
export const GROUPS: Record<string, string[]> = {
  penicillin: [
    "penicillin",
    "amoxicillin",
    "amoxil",
    "ampicillin",
    "flucloxacillin",
    "cloxacillin",
    "co-amoxiclav",
    "augmentin",
    "benzylpenicillin",
    "phenoxymethylpenicillin",
    "piperacillin",
  ],
  cephalosporin: ["cefalexin", "cephalexin", "ceftriaxone", "cefuroxime", "cefixime", "cefadroxil", "cefotaxime"],
  sulfonamide: ["sulfa", "sulphonamide", "sulfamethoxazole", "co-trimoxazole", "cotrimoxazole", "septrin", "sulfadoxine"],
  nsaid: ["nsaid", "ibuprofen", "diclofenac", "naproxen", "aspirin", "mefenamic", "indomethacin", "celecoxib", "ketoprofen"],
  opioid: ["opioid", "codeine", "morphine", "tramadol", "pethidine", "oxycodone"],
  macrolide: ["erythromycin", "azithromycin", "clarithromycin"],
  quinolone: ["ciprofloxacin", "levofloxacin", "norfloxacin", "ofloxacin"],
  "ace inhibitor": ["enalapril", "lisinopril", "captopril", "ramipril", "perindopril"],
};

// Allergy to one group that suggests caution with another (cross-reactivity).
const CROSS: Record<string, string[]> = {
  penicillin: ["cephalosporin"],
};

function norm(s: string) {
  return s.toLowerCase().trim();
}

function groupsFor(substance: string): string[] {
  const s = norm(substance);
  return Object.entries(GROUPS)
    .filter(([group, members]) => s.includes(group) || members.some((m) => s.includes(m) || m.includes(s)))
    .map(([group]) => group);
}

export interface AllergyConflict {
  allergy: Allergy;
  level: "direct" | "cross";
  reason: string;
}

export function findAllergyConflicts(medicineName: string, allergies: Allergy[]): AllergyConflict[] {
  const med = norm(medicineName);
  if (!med) return [];
  const medGroups = Object.entries(GROUPS)
    .filter(([, members]) => members.some((m) => med.includes(m)))
    .map(([g]) => g);

  const out: AllergyConflict[] = [];
  for (const a of allergies) {
    if (a.status !== "active" || a.archivedAt) continue;
    const sub = norm(a.substance);
    const aGroups = groupsFor(sub);
    if (med.includes(sub) || sub.includes(med) || medGroups.some((g) => aGroups.includes(g))) {
      out.push({ allergy: a, level: "direct", reason: `${medicineName} may contain or be related to ${a.substance}` });
      continue;
    }
    const cross = aGroups.flatMap((g) => CROSS[g] ?? []);
    if (medGroups.some((g) => cross.includes(g))) {
      out.push({ allergy: a, level: "cross", reason: `Possible cross-reaction between ${a.substance} and ${medicineName}` });
    }
  }
  return out;
}
