# ATS Job Board Finder

Find which applicant tracking system a company hires on and list its open roles live.

**Use it:** https://wordhalm.github.io/ats-job-board-finder/

- 25,787 companies indexed: 7,363 on Greenhouse, 2,377 on Lever, 4,171 on Ashby, 11,876 on SmartRecruiters.
- Paste a company name, a board slug or a job board URL (`jobs.lever.co/…`, `jobs.ashbyhq.com/…`, `job-boards.greenhouse.io/…`, `careers.smartrecruiters.com/…`).
- Open roles are read from each ATS's public job board API, directly from your browser. The page has no backend and sets no cookies.
- Each company has a shareable URL, for example `https://wordhalm.github.io/ats-job-board-finder/#/greenhouse/stripe`.

## Download the index

[`data/ats-index.json`](data/ats-index.json) (about 1 MB). Each entry is `[platform, company name, board slug]`:

| Code | Platform | Public jobs endpoint |
| --- | --- | --- |
| `g` | Greenhouse | `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs` |
| `l` | Lever | `https://api.lever.co/v0/postings/{slug}?mode=json` |
| `a` | Ashby | `https://api.ashbyhq.com/posting-api/job-board/{slug}` |
| `s` | SmartRecruiters | `https://api.smartrecruiters.com/v1/companies/{slug}/postings` |

## Many companies, every day

This page reads one board at a time. To pull roles from hundreds of boards in one run and keep only those opened since the previous run, use [Career Site Jobs Search](https://apify.com/clearstack-data/career-site-jobs-search) on Apify. Ready-made n8n workflows (daily hiring signals to Slack, and others) are in [clearstack-data-automation-templates](https://github.com/Wordhalm/clearstack-data-automation-templates).

## Run locally

Any static file server works:

```
python -m http.server 8000
```

## Credits and license

- Company index from [kalil0321/ats-scrapers](https://github.com/kalil0321/ats-scrapers), © 2026 Kalil Bouzigues, MIT License. See [DATA-LICENSE-kalil0321-ats-scrapers.txt](DATA-LICENSE-kalil0321-ats-scrapers.txt).
- Site code: MIT License, see [LICENSE](LICENSE).
- Not affiliated with Greenhouse, Lever, Ashby or SmartRecruiters. Job data belongs to the companies that publish it.
