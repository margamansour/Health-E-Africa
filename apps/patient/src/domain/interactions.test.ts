import { describe, expect, it } from "vitest";
import { checkPair, findInteractions, groupsOf } from "./interactions";

describe("medicine interactions", () => {
  it("recognises generic and brand names", () => {
    expect(groupsOf("Brufen 400 mg")).toContain("nsaid");
    expect(groupsOf("TLD")).toContain("dolutegravir");
    expect(groupsOf("Artemether-Lumefantrine 80/480 mg")).toContain("artemether");
    expect(groupsOf("Albendazole")).toEqual([]);
    expect(groupsOf("Ironic")).toEqual([]);
  });

  it("flags well-known dangerous pairs", () => {
    expect(checkPair("Warfarin", "Ibuprofen")[0]).toMatchObject({ severity: "major", kind: "interaction" });
    expect(checkPair("Rifampicin", "Dolutegravir")[0]?.severity).toBe("major");
    expect(checkPair("RHZE", "Microgynon")[0]?.effect).toMatch(/Contraception may fail/);
    expect(checkPair("Sildenafil", "Isosorbide mononitrate")[0]?.severity).toBe("major");
    expect(checkPair("Enalapril", "Spironolactone")[0]?.severity).toBe("major");
    expect(checkPair("TLD", "Metformin")[0]?.severity).toBe("moderate");
    expect(checkPair("Coartem", "Ciprofloxacin")[0]?.effect).toMatch(/rhythm/);
  });

  it("flags taking two of the same kind", () => {
    expect(checkPair("Ibuprofen", "Diclofenac")[0]).toMatchObject({ kind: "duplicate" });
    expect(checkPair("Panadol", "Paracetamol 1 g")[0]).toMatchObject({ kind: "duplicate" });
  });

  it("is quiet for safe combinations", () => {
    expect(findInteractions(["Metformin 500 mg", "Amlodipine 5 mg", "Atorvastatin 20 mg", "Paracetamol 1 g"])).toEqual([]);
  });

  it("lists major ones first", () => {
    const r = findInteractions(["Metformin", "TLD", "Warfarin", "Ibuprofen"]);
    expect(r[0]?.severity).toBe("major");
    expect(r).toHaveLength(2);
  });
});

import { conditionWarnings } from "./interactions";

describe("medicines and conditions", () => {
  it("flags medicines that are risky with a condition", () => {
    expect(conditionWarnings("Ibuprofen 400 mg", ["Chronic kidney disease"])[0]).toMatchObject({ severity: "major", condition: "kidney disease" });
    expect(conditionWarnings("Diclofenac", ["Heart failure"])[0]?.severity).toBe("major");
    expect(conditionWarnings("Propranolol", ["Asthma"])[0]?.severity).toBe("major");
    expect(conditionWarnings("Atenolol", ["Asthma"])[0]?.severity).toBe("moderate");
    expect(conditionWarnings("Tramadol", ["Epilepsy"])[0]?.severity).toBe("major");
    expect(conditionWarnings("Prednisolone", ["Type 2 diabetes"])[0]?.condition).toBe("diabetes");
    expect(conditionWarnings("Metformin", ["Chronic kidney disease"])[0]?.severity).toBe("moderate");
  });
  it("one warning per condition, and age 65+ cautions", () => {
    expect(conditionWarnings("Propranolol", ["Asthma"])).toHaveLength(1);
    expect(conditionWarnings("Diazepam", [], 70)[0]?.condition).toBe("age 65 and over");
    expect(conditionWarnings("Diazepam", [], 40)).toEqual([]);
  });
  it("quiet when nothing applies", () => {
    expect(conditionWarnings("Amlodipine", ["Type 2 diabetes", "Hypertension"])).toEqual([]);
    expect(conditionWarnings("Chlorpheniramine", ["Prostate cancer"])).toEqual([]);
  });
});
