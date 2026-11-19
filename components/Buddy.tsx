"use client";
import Mascot from "./Mascot";

/** The mascot reacting to a card being dragged: cheers when you lean right, frets when you lean left. */
export default function Buddy({ lean, size = 64, idle = "wave", className = "card-mascot" }: { lean: number; size?: number; idle?: "wave" | "chin"; className?: string }) {
  const mood = lean > 0.3 ? "yes" : lean < -0.3 ? "no" : "idle";
  const face =
    mood === "yes"
      ? ({ eyes: "happy", mouth: "grin", arms: "up" } as const)
      : mood === "no"
        ? ({ eyes: "wide", mouth: "wobble", arms: "out", tilt: -6 } as const)
        : idle === "chin"
          ? ({ eyes: "look", mouth: "flat", arms: "chin" } as const)
          : ({ eyes: "dot", mouth: "smile", arms: "wave" } as const);
  // a new key makes it hop each time its mood changes
  return <Mascot key={mood} size={size} className={className} {...face} />;
}
