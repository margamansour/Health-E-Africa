import { COUNTIES } from "@/data/kenya";

export interface Point {
  lat: number;
  lng: number;
}

/** Great-circle distance in km. */
export function distanceKm(a: Point, b: Point): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function countyCentre(county: string | undefined): Point | undefined {
  const c = COUNTIES.find((x) => x.name === county);
  return c ? { lat: c.lat, lng: c.lng } : undefined;
}

export function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}
