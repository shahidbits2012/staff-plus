# Contributing to Staff Prep

Staff Prep is **100% free, forever** and built in the open. Contributions that
improve depth, correctness, or clarity are very welcome.

## Content Philosophy

This is an architecture handbook for Staff+ engineers. Every page should answer
**why, how, trade-offs, and failure modes** — not just definitions.

## Ground Rules

1. **Problem pages stay focused.** A system-design problem page describes the
   solution to *that* problem. Generic concepts (Kafka, API gateways, consistent
   hashing, etc.) live on their own pages and are **hyperlinked** — never inlined.
2. **Link, don't repeat.** If a concept applies to more than one problem, give it
   its own concept page and link to it.
3. **Follow the templates.** Problem pages use the 10-step template; concept pages
   use the 9-section template. See `AGENTS.md` for the full structure.

## Local Development

```bash
npm install
npm run start      # serves on http://localhost:3050/
```

## Submitting Changes

1. Fork the repo and create a branch.
2. Make your change and verify it renders locally.
3. Open a Pull Request describing the *why* behind the change.

## Publishing (maintainers)

```bash
./scripts/promote.sh <github_pat> "your commit message"
```

Repo configuration lives in `config/site.json` — the single source of truth for
site name, URLs, and GitHub coordinates.
