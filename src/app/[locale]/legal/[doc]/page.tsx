import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { LEGAL_DOCS, LEGAL_DRAFT_DATE, LEGAL_DRAFT_VERSION, isLegalDocSlug, type LegalDocKey, type LegalDocSlug } from "@/components/legal/constants";
import { resolveLegalDoc, type LegalDocMessages, type WaiverMessages } from "@/components/legal/doc";
import { LegalDocument } from "@/components/legal/legal-document";
import { getEnv } from "@/lib/env";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string; doc: string }> };

const RELATED: Record<LegalDocSlug, readonly LegalDocSlug[]> = {
  terms: ["privacy", "educator-waiver"],
  privacy: ["terms", "educator-waiver"],
  "educator-waiver": ["terms", "privacy"],
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!isLegalDocSlug(doc)) return {};
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: `${t(LEGAL_DOCS[doc])} | LearningLinks`, robots: { index: false } };
}

/**
 * Terms of use, Privacy policy and Educator publication waiver. These are plain-language DRAFTS that describe what the
 * product actually does, written so a Taiwan lawyer can mark them up: every business or legal decision that has not
 * been made is a "[For lawyer: ...]" placeholder. The "draft" banner shows until LEGAL_REVIEWED=true.
 */
export default async function LegalPage({ params }: Props) {
  const { locale, doc } = await params;
  if (!isLegalDocSlug(doc)) notFound();
  setRequestLocale(locale);
  const key = LEGAL_DOCS[doc];
  const t = await getTranslations("legal");
  const tc = await getTranslations("common");
  const tn = await getTranslations("notice");
  const format = await getFormatter();
  const env = getEnv();
  const reviewed = env.LEGAL_REVIEWED;

  // The waiver page quotes the words educators tick (educator.waiver.*) so the public text cannot drift from them.
  const messages = (await getMessages()) as unknown as { legal: { docs: Record<LegalDocKey, LegalDocMessages> }; educator: { waiver: WaiverMessages } };
  const resolved = resolveLegalDoc(key, messages.legal.docs[key], {
    notice: { lead: tn("lead"), full: tn("full"), tutoringWork: tn("tutoringWork"), acknowledge: tn("acknowledge") },
    waiver: key === "waiver" ? messages.educator.waiver : undefined,
  });

  return (
    <div className="container-page max-w-3xl py-12">
      {!reviewed ? (
        <p role="note" className="notice-warn mb-6">
          <b>{t("draft")}.</b> {tc("draftBanner")}
        </p>
      ) : null}
      <LegalDocument
        doc={resolved}
        labels={{
          title: t(key),
          version: t("ui.version", { n: LEGAL_DRAFT_VERSION }),
          lastUpdatedLabel: t("ui.lastUpdated"),
          lastUpdated: format.dateTime(new Date(`${LEGAL_DRAFT_DATE}T00:00:00Z`), { dateStyle: "long", timeZone: "UTC" }),
          lastUpdatedIso: LEGAL_DRAFT_DATE,
          contents: t("ui.contents"),
          noticeTitle: tn("title"),
          legend: reviewed ? undefined : t("ui.legend"),
          backToTop: t("ui.backToTop"),
        }}
        contact={{ email: env.SUPPORT_EMAIL, emailText: t("ui.contactEmail"), pendingText: t("ui.contactPending") }}
        related={RELATED[doc].map((slug) => (
          <Link key={slug} href={`/legal/${slug}`} className="link">
            {t(LEGAL_DOCS[slug])}
          </Link>
        ))}
      />
    </div>
  );
}
