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

Scraped from [english.hamropatro.com](https://english.hamropatro.com). Not the government's official holiday list, just what that site marks as notable days (festivals, tithi-based events, etc). MoHA publishes the real list as a PDF every year, no structured source for that exists.

Verify exact dates yourself for anything that actually matters (compliance deadlines, bank holidays).

## Scraping

```
npm install
npm run scrape
```

By default, scrapes the current BS year plus the next one and merges the result into `holidays.json`, leaving other years untouched. No yearly maintenance needed: once hamropatro publishes next year's calendar, the next scheduled run picks it up on its own. Pass a specific year as an argument (`npm run scrape -- 2085`) to (re)scrape just that one.

A GitHub Actions workflow (`.github/workflows/scrape.yml`) runs this monthly and commits any changes automatically.
