import { db, logAudit } from "./db";
import type {
  Appointment,
  AppointmentStatus,
  AppNotification,
  CalendarEvent,
  Consent,
  HealthRecord,
  MedRequest,
  MedRequestStatus,
  Profile,
  RecordCategory,
  ShareSection,
  SummaryShare,
} from "./types";
import { addDays, addMonths, nowIso, parseDateKey, randomToken, toDateKey, today, uid } from "@/lib/utils";
import { planReminders } from "@/domain/reminders";
import { POLICY_VERSION } from "@/lib/policy";

// ---------- Session / account ----------

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return (row?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

export async function recordConsent(c: Omit<Consent, "id" | "grantedAt" | "policyVersion">): Promise<string> {
  const id = uid();
  await db.consents.add({ ...c, id, grantedAt: nowIso(), policyVersion: POLICY_VERSION });
  return id;
}

export async function createAccount(profile: Omit<Profile, "id" | "createdAt" | "status" | "insurance">, consentWording: string, language: string) {
  await db.profile.put({ ...profile, id: "me", insurance: [], createdAt: nowIso(), status: "active" });
  await recordConsent({ purpose: "account", language, wording: consentWording, scope: "Store and organise my health information in this app" });
  await notify({ type: "system", title: "Welcome to Health-e Africa", body: "Your health passport is ready. Start by adding your allergies and medicines.", link: "/bio", key: "welcome" });
}

export async function signOut() {
  await logAudit({ action: "logout", entity: "session" });
  await setSetting("signedIn", false);
}

export async function signIn() {
  await setSetting("signedIn", true);
  await logAudit({ action: "login", entity: "session" });
}

/**
 * Close the account. Health records must be kept for 20 years (Digital Health
 * regulations), so they are archived rather than deleted. Non-health data is removed.
 */
export async function closeAccount() {
  await db.transaction("rw", [db.profile, db.shares, db.notifications, db.settings, db.consents], async () => {
    const now = nowIso();
    await db.profile.update("me", { status: "closed", closedAt: now });
    await db.shares.toCollection().modify((s) => {
      if (!s.revokedAt) s.revokedAt = now;
    });
    await db.notifications.clear();
    await db.consents.toCollection().modify((c) => {
      if (!c.withdrawnAt) c.withdrawnAt = now;
    });
    await db.settings.put({ key: "signedIn", value: false });
  });
  await logAudit({ action: "update", entity: "account", detail: "Account closed; health records archived for statutory retention" });
}

/** Wipe everything on this device (demo only). */
export async function resetDevice() {
  await db.delete();
  window.location.href = "/";
}

// ---------- Notifications ----------

export async function notify(n: Omit<AppNotification, "id" | "createdAt">) {
  if (n.key && (await db.notifications.where("key").equals(n.key).count()) > 0) return;
  const prefs = await getSetting<Record<string, boolean>>("notificationPrefs", {});
  const prefKey = { appointment: "appointments", result: "results", prescription: "prescriptions" }[n.type as string];
  if (prefKey && prefs[prefKey] === false) return;
  await db.notifications.add({ ...n, id: uid(), createdAt: nowIso() });
  if (prefs.browser && "Notification" in window && Notification.permission === "granted") {
    try {
      // No health details in system notifications: they show on the lock screen.
      new Notification("Health-e Africa", { body: genericBody(n.type), icon: `${import.meta.env.BASE_URL}icon.svg` });
    } catch {
      /* some browsers only allow notifications from a service worker */
    }
  }
}

function genericBody(type: AppNotification["type"]) {
  switch (type) {
    case "appointment":
      return "You have an appointment update.";
    case "result":
      return "You have a new result.";
    case "prescription":
      return "Your prescription request has been updated.";
    case "reminder":
      return "You have a health reminder.";
    default:
      return "You have a new update.";
  }
}

export async function markAllRead() {
  const now = nowIso();
  await db.notifications.toCollection().modify((n) => {
    if (!n.readAt) n.readAt = now;
  });
}

// ---------- Reminders ----------

let syncQueue: Promise<void> = Promise.resolve();

/** Recalculate preventive-care reminders and keep calendar events in sync. Runs one at a time. */
export function syncReminders(): Promise<void> {
  syncQueue = syncQueue.then(runSync, runSync);
  return syncQueue;
}

async function runSync() {
  const profile = await db.profile.get("me");
  if (!profile || profile.status !== "active") return;
  const [conditions, medications, immunisations, ruleStatus] = await Promise.all([
    db.conditions.toArray(),
    db.medications.toArray(),
    db.immunisations.toArray(),
    db.ruleStatus.toArray(),
  ]);
  const plan = planReminders({ profile, conditions, medications, immunisations, ruleStatus, today: new Date() });
  const prefs = await getSetting<Record<string, boolean>>("notificationPrefs", {});

  await db.transaction("rw", db.events, async () => {
    const existing = await db.events.where("source").equals("reminder").toArray();
    const keep = new Set<string>();
    for (const p of plan) {
      if (!p.dueDate) continue;
      keep.add(p.key);
      const ev = existing.find((e) => e.ruleId === p.key);
      const start = parseDateKey(p.dueDate);
      start.setHours(9, 0, 0, 0);
      if (ev) {
        if (ev.start !== start.toISOString() || ev.title !== p.title) {
          await db.events.update(ev.id, { start: start.toISOString(), title: p.title, doneAt: undefined });
        }
      } else {
        await db.events.add({ id: uid(), title: p.title, type: p.type, start: start.toISOString(), allDay: true, notes: p.description, source: "reminder", ruleId: p.key });
      }
    }
    for (const e of existing) if (!keep.has(e.ruleId ?? "")) await db.events.delete(e.id);
  });

  const enabled = (type: string) => prefs[type] !== false;
  const categoryOf = (p: (typeof plan)[number]) => (p.type === "vaccine" ? "vaccines" : p.type === "review" ? "medication" : "screening");
  const due = plan.filter((p) => p.state === "due" && enabled(categoryOf(p)));

  // Overdue items with a known date get their own notification.
  for (const p of due.filter((x) => x.dueDate)) {
    await notify({ type: "reminder", title: "Health check due", body: p.title, link: p.link, key: `${p.key}:${p.dueDate}` });
  }
  // Checks never recorded are grouped into one notification a month, to avoid flooding.
  const unknown = due.filter((x) => !x.dueDate);
  if (unknown.length) {
    await notify({
      type: "reminder",
      title: "Health checks to review",
      body: unknown.map((x) => x.title).join(", "),
      link: "/calendar?tab=checks",
      key: `checks-unknown:${today().slice(0, 7)}`,
    });
  }

  // Upcoming appointment reminders (24 hours before).
  if (enabled("appointments")) {
    const soon = addDays(new Date(), 1).toISOString();
    const upcoming = await db.events.where("start").between(nowIso(), soon).toArray();
    for (const e of upcoming.filter((x) => x.type === "appointment")) {
      await notify({ type: "appointment", title: "Appointment tomorrow", body: e.title, link: "/appointments", key: `appt-24h:${e.id}` });
    }
  }
}

export async function markRuleDone(ruleKey: string, date: string) {
  if (ruleKey.startsWith("rule:")) {
    await db.ruleStatus.put({ ruleId: ruleKey.slice(5), lastDone: date });
  } else if (ruleKey.startsWith("medreview:")) {
    const id = ruleKey.slice(10);
    await db.medications.update(id, { reviewDate: toDateKey(addMonths(parseDateKey(date), 12)) });
  } else if (ruleKey.startsWith("vaccine:")) {
    await db.immunisations.update(ruleKey.slice(8), { dateGiven: date });
  }
  await syncReminders();
}

export async function dismissRule(ruleId: string) {
  await db.ruleStatus.put({ ...(await db.ruleStatus.get(ruleId)), ruleId, dismissed: true });
  await syncReminders();
}

// ---------- Records ----------

export async function addRecord(input: {
  category: RecordCategory;
  title: string;
  date: string;
  facilityName?: string;
  notes?: string;
  file?: File;
  source?: HealthRecord["source"];
}): Promise<string> {
  const id = uid();
  let fileId: string | undefined;
  if (input.file) {
    fileId = uid();
    await db.files.add({ id: fileId, name: input.file.name, type: input.file.type, size: input.file.size, blob: input.file });
  }
  await db.records.add({
    id,
    category: input.category,
    title: input.title,
    date: input.date,
    facilityName: input.facilityName,
    notes: input.notes,
    source: input.source ?? "patient",
    fileId,
    fileName: input.file?.name,
    fileType: input.file?.type,
    createdAt: nowIso(),
    seenAt: input.source === "facility" ? undefined : nowIso(),
  });
  return id;
}

// ---------- Sharing ----------

export async function createShare(input: {
  summaryType: SummaryShare["summaryType"];
  sections: ShareSection[];
  recordIds: string[];
  facilityId?: string;
  recipientLabel: string;
  purpose: string;
  hours: number;
  consentWording: string;
  language: string;
}): Promise<SummaryShare> {
  const expiresAt = new Date(Date.now() + input.hours * 3600_000).toISOString();
  const consentId = await recordConsent({
    purpose: "share",
    language: input.language,
    wording: input.consentWording,
    scope: `${input.sections.join(", ")} → ${input.recipientLabel}`,
    expiresAt,
  });
  const share: SummaryShare = {
    id: uid(),
    token: randomToken(),
    summaryType: input.summaryType,
    sections: input.sections,
    recordIds: input.recordIds,
    facilityId: input.facilityId,
    recipientLabel: input.recipientLabel,
    purpose: input.purpose,
    consentId,
    createdAt: nowIso(),
    expiresAt,
  };
  await db.shares.add(share);
  await logAudit({ action: "share", entity: "shares", entityId: share.id, detail: `Shared with ${input.recipientLabel}` });
  return share;
}

export async function revokeShare(id: string) {
  const s = await db.shares.get(id);
  if (!s || s.revokedAt) return;
  const now = nowIso();
  await db.shares.update(id, { revokedAt: now });
  await db.consents.update(s.consentId, { withdrawnAt: now });
  await logAudit({ action: "revoke", entity: "shares", entityId: id });
}

export async function recordShareAccess(shareId: string, viewer: string) {
  await db.shareAccess.add({ id: uid(), shareId, at: nowIso(), viewer });
  await logAudit({ action: "view", entity: "shares", entityId: shareId, actor: viewer, detail: "Shared summary opened" });
  const s = await db.shares.get(shareId);
  await notify({ type: "share", title: "Your summary was viewed", body: `${s?.recipientLabel ?? "Someone"} opened your shared summary.`, link: "/summary?tab=history" });
}

// ---------- Appointments ----------

export async function requestAppointment(input: {
  facilityId: string;
  service?: string;
  preferredDate: string;
  preferredTime: string;
  reason: string;
  shareSummary: boolean;
  consentWording: string;
  language: string;
}) {
  const facility = await db.facilities.get(input.facilityId);
  let shareId: string | undefined;
  if (input.shareSummary && facility) {
    // Access lasts until 14 days after the requested date.
    const until = addDays(parseDateKey(input.preferredDate), 14).getTime();
    const hours = Math.max(24, Math.ceil((until - Date.now()) / 3600_000));
    const share = await createShare({
      summaryType: "full",
      sections: ["identity", "emergency", "conditions", "allergies", "medications", "labs", "immunisations"],
      recordIds: [],
      facilityId: facility.id,
      recipientLabel: facility.name,
      purpose: `Appointment: ${input.reason}`,
      hours,
      consentWording: input.consentWording,
      language: input.language,
    });
    shareId = share.id;
  }
  const appt: Appointment = {
    id: uid(),
    facilityId: input.facilityId,
    service: input.service,
    preferredDate: input.preferredDate,
    preferredTime: input.preferredTime,
    reason: input.reason,
    status: "pending",
    shareId,
    history: [{ status: "pending", at: nowIso() }],
    createdAt: nowIso(),
  };
  await db.appointments.add(appt);
  await notify({ type: "appointment", title: "Appointment requested", body: `Request sent to ${facility?.name}. You'll be notified when they respond.`, link: "/appointments" });
  return appt;
}

async function setAppointmentStatus(id: string, status: AppointmentStatus, patch: Partial<Appointment> = {}, note?: string) {
  const a = await db.appointments.get(id);
  if (!a) return;
  await db.appointments.update(id, { ...patch, status, history: [...a.history, { status, at: nowIso(), note }] });
}

export async function cancelAppointment(id: string, reason?: string) {
  const a = await db.appointments.get(id);
  if (!a) return;
  await setAppointmentStatus(id, "cancelled", {}, reason);
  if (a.eventId) await db.events.delete(a.eventId);
  if (a.shareId) await revokeShare(a.shareId);
}

async function confirmAppointment(id: string, startIso: string) {
  const a = await db.appointments.get(id);
  if (!a) return;
  const facility = await db.facilities.get(a.facilityId);
  const eventId = a.eventId ?? uid();
  const ev: CalendarEvent = {
    id: eventId,
    title: `${a.service ?? "Appointment"} at ${facility?.name ?? "facility"}`,
    type: "appointment",
    start: startIso,
    allDay: false,
    notes: a.reason,
    source: "appointment",
    appointmentId: a.id,
    remindMinutesBefore: 24 * 60,
  };
  await db.events.put(ev);
  await setAppointmentStatus(id, "confirmed", { confirmedStart: startIso, eventId });
  await notify({ type: "appointment", title: "Appointment confirmed", body: `${facility?.name} confirmed your appointment. It's been added to your calendar.`, link: "/appointments" });
}

export async function acceptProposedTime(id: string) {
  const a = await db.appointments.get(id);
  if (a?.confirmedStart) await confirmAppointment(id, a.confirmedStart);
}

/**
 * DEMO ONLY: simulates the facility side until the Partner Portal exists.
 */
export async function simulateFacilityResponse(id: string, action: "confirm" | "propose" | "decline" | "complete") {
  const a = await db.appointments.get(id);
  if (!a) return;
  const facility = await db.facilities.get(a.facilityId);
  const requested = parseDateKey(a.preferredDate);
  const [hh, mm] = (a.preferredTime || "09:00").split(":").map(Number);
  requested.setHours(hh ?? 9, mm ?? 0, 0, 0);

  if (action === "confirm") return confirmAppointment(id, requested.toISOString());
  if (action === "propose") {
    const alt = addDays(requested, 1);
    alt.setHours(11, 0, 0, 0);
    await setAppointmentStatus(id, "proposed", { confirmedStart: alt.toISOString() }, "The facility proposed a new time");
    await notify({ type: "appointment", title: "New time proposed", body: `${facility?.name} proposed a different time. Please review.`, link: "/appointments" });
    return;
  }
  if (action === "decline") {
    await setAppointmentStatus(id, "declined", {}, "No availability");
    if (a.shareId) await revokeShare(a.shareId);
    await notify({ type: "appointment", title: "Appointment declined", body: `${facility?.name} couldn't take your request. Try another facility.`, link: "/find-care" });
    return;
  }
  // complete: the visit happened and the facility sends results back.
  await setAppointmentStatus(id, "completed");
  if (a.eventId) await db.events.update(a.eventId, { doneAt: nowIso() });
  await addRecord({
    category: "letter",
    title: `Visit summary — ${facility?.name ?? "facility"}`,
    date: today(),
    facilityName: facility?.name,
    notes: `Seen for: ${a.reason}. Examination unremarkable. Blood tests taken; results attached to your Results page.`,
    source: "facility",
  });
  const panelId = uid();
  await db.labPanels.add({ id: panelId, name: "Full blood count", date: today(), facilityName: facility?.name, source: "facility", createdAt: nowIso() });
  await db.labResults.bulkAdd([
    { id: uid(), panelId, analyte: "Haemoglobin", value: 12.8, unit: "g/dL", refLow: 12, refHigh: 17, date: today() },
    { id: uid(), panelId, analyte: "White cell count", value: 7.1, unit: "x10^9/L", refLow: 4, refHigh: 11, date: today() },
    { id: uid(), panelId, analyte: "Platelets", value: 268, unit: "x10^9/L", refLow: 150, refHigh: 400, date: today() },
  ]);
  await notify({ type: "result", title: "New results received", body: `${facility?.name} sent your visit summary and blood results.`, link: "/records" });
}

// ---------- Prescriptions ----------

export async function submitMedRequest(input: Omit<MedRequest, "id" | "status" | "history" | "createdAt">) {
  const req: MedRequest = { ...input, id: uid(), status: "submitted", history: [{ status: "submitted", at: nowIso() }], createdAt: nowIso() };
  await db.medRequests.add(req);
  const pharmacy = await db.facilities.get(input.pharmacyId);
  await notify({ type: "prescription", title: "Request sent", body: `Your request was sent to ${pharmacy?.name}.`, link: "/prescriptions?tab=requests" });
  return req;
}

async function setMedStatus(id: string, status: MedRequestStatus, note?: string) {
  const r = await db.medRequests.get(id);
  if (!r) return;
  await db.medRequests.update(id, { status, history: [...r.history, { status, at: nowIso(), note }] });
  const labels: Partial<Record<MedRequestStatus, string>> = {
    awaiting_prescriber: "Waiting for prescriber authorisation",
    approved: "Approved by the pharmacist",
    dispensed: "Your medicines are ready",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    rejected: "Request not approved",
  };
  if (labels[status]) await notify({ type: "prescription", title: labels[status]!, body: note ?? "", link: "/prescriptions?tab=requests" });
}

export async function cancelMedRequest(id: string) {
  await setMedStatus(id, "cancelled");
}

/** DEMO ONLY: moves a request to its next step, as the pharmacy would. */
export async function simulatePharmacyStep(id: string) {
  const r = await db.medRequests.get(id);
  if (!r) return;
  const needsPrescriber = r.type === "acute" || !r.prescriptionRecordId;
  const flow: MedRequestStatus[] =
    r.delivery === "delivery"
      ? ["submitted", "approved", "dispensed", "out_for_delivery", "delivered"]
      : ["submitted", "approved", "dispensed", "delivered"];
  if (r.status === "submitted" && needsPrescriber) {
    return setMedStatus(id, "awaiting_prescriber", "The pharmacist needs a valid prescription from your prescriber for prescription-only medicines.");
  }
  if (r.status === "awaiting_prescriber") return setMedStatus(id, "approved", "Prescription confirmed with your prescriber.");
  const i = flow.indexOf(r.status);
  if (i >= 0 && i < flow.length - 1) return setMedStatus(id, flow[i + 1]!);
}

export async function simulatePharmacyReject(id: string) {
  await setMedStatus(id, "rejected", "The pharmacist could not verify a valid prescription. Please contact your prescriber.");
}

// ---------- Export ----------

export async function exportAllData(): Promise<Blob> {
  const tables = [
    "profile", "conditions", "allergies", "medications", "immunisations", "records", "labPanels", "labResults",
    "appointments", "medRequests", "shares", "shareAccess", "events", "consents", "audit",
  ] as const;
  const out: Record<string, unknown> = { exportedAt: nowIso(), format: "health-e-africa/v1" };
  for (const t of tables) out[t] = await db.table(t).toArray();
  await logAudit({ action: "export", entity: "account", detail: "Full data export" });
  return new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
}

