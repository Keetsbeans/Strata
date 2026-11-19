"use client";
import Link from "next/link";
import Nav from "@/components/Nav";
import { SearchPanel } from "@/components/SearchPanel";

export default function Search() {
  return (
    <>
      <main className="screen">
        <SearchPanel close={<Link className="btn sm" href="/">Close</Link>} />
      </main>
      <Nav />
    </>
  );
}
