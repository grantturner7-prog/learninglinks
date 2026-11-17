import type { Metadata } from "next";
import { getFormatter, setRequestLocale } from "next-intl/server";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { requireAdmin } from "@/lib/auth/session";
import { findOrderByReference, listPendingOrdersForAdmin } from "@/lib/billing/orders";
import { getDb } from "@/lib/db";
import { listPendingClaims } from "@/lib/orgs/service";
import { cancelOrderAsAdminAction, reviewClaimAction } from "./actions";

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
  const [orders, claims, found] = await Promise.all([listPendingOrdersForAdmin(db), listPendingClaims(db), ref ? findOrderByReference(db, ref) : Promise.resolve(null)]);
  // Today's date in Taipei as YYYY-MM-DD: the default for "received on".
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(new Date());
  const money = (n: number, c: string) => f.number(n, { style: "currency", currency: c, maximumFractionDigits: 0 });
  const shown = found && found.status === "pending" && !orders.some((o) => o.id === found.id) ? [found, ...orders] : orders;

  return (
    <div className="container-page max-w-5xl py-10">
      <h1 className="text-4xl font-extrabold tracking-tight">Admin desk</h1>
      <p className="mt-2 text-ink-600">Confirm bank transfers and review school claims. Memberships start the moment you confirm a payment.</p>

      {confirmedOrder?.status === "paid" ? (
        <p role="status" className="notice mt-6 font-bold" data-testid="confirmed-banner">
          {sp.again ? `${confirmedOrder.referenceCode} was already confirmed. Nothing changed.` : `Confirmed ${confirmedOrder.referenceCode}. The membership has started and the buyer has been emailed.`}
        </p>
      ) : null}

      <section className="card mt-8">
        <h2 className="text-2xl font-extrabold">Find an order by reference</h2>
        <form method="get" className="mt-3 flex flex-wrap gap-3" role="search">
          <label htmlFor="ref" className="sr-only">Reference code</label>
          <input id="ref" name="ref" className="field max-w-xs" placeholder="LL-XXXX-XXXX" defaultValue={ref} />
          <button type="submit" className="btn btn-secondary">Find</button>
        </form>
        {ref && !found ? <p className="mt-3">No order with that reference.</p> : null}
        {found && found.status !== "pending" ? <p className="mt-3">{found.referenceCode} is <b>{found.status}</b>{found.paidAt ? ` (paid ${f.dateTime(found.paidAt, { dateStyle: "medium" })})` : ""}.</p> : null}
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-extrabold">Waiting for payment ({shown.length})</h2>
        <ul className="mt-3 flex flex-col gap-4">
          {shown.length === 0 ? <li className="card">Nothing is waiting.</li> : shown.map((o) => (
            <li key={o.id} className="card" data-testid="pending-order">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-mono text-xl font-extrabold">{o.referenceCode}</span>
                <span className="text-xl font-extrabold">{money(o.amount, o.currency)}</span>
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
