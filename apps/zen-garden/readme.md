# Zen Garden 🪴

Gemeinsamer Multiplayer-Zen-Garten. Jede:r Spieler:in hat **einen Klick pro Minute** —
pflanzen, gießen oder ernten. Neue Sorten schaltet die Community gemeinsam über die
Gesamtzahl aller Klicks frei. Der Fortschritt ist bewusst langsam: der Garten soll
über Monate wachsen.

Das Backend ist das zentrale Site-Backend in [`../../server/`](../../server/) —
dort steht auch, wie man es lokal startet und wie das Deployment aufs NAS
funktioniert. Lokal reicht `node server/server.js` im Repo-Root, dann läuft der
Garten auf <http://localhost:8787/apps/zen-garden/>.

## Spielregeln

- **1 Klick pro Minute** pro Spieler:in (serverseitig erzwungen)
- Leeres Beet anklicken → Sorte pflanzen
- Pflanze anklicken → gießen (+1 Wachstum)
- Ausgewachsene Pflanze anklicken → ernten (Beet wird frei)
- Sorten-Freischaltung über Community-Gesamtklicks (bis 300.000 für die Kirschblüte)
