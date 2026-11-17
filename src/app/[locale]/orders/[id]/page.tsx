import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { CopyButton } from "@/components/billing/copy-button";
import { requireUser } from "@/lib/auth/session";
import { getBankDetails } from "@/lib/billing/bank";
import { getHolderMembership, getOrderForUser } from "@/lib/billing/orders";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/plans";
import { Link } from "@/i18n/navigation";
import { cancelOrderAction } from "./actions";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing.meta" });
  return { title: t("order"), robots: { index: false, follow: false } };
}

/** The bank-transfer page: how much, where to send it, and the reference to quote. Only the buyer can open it. */
export default async function OrderPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/orders/${id}`);
  const db = getDb();
  const order = await getOrderForUser(db, user.id, id);
  if (!order) notFound();
  const t = await getTranslations("billing.order");
  const f = await getFormatter();
  const bank = getBankDetails();
  const money = formatMoney(order.amount, order.currency, locale);
  const isSchool = order.planCode === "school_tw";
  const holder = isSchool ? null : await getHolderMembership(db, "user", user.id);
  const day = (d: Date) => f.dateTime(d, { dateStyle: "medium" });

  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/dashboard" className="link text-sm">← {t("back")}</Link>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <span className={order.status === "paid" ? "badge" : order.status === "pending" ? "badge-warn" : "badge-muted"}>{t(`status.${order.status}`)}</span>
        <span className="text-sm text-ink-600">{t("placed", { date: day(order.createdAt) })}</span>
      </p>

      {order.status === "paid" ? (
        <section className="card mt-6">
          {holder?.endsAt ? <p className="text-lg font-semibold">{t("paidOn", { date: day(holder.endsAt) })}</p> : null}
          <Link href={isSchool ? "/school/campuses" : "/educators"} className="btn btn-primary mt-4">{isSchool ? t("back") : t("browse")}</Link>
        </section>
      ) : null}

      {order.status === "pending" ? (
        <>
          <section className="mt-6 rounded-[36px] bg-paper p-6 shadow-soft sm:p-8">
            <p className="text-sm font-extrabold uppercase tracking-wide text-brand-700">{t("reference")}</p>
            <p className="mt-2 break-all font-mono text-4xl font-extrabold tracking-wider sm:text-5xl" data-testid="reference">{order.referenceCode}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3"><CopyButton text={order.referenceCode} label={t("copy")} doneLabel={t("copied")} /><p className="text-sm text-ink-600">{t("referenceHint")}</p></div>
            <div className="mt-6 border-t-2 border-dotted border-[#cbb8eb] pt-5">
              <p className="text-sm font-bold text-ink-600">{t("amount")}</p>
              <p className="text-4xl font-extrabold tabular-nums" data-testid="amount">{money} <span className="text-base font-semibold text-ink-600">{t("vat")}</span></p>
            </div>
          </section>

          <section className="card mt-5">
            <h2 className="text-xl font-extrabold">{t("bankTitle")}</h2>
            {bank ? (
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
                <dt className="font-bold text-ink-600">{t("bankName")}</dt><dd className="font-semibold">{bank.bankName}</dd>
                {bank.branch ? <><dt className="font-bold text-ink-600">{t("bankBranch")}</dt><dd className="font-semibold">{bank.branch}</dd></> : null}
                <dt className="font-bold text-ink-600">{t("bankAccountName")}</dt><dd className="font-semibold">{bank.accountName}</dd>
                <dt className="font-bold text-ink-600">{t("bankAccountNumber")}</dt><dd className="font-mono text-lg font-bold">{bank.accountNumber}</dd>
              </dl>
            ) : <p className="notice mt-3">{t("noBank")}</p>}
          </section>

          <section className="card mt-5">
            <h2 className="text-xl font-extrabold">{t("stepsTitle")}</h2>
            <ol className="mt-3 flex flex-col gap-3">
              {(["step1", "step2", "step3"] as const).map((k, i) => (
                <li key={k} className="flex items-start gap-3"><span className="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-brand-900 text-sm font-extrabold text-white">{i + 1}</span><span>{t(k)}</span></li>
              ))}
            </ol>
          </section>
        </>
      ) : null}

      {order.campusList.length > 0 ? (
        <section className="card mt-5">
          <h2 className="text-xl font-extrabold">{t("campuses")}</h2>
          <ul className="mt-2 list-disc pl-5">{order.campusList.map((c) => <li key={c.id}>{c.name}</li>)}</ul>
        </section>
      ) : null}
      <section className="card mt-5">
        <h2 className="text-xl font-extrabold">{t("invoice")}</h2>
        <p className="mt-1">{order.invoice.taxId ? t("invoiceCompany", { title: order.invoice.title ?? "", taxId: order.invoice.taxId }) : t("invoicePersonal")}</p>
      </section>

      {order.status === "pending" ? (
        <form action={cancelOrderAction} className="mt-6">
          <input type="hidden" name="orderId" value={order.id} />
          <p className="hint mb-2">{t("cancelHint")}</p>
          <button type="submit" className="btn btn-secondary">{t("cancel")}</button>
        </form>
      ) : null}
    </div>
  );
}
