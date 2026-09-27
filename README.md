# BCI 2026 · SC Cut-off Monitor

A light-theme, English-only, static GitHub Pages site for RSSB Basic Computer Instructor Recruitment 2026. The category is fixed to SC. The dashboard starts empty and contains no demo or generated candidate records.

## Data storage: local browser + JSON file backup

This version does not use a cloud database. Scores are stored in the current browser's local storage and are not uploaded to GitHub Pages. To back up, transfer or combine candidate records, use **Export backup** and **Import data file**. The score form keeps SC preselected and locked, accepts up to two decimal places for each paper, and does not ask for department, recruitment area or score basis. Exports are JSON files containing only SC, paper marks and submission time—no names, application IDs, roll numbers, phone numbers or email addresses.

To start from the provided empty data file, use **Import data file** and select [`candidate-data-template.json`](candidate-data-template.json). It contains zero records. Exported records can be moved between browsers/devices manually. Each browser has its own dataset until records are transferred. Clearing browser site data may delete local entries, so export backups regularly.

> A local browser database is private to that browser. It does not make candidate records automatically appear on every visitor's dashboard. To share a combined sample, candidates must deliberately exchange/import exported JSON backups. Never import files containing identifying details.

## Vacancy data

The official SC vacancy summary is transcribed from the attached RSSB Advertisement 07/2026. The source PDF is included in this project.

| Department | Area | SC backlog | Current SC vacancies | SC total |
|---|---|---:|---:|---:|
| Secondary Education | Non-Scheduled | 694 | 185 | 879 |
| Secondary Education | Scheduled | 30 | 13 | 43 |
| Sanskrit Education | Non-Scheduled | 0 | 23 | 23 |
| Sanskrit Education | Scheduled | 0 | 0 | 0 |
| **Total Basic Computer Instructor** |  | **724** | **221** | **945** |

Sources: RSSB Advertisement 07/2026, vacancy tables on pages 1 and 5–8. The SC qualifying check shown in the app is 35% in each paper (40% minimum with a five-percentage-point relaxation for SC/ST), as described on page 24. Vacancy numbers can be revised by RSSB; verify the official notice before relying on them.

## Publish to GitHub Pages

1. Create a GitHub repository and upload the **contents** of this folder to the repository root.
2. In the repository, open **Settings → Pages** and select **GitHub Actions** as the build and deployment source.
3. Push to the `main` branch or run the **Deploy static site to GitHub Pages** workflow manually. GitHub displays the public URL when deployment completes.

No Supabase project, API key or repository secret is needed for local-file mode. The included workflow deploys the static site. A separate hosted backend would be needed only if you later want automatic cross-device sharing.

## Run locally

Serve this folder with any static web server. For example:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. The app uses browser local storage and supports JSON backup import/export. No external scripts or APIs are required.

## Interpretation and limitations

Candidate-entered scores are a voluntary, self-selected sample and may be estimates or unverified. The median, percentile range, qualifying check and score chart describe only the records currently stored in this browser—not all applicants, an official cut-off, a merit list or a selection prediction. The website is an independent candidate project and is not affiliated with RSSB.
