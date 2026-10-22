import type { Facility } from "@/db/types";

/** Version of the bundled facility list; bump when kmhfl.json is rebuilt so devices reload it. */
export const KMHFL_VERSION = "kmhfl-2020-3";

export const KMHFL_SOURCE =
  "Kenya Master Health Facility List (Ministry of Health), 2020 snapshot. GPS points, phone numbers and services are from earlier KMHFL records and may be out of date.";

type Row = [number, string, Facility["type"], string, number, string, string, string, string, number, number, 0 | 1 | 2, string, number, string, string, number, number, string];

const OPEN_LABEL = ["", "Open weekends", "Open 24 hours", "Open 24 hours, every day"];

/** Load the official facility list (bundled with the app, loaded on demand). */
export async function loadKmhfl(): Promise<Facility[]> {
  const data = (await import("./kmhfl.json")).default as unknown as { services: string[]; rows: Row[] };
  return data.rows.map((r) => {
    const [code, name, type, facilityType, level, owner, county, subCounty, ward, lat, lng, approx, phone, open, regulator, registration, beds, mask, nearestTown] = r;
    return {
      id: `kmhfl-${code}`,
      source: "kmhfl",
      code,
      name,
      type,
      facilityType,
      level: level || undefined,
      owner,
      county,
      town: nearestTown || subCounty || ward || county,
      subCounty,
      ward,
      address: [ward, subCounty].filter(Boolean).join(", "),
      lat,
      lng,
      approxLocation: approx,
      phone: phone || undefined,
      hours: OPEN_LABEL[open] || undefined,
      licenceBody: regulator || undefined,
      licenceNumber: registration || undefined,
      beds: beds || undefined,
      services: data.services.filter((_, i) => mask & (1 << i)),
      insurers: [],
    } satisfies Facility;
  });
}
