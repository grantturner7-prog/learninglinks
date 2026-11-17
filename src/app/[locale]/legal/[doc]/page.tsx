import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getEnv } from "@/lib/env";

type Props = { params: Promise<{ locale: string; doc: string }> };

const DOCS = { terms: "terms", privacy: "privacy", "educator-waiver": "waiver" } as const;
type DocSlug = keyof typeof DOCS;
const isDoc = (v: string): v is DocSlug => Object.hasOwn(DOCS, v);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!isDoc(doc)) return {};
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: `${t(DOCS[doc])} | LearningLinks`, robots: { index: false } };
}

/**
 * Placeholders. The real legal text is written with a Taiwan lawyer before launch. We do not invent
 * legal wording, and we say plainly that this is a draft until LEGAL_REVIEWED is set.
 */
export default async function LegalPage({ params }: Props) {
  const { locale, doc } = await params;
  if (!isDoc(doc)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  const tc = await getTranslations("common");
  const reviewed = getEnv().LEGAL_REVIEWED;

  return (
    <div className="container-page max-w-3xl py-12">
      {!reviewed ? (
        <p role="note" className="notice-warn mb-6">
          <b>{t("draft")}.</b> {tc("draftBanner")}
        </p>
      ) : null}
      <h1 className="text-4xl font-extrabold">{t(DOCS[doc])}</h1>
      <p className="mt-4 text-lg text-ink-600">{t("pending")}</p>
      <p className="mt-2 text-ink-600">{t("meanwhile")}</p>
    </div>
  );
}
