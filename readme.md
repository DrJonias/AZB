# Playground

Lightweight collection of mini games with a playful single-page homepage. Built to be easily extended with additional apps.

## Struktur

- `index.html` – zentrale Startseite mit Links zu den Mini-Apps
- `css/` – geteilte Styles und globale Projektstile
- `js/` – projektweites Main-Skript für die Startseite
- `apps/` – einzelne Mini-Apps mit eigenen HTML-, JS- und CSS-Dateien

## Apps

- `apps/passwort-entropie`
- `apps/maus-speedrun`
- `apps/quickdraw-guesser`
- `apps/fake-o-meter`

## Starten

```powershell
cd c:\Users\BachmannJo\dev\AZB
python -m http.server 8000
```

Dann im Browser öffnen:

```
http://localhost:8000
```

Die Homepage ist in `index.html`. App-Platzhalter leben in `apps/`.
