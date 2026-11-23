# Payments: ECPay (綠界) and bank transfer

Owner decision, 18 Nov 2026: online payment goes through **ECPay**. Bank transfer stays available as a second route once you have an account to show; it is optional. Prices, the 12-month term and "never auto-renews" are unchanged: one payment, VAT included.

## How a buyer pays online

1. In the last question of checkout (family join, or school campuses) the buyer sees **Online with ECPay** (and **Bank transfer** only if you have set bank details). They accept the compliance notice and press the button. The order is created as *waiting for payment*.
2. On the order page they choose **Pay by card**, **ATM virtual account** or **Convenience-store code** (whichever you switched on). Their browser goes to ECPay's own secure page for exactly that method. (ECPay advises naming one method per order, because they keep adding new ones.) **We never see or keep a card number.**
3. ECPay tells our server the result with a signed message (`/api/payments/ecpay/notify`). The site checks the signature, the shop ID and the exact amount, then starts the membership. The buyer gets the same "payment confirmed" email as for a bank transfer. Nobody has to press anything.
4. ATM and convenience-store buyers get their account number or code on the order page (and ECPay sends it too) and pay later. The membership starts when ECPay says the money arrived.

## What the site never does

- It never starts a membership because a buyer's browser says so. Only a correctly signed ECPay notice counts. A forged or changed notice is rejected and logged.
- A notice with the wrong amount is **not** applied; it goes to **Online payments to check** on the admin desk.
- A second payment for an order that is already paid, or a payment that arrives after the order was cancelled, is also parked there for you, never silently accepted or lost.
- ECPay's "simulate payment" test button never starts a membership on a live site.
- ECPay resends a notice up to 4 times a day until it gets `1|OK`; resending changes nothing (the order is paid once).

## Settings (in `.env`, never in the code)

| Setting | Meaning |
|---|---|
| `ECPAY_MERCHANT_ID`, `ECPAY_HASH_KEY`, `ECPAY_HASH_IV` | Your shop's keys from the ECPay merchant back office. Leave all three empty and online payment is **off**: checkout offers bank transfer only. |
| `ECPAY_MODE` | `stage` = ECPay's test server (no real money). `production` = real money. |
| `ECPAY_METHODS` | Comma list, default `Credit,ATM,CVS`. These three are the ones the site supports. |

`npm run preflight` fails if ECPay is only half set up, if it is in `stage` mode on the live site, or if the shop ID is one of ECPay's public test accounts.

## Trying it without real money (test mode)

ECPay publishes a test shop (merchant `3002607`, with public keys in their developer documentation, https://developers.ecpay.com.tw). With those three values in `.env.local` and `ECPAY_MODE=stage`, the payment buttons open ECPay's real test page. Use ECPay's published test card numbers there; no money moves. ECPay's own **simulate payment** button then sends our server a signed notice with `SimulatePaid=1`. The site records that notice but deliberately does **not** start a membership from it (it could be pressed by anyone). To see a whole membership start in test mode, use a test card number, or confirm the order from the admin desk.

Two things in test mode only reach us if ECPay can call our server over the internet, so they need the live domain (or a tunnel) to be tried end to end: the server notice (`notify`) and the ATM/store-code notice (`info`). The signing, the notice handling, the amount check, duplicates and cancelled orders are all covered by automated tests (`tests/ecpay.test.ts`, `tests/db/ecpay.test.ts`) using ECPay's own printed signature examples.

## Before you take real money

1. **Open a merchant account with ECPay** and ask for the production keys. What they require from a business is ECPay's decision; ask them. (Not verified by us.)
2. Put the three production keys in `.env` on the server and set `ECPAY_MODE=production`. Run `npm run preflight`; it must show no FAIL.
3. Your domain must be reachable on HTTPS (port 443) so ECPay can reach `https://your-domain/api/payments/ecpay/notify`. Nothing needs to be typed in ECPay's back office for it: the site sends the address with every order.
4. Make one real payment of the lowest amount you can (a family membership) with your own card, check the membership starts and the email arrives, then refund yourself in ECPay's back office and cancel/hide the test family account.
5. Ask your accountant who issues the invoice. The site records the buyer's invoice details but does **not** issue invoices, and does not use ECPay's invoice service.

## Refunds

**The site never moves money.** You send the money back yourself, then record it on the admin desk so the books, the buyer's order page and the membership all agree.

1. **Send the money back first.** Online payments: in ECPay's merchant back office, find the order by its trade number and refund it there (ECPay decides what is possible for each payment type). Bank transfers: send it from your bank. Note the date.
2. **Record it.** Open `/admin`, find the order by its reference (or click it under **Recently paid**) and use **Refund or end membership**:
   - tick the membership(s) to end now (a school order has one per campus: tick only the campus that is leaving), and/or enter the NT$ you sent back, how you sent it and the date;
   - write the reason (it is kept in the audit log);
   - tick the confirmation box and press **Record it**. The buyer is emailed unless you untick that box.
3. A membership ended this way stops at once: the family or school loses access to educators immediately, no renewal reminder is sent for it, and if they buy again the new 12 months start from that day.

Good to know:
- **Part refunds** are fine (the total can never exceed what was paid); you can refund without ending the membership and end a membership without refunding.
- **A school paid NT$10,000 per campus.** When one campus leaves, refund NT$10,000 (or whatever you decide) and end that campus only. The other campuses keep running.
- **Recording twice is safe:** a double click or a retry is recorded once. A refund that is wrong cannot be undone from the screen; tell a developer, who can correct it in the database and the audit log will show both.
- **The refund policy is yours to decide.** This button records what you did; it does not decide who is entitled to a refund. Taiwan's 7-day cancellation right for distance sales may apply to a 12-month membership: that is one of the questions in the lawyer brief.
- ECPay charges your shop a fee on each payment and may not return it on a refund; ask ECPay for the current rules. The buyer's price does not change.
- Ending a membership does not delete the account, the profile or the order. The order stays "paid" (it was paid) and shows the refund beside it.

## For developers

- Pure signing and parsing: `src/lib/payments/ecpay.ts`. Settlement and the audit trail: `src/lib/payments/service.ts`. Endpoints: `src/app/api/payments/ecpay/{notify,info,return}`.
- `orders.provider` is `bank_transfer` or `ecpay`; another gateway (for example credit card by a different provider, or another country's) is a new file beside `ecpay.ts`, not a rewrite.
- Tables `payment_attempts` (one row per trip to ECPay) and `payment_events` (every notice, appended exactly as received, with what we decided) are the record to look at when a buyer says "I paid".
- A paid order goes through the same `confirmOrderPaid` as the admin desk, so memberships, emails and the audit log behave the same either way (actor `system:ecpay`).
