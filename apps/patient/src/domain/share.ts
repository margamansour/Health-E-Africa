import type { ShareSection, SummaryShare } from "@/db/types";

export const ALL_SECTIONS: ShareSection[] = [
  "identity",
  "emergency",
  "conditions",
  "allergies",
  "medications",
  "labs",
  "immunisations",
  "records",
];

export const SUMMARY_TYPES: Record<SummaryShare["summaryType"], { label: string; description: string; sections: ShareSection[] }> = {
  full: {
    label: "Full summary",
    description: "Everything except individual documents you don't select.",
    sections: ["identity", "emergency", "conditions", "allergies", "medications", "labs", "immunisations", "records"],
  },
  emergency: {
    label: "Emergency summary",
    description: "Blood group, allergies, conditions, medicines and emergency contact.",
    sections: ["identity", "emergency", "conditions", "allergies", "medications"],
  },
  medications: {
    label: "Medicines & allergies",
    description: "For a pharmacy: current medicines and allergies only.",
    sections: ["identity", "allergies", "medications"],
  },
  custom: {
    label: "Custom",
    description: "Choose exactly what to include.",
    sections: [],
  },
};

export const EXPIRY_OPTIONS = [
  { hours: 24, label: "24 hours" },
  { hours: 24 * 7, label: "7 days" },
  { hours: 24 * 30, label: "30 days" },
];

export type ShareState = "active" | "expired" | "revoked";

export function shareState(s: Pick<SummaryShare, "expiresAt" | "revokedAt">, now = new Date()): ShareState {
  if (s.revokedAt) return "revoked";
  if (new Date(s.expiresAt) <= now) return "expired";
  return "active";
}

export function shareUrl(token: string): string {
  if (import.meta.env.VITE_HASH_ROUTER === "1") return `${window.location.href.split("#")[0]}#/s/${token}`;
  return `${window.location.origin}/s/${token}`;
}
