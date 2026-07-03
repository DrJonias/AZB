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
- Click a fully grown plant → harvest it (plot becomes free again) — **this activates that species' boost for everyone!**
- New species unlock by community total clicks (up to 300,000 for Cherry Blossom)

## Harvest boosts

Each species has its own **global** boost: harvesting a fully grown plant
activates the boost for the whole community. Base duration is 1 hour; harvesting
the same species again extends it (up to 12 hours in advance). Different boosts
stack freely; for the same type, the strongest one applies.

| Species | Boost | Effect |
|---|---|---|
| 🍀 Moss | Fresh Moss | Cooldown 40 s instead of 60 s |
| 🌾 Pampas Grass | Pampas Power | Watering counts double (+2 growth) |
| 🎍 Bamboo | Sprinkler | Watering also waters one random plant |
| 🌼 Chrysanthemum | Lucky Bloom | 25% chance: click without cooldown |
| 🍁 Japanese Maple | Autumn Wind | new boosts last 2 h instead of 1 h |
| 🌳 Bonsai | Enlightenment | clicks count double for unlocks |
| 🪷 Lotus | Monsoon | all plants grow +1 per minute |
| 🌸 Cherry Blossom | Hanami | cooldown only 1 second |
