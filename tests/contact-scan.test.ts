import { describe, expect, it } from "vitest";
import { firstFindingKind, hasForbiddenContent, scanFreeText } from "@/lib/educators/contact-scan";

const bad = (s: string) => expect(hasForbiddenContent(s), s).toBe(true);
const ok = (s: string | null) => expect(scanFreeText(s), String(s)).toEqual([]);

describe("contact and ID leak scan", () => {
  it("blocks emails, including spelled-out and full-width ones", () => {
    bad("write to emily.r@example.com");
    bad("emily (at) example (dot) com");
    bad("emily＠example.com");
    expect(firstFindingKind("mail me: a.b@school.edu.tw")).toBe("email");
  });
  it("blocks Taiwan and international phone numbers, in any format", () => {
    bad("call 0912-345-678");
    bad("0912 345 678");
    bad("0912345678");
    bad("+886 912 345 678");
    bad("(04) 2234-5678");
    bad("０９１２３４５６７８");
  });
  it("blocks links and bare domains", () => {
    bad("see https://example.com/me");
    bad("www.my-site.tw");
    bad("my portfolio is on emilyteaches.com");
  });
  it("blocks messenger IDs and social handles", () => {
    bad("LINE ID: emily_teaches");
    bad("line：emily_t");
    bad("wechat: emily123");
    bad("WhatsApp = 886912345678");
    bad("find me @emily_teaches");
    bad("微信：emily_wx");
    bad("加我 LINE");
  });
  it("blocks invitations to be contacted off-platform", () => {
    bad("Contact me on Instagram");
    bad("add me on line");
    bad("私訊我");
  });
  it("blocks ID, passport and ARC numbers", () => {
    bad("ID A123456789");
    bad("ARC: ab12345678");
    bad("passport K1234567");
  });
  it("blocks home addresses", () => {
    bad("I live at 中港路二段 100 號");
    bad("12 Main Street");
    bad("No. 3, Lane 25, Zhongshan Rd");
  });
  it("lets ordinary teaching prose through", () => {
    ok("I teach kindergarten and lower-elementary classes using phonics, songs and picture books.");
    ok("Taught at three schools 2018-2021 and 2022 to 2024, grades 1-3.");
    ok("TEFL 120h, 2021. Class sizes of 15-20 students. I charge NT$600-900 per hour.");
    ok("Line up, sing a song, then read together. 每週三次，每次 90 分鐘。");
    ok("B.Ed., National Taiwan Normal University");
    ok("");
    ok(null);
  });
  it("does not report the same email twice as a link", () => {
    expect(scanFreeText("emily@example.com").map((f) => f.kind)).toEqual(["email"]);
  });
});
