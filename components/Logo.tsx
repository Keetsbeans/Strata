/** The Strata mark (three stacked layers) and name. */
export default function Logo({ dark }: { dark?: boolean }) {
  const line = dark ? "var(--card)" : "var(--ink)";
  return (
    <span className="logo" aria-label="Strata" role="img">
      <svg aria-hidden="true" width="26" height="26" viewBox="0 0 26 26" fill="none" stroke={line} strokeWidth="1.6">
        <rect x="3" y="16.5" width="20" height="6" rx="2.6" fill="#DCE4F2" />
        <rect x="4.5" y="10" width="17" height="6" rx="2.6" fill="#E6DB86" transform="rotate(-4 13 13)" />
        <rect x="6" y="3.5" width="14" height="6" rx="2.6" fill="#C3A6F5" transform="rotate(3 13 6.5)" />
      </svg>
      <span style={{ color: dark ? "var(--card)" : "var(--ink)" }}>Strata</span>
    </span>
  );
}
