import Link from "next/link";
import "./globals.css";

/** Fallback for URLs outside any locale. The locale-aware proxy normally redirects before this renders. */
export default function GlobalNotFound() {
  return (
    <html lang="zh-TW">
      <body>
        <div className="container-page max-w-xl py-20 text-center">
          <h1 className="text-4xl font-extrabold">找不到頁面 · Page not found</h1>
          <p className="mt-3 text-lg text-ink-600">您要找的頁面不存在或已移動。 The page you are looking for does not exist or has moved.</p>
          <Link href="/" className="btn btn-primary mt-6">
            LearningLinks
          </Link>
        </div>
      </body>
    </html>
  );
}
