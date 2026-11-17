import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/logo";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();
  return (
    <footer className="bg-brand-900 py-11 text-sm text-[#cfe6dc]">
      <div className="container-page flex flex-wrap items-start justify-between gap-8">
        <div className="flex max-w-md flex-col gap-3">
          <span className="inline-flex items-center gap-2.5 text-lg font-extrabold text-white">
            <LogoMark size={30} />
            LearningLinks
          </span>
          <p>{t("about")}</p>
          <p>{t("based")}</p>
        </div>
        <nav aria-label={t("legal")} className="flex flex-wrap gap-x-7 gap-y-2">
          <Link href="/legal/terms" className="text-[#e9f6f0] underline-offset-2 hover:underline">
            {t("terms")}
          </Link>
          <Link href="/legal/privacy" className="text-[#e9f6f0] underline-offset-2 hover:underline">
            {t("privacy")}
          </Link>
          <Link href="/legal/educator-waiver" className="text-[#e9f6f0] underline-offset-2 hover:underline">
            {t("waiver")}
          </Link>
          <Link href="/safety" className="text-[#e9f6f0] underline-offset-2 hover:underline">
            {t("safety")}
          </Link>
        </nav>
      </div>
      <p className="container-page mt-8 text-[#9fc3b3]">{t("rights", { year })}</p>
    </footer>
  );
}
