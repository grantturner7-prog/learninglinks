import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "@/components/icons";
import { Link } from "@/i18n/navigation";

/**
 * The standing compliance notice. It is rendered by the locale layout, so EVERY page carries it, and
 * flows that need more (sign-up, checkout) add it again with the acknowledgement checkbox.
 * Wording lives in messages/<locale>/notice.json and is guarded by tests/messages.test.ts.
 *
 * "band" is the every-page presentation: the full canonical wording, stated once and calmly in a band
 * above the footer, with a link to the safety guide. "full" and "tight" are the boxed versions used inside flows.
 */
export async function ComplianceNotice({ variant = "full" }: { variant?: "band" | "full" | "tight" }) {
  const t = await getTranslations("notice");
  if (variant === "band") {
    const tf = await getTranslations("footer");
    return (
      <aside role="note" aria-label={t("title")} className="notice-band" data-testid="standing-notice">
        <div className="container-wide flex flex-wrap items-center gap-x-8 gap-y-2 py-4">
          <p className="min-w-0 flex-[1_1_36rem]">
            <b className="font-extrabold text-ink-900">{t("lead")}</b> {t("full")}
          </p>
          <Link href="/safety" className="link flex-none">
            {tf("safety")}
          </Link>
        </div>
      </aside>
    );
  }
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
