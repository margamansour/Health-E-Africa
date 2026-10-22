import type { RecordCategory } from "@/db/types";

export const CATEGORY_LABELS: Record<RecordCategory, string> = {
  letter: "Clinic letter",
  radiology: "Radiology / scan",
  lab: "Lab report",
  prescription: "Prescription",
  discharge: "Discharge summary",
  other: "Other",
};

/** What kind of to-do an action is. */
export const ACTION_KIND_LABEL: Record<"medication" | "test" | "referral" | "appointment" | "lifestyle" | "other", string> = {
  medication: "Medicine change",
  test: "Test",
  referral: "Referral",
  appointment: "Appointment",
  lifestyle: "Lifestyle",
  other: "To do",
};
