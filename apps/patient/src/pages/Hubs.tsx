import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { HEALTH_LINKS, LinkList, MORE_LINKS, Page, PageHeader } from "@/components/layout";

export function HealthHub() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title={t("Health")} />
      <Page>
        <LinkList links={HEALTH_LINKS} onPick={(to) => navigate(to)} />
      </Page>
    </>
  );
}

export function MoreHub() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title={t("More")} />
      <Page>
        <LinkList links={MORE_LINKS} onPick={(to) => navigate(to)} />
      </Page>
    </>
  );
}
