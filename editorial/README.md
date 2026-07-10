# Weekly article workflow

This repo now uses a weekly review-first flow for documentation news roundups.

## Publish targets

- Site entry on the homepage: `index.html`
- Published article pages: `articles/`
- Review documents for editing and email attachment: `review/`

## Weekly run checklist

1. Research recent technical writing and documentation news from primary sources.
2. Update or add the issue file in `editorial/issues/`.
3. Generate the roundup artifacts:
   `node editorial/generate-weekly-roundup.mjs editorial/issues/<issue>.json`
4. Review the dedupe report in `review/` to confirm the angle and sources do not repeat earlier roundups.
5. Draft the roundup in `review/` as `.txt`, `.html`, and `.docx`.
6. Create a Gmail draft to the connected account with the `.docx` attached.
7. Import the `.docx` into Google Docs or open it through the Documents workflow for editing.
8. After review edits are complete, publish the approved article:
   `node editorial/publish-reviewed-article.mjs <slug>`
9. Confirm the published page in `articles/` and the featured card in `index.html`.
