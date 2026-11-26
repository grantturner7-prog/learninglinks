import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { CopyButton } from "@/components/billing/copy-button";
import { requireUser } from "@/lib/auth/session";
import { getBankDetails } from "@/lib/billing/bank";
import { getHolderMembership, getOrderForUser } from "@/lib/billing/orders";
import { PayNow, RefreshWhilePending } from "@/components/billing/pay-now";
import { getDb } from "@/lib/db";
import { getEcpayConfig } from "@/lib/payments/config";
import { getOrderPaymentView } from "@/lib/payments/service";
import { formatMoney } from "@/lib/plans";
import { Link } from "@/i18n/navigation";
import { cancelOrderAction } from "./actions";

type Props = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ from?: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing.meta" });
  return { title: t("order"), robots: { index: false, follow: false } };
}

/** The bank-transfer page: how much, where to send it, and the reference to quote. Only the buyer can open it. */
export default async function OrderPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const { from } = await searchParams;
  setRequestLocale(locale);
  const user = await requireUser(locale, `/orders/${id}`);
  const db = getDb();
  const order = await getOrderForUser(db, user.id, id);
  if (!order) notFound();
  const t = await getTranslations("billing.order");
  const f = await getFormatter();
  const bank = order.provider === "bank_transfer" ? getBankDetails() : null;
  const online = order.provider === "ecpay";
  const pay = online && order.status === "pending" ? await getOrderPaymentView(db, order.id) : null;
  const to = await getTranslations("billing.order.online");
  const cfg = online ? getEcpayConfig() : null;
  const money = formatMoney(order.amount, order.currency, locale);
  const isSchool = order.planCode === "school_tw";
  const holder = isSchool ? null : await getHolderMembership(db, "user", user.id);
  const day = (d: Date) => f.dateTime(d, { dateStyle: "medium" });

  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/dashboard" className="link text-sm">← {t("back")}</Link>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <span className={order.status === "paid" ? "badge" : order.status === "pending" ? "badge-warn" : "badge-muted"}>{online && order.status === "pending" ? to("waiting") : order.status === "paid" && order.refundedAmount >= order.amount ? t("refundedBadge") : t(`status.${order.status}`)}</span>
        <span className="text-sm text-ink-600">{t("placed", { date: day(order.createdAt) })}</span>
      </p>

      {order.status === "paid" ? (
        <section className="card mt-6">
          {holder?.endsAt && !order.membershipEndedAt ? <p className="text-lg font-semibold">{t("paidOn", { date: day(holder.endsAt) })}</p> : null}
          {order.refundedAmount > 0 ? <p className="mt-2" data-testid="refund-note">{t("refunded", { amount: formatMoney(order.refundedAmount, order.currency, locale) })}</p> : null}
          {order.membershipEndedAt ? <p className="mt-2" data-testid="ended-note">{t("endedOn", { date: day(order.membershipEndedAt) })}</p> : null}
          {order.membershipEndedAt ? null : <Link href={isSchool ? "/school/campuses" : "/educators"} className="btn btn-primary mt-4">{isSchool ? t("back") : t("browse")}</Link>}
        </section>
      ) : null}

      {order.status === "pending" && !online ? (
        <>
          <section className="mt-6 rounded-[36px] bg-paper p-6 shadow-soft sm:p-8">
            <p className="text-sm font-extrabold uppercase tracking-wide text-brand-700">{t("reference")}</p>
            <p className="mt-2 break-all font-mono text-4xl font-extrabold tracking-wider sm:text-5xl" data-testid="reference">{order.referenceCode}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3"><CopyButton text={order.referenceCode} label={t("copy")} doneLabel={t("copied")} /><p className="text-sm text-ink-600">{t("referenceHint")}</p></div>
            <div className="mt-6 border-t-2 border-dotted border-ink-300 pt-5">
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
                <li key={k} className="flex items-start gap-3"><span className="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-accent-400 text-sm font-extrabold text-ink-900">{i + 1}</span><span>{t(k)}</span></li>
              ))}
            </ol>
          </section>
        </>
      ) : null}

      {order.status === "pending" && online ? (
        <>
          {from === "ecpay" ? (
            <p role="status" className="notice mt-6">{to("confirming")}</p>
          ) : null}
          {from === "ecpay" ? <RefreshWhilePending /> : null}
          <section className="mt-6 rounded-[36px] bg-paper p-6 shadow-soft sm:p-8">
            <p className="text-sm font-extrabold uppercase tracking-wide text-brand-700">{to("title")}</p>
            <p className="mt-2 text-4xl font-extrabold tabular-nums" data-testid="amount">{money} <span className="text-base font-semibold text-ink-600">{t("vat")}</span></p>
            <p className="mt-3 max-w-xl text-ink-700">{to("intro")}</p>
            <p className="mt-3 font-bold">{to("pick")}</p>
            {pay?.lastFailure ? <p role="alert" className="notice-error mt-4">{to("failed", { reason: pay.lastFailure })}</p> : null}
            <div className="mt-5">
              <PayNow orderId={order.id} locale={locale} methods={(cfg?.methods ?? []).map((m) => ({ key: m, label: to(`methods.${m}.label`), hint: to(`methods.${m}.hint`) }))} labels={{ working: to("working"), errors: { signin: to("errors.signin"), unavailable: to("errors.unavailable"), not_pending: to("errors.not_pending"), rate: to("errors.rate"), server: to("errors.server") } }} />
            </div>
            <p className="hint mt-3">{to("later")}</p>
            <p className="mt-2 text-sm text-ink-600">{to("reference")} <b className="font-mono" data-testid="reference">{order.referenceCode}</b></p>
          </section>
          {pay?.info?.vAccount ? (
            <section className="card mt-5" data-testid="atm-info">
              <h2 className="text-xl font-extrabold">{to("atmTitle")}</h2>
              <p className="mt-2">{to("atm", { bank: pay.info.bankCode ?? "", account: pay.info.vAccount, date: pay.info.expireDate ?? "" })}</p>
            </section>
          ) : null}
          {pay?.info?.paymentNo ? (
            <section className="card mt-5" data-testid="cvs-info">
              <h2 className="text-xl font-extrabold">{to("cvsTitle")}</h2>
              <p className="mt-2">{to("cvs", { code: pay.info.paymentNo, date: pay.info.expireDate ?? "" })}</p>
            </section>
          ) : null}
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
          <p className="hint mb-2">{online ? to("cancelHint") : t("cancelHint")}</p>
          <button type="submit" className="btn btn-secondary">{t("cancel")}</button>
        </form>
      ) : null}
    </div>
  );
}
