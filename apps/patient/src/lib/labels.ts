import type { RecordCategory } from "@/db/types";

export const CATEGORY_LABELS: Record<RecordCategory, string> = {
  letter: "Clinic letter",
  radiology: "Radiology / scan",
  lab: "Lab report",
  prescription: "Prescription",
  discharge: "Discharge summary",
  other: "Other",
};
