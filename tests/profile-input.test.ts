import { describe, expect, it } from "vitest";
import { profileStrength, publishBlockers } from "@/lib/educators/completeness";
import { parseProfileForm } from "@/lib/educators/profile-input";

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}
const good: Array<[string, string]> = [
  ["displayName", "Emily R."], ["headline", "Kindergarten English teacher"], ["bio", "I teach kindergarten classes using phonics, songs and picture books. Small groups and clear routines."],
  ["city", "taichung"], ["districts", "taichung:xitun"], ["districts", "taichung:nantun"],
  ["subjects", "phonics"], ["subjects", "english-conversation"], ["levels", "kindergarten"], ["languages", "en"],
  ["teachingModes", "in_person"], ["openTo", "part_time"], ["openTo", "private_tutoring"],
  ["rateMin", "600"], ["rateMax", "900"], ["workAuthorization", "open_work_rights"], ["experienceBand", "5-9"],
  ["credLabel_0", "TEFL 120h"], ["credYear_0", "2021"], ["credUrl_0", "https://issuer.example/verify/123"],
  ["contact_email", "Emily.R@Example.com"], ["contact_line", "@emily_teaches"], ["contact_phone", "0912-345-678"],
];

describe("parsing the profile form", () => {
  it("accepts a good profile and normalises it", () => {
    const { values, errors } = parseProfileForm(form(good), new Date("2026-11-17"));
    expect(errors).toEqual({});
    expect(values.districts).toEqual(["taichung:xitun", "taichung:nantun"]);
    expect(values.contacts).toEqual({ email: "emily.r@example.com", line: "emily_teaches", phone: "0912345678" });
    expect(values.credentials).toEqual([{ label: "TEFL 120h", year: 2021, proofUrl: "https://issuer.example/verify/123" }]);
    expect(values.rateMin).toBe(600);
  });
  it("silently drops values outside the vocabularies and districts of another city", () => {
    const { values } = parseProfileForm(form([...good, ["subjects", "hacking"], ["districts", "taipei:daan"], ["openTo", "substitute"]]));
    expect(values.subjects).not.toContain("hacking");
    expect(values.districts).not.toContain("taipei:daan");
    expect(values.openTo).not.toContain("substitute");
  });
  it("ignores the rate unless the educator offers private tutoring", () => {
    const entries = good.filter(([k, v]) => !(k === "openTo" && v === "private_tutoring"));
    const { values } = parseProfileForm(form(entries));
    expect(values.rateMin).toBeNull();
    expect(values.rateMax).toBeNull();
  });
  it("rejects contact details, links and ID numbers hidden in the free text", () => {
    const { errors } = parseProfileForm(form([["displayName", "Emily R."], ["headline", "call 0912-345-678"], ["bio", "add me on line"], ["credLabel_0", "ID A123456789"]]));
    expect(errors.headline).toBe("contactInfo");
    expect(errors.bio).toBe("contactInfo");
    expect(errors.credLabel_0).toBe("idNumber");
  });
  it("rejects numbers, handles and links in the display name", () => {
    for (const n of ["Emily 0912345678", "@emily", "emily.com", "Emily<script>"]) {
      expect(parseProfileForm(form([["displayName", n]])).errors.displayName, n).toBeDefined();
    }
    expect(parseProfileForm(form([["displayName", "林小美"]])).errors.displayName).toBeUndefined();
    expect(parseProfileForm(form([["displayName", "Anne-Marie O'Neil"]])).errors.displayName).toBeUndefined();
  });
  it("enforces length limits", () => {
    expect(parseProfileForm(form([["displayName", "x".repeat(41)]])).errors.displayName).toBe("tooLong");
    expect(parseProfileForm(form([["displayName", "A"], ["bio", "word ".repeat(200)]])).errors.bio).toBe("tooLong");
  });
  it("validates contact channels", () => {
    const { errors } = parseProfileForm(form([["displayName", "A"], ["contact_email", "nope"], ["contact_phone", "12"], ["contact_line", "a b"], ["contact_wechat", "1abc"]]));
    expect(errors).toMatchObject({ contact_email: "invalidEmail", contact_phone: "invalidPhone", contact_line: "invalidLine", contact_wechat: "invalidWechat" });
  });
  it("accepts only https proof links, never local or credentialed ones", () => {
    const bad = ["http://issuer.example/x", "https://user:pw@issuer.example/x", "https://localhost/x", "https://192.168.0.1/x", "javascript:alert(1)", "https://intranet/x"];
    for (const u of bad) {
      expect(parseProfileForm(form([["displayName", "A"], ["credLabel_0", "TEFL"], ["credUrl_0", u]])).errors.credUrl_0, u).toBe("invalidUrl");
    }
  });
  it("rejects impossible years and reversed rates", () => {
    expect(parseProfileForm(form([["displayName", "A"], ["credLabel_0", "TEFL"], ["credYear_0", "1850"]]), new Date("2026-11-17")).errors.credYear_0).toBe("invalidYear");
    expect(parseProfileForm(form([["displayName", "A"], ["openTo", "private_tutoring"], ["rateMin", "900"], ["rateMax", "600"]])).errors.rateMax).toBe("rateOrder");
  });
});

describe("profile strength and publishing", () => {
  const { values } = parseProfileForm(form(good), new Date("2026-11-17"));
  it("scores a complete profile with a photo at 100", () => {
    expect(profileStrength(values, true)).toEqual({ percent: 100, missing: [] });
  });
  it("lists what is missing, most valuable first", () => {
    const r = profileStrength({ ...values, bio: null, credentials: [] }, false);
    expect(r.percent).toBe(100 - 15 - 10 - 10);
    expect(r.missing).toEqual(["bio", "photo", "credentials"]);
  });
  it("blocks publishing until everything needed is there", () => {
    expect(publishBlockers(values, true)).toEqual([]);
    expect(publishBlockers(values, false)).toEqual(["waiver"]);
    expect(publishBlockers({ ...values, contacts: {} }, true)).toEqual(["contact"]);
    expect(publishBlockers({ ...values, openTo: [], subjects: [] }, true)).toEqual(["subjects", "openTo"]);
  });
});
