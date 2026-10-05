import { verifyKey } from "discord-interactions";
import { handleCommand, type Env, type GuildConfig, type Interaction } from "./commands";
import { countdown, phTime, postMessage } from "./discord";
import { EVENTS, occurrencesBetween, type Occurrence } from "./schedule";

const PING = 1;
const APPLICATION_COMMAND = 2;
const MIN = 60_000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") return new Response("AION 2 timer bot is running.");

    const body = await request.text();
    const signature = request.headers.get("X-Signature-Ed25519") ?? "";
    const timestamp = request.headers.get("X-Signature-Timestamp") ?? "";
    if (!(await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY))) {
      return new Response("Bad request signature", { status: 401 });
    }

    const interaction = JSON.parse(body) as Interaction;
    if (interaction.type === PING) return Response.json({ type: 1 });
    if (interaction.type === APPLICATION_COMMAND) {
      return Response.json(await handleCommand(interaction, env));
    }
    return new Response("Unhandled interaction type", { status: 400 });
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(sendAlerts(controller.scheduledTime, env));
  },
};

/** Post alerts for every event whose (start - guild lead time) falls in this minute. */
export async function sendAlerts(scheduledTime: number, env: Env): Promise<void> {
  const minute = Math.floor(scheduledTime / MIN) * MIN;
  const { results } = await env.DB.prepare("SELECT * FROM guild_config").all<GuildConfig>();

  const posts = results.flatMap((cfg) => {
    const from = minute + cfg.lead_min * MIN;
    const due = EVENTS.filter((e) => cfg.include_frequent || !e.optIn).flatMap((e) =>
      occurrencesBetween(e, from, from + MIN),
    );
    if (due.length === 0) return [];
    return [
      postMessage(env.DISCORD_TOKEN, cfg.channel_id, {
        content: alertText(due, cfg.role_id),
        allowed_mentions: { roles: cfg.role_id ? [cfg.role_id] : [] },
      }),
    ];
  });

  for (const r of await Promise.allSettled(posts)) {
    if (r.status === "rejected") console.error(r.reason);
  }
}

function alertText(due: Occurrence[], roleId: string | null): string {
  const lines = due.map(
    ({ event, start }) => `${event.emoji} **${event.name}** — ${phTime(start)} · ${countdown(start)}`,
  );
  return (roleId ? `<@&${roleId}>\n` : "") + lines.join("\n");
}
