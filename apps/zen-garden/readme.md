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
- Ausgewachsene Pflanze anklicken → ernten (Beet wird frei) — **aktiviert den Boost der Sorte für alle!**
- Sorten-Freischaltung über Community-Gesamtklicks (bis 300.000 für die Kirschblüte)

## Ernte-Boosts

Jede Sorte hat einen eigenen **globalen** Boost: Wer eine ausgewachsene Pflanze
erntet, aktiviert ihn für die gesamte Community. Basisdauer 1 Stunde; erneute
Ernte derselben Sorte verlängert (maximal 12 h im Voraus). Verschiedene Boosts
stapeln sich frei, beim gleichen Typ gilt der stärkste.

| Sorte | Boost | Wirkung |
|---|---|---|
| 🍀 Moos | Frisches Moos | Cooldown 40 s statt 60 s |
| 🌾 Pampasgras | Pampas-Power | Gießen zählt doppelt (+2 Wachstum) |
| 🎍 Bambus | Sprinkler | Gießen bewässert zusätzlich eine zufällige Pflanze |
| 🌼 Chrysantheme | Glücksblüte | 25 % Chance: Klick ohne Cooldown |
| 🍁 Fächerahorn | Herbstwind | Neu aktivierte Boosts halten 2 h statt 1 h |
| 🌳 Bonsai | Erleuchtung | Klicks zählen doppelt für Freischaltungen |
| 🪷 Lotus | Monsun | Alle Pflanzen wachsen +1 pro Minute |
| 🌸 Kirschblüte | Hanami | Kein Cooldown! |
