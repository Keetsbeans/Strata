type Props = {
  size?: number;
  eyes?: "dot" | "closed" | "happy" | "wide" | "look";
  mouth?: "smile" | "o" | "flat" | "grin" | "wobble";
  arms?: "down" | "up" | "wave" | "chin" | "out";
  tilt?: number;
  line?: string;
  className?: string;
  /** gentle idle movement: breathing, blinking, and waving when the arm is up. Off for people who ask for less motion. */
  move?: boolean;
};

/** The little stack of three layers. Keep it small. */
export default function Mascot({ size = 72, eyes = "dot", mouth = "smile", arms = "down", tilt = 0, line = "#151515", className, move = true }: Props) {
  const [armL, armR] = {
    down: ["M25 62q-9 3-9 13", "M95 62q9 3 9 13"],
    up: ["M25 60q-11-4-12-17", "M95 60q11-4 12-17"],
    wave: ["M25 62q-9 3-9 13", "M95 60q12-3 13-18"],
    chin: ["M25 62q-9 3-9 13", "M95 62q13-4 4-14q-3-3-8-2"],
    out: ["M25 62q-10-1-15 5", "M95 62q10-1 15 5"],
  }[arms];
  const cls = ["mascot", move && "live", move && `arms-${arms}`, className].filter(Boolean).join(" ");
  const eye = {
    dot: (
      <>
        <circle cx="51" cy="35" r="2.8" fill="#151515" stroke="none" />
        <circle cx="69" cy="35" r="2.8" fill="#151515" stroke="none" />
      </>
    ),
    closed: <path d="M47 35q4 3 8 0M65 35q4 3 8 0" />,
    happy: <path d="M47 37q4-5 8 0M65 37q4-5 8 0" />,
    wide: (
      <>
        <circle cx="51" cy="35" r="5.5" fill="#FBFAF7" strokeWidth="2" />
        <circle cx="69" cy="35" r="5.5" fill="#FBFAF7" strokeWidth="2" />
        <circle cx="51" cy="35" r="2" fill="#151515" stroke="none" />
        <circle cx="69" cy="35" r="2" fill="#151515" stroke="none" />
      </>
    ),
    look: (
      <>
        <circle cx="51" cy="35" r="5.5" fill="#FBFAF7" strokeWidth="2" />
        <circle cx="69" cy="35" r="5.5" fill="#FBFAF7" strokeWidth="2" />
        <circle cx="53" cy="33" r="2" fill="#151515" stroke="none" />
        <circle cx="71" cy="33" r="2" fill="#151515" stroke="none" />
      </>
    ),
  }[eyes];
  const mo = {
    smile: <path d="M55 43q5 4 10 0" />,
    o: <ellipse cx="60" cy="44.5" rx="2.5" ry="3" fill="#151515" stroke="none" />,
    flat: <path d="M56 44h8" />,
    grin: <path d="M53 42h14q-7 8-14 0z" fill="#151515" />,
    wobble: <path d="M53 44q2.3-3 4.6 0t4.6 0t4.6 0" />,
  }[mouth];
  return (
    <svg aria-hidden="true" className={cls} width={size} height={size} viewBox="0 0 120 120" fill="none" stroke={line} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M46 96v11h-7M74 96v11h7" />
      <g className="m-all">
      <g>
        <rect x="20" y="72" width="80" height="24" rx="10" fill="#DCE4F2" />
        <path d="M32 85h7M45 85h3M78 82h8" stroke="currentColor" strokeWidth="2" />
      </g>
      <g>
        <path className="m-arm-l" d={armL} />
        <path className="m-arm-r" d={armR} />
        <rect x="25" y="50" width="70" height="24" rx="10" fill="#E6DB86" />
        <path d="M36 60h4M72 64h9M86 64h2" stroke="currentColor" strokeWidth="2" />
      </g>
      <g className="m-head">
      <g transform={`rotate(${tilt} 60 37)`}>
        <path d="M60 22q-2-7 4-9" />
        <rect x="30" y="22" width="60" height="30" rx="13" fill="#C3A6F5" />
        <g stroke="currentColor">
          <g className="m-eyes">{eye}</g>
          {mo}
        </g>
      </g>
      </g>
      </g>
    </svg>
  );
}
