import { describe, expect, it } from "vitest";
import { phTime } from "../src/discord";
import { EVENTS, nextOccurrences, occurrencesBetween } from "../src/schedule";

// Server time is JP (UTC+9); display is PH (UTC+8). 2026-10-05 is a Monday.
const at = (iso: string) => Date.parse(iso);
const ev = (id: string) => EVENTS.find((e) => e.id === id)!;
const next = (id: string, now: number) =>
  new Date(nextOccurrences(now).find((o) => o.event.id === id)!.start).toISOString();

describe("nextOccurrences", () => {
  it("finds the next rift and siege on the same server day", () => {
    const now = at("2026-10-05T11:59:00Z"); // Mon 20:59 JP
    expect(next("rift", now)).toBe("2026-10-05T14:00:00.000Z"); // 23:00 JP
    expect(next("siege", now)).toBe("2026-10-05T12:00:00.000Z"); // 21:00 JP
    expect(next("executors", now)).toBe("2026-10-05T12:30:00.000Z"); // 21:30 JP
  });

  it("rolls over to the next server day", () => {
    const now = at("2026-10-05T14:30:00Z"); // Mon 23:30 JP
    expect(next("rift", now)).toBe("2026-10-05T17:00:00.000Z"); // Tue 02:00 JP
  });

  it("handles hourly events at :30 and the 3-hourly world boss", () => {
    expect(next("invasion", at("2026-10-05T12:10:00Z"))).toBe("2026-10-05T12:30:00.000Z");
    expect(next("watcher-kaira", at("2026-10-05T12:31:00Z"))).toBe("2026-10-05T13:00:00.000Z"); // 22:00 JP
  });

  it("wraps weekly events to the following week", () => {
    // Weekly reset: Wed 03:00 JP = Tue 18:00 UTC
    expect(next("weekly-reset", at("2026-10-06T17:59:00Z"))).toBe("2026-10-06T18:00:00.000Z");
    expect(next("weekly-reset", at("2026-10-06T19:00:00Z"))).toBe("2026-10-13T18:00:00.000Z");
    expect(next("nahma", at("2026-10-05T10:00:00Z"))).toBe("2026-10-09T12:00:00.000Z"); // Fri 21:00 JP
  });

  it("returns an occurrence that is still open", () => {
    expect(next("rift", at("2026-10-05T14:05:00Z"))).toBe("2026-10-05T14:00:00.000Z");
    expect(next("rift", at("2026-10-05T14:10:00Z"))).toBe("2026-10-05T17:00:00.000Z");
  });
});

describe("occurrencesBetween", () => {
  it("yields 8 rifts, 8 Watcher Kairas and 24 festivals per day", () => {
    const from = at("2026-10-05T00:00:00Z");
    const to = from + 24 * 3_600_000;
    expect(occurrencesBetween(ev("rift"), from, to)).toHaveLength(8);
    expect(occurrencesBetween(ev("watcher-kaira"), from, to)).toHaveLength(8);
    expect(occurrencesBetween(ev("festival"), from, to)).toHaveLength(24);
  });

  it("excludes the end of the window", () => {
    const start = at("2026-10-05T14:00:00Z");
    expect(occurrencesBetween(ev("rift"), start, start + 60_000)).toHaveLength(1);
    expect(occurrencesBetween(ev("rift"), start - 60_000, start)).toHaveLength(0);
  });
});

describe("phTime", () => {
  const now = at("2026-10-05T10:00:00Z"); // Mon 18:00 PHT

  it("shows JP 21:00 as 20:00 PHT", () => {
    expect(phTime(at("2026-10-05T12:00:00Z"))).toBe("20:00 PHT");
  });

  it("labels the day relative to now in PH time", () => {
    expect(phTime(at("2026-10-05T12:00:00Z"), now)).toBe("Today 20:00 PHT");
    expect(phTime(at("2026-10-05T18:00:00Z"), now)).toBe("Tomorrow 02:00 PHT"); // daily reset
    expect(phTime(at("2026-10-09T12:00:00Z"), now)).toBe("Fri 20:00 PHT"); // Nahma
  });
});
