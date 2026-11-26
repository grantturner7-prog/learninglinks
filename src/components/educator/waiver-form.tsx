"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, type ReactNode } from "react";
import { acceptWaiverAction } from "@/app/[locale]/educator/actions";
import { WAIVER_REQUIRED_ITEMS } from "@/lib/consent/waiver-items";
import { Link } from "@/i18n/navigation";

const ROW = "flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 bg-white p-4 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus";

export function WaiverForm({ locale }: { locale: string }) {
  const t = useTranslations("educator.waiver");
  const tn = useTranslations("notice");
  const [state, action, pending] = useActionState(acceptWaiverAction, {});
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const done = WAIVER_REQUIRED_ITEMS.filter((k) => ticked[k]).length;
  const total = WAIVER_REQUIRED_ITEMS.length;
  const tag = (label: string, required: boolean) => <span className={required ? "badge-warn ml-1.5" : "badge-muted ml-1.5"}>{label}</span>;

  const item = (key: string, body: ReactNode, required: boolean) => (
    <label key={key} className={ROW}>
      <input type="checkbox" name={`item_${key}`} className="mt-1 h-5 w-5 flex-none accent-brand-700" onChange={(e) => setTicked((s) => ({ ...s, [key]: e.target.checked }))} />
      <span className="text-[15px]">
        {body}
        {tag(required ? t("confirm.required") : t("confirm.optional"), required)}
      </span>
    </label>
  );

  return (
    <form action={action} className="card flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <h2 className="text-xl font-bold">{t("confirm.title")}</h2>
      {state.error === "incomplete" ? <div role="alert" className="notice-error">{t("errors.incomplete")}</div> : null}
      {state.error === "server" ? <div role="alert" className="notice-error">{t("errors.server")}</div> : null}
      {item("terms_privacy", t.rich("confirm.termsPrivacy", {
        terms: (c) => <Link href="/legal/terms" target="_blank" className="link">{c}</Link>,
        privacy: (c) => <Link href="/legal/privacy" target="_blank" className="link">{c}</Link>,
      }), true)}
      {item("publish_to_members", t.rich("confirm.publishToMembers", { b: (c) => <b>{c}</b> }), true)}
      {item("contact_on_request", t("confirm.contactOnRequest"), true)}
      {item("truthful", t("confirm.truthful"), true)}
      {item("notice", tn("acknowledge"), true)}
      {item("marketing", t("confirm.marketing"), false)}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-ink-500" aria-live="polite">{t("progress", { done, total })}</span>
        <button type="submit" className="btn btn-primary btn-lg" disabled={done < total || pending}>
          {pending ? t("submitting") : t("submit")}
        </button>
      </div>
    </form>
  );
}
