# Playground

Lightweight collection of mini games with a playful single-page homepage. Built to be easily extended with additional apps.

## Struktur

- `index.html` – zentrale Startseite mit Links zu den Mini-Apps
- `css/` – geteilte Styles und globale Projektstile
- `js/` – projektweites Main-Skript für die Startseite
- `apps/` – einzelne Mini-Apps mit eigenen HTML-, JS- und CSS-Dateien

## Apps

- `apps/passwort-entropie`
- `apps/speedrun`
- `apps/quickdraw-guesser`
- `apps/fake-o-meter`
- `apps/draw-the-flag`
- `apps/marble-run`
- `apps/stempeluhr` – Clock-In/Clock-Out mit 42h-Woche (8:24 h/Tag), Feierabendzeit & Überstunden
- `apps/zen-garden` – Multiplayer-Clicker mit Node.js-Backend (siehe `apps/zen-garden/readme.md`)
- `apps/doodle-jump` – Jump'n'Run mit globalem Scoreboard (nutzt dasselbe Backend)

## Branches & Deployment

- `master` → Produktion (`timetheft.ch`), `dev` → Vorschau (`timetheft.ch/dev`, eigenes Backend mit eigenen Daten).
- Workflow: Änderungen auf `dev` pushen, auf `timetheft.ch/dev` testen, bei Zufriedenheit nach `master` mergen.
- Deploy-Vorlagen (Docker Compose + nginx) liegen in `apps/zen-garden/deploy/`.

## ToDo

_Aktuell keine offenen ToDos._