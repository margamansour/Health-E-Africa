import type { Facility } from "@/db/types";

/**
 * DEMO DATA — fictional facilities for testing only.
 * Real listings will come from the Kenya Master Health Facility List and
 * licence checks (KMPDC / PPB), and only licensed facilities will be shown.
 */
type Seed = Omit<Facility, "id" | "licenceVerifiedAt" | "licenceExpires" | "licenceNumber" | "licenceBody" | "source"> & {
  licenceBody?: string;
};

const SEEDS: Seed[] = [
  { name: "Uzima Family Clinic", type: "clinic", services: ["General practice", "Diabetes care", "Hypertension clinic", "Vaccinations", "Cancer screening"], insurers: ["SHA (Social Health Authority)", "Jubilee Health", "AAR Insurance", "Pay as you go (cash / M-Pesa)"], county: "Nairobi", town: "Westlands", address: "Mpaka Rd, Westlands", lat: -1.2648, lng: 36.8031, phone: "+254700100101", hours: "Mon–Sat 8:00–18:00", rating: 4.6, reviews: 214 },
  { name: "Afya Bora Hospital", type: "hospital", services: ["General practice", "Maternity", "Paediatrics", "Radiology", "Laboratory", "Diabetes care", "Mental health"], insurers: ["SHA (Social Health Authority)", "Britam", "CIC Insurance", "Old Mutual", "AAR Insurance"], county: "Nairobi", town: "Upper Hill", address: "Ngong Rd, Upper Hill", lat: -1.2995, lng: 36.8102, phone: "+254700100102", hours: "Open 24 hours", rating: 4.4, reviews: 892 },
  { name: "Mwangaza Diagnostics", type: "lab", services: ["Laboratory", "Radiology"], insurers: ["SHA (Social Health Authority)", "Jubilee Health", "Madison Insurance", "Pay as you go (cash / M-Pesa)"], county: "Nairobi", town: "CBD", address: "Moi Ave, CBD", lat: -1.2833, lng: 36.8233, phone: "+254700100103", hours: "Mon–Sun 7:00–21:00", rating: 4.5, reviews: 330 },
  { name: "Tumaini Pharmacy", type: "pharmacy", services: ["Pharmacy", "Vaccinations"], insurers: ["SHA (Social Health Authority)", "AAR Insurance", "Britam", "Pay as you go (cash / M-Pesa)"], county: "Nairobi", town: "Kilimani", address: "Argwings Kodhek Rd, Kilimani", lat: -1.2921, lng: 36.7856, phone: "+254700100104", hours: "Mon–Sun 8:00–22:00", rating: 4.7, reviews: 156, delivers: true },
  { name: "Neema Women's Health Centre", type: "clinic", services: ["Maternity", "Cancer screening", "General practice", "Vaccinations"], insurers: ["SHA (Social Health Authority)", "Jubilee Health", "CIC Insurance"], county: "Nairobi", town: "Karen", address: "Karen Rd, Karen", lat: -1.3197, lng: 36.7076, phone: "+254700100105", hours: "Mon–Fri 8:00–17:00", rating: 4.8, reviews: 98 },
  { name: "Imara Eye & Dental Centre", type: "clinic", services: ["Eye care", "Dental"], insurers: ["AAR Insurance", "Britam", "Old Mutual", "Pay as you go (cash / M-Pesa)"], county: "Nairobi", town: "Kileleshwa", address: "Othaya Rd, Kileleshwa", lat: -1.2808, lng: 36.7834, phone: "+254700100106", hours: "Mon–Sat 9:00–17:00", rating: 4.3, reviews: 121 },
  { name: "Baraka Chemists", type: "pharmacy", services: ["Pharmacy"], insurers: ["SHA (Social Health Authority)", "Pay as you go (cash / M-Pesa)"], county: "Nairobi", town: "Eastleigh", address: "1st Ave, Eastleigh", lat: -1.2741, lng: 36.8502, phone: "+254700100107", hours: "Mon–Sun 7:00–23:00", rating: 4.1, reviews: 77, delivers: true },
  { name: "Thika Road Medical Centre", type: "clinic", services: ["General practice", "HIV care", "Laboratory", "Vaccinations"], insurers: ["SHA (Social Health Authority)", "Madison Insurance", "APA Insurance"], county: "Kiambu", town: "Ruiru", address: "Thika Rd, Ruiru", lat: -1.1466, lng: 36.9609, phone: "+254700100108", hours: "Mon–Sat 8:00–20:00", rating: 4.2, reviews: 64 },
  { name: "Pwani Coast Hospital", type: "hospital", services: ["General practice", "Maternity", "Paediatrics", "Radiology", "Laboratory", "Hypertension clinic"], insurers: ["SHA (Social Health Authority)", "Jubilee Health", "Britam", "CIC Insurance"], county: "Mombasa", town: "Nyali", address: "Links Rd, Nyali", lat: -4.0307, lng: 39.7109, phone: "+254700100109", hours: "Open 24 hours", rating: 4.5, reviews: 410 },
  { name: "Bahari Pharmacy", type: "pharmacy", services: ["Pharmacy"], insurers: ["SHA (Social Health Authority)", "AAR Insurance", "Pay as you go (cash / M-Pesa)"], county: "Mombasa", town: "Mombasa CBD", address: "Digo Rd", lat: -4.0619, lng: 39.6731, phone: "+254700100110", hours: "Mon–Sat 8:00–21:00", rating: 4.4, reviews: 88, delivers: true },
  { name: "Lake Basin Health Clinic", type: "clinic", services: ["General practice", "HIV care", "Diabetes care", "Vaccinations"], insurers: ["SHA (Social Health Authority)", "Old Mutual"], county: "Kisumu", town: "Milimani", address: "Oginga Odinga St", lat: -0.0995, lng: 34.7617, phone: "+254700100111", hours: "Mon–Sat 8:00–18:00", rating: 4.3, reviews: 143 },
  { name: "Victoria Diagnostics Kisumu", type: "lab", services: ["Laboratory", "Radiology"], insurers: ["SHA (Social Health Authority)", "Jubilee Health", "Pay as you go (cash / M-Pesa)"], county: "Kisumu", town: "Kisumu CBD", address: "Jomo Kenyatta Hwy", lat: -0.1022, lng: 34.7617, phone: "+254700100112", hours: "Mon–Sun 7:00–20:00", rating: 4.6, reviews: 59 },
  { name: "Rift Valley Wellness Hospital", type: "hospital", services: ["General practice", "Maternity", "Physiotherapy", "Mental health", "Radiology", "Laboratory"], insurers: ["SHA (Social Health Authority)", "Britam", "AAR Insurance", "CIC Insurance"], county: "Nakuru", town: "Milimani", address: "Kenyatta Ave, Nakuru", lat: -0.2827, lng: 36.0664, phone: "+254700100113", hours: "Open 24 hours", rating: 4.4, reviews: 276 },
  { name: "Nakuru Care Pharmacy", type: "pharmacy", services: ["Pharmacy", "Vaccinations"], insurers: ["SHA (Social Health Authority)", "Pay as you go (cash / M-Pesa)"], county: "Nakuru", town: "Nakuru CBD", address: "Moi Rd", lat: -0.2862, lng: 36.0699, phone: "+254700100114", hours: "Mon–Sun 8:00–21:00", rating: 4.2, reviews: 41, delivers: true },
  { name: "Highlands Medical Centre", type: "clinic", services: ["General practice", "Paediatrics", "Diabetes care", "Hypertension clinic"], insurers: ["SHA (Social Health Authority)", "Madison Insurance", "Jubilee Health"], county: "Uasin Gishu", town: "Eldoret", address: "Uganda Rd, Eldoret", lat: 0.5143, lng: 35.2698, phone: "+254700100115", hours: "Mon–Sat 8:00–19:00", rating: 4.5, reviews: 112 },
  { name: "Mlima Kenya Clinic", type: "clinic", services: ["General practice", "Eye care", "Vaccinations", "Cancer screening"], insurers: ["SHA (Social Health Authority)", "APA Insurance"], county: "Nyeri", town: "Nyeri", address: "Kimathi Way, Nyeri", lat: -0.4201, lng: 36.9476, phone: "+254700100116", hours: "Mon–Fri 8:00–17:00", rating: 4.1, reviews: 37 },
  { name: "Machakos Family Hospital", type: "hospital", services: ["General practice", "Maternity", "Laboratory", "HIV care"], insurers: ["SHA (Social Health Authority)", "CIC Insurance", "Old Mutual"], county: "Machakos", town: "Machakos", address: "Ngei Rd, Machakos", lat: -1.5177, lng: 37.2634, phone: "+254700100117", hours: "Open 24 hours", rating: 4.0, reviews: 95 },
  { name: "Kilifi Coastal Pharmacy", type: "pharmacy", services: ["Pharmacy"], insurers: ["SHA (Social Health Authority)", "Pay as you go (cash / M-Pesa)"], county: "Kilifi", town: "Kilifi", address: "Mombasa–Malindi Rd", lat: -3.6305, lng: 39.8499, phone: "+254700100118", hours: "Mon–Sat 8:00–20:00", rating: 4.3, reviews: 22, delivers: true },
];

function licence(type: Facility["type"], i: number) {
  if (type === "pharmacy") return { licenceBody: "PPB", licenceNumber: `PPB/DEMO/${1000 + i}` };
  return { licenceBody: "KMPDC", licenceNumber: `KMPDC/DEMO/${2000 + i}` };
}

export function demoFacilities(): Facility[] {
  const year = new Date().getFullYear();
  return SEEDS.map((s, i) => ({
    ...s,
    id: `fac-${String(i + 1).padStart(3, "0")}`,
    source: "demo" as const,
    ...licence(s.type, i),
    licenceExpires: `${year + 1}-06-30`,
    licenceVerifiedAt: new Date(Date.now() - (i % 5) * 86400000 * 7).toISOString(),
  }));
}
