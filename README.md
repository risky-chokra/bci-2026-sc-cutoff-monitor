# BCI 2026 · SC Cut-off Monitor

A light-theme, English-only static dashboard for RSSB Basic Computer Instructor Recruitment 2026. Candidate category is fixed to SC. The candidate database starts empty—there are no demo or generated score records.

## Local database and backups

Scores are automatically saved in the browser's IndexedDB database on the current device. The site does not upload candidate records. Browser storage may be cleared by the device owner; use **Backup JSON** regularly.

- **Backup JSON:** downloads the full database for backup or transfer.
- **Import JSON:** restores or merges candidate entries by anonymous record ID.
- **Export Excel:** downloads a real `.xlsx` workbook with Candidate Scores, Area Summary, and Official SC Seats sheets.
- **Export PDF:** opens a print-ready report. Choose **Save as PDF** in the browser's print dialog.
- **Clear data:** deletes the local database after confirmation.

The form contains only a locked SC category, required TSP/Non-TSP area, and Paper I/Paper II marks. Marks accept two decimal places. No department, score-basis label, name, roll number, phone number, email or application ID is requested. Each device keeps its own database until JSON backups are deliberately transferred/imported.

The empty backup structure is in [`candidate-data-template.json`](candidate-data-template.json); it contains zero candidate entries.

## Qualification logic

RSSB Advertisement 07/2026 sets a 40% minimum in each paper, relaxed by five percentage points for SC/ST. The app applies the SC threshold as **at least 35 marks in Paper I and at least 35 marks in Paper II** (each out of 100). Records below 35 in either paper are still saved, but are marked **Not qualified**. The cut-off analysis defaults to qualified entries only; users can switch to all entries. This is a qualifying check, not an official selection prediction.

## Official SC vacancies shown

The area totals below are transcribed from RSSB Advertisement 07/2026, vacancy tables on pages 1 and 5–8. Backlog seats are included in the total.

| Area | Secondary Education | Sanskrit Education | SC total |
|---|---:|---:|---:|
| Non-TSP / Non-Scheduled | 879 (694 backlog + 185 current) | 23 (23 current) | **902** |
| TSP / Scheduled | 43 (30 backlog + 13 current) | 0 | **43** |
| **Total Basic Computer Instructor** | **922** | **23** | **945** |

RSSB may revise vacancies. Verify the official notice before relying on them. The source PDF is included in this project.

## Publish to GitHub Pages

1. Upload the contents of this folder to a GitHub repository.
2. In **Settings → Pages**, select **GitHub Actions** as the build and deployment source.
3. Push to the `main` branch or run the **Deploy static site to GitHub Pages** workflow.

No cloud database or API key is needed for this local-storage version. Each visitor's entries remain on that visitor's device; use JSON export/import to combine records manually.

## Interpretation

Candidate-entered scores are voluntary, self-selected and unverified. The dashboard's median, percentile range, qualification rate and chart summarize only records stored on the current device and selected area. They are not an official cut-off, merit list or selection prediction. This is an independent project, not affiliated with RSSB.
