// Roblox Donation Proxy (RoProxy version)
// Fetches player-owned gamepasses by enumerating their games via RoProxy
// Works without Roblox API keys (as of 2025)

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const NodeCache = require("node-cache");

const app = express();
app.use(cors());
const cache = new NodeCache({ stdTTL: 120, checkperiod: 60 });

// Helper to fetch and parse JSON safely
async function getJSON(url) {
  const resp = await fetch(url, { redirect: "follow" });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status} ${resp.statusText} - ${text.slice(0, 150)}`);
  }
  return await resp.json();
}

// Fetch all games belonging to a user
async function fetchUserGames(userId) {
  const games = [];
  let cursor = null;
  let pages = 0;
  while (pages < 5) {
    pages++;
    const url = `https://games.roproxy.com/v2/users/${userId}/games?limit=50${cursor ? `&cursor=${cursor}` : ""}`;
    const data = await getJSON(url);
    const rows = Array.isArray(data?.data) ? data.data : [];
    for (const g of rows) {
      if (g.id) games.push(Number(g.id));
    }
    cursor = data?.nextPageCursor || null;
    if (!cursor) break;
  }
  return games;
}

// Fetch all gamepasses for a given game
async function fetchGamePassesForGame(gameId) {
  const passes = [];
  let cursor = null;
  let pages = 0;
  while (pages < 5) {
    pages++;
    const url = `https://games.roproxy.com/v1/games/${gameId}/game-passes?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
    const data = await getJSON(url);
    const rows = Array.isArray(data?.data) ? data.data : [];
    for (const item of rows) {
      const price = Number(item.price ?? 0);
      if (price > 0 && item.isForSale !== false) {
        passes.push({
          id: Number(item.id),
          name: String(item.name ?? "GamePass"),
          price,
          creatorId: Number(item.creator?.id ?? 0),
        });
      }
    }
    cursor = data?.nextPageCursor || null;
    if (!cursor) break;
  }
  return passes;
}

// Top-level: fetch all gamepasses owned by a user
async function fetchAllGamepasses(userId) {
  const all = [];
  const games = await fetchUserGames(userId);
  const seen = new Set();

  for (const gid of games) {
    const passes = await fetchGamePassesForGame(gid);
    for (const p of passes) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        all.push(p);
      }
    }
  }

  all.sort((a, b) => a.price - b.price);
  return all;
}

// Routes -------------------------------------------------------

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/gamepasses", async (req, res) => {
  const userId = req.query.userId;
  if (!/^\d+$/.test(userId || "")) {
    return res.status(400).json({ error: "Missing or invalid userId" });
  }

  const cacheKey = `gp:${userId}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ data: cached, cached: true });

  try {
    const data = await fetchAllGamepasses(userId);
    cache.set(cacheKey, data);
    res.json({ data, cached: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("RoProxy Donation Proxy running on port", PORT));
