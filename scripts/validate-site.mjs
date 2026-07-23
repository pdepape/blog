#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const errors = [];
const htmlFiles = [];
const idCache = new Map();

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    if (entry.isFile() && entry.name.endsWith(".html")) htmlFiles.push(target);
  }
}

function relative(filePath) {
  return path.relative(root, filePath);
}

function idsFor(filePath) {
  if (idCache.has(filePath)) return idCache.get(filePath);
  const html = fs.readFileSync(filePath, "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  idCache.set(filePath, new Set(ids));
  return idCache.get(filePath);
}

function resolveLocalTarget(sourceFile, rawPath) {
  if (!rawPath) return sourceFile;

  const decodedPath = decodeURIComponent(rawPath);
  let target = decodedPath.startsWith("/")
    ? path.join(root, decodedPath.slice(1))
    : path.resolve(path.dirname(sourceFile), decodedPath);

  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, "index.html");
  }

  return target;
}

walk(root);

for (const filePath of htmlFiles) {
  const html = fs.readFileSync(filePath, "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

  for (const id of new Set(duplicates)) {
    errors.push(`${relative(filePath)}: duplicate id #${id}`);
  }

  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const reference = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|javascript:)/.test(reference)) continue;

    const [pathAndQuery, rawFragment = ""] = reference.split("#");
    const rawPath = pathAndQuery.split("?")[0];
    const target = resolveLocalTarget(filePath, rawPath);

    if (!fs.existsSync(target)) {
      errors.push(`${relative(filePath)}: missing local target ${reference}`);
      continue;
    }

    if (rawFragment && target.endsWith(".html")) {
      const fragment = decodeURIComponent(rawFragment);
      if (!idsFor(target).has(fragment)) {
        errors.push(`${relative(filePath)}: missing fragment ${reference}`);
      }
    }
  }
}

const publicHtmlFiles = htmlFiles.filter((filePath) => !relative(filePath).startsWith("review/"));
for (const filePath of publicHtmlFiles) {
  const html = fs.readFileSync(filePath, "utf8");
  if (!/<link rel="canonical" href="https:\/\/techdocstudio\.com\//.test(html)) {
    errors.push(`${relative(filePath)}: missing techdocstudio.com canonical URL`);
  }
  if (/yourdomain\.com/.test(html)) {
    errors.push(`${relative(filePath)}: contains a placeholder domain`);
  }
}

for (const filePath of htmlFiles.filter((candidate) => relative(candidate).startsWith("review/"))) {
  const html = fs.readFileSync(filePath, "utf8");
  if (!/<meta name="robots" content="noindex, nofollow">/.test(html)) {
    errors.push(`${relative(filePath)}: review output must be marked noindex`);
  }
}

const cnamePath = path.join(root, "CNAME");
if (!fs.existsSync(cnamePath) || fs.readFileSync(cnamePath, "utf8").trim() !== "techdocstudio.com") {
  errors.push("CNAME: expected techdocstudio.com");
}

const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const blogHtml = fs.readFileSync(path.join(root, "blog", "index.html"), "utf8");
for (const marker of ["latest-roundup:start", "latest-roundup:end"]) {
  if ((indexHtml.match(new RegExp(marker, "g")) ?? []).length !== 1) {
    errors.push(`index.html: expected one ${marker} publishing marker`);
  }
}
for (const marker of ["blog-posts:start", "blog-posts:end"]) {
  if ((blogHtml.match(new RegExp(marker, "g")) ?? []).length !== 1) {
    errors.push(`blog/index.html: expected one ${marker} publishing marker`);
  }
}
if ((blogHtml.match(/class="article-card article-card-featured"/g) ?? []).length !== 1) {
  errors.push("blog/index.html: expected exactly one featured roundup card");
}

const sitemapXml = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
for (const marker of ["published-articles:start", "published-articles:end"]) {
  if ((sitemapXml.match(new RegExp(marker, "g")) ?? []).length !== 1) {
    errors.push(`sitemap.xml: expected one ${marker} publishing marker`);
  }
}
for (const articlePath of htmlFiles.filter((candidate) => relative(candidate).startsWith("articles/"))) {
  const articleUrl = `https://techdocstudio.com/${relative(articlePath)}`;
  if (!sitemapXml.includes(`<loc>${articleUrl}</loc>`)) {
    errors.push(`sitemap.xml: missing ${articleUrl}`);
  }
}

if (errors.length > 0) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Validated ${htmlFiles.length} HTML files: local routes, fragments, canonical URLs, draft indexing, and publishing markers are clean.\n`
  );
}
