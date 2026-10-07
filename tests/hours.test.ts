import { describe, expect, it } from "vitest";
import {
  computeManualStatus,
  computeOsmStatus,
  computeShopStatus,
  fromEvaluationInstant,
  isParsableOsmHours,
  osmWeekHours,
  parseHm,
  statusRank,
  toEvaluationInstant,
  wallClock,
  type WeekHours,
} from "@/lib/hours";

/** Build an instant from a wall-clock time in Africa/Lagos (UTC+1). */
function lagos(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - 3_600_000);
}

/** Same hours every day of the week. */
function everyDay(ranges: { open: string; close: string }[]): WeekHours {
  return Array.from({ length: 7 }, () => ranges.map((r) => ({ ...r })));
}

function closedDays(): WeekHours {
  return [[], [], [], [], [], [], []];
}

describe("wall clock", () => {
  it("reads Lagos time regardless of the machine timezone", () => {
    // 06:30 UTC = 07:30 in Lagos.
    expect(wallClock(new Date("2026-10-05T06:30:00Z"))).toMatchObject({
      hour: 7,
      minute: 30,
      dayOfWeek: 1,
    });
    // 20:00 UTC = 21:00 in Lagos.
    expect(wallClock(new Date("2026-10-05T20:00:00Z"))).toMatchObject({
      hour: 21,
      dayOfWeek: 1,
    });
  });
});

describe("parseHm", () => {
  it("parses 24-hour times", () => {
    expect(parseHm("08:00")).toBe(480);
    expect(parseHm("8:30")).toBe(510);
    expect(parseHm("21:00")).toBe(1260);
  });

  it("rejects junk", () => {
    expect(parseHm("25:00")).toBeNaN();
    expect(parseHm("8h30")).toBeNaN();
    expect(parseHm("")).toBeNaN();
  });
});

describe("manual hours", () => {
  const standard = everyDay([{ open: "08:00", close: "21:00" }]);

  it("shows open with the closing time", () => {
    const status = computeManualStatus(standard, lagos(2026, 10, 5, 14, 0));
    expect(status.state).toBe("open");
    expect(status.isOpen).toBe(true);
    expect(status.label).toBe("Open now · Closes 9:00 PM");
    expect(status.nextChange).toBe(lagos(2026, 10, 5, 21, 0).toISOString());
  });

  it("is closed before opening, and says when it opens", () => {
    const status = computeManualStatus(standard, lagos(2026, 10, 5, 6, 0));
    expect(status.state).toBe("closed");
    expect(status.label).toBe("Closed · Opens today 8:00 AM");
  });

  it("flags the last half hour as closing soon", () => {
    const status = computeManualStatus(standard, lagos(2026, 10, 5, 20, 40));
    expect(status.state).toBe("soon");
    expect(status.isOpen).toBe(true);
    expect(status.label).toBe("Closing soon · Closes in 20 min");
  });

  it("handles split shifts", () => {
    const split: WeekHours = everyDay([
      { open: "08:00", close: "13:00" },
      { open: "15:00", close: "21:00" },
    ]);

    const duringBreak = computeManualStatus(split, lagos(2026, 10, 5, 14, 0));
    expect(duringBreak.state).toBe("closed");
    expect(duringBreak.label).toBe("Closed · Opens today 3:00 PM");

    const firstShift = computeManualStatus(split, lagos(2026, 10, 5, 10, 0));
    expect(firstShift.state).toBe("open");
    expect(firstShift.label).toBe("Open now · Closes 1:00 PM");

    const secondShift = computeManualStatus(split, lagos(2026, 10, 5, 16, 0));
    expect(secondShift.state).toBe("open");
    expect(secondShift.label).toBe("Open now · Closes 9:00 PM");
  });

  it("handles closing after midnight", () => {
    const late: WeekHours = everyDay([{ open: "10:00", close: "01:00" }]);

    const justPastMidnight = computeManualStatus(late, lagos(2026, 10, 5, 0, 30));
    expect(justPastMidnight.state).toBe("open");
    expect(justPastMidnight.label).toBe("Open now · Closes 1:00 AM");
    expect(justPastMidnight.nextChange).toBe(lagos(2026, 10, 5, 1, 0).toISOString());

    const afterClose = computeManualStatus(late, lagos(2026, 10, 5, 2, 0));
    expect(afterClose.state).toBe("closed");
    expect(afterClose.label).toBe("Closed · Opens today 10:00 AM");

    // The shift that opened *yesterday* is still running at 00:30.
    const yesterdaySpill = computeManualStatus(late, lagos(2026, 10, 6, 0, 15));
    expect(yesterdaySpill.state).toBe("open");
  });

  it("closes on days with no rows", () => {
    const monToSat: WeekHours = Array.from({ length: 7 }, (_, index) =>
      index === 0 ? [] : [{ open: "08:00", close: "21:00" }],
    );

    const sunday = computeManualStatus(monToSat, lagos(2026, 10, 4, 12, 0));
    expect(sunday.state).toBe("closed");
    expect(sunday.label).toBe("Closed · Opens tomorrow 8:00 AM");

    const monday = computeManualStatus(monToSat, lagos(2026, 10, 5, 12, 0));
    expect(monday.state).toBe("open");
  });

  it("names the weekday when the next opening is further out", () => {
    const sundayOnly = Array.from({ length: 7 }, (_, index) =>
      index === 0 ? [{ open: "12:00", close: "18:00" }] : [],
    );
    const status = computeManualStatus(sundayOnly, lagos(2026, 10, 5, 9, 0));
    expect(status.label).toBe("Closed · Opens Sun 12:00 PM");
  });

  it("never guesses when hours are unknown", () => {
    const status = computeManualStatus(closedDays(), lagos(2026, 10, 5, 12, 0));
    expect(status.state).toBe("unknown");
    expect(status.label).toBe("Hours not listed · Call to confirm");
    expect(status.nextChange).toBeNull();
    expect(statusRank(status)).toBe(2);
  });
});

describe("OSM opening_hours strings", () => {
  it("parses common tags", () => {
    expect(isParsableOsmHours("Mo-Sa 08:00-21:00")).toBe(true);
    expect(isParsableOsmHours("Mo-Fr 08:00-13:00,15:00-21:00")).toBe(true);
    expect(isParsableOsmHours("24/7")).toBe(true);
    expect(isParsableOsmHours("off")).toBe(true);
  });

  it("rejects garbage", () => {
    expect(isParsableOsmHours("")).toBe(false);
    expect(isParsableOsmHours("open when the sun shines")).toBe(false);
  });

  it("evaluates open and closed in Lagos time", () => {
    // Tuesday 10:00 Lagos → open (Mo-Sa 08:00-21:00).
    const open = computeOsmStatus("Mo-Sa 08:00-21:00", lagos(2026, 10, 6, 10, 0));
    expect(open?.state).toBe("open");
    expect(open?.label).toBe("Open now · Closes 9:00 PM");

    // Sunday is excluded → closed until Monday.
    const closed = computeOsmStatus("Mo-Sa 08:00-21:00", lagos(2026, 10, 4, 10, 0));
    expect(closed?.state).toBe("closed");
    expect(closed?.label).toBe("Closed · Opens tomorrow 8:00 AM");
  });

  it("handles split shifts in OSM tags", () => {
    const status = computeOsmStatus("Mo-Fr 08:00-13:00,15:00-21:00", lagos(2026, 10, 5, 14, 0));
    expect(status?.state).toBe("closed");
    expect(status?.label).toBe("Closed · Opens today 3:00 PM");
  });

  it("flags closing soon from an OSM tag", () => {
    const status = computeOsmStatus("Mo-Sa 08:00-21:00", lagos(2026, 10, 6, 20, 45));
    expect(status?.state).toBe("soon");
    expect(status?.label).toBe("Closing soon · Closes in 15 min");
  });

  it("builds a weekly table for the hours display", () => {
    const week = osmWeekHours("Mo-Sa 08:00-21:00", lagos(2026, 10, 5, 12, 0));
    expect(week).not.toBeNull();
    expect(week?.[1]).toEqual([{ open: "08:00", close: "21:00" }]); // Monday
    expect(week?.[0]).toEqual([]); // Sunday closed
    expect(week?.[6]).toEqual([{ open: "08:00", close: "21:00" }]); // Saturday
  });

  it("keeps after-midnight OSM shifts attached to their day", () => {
    const week = osmWeekHours("Mo-Sa 10:00-01:00", lagos(2026, 10, 5, 12, 0));
    expect(week?.[1]).toEqual([{ open: "10:00", close: "01:00" }]);
  });

  it("marks 24/7 as open all week", () => {
    const week = osmWeekHours("24/7", lagos(2026, 10, 5, 12, 0));
    for (const day of week ?? []) {
      expect(day).toEqual([{ open: "00:00", close: "00:00" }]);
    }
  });
});

describe("evaluation instant translation", () => {
  it("round-trips to the original instant", () => {
    const now = lagos(2026, 10, 5, 14, 27);
    expect(fromEvaluationInstant(toEvaluationInstant(now)).getTime()).toBe(now.getTime());
  });

  it("shifts into Lagos wall clock for the library", () => {
    const now = lagos(2026, 10, 5, 14, 0);
    const shifted = toEvaluationInstant(now);
    const wall = wallClock(shifted, Intl.DateTimeFormat().resolvedOptions().timeZone);
    const target = wallClock(now, "Africa/Lagos");
    expect(wall.hour).toBe(target.hour);
    expect(wall.minute).toBe(target.minute);
    expect(wall.day).toBe(target.day);
  });
});

describe("computeShopStatus", () => {
  const now = lagos(2026, 10, 5, 14, 0);

  it("prefers manual hours over the OSM tag", () => {
    const status = computeShopStatus(
      {
        hoursSource: "manual",
        days: everyDay([{ open: "09:00", close: "18:00" }]),
        osmOpeningHours: "Mo-Sa 08:00-21:00",
      },
      now,
    );
    expect(status.label).toBe("Open now · Closes 6:00 PM");
  });

  it("shows the raw OSM tag when it cannot be parsed", () => {
    const status = computeShopStatus(
      { hoursSource: "osm", osmOpeningHours: "sunrise to sunset-ish" },
      now,
    );
    expect(status.state).toBe("unknown");
    expect(status.label).toBe("sunrise to sunset-ish");
    expect(statusRank(status)).toBe(2);
  });

  it("says hours are not listed when there are none", () => {
    const status = computeShopStatus({ hoursSource: "unknown" }, now);
    expect(status.state).toBe("unknown");
    expect(status.label).toBe("Hours not listed · Call to confirm");
  });

  it("honours an active temporary override", () => {
    const closed = computeShopStatus(
      {
        hoursSource: "manual",
        days: everyDay([{ open: "08:00", close: "21:00" }]),
        override: { status: "closed", until: lagos(2026, 10, 5, 23, 0) },
      },
      now,
    );
    expect(closed.state).toBe("closed");
    expect(closed.label).toContain("owner set");

    const openLate = computeShopStatus(
      {
        hoursSource: "manual",
        days: closedDays(),
        override: { status: "open", until: lagos(2026, 10, 5, 23, 0) },
      },
      now,
    );
    expect(openLate.state).toBe("open");
    expect(openLate.isOpen).toBe(true);
  });

  it("ignores an override that has expired", () => {
    const status = computeShopStatus(
      {
        hoursSource: "manual",
        days: everyDay([{ open: "08:00", close: "21:00" }]),
        override: { status: "closed", until: lagos(2026, 10, 5, 12, 0) },
      },
      now,
    );
    expect(status.state).toBe("open");
  });

  it("ranks open before closed before unknown", () => {
    expect(statusRank(computeManualStatus(everyDay([{ open: "08:00", close: "21:00" }]), now))).toBe(0);
    expect(statusRank(computeManualStatus(everyDay([{ open: "08:00", close: "09:00" }]), lagos(2026, 10, 5, 14, 0)))).toBe(1);
    expect(statusRank(computeShopStatus({ hoursSource: "unknown" }, now))).toBe(2);
  });
});
