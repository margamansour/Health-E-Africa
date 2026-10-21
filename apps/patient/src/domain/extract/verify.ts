import type { Facility } from "@/db/types";
import type { Extraction } from "./parse";

export type CheckKey = "clinic" | "date" | "stamp" | "signature" | "printed" | "patient";

export interface VerificationCheck {
  key: CheckKey;
  ok: boolean;
  detail?: string;
}

export interface Verification {
  status: "verified" | "unverified";
  checks: VerificationCheck[];
  /** Plain-language reasons when unverified. */
  reasons: string[];
  handwritten: boolean;
  method: "pdf-text" | "ocr" | "none";
  checkedAt: string;
}

export interface VerifyInput {
  extraction: Extraction;
  facility?: Pick<Facility, "name" | "licenceExpires" | "licenceBody" | "licenceNumber">;
  handwritten: boolean;
  stampFound: boolean;
  signatureFound: boolean;
  method: Verification["method"];
  today: string;
}

/**
 * A document counts as a VERIFIED SOURCE only when it is printed (not handwritten), comes from a
 * licensed clinic in our directory, is dated, carries a stamp or a signature, and doesn't name a
 * different patient. Everything else is saved as unverified.
 *
 * This checks the document's markings; it is not proof it is genuine. Results that a clinic sends
 * directly through the app are verified by that channel instead.
 */
export function assessVerification(i: VerifyInput): Verification {
  const e = i.extraction;
  const licensed = !!i.facility && i.facility.licenceExpires >= i.today;
  const signature = i.signatureFound || /electronically signed|digitally signed/i.test(e.notes ?? "");

  const checks: VerificationCheck[] = [
    { key: "printed", ok: !i.handwritten },
    { key: "clinic", ok: licensed, detail: i.facility ? i.facility.name : e.facilityName },
    { key: "date", ok: !!e.date, detail: e.date },
    { key: "stamp", ok: i.stampFound },
    { key: "signature", ok: signature, detail: [e.clinician, e.registration].filter(Boolean).join(" · ") || undefined },
    { key: "patient", ok: e.patientMatch === "match", detail: e.patientName },
  ];

  const reasons: string[] = [];
  if (i.handwritten) reasons.push("Handwritten documents are always saved as unverified.");
  if (!i.facility) reasons.push(e.facilityName ? "This clinic isn't in our directory of licensed facilities." : "We couldn't find the clinic's name.");
  else if (!licensed) reasons.push("This clinic's licence has expired.");
  if (!e.date) reasons.push("We couldn't find a date.");
  if (!i.stampFound && !signature) reasons.push("We couldn't find a stamp or signature.");
  if (e.patientMatch === "mismatch") reasons.push("The patient name or date of birth doesn't match your profile.");

  return {
    status: reasons.length === 0 ? "verified" : "unverified",
    checks,
    reasons,
    handwritten: i.handwritten,
    method: i.method,
    checkedAt: new Date().toISOString(),
  };
}
