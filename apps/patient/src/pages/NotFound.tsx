import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Compass } from "lucide-react";

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center px-6 py-24 text-center">
      <div className="rounded-full bg-brand-50 p-4 text-brand-700">
        <Compass className="h-8 w-8" />
      </div>
      <h1 className="mt-4 text-2xl font-bold">{t("Page not found")}</h1>
      <p className="mt-2 text-sm text-slate-500">{t("The page you're looking for doesn't exist or has moved.")}</p>
      <Link to="/" className="mt-6 rounded-xl bg-brand-700 px-5 py-3 text-sm font-medium text-white">
        {t("Go to Home")}
      </Link>
    </div>
  );
}
