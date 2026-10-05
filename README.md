# AION 2 Timer Bot

A free Discord bot with event timers and alerts for **AION 2** (Global, Japan server). All times are shown in **Philippine time (PHT, UTC+8)**.

It runs entirely on the [Cloudflare Workers](https://workers.cloudflare.com/) free tier, so there's no server to keep running and nothing to pay for.

## Features

- **`/timers`** shows the next occurrence of every tracked event, e.g. `Today 20:00 PHT`, or `🟢 open now` while an event is running.
- **`/alerts setup`** posts a message in a channel a set number of minutes before each event, and can ping a role.
- **`/alerts status`** / **`/alerts off`** show or disable this server's alert settings.

### `/alerts setup` options

| Option | Description |
|---|---|
| `channel` | Channel to post alerts in (required) |
| `lead` | Minutes before the event (0–120, default 10) |
| `role` | Role to ping (optional) |
| `include_frequent` | Also alert for frequent events (Shugo Festival, Dimensional Invasion, Watcher Kaira, Arena of Tactics). Off by default. |

`/alerts` requires the **Manage Server** permission.

## Schedule (PHT)

| Event | When |
|---|---|
| 🌀 Spacetime Rift | Daily 01, 04, 07, 10, 13, 16, 19, 22:00 |
| 👁️ Watcher Kaira | Daily 00, 03, 06, 09, 12, 15, 18, 21:00 |
| 🎪 Shugo Festival | Every hour at :00 |
| ⚔️ Dimensional Invasion | Every hour at :30 |
| 🏟️ Arena of Tactics | Daily 10:00, 18:00 |
| 🏰 Artifact Siege | Mon, Thu, Sat 20:00 |
| 👹 Executors (Tamasa · Argo · Kaira) | Mon, Thu, Sat 20:30 |
| 🐉 Guardian Lord Nahma + Enraged Nahma | Fri, Sun 20:00 |
| 🔄 Daily Reset | Daily 02:00 |
| 📅 Weekly Reset | Wed 02:00 |

Times come from the [gamers4.life event timer](https://gamers4.life/aion-2/database/en/events/) (Japan region). They're defined in Japan server time (UTC+9) in [`src/schedule.ts`](src/schedule.ts); edit that file to fix or add events.

## How it works

- **Slash commands:** Discord POSTs each interaction to the Worker (its *Interactions Endpoint URL*). The Worker verifies Discord's Ed25519 signature and replies directly, so it needs no gateway connection or discord.js.
- **Alerts:** a Cron Trigger runs every minute and checks each server's settings, stored in [Cloudflare D1](https://developers.cloudflare.com/d1/). For any event starting `lead` minutes from now, it posts through Discord's REST API.
- **Cost:** the Workers free plan allows 100k requests per day. The cron uses about 1,440 of them.

## Self-hosting

You need [Node.js](https://nodejs.org/) 20+, a Discord account and a free Cloudflare account (no card required).

1. **Discord app:** in the [Developer Portal](https://discord.com/developers/applications), create a **New Application**. Note the *Application ID* and *Public Key* (General Information) and the *Bot Token* (Bot → Reset Token).
2. **Install:** `npm install`, then `npx wrangler login`.
3. **Database:** run `npx wrangler d1 create aion-timers`, put the printed `database_id` in `wrangler.toml`, then run `npm run db:init`.
4. **Config:** set `DISCORD_APPLICATION_ID` under `[vars]` in `wrangler.toml`.
5. **Secrets:** run `npx wrangler secret put DISCORD_TOKEN` and `npx wrangler secret put DISCORD_PUBLIC_KEY`. Run them in a normal terminal; each one prompts for the value.
6. **Deploy:** `npm run deploy`. Paste the printed `https://….workers.dev/` URL into Developer Portal → General Information → **Interactions Endpoint URL** and save.
7. **Register commands:** copy `.dev.vars.example` to `.dev.vars`, fill it in, then run `npm run register`.
8. **Invite:** go to OAuth2 → URL Generator, select scopes `bot` + `applications.commands` and permissions *View Channels* + *Send Messages*, then open the URL.

Then, in your server: `/alerts setup channel:#timers lead:10 role:@Raiders`

> Never commit `.dev.vars`; it's git-ignored because it holds your bot token.

## Development

```sh
npm test               # unit tests (vitest)
npm run typecheck
npm run db:init:local  # create the local D1 table
npm run dev            # local Worker
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"   # trigger the alert cron locally
npx wrangler tail      # stream production logs
```

After changing the command definitions in `src/commands.ts`, run `npm run register` once the new code is deployed.

### Auto-deploy

Every push to `main` runs the typecheck and tests, then deploys to Cloudflare ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). Pushes that only change Markdown files are skipped. Forks need two repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`: shown by `npx wrangler whoami`.
- `CLOUDFLARE_API_TOKEN`: Cloudflare dashboard → My Profile → API Tokens → **Create Token** → template *Edit Cloudflare Workers*.
