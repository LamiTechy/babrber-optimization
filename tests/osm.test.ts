import { describe, expect, it } from "vitest";
import { addressFromTags, elementToCandidate } from "@/lib/osm/importShops";
import type { OverpassElement } from "@/lib/osm/overpass";

function element(partial: Partial<OverpassElement>): OverpassElement {
  return { type: "node", id: 1, ...partial };
}

describe("elementToCandidate", () => {
  it("reads Overpass's `lon` field on nodes", () => {
    const candidate = elementToCandidate(
      element({
        id: 123,
        lat: 7.1475,
        lon: 3.3619,
        tags: { name: "Classic Blades", "shop": "hairdresser", "opening_hours": "Mo-Fr 09:00-18:00" },
      }),
    );

    expect(candidate).toMatchObject({
      osmType: "node",
      osmId: "123",
      name: "Classic Blades",
      lat: 7.1475,
      lng: 3.3619,
      openingHours: "Mo-Fr 09:00-18:00",
    });
  });

  it("reads `center.lon` on ways and relations", () => {
    const way = elementToCandidate(
      element({
        type: "way",
        id: 42,
        center: { lat: 7.15, lon: 3.35 },
        tags: { name: "Corner Cuts" },
      }),
    );
    expect(way).toMatchObject({ osmType: "way", lat: 7.15, lng: 3.35 });

    const relation = elementToCandidate(
      element({ type: "relation", id: 7, center: { lat: 7.16, lon: 3.36 }, tags: {} }),
    );
    expect(relation).toMatchObject({ name: "Unnamed salon" });
  });

  it("returns null when the element has no coordinates", () => {
    expect(elementToCandidate(element({ tags: { name: "No coords" } }))).toBeNull();
    expect(elementToCandidate(element({ lat: 7.15, tags: {} }))).toBeNull();
  });

  it("normalises Nigerian phone numbers into phone and WhatsApp", () => {
    const spaced = elementToCandidate(
      element({ lat: 7.15, lon: 3.35, tags: { phone: "+234 803 123 4567" } }),
    );
    expect(spaced).toMatchObject({ phone: "+2348031234567", whatsapp: "2348031234567" });

    const local = elementToCandidate(
      element({ lat: 7.15, lon: 3.35, tags: { "contact:phone": "0803 123 4567" } }),
    );
    expect(local).toMatchObject({ phone: "08031234567", whatsapp: "2348031234567" });

    const junk = elementToCandidate(element({ lat: 7.15, lon: 3.35, tags: { phone: "ask inside" } }));
    expect(junk).toMatchObject({ phone: null, whatsapp: null });
  });
});

describe("addressFromTags", () => {
  it("joins the available addr:* parts in order", () => {
    expect(
      addressFromTags({
        "addr:housenumber": "13",
        "addr:street": "Bamgbose Street",
        "addr:city": "Abeokuta",
      }),
    ).toBe("13, Bamgbose Street, Abeokuta");
  });

  it("returns null without any address tags", () => {
    expect(addressFromTags({})).toBeNull();
    expect(addressFromTags(undefined)).toBeNull();
  });
});
