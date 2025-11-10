const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const NodeCache = require("node-cache");

const app = express();
app.use(cors());
const cache = new NodeCache({ stdTTL: 120, checkperiod: 60 });

// Helper: fetch JSON safely
async function getJSON(url) {
  const resp = await fetch(url, { redirect: "follow" });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status} ${resp.statusText} - ${text.slice(0, 150)}`);
  }
  return await resp.json();
}

// Fetch user's public on-sale gamepasses
async function fetchGamepasses(userId) {
  const all = [];
  let cursor = null;
  let pages = 0;

  while (pages < 5) {
    pages++;
    const url = `https://apis.roblox.com/marketplace-items/v1/items/users/${userId}/game-passes?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
    const data = await getJSON(url);
    const items = Array.isArray(data?.data) ? data.data : [];

    for (const item of items) {
      const price = Number(item.price ?? 0);
      if (price > 0 && item.isForSale !== false) {
        all.push({
          id: Number(item.id),
          name: String(item.name ?? "GamePass"),
          price,
          creatorId: Number(item.creator?.id ?? 0)
        });
      }
    }

    cursor = data?.nextPageCursor || null;
    if (!cursor) break;
  }

  all.sort((a, b) => a.price - b.price);
  return all;
}

// Simple test route
app.get("/health", (req, res) => res.json({ ok: true }));

// Main gamepasses endpoint
app.get("/gamepasses", async (req, res) => {
  const userId = req.query.userId;
  if (!/^\d+$/.test(userId || "")) {
    return res.status(400).json({ error: "Missing or invalid userId" });
  }

  const cacheKey = `gp:${userId}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ data: cached, cached: true });

  try {
    const data = await fetchGamepasses(userId);
    cache.set(cacheKey, data);
    res.json({ data, cached: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Proxy running on port", PORT));
