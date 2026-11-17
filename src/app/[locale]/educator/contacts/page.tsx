import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { areaLabel } from "@/lib/geo-labels";
import { listContactsForEducator } from "@/lib/reveal/service";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reveal.contacts" });
  return { title: t("meta"), robots: { index: false } };
}

/** "Who asked for my contact details": names the school, never the family. */
export default async function ContactsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = (await getCurrentUser())!;
  const t = await getTranslations("reveal.contacts");
  const tch = await getTranslations("reveal.channels");
  const tt = await getTranslations("taxonomy.schoolTypes");
  const f = await getFormatter();
  const rows = await listContactsForEducator(getDb(), user.id);
  const list = new Intl.ListFormat(locale, { style: "short", type: "conjunction" });
  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/dashboard" className="link text-sm">← {t("back")}</Link>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-lg text-ink-600">{t("intro")}</p>
      <ul className="mt-6 flex flex-col gap-3">
        {rows.length === 0 ? <li className="card">{t("empty")}</li> : rows.map((r) => (
          <li key={r.id} className="card">
            <p className="text-sm text-ink-500">{f.dateTime(r.at, { dateStyle: "medium", timeStyle: "short" })}</p>
            {r.school ? (
              <>
                <p className="text-lg font-extrabold">{r.school.name}</p>
                <p className="text-sm text-ink-600">{t("schoolPlace", { type: tt(r.school.type as "other"), place: areaLabel(r.school.city, r.school.district ? [r.school.district] : [], locale) || "—" })}</p>
              </>
            ) : (
              <>
                <p className="text-lg font-extrabold">{t("family")}</p>
                <p className="text-sm text-ink-600">{t("familyNote")}</p>
              </>
            )}
            <p className="mt-1 text-sm">{t("saw", { channels: list.format(r.channels.map((c) => tch(c as "email"))) })}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
