import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "@/components/icons";

/**
 * The standing compliance notice. It is rendered by the locale layout, so EVERY page carries it, and
 * flows that need more (sign-up, checkout) add it again with the acknowledgement checkbox.
 * Wording lives in messages/<locale>/notice.json and is guarded by tests/messages.test.ts.
 */
export async function ComplianceNotice({ variant = "full" }: { variant?: "full" | "tight" }) {
  const t = await getTranslations("notice");
  if (variant === "tight") {
    return (
      <aside role="note" aria-label={t("title")} className="compliance compliance-tight">
        <ShieldAlert size={20} className="mt-0.5" />
        <div>
          <b>{t("lead")}</b> {t("short")}
        </div>
      </aside>
    );
  }
  return (
    <aside role="note" aria-label={t("title")} className="compliance">
      <ShieldAlert size={22} className="mt-0.5" />
      <div>
        <b>{t("lead")}</b> {t("full")}
      </div>
    </aside>
  );
}
