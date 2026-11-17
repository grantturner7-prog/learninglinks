/** Public base URL of the site. Read straight from the environment so it is safe at build time. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
