# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Discord bot posting AION 2 event timers for the Global **Japan** server, displayed in **Philippine time**. Runs on Cloudflare Workers free tier — there is no gateway connection and no discord.js.

## Commands
- `npm test` — vitest; single test: `npx vitest run -t "rolls over"`
- `npm run typecheck`
- `npm run dev` — local worker with `--test-scheduled`; trigger the cron with `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"`
- `npm run db:init:local` / `npm run db:init` — apply `schema.sql` to local / remote D1
- `npm run register` — PUT slash command definitions to Discord (reads `.dev.vars`)
- `npx wrangler tail` — stream production logs

## Deployment
- Public GitHub repo `mrcprgt/aion2-timer-bot`; live at `https://aion2-timer-bot.aion2-timer-bot.workers.dev/` (GET returns a health string).
- **Pushing to `main` is a production deploy**: `.github/workflows/deploy.yml` runs typecheck + tests, then `wrangler deploy`. `*.md`-only pushes skip it. Uses repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. `npm run deploy` still works for manual deploys.
- Not automated, so do these by hand at the right moment:
  - **Schema changes**: run the `ALTER TABLE` on remote D1 (and update `schema.sql`) *before* pushing code that uses it — the live `guild_config` table holds real guild rows.
  - **Command changes** (`COMMANDS` in `src/commands.ts`): run `npm run register` *after* the deploy lands.
- Secrets `DISCORD_TOKEN`, `DISCORD_PUBLIC_KEY` live in Cloudflare (`wrangler secret put`, which reads the value from a prompt or stdin — not an argument); `DISCORD_APPLICATION_ID` is a `[vars]` entry in `wrangler.toml`. Locally they're in git-ignored `.dev.vars`. The repo is public: never commit tokens, and have the user enter secrets in their own terminal rather than in chat.

## Architecture
- **Interactions over HTTP**: Discord POSTs slash commands to the worker's `fetch` (`src/index.ts`), which verifies the Ed25519 signature and must reply synchronously within 3s. Command definitions and handlers live together in `src/commands.ts`.
- **Alerts via cron**: a `* * * * *` Cron Trigger calls `sendAlerts`, which, for each row in D1 `guild_config`, finds occurrences starting in `[minute + lead, minute + lead + 1min)` and posts via REST (`src/discord.ts`). Exactly-once relies on the cron firing once per minute — there's no dedup table.
- **Schedule** (`src/schedule.ts`): all event data is declarative (`EVENTS` with daily/hourly/weekly rules in *JP server time*, UTC+9 via `SERVER_TZ_OFFSET_MIN`). Source: gamers4.life/aion-2/database/en/events (Japan region). Everything is computed as UTC epoch ms. Events with `optIn: true` (Festival, Invasion, Watcher Kaira, Arena) are always listed in `/timers` but only alerted when a guild sets `include_frequent`.
- **Display** (`phTime` in `src/discord.ts`): all times are plain-text Philippine time (UTC+8, "PHT"), deliberately *not* Discord `<t:…>` timestamps (user's choice). Tests pin both offsets.
- The README's schedule table is written in PHT by hand — update it whenever `EVENTS` changes.

## Constraints
- Free plan: 50 subrequests per invocation caps alert posts at ~49 guilds per minute; 100k requests/day.
