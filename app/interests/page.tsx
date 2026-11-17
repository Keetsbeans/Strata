"use client";
import Nav from "@/components/Nav";
import Mascot from "@/components/Mascot";

export default function Page() {
  return (
    <>
      <main className="screen">
        <h1 className="h-big">Interests</h1>
        <div className="empty">
          <Mascot size={72} eyes="closed" mouth="smile" />
          <h2>Coming next</h2>
          <p>Films, books, music and articles, with their real posters and covers, arrive in the next stage.</p>
        </div>
      </main>
      <Nav />
    </>
  );
}
