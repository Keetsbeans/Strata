# Setting up Strata

Strata is an installable web app. The code lives on GitHub, GitHub Pages hosts it for free,
and Supabase stores your thoughts and handles sign-in. Until Supabase is connected, the app
runs in **try-out mode**: everything stays on the phone you use it on.

## 1. Put it online (GitHub, about 5 minutes)

1. Create an empty repository on GitHub called `strata` and give Claude access to it.
2. Once the code is pushed, open the repository's **Settings > Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` now publishes the app at `https://<your-username>.github.io/strata/`.
   The first run takes about 2 minutes; watch it under the **Actions** tab.

## 2. Install it on your phone

Open the address above in your phone's browser.
- Android (Chrome): menu ⋮ > **Add to Home screen** (or **Install app**).
- iPhone (Safari): Share > **Add to Home Screen**.

## 3. Switch on accounts (Supabase, about 10 minutes)

1. Create a free project at supabase.com. Pick a region close to you (for India, Mumbai).
2. In the project, open **SQL Editor > New query**, paste all of `supabase/schema.sql`, and press **Run**.
3. Open **Authentication > URL Configuration**. Set **Site URL** to your app address from step 1,
   and add the same address under **Redirect URLs**.
4. Open **Project Settings > API** and copy the **Project URL** and the **anon public** key.
   (The anon key is meant to be public. Row level security is what keeps each person's data private.)
5. In GitHub, open the repository's **Settings > Secrets and variables > Actions > Variables** and add:
   - `SUPABASE_URL` = the Project URL
   - `SUPABASE_ANON_KEY` = the anon public key
6. Run the deploy again (**Actions > Deploy to GitHub Pages > Run workflow**). The welcome screen now offers
   "Create an account".

## Running it on a computer (optional)

```
npm install
npm run dev
```
Then open http://localhost:3000. Put the two Supabase values in a file called `.env.local` as
`NEXT_PUBLIC_SUPABASE_URL=...` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=...` to use accounts locally.

## How your data is protected

- Every table has row level security: a signed-in person can only read and change their own rows,
  and nobody who is signed out can read anything. This is checked by the database itself.
- A row can never change owner, and a thought can only join its owner's own threads.
- Editing a finished thought keeps the earlier wording as a version.
- Discarded thoughts and threads are removed for good after 30 days.
- The app lock PIN is never stored, only a slow salted hash of it, on the phone.
- Time capsules (stage 3) will be encrypted on the phone with a key only you hold.

## Optional: film posters from TMDB

Out of the box, film posters come from Wikipedia, book covers from Open Library and music covers from MusicBrainz. Nothing to set up.

To use TMDB for films instead: make a free account at themoviedb.org, open Settings > API and copy the "API Key". In GitHub, open the repository's Settings > Secrets and variables > Actions > Variables, add a variable named `TMDB_KEY` with that key, then run the deploy again (Actions > Deploy to GitHub Pages > Run workflow). The key ends up inside the public app; TMDB read keys only allow looking things up.

## Updating the database for stage 2

If you already ran `supabase/schema.sql` before, run the whole file again. It only adds what is new (interests, collections, Inbox links) and keeps your data.
