"use client";
import { useEffect, useState } from "react";
import { getName } from "@/lib/profile";
import Icon from "./Icon";

/** A round badge with the first letter of your name, or a person outline before you add one. */
export default function Avatar({ size = 40 }: { size?: number }) {
  const [name, setName] = useState("");
  useEffect(() => {
    const read = () => setName(getName());
    read();
    window.addEventListener("strata:name", read);
    return () => window.removeEventListener("strata:name", read);
  }, []);
  const letter = name.trim().charAt(0).toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden="true">
      {letter || <Icon name="user" size={size * 0.55} />}
    </span>
  );
}
