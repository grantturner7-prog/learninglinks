import type { ReactNode } from "react";

export function AuthCard({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="container-page py-12">
      <div className={`card mx-auto flex flex-col gap-6 ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {children}
      </div>
    </div>
  );
}
