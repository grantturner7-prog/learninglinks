import { describe, expect, it } from "vitest";
import { WAIVER_VERSION, consentIsValid, hashIp, readWaiverItems, sha256, waiverSnapshot } from "@/lib/consent/waiver";

const form = (on: string[]) => (name: string) => (on.includes(name.replace("item_", "")) ? "on" : null);

describe("educator waiver", () => {
  it("needs all five required items", () => {
    const all = ["terms_privacy", "publish_to_members", "contact_on_request", "truthful", "notice"];
    expect(readWaiverItems(form(all)).ok).toBe(true);
    const r = readWaiverItems(form(all.filter((x) => x !== "notice")));
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["notice"]);
  });
  it("treats the optional marketing item as optional and ignores unknown keys", () => {
    const r = readWaiverItems(form(["terms_privacy", "publish_to_members", "contact_on_request", "truthful", "notice", "admin"]));
    expect(r.ok).toBe(true);
    expect(r.items.marketing).toBe(false);
    expect(Object.keys(r.items)).not.toContain("admin");
  });
  it("counts only an explicit tick", () => {
    expect(readWaiverItems(() => "yes").ok).toBe(false);
    expect(readWaiverItems(() => "on").ok).toBe(true);
  });
  const items = { terms_privacy: true, publish_to_members: true, contact_on_request: true, truthful: true, notice: true };
  it("is valid only for the current wording and while not withdrawn", () => {
    expect(consentIsValid({ documentVersion: WAIVER_VERSION, withdrawnAt: null, items })).toBe(true);
    expect(consentIsValid({ documentVersion: "old", withdrawnAt: null, items })).toBe(false);
    expect(consentIsValid({ documentVersion: WAIVER_VERSION, withdrawnAt: new Date(), items })).toBe(false);
    expect(consentIsValid({ documentVersion: WAIVER_VERSION, withdrawnAt: null, items: { ...items, notice: false } })).toBe(false);
  });
  it("hashes the wording so changes are detectable, and hashes IPs with a secret", () => {
    const a = sha256(waiverSnapshot("zh-TW", ["a", "b"]));
    expect(a).toHaveLength(64);
    expect(sha256(waiverSnapshot("zh-TW", ["a", "c"]))).not.toBe(a);
    expect(hashIp("203.0.113.9", "s1")).not.toBe(hashIp("203.0.113.9", "s2"));
    expect(hashIp("203.0.113.9", "s1")).not.toContain("203");
    expect(hashIp(null, "s")).toBeNull();
  });
});
