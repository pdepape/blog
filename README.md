# TechDocs Studio

A static GitHub Pages site at [techdocstudio.com](https://techdocstudio.com) for publishing practical
technical documentation content, first-party case studies, and a weekly documentation news roundup.

## Files

- `index.html` - Homepage content and structure.
- `blog/` - Published-post archive.
- `articles/` - Individual published articles.
- `case-studies/` - First-party case studies backed by working examples on the site.
- `styles.css` - Responsive visual design.
- `script.js` - Mobile navigation, article filtering, and documentation audit checklist behavior.
- `scripts/validate-site.mjs` - Local route, fragment, metadata, and publishing-marker checks.

## Run locally

Open `index.html` directly in a browser, or run a small local server from this folder:

```sh
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

Validate the static site before publishing:

```sh
node scripts/validate-site.mjs
```

## Publish with GitHub Pages

1. Push this repository to GitHub.
2. In the repository settings, open **Pages**.
3. Set the source to the `main` branch and the root folder.
4. Save the Pages settings.

## Use a custom URL

The custom domain is stored in the root `CNAME` file:

```txt
techdocstudio.com
```

DNS points the apex domain and `www` host to GitHub Pages. Keep **Enforce HTTPS** enabled in the repository's
Pages settings so every visitor is redirected to the secure URL.
