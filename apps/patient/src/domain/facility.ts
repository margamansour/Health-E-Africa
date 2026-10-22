import type { Facility } from "@/db/types";

/**
 * Is the facility currently allowed to practise, as far as we know? Facilities on the official
 * Kenya Master Health Facility List are listed as operational and approved by the Ministry of
 * Health; demo listings carry their own licence expiry date.
 */
export function isListedActive(f: Pick<Facility, "source" | "licenceExpires">, today = new Date().toISOString().slice(0, 10)): boolean {
  return f.source === "kmhfl" || (!!f.licenceExpires && f.licenceExpires >= today);
}
