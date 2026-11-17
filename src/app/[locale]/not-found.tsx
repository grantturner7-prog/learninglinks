import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <div className="container-page max-w-xl py-20 text-center">
      <h1 className="text-4xl font-extrabold">{t("notFoundTitle")}</h1>
      <p className="mt-3 text-lg text-ink-600">{t("notFoundBody")}</p>
      <Link href="/" className="btn btn-primary mt-6">
        {t("backHome")}
      </Link>
    </div>
  );
}
