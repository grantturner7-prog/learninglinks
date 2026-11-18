import { getTranslations } from "next-intl/server";
import { reasonsFor, type ReportTargetType } from "@/lib/moderation/reasons";

export interface ReportLabels {
  open: string;
  close: string;
  title: string;
  intro: string;
  reasonLabel: string;
  detailsLabel: string;
  detailsRequiredLabel: string;
  detailsHint: string;
  send: string;
  sending: string;
  thanks: string;
  already: string;
  reasons: { key: string; label: string }[];
  errors: Record<string, string>;
}

/** All the words the report button needs, resolved on the server so the button works anywhere without a message provider. */
export async function getReportLabels(type: ReportTargetType): Promise<ReportLabels> {
  const t = await getTranslations("report");
  const title = type === "educator" ? t("titleEducator") : type === "organization" ? t("titleOrganization") : t("titleJob");
  const errorKeys = ["not_allowed", "not_found", "invalid_reason", "details_required", "too_many", "rate", "signin", "server"] as const;
  return {
    open: t("open"), close: t("close"), title, intro: t("intro"), reasonLabel: t("reasonLabel"), detailsLabel: t("detailsLabel"), detailsRequiredLabel: t("detailsRequired"), detailsHint: t("detailsHint"),
    send: t("send"), sending: t("sending"), thanks: t("thanks"), already: t("already"),
    reasons: reasonsFor(type).map((r) => ({ key: r, label: t(`reasons.${r}`) })),
    errors: Object.fromEntries(errorKeys.map((k) => [k, t(`errors.${k}`)])),
  };
}
