"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Flip through now lives in Thoughts, as the Cards view of Unsorted */
export default function Review() {
  const router = useRouter();
  useEffect(() => router.replace("/thoughts/?filter=unsorted&view=cards"), [router]);
  return <main className="screen no-nav" />;
}
