"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "@/i18n/navigation";

export function SignOutButton() {
  const t = useTranslations("nav");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await authClient.signOut();
        router.replace("/");
        router.refresh();
      }}
    >
      {t("signOut")}
    </button>
  );
}
