import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Compass } from "lucide-react";

export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center px-6 py-24 text-center">
      <div className="shape-flower flex h-20 w-20 items-center justify-center bg-butter text-ink">
        <Compass className="h-8 w-8" />
      </div>
      <h1 className="mt-4 text-3xl font-extrabold">{t("Page not found")}</h1>
      <p className="mt-2 text-sm text-ink/55">{t("The page you're looking for doesn't exist or has moved.")}</p>
      <Link to="/" className="mt-6 rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">
        {t("Go to Home")}
      </Link>
    </div>
  );
}
