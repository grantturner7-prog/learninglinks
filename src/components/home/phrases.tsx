/**
 * Lets a Traditional Chinese heading wrap at its commas and full stops instead of in the middle of a word
 * (otherwise "找到老師" can break as "找到老 / 師"). English and other text without CJK punctuation is left as is.
 */
const CLAUSE = /[^，、。？！：；]+[，、。？！：；…⋯]*|[，、。？！：；]+/g;

export function Phrases({ text }: { text: string }) {
  if (!/[，、。？！：；]/.test(text)) return <>{text}</>;
  const parts = text.match(CLAUSE) ?? [text];
  return (
    <>
      {parts.map((part, i) => (
        <span key={i} className="inline-block">
          {part}
        </span>
      ))}
    </>
  );
}
