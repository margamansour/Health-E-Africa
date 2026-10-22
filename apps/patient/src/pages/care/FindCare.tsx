import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BadgeCheck, Building2, Clock, FlaskConical, Hospital, LocateFixed, Mail, MapPin, Phone, Pill, Search, Share2, ShieldCheck, SlidersHorizontal, Star, Truck, Flag, CalendarPlus, Navigation, Landmark } from "lucide-react";
import { db } from "@/db/db";
import type { Facility, FacilityType } from "@/db/types";
import { Badge, Button, Card, Checkbox, Chips, Field, KeyValue, Notice, Select, Sheet, Tabs } from "@/components/ui";
import { Page, PageHeader } from "@/components/layout";
import { BookingSheet } from "@/components/BookingSheet";
import { ShareSheet } from "@/components/ShareSheet";
import { INSURER_DETAILS, INSURERS, SERVICE_GROUPS } from "@/data/kenya";
import { KMHFL_SOURCE } from "@/data/kmhfl";
import { isListedActive } from "@/domain/facility";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { countyCentre, distanceKm, formatKm, type Point } from "@/domain/geo";
import { useProfile } from "@/lib/hooks";

const TYPE_ICON: Record<FacilityType, typeof Building2> = { clinic: Building2, hospital: Hospital, lab: FlaskConical, pharmacy: Pill };
const TYPE_LABEL: Record<FacilityType, string> = { clinic: "Clinic / health centre", hospital: "Hospital", lab: "Laboratory", pharmacy: "Pharmacy" };
const OWNER_LABEL: Record<string, string> = {
  "Ministry of Health": "Public",
  "Private Practice": "Private",
  "Faith Based Organization": "Faith-based",
  "Non-Governmental Organizations": "NGO",
};

interface Filters {
  service: string;
  insurer: string;
  myInsurance: boolean;
  maxKm: number;
  minRating: number;
  sort: "distance" | "rating";
}

const DEFAULT_FILTERS: Filters = { service: "", insurer: "", myInsurance: false, maxKm: 0, minRating: 0, sort: "distance" };

const PAGE = 30;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function FindCarePage() {
  const { t } = useTranslation();
  const profile = useProfile();
  const [tab, setTab] = useState<"places" | "insurers">("places");
  const [shown, setShown] = useState(PAGE);
  const facilities = useLiveQuery(() => db.facilities.toArray(), []) ?? [];
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | FacilityType>("all");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [gps, setGps] = useState<Point | null>(null);
  const [selected, setSelected] = useState<Facility | null>(null);
  const [booking, setBooking] = useState<Facility | null>(null);
  const [sharingWith, setSharingWith] = useState<string | null>(null);

  const origin = gps ?? (profile?.lat != null && profile?.lng != null ? { lat: profile.lat, lng: profile.lng } : countyCentre(profile?.county));
  const myInsurers = profile?.insurance.map((i) => i.provider) ?? [];
  const activeFilterCount = [filters.service, filters.insurer, filters.myInsurance, filters.maxKm, filters.minRating].filter(Boolean).length;

  const list = useMemo(() => {
    // Every word typed must appear somewhere in the listing (name, area, type or services).
    const words = norm(q).split(/\s+/).filter(Boolean);
    const today = new Date().toISOString().slice(0, 10);
    const rows = facilities
      // Only list facilities that are approved to operate (legal advice: avoid implied endorsement).
      .filter((f) => isListedActive(f, today))
      .filter((f) => type === "all" || f.type === type)
      .filter((f) => !words.length || ((hay) => words.every((w) => hay.includes(w)))(norm(`${f.name} ${f.town} ${f.ward ?? ""} ${f.subCounty ?? ""} ${f.county} ${f.facilityType ?? ""} ${f.services.join(" ")}`)))
      .filter((f) => !filters.service || f.services.includes(filters.service))
      .filter((f) => !filters.insurer || f.insurers.includes(filters.insurer))
      .filter((f) => !filters.myInsurance || f.insurers.some((i) => myInsurers.includes(i)))
      .filter((f) => !filters.minRating || (f.rating ?? 0) >= filters.minRating)
      // No distance for places only known to be "somewhere in the county".
      .map((f) => ({ ...f, km: origin && f.approxLocation !== 2 ? distanceKm(origin, f) : undefined }))
      .filter((f) => !filters.maxKm || (f.km != null && f.km <= filters.maxKm));
    return rows.sort((a, b) => (filters.sort === "rating" ? (b.rating ?? -1) - (a.rating ?? -1) : (a.km ?? Infinity) - (b.km ?? Infinity)));
  }, [facilities, origin, type, q, filters, myInsurers]);

  const locate = () => {
    if (!("geolocation" in navigator)) return toast.error(t("Location isn't available on this device"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success(t("Using your current location"));
      },
      () => toast.error(t("Couldn't get your location. Using your county instead.")),
      { timeout: 10000 },
    );
  };

  return (
    <>
      <PageHeader title={t("Find care")} subtitle={gps ? t("Near your current location") : t("Near {{place}}", { place: profile?.county ?? "" })} />
      <Page>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: "places", label: t("Places") },
            { value: "insurers", label: t("Insurers") },
          ]}
        />
        {tab === "insurers" ? (
          <InsurersList onPick={(name) => {
            setFilters({ ...DEFAULT_FILTERS, insurer: name });
            setTab("places");
          }} />
        ) : (
        <>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setShown(PAGE);
              }}
              placeholder={t("Search name, town or service")}
              className="h-11 w-full rounded-2xl border border-ink/10 bg-white pl-9 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <Button variant="outline" size="icon" onClick={locate} aria-label={t("Use my location")}>
            <LocateFixed className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="relative" onClick={() => setShowFilters(true)} aria-label={t("Filters")}>
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-brand-700 px-1.5 text-[10px] font-bold text-white">{activeFilterCount}</span>}
          </Button>
        </div>
        <Chips
          value={type}
          onChange={(v) => {
            setType(v);
            setShown(PAGE);
          }}
          options={[{ value: "all" as const, label: t("All") }, ...(Object.keys(TYPE_LABEL) as FacilityType[]).map((k) => ({ value: k, label: t(TYPE_LABEL[k]) }))]}
        />
        <p className="text-xs text-ink/55">{t("{{count}} places", { count: list.length })}</p>
        {list.slice(0, shown).map((f) => {
          const Icon = TYPE_ICON[f.type];
          const insured = f.insurers.some((i) => myInsurers.includes(i));
          return (
            <Card key={f.id} onClick={() => setSelected(f)} className="space-y-2">
              <div className="flex items-start gap-3">
                <span className="rounded-2xl bg-brand-50 p-2.5 text-brand-700">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{f.name}</p>
                  <p className="text-xs text-ink/55">
                    {f.facilityType ? t(f.facilityType) : t(TYPE_LABEL[f.type])}
                    {f.level ? ` · ${t("Level {{n}}", { n: f.level })}` : ""} · {f.town}, {f.county}
                  </p>
                </div>
                {f.km != null && (
                  <span className="shrink-0 text-xs font-medium text-ink/65">
                    {f.approxLocation ? "~" : ""}
                    {formatKm(f.km)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {f.rating != null && (
                  <Badge tone="amber">
                    <Star className="h-3 w-3 fill-current" />
                    {f.rating.toFixed(1)}
                  </Badge>
                )}
                {f.source === "kmhfl" ? (
                  <Badge tone="green">
                    <BadgeCheck className="h-3 w-3" />
                    {t("MoH listed")}
                  </Badge>
                ) : (
                  <Badge tone="amber">{t("Demo listing")}</Badge>
                )}
                {f.owner && f.source === "kmhfl" && <Badge>{t(OWNER_LABEL[f.owner] ?? f.owner)}</Badge>}
                {insured && <Badge tone="brand">{t("Takes your insurance")}</Badge>}
                {f.delivers && (
                  <Badge tone="blue">
                    <Truck className="h-3 w-3" />
                    {t("Delivers")}
                  </Badge>
                )}
              </div>
            </Card>
          );
        })}
        {list.length > shown && (
          <Button variant="secondary" className="w-full" onClick={() => setShown((n) => n + PAGE)}>
            {t("Show more ({{n}} left)", { n: list.length - shown })}
          </Button>
        )}
        {list.length === 0 && (
          <div className="py-10 text-center text-sm text-ink/55">
            {t("No places match. Try removing some filters.")}
            <div className="mt-3">
              <Button variant="secondary" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
                {t("Clear filters")}
              </Button>
            </div>
          </div>
        )}
        <p className="px-1 pt-2 text-xs text-ink/40">
          {t("Source: {{source}}", { source: t(KMHFL_SOURCE) })} {t("Places marked “Demo listing” are fictional, for trying the app.")}
        </p>
        </>
        )}
      </Page>

      <FiltersSheet open={showFilters} onClose={() => setShowFilters(false)} value={filters} onChange={setFilters} hasInsurance={myInsurers.length > 0} />
      <FacilityDetail
        facility={selected}
        km={selected && origin && selected.approxLocation !== 2 ? distanceKm(origin, selected) : undefined}
        onClose={() => setSelected(null)}
        onBook={(f) => {
          setSelected(null);
          setBooking(f);
        }}
        onShare={(f) => {
          setSelected(null);
          setSharingWith(f.id);
        }}
      />
      <BookingSheet facility={booking} onClose={() => setBooking(null)} />
      <ShareSheet open={!!sharingWith} facilityId={sharingWith ?? undefined} onClose={() => setSharingWith(null)} />
    </>
  );
}

function FiltersSheet({ open, onClose, value, onChange, hasInsurance }: { open: boolean; onClose: () => void; value: Filters; onChange: (f: Filters) => void; hasInsurance: boolean }) {
  const { t } = useTranslation();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Filters")}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onChange(DEFAULT_FILTERS)}>
            {t("Clear")}
          </Button>
          <Button className="flex-1" onClick={onClose}>
            {t("Show results")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t("Service")}>
          {(id) => (
            <Select id={id} value={value.service} onChange={(e) => onChange({ ...value, service: e.target.value })}>
              <option value="">{t("Any service")}</option>
              {SERVICE_GROUPS.map((g) => (
                <optgroup key={g.group} label={t(g.group)}>
                  {g.services.map((s) => (
                    <option key={s} value={s}>
                      {t(s)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          )}
        </Field>
        {hasInsurance && (
          <Checkbox checked={value.myInsurance} onChange={(v) => onChange({ ...value, myInsurance: v })}>
            {t("Only places that accept my insurance")}
          </Checkbox>
        )}
        <Field label={t("Insurance / payment")}>
          {(id) => (
            <Select id={id} value={value.insurer} onChange={(e) => onChange({ ...value, insurer: e.target.value })}>
              <option value="">{t("Any")}</option>
              {INSURERS.map((s) => (
                <option key={s} value={s}>
                  {t(s)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Distance")}>
            {(id) => (
              <Select id={id} value={value.maxKm} onChange={(e) => onChange({ ...value, maxKm: Number(e.target.value) })}>
                <option value={0}>{t("Any distance")}</option>
                {[5, 10, 25, 50, 100].map((k) => (
                  <option key={k} value={k}>
                    {t("Within {{km}} km", { km: k })}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("Rating")}>
            {(id) => (
              <Select id={id} value={value.minRating} onChange={(e) => onChange({ ...value, minRating: Number(e.target.value) })}>
                <option value={0}>{t("Any rating")}</option>
                <option value={4}>4.0+</option>
                <option value={4.5}>4.5+</option>
              </Select>
            )}
          </Field>
        </div>
        <Field label={t("Sort by")}>
          {(id) => (
            <Select id={id} value={value.sort} onChange={(e) => onChange({ ...value, sort: e.target.value as Filters["sort"] })}>
              <option value="distance">{t("Nearest first")}</option>
              <option value="rating">{t("Highest rated")}</option>
            </Select>
          )}
        </Field>
      </div>
    </Sheet>
  );
}

function FacilityDetail({ facility: f, km, onClose, onBook, onShare }: { facility: Facility | null; km?: number; onClose: () => void; onBook: (f: Facility) => void; onShare: (f: Facility) => void }) {
  const { t } = useTranslation();
  const profile = useProfile();
  if (!f) return null;
  const isMine = profile?.nominatedPharmacyId === f.id;
  // Prescription requests through the app only go to partner pharmacies for now; any clinic can be booked.
  const partner = f.source === "demo";
  const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.approxLocation ? `${f.name}, ${f.town}, ${f.county}, Kenya` : `${f.lat},${f.lng}`)}`;
  return (
    <Sheet
      open={!!f}
      onClose={onClose}
      title={f.name}
      footer={
        <div className="flex gap-2">
          {/* Call or get directions */}
          <a href={f.phone ? `tel:${f.phone}` : directions} target={f.phone ? undefined : "_blank"} rel="noreferrer" className="flex">
            <Button variant="outline" size="icon" aria-label={f.phone ? t("Call") : t("Directions")}>
              {f.phone ? <Phone className="h-4 w-4" /> : <Navigation className="h-4 w-4" />}
            </Button>
          </a>
          <Button variant="secondary" className="flex-1" onClick={() => onShare(f)}>
            <Share2 className="h-4 w-4" />
            {t("Share summary")}
          </Button>
          {f.type !== "pharmacy" ? (
            <Button className="flex-1" onClick={() => onBook(f)}>
              <CalendarPlus className="h-4 w-4" />
              {t("Book")}
            </Button>
          ) : partner ? (
            <Button
              className="flex-1"
              disabled={isMine}
              onClick={async () => {
                await db.profile.update("me", { nominatedPharmacyId: f.id });
                toast.success(t("{{name}} is now your pharmacy", { name: f.name }));
              }}
            >
              <Pill className="h-4 w-4" />
              {isMine ? t("Your pharmacy") : t("Make my pharmacy")}
            </Button>
          ) : (
            <a href={directions} target="_blank" rel="noreferrer" className="flex flex-1">
              <Button className="flex-1">
                <Navigation className="h-4 w-4" />
                {t("Directions")}
              </Button>
            </a>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="brand">{f.facilityType ? t(f.facilityType) : t(TYPE_LABEL[f.type])}</Badge>
          {f.level ? <Badge>{t("Level {{n}}", { n: f.level })}</Badge> : null}
          {f.owner && <Badge>{t(OWNER_LABEL[f.owner] ?? f.owner)}</Badge>}
          {f.rating != null && (
            <Badge tone="amber">
              <Star className="h-3 w-3 fill-current" />
              {f.rating.toFixed(1)} ({f.reviews})
            </Badge>
          )}
          {km != null && (
            <Badge>
              {f.approxLocation ? "~" : ""}
              {formatKm(km)}
            </Badge>
          )}
          {f.delivers && <Badge tone="blue">{t("Home delivery")}</Badge>}
        </div>
        <div className="space-y-2 text-sm">
          <a className="flex items-start gap-2 text-ink/80" href={directions} target="_blank" rel="noreferrer">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" />
            <span>
              {[f.address, f.source === "demo" ? f.town : undefined, f.county].filter(Boolean).join(", ")} <span className="text-brand-700">· {t("Map")}</span>
              {f.approxLocation ? <span className="block text-xs text-ink/50">{t("Exact location not listed; the map shows the area.")}</span> : null}
            </span>
          </a>
          {f.hours && (
            <p className="flex items-center gap-2 text-ink/80">
              <Clock className="h-4 w-4 text-ink/40" />
              {t(f.hours)}
            </p>
          )}
          {f.phone ? (
            <a className="flex items-center gap-2 text-brand-700" href={`tel:${f.phone}`}>
              <Phone className="h-4 w-4" />
              {f.phone}
              {f.source === "kmhfl" && <span className="text-xs text-ink/45">{t("(from an older listing; may have changed)")}</span>}
            </a>
          ) : (
            f.source === "kmhfl" && <p className="flex items-center gap-2 text-xs text-ink/50"><Phone className="h-4 w-4 text-ink/30" />{t("No phone number listed")}</p>
          )}
          {f.beds ? <p className="text-xs text-ink/55">{t("{{n}} beds", { n: f.beds })}</p> : null}
          {f.email && (
            <a className="flex items-center gap-2 text-brand-700" href={`mailto:${f.email}`}>
              <Mail className="h-4 w-4" />
              {f.email}
            </a>
          )}
        </div>
        {f.services.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase text-ink/55">{t("Services")}</p>
            <div className="flex flex-wrap gap-1.5">
              {f.services.map((s) => (
                <Badge key={s}>{t(s)}</Badge>
              ))}
            </div>
            {f.source === "kmhfl" && <p className="mt-1 text-[11px] text-ink/45">{t("Based on older official records, the facility's name and its level of care. Call to check what's offered now.")}</p>}
          </div>
        )}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase text-ink/55">{t("Insurance & payment")}</p>
          {f.insurers.length ? (
            <div className="flex flex-wrap gap-1.5">
              {f.insurers.map((s) => (
                <Badge key={s} tone={profile?.insurance.some((i) => i.provider === s) ? "brand" : "slate"}>
                  {t(s)}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink/60">{t("Not listed. Ask the facility which insurers (including SHA) it accepts.")}</p>
          )}
        </div>
        {f.source === "kmhfl" ? (
          <div className="rounded-2xl bg-emerald-50 p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
              <BadgeCheck className="h-4 w-4" />
              {t("On the Ministry of Health facility list")}
            </p>
            <div className="mt-1 divide-y divide-emerald-100 text-emerald-900">
              <KeyValue label={t("Facility code")} value={f.code ? String(f.code) : undefined} />
              <KeyValue label={t("Regulated by")} value={f.licenceBody} />
              <KeyValue label={t("Registration number")} value={f.licenceNumber} />
              <KeyValue label={t("Status")} value={t("Operational (2020 list)")} />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-butter/60 p-3">
            <p className="text-sm font-semibold">{t("Demo listing")}</p>
            <p className="text-xs text-ink/65">{t("A fictional place for trying booking, sharing and prescriptions in the app.")}</p>
          </div>
        )}
        <Notice tone="blue">{t("Listing a facility is not a recommendation. Check that it's right for you.")}</Notice>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs font-medium text-ink/55"
          onClick={() => toast.success(t("Thanks — we'll check this listing."))}
        >
          <Flag className="h-3.5 w-3.5" />
          {t("Report incorrect information")}
        </button>
      </div>
    </Sheet>
  );
}

/** Health cover in Kenya: SHA, private medical insurers, and paying directly. */
function InsurersList({ onPick }: { onPick: (name: string) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const profile = useProfile();
  const mine = new Set(profile?.insurance.map((i) => i.provider) ?? []);
  const groups: { kind: (typeof INSURER_DETAILS)[number]["kind"]; title: string; icon: typeof Landmark }[] = [
    { kind: "public", title: "Public health insurance", icon: Landmark },
    { kind: "private", title: "Private medical insurers", icon: ShieldCheck },
    { kind: "payment", title: "Paying yourself", icon: Pill },
  ];
  return (
    <div className="space-y-4">
      <p className="px-1 text-xs text-ink/55">{t("Companies offering medical cover in Kenya. Tap one to add it to your profile, or to see places known to accept it.")}</p>
      {groups.map((g) => (
        <section key={g.kind} className="space-y-2">
          <h2 className="flex items-center gap-2 px-1 text-sm font-extrabold">
            <g.icon className="h-4 w-4" />
            {t(g.title)}
          </h2>
          <Card className="divide-y divide-ink/5 p-0">
            {INSURER_DETAILS.filter((i) => i.kind === g.kind).map((i) => (
              <div key={i.name} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t(i.name)}</p>
                  {i.note && <p className="text-xs text-ink/55">{t(i.note)}</p>}
                </div>
                {mine.has(i.name) ? (
                  <Badge tone="brand">{t("In your profile")}</Badge>
                ) : (
                  i.kind !== "payment" && (
                    <button type="button" onClick={() => navigate("/bio")} className="text-xs font-bold text-ink/60 underline underline-offset-2">
                      {t("Add to profile")}
                    </button>
                  )
                )}
                <button type="button" onClick={() => onPick(i.name)} className={cn("rounded-full bg-cream px-3 py-1.5 text-xs font-bold")}>
                  {t("Places")}
                </button>
              </div>
            ))}
          </Card>
        </section>
      ))}
      <p className="px-1 text-xs text-ink/45">
        {t("Compiled from public sources in October 2026. Check that an insurer is licensed on the Insurance Regulatory Authority's list before buying cover. Which places accept which insurer is only known for some listings: ask the facility.")}
      </p>
    </div>
  );
}
