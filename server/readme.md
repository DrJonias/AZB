# Site Backend

The single backend for the entire site — zero-dependency Node.js, one file.
Originally started as the Zen Garden server, it now handles all dynamic features:

- **Zen Garden** — `GET /api/state`, `POST /api/action`
- **Highscores** — `GET`/`POST /api/scores/<game>` (e.g. `doodle-jump`; only the best score per name is counted and stored in `scores.json`). Add new games by updating the `SCORE_GAMES` allowlist in `server.js`.
- **Feedback** — `POST /api/feedback` (anonymous, max 1/minute per IP), stored
  as JSON lines in `feedback.jsonl`. Read it by opening the file in the data folder, or set `FEEDBACK_TOKEN` and use `GET /api/feedback?token=<value>`.

All data is stored as JSON files in `DATA_DIR` (default: this folder).

## Cheat console (dev only)

For testing there is `POST /api/cheat` (grow plants, activate boosts,
manipulate scores, …) plus a console overlay in Zen Garden and Doodle Jump
(`js/cheat.js`): open with **Ctrl+Alt+C** or tap the page icon quickly 5 times,
then type `help`.

This is merge-safe in two ways — the code can stay on master because it has no effect there:

1. The endpoint exists only when the `CHEAT_TOKEN` environment variable is set
   (**only set it in the `backend-dev` container, never in `backend`!**) — without it `/api/cheat` responds with 404.
2. The overlay activates only under `/dev/` or on `localhost`.

First use: open the console and enter `token <value>` once (the value comes from
the compose file); it is stored in the browser.

## Run locally

```
node server/server.js
```

Runs at <http://localhost:8787> and also serves the full static site (repo root) —
so local development does not require nginx or Docker.
To use another port: `PORT=3000 node server/server.js`

## Deployment (NAS, Docker)

Production uses the pattern in [`../deploy/`](../deploy/):

- **`web`** (nginx) serves the static site and proxies `/api/` → `backend:8787` and `/dev/api/` → `backend-dev:8787`
  (config: [`../deploy/nginx/default.conf`](../deploy/nginx/default.conf))
- **`webhook`** (alpine/git) keeps the checkouts `./site` (master) and `./site-dev` (dev) up to date with `git pull` every minute
- **`backend`** / **`backend-dev`** (node:20-alpine) restart `server.js` directly from the current checkout (at least every 5 minutes) and automatically apply code changes — no image build, no Docker socket needed

This makes a `git push` deploy automatically; the compose file on the NAS only needs changes for topology updates (new service, different port).

The data folders (`backend-data`, `backend-data-dev`) are intentionally outside the checkouts: `./site` is managed by `git pull` — if save data lived there it would be at risk on every `git reset`.

Initial setup: place `deploy/docker-compose.yml` in a folder on the NAS and `deploy/nginx/default.conf` next to it as `nginx/default.conf`, then run `docker compose up -d` (or create the project in Synology Container Manager). Everything else (cloning checkouts, creating data folders) happens automatically.
