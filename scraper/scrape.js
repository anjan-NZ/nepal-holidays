const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const BASE_URL = "https://english.hamropatro.com/calendar";
const OUTPUT_PATH = path.join(__dirname, "..", "holidays.json");
const DELAY_MS = 800;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Rough estimate, BS new year falls around April 13-14, good enough to pick a year to scrape.
function approxBsYear(date = new Date()) {
  const ad = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const newYearAlreadyPassed = month > 4 || (month === 4 && day >= 13);
  return newYearAlreadyPassed ? ad + 57 : ad + 56;
}

async function fetchMonth(year, month) {
  const url = `${BASE_URL}/${year}/${month}`;
  const res = await fetch(url, {
    headers: { "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

function extractHolidays(html) {
  const $ = cheerio.load(html);
  const holidays = [];

  $("li.holiday").each((_, el) => {
    const li = $(el);
    const usnId = li.find('span[id$="-usn"]').first().attr("id");
    if (!usnId) return;

    const match = usnId.match(/^(\d+)-(\d+)-(\d+)-usn$/);
    if (!match) return;
    const [, y, m, d] = match;
    const bsDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;

    const names = li
      .find(".eventPopupWrapper a")
      .map((_, a) => $(a).text().trim())
      .get()
      .filter(Boolean);

    for (const name of new Set(names)) {
      holidays.push({ bsDate, name });
    }
  });

  return holidays;
}

async function scrapeYear(year) {
  const all = [];
  for (let month = 1; month <= 12; month++) {
    const html = await fetchMonth(year, month);
    all.push(...extractHolidays(html));
    await sleep(DELAY_MS);
  }
  return all;
}

// Returns null if the year isn't published yet instead of throwing.
async function tryScrapeYear(year) {
  try {
    const holidays = await scrapeYear(year);
    return holidays.length > 0 ? holidays : null;
  } catch (err) {
    console.log(`  -> ${err.message}`);
    return null;
  }
}

function loadExisting() {
  if (!fs.existsSync(OUTPUT_PATH)) return { version: 1, holidays: [] };
  return JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
}

async function main() {
  const explicitYear = process.argv[2] ? Number(process.argv[2]) : null;
  const candidateYears = explicitYear ? [explicitYear] : [approxBsYear(), approxBsYear() + 1];

  const existing = loadExisting();

  const fresh = [];
  const scrapedYears = [];
  for (const year of candidateYears) {
    console.log(`Trying ${year} BS...`);
    const holidays = await tryScrapeYear(year);
    if (holidays) {
      console.log(`  -> ${holidays.length} entries`);
      fresh.push(...holidays);
      scrapedYears.push(year);
    } else {
      console.log(`  -> not available yet, leaving existing data (if any) untouched`);
    }
  }

  // Nothing came back at all, most likely the site is blocking us. Fail loudly instead of
  // quietly committing nothing, so the Actions run goes red and someone notices.
  if (scrapedYears.length === 0) {
    console.error("No year could be scraped, not touching holidays.json");
    process.exit(1);
  }

  // Only replace years we actually got fresh data for.
  const untouched = existing.holidays.filter(
    (h) => !scrapedYears.includes(Number(h.bsDate.split("-")[0])),
  );

  const combined = [...untouched, ...fresh];
  const deduped = Array.from(
    new Map(combined.map((h) => [`${h.bsDate}|${h.name}`, h])).values(),
  ).sort((a, b) => a.bsDate.localeCompare(b.bsDate));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ version: 1, holidays: deduped }, null, 2) + "\n");
  console.log(`Wrote ${deduped.length} total holidays to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
