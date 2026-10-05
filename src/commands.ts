import { EVENTS, nextOccurrences } from "./schedule";
import { countdown, DISPLAY_TZ_LABEL, phTime } from "./discord";

export interface Env {
  DB: D1Database;
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
}

const MANAGE_GUILD = "32";
const EPHEMERAL = 64;
const OPT = { SUB_COMMAND: 1, INTEGER: 4, BOOLEAN: 5, CHANNEL: 7, ROLE: 8 } as const;
const GUILD_TEXT = 0, GUILD_ANNOUNCEMENT = 5;

/** Slash command definitions, uploaded by scripts/register.ts. */
export const COMMANDS = [
  {
    name: "timers",
    description: "Show upcoming AION 2 (JP server) event timers",
  },
  {
    name: "alerts",
    description: "Configure event alerts for this server",
    default_member_permissions: MANAGE_GUILD,
    contexts: [0], // guild only
    options: [
      {
        type: OPT.SUB_COMMAND,
        name: "setup",
        description: "Post alerts in a channel before events start",
        options: [
          {
            type: OPT.CHANNEL,
            name: "channel",
            description: "Channel to post alerts in",
            required: true,
            channel_types: [GUILD_TEXT, GUILD_ANNOUNCEMENT],
          },
          {
            type: OPT.INTEGER,
            name: "lead",
            description: "Minutes before the event to alert (default 10)",
            min_value: 0,
            max_value: 120,
          },
          { type: OPT.ROLE, name: "role", description: "Role to ping" },
          {
            type: OPT.BOOLEAN,
            name: "include_frequent",
            description: "Also alert for frequent events (Festival, Invasion, Watcher Kaira, Arena). Default off.",
          },
        ],
      },
      { type: OPT.SUB_COMMAND, name: "off", description: "Stop posting alerts" },
      { type: OPT.SUB_COMMAND, name: "status", description: "Show the current alert settings" },
    ],
  },
];

interface Option {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: Option[];
}

export interface Interaction {
  type: number;
  guild_id?: string;
  data?: { name: string; options?: Option[] };
}

type Response = { type: 4; data: { content?: string; embeds?: unknown[]; flags?: number } };

const reply = (content: string, ephemeral = true): Response => ({
  type: 4,
  data: { content, flags: ephemeral ? EPHEMERAL : undefined },
});

export async function handleCommand(interaction: Interaction, env: Env): Promise<Response> {
  switch (interaction.data?.name) {
    case "timers":
      return timers();
    case "alerts":
      return alerts(interaction, env);
    default:
      return reply("Unknown command.");
  }
}

function timers(now = Date.now()): Response {
  const lines = nextOccurrences(now).map(({ event, start, end }) =>
    start <= now && end > now
      ? `${event.emoji} **${event.name}** — 🟢 open now, until ${phTime(end)} · ${countdown(end)}`
      : `${event.emoji} **${event.name}** — ${phTime(start, now)} · ${countdown(start)}`,
  );
  return {
    type: 4,
    data: {
      embeds: [
        {
          title: "AION 2 (JP server) — Upcoming Events",
          description: lines.join("\n"),
          color: 0x7b5cff,
          footer: { text: `All times in ${DISPLAY_TZ_LABEL} (UTC+8)` },
        },
      ],
    },
  };
}

async function alerts(interaction: Interaction, env: Env): Promise<Response> {
  const guildId = interaction.guild_id;
  if (!guildId) return reply("This command only works in a server.");
  const sub = interaction.data?.options?.[0];
  const opt = (name: string) => sub?.options?.find((o) => o.name === name)?.value;

  switch (sub?.name) {
    case "setup": {
      const channelId = String(opt("channel"));
      const lead = Number(opt("lead") ?? 10);
      const roleId = opt("role") ? String(opt("role")) : null;
      const includeFrequent = opt("include_frequent") === true ? 1 : 0;
      await env.DB.prepare(
        `INSERT INTO guild_config (guild_id, channel_id, role_id, lead_min, include_frequent)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(guild_id) DO UPDATE SET
           channel_id = ?2, role_id = ?3, lead_min = ?4, include_frequent = ?5`,
      )
        .bind(guildId, channelId, roleId, lead, includeFrequent)
        .run();
      const events = EVENTS.filter((e) => includeFrequent || !e.optIn).map((e) => e.name);
      return reply(
        `✅ Alerts will post in <#${channelId}> **${lead} min** before each event` +
          (roleId ? `, pinging <@&${roleId}>` : "") +
          `.\nEvents: ${events.join(", ")}\n` +
          `Make sure I can **View Channel** and **Send Messages** there.`,
      );
    }
    case "off": {
      await env.DB.prepare("DELETE FROM guild_config WHERE guild_id = ?1").bind(guildId).run();
      return reply("🔕 Alerts disabled for this server.");
    }
    case "status": {
      const row = await env.DB.prepare("SELECT * FROM guild_config WHERE guild_id = ?1")
        .bind(guildId)
        .first<GuildConfig>();
      if (!row) return reply("Alerts are off. Use `/alerts setup` to enable them.");
      return reply(
        `Alerts post in <#${row.channel_id}> ${row.lead_min} min before events` +
          (row.role_id ? `, pinging <@&${row.role_id}>` : "") +
          `. Frequent events: ${row.include_frequent ? "on" : "off"}.`,
      );
    }
    default:
      return reply("Unknown subcommand.");
  }
}

export interface GuildConfig {
  guild_id: string;
  channel_id: string;
  role_id: string | null;
  lead_min: number;
  include_frequent: number;
}
