import Link from "next/link";

/** The folder-shaped tiles on Home: a tab, a sheet peeking out, and an icon with an offset colour patch. */
const ICONS: Record<string, { fill: React.ReactNode; line: React.ReactNode }> = {
  flip: {
    fill: <rect x="6" y="9" width="15" height="19" rx="2.5" />,
    line: (
      <>
        <rect x="11" y="4" width="15" height="19" rx="2.5" transform="rotate(9 18 13)" />
        <rect x="6" y="9" width="15" height="19" rx="2.5" />
        <path d="M10 15h7M10 19h7M10 23h4" />
      </>
    ),
  },
  unfinished: {
    fill: <path d="M20 5l5 5-11 11-6 1 1-6z" />,
    line: <path d="M20 5l5 5-11 11-6 1 1-6zM17 8l5 5M5 27h9M19 27h.01M24 27h.01" />,
  },
  interests: {
    fill: <path d="M15 4c1 6 3 9 10 11-7 2-9 5-10 11-1-6-3-9-10-11 7-2 9-5 10-11z" />,
    line: <path d="M15 4c1 6 3 9 10 11-7 2-9 5-10 11-1-6-3-9-10-11 7-2 9-5 10-11zM26 21v6M23 24h6" />,
  },
  collections: {
    fill: (
      <>
        <circle cx="10" cy="10" r="5.5" />
        <path d="M9 28l6-10 6 10z" />
      </>
    ),
    line: (
      <>
        <circle cx="10" cy="10" r="5.5" />
        <rect x="18" y="5" width="10" height="10" rx="2" />
        <path d="M9 28l6-10 6 10z" />
      </>
    ),
  },
  threads: {
    fill: <circle cx="8" cy="22" r="4" />,
    line: (
      <>
        <path d="M8 4v24" strokeDasharray="0 0" />
        <circle cx="8" cy="8" r="3" />
        <circle cx="8" cy="22" r="3" />
        <path d="M14 8h12M14 22h9M14 15h6" />
      </>
    ),
  },
  inbox: {
    fill: <path d="M4 18h7l2 4h6l2-4h7v8H4z" />,
    line: <path d="M4 18l4-12h16l4 12v8H4zM4 18h7l2 4h6l2-4h7" />,
  },
};

type Props = { href: string; label: string; count: number; icon: keyof typeof ICONS; colour: string; sheet: string; dark?: boolean };

export default function Folder({ href, label, count, icon, colour, sheet, dark }: Props) {
  const ic = ICONS[icon];
  return (
    <Link href={href} className={"ftile" + (dark ? " dark-tile" : "")} aria-label={`${label}, ${count}`}>
      <span aria-hidden="true" className="tab" style={{ background: colour }} />
      <span aria-hidden="true" className="sheet" style={{ background: sheet }} />
      <span className="front" style={{ background: colour }}>
        <svg aria-hidden="true" width="26" height="26" viewBox="0 0 34 34" fill="none" style={{ flex: "0 0 26px" }}>
          <g transform="translate(3.5 3.5)" fill={dark ? "var(--lilac)" : "var(--card)"}>{ic.fill}</g>
          <g transform="translate(1 1)" stroke={dark ? "var(--card)" : "var(--ink)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {ic.line}
          </g>
        </svg>
        <span className="name">{label}</span>
        <span className="n">{count}</span>
      </span>
    </Link>
  );
}
