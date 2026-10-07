import { describe, expect, it } from "vitest";
import {
  formatDistance,
  formatWalkingTime,
  haversineKm,
  haversineMeters,
  isWithinArea,
  isValidLat,
  isValidLng,
  walkingMinutes,
} from "@/lib/geo";
import { SERVICE_AREA } from "@/lib/config";

const OJERE = { lat: SERVICE_AREA.centerLat, lng: SERVICE_AREA.centerLng };

describe("haversine", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMeters(OJERE, OJERE)).toBe(0);
  });

  it("matches a known distance", () => {
    // Abeokuta (7.1475, 3.3619) to Lagos Island (6.4541, 3.3947) ≈ 77 km.
    const km = haversineKm({ lat: 7.1475, lng: 3.3619 }, { lat: 6.4541, lng: 3.3947 });
    expect(km).toBeGreaterThan(75);
    expect(km).toBeLessThan(80);
  });

  it("is symmetric", () => {
    const a = { lat: 7.15, lng: 3.36 };
    const b = { lat: 7.13, lng: 3.38 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
  });

  it("agrees with the rough 111 m per 0.001° rule", () => {
    const meters = haversineMeters({ lat: 7.1475, lng: 3.3619 }, { lat: 7.1485, lng: 3.3619 });
    expect(meters).toBeGreaterThan(105);
    expect(meters).toBeLessThan(117);
  });
});

describe("formatDistance", () => {
  it("uses metres below a kilometre", () => {
    expect(formatDistance(350)).toBe("350 m");
    expect(formatDistance(4)).toBe("4 m");
    expect(formatDistance(999)).toBe("999 m");
  });

  it("uses one decimal above a kilometre", () => {
    expect(formatDistance(1400)).toBe("1.4 km");
    expect(formatDistance(1000)).toBe("1.0 km");
    expect(formatDistance(10500)).toBe("11 km");
  });
});

describe("walking time", () => {
  it("assumes 5 km/h", () => {
    expect(walkingMinutes(5000)).toBe(60);
    expect(walkingMinutes(417)).toBe(5);
  });

  it("never shows zero minutes", () => {
    expect(walkingMinutes(1)).toBe(1);
  });

  it("formats a walk", () => {
    expect(formatWalkingTime(4000)).toBe("48 min walk");
  });
});

describe("boundary check", () => {
  it("accepts the centre", () => {
    expect(isWithinArea(OJERE, OJERE, 2.5)).toBe(true);
  });

  it("accepts a point just inside the radius", () => {
    const inside = { lat: SERVICE_AREA.centerLat + 0.01, lng: SERVICE_AREA.centerLng };
    expect(isWithinArea(inside, OJERE, 2.5)).toBe(true);
  });

  it("rejects a point outside the radius", () => {
    const outside = { lat: SERVICE_AREA.centerLat + 0.1, lng: SERVICE_AREA.centerLng };
    expect(isWithinArea(outside, OJERE, 2.5)).toBe(false);
  });

  it("boundary itself counts as inside", () => {
    // ~2.5 km north of the centre.
    const edge = { lat: SERVICE_AREA.centerLat + 0.0224, lng: SERVICE_AREA.centerLng };
    expect(isWithinArea(edge, OJERE, 2.5)).toBe(true);
  });
});

describe("coordinate validation", () => {
  it("accepts valid values", () => {
    expect(isValidLat(7.1475)).toBe(true);
    expect(isValidLng(3.3619)).toBe(true);
  });

  it("rejects junk", () => {
    expect(isValidLat(91)).toBe(false);
    expect(isValidLat(Number.NaN)).toBe(false);
    expect(isValidLng(-181)).toBe(false);
    expect(isValidLng("3.3")).toBe(false);
  });
});
