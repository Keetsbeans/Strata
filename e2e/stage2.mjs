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
  console.log("Interests");
  await go("/interests/");
  await page.getByText("Perfect Days").first().waitFor();
  ok(await seen(page.getByText("Watched · 2 thoughts")), "sample film shows its two pinned thoughts");
  await page.waitForFunction(() => document.querySelectorAll(".shelf img").length >= 3, null, { timeout: 8000 });
  ok(true, "posters were looked up and shown");
  await shot("01-interests");

  await page.getByRole("button", { name: "Quiet" }).click();
  ok((await page.locator(".shelf-item").count()) === 3, "mood filter shows the three quiet films");
  await page.getByRole("button", { name: "Quiet" }).click();

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
  await shot("03-film-page");

  console.log("Collections and Pick up again");
  await page.locator("a.card[href*=\"/collection/\"]", { hasText: "Films that stayed with me" }).click();
  await page.waitForURL(/\/collection\//);
  await page.getByRole("heading", { name: /Pick up again|From further back/ }).waitFor();
  ok(true, "Pick up again row on the collection");
  ok((await page.locator(".pickup-card").count()) >= 3, "row holds the collection's thoughts");
  ok(await seen(page.getByText("Aftersun").first()), "Aftersun on the shelf");
  await shot("04-collection");

  console.log("Pin an existing thought from its own page");
  await go("/thoughts/");
  await page.getByText("A website is closer to a room than a poster.").click();
  await page.getByRole("button", { name: "Pin to a film, book or song" }).click();
  await page.getByRole("button", { name: /Columbus/ }).click();
  ok(await seen(page.getByRole("link", { name: /Columbus/ })), "thought shows the film it's pinned to");

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
  await page.getByRole("button", { name: /Add to interests/ }).click();
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
  ok(await seen(page.getByRole("button", { name: "Add 3 films to my interests" })), "3 films found (2 watched, 1 on the watchlist)");
  await shot("08-import");
  await page.getByRole("button", { name: "Add 3 films to my interests" }).click();
  await page.getByText("Your shelf is in").waitFor();
  ok(await seen(page.getByText(/2 new films, 1 you already had, and 1 review as thoughts/)), "Columbus matched, review became a thought");
  // importing again adds nothing twice
  await go("/interests/import/");
  await page.getByLabel("Pick your Letterboxd export file").setInputFiles(join(dir, "letterboxd-export.zip"));
  await page.getByRole("button", { name: "Add 3 films to my interests" }).click();
  await page.getByText(/0 new films, 3 you already had\./).waitFor();
  ok(true, "second import adds nothing twice");
  await go("/interests/?kind=film");
  await page.getByText("Past Lives").click();
  await page.getByText("Two people, one \"what if\", and a bar in New York.").waitFor();
  ok(await seen(page.getByText(/2 May 2024 · .* · from Letterboxd/)), "review kept its date and source");
  ok((await page.getByRole("radio", { name: "5 out of 5" }).getAttribute("aria-checked")) === "true", "4.5 stars became 5 dots");

  console.log("Goodreads import");
  const gr = 'Book Id,Title,Author,My Rating,Year Published,Original Publication Year,Date Read,Date Added,Exclusive Shelf,My Review\n1,"The Remains of the Day",Kazuo Ishiguro,5,2005,1989,2023/02/01,2023/01/01,read,"Quiet<br/>and devastating."\n2,Stoner,John Williams,0,2006,1965,,2024/02/01,to-read,\n';
  await writeFile(join(dir, "goodreads_library_export.csv"), gr);
  await go("/interests/import/");
  await page.getByRole("button", { name: /Goodreads/ }).click();
  await page.getByLabel("Pick your Goodreads export file").setInputFiles(join(dir, "goodreads_library_export.csv"));
  await page.getByRole("button", { name: "Add 2 books to my interests" }).click();
  await page.getByText(/1 new book, 1 you already had, and 1 review as thoughts/).waitFor();
  ok(true, "Goodreads shelf in; existing book matched");

  console.log("Home and export");
  await go("/");
  ok(await seen(page.getByText("Recent interests")), "Home shows recent interests");
  ok(await seen(page.getByRole("link", { name: /^Collections, \d+$/ })), "Home has a Collections folder");
  await shot("09-home");

  console.log("Profile, settings and colour themes");
  await page.getByRole("link", { name: "Your profile" }).click();
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
  await page.getByRole("button", { name: "Coming of age" }).click();
  ok((await page.locator(".shelf-item").count()) === 1, "genre filter on the shelf");

  console.log("Remove an item: its thoughts stay");
  await go("/interests/?kind=film");
  await page.getByText("Aftersun").click();
  await page.getByRole("button", { name: "Remove from interests" }).click();
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
  ok(await seen(page.getByRole("link", { name: "Your profile" })), "Skip goes to Home");
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
  await page.locator(".deck-front").waitFor();
  const before = await page.locator("header .small").innerText();
  const box = await page.locator(".deck-front").boundingBox();
  const y = box.y + box.height / 3;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(box.x + box.width / 2 + k * 25, y);
  ok(await seen(page.locator(".swipe-hint.right")), "dragging right shows Keep");
  ok((await page.locator(".card-mascot.arms-up").count()) === 1, "mascot cheers while you drag right");
  await shot("24-swipe");
  await page.mouse.up();
  await page.waitForFunction((b) => document.querySelector("header .small")?.textContent !== b, before, { timeout: 4000 });
  ok(true, "swiping right kept the card and moved on (" + before + " → " + (await page.locator("header .small").innerText()) + ")");
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
  for (const path of ["/", "/thoughts/", "/review/", "/stack/", "/calendar/", "/interests/", "/interests/?kind=book", "/collections/", "/inbox/", "/search/", "/profile/", "/settings/", "/new/", "/threads/", "/discarded/"]) {
    await go(path);
    await page.waitForTimeout(150);
    const a = await audit();
    a.unnamed.forEach((x) => found.unnamed.add(path + " " + x));
    a.small.forEach((x) => found.small.add(path + " " + x));
  }
  await go("/interests/");
  await page.locator(".shelf-item").first().click();
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
