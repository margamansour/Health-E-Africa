import { lazy, Suspense, useEffect } from "react";
import iconUrl from "@/assets/icon.svg";
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router";

// Hash-based addresses for hosts that can only serve one page (e.g. the hosted preview).
const Router = import.meta.env.VITE_HASH_ROUTER === "1" ? HashRouter : BrowserRouter;
import { Toaster } from "sonner";
import { AppShell } from "@/components/layout";
import { useSession } from "@/lib/hooks";
import { ensureFacilities } from "@/db/seed";
import { syncReminders } from "@/db/actions";
import { Welcome } from "@/pages/Welcome";
import { HealthHub, MoreHub } from "@/pages/Hubs";

const HomePage = lazy(() => import("@/pages/Home").then((m) => ({ default: m.HomePage })));
const SummaryPage = lazy(() => import("@/pages/health/Summary").then((m) => ({ default: m.SummaryPage })));
const RecordsPage = lazy(() => import("@/pages/health/Records").then((m) => ({ default: m.RecordsPage })));
const ResultsPage = lazy(() => import("@/pages/health/Results").then((m) => ({ default: m.ResultsPage })));
const ImmunisationsPage = lazy(() => import("@/pages/health/Immunisations").then((m) => ({ default: m.ImmunisationsPage })));
const FindCarePage = lazy(() => import("@/pages/care/FindCare").then((m) => ({ default: m.FindCarePage })));
const AppointmentsPage = lazy(() => import("@/pages/more/Appointments").then((m) => ({ default: m.AppointmentsPage })));
const PrescriptionsPage = lazy(() => import("@/pages/more/Prescriptions").then((m) => ({ default: m.PrescriptionsPage })));
const CalendarPage = lazy(() => import("@/pages/more/Calendar").then((m) => ({ default: m.CalendarPage })));
const BioPage = lazy(() => import("@/pages/more/Bio").then((m) => ({ default: m.BioPage })));
const SettingsPage = lazy(() => import("@/pages/more/Settings").then((m) => ({ default: m.SettingsPage })));
const NotificationsPage = lazy(() => import("@/pages/more/Notifications").then((m) => ({ default: m.NotificationsPage })));
const SharedSummaryPage = lazy(() => import("@/pages/SharedSummary").then((m) => ({ default: m.SharedSummaryPage })));
const NotFound = lazy(() => import("@/pages/NotFound").then((m) => ({ default: m.NotFound })));

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-700">
      <img src={iconUrl} alt="" className="h-16 w-16 animate-pulse" />
    </div>
  );
}

function AuthedRoutes() {
  useEffect(() => {
    void syncReminders();
    const timer = window.setInterval(() => void syncReminders(), 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="health" element={<HealthHub />} />
        <Route path="more" element={<MoreHub />} />
        <Route path="summary" element={<SummaryPage />} />
        <Route path="records" element={<RecordsPage />} />
        <Route path="results" element={<ResultsPage />} />
        <Route path="immunisations" element={<ImmunisationsPage />} />
        <Route path="find-care" element={<FindCarePage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="prescriptions" element={<PrescriptionsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="bio" element={<BioPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="welcome" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function Gate() {
  const session = useSession();
  useEffect(() => {
    void ensureFacilities();
  }, []);
  if (session === undefined) return <Splash />;
  return session.signedIn ? <AuthedRoutes /> : <Welcome />;
}

export function App() {
  return (
    <Router>
      <Routes>
        {/* What a facility sees when it opens a shared link. Doesn't need the patient to be signed in. */}
        <Route
          path="/s/:token"
          element={
            <Suspense fallback={<Splash />}>
              <SharedSummaryPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Gate />} />
      </Routes>
      <Toaster position="top-center" richColors closeButton />
    </Router>
  );
}
