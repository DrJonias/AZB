# Zen Garden 🪴

A shared multiplayer Zen Garden. Each player gets **one click per minute** —
plant, water, or harvest. New species unlock together for the community based on
total clicks. The pace is intentionally slow: the garden grows over months.

The backend is the central site backend in [`../../server/`](../../server/) —
that README also explains how to run it locally and deploy it to the NAS.
Locally, start with `node server/server.js` in the repo root, then open
<http://localhost:8787/apps/zen-garden/>.

## Rules

- **1 click per minute** per player (enforced server-side)
- Click an empty plot → plant a species
- Click a plant → water it (+1 growth)
- Click a fully grown plant → harvest it (plot becomes free again) — **this levels up that species' boost for everyone!**
- New species unlock by community total clicks (up to 300,000 for the final one)
- The final species is a **mystery** — nobody knows what it is until someone
  harvests it. Spoiler (don't read this): it is a malicious weed that strangles
  the whole garden. Plots, unlocks and boost levels reset, and the community's
  **prestige counter** goes up by one.

## Harvest boosts

Each species has its own **global** boost: harvesting a fully grown plant
raises that boost's level for the whole community — **permanently**. Different
boosts stack freely. Fresh Moss and Autumn Wind grow stronger with each level
(up to their cap); for the other boosts the level counts how often the
community has harvested that species.

| Species | Boost | Effect |
|---|---|---|
| 🍀 Moss | Fresh Moss | −1 s cooldown per level, down to 10 s at level 50 |
| 🌾 Pampas Grass | Pampas Power | Watering counts double (+2 growth) |
| 🎍 Bamboo | Sprinkler | Watering also waters one random plant |
| 🌼 Chrysanthemum | Lucky Bloom | 25% chance: click without cooldown |
| 🍁 Japanese Maple | Autumn Wind | +2% chance per level that a harvested plant re-seeds itself (50% at level 25) |
| 🌳 Bonsai | Enlightenment | clicks count double for unlocks |
| 🪷 Lotus | Monsoon | all plants grow +1 per minute |
| ❓ ??? | — | no boost: harvesting it triggers the prestige reset |
