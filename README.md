# CY-Thread

CY-Thread is a home for focused, welcoming communities. People gather around a shared interest, start conversations, and help one another grow. Community owners can shape a forum with its own categories, membership, and moderation rules.

## Product direction

The data model covers forums, categories, discussions, replies, memberships, roles, bans, reports, OAuth identities, sessions, bookmarks, and attachments. Threads and posts use soft deletion so authors and moderators can hide content without breaking reports or attachment history. The first product experience makes those ideas usable through:

- **Discover:** browse a welcoming community feed, search conversations, and filter by category.
- **Participate:** start a conversation, reply, follow a community, bookmark threads, and remove your own thread when needed.
- **Create:** create public communities with starter categories and an owner role, then switch among your communities.
- **Keep it healthy:** report threads, review reports, pin or lock threads, and ban members from the community.

The home page loads public threads and category counts from D1 when the selected forum exists, with paginated search and category/activity filters. The local-only seed file supplies preview conversations. Google sign-in, posting, replies, following, thread bookmarks, community creation, profile name edits, category management, and basic moderation use authenticated server flows.

## Platform choices

- **Database: Cloudflare D1 + Drizzle.** The app runs on Cloudflare Workers and is at an early stage, so D1 removes the external PostgreSQL service and its connection management. D1 is Cloudflare's managed SQL option, but it uses SQLite semantics; this schema uses integer keys, millisecond timestamps, and boolean mappings. Current documented size caps are 500 MB per database on Free and 10 GB on Workers Paid. The Free plan includes 5 million rows read and 100,000 rows written per day; since September 1, 2026, D1 returns query errors after those daily limits are reached until reset. Paid includes 25 billion rows read and 50 million rows written monthly, then charges by usage. Each primary database serializes its own queries; D1 read replicas can spread reads, but this app's current plain Drizzle binding does not opt into the D1 Sessions API required to route through them ([limits](https://developers.cloudflare.com/d1/platform/limits/), [pricing](https://developers.cloudflare.com/d1/platform/pricing/), [read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/)). Revisit when query-latency and row-read metrics justify it. If PostgreSQL features or a larger single database become necessary, [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) can pool Worker-to-Neon connections, but Neon remains the PostgreSQL host rather than becoming a Cloudflare-native database.
- **Files: Cloudflare R2.** Attachment metadata stays in D1 and image bytes go to R2. The editor accepts JPEG, PNG, GIF, and WebP images up to 5 MB and validates file signatures server-side. Published images are public; unattached uploads are visible only to their uploader while composing.
- **Framework: keep Nuxt + Vue for now.** Nuxt already targets [Cloudflare Workers](https://nuxt.com/deploy/cloudflare), and this project has a working Vue app, Toast UI editor, authentication and server routes. [SvelteKit's official Cloudflare adapter](https://svelte.dev/docs/kit/adapter-cloudflare) also supports Workers, bindings, local binding emulation and type generation; it is a viable alternative if the team prefers Svelte. The current Nuxt build's initial app chunk is roughly 134 kB before gzip; the rich editor is lazy-loaded and has a 361 kB largest chunk plus shared dependencies. A Svelte rewrite must replace the editor, auth and API integrations and then be benchmarked on identical routes and Worker bindings. There is no evidence yet that migrating would improve delivered performance enough to justify that rewrite.
- **Styling: Tailwind utilities and theme tokens plus class/ID selectors.** Shared palette, font families, focus rings, and page anchors use Tailwind. The component's class selectors keep the detailed responsive composition easy to tune.

The production build splits the rich editor and viewer from the initial page bundle. The most recent local build emitted an approximately 133 kB main page chunk; opening the composer or a thread loads editor/viewer chunks on demand. The largest lazy chunk is approximately 361 kB before gzip, with a 221 kB shared dependency chunk. Re-measure after editor or framework changes.

## Data model

The SQLite schema separates platform users/OAuth sessions from per-forum following and moderation. A forum owns categories and threads; a thread contains posts; reports track review decisions; R2 attachments point to a forum and optionally to a post. Composite keys prevent duplicate forum roles, follows, bans, and bookmarks. The feed, reply, and report lookups have dedicated indexes. Community member totals count the owner, moderators, followers, and people who have posted there, deduplicated by user ID.

## Cloudflare setup

Set `NUXT_PUBLIC_TURNSTILE_SITE_KEY` and `NUXT_TURNSTILE_SECRET_KEY` to enable Cloudflare Turnstile on thread, reply, report, and image-upload forms. The server verifies each one-use token before saving or storing an upload. Plain Nuxt development may omit these keys; the production Worker preview and deployment require the secret and site key.

The app uses D1 through the Worker `DB` binding and Drizzle. For one-off administrative SQL in place of a `psql` connection, use Wrangler's D1 command, for example `npx wrangler d1 execute community --remote --command "SELECT count(*) AS forums FROM forums"`. D1 uses SQLite SQL and does not expose a PostgreSQL wire endpoint; use Hyperdrive only if retaining a PostgreSQL host such as Neon is intentional.

1. Install dependencies and authenticate Wrangler: `npm install`, then `npx wrangler login`.
2. This Cloudflare account now has a `community` D1 database bound in `wrangler.toml`, and its five project migrations have been applied. The matching `community` R2 bucket already existed and is bound as `BLOB`. To provision an independent account, use `npm run db:create`, replace `database_id` with the ID Wrangler returns, and create the R2 bucket with `npx wrangler r2 bucket create community`.
3. Apply schema locally with `npm run db:migrate:local`; optionally load preview-only rows with `npm run db:seed:local`. Neon is a development database and its existing data is intentionally not imported.
4. Start the Worker with bindings using `npm run dev:worker` (this builds first). `npm run dev` runs the Nuxt development server without local Cloudflare bindings.
5. For local Google sign-in, create an ignored `.dev.vars` file with `NUXT_SESSION_PASSWORD` (at least 32 random characters), `NUXT_OAUTH_GOOGLE_CLIENT_ID`, and `NUXT_OAUTH_GOOGLE_CLIENT_SECRET`. Add the Turnstile keys there too when testing writes in `wrangler dev`. Register `http://localhost:8787/api/auth/google` as the Google OAuth redirect URI when using the default Wrangler port.
6. Before deploying, apply migrations with `npm run db:migrate:remote`, then set `NUXT_SESSION_PASSWORD`, `NUXT_OAUTH_GOOGLE_CLIENT_ID`, `NUXT_OAUTH_GOOGLE_CLIENT_SECRET`, and `NUXT_TURNSTILE_SECRET_KEY` with `npx wrangler secret put <NAME>`. Configure `NUXT_PUBLIC_TURNSTILE_SITE_KEY` as a Worker variable, then deploy with `npx wrangler deploy`. Set the OAuth redirect URI to `https://<your-worker-domain>/api/auth/google` in Google Cloud Console.

## Data protection

D1 Time Travel is enabled automatically. It can restore to a point within 7 days on Workers Free or 30 days on Workers Paid; restore replaces the live database, so follow Cloudflare's confirmation and recovery guidance carefully ([Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)). For an independent SQL export before a risky migration, run `npm run db:backup:remote`. This writes `community-backup.sql`, which Git ignores because it contains database records. Store the export encrypted outside the checkout and periodically verify that it can be restored into a separate empty D1 database. A D1 export contains SQL data only; R2 image objects need a separate backup/copy plan. The backup command has not been run against production in this task.

The session is stored in Nuxt Auth Utils' sealed, HTTP-only cookie. D1 stores user profiles and Google provider IDs; OAuth access tokens are not persisted. The browser can read the current session profile but cannot change its identity. The editor stores Markdown; the server also stores escaped HTML fallback content. Community creation, profile name editing, category creation/editing, author/moderator thread deletion, reports, thread moderation, basic bans, and moderator cleanup for R2 uploads older than 24 hours are implemented. Private/follower-only visibility policies remain follow-up work.

The app's shared visual system lives in `app/assets/css/main.css`; the homepage is under `app/pages/index.vue`. Dedicated pages are available at `/login`, `/forums/<slug>/threads`, `/forums/<slug>/threads/<id>`, `/forums/<slug>/admin`, `/forums/<slug>/admin/categories`, `/forums/<slug>/admin/users`, and `/forums/<slug>/reports`. Members can create, edit, and soft-delete threads and posts, reply in a two-level comment tree, and report threads or individual posts. Search supports title/body text, categories, pinned/locked filters, sorting, and pagination. Moderator tools include thread pin/lock/hide, member lookup and bans, report review, category settings, moderator appointments, current totals, active-member counts, open-report counts, and a 30-day activity chart. Only owners can appoint admins; owners and admins can appoint/remove moderators, enforced by server routes as well as the interface.

Wrangler commands use the existing `npx wrangler login` OAuth session; a separate Cloudflare API token is not needed for remote D1 migrations, exports, or deployment. The Drizzle Kit `d1-http` driver is the exception: operations that directly access remote D1 through Drizzle Kit require `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, and `CLOUDFLARE_D1_TOKEN`. Routine schema generation and the documented Wrangler migration workflow do not use that token. Keep any token in local environment or a secret manager, never in source control.

The old Neon connection URL was stored in the tracked Wrangler configuration. It has been removed, but deleting it from the current version does not remove it from Git history. Rotate that database password before reusing Neon or Hyperdrive, and consider purging the old secret from repository history before making the repository public. The provisioned D1 is schema-only by choice; no historical data import is needed. Existing Worker secrets still need Google OAuth client credentials and Turnstile keys before the production app can support sign-in and posting.

## Development

```sh
npm install
npm run dev
```

Build the Cloudflare deployment bundle with `npm run build`.

## License

AGPL-3.0-or-later
