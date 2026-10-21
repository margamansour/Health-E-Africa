import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildLines, type PositionedText } from "./lines";
import { extractFromText } from "./parse";

const SAMPLES = new URL("../../../../../samples/", import.meta.url).pathname;
const ctx = {
  facilities: [
    { id: "fac-003", name: "Mwangaza Diagnostics" },
    { id: "fac-001", name: "Uzima Family Clinic" },
  ],
  profile: { fullName: "Amina Wanjiru", dob: "1974-03-12" },
};

async function pdfLines(file: string) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(SAMPLES + file)), isEvalSupported: false, useSystemFonts: false }).promise;
  const out: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items: PositionedText[] = [];
    for (const it of tc.items as { str: string; transform: number[]; width: number; height: number }[]) {
      const h = it.height || Math.abs(it.transform[3]!);
      items.push({ str: it.str, x: it.transform[4]!, y: vp.height - it.transform[5]! - h, w: it.width, h });
    }
    out.push(...buildLines(items));
  }
  return out;
}

describe("sample documents", () => {
  it("reads the lab report", async () => {
    const lines = await pdfLines("01-lab-report-mwangaza-VERIFIED.pdf");
    const e = extractFromText(lines, ctx);
    console.log(lines.slice(0, 14).join("\n"));
    expect(e.docType).toBe("lab");
    expect(e.facilityId).toBe("fac-003");
    expect(e.date).toBe("2026-10-14");
    expect(e.patientMatch).toBe("match");
    expect(e.labs.length).toBe(15);
    expect(e.labs.find((l) => l.analyte === "Haemoglobin")).toMatchObject({ value: 11.4, unit: "g/dL", refLow: 12, refHigh: 17 });
    expect(e.labs.find((l) => l.analyte === "Total cholesterol")).toMatchObject({ value: 5.6, refHigh: 5.2 });
    expect(e.labs.find((l) => l.analyte === "HDL cholesterol")).toMatchObject({ value: 1.2, refLow: 1 });
    expect(e.labs.find((l) => l.analyte === "White cell count")?.unit).toBe("x10^9/L");
    expect(e.signedText).toBe(true);
    expect(e.notes).toContain("HbA1c above target");
  });

  it("reads the clinic letter", async () => {
    const e = extractFromText(await pdfLines("02-clinic-letter-uzima-VERIFIED.pdf"), ctx);
    console.log(JSON.stringify({ ...e, labs: e.labs.length }, null, 1));
    expect(e.docType).toBe("letter");
    expect(e.facilityId).toBe("fac-001");
    expect(e.date).toBe("2026-10-15");
    expect(e.conditions.map((c) => c.name)).toEqual(["Type 2 diabetes", "Hypertension", "Hyperlipidaemia", "Iron deficiency anaemia"]);
    expect(e.allergies.map((a) => a.substance)).toEqual(["Penicillin", "Sulfa drugs"]);
    expect(e.allergies[0]!.reaction).toBe("Rash and swelling");
    expect(e.medications.map((m) => `${m.name} ${m.dose} ${m.frequency}`)).toEqual([
      "Metformin 1 g Twice daily",
      "Amlodipine 5 mg Once daily",
      "Atorvastatin 40 mg At night",
      "Empagliflozin 10 mg Once daily",
      "Ferrous Sulphate 200 mg Once daily",
    ]);
    expect(e.immunisations[0]).toMatchObject({ vaccine: "Influenza", dateGiven: "2026-10-15", batchNumber: "FLU-2210" });
    expect(e.followUps.map((f) => f.date)).toContain("2027-01-15");
    expect(e.clinician).toBe("Dr. Achieng Otieno");
    expect(e.registration).toBe("KMPDC A12345");
    expect(e.labs).toHaveLength(0);
  });

  it("reads the discharge summary from an unlisted hospital", async () => {
    const e = extractFromText(await pdfLines("04-discharge-summary-unlisted-hospital-UNVERIFIED.pdf"), ctx);
    expect(e.docType).toBe("discharge");
    expect(e.facilityId).toBeUndefined();
    expect(e.facilityName).toBe("Bahari Ridge Hospital");
    expect(e.date).toBe("2026-09-05");
    expect(e.conditions[0]).toMatchObject({ name: "Malaria", status: "resolved" });
    expect(e.medications[0]).toMatchObject({ name: "Artemether-Lumefantrine", dose: "80/480 mg", type: "acute" });
    expect(e.medications[1]).toMatchObject({ name: "Paracetamol", prescriptionOnly: false });
    expect(e.followUps[0]?.date).toBe("2026-09-19");
  });

  it("has no text layer in the handwritten scan", async () => {
    expect((await pdfLines("03-handwritten-note-UNVERIFIED.pdf")).join(" ")).not.toMatch(/Amoxicillin/);
  });
});

describe("handwritten-style text from OCR", () => {
  it("picks out shorthand diagnoses and prescriptions", () => {
    const e = extractFromText(
      ["14/10/26", "Name: Amina Wanjiru", "Dx: sore throat - tonsillitis", "Rx: Amoxicillin 500mg TDS x5 days", "Paracetamol 1g QDS PRN", "Plenty of fluids. Review if", "no better in 3 days.", "Dr Mwangi"],
      ctx,
    );
    expect(e.date).toBe("2026-10-14");
    expect(e.conditions[0]?.name).toBe("Tonsillitis");
    expect(e.medications[0]).toMatchObject({ name: "Amoxicillin", dose: "500 mg", frequency: "Three times daily", type: "acute" });
    expect(e.medications[1]).toMatchObject({ name: "Paracetamol", frequency: "Four times daily, when needed" });
    expect(e.followUps[0]?.date).toBe("2026-10-17");
    expect(e.patientMatch).toBe("match");
  });

  it("flags a different patient", () => {
    const e = extractFromText(["Patient name: John Kamau", "Date: 01/10/2026"], ctx);
    expect(e.patientMatch).toBe("mismatch");
  });
});

describe("OCR tolerance", () => {
  it("matches misread names and conditions", async () => {
    const { extractFromText: x } = await import("./parse");
    const e = x(["Nome: Amina Warjiru", "Dx: gore throat - tonsillitic"], ctx);
    expect(e.conditions[0]?.name).toBe("Tonsillitis");
  });
});
