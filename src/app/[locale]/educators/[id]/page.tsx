import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { MembersWall } from "@/components/wall";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getEducatorForAudience, getMemberAudience } from "@/lib/directory/service";
import { areaLabel } from "@/lib/geo-labels";
import type { Subject } from "@/lib/taxonomy";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string; id: string }> };

export const metadata: Metadata = { robots: { index: false, follow: false } };

const initials = (n: string) => [...n.trim()].slice(0, 2).join("").toUpperCase() || "·";

/**
 * One educator, for a paying member of the right audience. Anyone else sees the same members-only wall,
 * whether or not the educator exists, so a shared link reveals nothing. There is no public profile page.
 */
export default async function EducatorDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  const db = getDb();
  const audience = user ? await getMemberAudience(db, user) : null;
  if (!audience) return <MembersWall />;
  const e = await getEducatorForAudience(db, audience, id);
  if (!e) notFound();

  const t = await getTranslations("directory.detail");
  const tt = await getTranslations("taxonomy");
  const tc = await getTranslations("common");
  const f = await getFormatter();
  const rate = e.rate ? [e.rate.min, e.rate.max].filter((n): n is number => n !== null).map((n) => `NT$${f.number(n)}`).join(" – ") : null;
  const list = (label: string, items: string[]) => items.length > 0 ? (
    <div><h3 className="label">{label}</h3><div className="flex flex-wrap gap-1.5">{items.map((i) => <span key={i} className="badge">{i}</span>)}</div></div>
  ) : null;

  return (
    <div className="container-page max-w-4xl py-10">
      <Link href="/educators" className="link text-sm">← {t("back")}</Link>
      <article className="card mt-4 flex flex-col gap-5">
        <header className="flex items-center gap-4">
          {e.hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- private, gated, already-resized photo
            <img src={`/api/photos/${e.id}`} alt="" width={88} height={88} className="h-22 w-22 rounded-full object-cover" />
          ) : (
            <span aria-hidden className="inline-flex h-22 w-22 items-center justify-center rounded-full bg-brand-100 text-2xl font-extrabold text-brand-800">{initials(e.displayName)}</span>
          )}
          <div>
            <h1 className="text-3xl font-extrabold">{e.displayName}</h1>
            {e.headline ? <p className="text-lg text-ink-600">{e.headline}</p> : null}
            <p className="text-sm text-ink-500">{areaLabel(e.city, e.districts, locale)}</p>
          </div>
        </header>
        {e.bio ? <div><h2 className="label">{t("about")}</h2><p className="whitespace-pre-line">{e.bio}</p></div> : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {list(t("subjects"), e.subjects.map((s) => tt(`subjects.${s as Subject}`)))}
          {list(t("levels"), e.levels.map((s) => tt(`levels.${s as "kindergarten"}`)))}
          {list(t("languages"), e.languages.map((s) => tt(`languages.${s as "en"}`)))}
          {list(t("modes"), e.teachingModes.map((s) => tt(`modes.${s as "online"}`)))}
          {list(t("openTo"), e.openTo.map((s) => tt(`openTo.${s}`)))}
          {e.experienceBand ? <div><h3 className="label">{tt(`experience.${e.experienceBand as "5-9"}`)}</h3></div> : null}
        </div>
        {rate ? <div><h2 className="label">{t("rate")}</h2><p className="text-lg font-bold text-brand-800">{rate}</p></div> : null}
        {e.workAuthorization ? (
          <div><h2 className="label">{t("workAuth")}</h2><p>{tt(`workAuth.${e.workAuthorization as "citizen_or_pr"}`)}</p><p className="hint">{t("workAuthNote")}</p></div>
        ) : null}
        {e.credentials.length > 0 ? (
          <div>
            <h2 className="label">{t("credentials")} <span className="badge-warn ml-1">{tc("selfDeclared")}</span></h2>
            <ul className="list-disc space-y-1 pl-5">
              {e.credentials.map((c, i) => (
                <li key={i}>{c.label}{c.year ? `, ${c.year}` : ""}{c.proofUrl ? <> · <a className="link" href={c.proofUrl} target="_blank" rel="noopener noreferrer nofollow">{t("proof")}</a></> : null}</li>
              ))}
            </ul>
            <p className="hint">{t("selfDeclared")}</p>
          </div>
        ) : null}
        <p className="rounded-xl bg-brand-50 p-4 text-sm">🔒 {t("contactSoon")}</p>
      </article>
    </div>
  );
}
