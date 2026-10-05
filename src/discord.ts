const API = "https://discord.com/api/v10";

export interface MessageBody {
  content?: string;
  embeds?: unknown[];
  allowed_mentions?: { parse?: string[]; roles?: string[] };
}

export async function postMessage(token: string, channelId: string, body: MessageBody): Promise<void> {
  const res = await fetch(`${API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`POST /channels/${channelId}/messages failed: ${res.status} ${await res.text()}`);
  }
}

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
/** All displayed times are Philippine time (UTC+8), as plain text. */
const DISPLAY_TZ_OFFSET_MIN = 8 * 60;
export const DISPLAY_TZ_LABEL = "PHT";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Format an instant as PH time, e.g. "20:00 PHT". When `now` is given, prefix the
 * day relative to it: "Today 20:00 PHT", "Tomorrow 03:00 PHT", "Fri 20:00 PHT".
 */
export function phTime(ms: number, now?: number): string {
  const off = DISPLAY_TZ_OFFSET_MIN * MIN;
  const local = new Date(ms + off);
  const hm = `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
  const clock = `${hm} ${DISPLAY_TZ_LABEL}`;
  if (now === undefined) return clock;
  const days = Math.floor((ms + off) / DAY) - Math.floor((now + off) / DAY);
  const day = days === 0 ? "Today" : days === 1 ? "Tomorrow" : WEEKDAYS[local.getUTCDay()];
  return `${day} ${clock}`;
}
