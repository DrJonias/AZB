# Playground

Lightweight collection of mini games with a playful single-page homepage. Built to be easily extended with additional apps.

## Structure

**One frontend, one backend:** The site is static (served by nginx), and a small Node.js backend handles all dynamic features.

- `index.html` – central landing page with links to the mini apps
- `css/` – shared styles and global project styling
- `js/` – project-wide main script for the homepage (including the feedback widget)
- `apps/` – individual mini apps with their own HTML, JS, and CSS
- `server/` – site backend (zero-dependency Node.js, see `server/readme.md`):
  Zen Garden, highscores (`/api/scores/<game>`), anonymous feedback
- `deploy/` – NAS deployment templates (Docker Compose + nginx config)

Local development: `node server/server.js` starts the backend **and** serves the
entire site at <http://localhost:8787> — nothing else is required.

## Apps

- `apps/passwort-entropie`
- `apps/speedrun`
- `apps/quickdraw-guesser`
- `apps/fake-o-meter`
- `apps/draw-the-flag`
- `apps/marble-run`
- `apps/stempeluhr` – Clock-In/Clock-Out with a 42h workweek (8:24 h/day), end-of-day time & overtime
- `apps/zen-garden` – multiplayer clicker (rules: `apps/zen-garden/readme.md`)
- `apps/doodle-jump` – jump'n'run with a global scoreboard
- `apps/auszugs-budget` – fixed-costs planner for your first flat with an income check (localStorage)

## Branches & Deployment

- `master` → production (`timetheft.ch`), `dev` → preview (`timetheft.ch/dev`, separate backend with its own data).
- Workflow: push changes to `dev`, test on `timetheft.ch/dev`, merge to `master` once approved.
- Deployment templates and instructions: `deploy/` (Docker Compose) and `server/readme.md`.

## ToDo

_None at the moment._
