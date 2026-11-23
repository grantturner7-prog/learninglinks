import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { getFormatter, setRequestLocale } from "next-intl/server";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { RefundForm } from "@/components/admin/refund-form";
import { requireAdmin } from "@/lib/auth/session";
import { findOrderByReference, listPendingOrdersForAdmin } from "@/lib/billing/orders";
import { getOrderRefundState, listRecentPaidOrders, type MembershipState } from "@/lib/billing/refunds";
import { getDb } from "@/lib/db";
import { listOpenReports, listSuspended } from "@/lib/moderation/service";
import { listPendingClaims } from "@/lib/orgs/service";
import { onlinePaymentEnabled } from "@/lib/payments/config";
import { listPaymentsNeedingReview } from "@/lib/payments/service";
import { formatMoney } from "@/lib/plans";
import { cancelOrderAsAdminAction, markPaymentReviewedAction, reinstateAction, removeSchoolPhotoAction, reviewClaimAction, reviewReportAction } from "./actions";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ ref?: string | string[]; confirmed?: string | string[]; again?: string }> };

export const metadata: Metadata = { title: "Admin | LearningLinks", robots: { index: false, follow: false } };

/**
 * Admin desk (English only: it is for the owner and helpers, not the public). Two queues: bank transfers to
 * confirm, and school claims to approve. Everything it does is written to the audit log.
 */
export default async function AdminPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale);
  const db = getDb();
  const f = await getFormatter();
  const ref = (Array.isArray(sp.ref) ? sp.ref[0] : sp.ref)?.trim().slice(0, 40) ?? "";
  const confirmedRef = (Array.isArray(sp.confirmed) ? sp.confirmed[0] : sp.confirmed)?.trim().slice(0, 40) ?? "";
  const confirmedOrder = confirmedRef ? await findOrderByReference(db, confirmedRef) : null;
  const [orders, claims, found, reports, suspended, reviews, recentPaid] = await Promise.all([listPendingOrdersForAdmin(db), listPendingClaims(db), ref ? findOrderByReference(db, ref) : Promise.resolve(null), listOpenReports(db), listSuspended(db), listPaymentsNeedingReview(db), listRecentPaidOrders(db, 10)]);
  const foundState = found?.status === "paid" ? await getOrderRefundState(db, found.id) : null;
  const stateLabel: Record<MembershipState, string> = { active: "running", upcoming: "starts later", expired: "ran its full term", ended_early: "ended early" };
  const day = (d: Date) => f.dateTime(d, { dateStyle: "medium" });
  // Today's date in Taipei as YYYY-MM-DD: the default for "received on".
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date());
  const money = (n: number, c: string) => formatMoney(n, c, locale);
  const shown = found && found.status === "pending" && !orders.some((o) => o.id === found.id) ? [found, ...orders] : orders;

  return (
    <div className="container-page max-w-5xl py-10">
      <h1 className="text-4xl font-extrabold tracking-tight">Admin desk</h1>
      <p className="mt-2 text-ink-600">Confirm bank transfers, review school claims, and refund or end a membership. Online (ECPay) payments confirm themselves. Memberships start the moment a payment is confirmed.</p>

      {confirmedOrder?.status === "paid" ? (
        <p role="status" className="notice mt-6 font-bold" data-testid="confirmed-banner">
          {sp.again ? `${confirmedOrder.referenceCode} was already confirmed. Nothing changed.` : `Confirmed ${confirmedOrder.referenceCode}. The membership has started and the buyer has been emailed.`}
        </p>
      ) : null}

      <section className="card mt-8">
        <h2 className="text-2xl font-extrabold">Find an order by reference</h2>
        <p className="mt-1 text-ink-600">Open a paid order to refund it or end a membership early.</p>
        <form method="get" className="mt-3 flex flex-wrap gap-3" role="search">
          <label htmlFor="ref" className="sr-only">Reference code</label>
          <input id="ref" name="ref" className="field max-w-xs" placeholder="LL-XXXX-XXXX" defaultValue={ref} />
          <button type="submit" className="btn btn-secondary">Find</button>
        </form>
        {ref && !found ? <p className="mt-3">No order with that reference.</p> : null}
        {found && found.status === "cancelled" ? <p className="mt-3">{found.referenceCode} is <b>cancelled</b>.</p> : null}
        {found && found.status === "pending" ? <p className="mt-3">{found.referenceCode} is <b>waiting for payment</b>. It is in the list further down.</p> : null}

        {found && found.status === "paid" && foundState ? (
          <div className="mt-4 border-t-2 border-dotted border-[#cbb8eb] pt-4" data-testid="paid-order">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-mono text-xl font-extrabold">{found.referenceCode}</span>
              <span className="text-xl font-extrabold">{money(foundState.paid, found.currency)}</span>
              <span className="rounded-full bg-brand-100 px-3 py-0.5 text-xs font-extrabold text-ink-900">{found.provider === "ecpay" ? "Online (ECPay)" : "Bank transfer"}</span>
              <span className="text-sm text-ink-600">{found.planCode === "school_tw" ? `School, ${found.campuses} campus${found.campuses === 1 ? "" : "es"}` : "Family"}{found.paidAt ? ` · paid ${day(found.paidAt)}` : ""}</span>
            </div>
            <p className="mt-1 text-sm">{found.buyerName} · {found.buyerEmail ?? "account deleted"}</p>

            <h3 className="mt-4 text-lg font-extrabold">Memberships on this order</h3>
            <ul className="mt-1 flex flex-col gap-1" data-testid="order-memberships">
              {foundState.memberships.map((m) => (
                <li key={m.id} className="text-sm" data-testid="order-membership">
                  <b>{m.campus ?? "Family membership"}</b> · {day(m.startsAt)} to {day(m.endsAt)} · <span className={m.state === "ended_early" ? "font-bold text-danger-600" : ""}>{stateLabel[m.state]}</span>
                  {m.state === "ended_early" && m.originalEndsAt ? ` (would have run to ${day(m.originalEndsAt)})` : ""}
                  {m.endedEarlyReason ? ` · ${m.endedEarlyReason}` : ""}
                </li>
              ))}
            </ul>

            <h3 className="mt-4 text-lg font-extrabold">Refunds so far</h3>
            {foundState.refunds.length === 0 ? <p className="text-sm text-ink-600" data-testid="no-refunds">None.</p> : (
              <ul className="mt-1 flex flex-col gap-1" data-testid="order-refunds">
                {foundState.refunds.map((r) => (
                  <li key={r.id} className="text-sm" data-testid="order-refund">{money(r.amount, found.currency)} · sent {r.refundedOn} by {r.method === "ecpay_backoffice" ? "ECPay back office" : r.method === "bank_transfer" ? "bank transfer" : "another way"} · {r.reason}</li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-sm text-ink-600">Paid {money(foundState.paid, found.currency)}, refunded {money(foundState.refunded, found.currency)}, {money(foundState.refundable, found.currency)} left to refund.</p>

            <RefundForm
              orderId={found.id}
              requestId={randomUUID()}
              today={today}
              refundable={foundState.refundable}
              buyerEmail={found.buyerEmail}
              endable={foundState.memberships.filter((m) => m.state === "active" || m.state === "upcoming").map((m) => ({ id: m.id, label: m.campus ?? "Family membership", runs: `${day(m.startsAt)} to ${day(m.endsAt)}` }))}
            />
          </div>
        ) : null}

        {recentPaid.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-lg font-extrabold">Recently paid</h3>
            <ul className="mt-1 flex flex-col gap-1" data-testid="recent-paid">
              {recentPaid.map((p) => (
                <li key={p.id} className="text-sm">
                  <a className="link font-mono font-bold" href={`?ref=${encodeURIComponent(p.referenceCode)}`}>{p.referenceCode}</a> · {money(p.amount, "TWD")} · {p.planCode === "school_tw" ? `School, ${p.campuses} campus${p.campuses === 1 ? "" : "es"}` : "Family"}{p.buyerEmail ? ` · ${p.buyerEmail}` : ""}{p.paidAt ? ` · ${day(p.paidAt)}` : ""}{p.refunded > 0 ? ` · refunded ${money(p.refunded, "TWD")}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-extrabold">Reports to review ({reports.length})</h2>
        <ul className="mt-3 flex flex-col gap-4">
          {reports.length === 0 ? <li className="card">No reports waiting.</li> : reports.map((r) => (
            <li key={r.id} className="card" data-testid="open-report">
              <p className="text-sm text-ink-600">{r.targetType} · reported {f.dateTime(r.createdAt, { dateStyle: "medium", timeStyle: "short" })} · reason: <b>{r.reason}</b></p>
              <p className="text-xl font-extrabold">{r.target.label}</p>
              <p className="text-sm text-ink-600">{r.target.sub ? `${r.target.sub} · ` : ""}now: {r.target.state}</p>
              {r.details ? <p className="mt-2 whitespace-pre-line">{r.details}</p> : null}
              <p className="mt-1 text-sm text-ink-600">Reported by {r.reporterEmail}. The reported person is never told who.</p>
              {r.alsoReported > 0 ? <p className="notice mt-2">{r.alsoReported} other open report(s) about the same {r.targetType}. Acting closes them all.</p> : null}
              {r.targetType === "organization" && r.target.pictureVersion ? (
                <div className="mt-3 flex flex-wrap items-start gap-4" data-testid="report-picture">
                  {/* eslint-disable-next-line @next/next/no-img-element -- served by our own gated route */}
                  <img src={`/api/schools/${r.targetId}/photo?v=${r.target.pictureVersion}`} alt={`The picture shown for ${r.target.label}`} width={240} height={150} className="h-[150px] w-[240px] rounded-2xl object-cover" />
                  <form action={removeSchoolPhotoAction} className="flex max-w-sm flex-col gap-2">
                    <input type="hidden" name="organizationId" value={r.targetId} />
                    <p className="text-sm text-ink-600">This is the picture shown for the school. Take it down if it shows people, shows the wrong place, or the school asked. The school stays listed; then dismiss the report.</p>
                    <button type="submit" className="btn btn-secondary self-start">Remove the picture</button>
                  </form>
                </div>
              ) : null}
              <form action={reviewReportAction} className="mt-3 flex flex-wrap gap-3">
                <input type="hidden" name="reportId" value={r.id} />
                <button type="submit" name="decision" value="action" className="btn btn-primary" disabled={!r.target.exists}>{r.targetType === "educator" ? "Hide the profile (suspend)" : r.targetType === "organization" ? "Suspend the school" : "Remove the job post"}</button>
                <button type="submit" name="decision" value="dismiss" className="btn btn-secondary">Dismiss</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      {suspended.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl font-extrabold">Suspended right now ({suspended.length})</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {suspended.map((s) => (
              <li key={s.id} className="card flex flex-wrap items-center gap-3" data-testid="suspended-item">
                <span className="flex-1"><b>{s.label}</b> <span className="text-sm text-ink-600">{s.type === "educator" ? "educator profile" : "school"}{s.sub ? ` · ${s.sub}` : ""}</span></span>
                <form action={reinstateAction}><input type="hidden" name="type" value={s.type} /><input type="hidden" name="id" value={s.id} /><button type="submit" className="btn btn-secondary">Reinstate</button></form>
              </li>
            ))}
          </ul>
          <p className="hint mt-2">A reinstated profile comes back hidden. The educator decides when to publish it again.</p>
        </section>
      ) : null}

      {reviews.length > 0 ? (
        <section className="mt-10" data-testid="payment-review">
          <h2 className="text-2xl font-extrabold">Online payments to check ({reviews.length})</h2>
          <p className="mt-1 text-ink-600">ECPay told us something the site would not decide by itself (a different amount, a second payment, or a payment for an order that was cancelled). Check it in the ECPay merchant dashboard, refund or fix by hand if needed, then mark it checked.</p>
          <ul className="mt-3 flex flex-col gap-4">
            {reviews.map((r) => (
              <li key={r.id} className="card" data-testid="payment-review-item">
                <p className="text-sm text-ink-600">{f.dateTime(r.receivedAt, { dateStyle: "medium", timeStyle: "short" })} · ECPay trade no. <span className="font-mono">{r.merchantTradeNo ?? "unknown"}</span>{r.orderReference ? <> · order <span className="font-mono">{r.orderReference}</span></> : null}</p>
                <p className="mt-1">{r.note ?? "Needs a look."}</p>
                <form action={markPaymentReviewedAction} className="mt-3"><input type="hidden" name="eventId" value={r.id} /><button type="submit" className="btn btn-secondary">Mark as checked</button></form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-2xl font-extrabold">Waiting for payment ({shown.length})</h2>
        {onlinePaymentEnabled() ? <p className="mt-1 text-ink-600">Orders marked <b>Online</b> are waiting for the buyer to pay on ECPay. They confirm themselves when ECPay tells us the money arrived. Only confirm one by hand if you have checked the ECPay dashboard and the notice never reached us.</p> : null}
        <ul className="mt-3 flex flex-col gap-4">
          {shown.length === 0 ? <li className="card">Nothing is waiting.</li> : shown.map((o) => (
            <li key={o.id} className="card" data-testid="pending-order">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-mono text-xl font-extrabold">{o.referenceCode}</span>
                <span className="text-xl font-extrabold">{money(o.amount, o.currency)}</span>
                <span className="rounded-full bg-brand-100 px-3 py-0.5 text-xs font-extrabold text-ink-900" data-testid="order-provider">{o.provider === "ecpay" ? "Online (ECPay)" : "Bank transfer"}</span>
                <span className="text-sm text-ink-600">{o.planCode === "school_tw" ? `School, ${o.campuses} campus${o.campuses === 1 ? "" : "es"}` : "Family"} · placed {f.dateTime(o.createdAt, { dateStyle: "medium" })}</span>
              </div>
              <p className="mt-1 text-sm">{o.buyerName} · {o.buyerEmail}</p>
              {o.campusList.length > 0 ? <p className="text-sm text-ink-600">Campuses: {o.campusList.map((c) => c.name).join(", ")}</p> : null}
              <p className="text-sm text-ink-600">Invoice: {o.invoice.taxId ? `${o.invoice.title}, 統一編號 ${o.invoice.taxId}` : "personal"}{o.invoice.email ? ` · ${o.invoice.email}` : ""}</p>
              <ConfirmForm orderId={o.id} amount={o.amount} today={today} locale={locale} />
              <form action={cancelOrderAsAdminAction} className="mt-2"><input type="hidden" name="orderId" value={o.id} /><button type="submit" className="link text-sm font-bold">Cancel this order</button></form>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-extrabold">School claims to review ({claims.length})</h2>
        <ul className="mt-3 flex flex-col gap-4">
          {claims.length === 0 ? <li className="card">No claims waiting.</li> : claims.map((c) => (
            <li key={c.id} className="card" data-testid="pending-claim">
              <p className="text-xl font-extrabold">{c.organization.name}</p>
              <p className="text-sm text-ink-600">{c.organization.type} · {c.organization.city ?? "—"} · source: {c.organization.source}{c.organization.website ? ` · ${c.organization.website}` : ""}</p>
              <p className="mt-2">{c.contactName}, {c.contactRole} · {c.contactPhone} · {c.userEmail}</p>
              {c.note ? <p className="text-sm text-ink-600">Note: {c.note}</p> : null}
              {c.bilingual ? <p className="text-sm text-ink-600" data-testid="claim-bilingual">Says it teaches bilingually or runs English-immersion classes (its own statement, not checked). Approving shows a Bilingual badge.</p> : null}
              {c.competing > 0 ? <p className="notice mt-2">{c.competing} other claim(s) for this campus are waiting. Approving one rejects the rest.</p> : null}
              <form action={reviewClaimAction} className="mt-3 flex gap-3">
                <input type="hidden" name="claimId" value={c.id} />
                <button type="submit" name="decision" value="approve" className="btn btn-primary">Approve</button>
                <button type="submit" name="decision" value="reject" className="btn btn-secondary">Reject</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
