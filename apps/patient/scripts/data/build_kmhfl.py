"""
Build src/data/kmhfl.json: Kenya's health facilities for Find care.

Sources (all from the Ministry of Health's Kenya Master Health Facility List, KMHFL):
  1. KMHFL 2020 snapshot (12,394 operational, approved facilities), published on openAfrica
     (CC BY 4.0). Copy used: github.com/joenzau41-png/kenya-health-access-gap-analysis
     data/kenya_hospital_facilities.csv
  2. Older KMHFL facility records with GPS coordinates, from the KMHFL API project
     github.com/SteveWaweru/mfl_api data/new_data/demo/0016_facilities.json, 0017_facilities.json
     and IEBC ward centre points, mfl_gis/data/kenya_wards.json
  3. Older KMHFL export with phone numbers and services offered:
     github.com/arapkirui513-hub/kenya-health-dashboard backend/data/cleaned_health_facilities_kenya.xlsx

Usage: python3 -I scripts/data/build_kmhfl.py <folder with the three clones> src/data/kmhfl.json

Facilities are matched across sources by their official KMHFL facility code. Where no GPS point
is known, the ward's centre (or the county's) is used and the location is marked approximate.
"""

import csv
import json
import math
import re
import sys
from pathlib import Path

import openpyxl

src = Path(sys.argv[1])
out = Path(sys.argv[2])
here = Path(__file__).resolve().parents[2]

# County names and centres as the app spells them.
counties = {}
for name, lat, lng in re.findall(r'\{ name: "([^"]+)", lat: (-?[\d.]+), lng: (-?[\d.]+) \}', (here / "src/data/kenya.ts").read_text()):
    counties[name] = (float(lat), float(lng))


def norm(s):
    return re.sub(r"[^a-z]", "", (s or "").lower())


county_by_norm = {norm(c): c for c in counties}
county_by_norm.update({norm("Elgeyo Marakwet"): "Elgeyo-Marakwet", norm("Tharaka Nithi"): "Tharaka-Nithi", norm("Muranga"): "Murang'a", norm("Taita Taveta"): "Taita-Taveta", norm("Trans-Nzoia"): "Trans Nzoia"})

SERVICES = [
    "General practice", "Maternity", "Paediatrics", "Diabetes care", "Hypertension clinic", "HIV care", "Dental", "Eye care",
    "Radiology", "Laboratory", "Physiotherapy", "Mental health", "Cancer screening", "Vaccinations", "Pharmacy", "TB care",
    "Family planning", "Inpatient care",
]
S = {s: i for i, s in enumerate(SERVICES)}

# Kind of place, as Find care groups them.
def kind_of(ftype):
    t = ftype.lower()
    if "hospital" in t:
        return "hospital"
    if t in ("laboratory", "radiology clinic", "blood bank", "regional blood transfusion centre"):
        return "lab"
    if t == "pharmacy":
        return "pharmacy"
    if "farewell" in t:
        return None  # funeral homes are listed in KMHFL but aren't places to get care
    return "clinic"


def tidy_type(ftype):
    t = ftype.strip()
    return t[0].upper() + t[1:].lower() if t.isupper() else t


def phone(*values):
    for v in values:
        if v is None:
            continue
        d = re.sub(r"\D", "", str(v))
        if d.startswith("254") and len(d) == 12:
            return "+" + d
        if d.startswith("0") and len(d) == 10:
            return "+254" + d[1:]
        if len(d) == 9 and d[0] in "17":
            return "+254" + d
    return None


# --- GPS points from the older KMHFL records ---
coords = {}
towns = {}
for f in ("0016_facilities.json", "0017_facilities.json"):
    for x in json.load(open(src / "mfl_api/data/new_data/demo" / f))[0]["records"]:
        tn = ((x.get("town") or {}).get("name") or "").strip()
        if tn:
            towns.setdefault(int(x["code"]), tn.title())
        try:
            la, lo = float(x.get("latitude") or "x"), float(x.get("longitude") or "x")
        except ValueError:
            continue
        if -4.8 < la < 5.1 and 33.8 < lo < 42.0:
            coords[int(x["code"])] = (round(la, 5), round(lo, 5))

wards = {}
for w in json.load(open(src / "mfl_api/mfl_gis/data/kenya_wards.json"))["region"]["locations"]:
    wards.setdefault(norm(w["name"]), []).append((w["center"]["lat"], w["center"]["lon"]))


def ward_point(ward, county):
    options = wards.get(norm(ward))
    if not options:
        return None
    c = counties.get(county)
    if not c:
        return options[0] if len(options) == 1 else None
    best = min(options, key=lambda p: math.dist(p, c))
    return best if math.dist(best, c) < 1.5 else None  # within ~150 km of the county centre


# --- Phone numbers and services from the older export ---
wb = openpyxl.load_workbook(src / "kenya-health-dashboard/backend/data/cleaned_health_facilities_kenya.xlsx", read_only=True)
it = wb.worksheets[0].iter_rows(values_only=True)
head = next(it)
older = {r[0]: dict(zip(head, r)) for r in it if r[0]}

FLAG_SERVICES = {
    "OPD": ["General practice"], "ANC": ["Maternity"], "BEOC": ["Maternity"], "CEOC": ["Maternity"], "CAES SEC": ["Maternity"],
    "ART": ["HIV care"], "PMTCT": ["HIV care"], "HCT": ["HIV care"], "EPI": ["Vaccinations"], "FP": ["Family planning"],
    "RAD/XRAY": ["Radiology"], "TB DIAG": ["TB care"], "TB TREAT": ["TB care"], "TB LABS": ["Laboratory", "TB care"],
    "BLOOD": ["Laboratory"], "IPD": ["Inpatient care"], "C-IMCI": ["Paediatrics"], "GROWM": ["Paediatrics"],
}
TYPE_SERVICES = {
    "laboratory": ["Laboratory"], "radiology clinic": ["Radiology"], "pharmacy": ["Pharmacy"], "dental clinic": ["Dental"],
    "ophthalmology": ["Eye care"], "vct": ["HIV care"], "regional blood transfusion centre": ["Laboratory"], "blood bank": ["Laboratory"],
}

rows = []
stats = {"gps": 0, "ward": 0, "county": 0, "phone": 0, "services": 0}
for r in csv.DictReader(open(src / "kenya-health-access-gap-analysis/data/kenya_hospital_facilities.csv", encoding="utf-8", errors="replace")):
    if not r["Code"].isdigit():
        continue
    kind = kind_of(r["Facility type"])
    if not kind:
        continue
    code = int(r["Code"])
    county = county_by_norm.get(norm(r["County"]))
    if not county:
        continue
    o = older.get(code, {})
    # Location: GPS point, else ward centre, else county centre (approximate).
    point, approx = coords.get(code), 0
    if point:
        stats["gps"] += 1
    else:
        point, approx = ward_point(r["Ward"], county), 1
        if point:
            stats["ward"] += 1
        else:
            point, approx = counties[county], 2
            stats["county"] += 1
    services = set()
    for flag, names in FLAG_SERVICES.items():
        if o.get(flag) is True:
            services.update(names)
    services.update(TYPE_SERVICES.get(r["Facility type"].lower(), []))
    if kind == "hospital":
        services.add("General practice")
    if services:
        stats["services"] += 1
    mask = sum(1 << S[s] for s in services)
    tel = phone(o.get("Official Mobile"), o.get("Official Landline"), o.get("Official Alternate No"))
    if tel:
        stats["phone"] += 1
    open24 = r["Open_whole_day"] == "Yes" or o.get("Open 24 Hours") == "Y"
    weekends = r["Open_weekends"] == "Yes" or o.get("Open Weekends") == "Y"
    level = r["Keph level"].replace("Level ", "")
    beds = int(r["Beds"]) if r["Beds"].isdigit() else 0
    reg = r["Regulatory body"] if r["Regulatory body"] not in ("None", "Other") else ""
    town = (o.get("Nearest Town") or o.get("Town") or towns.get(code) or "").strip().title()
    # Keep real place names only, not descriptions like "Situated within ... district".
    if town.lower() in ("", "none", "n/a", "na", "-") or len(town) > 22 or re.search(r"\d|\b(within|situated|next|near|off|along|opposite|behind|along|km|road|rd|street|plot|box)\b", town, re.I):
        town = ""
    rows.append([
        code,
        r["Name"].strip(),
        kind,
        tidy_type(r["Facility type"]),
        int(level) if level.isdigit() else 0,
        r["Owner type"],
        county,
        r["Sub county"].strip().title(),
        r["Ward"].strip().title(),
        point[0],
        point[1],
        approx,
        tel or "",
        (2 if open24 else 0) + (1 if weekends else 0),
        reg.replace(" (Private Practice)", "").replace(" - Private Practice (deleted)", ""),
        r["Registration_number"].strip() if r["Registration_number"] not in ("None", "") else "",
        beds,
        mask,
        town,
    ])

rows.sort(key=lambda x: (x[6], x[1]))
data = {
    "source": "Kenya Master Health Facility List (Ministry of Health), 2020 snapshot via openAfrica, CC BY 4.0; GPS points, phone numbers and services from earlier KMHFL records.",
    "snapshot": "2020",
    "services": SERVICES,
    "fields": ["code", "name", "kind", "facilityType", "level", "owner", "county", "subCounty", "ward", "lat", "lng", "approx", "phone", "open", "regulator", "registration", "beds", "services", "town"],
    "rows": rows,
}
out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
print(len(rows), "facilities", stats, f"{out.stat().st_size // 1024} KB")
