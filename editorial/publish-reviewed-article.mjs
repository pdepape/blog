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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceMarkedBlock(html, startMarker, endMarker, content) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Could not find ${startMarker} and ${endMarker}`);
  }

  const endLineStart = html.lastIndexOf("\n", end) + 1;
  const endIndent = html.slice(endLineStart, end);
  const before = html.slice(0, start + startMarker.length);
  const after = html.slice(end);

  return `${before}\n${content}\n${endIndent}${after}`;
}

function upsertBlogCard(html, slug, card) {
  const cardPattern = new RegExp(
    `\\n\\s*<article[^>]*data-slug="${escapeRegExp(slug)}"[^>]*>[\\s\\S]*?<\\/article>`,
    "g"
  );
  const withoutExistingCard = html
    .replace(cardPattern, "")
    .replaceAll('class="article-card article-card-featured"', 'class="article-card"')
    .replaceAll("Latest roundup &middot;", "Weekly roundup &middot;")
    .replaceAll(">Read the latest roundup</a>", ">Read the roundup</a>");
  const startMarker = "<!-- blog-posts:start -->";
  const endMarker = "<!-- blog-posts:end -->";

  if (
    !withoutExistingCard.includes(startMarker) ||
    !withoutExistingCard.includes(endMarker) ||
    withoutExistingCard.indexOf(endMarker) <= withoutExistingCard.indexOf(startMarker)
  ) {
    throw new Error(`Could not find valid ${startMarker} and ${endMarker} markers`);
  }

  return withoutExistingCard.replace(startMarker, `${startMarker}\n${card}`);
}

function upsertSitemapEntry(xml, slug) {
  const publishedDate = slug.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!publishedDate) {
    throw new Error(`Could not derive a publication date from ${slug}`);
  }

  const sitemapEntryPattern = new RegExp(
    `\\n\\s*<url>\\s*<loc>https:\\/\\/techdocstudio\\.com\\/articles\\/${escapeRegExp(slug)}\\.html<\\/loc>\\s*<lastmod>[^<]+<\\/lastmod>\\s*<\\/url>`,
    "g"
  );
  const withoutExistingEntry = xml.replace(sitemapEntryPattern, "");
  const startMarker = "<!-- published-articles:start -->";
  const endMarker = "<!-- published-articles:end -->";

  if (
    !withoutExistingEntry.includes(startMarker) ||
    !withoutExistingEntry.includes(endMarker) ||
    withoutExistingEntry.indexOf(endMarker) <= withoutExistingEntry.indexOf(startMarker)
  ) {
    throw new Error(`Could not find valid ${startMarker} and ${endMarker} markers`);
  }

  const entry = `  <url>
    <loc>https://techdocstudio.com/articles/${escapeHtml(slug)}.html</loc>
    <lastmod>${publishedDate}</lastmod>
  </url>`;

  return withoutExistingEntry.replace(startMarker, `${startMarker}\n${entry}`);
}

function addPublishedMetadata(html, issue, slug) {
  const canonicalUrl = `https://techdocstudio.com/articles/${escapeHtml(slug)}.html`;
  const titleTag = `    <title>${escapeHtml(issue.pageTitle)} | TechDocs Studio</title>`;
  const socialMetadata = `${titleTag}
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="TechDocs Studio">
    <meta property="og:title" content="${escapeHtml(issue.pageTitle)}">
    <meta property="og:description" content="${escapeHtml(issue.metaDescription)}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="https://techdocstudio.com/assets/techdocs-studio-og.png">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(issue.pageTitle)}">
    <meta name="twitter:description" content="${escapeHtml(issue.metaDescription)}">
    <meta name="twitter:image" content="https://techdocstudio.com/assets/techdocs-studio-og.png">`;

  if (!html.includes(titleTag)) {
    throw new Error(`Could not find the expected title tag for ${slug}`);
  }

  return html
    .replace(/^\s*<meta name="robots" content="noindex, nofollow">\s*$/m, "")
    .replace(titleTag, socialMetadata)
    .replace("This draft tracks", "This roundup tracks");
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
  const blogIndexPath = path.join(repoRoot, "blog", "index.html");
  const sitemapPath = path.join(repoRoot, "sitemap.xml");

  const issue = await readJson(issuePath);
  const reviewHtml = await fs.readFile(reviewPath, "utf8");
  const indexHtml = await fs.readFile(indexPath, "utf8");
  const blogIndexHtml = await fs.readFile(blogIndexPath, "utf8");
  const sitemapXml = await fs.readFile(sitemapPath, "utf8");

  const articleHtml = addPublishedMetadata(
    reviewHtml
      .replace(
        `Prepared ${issue.dateDisplay} for editorial review`,
        `Published ${issue.dateDisplay} by TechDocs Studio`
      )
      .replace(
        escapeHtml(issue.editorNote),
        escapeHtml(issue.publishedEditorNote ?? issue.editorNote)
      ),
    issue,
    slug
  );

  const roundupTitle =
    issue.pageTitle.toLowerCase() === issue.reviewTitle.toLowerCase()
      ? issue.pageTitle
      : issue.reviewTitle
          .replace(/^Documentation news roundup:\s*/i, "")
          .replace(/^./, (character) => character.toUpperCase());
  const cardDescription = (issue.indexCardDescription ?? issue.heroCopy).replace(
    "This draft tracks",
    "This roundup tracks"
  );

  const latestCard = `          <article class="article-card article-card-featured" data-category="${escapeHtml(issue.indexCategory ?? "operations")}" data-featured-roundup>
            <p class="article-meta">Latest roundup &middot; ${escapeHtml(issue.dateDisplay)}</p>
            <h3>${escapeHtml(roundupTitle)}</h3>
            <p>${escapeHtml(cardDescription)}</p>
            <a href="articles/${escapeHtml(slug)}.html">Read the latest roundup</a>
          </article>`;

  const blogCard = `          <article class="article-card article-card-featured" data-category="${escapeHtml(issue.indexCategory ?? "operations")}" data-slug="${escapeHtml(slug)}">
            <p class="article-meta">Latest roundup &middot; ${escapeHtml(issue.dateDisplay)}</p>
            <h3>${escapeHtml(roundupTitle)}</h3>
            <p>${escapeHtml(cardDescription)}</p>
            <a href="../articles/${escapeHtml(slug)}.html">Read the latest roundup</a>
          </article>`;

  const updatedIndexHtml = replaceMarkedBlock(
    indexHtml,
    "<!-- latest-roundup:start -->",
    "<!-- latest-roundup:end -->",
    latestCard
  );
  const updatedBlogIndexHtml = upsertBlogCard(blogIndexHtml, slug, blogCard);
  const updatedSitemapXml = upsertSitemapEntry(sitemapXml, slug);

  await fs.writeFile(articlePath, articleHtml, "utf8");
  await fs.writeFile(indexPath, updatedIndexHtml, "utf8");
  await fs.writeFile(blogIndexPath, updatedBlogIndexHtml, "utf8");
  await fs.writeFile(sitemapPath, updatedSitemapXml, "utf8");

  process.stdout.write(
    JSON.stringify(
      {
        articlePath,
        indexPath,
        blogIndexPath,
        sitemapPath,
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
