// AION 2 Global — Japan server event schedule, in server time (UTC+9).
//
// Source: gamers4.life/aion-2/database/en/events (Japan region), 2026-10-05.
// All Global regions share these server-clock times; only the offset differs.

/** Server clock offset from UTC, in minutes. Japan server = UTC+9. */
export const SERVER_TZ_OFFSET_MIN = 9 * 60;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** 0 = Sunday … 6 = Saturday, in server time. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const SUN = 0, MON = 1, WED = 3, THU = 4, FRI = 5, SAT = 6;

export type Rule =
  | { type: "daily"; times: string[] }
  | { type: "hourly"; minute: number }
  | { type: "weekly"; days: Weekday[]; times: string[] };

export interface GameEvent {
  id: string;
  name: string;
  emoji: string;
  /** How long the event stays open after it starts. 0 when unknown or instantaneous. */
  durationMin: number;
  rule: Rule;
  /** Frequent events: always listed in /timers, but only alerted when a guild opts in. */
  optIn?: boolean;
}

export const EVENTS: GameEvent[] = [
  {
    id: "rift",
    name: "Spacetime Rift",
    emoji: "🌀",
    durationMin: 10, // entrance window; the activity itself runs ~60 min
    rule: { type: "daily", times: ["02:00", "05:00", "08:00", "11:00", "14:00", "17:00", "20:00", "23:00"] },
  },
  {
    id: "festival",
    name: "Shugo Festival",
    emoji: "🎪",
    durationMin: 10,
    rule: { type: "hourly", minute: 0 },
    optIn: true,
  },
  {
    id: "invasion",
    name: "Dimensional Invasion",
    emoji: "⚔️",
    durationMin: 15,
    rule: { type: "hourly", minute: 30 },
    optIn: true,
  },
  {
    id: "watcher-kaira",
    name: "Watcher Kaira",
    emoji: "👁️",
    durationMin: 30,
    rule: { type: "daily", times: ["01:00", "04:00", "07:00", "10:00", "13:00", "16:00", "19:00", "22:00"] },
    optIn: true,
  },
  {
    id: "arena",
    name: "Arena of Tactics",
    emoji: "🏟️",
    durationMin: 0,
    rule: { type: "daily", times: ["11:00", "19:00"] },
    optIn: true,
  },
  {
    id: "siege",
    name: "Artifact Siege",
    emoji: "🏰",
    durationMin: 30,
    rule: { type: "weekly", days: [MON, THU, SAT], times: ["21:00"] },
  },
  {
    id: "executors",
    name: "Executors (Tamasa · Argo · Kaira)",
    emoji: "👹",
    durationMin: 30,
    rule: { type: "weekly", days: [MON, THU, SAT], times: ["21:30"] },
  },
  {
    id: "nahma",
    name: "Guardian Lord Nahma + Enraged Nahma",
    emoji: "🐉",
    durationMin: 30,
    rule: { type: "weekly", days: [FRI, SUN], times: ["21:00"] },
  },
  {
    id: "daily-reset",
    name: "Daily Reset",
    emoji: "🔄",
    durationMin: 0,
    rule: { type: "daily", times: ["03:00"] },
  },
  {
    id: "weekly-reset",
    name: "Weekly Reset",
    emoji: "📅",
    durationMin: 0,
    rule: { type: "weekly", days: [WED], times: ["03:00"] },
  },
];

export interface Occurrence {
  event: GameEvent;
  /** Start time, epoch ms (UTC). */
  start: number;
  end: number;
}

function parseHM(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * HOUR + m * MIN;
}

/** Offsets from server-local midnight at which the event starts on the given weekday. */
function startsOnDay(rule: Rule, weekday: number): number[] {
  switch (rule.type) {
    case "daily":
      return rule.times.map(parseHM);
    case "hourly":
      return Array.from({ length: 24 }, (_, h) => h * HOUR + rule.minute * MIN);
    case "weekly":
      return rule.days.includes(weekday as Weekday) ? rule.times.map(parseHM) : [];
  }
}

/** All occurrences of an event with start in [from, to). */
export function occurrencesBetween(event: GameEvent, from: number, to: number): Occurrence[] {
  const off = SERVER_TZ_OFFSET_MIN * MIN;
  const firstDay = Math.floor((from + off) / DAY);
  const lastDay = Math.floor((to + off) / DAY);
  const out: Occurrence[] = [];
  for (let day = firstDay; day <= lastDay; day++) {
    const weekday = (day + 4) % 7; // 1970-01-01 was a Thursday
    for (const t of startsOnDay(event.rule, weekday)) {
      const start = day * DAY + t - off;
      if (start >= from && start < to) {
        out.push({ event, start, end: start + event.durationMin * MIN });
      }
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * The current-or-next occurrence of each event: an occurrence that is still
 * running at `now` is returned in preference to the next one.
 */
export function nextOccurrences(now: number, events: GameEvent[] = EVENTS): Occurrence[] {
  return events
    .map((e) => {
      const from = now - e.durationMin * MIN;
      return occurrencesBetween(e, from, now + 8 * DAY).find((o) => o.end > now || o.start >= now);
    })
    .filter((o): o is Occurrence => o !== undefined)
    .sort((a, b) => a.start - b.start);
}
