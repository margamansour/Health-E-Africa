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
