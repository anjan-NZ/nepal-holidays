# nepal-holidays

Nepal public holiday data, keyed by Bikram Sambat date. Consumed by [NePad](https://github.com/anjan-NZ/nepad) and free for anyone else to use.

## Format

`holidays.json`:

```json
{
  "version": 1,
  "holidays": [
    { "bsDate": "2082-01-01", "name": "Nepali New Year" }
  ]
}
```

- `bsDate` is `YYYY-MM-DD` in the Bikram Sambat calendar, 1-based month.
- `version` bumps whenever the schema changes.

## Source

Scraped from [hamropatro.com](https://www.hamropatro.com/en/calendar). Only events that site marks as holidays are included, not every observance. It is not the government's official holiday list: MoHA publishes that as a PDF every year, and no structured source for it exists.

Verify exact dates yourself for anything that actually matters (compliance deadlines, bank holidays).

## Scraping

```
npm install
npm run scrape
```

By default, scrapes the current BS year plus the next one and merges the result into `holidays.json`, leaving other years untouched. No yearly maintenance needed: once hamropatro publishes next year's calendar, the next scheduled run picks it up on its own. Pass one or more years as arguments (`npm run scrape -- 2085`) to (re)scrape just those. A year that can't be fetched is kept as it was, never dropped.

A GitHub Actions workflow (`.github/workflows/scrape.yml`) runs this monthly and commits any changes automatically.
