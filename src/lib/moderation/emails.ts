import type { EmailMessage } from "@/lib/email";
import { supportEmail } from "@/lib/support";
import noticeEn from "../../../messages/en-TW/notice.json";
import noticeZh from "../../../messages/zh-TW/notice.json";

/**
 * Fair process: when something is hidden after a report, the person is told straight away, in both languages,
 * and shown how to ask for a second look. The reporter is never named.
 */
export function moderationNoticeEmail(to: string, o: { what: "profile" | "school" | "job"; name: string }): EmailMessage {
  const support = supportEmail();
  const zhWhat = { profile: "您的教師檔案", school: "您的學校", job: "您的職缺" }[o.what];
  const enWhat = { profile: "your educator profile", school: "your school", job: "your job post" }[o.what];
  const zhAsk = support ? `若您認為這是誤會，請寫信到 ${support}，我們會再次檢視。` : "若您認為這是誤會，請回覆這封信，我們會再次檢視。";
  const enAsk = support ? `If you think this is a mistake, write to ${support} and we will look again.` : "If you think this is a mistake, reply to this email and we will look again.";
  return {
    to,
    subject: `LearningLinks: ${enWhat} was hidden / ${zhWhat}已被隱藏`,
    text: [
      `LearningLinks 在收到回報並人工檢視後，已隱藏${zhWhat}「${o.name}」。${zhAsk}`,
      `After a report and a manual review, LearningLinks has hidden ${enWhat} "${o.name}". ${enAsk}`,
      "我們不會告知是誰提出回報。/ We do not tell you who made the report.",
    ].join("\n\n") + `\n\n${noticeZh.short}\n${noticeEn.short}`,
  };
}
