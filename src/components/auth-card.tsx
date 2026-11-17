import type { ReactNode } from "react";
import { LinkSays } from "@/components/home/link-says";
import { Phrases } from "@/components/home/phrases";

/**
 * The single-column shell for sign-in, forgot-password and reset-password: Link says a kind line,
 * then one big rounded card holds the title and the form.
 */
export function AuthCard({ title, say, children }: { title: string; say?: ReactNode; children: ReactNode }) {
  return (
    <div className="container-page py-8 sm:py-14">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        {say ? <LinkSays>{say}</LinkSays> : null}
        <div className="rounded-[36px] bg-paper p-6 shadow-soft sm:rounded-[48px] sm:p-10">
          <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl"><Phrases text={title} /></h1>
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}
