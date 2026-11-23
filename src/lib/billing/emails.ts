import { getBankDetails } from "@/lib/billing/bank";
import { formatMoney } from "@/lib/plans";
import { siteUrl } from "@/lib/site-url";
import noticeEn from "../../../messages/en-TW/notice.json";
import noticeZh from "../../../messages/zh-TW/notice.json";
import type { EmailMessage } from "@/lib/email";

/**
 * Transactional emails are bilingual (繁體中文 first, then English) because we do not store a language per person.
 * Every one ends with the compliance notice, in both languages, from the canonical wording.
 */
const footer = `\n\n${noticeZh.short}\n${noticeEn.short}`;

export function orderPlacedEmail(to: string, o: { referenceCode: string; amount: number; currency: string; campuses: number; orderUrl?: string; provider?: string }): EmailMessage {
  const amountZh = formatMoney(o.amount, o.currency, "zh-TW");
  const amountEn = formatMoney(o.amount, o.currency, "en-TW");
  const link = o.orderUrl ?? `${siteUrl()}/dashboard`;
  if (o.provider === "ecpay") {
    return {
      to,
      subject: `LearningLinks order ${o.referenceCode} / 訂單 ${o.referenceCode}`,
      text: [
        `您的訂單已建立，金額 ${amountZh}（含稅）。請至訂單頁面按「立即付款」，在綠界的安全頁面以信用卡、ATM 虛擬帳號或超商代碼付款。我們不會看到您的卡號。`,
        `Your order is placed for ${amountEn} (VAT included). Open the order page and press "Pay now" to pay on ECPay's secure page by card, ATM virtual account or convenience store. We never see your card number.`,
        link,
        `款項確認後，會員資格立即開始，期限 12 個月，不會自動續約。/ Your 12 months begin as soon as the payment is confirmed. It never renews automatically.`,
      ].join("\n\n") + footer,
    };
  }
  const bank = getBankDetails();
  const where = bank
    ? `${bank.bankName}${bank.branch ? ` ${bank.branch}` : ""} / ${bank.accountName} / ${bank.accountNumber}`
    : "(see the order page / 請見訂單頁面)";
  return {
    to,
    subject: `LearningLinks order ${o.referenceCode} / 訂單 ${o.referenceCode}`,
    text: [
      `您的訂單已建立。請以銀行轉帳 ${amountZh}（含稅），並在匯款備註填寫參考碼：${o.referenceCode}`,
      `Your order is placed. Please transfer ${amountEn} (VAT included) and put this reference in the transfer note: ${o.referenceCode}`,
      `${where}`,
      link,
      `我們確認收款後，會員資格即刻開始，期限 12 個月，不會自動續約。/ Once we confirm the payment your 12 months begin. It never renews automatically.`,
    ].join("\n\n") + footer,
  };
}

export function orderPaidEmail(to: string, o: { referenceCode: string; terms: { endsAt: Date }[] }): EmailMessage {
  const latest = o.terms.reduce((a, t) => (t.endsAt > a ? t.endsAt : a), o.terms[0]!.endsAt);
  const day = latest.toISOString().slice(0, 10);
  return {
    to,
    subject: `LearningLinks payment confirmed / 已確認收款 ${o.referenceCode}`,
    text: [
      `已確認收款，您的會員資格有效至 ${day}。不會自動續約。`,
      `Payment confirmed. Your membership runs until ${day}. It never renews automatically.`,
      `${siteUrl()}/dashboard`,
    ].join("\n\n") + footer,
  };
}

/**
 * Tell the buyer a refund was recorded and/or a membership was ended early. We never promise how long a bank takes:
 * that depends on the card issuer or bank, not on us.
 */
export function refundEmail(to: string, o: { referenceCode: string; amount: number; currency: string; endedNames: string[]; endedOn: Date | null; isSchool: boolean }): EmailMessage {
  const amountZh = formatMoney(o.amount, o.currency, "zh-TW");
  const amountEn = formatMoney(o.amount, o.currency, "en-TW");
  const day = o.endedOn?.toISOString().slice(0, 10) ?? "";
  const names = o.endedNames.join("、");
  const zh: string[] = [];
  const en: string[] = [];
  if (o.amount > 0) {
    zh.push(`我們已為訂單 ${o.referenceCode} 退款 ${amountZh}。款項多久會出現在您的信用卡或銀行帳戶，視發卡銀行或您的銀行而定。`);
    en.push(`We have refunded ${amountEn} for order ${o.referenceCode}. How long it takes to appear on your card or bank account depends on your card issuer or bank.`);
  }
  if (o.endedOn) {
    zh.push(o.isSchool && names ? `下列校區的會員資格已於 ${day} 結束：${names}。` : `您的會員資格已於 ${day} 結束。`);
    en.push(o.isSchool && names ? `Membership has ended as of ${day} for: ${names}.` : `Your membership ended on ${day}.`);
  }
  return {
    to,
    subject: `LearningLinks order ${o.referenceCode} updated / 訂單 ${o.referenceCode} 已更新`,
    text: [zh.join(" "), en.join(" "), `若有疑問，請回覆此信或來信告訴我們。/ If you have a question, reply to this email or write to us.`, `${siteUrl()}/dashboard`].join("\n\n") + footer,
  };
}

export function renewalReminderEmail(to: string, o: { name: string; endsAt: Date; daysLeft: number }): EmailMessage {
  const day = o.endsAt.toISOString().slice(0, 10);
  const zh = o.daysLeft <= 0 ? `${o.name} 的會員資格今天（${day}）到期。` : `${o.name} 的會員資格將於 ${day} 到期（約 ${o.daysLeft} 天後）。`;
  const en = o.daysLeft <= 0 ? `Membership for ${o.name} ends today (${day}).` : `Membership for ${o.name} ends on ${day} (in about ${o.daysLeft} days).`;
  return {
    to,
    subject: `LearningLinks membership ends ${day} / 會員資格將於 ${day} 到期`,
    text: [
      `${zh} 如要繼續，請在儀表板重新購買；提早購買不會損失任何天數。我們不會自動扣款或自動續約。`,
      `${en} To continue, renew from your dashboard; renewing early loses no days. We never charge you or renew automatically.`,
      `${siteUrl()}/dashboard`,
    ].join("\n\n") + footer,
  };
}
