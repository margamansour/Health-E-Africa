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
