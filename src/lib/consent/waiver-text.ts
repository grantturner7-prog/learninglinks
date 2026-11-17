import { getMessages } from "next-intl/server";
import { waiverSnapshot } from "./waiver";

/** Every string the waiver page shows, in display order. The consent record stores exactly these. */
const KEYS = [
  "educator.waiver.title", "educator.waiver.lead",
  "educator.waiver.cols.profile.title", "educator.waiver.cols.profile.i1", "educator.waiver.cols.profile.i2", "educator.waiver.cols.profile.i3",
  "educator.waiver.cols.profile.i4", "educator.waiver.cols.profile.i5", "educator.waiver.cols.profile.i6",
  "educator.waiver.cols.contact.title", "educator.waiver.cols.contact.i1", "educator.waiver.cols.contact.i2", "educator.waiver.cols.contact.i3",
  "educator.waiver.cols.contact.i4", "educator.waiver.cols.contact.i5",
  "educator.waiver.cols.never.title", "educator.waiver.cols.never.i1", "educator.waiver.cols.never.i2", "educator.waiver.cols.never.i3", "educator.waiver.cols.never.i4",
  "educator.waiver.who.title", "educator.waiver.who.schoolsTitle", "educator.waiver.who.schoolsBody", "educator.waiver.who.familiesTitle",
  "educator.waiver.who.familiesBody", "educator.waiver.who.between",
  "educator.waiver.confirm.termsPrivacy", "educator.waiver.confirm.publishToMembers", "educator.waiver.confirm.contactOnRequest",
  "educator.waiver.confirm.truthful", "notice.acknowledge", "educator.waiver.confirm.marketing",
] as const;

/** The waiver text in `locale`, flattened with its document key, version and locale. */
export async function buildWaiverSnapshot(locale: string): Promise<string> {
  const messages = (await getMessages({ locale })) as unknown as Record<string, unknown>;
  const get = (path: string): string => {
    const v = path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), messages);
    if (typeof v !== "string") throw new Error(`waiver text missing: ${path}`);
    return v;
  };
  return waiverSnapshot(locale, KEYS.map(get));
}
