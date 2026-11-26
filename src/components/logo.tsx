/** Two interlocked rings: the LearningLinks mark. Amber and ink (cream on the night surfaces), not tied to any party colour. */
export function LogoMark({ size = 36, light = false }: { size?: number; light?: boolean }) {
  const a = "#f2b45a";
  const b = light ? "#f4eee5" : "#1f1a1c";
  return (
    <svg width={Math.round((size * 44) / 30)} height={size} viewBox="0 0 44 30" role="img" aria-label="LearningLinks">
      <circle cx="15" cy="15" r="11" fill="none" stroke={a} strokeWidth="4" />
      <circle cx="29" cy="15" r="11" fill="none" stroke={b} strokeWidth="4" />
      <path d="M17.6 4.5A11 11 0 0 1 22.4 6.2" fill="none" stroke={a} strokeWidth="4" />
    </svg>
  );
}

/** Link, the friendly guide: the same two rings, with a smile. Decorative unless given a label. */
export function LinkGuide({ size = 64, label }: { size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
      <circle cx="26" cy="32" r="17" fill="#fbe5bd" stroke="#e09a2c" strokeWidth="4.2" />
      <circle cx="38" cy="32" r="17" fill="#f7f4f2" fillOpacity=".85" stroke="#1f1a1c" strokeWidth="4.2" />
      <path d="M28.95 15.26A17 17 0 0 1 35 17.58" fill="none" stroke="#e09a2c" strokeWidth="4.2" />
      <circle cx="28.6" cy="29.2" r="1.9" fill="#1f1a1c" />
      <circle cx="35.4" cy="29.2" r="1.9" fill="#1f1a1c" />
      <path d="M27.4 35.2Q32 40.2 36.6 35.2" fill="none" stroke="#1f1a1c" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
