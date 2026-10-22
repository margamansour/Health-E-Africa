import { describe, expect, it } from "vitest";
import { CONDITIONS } from "./dictionary";
import { isClinicalDiagnosis, normaliseCondition } from "./diagnosis";
import { extractFromText } from "./parse";

const name = (s: string) => normaliseCondition(s)?.name;

describe("conditions: clinical diagnoses only", () => {
  it("keeps diagnoses", () => {
    expect(name("T2DM")).toBe("Type 2 diabetes");
    expect(name("Type 2 diabetes, not well controlled")).toBe("Type 2 diabetes");
    expect(name("1. HTN")).toBe("Hypertension");
    expect(name("Malaria (P. falciparum), treated")).toBe("Malaria");
    expect(normaliseCondition("History of pulmonary TB")).toMatchObject({ name: "Tuberculosis", status: "resolved" });
    expect(name("HIV positive")).toBe("HIV");
    expect(name("Bilharzia")).toBe("Schistosomiasis");
    expect(name("Lumbar spondylosis")).toBe("Lumbar spondylosis");
    expect(name("Allergic rhinitis")).toBe("Allergic rhinitis");
    expect(name("Iron deficiency")).toBe("Iron deficiency");
  });

  it("drops everything else", () => {
    for (const junk of [
      "?anaemia",
      "Query malaria",
      "Rule out TB",
      "Suspected typhoid",
      "Screening for diabetes",
      "HIV negative",
      "No evidence of malaria",
      "Family history of diabetes",
      "Mother has hypertension",
      "Examination: chest clear",
      "BP 142/90",
      "Weight 82 kg",
      "Well controlled",
      "Continue current medication",
      "Review in 3 months",
      "Dr. A. Otieno",
      "Kind regards",
      "Patient name: Amina Wanjiru",
      "Tel: +254 700 100 101",
      "Fever and headache for 3 days",
      "Cough",
      "Tired all the time",
      "Uzima Family Clinic",
      "Results discussed with patient",
      "Haematuria",
    ]) {
      expect(normaliseCondition(junk), junk).toBeUndefined();
    }
  });

  it("every known condition name is itself recognised", () => {
    for (const c of CONDITIONS) expect(isClinicalDiagnosis(c.name), c.name).toBe(true);
  });

  it("a noisy assessment section yields only the diagnoses", () => {
    const e = extractFromText(
      [
        "Uzima Family Clinic",
        "Date: 15/10/2026",
        "Assessment:",
        "Patient seen today, feeling better",
        "On examination: BP 138/86, chest clear",
        "1. Type 2 diabetes - improving",
        "2. Hypertension",
        "3. ?Anaemia - for FBC",
        "Family history of stroke",
        "Plan:",
        "Continue metformin",
        "Kind regards,",
        "Dr. A. Otieno",
      ],
      { facilities: [], profile: { fullName: "Amina Wanjiru", dob: "1974-03-12" } },
    );
    expect(e.conditions.map((c) => c.name)).toEqual(["Type 2 diabetes", "Hypertension"]);
  });
});

import { isAllergen, isClearlyNotAllergen } from "./allergen";

describe("allergies: substances only", () => {
  it("keeps real allergens", () => {
    for (const a of ["Penicillin", "Sulfa drugs", "Amoxicillin", "Co-trimoxazole", "Peanuts", "Bee stings", "Latex", "Ciprofloxacin", "allergic to codeine", "Iodine contrast", "Shellfish"])
      expect(isAllergen(a), a).toBe(true);
  });
  it("drops headings and notes", () => {
    for (const a of ["Actions for GP", "GP actions", "Please review", "Follow up in 2 weeks", "Current medications", "Plan", "NKDA", "Discharge summary"])
      expect(isAllergen(a), a).toBe(false);
    expect(isClearlyNotAllergen("Actions for GP")).toBe(true);
    expect(isClearlyNotAllergen("Penicillin")).toBe(false);
  });
  it("an Allergies section ends at the next heading", () => {
    const e = extractFromText(
      ["Discharge summary", "Date: 05/09/2026", "Allergies:", "Penicillin (rash)", "Actions for GP", "Please repeat FBC in 4 weeks", "Stop amlodipine"],
      { facilities: [], profile: { fullName: "Amina Wanjiru", dob: "1974-03-12" } },
    );
    expect(e.allergies.map((a) => a.substance)).toEqual(["Penicillin"]);
  });
});

import { parseAction } from "./actions";

describe("actions: instructions only", () => {
  const opts = { forGp: false, docDate: "2026-10-15", findDate: () => undefined };
  it("keeps instructions", () => {
    for (const a of ["Repeat HbA1c and lipids in 3 months", "Review in 3 months", "Diabetic eye screening referral", "Stop amlodipine", "Please repeat FBC in 4 weeks", "Reduce salt intake", "Ensure patient attends antenatal clinic"])
      expect(parseAction(a, opts), a).toBeDefined();
    expect(parseAction("Review in 3 months", opts)?.due).toBe("2027-01-15");
  });
  it("drops stamps, footers and sign-offs", () => {
    for (const a of ["MI LY C", "FA L", "IM C", "U 15 OCT 2026", "Medical Officer, KMPDC Reg No: A12345 D", "SAMPLE DOCUMENT - FOR DEMO ONLY - FICTIONAL PATIENT AND CLINIC", "Kind regards", "Dr. A. Otieno", "Patient is a 52 year old woman"])
      expect(parseAction(a, opts), a).toBeUndefined();
  });
});
