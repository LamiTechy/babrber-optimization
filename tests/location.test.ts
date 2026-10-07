import { describe, expect, it } from "vitest";
import {
  isGoogleMapsLink,
  isShortMapsLink,
  matchLandmark,
  normalizeText,
  parseCoordinates,
  parseMapsLink,
  similarity,
} from "@/lib/location/parse";
import { resolveInput, resolveLocation } from "@/lib/location/resolve";

const landmarks = [
  { name: "Ojere Market", aliases: ["Ojere market", "Ojere"], lat: 7.1501, lng: 3.3502 },
  { name: "Sagamu Road Junction", aliases: ["Sagamu junction"], lat: 7.1402, lng: 3.3701 },
  { name: "Baptist Medical Centre", aliases: ["BMC", "Ogun State Hospital"], lat: 7.1355, lng: 3.3555 },
];

describe("parseCoordinates", () => {
  it("reads a plain coordinate pair", () => {
    expect(parseCoordinates("7.1475, 3.3619")).toEqual({ lat: 7.1475, lng: 3.3619 });
  });

  it("tolerates a reversed pair", () => {
    expect(parseCoordinates("3.3619, 7.1475")).toEqual({ lat: 7.1475, lng: 3.3619 });
  });

  it("ignores addresses", () => {
    expect(parseCoordinates("Ojere market, Abeokuta")).toBeNull();
    expect(parseCoordinates("12,34")).toBeNull();
  });

  it("rejects out-of-range values", () => {
    expect(parseCoordinates("91.5, 3.3")).toBeNull();
    expect(parseCoordinates("7.1, 200.5")).toBeNull();
  });
});

describe("parseMapsLink", () => {
  it("reads the @lat,lng form", () => {
    const url =
      "https://www.google.com/maps/place/Sharp+Cuts+Salon/@7.1475,3.3619,17z/data=!4m5!3m4!1s0x1034e2:0xabc!8m2!3d7.15!4d3.36";
    expect(parseMapsLink(url)).toEqual({ lat: 7.1475, lng: 3.3619 });
  });

  it("reads the !3d!4d place id form", () => {
    const url =
      "https://www.google.com/maps/place/Barber/@7.1/data=!4m5!3m4!1s0x0!2s!8m2!3d7.1501!4d3.3502";
    expect(parseMapsLink(url)).toEqual({ lat: 7.1501, lng: 3.3502 });
  });

  it("reads ?q= and ?ll= forms", () => {
    expect(parseMapsLink("https://www.google.com/maps?q=7.1475,3.3619")).toEqual({
      lat: 7.1475,
      lng: 3.3619,
    });
    expect(parseMapsLink("https://maps.google.com/?ll=7.1475,3.3619")).toEqual({
      lat: 7.1475,
      lng: 3.3619,
    });
  });

  it("reads a search query without coordinates as nothing", () => {
    expect(parseMapsLink("https://www.google.com/maps/place/Ojere+Abeokuta")).toBeNull();
  });
});

describe("link detection", () => {
  it("recognises full Google Maps links", () => {
    expect(isGoogleMapsLink("https://www.google.com/maps/place/Ojere")).toBe(true);
    expect(isGoogleMapsLink("https://maps.google.com/?ll=7.1,3.3")).toBe(true);
  });

  it("recognises short links", () => {
    expect(isShortMapsLink("https://maps.app.goo.gl/AbCdEf")).toBe(true);
    expect(isShortMapsLink("https://goo.gl/maps/abc")).toBe(true);
    expect(isShortMapsLink("https://example.com/maps")).toBe(false);
  });

  it("ignores non-Google URLs", () => {
    expect(isGoogleMapsLink("https://evil.com/maps")).toBe(false);
    expect(isGoogleMapsLink("not a url")).toBe(false);
  });
});

describe("landmark matching", () => {
  it("normalises text", () => {
    expect(normalizeText("  Ojere  Market!! ")).toBe("ojere market");
    expect(normalizeText("Ógèrè")).toBe("ogere");
  });

  it("scores similar names", () => {
    expect(similarity("Ojere Market", "ojere market")).toBe(1);
    expect(similarity("Ojere Market", "Ojere")).toBeGreaterThan(0.5);
    expect(similarity("Ojere Market", "Ikoyi")).toBeLessThan(0.3);
  });

  it("matches exact names and aliases, case-insensitively", () => {
    expect(matchLandmark("ojere market", landmarks)).toEqual({ lat: 7.1501, lng: 3.3502 });
    expect(matchLandmark("SAGAMU JUNCTION", landmarks)).toEqual({ lat: 7.1402, lng: 3.3701 });
    expect(matchLandmark("BMC", landmarks)).toEqual({ lat: 7.1355, lng: 3.3555 });
  });

  it("matches partial text", () => {
    expect(matchLandmark("near Ojere market gate", landmarks)).toEqual({
      lat: 7.1501,
      lng: 3.3502,
    });
  });

  it("returns null for unknown places", () => {
    expect(matchLandmark("Somewhere in London", landmarks)).toBeNull();
    expect(matchLandmark("", landmarks)).toBeNull();
  });
});

describe("resolveInput", () => {
  it("resolves raw coordinates", () => {
    const result = resolveInput("7.1475, 3.3619", landmarks);
    expect(result).toEqual({ ok: true, lat: 7.1475, lng: 3.3619, source: "coords" });
  });

  it("resolves a Google Maps link", () => {
    const result = resolveInput("https://www.google.com/maps?q=7.1475,3.3619", landmarks);
    expect(result).toMatchObject({ ok: true, source: "maps-link" });
  });

  it("resolves a landmark name", () => {
    const result = resolveInput("Ojere Market", landmarks);
    expect(result).toEqual({ ok: true, lat: 7.1501, lng: 3.3502, source: "landmark" });
  });

  it("returns a friendly error for unknown text", () => {
    const result = resolveInput("Bla bla blah", landmarks);
    expect(result).toMatchObject({ ok: false, code: "not-found" });
    if (!result.ok) expect(result.message).toContain("Pick a landmark below");
  });

  it("handles empty input", () => {
    expect(resolveInput("   ", landmarks)).toMatchObject({ ok: false, code: "empty" });
  });
});

describe("resolveLocation", () => {
  it("resolves coordinates without touching the network", async () => {
    await expect(resolveLocation("7.1475, 3.3619", landmarks)).resolves.toMatchObject({
      ok: true,
      source: "coords",
    });
  });

  it("does not fetch short links in the pure parser path", async () => {
    // Short links need the network; the offline path must fail gracefully.
    // The resolver's own fetch timeout is 5s — wait past it so we observe the
    // graceful failure instead of racing the test runner's default timeout.
    const result = await resolveLocation("https://maps.app.goo.gl/AbCdEf", landmarks);
    expect(result.ok).toBe(false);
  }, 10_000);
});
