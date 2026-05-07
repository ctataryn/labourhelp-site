# Labour Help Manitoba Site

This site helps those interested in Employment Rights for residents of [https://en.wikipedia.org/wiki/Manitoba](Manitoba, Canada).

## Contributing

The site's content is stored in GitHub, and each page has an "Edit this page on GitHub" link on the right hand side of
the page in the sidebar.

To edit a page:

1. you must first have a GitHub account (free)
1. click the "Edit this page on GitHub" link
1. if this is your first time, you'll be asked to "Fork" the repository
   * a fork of the repository is your own personal playground where you can modify the site
1. Make your changes, and then open a "Pull Request"
   * the pull request mechanism allows me to review your changes, ask for revisions and then eventually merge the
     changes into the main site

## Tech Stack

[https://astro.build/](Astro Web Framework) + [https://astro.build/themes/details/starlight/](Starlight) Theme

## Project Structure

Inside this Astro + Starlight project, you'll see the following folders and files:

```
.
├── public/
├── src/
│   ├── assets/
│   ├── content/
│   │   └── docs/
│   └── content.config.ts
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

Starlight looks for `.md` or `.mdx` files in the `src/content/docs/` directory. Each file is exposed as a route based on its file name.

Images can be added to `src/assets/` and embedded in Markdown with a relative link.

Static assets, like favicons, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |
