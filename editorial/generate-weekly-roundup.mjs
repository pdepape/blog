#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const execFileAsync = promisify(execFile);

const repoRoot = process.cwd();
const reviewDir = path.join(repoRoot, "review");

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeTokens(value) {
  const stopwords = new Set([
    "about",
    "after",
    "against",
    "around",
    "because",
    "before",
    "between",
    "build",
    "clear",
    "docs",
    "documentation",
    "guide",
    "guides",
    "review",
    "roundup",
    "teams",
    "their",
    "there",
    "these",
    "this",
    "through",
    "using",
    "week",
    "weekly",
    "with",
    "writers",
    "writing",
  ]);

  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((token) => token.length >= 4 && !stopwords.has(token))
  );
}

function jaccard(left, right) {
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function getPreviousRoundups(currentSlug) {
  const entries = await fs.readdir(reviewDir);
  const files = entries
    .filter((entry) => entry.endsWith("-documentation-news-roundup.txt"))
    .filter((entry) => entry !== `${currentSlug}.txt`)
    .sort();

  const results = [];

  for (const file of files) {
    const fullPath = path.join(reviewDir, file);
    const raw = await fs.readFile(fullPath, "utf8");
    const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
    const title = lines[2] ?? file.replace(/\.txt$/, "");
    const urls = [...raw.matchAll(/https?:\/\/\S+/g)].map((match) => match[0]);
    results.push({
      file,
      title,
      raw,
      urls,
    });
  }

  return results;
}

function buildDedupeReport(issue, previousRoundups) {
  const currentSourceUrls = issue.sources.map((source) => source.url);
  const repeatedSources = [];
  const similarTitles = [];

  const currentTitleTokens = normalizeTokens(issue.reviewTitle);

  for (const roundup of previousRoundups) {
    for (const url of currentSourceUrls) {
      if (roundup.urls.includes(url)) {
        repeatedSources.push(`${url} (also used in ${roundup.file})`);
      }
    }

    const score = jaccard(currentTitleTokens, normalizeTokens(roundup.title));
    if (score >= 0.34) {
      similarTitles.push({
        file: roundup.file,
        title: roundup.title,
        score,
      });
    }
  }

  if (repeatedSources.length > 0) {
    throw new Error(
      `Current issue reuses prior source URLs:\n- ${repeatedSources.join("\n- ")}`
    );
  }

  return {
    repeatedSources,
    similarTitles: similarTitles.sort((a, b) => b.score - a.score),
  };
}

function renderText(issue) {
  const parts = [
    issue.banner,
    issue.dateDisplay,
    "",
    issue.reviewTitle,
    "",
    ...issue.intro,
    "",
  ];

  issue.sections.forEach((section, index) => {
    parts.push(`${index + 1}. ${section.heading}`);
    parts.push("");
    parts.push(...section.paragraphs);
    parts.push("");
  });

  parts.push("Why this week matters");
  parts.push("");
  parts.push(...issue.whyThisWeekMatters);
  parts.push("");
  parts.push("Sources");
  parts.push("");

  issue.sources.forEach((source) => {
    parts.push(`- ${source.label} (${source.date}) ${source.url}`);
  });

  parts.push("");

  return `${parts.join("\n")}\n`;
}

function renderHtml(issue) {
  const sourceItems = issue.sources
    .map(
      (source) =>
        `                <li><a href="${escapeHtml(source.url)}">${escapeHtml(source.label)} (${escapeHtml(source.date)})</a></li>`
    )
    .join("\n");

  const sections = issue.sections
    .map((section, index) => {
      const paragraphs = section.paragraphs
        .map((paragraph) => `              <p>${escapeHtml(paragraph)}</p>`)
        .join("\n");

      return `            <section>
              <h2>${index + 1}. ${escapeHtml(section.heading)}</h2>
${paragraphs}
            </section>`;
    })
    .join("\n\n");

  const whyParagraphs = issue.whyThisWeekMatters
    .map((paragraph) => `              <p>${escapeHtml(paragraph)}</p>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(issue.metaDescription)}">
    <meta name="robots" content="noindex, nofollow">
    <title>${escapeHtml(issue.pageTitle)} | TechDocs Studio</title>
    <link rel="stylesheet" href="../styles.css?v=20260722">
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>

    <header class="site-header" data-menu>
      <nav class="nav-shell" aria-label="Primary navigation">
        <a class="brand" href="../index.html#top" aria-label="TechDocs Studio home">
          <span class="brand-mark" aria-hidden="true">TD</span>
          <span>TechDocs Studio</span>
        </a>

        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-menu">
          <span class="menu-toggle__line"></span>
          <span class="menu-toggle__line"></span>
          <span class="menu-toggle__line"></span>
          <span class="sr-only">Toggle navigation</span>
        </button>

        <div class="nav-links" id="site-menu">
          <a class="nav-blog" href="../blog/">Blog</a>
          <a href="../case-studies/">Case studies</a>
          <a href="../index.html#coverage">Coverage</a>
          <a href="../index.html#audit">Audit</a>
          <a class="nav-cta" href="mailto:hello@techdocstudio.com">Contact</a>
        </div>
      </nav>
    </header>

    <main id="main" class="article-page">
      <section class="article-hero">
        <p class="eyebrow">Weekly documentation roundup</p>
        <h1>${escapeHtml(issue.pageTitle)}</h1>
        <p class="article-hero-copy">${escapeHtml(issue.heroCopy)}</p>
        <p class="article-byline">Prepared ${escapeHtml(issue.dateDisplay)} for editorial review</p>
      </section>

      <article class="article-shell">
        <div class="article-layout">
          <div class="article-main">
${issue.intro.map((paragraph) => `            <p>${escapeHtml(paragraph)}</p>`).join("\n")}

${sections}

            <section>
              <h2>Why this week matters</h2>
${whyParagraphs}
            </section>

            <section>
              <h2>Sources</h2>
              <ul class="source-list">
${sourceItems}
              </ul>
            </section>
          </div>

          <aside class="article-sidebar" aria-label="Article summary">
            <div class="article-note">
              <h2>Editor’s note</h2>
              <p>${escapeHtml(issue.editorNote)}</p>
            </div>

            <div class="article-note">
              <h2>What to watch next</h2>
              <p>${escapeHtml(issue.watchNext)}</p>
            </div>
          </aside>
        </div>
      </article>
    </main>
    <footer class="site-footer">
      <p>&copy; 2026 TechDocs Studio &middot; <a href="mailto:hello@techdocstudio.com">hello@techdocstudio.com</a></p>
      <p><a href="../blog/">Back to the blog</a></p>
    </footer>
    <script src="../script.js?v=20260722"></script>
  </body>
</html>
`;
}

function renderDedupeReport(issue, report) {
  const lines = [
    `Dedupe report for ${issue.slug}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "Source URL overlap",
    report.repeatedSources.length === 0 ? "- none" : report.repeatedSources.map((item) => `- ${item}`).join("\n"),
    "",
    "Similar prior titles",
  ];

  if (report.similarTitles.length === 0) {
    lines.push("- none above threshold");
  } else {
    for (const item of report.similarTitles) {
      lines.push(`- ${item.file}: ${(item.score * 100).toFixed(0)}% token overlap :: ${item.title}`);
    }
  }

  lines.push("");
  lines.push("Current focus terms");
  for (const term of issue.focusTerms) {
    lines.push(`- ${term}`);
  }
  lines.push("");
  lines.push(issue.noveltyNote);
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function writeFile(targetPath, contents) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, contents, "utf8");
}

async function convertTextToDocx(textPath, docxPath, title) {
  await execFileAsync("textutil", [
    "-title",
    title,
    "-author",
    "TechDocs Studio",
    "-convert",
    "docx",
    "-inputencoding",
    "UTF-8",
    "-font",
    "Aptos",
    "-fontsize",
    "12",
    textPath,
    "-output",
    docxPath,
  ]);
}

async function main() {
  const issuePathArg = process.argv[2];
  if (!issuePathArg) {
    throw new Error("Usage: node editorial/generate-weekly-roundup.mjs editorial/issues/<issue>.json");
  }

  const issuePath = path.resolve(repoRoot, issuePathArg);
  const issue = await readJson(issuePath);
  const previousRoundups = await getPreviousRoundups(issue.slug);
  const dedupeReport = buildDedupeReport(issue, previousRoundups);

  const txtPath = path.join(reviewDir, `${issue.slug}.txt`);
  const htmlPath = path.join(reviewDir, `${issue.slug}.html`);
  const docxPath = path.join(reviewDir, `${issue.slug}.docx`);
  const reportPath = path.join(reviewDir, `${issue.slug}-dedupe-report.txt`);

  await writeFile(txtPath, renderText(issue));
  await writeFile(htmlPath, renderHtml(issue));
  await writeFile(reportPath, renderDedupeReport(issue, dedupeReport));
  await convertTextToDocx(txtPath, docxPath, issue.pageTitle);

  process.stdout.write(
    JSON.stringify(
      {
        txtPath,
        htmlPath,
        docxPath,
        reportPath,
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
