# TechDocs Studio

A static GitHub Pages site for publishing practical technical documentation content about developer docs,
product guides, launch docs, and documentation operations.

## Files

- `index.html` - Homepage content and structure.
- `styles.css` - Responsive visual design.
- `script.js` - Mobile navigation, article filtering, and documentation audit checklist behavior.

## Run locally

Open `index.html` directly in a browser, or run a small local server from this folder:

```sh
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Publish with GitHub Pages

1. Push this repository to GitHub.
2. In the repository settings, open **Pages**.
3. Set the source to the `main` branch and the root folder.
4. Save the Pages settings.

## Use a custom URL

After you know the domain, add a file named `CNAME` at the repository root containing only the domain:

```txt
docs.yourdomain.com
```

Then configure your DNS with the records GitHub Pages asks for in the Pages settings.
