import { describe, expect, it } from "vitest";
import { cleanInvoice, OrderFailure } from "@/lib/billing/orders";
import { generateReferenceCode, normaliseReference } from "@/lib/billing/reference";
import { isValidTaxId } from "@/lib/billing/tax-id";
import { looksLikeSubstituteWork, parseJobForm } from "@/lib/jobs/input";

describe("統一編號 checksum", () => {
  it("accepts real-looking numbers and rejects bad ones", () => {
    // 04595257 (TSMC-style example from the Ministry of Finance rule), 22099131 (a classic valid example)
    expect(isValidTaxId("04595257")).toBe(true);
    expect(isValidTaxId("22099131")).toBe(true);
    expect(isValidTaxId("10458575")).toBe(true); // 7th digit is 7: the one-short rule
    expect(isValidTaxId("22099132")).toBe(false);
    expect(isValidTaxId("1234567")).toBe(false);
    expect(isValidTaxId("123456789")).toBe(false);
    expect(isValidTaxId("abcdefgh")).toBe(false);
  });
});

describe("order reference", () => {
  it("is readable, unambiguous and unique enough", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const c = generateReferenceCode();
      expect(c).toMatch(/^LL-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
      seen.add(c);
    }
    expect(seen.size).toBe(2000);
  });
  it("matches whatever the bank statement shows", () => {
    expect(normaliseReference("ll 7k3q 9fxd")).toBe("LL-7K3Q-9FXD");
    expect(normaliseReference("LL7K3Q9FXD")).toBe("LL-7K3Q-9FXD");
    expect(normaliseReference(" ll-7k3q-9fxd ")).toBe("LL-7K3Q-9FXD");
  });
});

describe("invoice details", () => {
  it("are optional", () => {
    expect(cleanInvoice(undefined)).toEqual({ invoiceTaxId: null, invoiceTitle: null, invoiceEmail: null });
  });
  it("needs a valid 統一編號 and a company title together", () => {
    expect(() => cleanInvoice({ taxId: "22099132", title: "Co" })).toThrowError(OrderFailure);
    expect(() => cleanInvoice({ taxId: "22099131" })).toThrowError(OrderFailure);
    expect(cleanInvoice({ taxId: "2209 9131", title: " Sunshine Ltd ", email: "A@B.tw" })).toEqual({ invoiceTaxId: "22099131", invoiceTitle: "Sunshine Ltd", invoiceEmail: "a@b.tw" });
    expect(() => cleanInvoice({ email: "nope" })).toThrowError(OrderFailure);
  });
});

function form(o: Record<string, string | string[]>) {
  return {
    get: (k: string) => (typeof o[k] === "string" ? (o[k] as string) : Array.isArray(o[k]) ? (o[k] as string[])[0] ?? null : null),
    getAll: (k: string) => (Array.isArray(o[k]) ? (o[k] as string[]) : typeof o[k] === "string" ? [o[k] as string] : []),
  };
}
const base = { title: "English teacher, Xitun", type: "full_time", city: "taichung", applyContact: "hr@sunshine.example" };

describe("job post rules", () => {
  it("accepts a normal full-time post", () => {
    const { values, errors } = parseJobForm(form({ ...base, subjects: ["phonics", "nope"], salaryMin: "55,000", salaryMax: "70000", salaryUnit: "month", district: "taichung:xitun" }));
    expect(errors).toEqual({});
    expect(values).toMatchObject({ type: "full_time", subjects: ["phonics"], salaryMin: 55000, salaryMax: 70000, salaryUnit: "month", district: "taichung:xitun" });
  });
  it("never allows substitute or cover work, in either language", () => {
    for (const t of ["Substitute teacher needed", "Relief teacher for May", "Cover teacher wanted", "Short-term cover", "代課老師", "臨時代課", "Supply teacher"]) {
      expect(looksLikeSubstituteWork(t), t).toBe(true);
      expect(parseJobForm(form({ ...base, title: t })).errors.title, t).toBe("substitute");
    }
    expect(parseJobForm(form({ ...base, description: "We also need a substitute for exam week." })).errors.description).toBe("substitute");
    expect(looksLikeSubstituteWork("Homeroom English teacher, K2")).toBe(false);
  });
  it("only knows full time and part time", () => {
    expect(parseJobForm(form({ ...base, type: "substitute" })).errors.type).toBe("required");
    expect(parseJobForm(form({ ...base, type: "private_tutoring" })).errors.type).toBe("required");
  });
  it("checks the money, the date and the place", () => {
    expect(parseJobForm(form({ ...base, salaryMin: "80000", salaryMax: "50000", salaryUnit: "month" })).errors.salaryMin).toBe("salaryOrder");
    expect(parseJobForm(form({ ...base, salaryMin: "5000" })).errors.salaryUnit).toBe("salaryUnit");
    expect(parseJobForm(form({ ...base, salaryMin: "abc", salaryUnit: "hour" })).errors.salaryMin).toBe("salaryRange");
    expect(parseJobForm(form({ ...base, startsOn: "2020-01-01" }), new Date("2026-11-17")).errors.startsOn).toBe("dateRange");
    expect(parseJobForm(form({ ...base, startsOn: "2027-02-01" }), new Date("2026-11-17")).errors.startsOn).toBeUndefined();
    expect(parseJobForm(form({ ...base, city: "mars" })).errors.city).toBe("required");
    expect(parseJobForm(form({ ...base, district: "taipei:daan" })).values.district).toBeNull();
  });
  it("keeps ID numbers and addresses out of the text", () => {
    expect(parseJobForm(form({ ...base, description: "Send your passport A123456789 to us" })).errors.description).toBe("idNumber");
    expect(parseJobForm(form({ ...base, description: "Come to 中正路 12 號" })).errors.description).toBe("address");
    expect(parseJobForm(form({ ...base, applyContact: "" })).errors.applyContact).toBe("required");
  });
});
