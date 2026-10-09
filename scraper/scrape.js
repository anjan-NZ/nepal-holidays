const fs = require("fs");
const path = require("path");

const BASE_URL = "https://www.hamropatro.com/en/calendar";
const OUTPUT_PATH = path.join(__dirname, "..", "holidays.json");
const DELAY_MS = 800;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

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
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

// The page ships its calendar data as JSON inside self.__next_f.push([1,"..."]) script calls.
function pagePayload(html) {
  const parts = [];
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  let m;
  while ((m = re.exec(html))) parts.push(JSON.parse(m[1]));
  return parts.join("");
}

// Returns the JSON object literal starting at `start`, or null if the braces never balance.
function objectAt(text, start) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function extractHolidays(html, year, month) {
  const text = pagePayload(html);
  const holidays = [];
  const seenDays = new Set();
  let at = text.indexOf('{"year_ad":');
  while (at !== -1) {
    const literal = objectAt(text, at);
    let day = null;
    try {
      day = literal && JSON.parse(literal);
    } catch {
      day = null;
    }
    if (day && day.inMonth && day.year_bs === year && day.month_bs === month) {
      const bsDate = `${year}-${String(month).padStart(2, "0")}-${String(day.day_bs).padStart(2, "0")}`;
      if (!seenDays.has(bsDate)) {
        seenDays.add(bsDate);
        const items = (day.patroEvent && day.patroEvent.items) || [];
        const names = items.filter((it) => it.isHoliday && it.titleEn).map((it) => it.titleEn.trim());
        for (const name of new Set(names)) holidays.push({ bsDate, name });
      }
    }
    at = text.indexOf('{"year_ad":', at + 1);
  }
  return { holidays, days: seenDays.size };
}

async function scrapeYear(year) {
  const all = [];
  for (let month = 1; month <= 12; month++) {
    const html = await fetchMonth(year, month);
    const { holidays, days } = extractHolidays(html, year, month);
    if (days === 0) throw new Error(`${year}/${month}: no calendar days found, page layout may have changed`);
    all.push(...holidays);
    await sleep(DELAY_MS);
  }
  return all;
}

// Returns null if the year can't be scraped instead of throwing.
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

const yearOf = (h) => Number(h.bsDate.split("-")[0]);

async function main() {
  const explicitYears = process.argv.slice(2).map(Number).filter(Boolean);
  const candidateYears = explicitYears.length ? explicitYears : [approxBsYear(), approxBsYear() + 1];

  const existing = loadExisting();
  const scraped = new Map();
  for (const year of candidateYears) {
    console.log(`Trying ${year} BS...`);
    const holidays = await tryScrapeYear(year);
    if (holidays) {
      console.log(`  -> ${holidays.length} entries`);
      scraped.set(year, holidays);
    } else {
      console.log(`  -> not available, keeping existing ${year} data (if any)`);
    }
  }

  // Only years that were actually scraped are replaced; everything else is kept as it was.
  const kept = existing.holidays.filter((h) => !scraped.has(yearOf(h)));
  const combined = [...kept, ...[...scraped.values()].flat()];
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
