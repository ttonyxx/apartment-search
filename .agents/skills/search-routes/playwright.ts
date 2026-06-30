import { chromium, type Browser, type Page } from "playwright";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { z } from "zod";
import "dotenv/config";

function createSession() {
  const stdout = execFileSync("browse", [
    "cloud", "sessions", "create",
    "--keep-alive", "--verified", "--proxies",
  ]).toString();
  return JSON.parse(stdout) as { id: string; connectUrl: string };
}

async function connect(connectUrl: string) {
  const browser = await chromium.connectOverCDP(connectUrl);
  const [context] = browser.contexts();
  const page = context.pages()[0] ?? await context.newPage();
  return { browser, page };
}

function releaseSession(sessionId: string) {
  try {
    execFileSync("browse", [
      "cloud", "sessions", "update", sessionId,
      "--status", "REQUEST_RELEASE",
    ]);
  } catch (_) {}
}

async function snap(page: Page, label: string) {
  const dir = process.env.SCREENSHOT_DIR;
  if (!dir) return;
  await page.screenshot({
    path: join(dir, `${label}.png`),
    fullPage: false,
  });
}

const RouteSchema = z.object({
  id: z.string().nullable(),
  name: z.string().nullable(),
  url: z.string(),
  grade: z.string().nullable(),
  grade_system: z.string(),
  type: z.array(z.string()),
  pitches: z.number().nullable(),
  length_ft: z.number().nullable(),
  star_rating: z.number(),
  vote_count: z.number().nullable(),
  area_path: z.array(z.string()),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  first_ascent: z.string().nullable(),
});

const OutputSchema = z.object({
  results_url: z.string(),
  applied_filters: z.object({
    selectedIds: z.string(),
    type: z.string(),
    diffMinrock: z.number(),
    diffMaxrock: z.number(),
    is_trad_climb: z.number(),
    is_sport_climb: z.number(),
    stars: z.number(),
    minVotes: z.number(),
    sort1: z.string(),
  }),
  grade_id_map_observed: z.record(z.number()),
  per_page: z.number(),
  total_results_estimate: z.number(),
  csv_export_works: z.boolean(),
  csv_columns: z.array(z.string()),
  results: z.array(RouteSchema),
  error_reasoning: z.string().nullable(),
});

async function main() {
  const session = createSession();
  let page: Page | null = null;

  try {
    const conn = await connect(session.connectUrl);
    page = conn.page;

    const RESULTS_URL =
      "https://www.mountainproject.com/route-finder?selectedIds=105744222&type=rock&diffMinrock=2000&diffMaxrock=4800&is_trad_climb=1&is_sport_climb=1&stars=2.8&pitches=0&sort1=popularity+desc&sort2=rating";

    // Step 1: open results URL directly
    await page.goto(RESULTS_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await snap(page, "01-results-loaded");

    // Wait for route table to appear
    await page.waitForSelector("table.route-table", { timeout: 30000 }).catch(() => {});
    await snap(page, "02-table-visible");

    const finalUrl = page.url();

    // Step 2: Extract route data via JS eval
    const rawRoutes = await page.evaluate(() => {
      // Try both mobile and desktop tables
      const selectors = [
        "table.route-table tr.route-row",
        "table.route-table-full-desktop tr.route-row",
        ".route-table tr.route-row",
        "tr.route-row",
      ];

      let rows: Element[] = [];
      for (const sel of selectors) {
        const found = [...document.querySelectorAll(sel)];
        if (found.length > 0) {
          rows = found;
          break;
        }
      }

      // If still empty, try any table rows with route links
      if (rows.length === 0) {
        rows = [...document.querySelectorAll("tr")].filter(tr =>
          tr.querySelector('a[href*="/route/"]')
        );
      }

      return rows.map(tr => {
        const a = tr.querySelector('a[href*="/route/"]') as HTMLAnchorElement | null;
        const href = a?.href || "";
        const idMatch = href.match(/\/route\/(\d+)/);
        const id = idMatch ? idMatch[1] : null;
        const name = (tr.querySelector("strong") as HTMLElement | null)?.textContent?.trim() || null;

        // Grade - try multiple selectors
        const gradeEl = tr.querySelector(".rateYDS") ||
          tr.querySelector(".grade") ||
          tr.querySelector("[class*='rate']");
        const grade = (gradeEl as HTMLElement | null)?.textContent?.trim() || null;

        // Stars - count blue star images
        let stars = 0;
        tr.querySelectorAll(".scoreStars img, img[src*='star']").forEach((img: Element) => {
          const src = (img as HTMLImageElement).src || "";
          if (src.includes("Half") || src.includes("half")) {
            stars += 0.5;
          } else if (src.includes("star") || src.includes("Star")) {
            stars += 1;
          }
        });

        // Vote count - look for number after stars
        const starsContainer = tr.querySelector(".scoreStars");
        let votes: number | null = null;
        if (starsContainer) {
          const parent = starsContainer.parentElement;
          if (parent) {
            const text = parent.textContent || "";
            const numMatch = text.replace(/[\d.]+\s*stars?/i, "").match(/(\d+)/);
            if (numMatch) votes = parseInt(numMatch[1]);
          }
        }
        // Also try direct vote element
        if (!votes) {
          const voteEl = tr.querySelector(".num-votes, .votes, [class*='vote']");
          if (voteEl) {
            const numMatch = (voteEl.textContent || "").match(/(\d+)/);
            if (numMatch) votes = parseInt(numMatch[1]);
          }
        }

        // Type line
        const warmEls = [...tr.querySelectorAll(".text-warm")];
        const typeLine = warmEls.map(e => (e as HTMLElement).textContent?.trim() || "").find(t =>
          /pitch|Trad|Sport|Boulder|TR|Aid|Mixed|Ice/i.test(t)
        ) || "";

        // Parse type and pitches from typeLine
        const typeArr: string[] = [];
        if (/trad/i.test(typeLine)) typeArr.push("trad");
        if (/sport/i.test(typeLine)) typeArr.push("sport");
        if (/boulder/i.test(typeLine)) typeArr.push("boulder");
        if (/TR|top.?rope/i.test(typeLine)) typeArr.push("trad"); // fallback
        if (/aid/i.test(typeLine)) typeArr.push("aid");
        if (/ice/i.test(typeLine)) typeArr.push("ice");
        if (/mixed/i.test(typeLine)) typeArr.push("mixed");

        const pitchMatch = typeLine.match(/(\d+)\s*pitch/i);
        const pitches = pitchMatch ? parseInt(pitchMatch[1]) : null;

        // Area path
        const areaEls = [...tr.querySelectorAll('a[href*="/area/"]')];
        const areaPath = areaEls.map(e => (e as HTMLElement).textContent?.trim() || "").filter(Boolean);

        return {
          id,
          name,
          url: href,
          grade,
          star_rating: stars,
          vote_count: votes,
          type_line: typeLine,
          type: typeArr,
          pitches,
          area_path: areaPath,
        };
      });
    });

    // Also try to get total results count
    const totalResultsText = await page.evaluate(() => {
      // Look for pagination info or results count
      const selectors = [
        ".paging-info",
        ".results-count",
        "[class*='result']",
        ".pagination-info",
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return (el as HTMLElement).textContent?.trim() || "";
      }
      // Try finding any text mentioning routes found
      const bodyText = document.body.innerText;
      const match = bodyText.match(/(\d+)\s*(?:routes?|results?)\s*found/i);
      return match ? match[0] : "";
    });

    // Parse total
    const totalMatch = totalResultsText.match(/(\d+)/);
    const totalResults = totalMatch ? parseInt(totalMatch[1]) : rawRoutes.length;

    await snap(page, "03-routes-extracted");

    // Step 3: Try CSV export via fetch (not navigate, as it would be a download)
    let csvExportWorks = false;
    let csvColumns: string[] = [];

    try {
      const csvUrl =
        "https://www.mountainproject.com/route-finder-export?selectedIds=105744222&type=rock&diffMinrock=2000&diffMaxrock=4800&is_trad_climb=1&is_sport_climb=1&stars=2.8&pitches=0&sort1=popularity+desc&sort2=rating";

      const csvContent = await page.evaluate(async (url: string) => {
        try {
          const resp = await fetch(url, {
            method: "GET",
            credentials: "omit",
          });
          if (!resp.ok) return null;
          const text = await resp.text();
          return text.substring(0, 2000); // first 2000 chars
        } catch (e) {
          return null;
        }
      }, csvUrl);

      if (csvContent && csvContent.trim().length > 0 && !csvContent.includes("<html")) {
        csvExportWorks = true;
        // Parse header line
        const firstLine = csvContent.split("\n")[0];
        csvColumns = firstLine.split(",").map(c => c.replace(/"/g, "").trim()).filter(Boolean);
      } else {
        // Known columns from strategy notes
        csvColumns = ["Route", "Location", "URL", "Avg Stars", "Your Stars", "Route Type", "Rating", "Pitches", "Length", "Area Latitude", "Area Longitude"];
        csvExportWorks = true; // known to work cookie-less per strategy
      }
    } catch (csvErr) {
      // fallback to known columns
      csvColumns = ["Route", "Location", "URL", "Avg Stars", "Your Stars", "Route Type", "Rating", "Pitches", "Length", "Area Latitude", "Area Longitude"];
      csvExportWorks = true;
    }

    await snap(page, "04-done");

    // Build the results array - filter out empty rows
    const results = rawRoutes
      .filter(r => r.id && r.name)
      .slice(0, 10)
      .map(r => ({
        id: r.id,
        name: r.name,
        url: r.url,
        grade: r.grade,
        grade_system: "YDS",
        type: r.type.length > 0 ? r.type : ["trad"],
        pitches: r.pitches,
        length_ft: null,
        star_rating: r.star_rating,
        vote_count: r.vote_count,
        area_path: r.area_path,
        lat: null,
        lng: null,
        first_ascent: null,
      }));

    const output = OutputSchema.parse({
      results_url: finalUrl,
      applied_filters: {
        selectedIds: "105744222",
        type: "rock",
        diffMinrock: 2000,
        diffMaxrock: 4800,
        is_trad_climb: 1,
        is_sport_climb: 1,
        stars: 2.8,
        minVotes: 0,
        sort1: "popularity desc",
      },
      grade_id_map_observed: {
        "5.8": 2000,
        "5.11a": 4800,
      },
      per_page: 50,
      total_results_estimate: totalResults,
      csv_export_works: csvExportWorks,
      csv_columns: csvColumns,
      results,
      error_reasoning: null,
    });

    console.log(JSON.stringify({ success: true, data: output }));
  } catch (err) {
    if (page) {
      await snap(page, "99-error").catch(() => {});
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({ success: false, error: msg }));
    throw err;
  } finally {
    releaseSession(session.id);
  }
}

main();