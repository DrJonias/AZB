# Site-Backend

Das eine Backend für die ganze Seite — zero-dependency Node.js, eine Datei.
Historisch als Zen-Garden-Server gestartet, inzwischen zentral für alles Dynamische:

- **Zen Garden** — `GET /api/state`, `POST /api/action`
- **Highscores** — `GET`/`POST /api/scores/<spiel>` (z. B. `doodle-jump`; pro Name
  zählt nur der beste Score, gespeichert in `scores.json`). Neue Spiele: Eintrag
  in der `SCORE_GAMES`-Allowlist in `server.js` ergänzen.
- **Feedback** — `POST /api/feedback` (anonym, max. 1×/Minute pro IP), landet
  zeilenweise in `feedback.jsonl`. Lesen: Datei im Datenordner öffnen, oder
  `FEEDBACK_TOKEN` setzen und `GET /api/feedback?token=<wert>` aufrufen.

Alle Daten liegen als JSON-Dateien in `DATA_DIR` (Default: dieser Ordner).

## Cheat-Konsole (nur dev)

Zum Testen gibt es `POST /api/cheat` (Pflanzen wachsen lassen, Boosts setzen,
Scores manipulieren, …) plus ein Konsolen-Overlay in Zen Garden und Doodle Jump
(`js/cheat.js`): öffnen mit **Ctrl+Alt+C** oder 5× schnell aufs Seiten-Icon
tippen, dann `help` eingeben.

Das ist doppelt merge-sicher — der Code darf auf master liegen, weil er dort
wirkungslos ist:

1. Der Endpoint existiert nur, wenn die Env-Variable `CHEAT_TOKEN` gesetzt ist
   (**nur beim `backend-dev`-Container setzen, nie bei `backend`!**) — ohne sie
   antwortet `/api/cheat` mit 404.
2. Das Overlay aktiviert sich nur unter `/dev/` oder auf `localhost`.

Erstbenutzung: Konsole öffnen und einmal `token <wert>` eingeben (der Wert aus
der Compose-Datei); er wird im Browser gespeichert.

## Lokal starten

```
node server/server.js
```

Läuft auf <http://localhost:8787> und liefert auch gleich die komplette statische
Seite aus (Repo-Root) — lokal braucht es also weder nginx noch Docker.
Anderer Port: `PORT=3000 node server/server.js`

## Deployment (NAS, Docker)

Die Produktion läuft nach dem Muster in [`../deploy/`](../deploy/):

- **`web`** (nginx) liefert die statische Seite aus und proxied `/api/` →
  `backend:8787` bzw. `/dev/api/` → `backend-dev:8787`
  (Config: [`../deploy/nginx/default.conf`](../deploy/nginx/default.conf))
- **`webhook`** (alpine/git) hält die Checkouts `./site` (master) und
  `./site-dev` (dev) per `git pull` jede Minute aktuell
- **`backend`** / **`backend-dev`** (node:20-alpine) starten `server.js` direkt
  aus dem jeweiligen Checkout neu (spätestens alle 5 Minuten) und übernehmen so
  Code-Änderungen automatisch — kein Image-Build, kein Docker-Socket nötig

Dadurch deployt sich ein `git push` von selbst; die Compose-Datei auf dem NAS
muss nur bei Topologie-Änderungen (neuer Service, anderer Port) angefasst werden.

Die Datenordner (`backend-data`, `backend-data-dev`) liegen bewusst **außerhalb**
der Checkouts: `./site` wird von `git pull` verwaltet — läge der Spielstand dort,
wäre er bei jedem `git reset` in Gefahr.

Einrichtung von Grund auf: `deploy/docker-compose.yml` in einen Ordner aufs NAS
legen, `deploy/nginx/default.conf` daneben als `nginx/default.conf`, dann
`docker compose up -d` (oder im Synology Container Manager als Projekt anlegen).
Alles Weitere (Checkouts klonen, Datenordner anlegen) passiert automatisch.
