// Phone test for Strata stage 2 (interests, collections, Inbox, import, share).
// Run after `npm run build`:  node e2e/stage2.mjs
// Uses a Pixel 7 screen, try-out mode, and stand-in answers for the public catalogues,
// so it works without a network connection.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, stat, writeFile, mkdtemp } from "node:fs/promises";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
import { zipSync, strToU8 } from "fflate";

// Playwright is installed on the test machine, not in the app
const { chromium, devices } = createRequire(import.meta.url)("playwright");

const OUT = new URL("../out/", import.meta.url).pathname;
const SHOTS = process.env.SHOTS || "";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain" };

const server = createServer(async (req, res) => {
  let p = join(OUT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  try {
    if ((await stat(p)).isDirectory()) p = join(p, "index.html");
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(await readFile(p));
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(0);
const BASE = `http://127.0.0.1:${server.address().port}`;

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const sent = [];
async function mockCatalogues(ctx) {
  await ctx.route(/wikipedia\.org/, (r) => {
    const q = new URL(r.request().url()).searchParams.get("gsrsearch") || "";
    sent.push(q);
    // answers with a film named after the search, like Wikipedia would
    const name = q.replace(/hastemplate:.*$/, "").replace(/\b\d{4}\b/, "").trim();
    const year = (q.match(/\b(\d{4})\b/) || [])[1] || "2022";
    const by = name.toLowerCase() === "aftersun" ? "Charlotte Wells" : "Someone";
    const pages = { 1: { pageid: name.length, index: 1, title: name + " (film)", description: `${year} film by ${by}`, thumbnail: { source: "https://upload.wikimedia.org/" + encodeURIComponent(name) + ".jpg" } } };
    r.fulfill({ json: { query: { pages } } });
  });
  await ctx.route(/openlibrary\.org\/search/, (r) => {
    sent.push(new URL(r.request().url()).searchParams.get("q"));
    r.fulfill({ json: { docs: [{ key: "/works/OL1W", title: "The Remains of the Day", author_name: ["Kazuo Ishiguro"], first_publish_year: 1989, cover_i: 1 }] } });
  });
  await ctx.route(/musicbrainz\.org/, (r) => {
    const u = r.request().url();
    sent.push(new URL(u).searchParams.get("query"));
    r.fulfill({ json: u.includes("release-group") ? { "release-groups": [{ id: "rg1", title: "Opus", "primary-type": "Album", "first-release-date": "2024", score: 100, "artist-credit": [{ name: "Ryuichi Sakamoto" }] }] } : { recordings: [] } });
  });
  await ctx.route(/(upload\.wikimedia\.org|covers\.openlibrary\.org|coverartarchive\.org|i\.ytimg\.com)/, (r) => r.fulfill({ body: PNG, contentType: "image/png" }));
}

const fail = (m) => {
  throw new Error(m);
};
const seen = (loc) => loc.first().waitFor({ timeout: 6000 }).then(() => true, () => false);
const ok = (c, m) => (c ? console.log("  ✓ " + m) : fail("✗ " + m));

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
await mockCatalogues(ctx);
await ctx.addInitScript(() => {
  if (!sessionStorage.getItem("seeded")) {
    localStorage.setItem("strata:mode", "local");
    localStorage.setItem("strata:voice", "local");
    localStorage.setItem("strata:onboarded", "1");
    sessionStorage.setItem("seeded", "1");
  }
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = async (name) => SHOTS && (await page.screenshot({ path: join(SHOTS, name + ".png") }));
const go = async (path) => {
  await page.goto(BASE + path);
  await page.waitForLoadState("networkidle");
};

try {
  console.log("Collections and Everything you saved");
  await go("/collections/");
  ok(await seen(page.getByRole("link", { name: /Everything you saved/ })), "Collections opens with Everything you saved");
  ok((await page.locator(".board-card").count()) >= 3, "collections show as boards, plus New collection");
  ok(await seen(page.getByRole("link", { name: "Collections", exact: true })), "the bottom bar says Collections");
  await page.getByRole("link", { name: /Everything you saved/ }).click();
  await page.waitForURL(/\/interests\//);
  await page.getByText("Perfect Days").first().waitFor();
  ok(await seen(page.getByText("Film · Quiet · 2 thoughts")), "sample film shows its mood and two pinned thoughts");
  await page.waitForFunction(() => document.querySelectorAll(".saved-grid img").length >= 3, null, { timeout: 8000 });
  ok(true, "posters were looked up and shown");
  await shot("01-saved");
  await page.getByRole("button", { name: "Mood filter" }).click();
  await page.getByRole("button", { name: "Quiet" }).click();
  ok((await page.locator(".saved-tile").count()) === 3, "mood filter shows the three quiet films");
  await page.getByRole("button", { name: /Mood filter/ }).click();
  await page.getByRole("button", { name: "Any" }).click();
  await page.getByRole("button", { name: /Not in a collection/ }).click();
  ok(!(await page.getByText("Perfect Days").count()), "Not in a collection leaves out what's already in one");
  await page.getByRole("button", { name: /^All · / }).click();
  await page.getByRole("button", { name: "Select" }).click();
  await page.getByRole("button", { name: "Columbus" }).click();
  await page.getByRole("button", { name: "Paterson" }).click();
  ok(await seen(page.getByText("2 selected")), "picked two things");
  await shot("01b-saved-select");
  await page.getByRole("region", { name: "Do with the picked things" }).getByRole("button", { name: "Cosy" }).click();
  ok(await seen(page.getByText("Gave 2 things the mood Cosy.")), "gave two things a mood at once");

  console.log("Add a film from the catalogue");
  await page.getByRole("link", { name: "Add" }).click();
  await page.getByLabel("Search by title").fill("Aftersun");
  await page.getByText("Charlotte Wells · 2022 · Film").waitFor();
  ok(sent.some((q) => q && q.startsWith("Aftersun")), "only the typed title was sent");
  await shot("02-add");
  await page.locator(".item-row", { hasText: "Charlotte Wells" }).getByRole("button", { name: "Add" }).click();
  await page.waitForURL(/\/interest\/\?id=/);
  await page.getByRole("heading", { name: "Aftersun" }).waitFor();
  await page.getByRole("button", { name: "Watched" }).click();
  await page.getByRole("radio", { name: "5 out of 5" }).click();
  await page.getByRole("button", { name: "Add mood" }).click();
  await page.getByRole("button", { name: "Heavy" }).click();
  ok(await seen(page.getByRole("button", { name: "Remove mood Heavy" })), "mood added");

  await page.getByLabel("Type your own mood").fill("bittersweet");
  await page.getByLabel("Type your own mood").press("Enter");
  ok(await seen(page.getByRole("button", { name: "Remove mood Bittersweet" })), "typed a mood of my own");
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Add genre" }).click();
  await page.getByRole("button", { name: "Drama", exact: true }).click();
  await page.getByLabel("Type your own genre").fill("Coming of age");
  await page.getByLabel("Type your own genre").press("Enter");
  ok(await seen(page.getByRole("button", { name: "Remove genre Coming of age" })), "suggested and typed genres");

  console.log("Pin a thought to it");
  await page.getByRole("link", { name: "Write a thought about it" }).click();
  await page.getByText("About: Aftersun").waitFor();
  await page.getByLabel("Your thought").fill("The last scene keeps playing in my head.");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/interest\/\?id=/);
  await page.getByText("The last scene keeps playing in my head.").waitFor();
  ok(true, "new thought shows on the film's page");
  await page.getByRole("button", { name: "Add to a collection" }).click();
  await page.getByRole("button", { name: "Films that stayed with me" }).click();
  await page.locator(".card", { hasText: "Films that stayed with me" }).first().waitFor();
  ok(true, "film added to a collection");
  ok(await seen(page.getByText("In: Films that stayed with me")), "the film says which collections it's in");
  ok(await seen(page.getByRole("region", { name: "Your thoughts on this" }).getByText("The last scene keeps playing")), "Your thoughts on this box");
  await shot("03-film-page");

  console.log("A collection, as tiles");
  await page.locator("a.card[href*=\"/collection/\"]", { hasText: "Films that stayed with me" }).click();
  await page.waitForURL(/\/collection\//);
  ok(await seen(page.getByText("Aftersun").first()), "Aftersun in the collection");
  ok(!(await page.getByRole("button", { name: /^Type filter/ }).count()), "no Type filter when it's all films");
  await page.getByRole("button", { name: "Mood filter" }).click();
  await page.getByRole("button", { name: "Heavy" }).click();
  ok(await seen(page.getByText(/^1 of \d+$/)), "mood filter inside a collection");
  await shot("04-collection");
  await page.getByRole("button", { name: "Edit name, note and cover" }).click();
  await page.getByRole("radio", { name: "Use Aftersun as the cover" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await go("/collections/");
  ok(await seen(page.locator(".board-card", { hasText: "Films that stayed with me" }).locator(".board-cover.n1")), "a chosen cover replaces the collage");

  console.log("A collection, as a board");
  await go("/collection/?id=c1");
  await page.getByRole("button", { name: "Board" }).click();
  await page.locator(".board-item").first().waitFor();
  const n = await page.locator(".board-item").count();
  ok(n >= 3, "every film sits on the board");
  const first = page.locator(".board-item").nth(1);
  const b0 = await first.boundingBox();
  await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(520);
  ok(await seen(page.getByText("Moving…")), "long-press picks a film up");
  for (let i = 1; i <= 6; i++) await page.mouse.move(b0.x + b0.width / 2 + i * 12, b0.y + b0.height / 2 + i * 10);
  await shot("04b-board-moving");
  await page.mouse.up();
  const b1 = await first.boundingBox();
  ok(Math.abs(b1.x - b0.x) > 40, "the film moved with the finger");
  const bgBefore = await page.locator(".board").evaluate((el) => el.style.backgroundPosition);
  const bb = await page.locator(".board").boundingBox();
  await page.mouse.move(bb.x + bb.width - 30, bb.y + 240);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(bb.x + bb.width - 30 - i * 15, bb.y + 240 - i * 10);
  await page.mouse.up();
  ok((await page.locator(".board").evaluate((el) => el.style.backgroundPosition)) !== bgBefore, "the dots move with the board");
  const placed = await page.evaluate(() => JSON.parse(localStorage.getItem("strata:try:v1")).collectionItems.filter((x) => x.x != null).length);
  ok(placed >= 1, "where it was put is saved");
  await page.getByRole("button", { name: "Stickers", exact: true }).click();
  await page.getByRole("button", { name: "Add star" }).click();
  await page.getByRole("button", { name: "Label", exact: true }).click();
  await page.getByLabel("Label text").fill("rewatch in winter");
  await page.getByRole("button", { name: "Add", exact: true }).last().click();
  ok((await page.locator(".board-decor").count()) === 2, "a sticker and a label on the board");
  await shot("04c-board");
  await go("/collection/?id=c1");
  await page.locator(".board-item").first().waitFor();
  ok((await page.locator(".board-decor").count()) === 2, "the board view and its stickers are remembered");
  await page.getByRole("button", { name: "Tidy up" }).click();
  await page.waitForTimeout(300);
  await page.locator(".board-item").first().click();
  await page.waitForURL(/\/interest\//);
  ok(true, "tapping a film on the board opens it");
  await go("/collection/?id=c1");
  await page.getByRole("button", { name: "Tiles" }).click();

  console.log("Pin an existing thought from its own page");
  await go("/thoughts/?view=list");
  await page.getByText("A website is closer to a room than a poster.").click();
  await page.getByRole("button", { name: "Pin to a film, book or song" }).click();
  await page.getByRole("button", { name: /Columbus/ }).click();
  ok(await seen(page.getByRole("link", { name: /Columbus/ })), "thought shows the film it's pinned to");

  console.log("Press and hold a word to link it");
  await page.evaluate(() => {
    const el = document.querySelector(".ruled-text");
    const node = [...el.querySelectorAll("span")].map((s) => s.firstChild).find((n) => n && n.textContent.includes("poster"));
    const at = node.textContent.indexOf("poster");
    const r = document.createRange();
    r.setStart(node, at);
    r.setEnd(node, at + 6);
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  });
  await page.getByRole("button", { name: "Link to a collection" }).click();
  ok(await seen(page.getByRole("heading", { name: "Link “poster”" })), "choosing a word offers to link it, with a search");
  await page.getByLabel("Search collections and saved things").fill("rainy");
  await shot("05-word-link");
  await page.getByRole("button", { name: /For a rainy Sunday/ }).click();
  ok(await seen(page.locator(".word-link", { hasText: "poster" })), "the word is now a link in the thought");
  ok((await page.locator(".word-link").getAttribute("href")).includes("/collection/?id=c2"), "and it opens the collection");
  ok(await seen(page.getByRole("button", { name: "Unlink poster" })), "linked words are listed and can be unlinked");

  console.log("Threads: one line of thoughts; a thought can be in several");
  ok(await seen(page.getByRole("region", { name: "Threads" }).getByRole("link", { name: /On routine and freedom/ })), "a thought lists the threads it's in");
  await go("/thread/?id=sample-thread");
  ok(await seen(page.locator(".card", { hasText: "Started here" }).getByText("Almost nothing happens in Perfect Days")), "the thread starts with its first thought");
  ok(await seen(page.locator(".tl-card", { hasText: "A website is closer" })), "a thought added from elsewhere sits in the line like any other");
  ok(!(await page.getByText(/Linked ·|Link a thought under/).count()), "no separate linked branches any more");
  ok(await seen(page.locator(".label-chip", { hasText: "Film" })), "the thread shows its labels");
  await page.locator(".tl-card", { hasText: "My best mornings" }).click({ button: "right" });
  ok(await seen(page.getByRole("dialog", { name: "Thought options" })), "press and hold a thought for a quick menu");
  await shot("05a-hold-menu");
  await page.getByRole("dialog", { name: "Thought options" }).getByRole("button", { name: "Cancel" }).click();
  await shot("05a-thread");
  await go("/thoughts/?view=list");
  await page.getByText("Why do people perform busyness").click();
  await page.getByRole("button", { name: "Start a thread from this" }).click();
  await page.getByLabel("Thread name").fill("On busyness");
  await page.getByRole("button", { name: "Start the thread" }).click();
  await page.waitForURL(/\/thread\//);
  ok(await seen(page.locator(".card", { hasText: "Started here" }).getByText("Why do people perform busyness")), "new thread grows from the thought");
  await page.getByRole("button", { name: "Add thoughts" }).click();
  await page.getByRole("checkbox", { name: /I remember songs/ }).click();
  await page.getByRole("button", { name: "Add 1 thought" }).click();
  ok(await seen(page.locator(".tl-card", { hasText: "I remember songs" })), "Add thoughts puts one you already wrote in the thread");
  await go("/thoughts/?view=list");
  await page.locator(".thought-card", { hasText: "I remember songs by where I was standing." }).click();
  await page.getByRole("region", { name: "Threads" }).getByRole("button", { name: "Add to a thread" }).click();
  await page.getByRole("checkbox", { name: /On routine and freedom/ }).click();
  await shot("05b-link-sheet");
  await page.getByRole("button", { name: "Add to 1 thread" }).click();
  ok((await page.getByRole("region", { name: "Threads" }).getByRole("link").count()) === 2, "one thought in two threads, listed the same way");
  ok(!(await page.getByRole("button", { name: "Add to a collection" }).count()), "thoughts no longer go into collections");

  console.log("Thoughts screen: tabs, list or cards, pin to a thread");
  await go("/thoughts/");
  ok(await seen(page.locator(".guide-layer")), "the first time you flip through, a guide shows each swipe");
  await page.waitForTimeout(700);
  await shot("05c0-swipe-guide");
  await page.getByRole("button", { name: "Got it" }).click();
  ok(!(await page.locator(".guide-layer").count()), "and it goes away once read");
  ok(await seen(page.locator(".deck-front")), "Thoughts opens as cards");
  ok((await page.locator(".review-actions .btn.act").count()) === 3, "Discard, Not sure and Keep buttons carry colours and swipe icons");
  ok(await seen(page.getByRole("tab", { name: /Unsorted/ })), "filters are tabs, not buttons");
  ok(await seen(page.getByRole("tab", { name: "Threads" })), "Threads is a tab inside Thoughts");
  const navNames = await page.getByRole("navigation", { name: "Main" }).getByRole("link").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") || e.textContent.trim()));
  ok(navNames.join(",") === "Home,Thoughts,New thought,Collections", "bottom bar is Home, Thoughts, +, Collections: " + navNames.join(","));
  ok(!(await page.getByRole("navigation", { name: "Main" }).getByRole("button").count()), "no More in the bottom bar");
  await page.locator("header").getByRole("button", { name: "Menu" }).click();
  const drawer = page.getByRole("dialog", { name: "Menu" });
  ok(await seen(drawer.getByText("Time capsules")), "the menu opens a drawer, with a place for time capsules");
  ok(!(await drawer.getByRole("link", { name: /Threads/ }).count()), "Threads lives in Thoughts only, not twice");
  ok(await seen(page.locator("header").getByRole("button", { name: "Close the menu" })), "the menu button turns into a close cross");
  await page.waitForTimeout(650);
  await shot("05c2-drawer");
  await page.locator("header").getByRole("button", { name: "Close the menu" }).click();
  await drawer.waitFor({ state: "detached" });
  ok(true, "and closes the drawer again");
  await go("/thoughts/");
  ok(await seen(page.locator("header").getByRole("link", { name: /^Inbox/ })), "Inbox is an icon at the top right");
  await page.locator("header").getByRole("button", { name: "Search" }).click();
  ok(await seen(page.locator(".search-sheet")), "search slides in over the screen");
  await page.waitForTimeout(400);
  await shot("05c1-search-sheet");
  await page.keyboard.press("Escape");
  await page.locator(".search-sheet").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Show as a list" }).click();
  const pinCard = page.locator(".thought-wrap", { hasText: "My best mornings" });
  await pinCard.getByRole("button", { name: /thread/ }).click();
  ok(await seen(page.getByRole("heading", { name: /Add it to a thread/ })), "the pin asks which thread");
  await page.getByRole("dialog").getByRole("button", { name: /On busyness/ }).click();
  ok(await seen(page.getByText("Added to “On busyness”.")), "added to a thread from the list");
  await page.locator(".thought-card", { hasText: "A website is closer" }).click({ button: "right" });
  ok(await seen(page.getByRole("dialog", { name: "Thought options" }).getByRole("button", { name: "Add to a thread" })), "press and hold in the list offers Add to a thread");
  await page.getByRole("dialog", { name: "Thought options" }).getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Show as cards to flip through" }).click();
  await page.locator(".deck-front").waitFor();
  ok(await seen(page.locator(".deck-front").getByRole("button", { name: /thread/ })), "each card has the pin too");
  await shot("05c-thoughts-cards");
  await page.getByRole("button", { name: "Show as a list" }).click();
  await shot("05d-thoughts-list");

  console.log("Threads tab: labels, filters, New thread");
  await go("/thoughts/");
  await page.getByRole("tab", { name: "Threads" }).click();
  await page.waitForURL(/\/threads\//);
  ok(await seen(page.getByRole("tab", { name: "Threads", selected: true })), "the Threads tab opens the threads, still under Thoughts");
  ok(await seen(page.getByRole("button", { name: "Start a new thread" }).first()), "New thread sits above the list");
  ok((await page.locator(".thread-home").count()) === 2, "both threads listed");
  await page.getByRole("button", { name: "Film" }).click();
  ok((await page.locator(".thread-home").count()) === 1, "a label filters the threads");
  await shot("05e-threads");
  await page.getByRole("button", { name: /^All/ }).click();
  await page.getByLabel("Sort threads").selectOption("oldest");
  ok((await page.locator(".thread-home strong").first().innerText()) === "On routine and freedom", "sorting oldest first");
  await page.getByRole("button", { name: "Start a new thread" }).first().click();
  await page.getByLabel("Name the idea").fill("On rooms");
  await page.getByRole("button", { name: "Start thread" }).click();
  await page.waitForURL(/\/thread\//);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "+ Add label" }).click();
  await page.getByLabel("New label").fill("Spaces");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Save" }).click();
  ok(await seen(page.locator(".label-chip", { hasText: "Spaces" })), "labels are added in Edit");

  console.log("Writing timer is offered, not shown");
  await go("/write/");
  ok(!(await page.locator(".timer-card").count()), "no timer until you ask for one");
  ok(await seen(page.getByText(/Getting distracted\?/)), "the offer says what the timer is for");
  await page.getByRole("button", { name: /Set a timer/ }).click();
  ok(await seen(page.locator(".timer-card")), "tapping it brings the timer");

  console.log("Book and music search");
  await go("/interests/add/?kind=book");
  await page.getByLabel("Search by title").fill("remains of the day");
  ok(await seen(page.getByText("Already in your interests")), "existing book found on the shelf first");
  await page.getByRole("button", { name: "Music" }).click();
  await page.getByLabel("Search by title").fill("Opus");
  await page.getByText("Ryuichi Sakamoto · 2024 · Album").waitFor({ timeout: 6000 });
  ok(true, "music search shows albums");

  console.log("Inbox");
  // a thought from a year ago today, and a film saved six weeks ago, are in the sample data
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("strata:try:v1"));
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    db.thoughts.push({ id: "old1", body: "The best ideas this week all arrived while I was doing the dishes.", kind: "card", topics: [], finished: true, kept: false, thread_id: null, created_at: d.toISOString(), updated_at: d.toISOString(), discarded_at: null, version_count: 0 });
    localStorage.setItem("strata:try:v1", JSON.stringify(db));
  });
  await go("/inbox/");
  ok(await seen(page.getByText("A year ago today")), "a year ago today");
  ok(await seen(page.getByText("Still want to watch?")), "still want to watch (Paterson)");
  await shot("05-inbox-back");
  await page.getByRole("button", { name: "Keep waiting" }).click();
  await page.getByText("Still want to watch?").waitFor({ state: "detached" });
  ok(true, "Keep waiting puts it away for a month");
  await page.getByRole("button", { name: /To sort/ }).click();
  await page.getByLabel("Paste a link").fill("https://letterboxd.com/film/columbus-2017/");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText("letterboxd.com · today").waitFor();
  await shot("06-inbox-sort");
  await page.locator(".item-row", { hasText: "Slow living" }).getByRole("button", { name: "File it" }).click();
  await page.getByRole("button", { name: "Article" }).click();
  await page.getByRole("button", { name: /Save it, / }).click();
  await page.waitForURL(/\/interest\//);
  ok(await seen(page.getByRole("heading", { name: "Slow living" })), "filed link became an article");

  console.log("Share to Strata");
  await go("/share/?title=" + encodeURIComponent("Paterson (2016) - IMDb") + "&text=" + encodeURIComponent("https://www.imdb.com/title/tt5247022/"));
  ok(await seen(page.getByText("recognised as a film")), "shared IMDb link recognised as a film");
  ok((await page.getByLabel("Title").inputValue()) === "Paterson", "title cleaned up");
  await page.getByLabel("A thought to go with it (optional)").fill("Maya said this one is like Perfect Days");
  await shot("07-share");
  await page.getByRole("radio", { name: /Inbox, sort later/ }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/inbox\//);
  ok(await seen(page.getByText("Paterson").first()), "shared link waits in To sort");
  const manifest = await (await fetch(BASE + "/manifest.webmanifest")).json();
  ok(manifest.share_target?.action === "./share/", "manifest offers Strata in the share menu");

  console.log("Letterboxd import");
  const dir = await mkdtemp(join(tmpdir(), "strata-"));
  const zip = zipSync({
    "watched.csv": strToU8("Date,Name,Year,Letterboxd URI\n2024-03-02,Columbus,2017,https://boxd.it/a\n2024-05-01,Past Lives,2023,https://boxd.it/b\n"),
    "ratings.csv": strToU8("Date,Name,Year,Letterboxd URI,Rating\n2024-05-01,Past Lives,2023,https://boxd.it/b,4.5\n"),
    "reviews.csv": strToU8('Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n2024-05-02,Past Lives,2023,https://boxd.it/b,4.5,,"Two people, one ""what if"", and a bar in New York.",,2024-05-01\n'),
    "watchlist.csv": strToU8("Date,Name,Year,Letterboxd URI\n2024-01-10,Stalker,1979,https://boxd.it/c\n"),
  });
  await writeFile(join(dir, "letterboxd-export.zip"), zip);
  await go("/interests/import/");
  await page.getByLabel("Pick your Letterboxd export file").setInputFiles(join(dir, "letterboxd-export.zip"));
  await page.getByText("Found in your file").waitFor();
  ok(await seen(page.getByRole("button", { name: "Add 3 films to Saved" })), "3 films found (2 watched, 1 on the watchlist)");
  await shot("08-import");
  await page.getByRole("button", { name: "Add 3 films to Saved" }).click();
  await page.getByText("Your shelf is in").waitFor();
  ok(await seen(page.getByText(/2 new films, 1 you already had, and 1 review as thoughts/)), "Columbus matched, review became a thought");
  await page.getByRole("link", { name: /Later/ }).click();
  await page.waitForURL(/\/inbox\//);
  await page.locator(".import-line").first().waitFor();
  ok((await page.locator(".import-line").count()) === 1, "the import is one line in Inbox, not one per film");
  ok(await seen(page.getByText("You imported 2 films from Letterboxd")), "the line says what came in");
  await shot("08b-inbox-import");
  await page.locator(".import-line").click();
  await page.waitForURL(/\/import\//);
  ok(await seen(page.getByRole("heading", { name: "2 films from Letterboxd" })), "the import has its own sorting page");
  await page.locator(".saved-tile").nth(1).waitFor();
  ok((await page.locator(".saved-tile").count()) === 2, "it shows the films with no mood yet");
  await page.getByRole("button", { name: "Stalker" }).click();
  await shot("08c-import-sort");
  await page.getByRole("region", { name: "Do with the picked things" }).getByRole("button", { name: "Heavy" }).click();
  ok(await seen(page.getByText("Gave 1 the mood Heavy.")), "gave a mood from the import page");
  await page.getByRole("button", { name: "Flip through" }).click();
  await page.locator(".flip-item").waitFor();
  await page.locator(".flip-item").getByRole("button", { name: "Quiet" }).click();
  ok((await page.locator(".flip-item").getByRole("button", { name: "Quiet" }).getAttribute("aria-pressed")) === "true", "flip through the import and give a mood");
  await shot("08d-import-flip");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  ok(await seen(page.getByText("That's all of them")), "flipped through to the end");
  await page.getByRole("button", { name: "Flip through" }).click();
  ok((await page.locator(".saved-tile").count()) <= 1, "sorted films leave the No mood yet list");
  await page.locator("header").getByRole("button", { name: "Done", exact: true }).click();
  await page.waitForURL(/\/inbox\//);
  await page.getByText("Shared to Strata").waitFor();
  ok(!(await page.locator(".import-line").count()), "Done takes the import off Inbox");
  // importing again adds nothing twice
  await go("/interests/import/");
  await page.getByLabel("Pick your Letterboxd export file").setInputFiles(join(dir, "letterboxd-export.zip"));
  await page.getByRole("button", { name: "Add 3 films to Saved" }).click();
  await page.getByText(/0 new films, 3 you already had\./).waitFor();
  ok(true, "second import adds nothing twice");
  await go("/interests/?kind=film");
  await page.getByText("Past Lives").click();
  await page.getByText("Two people, one \"what if\", and a bar in New York.").waitFor();
  ok(await seen(page.getByText(/2 May 2024.*from Letterboxd/)), "review kept its date and source");
  ok((await page.getByRole("radio", { name: "5 out of 5" }).getAttribute("aria-checked")) === "true", "4.5 stars became 5 dots");

  console.log("Goodreads import");
  const gr = 'Book Id,Title,Author,My Rating,Year Published,Original Publication Year,Date Read,Date Added,Exclusive Shelf,My Review\n1,"The Remains of the Day",Kazuo Ishiguro,5,2005,1989,2023/02/01,2023/01/01,read,"Quiet<br/>and devastating."\n2,Stoner,John Williams,0,2006,1965,,2024/02/01,to-read,\n';
  await writeFile(join(dir, "goodreads_library_export.csv"), gr);
  await go("/interests/import/");
  await page.getByRole("button", { name: /Goodreads/ }).click();
  await page.getByLabel("Pick your Goodreads export file").setInputFiles(join(dir, "goodreads_library_export.csv"));
  await page.getByRole("button", { name: "Add 2 books to Saved" }).click();
  await page.getByText(/1 new book, 1 you already had, and 1 review as thoughts/).waitFor();
  ok(true, "Goodreads shelf in; existing book matched");

  console.log("Home and export");
  await go("/");
  ok(await seen(page.getByText("Recently saved films, books and music")), "Home shows recently saved things, named for what they are");
  ok((await page.locator(".week-row a, .week-row .strip-day").count()) === 7, "the date row shows one week");
  await page.getByRole("button", { name: "Previous week" }).click();
  ok(await seen(page.getByText(/Last week/)), "and can go back a week");
  await page.getByRole("button", { name: "Next week" }).click();
  ok(await seen(page.getByRole("heading", { name: "Your threads" })), "Your threads sits on Home");
  await page.locator(".has-mascot .card-mascot").first().click();
  ok((await page.locator(".card-mascot.pop").count()) === 1 && new URL(page.url()).pathname === "/", "tapping the mascot makes it pop, and stays on the page");
  ok(await seen(page.getByRole("link", { name: /^Collections, \d+$/ })), "Home has a Collections folder");
  await shot("09-home");

  console.log("Profile, settings and colour themes");
  ok(await seen(page.locator("header").getByRole("img", { name: "Strata" })), "Home shows the Strata logo at the top left");
  await page.locator("header").getByRole("button", { name: "Menu" }).click();
  await page.waitForTimeout(650);
  await shot("09b-home-drawer");
  const ink = await page.evaluate(() => [getComputedStyle(document.querySelector(".drawer-row strong")).color, getComputedStyle(document.querySelector(".drawer-ic svg")).color, getComputedStyle(document.querySelector(".drawer")).backgroundColor]);
  ok(ink[0] === "rgb(21, 21, 21)" && ink[1] === "rgb(21, 21, 21)", "drawer text and icons are dark on its light paper, even from the dark Home header: " + ink.join(" / "));
  await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: /Your profile|Profile and export/ }).click();
  await page.waitForURL(/\/profile\//);
  await page.getByRole("button", { name: "Add a name" }).click();
  await page.getByLabel("Your name").fill("Chris");
  await page.getByRole("button", { name: "Save" }).click();
  ok(await seen(page.getByText("Chris", { exact: true })), "name saved on the profile");
  ok(await seen(page.locator(".profile-stats b").first()), "profile shows your numbers");
  ok(await seen(page.getByRole("button", { name: "Delete everything on this phone" })), "profile offers deleting your data");
  await page.getByRole("button", { name: "Delete everything on this phone" }).click();
  ok(await page.getByRole("button", { name: "Delete for good" }).isDisabled(), "delete waits until you type DELETE");
  await page.getByRole("button", { name: "Keep everything" }).click();
  await shot("12-profile");
  await page.getByRole("link", { name: /^Settings/ }).click();
  await page.getByRole("radio", { name: /Navy and mustard/ }).click();
  ok((await page.evaluate(() => document.documentElement.dataset.theme)) === "navy", "theme switched");
  await shot("10-settings-navy");
  await go("/");
  ok((await page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--ink").trim())) === "#17223b", "theme kept after reopening");
  await shot("11-home-navy");
  await page.evaluate(() => localStorage.setItem("strata:theme", "lilac"));
  await go("/interests/?kind=film");
  await page.getByRole("button", { name: "Genre filter" }).click();
  await page.getByRole("button", { name: "Coming of age" }).click();
  ok((await page.locator(".saved-tile").count()) === 1, "genre filter in Everything you saved");

  console.log("Remove an item: its thoughts stay");
  await go("/interests/?kind=film");
  await page.getByText("Aftersun").click();
  await page.getByRole("button", { name: "Remove from Saved" }).click();
  await page.getByRole("button", { name: "Remove it" }).click();
  await page.waitForURL(/\/interests\//);
  await go("/thoughts/");
  ok(await seen(page.getByText("The last scene keeps playing in my head.")), "thought stayed after its film was removed");

  console.log("Opening screens, calendar, unfinished stack");
  // someone brand new: no try-out data yet (kept aside and put back after)
  await page.evaluate(() => {
    localStorage.setItem("e2e:keep", localStorage.getItem("strata:try:v1"));
    for (const k of ["strata:onboarded", "strata:mode", "strata:try:v1"]) localStorage.removeItem(k);
  });
  await go("/welcome/");
  ok(await seen(page.getByText("hi!")), "the splash: the mascot builds itself and says hi");
  ok(await seen(page.getByText("It all lands at once.")), "then the first opening screen shows for someone new");
  await shot("20-onboarding-1");
  await page.getByRole("button", { name: "Next" }).click();
  ok(await seen(page.getByText("Catch them as they come.")), "second opening screen");
  ok(!(await page.getByRole("button", { name: "Next" }).isVisible()), "second screen has no Next, you swipe up instead");
  await page.mouse.move(200, 600);
  await page.mouse.down();
  await page.mouse.move(200, 420, { steps: 6 });
  await page.mouse.up();
  ok(await seen(page.getByText("Yours, and only yours.")), "swiping up puts the labels in line and moves on by itself");
  await shot("21-onboarding-3");
  await page.getByRole("button", { name: "Give the mascot a poke" }).click();
  ok(await seen(page.locator(".mascot.pop")), "poking the mascot pops its layers");
  ok(await seen(page.locator(".onb-label.glow")), "and a light runs down the labels");
  await page.getByRole("button", { name: "Start your line" }).click();
  ok(await seen(page.getByText("Hi! I keep your thoughts safe.")), "Start your line goes straight to Home, where the mascot says hello");
  ok(await seen(page.getByText("Nothing here yet.")), "someone new starts with an empty Home, not sample data");
  await page.getByRole("link", { name: "Write your first thought" }).click();
  await page.getByLabel("Your thought").fill("My very first thought.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  ok(await seen(page.getByRole("alertdialog", { name: /Keep this on your phone|Create an account/ })), "the first save offers an account");
  await page.getByRole("button", { name: /on this phone/ }).click();
  ok(await seen(page.getByText("My very first thought.")), "keeping it on the phone saves it");
  await go("/write/");
  await page.getByLabel("Your thought").fill("A second one.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  ok(await seen(page.getByText("A second one.")), "after that, saving does not ask again");
  await go("/welcome/");
  ok(!(await page.getByText("It all lands at once.").isVisible()), "opening screens only show once");
  await page.evaluate(() => {
    localStorage.setItem("strata:try:v1", localStorage.getItem("e2e:keep"));
    localStorage.removeItem("e2e:keep");
    localStorage.setItem("strata:mode", "local");
  });
  await page.evaluate(() => localStorage.removeItem("strata:onboarded"));
  await go("/");
  ok(await seen(page.getByText("It all lands at once.")), "people already set up see the opening screens once on Home");
  await page.getByRole("button", { name: "Skip" }).click();
  ok(await seen(page.locator("header").getByRole("button", { name: "Menu" })), "Skip goes to Home");
  await go("/profile/");
  await page.getByRole("button", { name: /Watch the intro again/ }).click();
  ok(await seen(page.getByText("It all lands at once.")), "Profile can replay the intro");
  await page.getByRole("button", { name: "Skip" }).click();

  await go("/");
  await page.getByRole("link", { name: /20\d\d/ }).first().click();
  await page.waitForURL(/\/calendar\//);
  ok(await seen(page.locator(".cal-day.today")), "calendar opens from the month on Home");
  ok((await page.locator(".cal-day.picked").count()) === 1, "one day is picked");
  ok((await page.locator(".cal-day .cal-dot").count()) > 0, "calendar marks days with thoughts");
  await shot("22-calendar");
  await page.getByRole("button", { name: "Previous month" }).click();
  ok(await seen(page.locator(".cal-day")), "calendar moves between months");
  await go("/");
  await page.locator(".strip-day").first().click();
  await page.waitForURL(/\/calendar\/\?d=/);
  ok(await seen(page.locator(".cal-day.picked")), "tapping a day on Home opens the calendar on that day");

  await go("/");
  await page.locator('a[href*="/stack/"]').first().click();
  await page.waitForURL(/\/stack\//);
  ok(await seen(page.getByText("The train window is the only screen")), "Unfinished opens as a card stack");
  await shot("23-stack");
  await page.getByRole("link", { name: "Keep writing" }).click();
  await page.waitForURL(/\/write\//);
  ok(true, "Keep writing opens the thought to finish it");

  console.log("Swipe and mascot");
  await go("/review/");
  await page.waitForURL(/view=cards/);
  await page.locator(".deck-front").waitFor();
  const before = await page.locator(".swipe-help").innerText();
  const box = await page.locator(".deck-front").boundingBox();
  const y = box.y + box.height / 3;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(box.x + box.width / 2 + k * 25, y);
  ok(await seen(page.locator(".swipe-hint.right")), "dragging right shows Keep");
  ok((await page.locator(".card-mascot.arms-up").count()) === 1, "mascot cheers while you drag right");
  await shot("24-swipe");
  await page.mouse.up();
  await page.waitForFunction((b) => document.querySelector(".swipe-help")?.textContent !== b, before, { timeout: 4000 });
  ok(true, "swiping right kept the card and moved on");
  const upText = (await page.locator(".deck-front .ruled-text").innerText()).slice(0, 20);
  const ub = await page.locator(".deck-front").boundingBox();
  await page.mouse.move(ub.x + ub.width / 2, ub.y + ub.height / 2);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(ub.x + ub.width / 2, ub.y + ub.height / 2 - k * 20);
  ok(await seen(page.locator(".swipe-hint.up")), "dragging up shows Not sure");
  await page.mouse.up();
  await page.waitForTimeout(500);
  ok(!(await page.locator(".deck-front .ruled-text").innerText()).startsWith(upText), "swiping up moves on");
  const stillUnsorted = await page.evaluate((t) => JSON.parse(localStorage.getItem("strata:try:v1")).thoughts.some((x) => x.body.startsWith(t) && !x.kept && !x.discarded_at), upText);
  ok(stillUnsorted, "and leaves that thought unsorted");
  ok((await page.locator(".mascot.live").count()) > 0, "mascot moves on screen");
  await go("/");
  ok(await seen(page.locator(".has-mascot .card-mascot")), "mascot waves from the Pick up card on Home");

  console.log("Labels and tap sizes");
  const audit = async () =>
    page.evaluate(() => {
      const out = { unnamed: [], small: [] };
      for (const el of document.querySelectorAll("a[href], button, [role=button], input, select, textarea")) {
        const r = (el.tagName === "INPUT" && el.closest("label")) ? el.closest("label").getBoundingClientRect() : el.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden") continue;
        const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.getAttribute("placeholder") || (el.labels && el.labels[0]?.textContent) || "").trim();
        const tag = el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "") + " “" + name.slice(0, 30) + "”";
        if (!name && !el.closest("[aria-hidden=true]")) out.unnamed.push(tag);
        const inText = el.closest("p") && el.tagName === "A";
        if (!inText && (r.height < 43.5 || r.width < 43.5) && el.type !== "file" && el.type !== "hidden") out.small.push(tag + " " + Math.round(r.width) + "x" + Math.round(r.height));
      }
      return out;
    });
  const found = { unnamed: new Set(), small: new Set() };
  for (const path of ["/", "/thoughts/", "/thoughts/?filter=unsorted&view=cards", "/stack/", "/calendar/", "/interests/", "/interests/?kind=book", "/collections/", "/collection/?id=c1", "/inbox/", "/search/", "/profile/", "/settings/", "/new/", "/write/", "/threads/", "/thread/?id=sample-thread", "/thought/?id=s5", "/discarded/"]) {
    await go(path);
    await page.waitForTimeout(150);
    const a = await audit();
    a.unnamed.forEach((x) => found.unnamed.add(path + " " + x));
    a.small.forEach((x) => found.small.add(path + " " + x));
  }
  await go("/interests/");
  await page.locator(".saved-tile").first().click();
  await page.waitForURL(/\/interest\//);
  const ia = await audit();
  ia.unnamed.forEach((x) => found.unnamed.add("/interest/ " + x));
  ia.small.forEach((x) => found.small.add("/interest/ " + x));
  ok(found.unnamed.size === 0, "every button and link has a name" + (found.unnamed.size ? ": " + [...found.unnamed].join(" | ") : ""));
  ok(found.small.size === 0, "every tap target is at least 44px" + (found.small.size ? ": " + [...found.small].join(" | ") : ""));

  ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
  console.log("\nAll stage 2 checks passed.");
} catch (e) {
  console.error(e.message);
  await page.screenshot({ path: join(tmpdir(), "strata-fail.png") });
  console.error("Screenshot of the failure: " + join(tmpdir(), "strata-fail.png"));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
