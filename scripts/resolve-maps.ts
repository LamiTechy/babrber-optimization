import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { haversineKm } from "../lib/geo";
import { parseMapsLink } from "../lib/location/parse";
import { DIRECTORY_SHOPS, MAPOLY_QUERY, TREM_LINK } from "./data/directory";

/**
 * One-off: resolve Google Maps `cid` links to coordinates using installed
 * Chrome (Google renders these pages with JS, so plain fetch cannot read them).
 *
 * Output: scripts/data/resolved-coords.json + a distance table for review.
 */

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const COORDS_RE = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
const POLL_MS = 400;
const TIMEOUT_MS = 30_000;

export type ResolvedPoint = { lat: number; lng: number; url: string };

type ResolvedFile = {
  resolvedAt: string;
  trem: ResolvedPoint | null;
  mapoly: ResolvedPoint | null;
  shops: { name: string; cid: string; lat: number | null; lng: number | null }[];
};

async function chromePath(): Promise<string> {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await import("node:fs").then((fs) => fs.promises.access(candidate));
      return candidate;
    } catch {
      /* try next */
    }
  }
  throw new Error("No Chrome/Edge installation found for headless resolution.");
}

async function acceptConsent(page: Page): Promise<void> {
  if (!page.url().includes("consent.google.com")) return;
  const clicked = await page
    .evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const agree =
        buttons.find((b) => /agree|accept all/i.test(b.textContent ?? "")) ??
        (document.querySelector("#intro_agreebutton, #intro_agreeButton") as
          | HTMLButtonElement
          | null);
      agree?.click();
      return Boolean(agree);
    })
    .catch(() => false);
  if (clicked) await new Promise((r) => setTimeout(r, 1500));
}

/** Open a Google Maps URL and wait for JS to settle on a place URL with coords. */
async function resolveUrl(browser: Browser, url: string): Promise<ResolvedPoint | null> {
  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    );
    await page.setExtraHTTPHeaders({ "accept-language": "en-NG,en;q=0.9" });
    await page.setCookie({ name: "SOCS", value: "CAI", domain: ".google.com", path: "/" });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    await acceptConsent(page);

    const deadline = Date.now() + TIMEOUT_MS;
    let last = page.url();
    while (Date.now() < deadline) {
      last = page.url();
      const inUrl = parseMapsLink(last);
      if (inUrl && COORDS_RE.test(last)) return { ...inUrl, url: last };

      const inDom = await page
        .evaluate(() => {
          const html = document.documentElement.innerHTML;
          const match = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(html);
          if (match) return { lat: Number(match[1]), lng: Number(match[2]) };
          const place = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(html);
          if (place) return { lat: Number(place[1]), lng: Number(place[2]) };
          return null;
        })
        .catch(() => null);
      if (inDom && COORDS_RE.test(`${inDom.lat},${inDom.lng}`)) {
        return { lat: inDom.lat, lng: inDom.lng, url: last };
      }

      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    const fallback = parseMapsLink(last);
    return fallback ? { ...fallback, url: last } : null;
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function resolveSearch(browser: Browser, query: string): Promise<ResolvedPoint | null> {
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
  return resolveUrl(browser, url);
}

async function main() {
  const executablePath = await chromePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--disable-gpu", "--no-sandbox", "--lang=en-NG"],
  });

  const trem = await resolveUrl(browser, TREM_LINK);
  console.log(`TREM Ojere: ${trem ? `${trem.lat}, ${trem.lng}` : "FAILED"}`);

  const shops: ResolvedFile["shops"] = [];
  for (const shop of DIRECTORY_SHOPS) {
    const point = await resolveUrl(browser, `https://maps.google.com/?cid=${shop.cid}`);
    if (point) {
      shops.push({ name: shop.name, cid: shop.cid, lat: point.lat, lng: point.lng });
      const km = trem ? haversineKm(trem, point) : null;
      const delta = km !== null ? km - shop.expectedKm : null;
      console.log(
        `OK   ${shop.name.padEnd(30)} ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}  ` +
          `km=${km !== null ? km.toFixed(2) : "?"} (expected ${shop.expectedKm})` +
          (delta !== null && Math.abs(delta) > 0.6 ? `  <-- OFF by ${delta.toFixed(2)} km` : ""),
      );
    } else {
      shops.push({ name: shop.name, cid: shop.cid, lat: null, lng: null });
      console.log(`FAIL ${shop.name.padEnd(30)} cid=${shop.cid}`);
    }
  }

  const mapoly = await resolveSearch(browser, MAPOLY_QUERY);
  console.log(`MAPOLY: ${mapoly ? `${mapoly.lat}, ${mapoly.lng}` : "FAILED"}`);

  await browser.close();

  const file: ResolvedFile = {
    resolvedAt: new Date().toISOString(),
    trem,
    mapoly,
    shops,
  };
  const out = path.join(__dirname, "resolved-coords.json");
  await fs.writeFile(out, `${JSON.stringify(file, null, 2)}\n`, "utf8");

  const failed = shops.filter((s) => s.lat === null).length;
  console.log(`\nWrote ${out} — ${shops.length - failed}/${shops.length} shops resolved.`);
  if (failed) console.log("Failed shops need a manual link paste from the address bar.");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
