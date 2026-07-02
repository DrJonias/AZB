# Zen Garden 🪴

Gemeinsamer Multiplayer-Zen-Garten. Jede:r Spieler:in hat **einen Klick pro Minute** —
pflanzen, gießen oder ernten. Neue Sorten schaltet die Community gemeinsam über die
Gesamtzahl aller Klicks frei. Der Fortschritt ist bewusst langsam: der Garten soll
über Monate wachsen.

## Backend starten

Benötigt nur Node.js, keine Dependencies:

```
node apps/zen-garden/server/server.js
```

Der Server läuft dann auf <http://localhost:8787>, liefert das Spiel direkt mit aus
und speichert den Garten in `server/garden-data.json` (übersteht Neustarts).

Anderer Port: `PORT=3000 node apps/zen-garden/server/server.js`

## Deployment

Den Ordner `apps/zen-garden` auf einen Server mit Node.js legen und `server/server.js`
starten (z. B. via systemd oder pm2). Wird das Frontend woanders gehostet (z. B. GitHub
Pages), im Spiel unten unter „Server-Adresse" die URL des Backends eintragen — CORS ist
offen konfiguriert.

## Spielregeln

- **1 Klick pro Minute** pro Spieler:in (serverseitig erzwungen)
- Leeres Beet anklicken → Sorte pflanzen
- Pflanze anklicken → gießen (+1 Wachstum)
- Ausgewachsene Pflanze anklicken → ernten (Beet wird frei)
- Sorten-Freischaltung über Community-Gesamtklicks (bis 300.000 für die Kirschblüte)
