import type { Subject } from "@/lib/taxonomy";

/** Small stroke icons (24x24) used by the guided flow. Decorative: always aria-hidden. */
const PATHS = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  arrowR: "M4 12h15M13 6l6 6-6 6",
  arrowL: "M20 12H5M11 6l-6 6 6 6",
  lock: "M7 10.5h10a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2zM8.5 10.5V8a3.5 3.5 0 017 0v2.5",
  eyeOff: "M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM12 9.4a2.6 2.6 0 100 5.2 2.6 2.6 0 000-5.2zM4 4l16 16",
  pin: "M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0113 0c0 5.3-6.5 11-6.5 11zM12 7.6a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8z",
  globe: "M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM3.5 12h17M12 3.5c2.6 2.4 3.6 5.2 3.6 8.5s-1 6.1-3.6 8.5c-2.6-2.4-3.6-5.2-3.6-8.5s1-6.1 3.6-8.5z",
  laptop: "M7 5.5h10a2 2 0 012 2V15H5V7.5a2 2 0 012-2zM3 18.5h18",
  sparkle: "M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  mail: "M6.5 5.5h11a3 3 0 013 3v7a3 3 0 01-3 3h-11a3 3 0 01-3-3v-7a3 3 0 013-3zM4.5 7.5l7.5 6 7.5-6",
  phone: "M10 3.5h4a3 3 0 013 3v11a3 3 0 01-3 3h-4a3 3 0 01-3-3v-11a3 3 0 013-3zM11 17.5h2",
  chat: "M5 5.5h14a1.5 1.5 0 011.5 1.5v8a1.5 1.5 0 01-1.5 1.5h-7l-4.5 3.5V16.5H5A1.5 1.5 0 013.5 15V7A1.5 1.5 0 015 5.5z",
  plus: "M12 5v14M5 12h14",
  trash: "M5 7h14M9.5 7V4.8h5V7M7 7l.8 12h8.4L17 7",
  pencil: "M4 20l1-4.5L16.5 4a2.1 2.1 0 013 3L8 18.5zM14.5 6l3.5 3.5",
  book: "M5 5.5A1.5 1.5 0 016.5 4H19v13H6.5A1.5 1.5 0 005 18.5zM5 18.5A1.5 1.5 0 006.5 20H19",
  mic: "M12 3.5a3 3 0 013 3v5a3 3 0 01-6 0v-5a3 3 0 013-3zM6 11.5a6 6 0 0012 0M12 17.5V21M9 21h6",
  clipboard: "M8 5h8a2 2 0 012 2v11.5a2 2 0 01-2 2H8a2 2 0 01-2-2V7a2 2 0 012-2zM9.5 5V4h5v1M9 12.5l2 2 4-4.5",
  calc: "M8.5 3.5h7a2.5 2.5 0 012.5 2.5v12a2.5 2.5 0 01-2.5 2.5h-7A2.5 2.5 0 016 18V6a2.5 2.5 0 012.5-2.5zM9 8h6M9 12.5h.01M12 12.5h.01M15 12.5h.01M9 16h.01M12 16h.01M15 16h.01",
  flask: "M10 4h4M11 4v5.5L6.5 18a2 2 0 001.8 3h7.4a2 2 0 001.8-3L13 9.5V4M8.5 15h7",
  landmark: "M4 9l8-5 8 5H4zM6 9v8M10 9v8M14 9v8M18 9v8M4 20h16",
  map: "M9 5L3.5 7v12L9 17l6 2 5.5-2V5L15 7zM9 5v12M15 7v12",
  palette: "M12 4a8 8 0 100 16c1.4 0 2-1 1.5-2.1-.6-1.2.2-2.4 1.5-2.4H17a3 3 0 003-3 8 8 0 00-8-8zM8 11h.01M11 8h.01M15 9h.01",
  note: "M9 18V5l10-2v13M9 18a3 3 0 11-3-3M19 16a3 3 0 11-3-3",
  ball: "M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM3.5 12h17M12 3.5c3 2.6 3 14.4 0 17M12 3.5c-3 2.6-3 14.4 0 17",
  code: "M8.5 8l-4 4 4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13",
  gear: "M12 9a3 3 0 100 6 3 3 0 000-6zM12 3.5V6M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2L18 18M18 6l-1.8 1.8M7.8 16.2L6 18",
  mask: "M5 6c4-1.5 10-1.5 14 0v6c0 4-3 7-7 7s-7-3-7-7zM9 11h.01M15 11h.01M9.5 15c1.5 1.2 3.5 1.2 5 0",
  chart: "M4.5 19.5h15M7 16v-5M12 16V7M17 16v-8",
  key: "M8 8.2a3.8 3.8 0 100 7.6 3.8 3.8 0 000-7.6zM11.8 12H21M17.5 12v3M20.5 12v2",
  camera: "M4.5 8h3l1.5-2.5h6L16.5 8h3a1 1 0 011 1v9a1 1 0 01-1 1h-15a1 1 0 01-1-1V9a1 1 0 011-1zM12 9.7a3.3 3.3 0 100 6.6 3.3 3.3 0 000-6.6z",
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, stroke = 1.9, className }: { name: IconName; size?: number; stroke?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}

const SUBJECT_ICON: Record<Subject, IconName | "Aa" | "華"> = {
  "english-conversation": "chat", phonics: "Aa", grammar: "pencil", "reading-comprehension": "book", "creative-writing": "pencil",
  "public-speaking-debate": "mic", "test-prep-english": "clipboard", mandarin: "華", mathematics: "calc", science: "flask",
  "social-studies": "globe", history: "landmark", geography: "map", art: "palette", music: "note", "physical-education": "ball",
  "computer-science-coding": "code", "stem-robotics": "gear", "drama-theater": "mask", literature: "book", "business-economics": "chart",
  "exam-prep-taiwan": "clipboard",
};

/** A friendly line illustration for a subject tile. */
export function SubjectIcon({ subject, size = 48 }: { subject: Subject; size?: number }) {
  const k = SUBJECT_ICON[subject];
  if (k === "Aa" || k === "華") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <text x="24" y="33" textAnchor="middle" fontSize={k === "Aa" ? 26 : 28} fontWeight="800" fill="currentColor" fontFamily="inherit">{k}</text>
      </svg>
    );
  }
  return <Icon name={k} size={size} stroke={1.5} />;
}
