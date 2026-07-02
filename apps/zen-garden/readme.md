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
starten (z. B. via systemd oder pm2). Das Frontend spricht die API auf derselben
Origin an (`/api/...`) — Frontend und Backend müssen also unter derselben Adresse
erreichbar sein, z. B. über einen Reverse-Proxy wie in `deploy/default.conf`.

### Auf einem NAS (Docker)

Fast jedes NAS (Synology, QNAP, TrueNAS, Unraid …) kann Docker-Container ausführen —
das ist der einfachste Weg, ohne Node selbst installieren zu müssen. Im Ordner liegen
ein `Dockerfile` und eine `docker-compose.yml`.

**Per SSH (funktioniert auf jedem NAS mit Docker):**
```
scp -r apps/zen-garden nas-user@nas-ip:/volume1/docker/zen-garden
ssh nas-user@nas-ip
cd /volume1/docker/zen-garden
docker compose up -d
```
Danach läuft der Garten auf `http://nas-ip:8787`. Die Gartendaten liegen persistent
in `./data/garden-data.json` neben dem Compose-File und überleben Container-Updates.

**Synology (Container Manager):**
1. Ordner `apps/zen-garden` z. B. via File Station nach `/docker/zen-garden` kopieren.
2. Container Manager → Projekt → Neu → Pfad auf den Ordner zeigen (die
   `docker-compose.yml` wird automatisch erkannt) → Erstellen.
3. Port 8787 ggf. im Router/der Firewall freigeben, falls von außerhalb des
   Heimnetzes zugegriffen werden soll.

**QNAP (Container Station):**
1. Ordner hochladen (z. B. per File Station nach `/Container/zen-garden`).
2. Container Station → Anwendungen → Erstellen → `docker-compose.yml` aus dem
   Ordner auswählen → Erstellen.

Ohne Docker geht es genauso mit dem nativen Node.js-Paket vieler NAS (z. B. Synologys
„Node.js" aus dem Paketzentrum): Ordner hochladen, per SSH
`node apps/zen-garden/server/server.js` starten und z. B. mit `pm2` oder einer
Scheduled Task dauerhaft am Laufen halten.

### Bei bestehendem webhook/git-pull-Compose-Setup

Falls dein NAS die Seite schon über ein Compose-Muster wie dieses ausliefert —
ein `nginx`-Container, der `./site` statisch serviert, plus ein zweiter Container,
der `./site` per `git clone`/`git pull` (alle 60 s) aktuell hält —, muss Zen Garden
dort nur als **dritter Service** ergänzt werden. Ein eigenes Docker-Image ist dafür
nicht nötig: der Backend-Code liegt nach jedem Pull ohnehin schon in
`./site/apps/zen-garden/server/server.js`, ein Stock-`node`-Image reicht.

Fertige Vorlagen liegen unter [`deploy/`](deploy/):
- [`deploy/docker-compose.yml`](deploy/docker-compose.yml) — dein bestehendes
  `docker-compose.yml`, ergänzt um den `zen-garden`-Service. `web` und `webhook`
  sind unverändert übernommen, nur bei `web` ist ein Volume für die nginx-Config
  dazugekommen.
- [`deploy/default.conf`](deploy/default.conf) — nginx-Config mit Reverse-Proxy
  `/api/` → `zen-garden:8787`, damit das Spiel unter derselben Adresse
  (`http://nas-ip:8080/apps/zen-garden/`) läuft, ohne dass im Spiel unten manuell
  eine „Server-Adresse" eingetragen werden muss.

**Einrichtung** (im Projektordner auf dem NAS, dort wo deine bisherige
`docker-compose.yml` liegt):
1. Bestehende `docker-compose.yml` mit der Vorlage aus `deploy/` abgleichen bzw.
   ersetzen (den `zen-garden`-Service übernehmen, den `web`-Service um das
   `default.conf`-Volume ergänzen).
2. `deploy/default.conf` als `nginx/default.conf` neben die `docker-compose.yml`
   legen.
3. `mkdir -p zen-garden-data` — das ist der Ordner für `garden-data.json`,
   bewusst *außerhalb* von `./site`. `./site` wird von `git pull`
   überschrieben; würde der Spielstand dort liegen, wäre er bei jedem Merge-
   Konflikt oder künftigen `git reset` in Gefahr.
4. `docker compose up -d` — danach läuft der Garten mit unter
   `http://nas-ip:8080/apps/zen-garden/`.

Der `zen-garden`-Service startet den Node-Prozess in einer Schleife neu
(spätestens alle 5 Minuten, siehe `command` in der Compose-Datei) und übernimmt
so automatisch Code-Änderungen, die der bestehende Pull-Container reinzieht —
kein Docker-Rebuild und kein Zugriff auf den Docker-Socket nötig. Der
Spielstand übersteht das dank des separaten `zen-garden-data`-Volumes
klaglos.

## Feedback-Formular

Der Server nimmt auch das anonyme Feedback der Startseite entgegen
(`POST /api/feedback`, max. 1× pro Minute pro IP) und hängt es zeilenweise an
`feedback.jsonl` im Datenordner an — gespeichert werden nur Zeitpunkt, Seite und
Text (keine IP, kein User-Agent). Lesen:

- **File Station:** `/docker/azb/zen-garden-data/feedback.jsonl` öffnen.
- **Browser (optional):** In der Compose-Datei `FEEDBACK_TOKEN` setzen, dann ist
  das Feedback unter `https://<domain>/api/feedback?token=<wert>` als JSON abrufbar.

## Spielregeln

- **1 Klick pro Minute** pro Spieler:in (serverseitig erzwungen)
- Leeres Beet anklicken → Sorte pflanzen
- Pflanze anklicken → gießen (+1 Wachstum)
- Ausgewachsene Pflanze anklicken → ernten (Beet wird frei)
- Sorten-Freischaltung über Community-Gesamtklicks (bis 300.000 für die Kirschblüte)
