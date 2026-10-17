import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BadgeCheck, Building2, Clock, FlaskConical, Hospital, LocateFixed, Mail, MapPin, Phone, Pill, Search, Share2, SlidersHorizontal, Star, Truck, Flag, CalendarPlus } from "lucide-react";
import { db } from "@/db/db";
import type { Facility, FacilityType } from "@/db/types";
import { Badge, Button, Card, Checkbox, Chips, Field, KeyValue, Notice, Select, Sheet } from "@/components/ui";
import { Page, PageHeader } from "@/components/layout";
import { BookingSheet } from "@/components/BookingSheet";
import { ShareSheet } from "@/components/ShareSheet";
import { INSURERS, SERVICES } from "@/data/kenya";
import { countyCentre, distanceKm, formatKm, type Point } from "@/domain/geo";
import { useFormat, useProfile } from "@/lib/hooks";

const TYPE_ICON: Record<FacilityType, typeof Building2> = { clinic: Building2, hospital: Hospital, lab: FlaskConical, pharmacy: Pill };
const TYPE_LABEL: Record<FacilityType, string> = { clinic: "Clinic", hospital: "Hospital", lab: "Laboratory", pharmacy: "Pharmacy" };

interface Filters {
  service: string;
  insurer: string;
  myInsurance: boolean;
  maxKm: number;
  minRating: number;
  sort: "distance" | "rating";
}

const DEFAULT_FILTERS: Filters = { service: "", insurer: "", myInsurance: false, maxKm: 0, minRating: 0, sort: "distance" };

export function FindCarePage() {
  const { t } = useTranslation();
  const profile = useProfile();
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
    const rows = facilities
      // Only list facilities with a current licence (legal advice: avoid implied endorsement).
      .filter((f) => f.licenceExpires >= new Date().toISOString().slice(0, 10))
      .map((f) => ({ ...f, km: origin ? distanceKm(origin, f) : undefined }))
      .filter((f) => type === "all" || f.type === type)
      .filter((f) => !q || `${f.name} ${f.town} ${f.county} ${f.services.join(" ")}`.toLowerCase().includes(q.toLowerCase()))
      .filter((f) => !filters.service || f.services.includes(filters.service))
      .filter((f) => !filters.insurer || f.insurers.includes(filters.insurer))
      .filter((f) => !filters.myInsurance || f.insurers.some((i) => myInsurers.includes(i)))
      .filter((f) => !filters.maxKm || (f.km != null && f.km <= filters.maxKm))
      .filter((f) => f.rating >= filters.minRating);
    return rows.sort((a, b) => (filters.sort === "rating" ? b.rating - a.rating : (a.km ?? 0) - (b.km ?? 0)));
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
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
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
          onChange={setType}
          options={[{ value: "all" as const, label: t("All") }, ...(Object.keys(TYPE_LABEL) as FacilityType[]).map((k) => ({ value: k, label: t(TYPE_LABEL[k]) }))]}
        />
        <p className="text-xs text-ink/55">{t("{{count}} places", { count: list.length })}</p>
        {list.map((f) => {
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
                    {t(TYPE_LABEL[f.type])} · {f.town}, {f.county}
                  </p>
                </div>
                {f.km != null && <span className="shrink-0 text-xs font-medium text-ink/65">{formatKm(f.km)}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="amber">
                  <Star className="h-3 w-3 fill-current" />
                  {f.rating.toFixed(1)}
                </Badge>
                <Badge tone="green">
                  <BadgeCheck className="h-3 w-3" />
                  {t("Licensed")}
                </Badge>
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
        <p className="px-1 pt-2 text-xs text-ink/40">{t("Demo listings — not real facilities. Live listings will come from the Kenya Master Health Facility List with licence checks.")}</p>
      </Page>

      <FiltersSheet open={showFilters} onClose={() => setShowFilters(false)} value={filters} onChange={setFilters} hasInsurance={myInsurers.length > 0} />
      <FacilityDetail
        facility={selected}
        km={selected && origin ? distanceKm(origin, selected) : undefined}
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
              {SERVICES.map((s) => (
                <option key={s} value={s}>
                  {t(s)}
                </option>
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
  const fmt = useFormat();
  const profile = useProfile();
  if (!f) return null;
  const isMine = profile?.nominatedPharmacyId === f.id;
  return (
    <Sheet
      open={!!f}
      onClose={onClose}
      title={f.name}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => onShare(f)}>
            <Share2 className="h-4 w-4" />
            {t("Share summary")}
          </Button>
          {f.type !== "pharmacy" ? (
            <Button className="flex-1" onClick={() => onBook(f)}>
              <CalendarPlus className="h-4 w-4" />
              {t("Book")}
            </Button>
          ) : (
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
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="brand">{t(TYPE_LABEL[f.type])}</Badge>
          <Badge tone="amber">
            <Star className="h-3 w-3 fill-current" />
            {f.rating.toFixed(1)} ({f.reviews})
          </Badge>
          {km != null && <Badge>{formatKm(km)}</Badge>}
          {f.delivers && <Badge tone="blue">{t("Home delivery")}</Badge>}
        </div>
        <div className="space-y-2 text-sm">
          <a className="flex items-start gap-2 text-ink/80" href={`https://www.google.com/maps/search/?api=1&query=${f.lat},${f.lng}`} target="_blank" rel="noreferrer">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" />
            <span>
              {f.address}, {f.town}, {f.county} <span className="text-brand-700">· {t("Map")}</span>
            </span>
          </a>
          <p className="flex items-center gap-2 text-ink/80">
            <Clock className="h-4 w-4 text-ink/40" />
            {f.hours}
          </p>
          <a className="flex items-center gap-2 text-brand-700" href={`tel:${f.phone}`}>
            <Phone className="h-4 w-4" />
            {f.phone}
          </a>
          {f.email && (
            <a className="flex items-center gap-2 text-brand-700" href={`mailto:${f.email}`}>
              <Mail className="h-4 w-4" />
              {f.email}
            </a>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase text-ink/55">{t("Services")}</p>
          <div className="flex flex-wrap gap-1.5">
            {f.services.map((s) => (
              <Badge key={s}>{t(s)}</Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase text-ink/55">{t("Insurance & payment")}</p>
          <div className="flex flex-wrap gap-1.5">
            {f.insurers.map((s) => (
              <Badge key={s} tone={profile?.insurance.some((i) => i.provider === s) ? "brand" : "slate"}>
                {t(s)}
              </Badge>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
            <BadgeCheck className="h-4 w-4" />
            {t("Licence checked")}
          </p>
          <div className="mt-1 divide-y divide-emerald-100 text-emerald-900">
            <KeyValue label={t("Licensed by")} value={f.licenceBody} />
            <KeyValue label={t("Licence number")} value={f.licenceNumber} />
            <KeyValue label={t("Valid until")} value={fmt.date(f.licenceExpires)} />
            <KeyValue label={t("Last checked")} value={fmt.date(f.licenceVerifiedAt)} />
          </div>
        </div>
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
