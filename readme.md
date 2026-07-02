# Playground

Lightweight collection of mini games with a playful single-page homepage. Built to be easily extended with additional apps.

## Struktur

**Ein Frontend, ein Backend:** Die Seite ist statisch (nginx liefert sie aus),
dazu läuft genau ein kleines Node.js-Backend für alles Dynamische.

- `index.html` – zentrale Startseite mit Links zu den Mini-Apps
- `css/` – geteilte Styles und globale Projektstile
- `js/` – projektweites Main-Skript für die Startseite (inkl. Feedback-Widget)
- `apps/` – einzelne Mini-Apps mit eigenen HTML-, JS- und CSS-Dateien
- `server/` – das Site-Backend (zero-dependency Node.js, siehe `server/readme.md`):
  Zen Garden, Highscores (`/api/scores/<spiel>`), anonymes Feedback
- `deploy/` – Deploy-Vorlagen fürs NAS (Docker Compose + nginx-Config)

Lokal entwickeln: `node server/server.js` startet Backend **und** liefert die
ganze Seite auf <http://localhost:8787> aus — mehr braucht es nicht.

## Apps

- `apps/passwort-entropie`
- `apps/speedrun`
- `apps/quickdraw-guesser`
- `apps/fake-o-meter`
- `apps/draw-the-flag`
- `apps/marble-run`
- `apps/stempeluhr` – Clock-In/Clock-Out mit 42h-Woche (8:24 h/Tag), Feierabendzeit & Überstunden
- `apps/zen-garden` – Multiplayer-Clicker (Spielregeln: `apps/zen-garden/readme.md`)
- `apps/doodle-jump` – Jump'n'Run mit globalem Scoreboard

## Branches & Deployment

- `master` → Produktion (`timetheft.ch`), `dev` → Vorschau (`timetheft.ch/dev`, eigenes Backend mit eigenen Daten).
- Workflow: Änderungen auf `dev` pushen, auf `timetheft.ch/dev` testen, bei Zufriedenheit nach `master` mergen.
- Deploy-Vorlagen und Anleitung: `deploy/` (Docker Compose) und `server/readme.md`.

## ToDo

_Aktuell keine offenen ToDos._
