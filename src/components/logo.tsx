export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label="LearningLinks">
      <rect width="36" height="36" rx="10" fill="#1c5643" />
      <circle cx="14.5" cy="18" r="6.5" fill="none" stroke="#ffffff" strokeWidth="3" />
      <circle cx="21.5" cy="18" r="6.5" fill="none" stroke="#f5b544" strokeWidth="3" />
    </svg>
  );
}
