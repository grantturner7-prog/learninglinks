"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";

type ErrorKey = "tooLarge" | "notAnImage" | "unsupportedType" | "tooSmall" | "tooManyPixels" | "needsProfile" | "rateLimited" | "forbidden" | "server";
const KNOWN: readonly ErrorKey[] = ["tooLarge", "notAnImage", "unsupportedType", "tooSmall", "tooManyPixels", "needsProfile", "rateLimited", "forbidden", "server"];

export function PhotoUpload({ photoUrl, initials, hasProfile }: { photoUrl: string | null; initials: string; hasProfile: boolean }) {
  const t = useTranslations("educator.profile.photo");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [ok, setOk] = useState(false);

  async function send(method: "POST" | "DELETE", file?: File) {
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const body = new FormData();
      if (file) body.set("photo", file);
      const res = await fetch("/api/educator/photo", { method, body: method === "POST" ? body : undefined });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(KNOWN.includes(data.error as ErrorKey) ? (data.error as ErrorKey) : "server");
      } else {
        setOk(method === "POST");
        router.refresh();
      }
    } catch {
      setError("server");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a private, already-resized 512px WebP served by our own gated route
        <img src={photoUrl} alt="" width={80} height={80} className="h-20 w-20 rounded-full border border-ink-100 object-cover" />
      ) : (
        <span aria-hidden className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-xl font-extrabold text-brand-800">{initials}</span>
      )}
      <div>
        <span className="label">{t("label")}</span>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="photo-input" disabled={!hasProfile || busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void send("POST", f); }} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" disabled={!hasProfile || busy} onClick={() => input.current?.click()}>
            {busy ? t("uploading") : photoUrl ? t("change") : t("upload")}
          </button>
          {photoUrl ? <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void send("DELETE")}>{t("remove")}</button> : null}
        </div>
        <p className="hint">{hasProfile ? t("hint") : t("saveFirst")}</p>
        {error ? <p role="alert" className="mt-1 text-sm font-semibold text-danger-600">{t(`errors.${error}`)}</p> : null}
        {ok ? <p role="status" className="mt-1 text-sm font-semibold text-brand-700">{t("done")}</p> : null}
      </div>
    </div>
  );
}
