import { tokenize } from "./doc";
import { Link } from "@/i18n/navigation";

/**
 * One paragraph or bullet of legal copy. Renders **bold**, links to other pages of the site and the
 * "[For lawyer: ...]" placeholders (highlighted, so a lawyer can find every open point at a glance).
 */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {tokenize(text).map((tok, i) => {
        switch (tok.type) {
          case "bold":
            return <strong key={i} className="font-bold">{tok.text}</strong>;
          case "link":
            return <Link key={i} href={tok.href} className="link">{tok.text}</Link>;
          case "lawyer":
            return (
              <mark key={i} data-lawyer-placeholder className="rounded-md bg-warn-50 px-1.5 py-0.5 font-semibold text-warn-700 [box-decoration-break:clone]">
                {tok.text}
              </mark>
            );
          default:
            return <span key={i}>{tok.text}</span>;
        }
      })}
    </>
  );
}
