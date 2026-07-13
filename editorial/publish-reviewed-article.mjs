#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    throw new Error("Usage: node editorial/publish-reviewed-article.mjs <slug>");
  }

  const issuePath = path.join(repoRoot, "editorial", "issues", `${slug}.json`);
  const reviewPath = path.join(repoRoot, "review", `${slug}.html`);
  const articlePath = path.join(repoRoot, "articles", `${slug}.html`);
  const indexPath = path.join(repoRoot, "index.html");

  const issue = await readJson(issuePath);
  const reviewHtml = await fs.readFile(reviewPath, "utf8");
  const indexHtml = await fs.readFile(indexPath, "utf8");

  const articleHtml = reviewHtml
    .replace(
      `Prepared ${issue.dateDisplay} for editorial review`,
      `Published ${issue.dateDisplay} by TechDocs Studio`
    )
    .replace(
      escapeHtml(issue.editorNote),
      escapeHtml(issue.publishedEditorNote ?? issue.editorNote)
    );

  const roundupTitle =
    issue.pageTitle.toLowerCase() === issue.reviewTitle.toLowerCase()
      ? issue.pageTitle
      : issue.reviewTitle.replace(/^Documentation news roundup:\s*/i, "");

  const card = `          <article class="article-card" data-category="${escapeHtml(issue.indexCategory ?? "operations")}">
            <p class="article-meta">Weekly roundup</p>
            <h3>Documentation news roundup: ${escapeHtml(roundupTitle)}</h3>
            <p>${escapeHtml(issue.indexCardDescription ?? issue.heroCopy)}</p>
            <a href="articles/${escapeHtml(slug)}.html">Read the weekly roundup</a>
          </article>`;

  const updatedIndexHtml = indexHtml.replace(
    / {10}<article class="article-card" data-category="operations">\s*<p class="article-meta">Weekly roundup<\/p>[\s\S]*?<a href="articles\/[^"]+">Read the weekly roundup<\/a>\s*<\/article>/,
    card
  );

  await fs.writeFile(articlePath, articleHtml, "utf8");
  await fs.writeFile(indexPath, updatedIndexHtml, "utf8");

  process.stdout.write(
    JSON.stringify(
      {
        articlePath,
        indexPath,
      },
      null,
      2
    ) + "\n"
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
