const P: Record<string, string> = {
  back: "M14 6l-6 6 6 6",
  search: "M20 20l-3.5-3.5",
  trash: "M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  close: "M6 6l12 12M18 6L6 18",
  clock: "M12 7v5l3 2",
  pen: "M4 20l4-1 10-10-3-3L5 16l-1 4zM13 6l3 3",
  thread: "M6 5v14M6 7h4M6 12h7M6 17h5",
  finger: "M6 10a6 6 0 0 1 12 0c0 4-1 7-2 9M9 20c1-2 1.5-5 1.5-9a1.5 1.5 0 0 1 3 0c0 3-.3 5.5-1 8M4.5 15c.5-1.5.7-3 .7-5M12 3.5A6.5 6.5 0 0 0 7 5.8",
  backspace: "M9 6h11v12H9l-6-6zM13 10l4 4M17 10l-4 4",
  restore: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3M9 21h6",
  stop: "M8 8h8v8H8z",
  settings: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  user: "M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5",
  chevron: "M10 6l6 6-6 6",
  pin: "M9 4h6M10 4v5l-3 4h10l-3-4V4M12 13v7",
  inbox: "M4 13l2.5-7h11L20 13v6H4zM4 13h5l1 2h4l1-2h5",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  cards: "M8 4h11v14H8zM5 7v13h11",
  "swipe-left": "M10 13V6.5a1.5 1.5 0 0 1 3 0V11l4 .9a2 2 0 0 1 1.6 2.2L18 20h-7l-3.4-4.3a1.4 1.4 0 0 1 2.1-1.9L10 14.5M8 4H2.5M4.5 2L2.5 4l2 2",
  "swipe-right": "M10 13V6.5a1.5 1.5 0 0 1 3 0V11l4 .9a2 2 0 0 1 1.6 2.2L18 20h-7l-3.4-4.3a1.4 1.4 0 0 1 2.1-1.9L10 14.5M15 4h6M19 2l2 2-2 2",
  "swipe-up": "M10 13V6.5a1.5 1.5 0 0 1 3 0V11l4 .9a2 2 0 0 1 1.6 2.2L18 20h-7l-3.4-4.3a1.4 1.4 0 0 1 2.1-1.9L10 14.5M5 10V3M3 5l2-2 2 2",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
};

export default function Icon({ name, size = 20, color = "currentColor", width = 2.2 }: { name: keyof typeof P | string; size?: number; color?: string; width?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      {name === "search" && <circle cx="11" cy="11" r="7" />}
      {name === "clock" && <circle cx="12" cy="12" r="9" />}
      {name === "user" && <circle cx="12" cy="8.5" r="3.8" />}
      <path d={P[name]} />
    </svg>
  );
}
