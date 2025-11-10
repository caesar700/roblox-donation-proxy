const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const NodeCache = require("node-cache");

const app = express();
app.use(cors());
const cache = new NodeCache({ stdTTL: 120, checkperiod: 60 });

async function getJSON(url) {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
  return await r.json();
}

async function fetchGamepasses(userId) {
  const results = [];
  let cursor = null;
  let pages = 0;
  while (pages < 5) {
    pages++;
    const url = `https://apis.roblox.com/marketplace-items/v1/items/users/${userId}/game-passes?limit=100${cursor ? `&cursor=${cursor}` : ""}`;
    const data = await getJSON(url);
    const rows = Array.isArray(data?.data) ? data.data : [];
    for (const row of rows) {
      const price = Number(row.price ?? 0);
      if (price > 0 && row.isForSale !== false) {
        results.push({
          id: Number(row.id),
          name: String(row.name ?? "GamePass"),
          price,
          creatorId: Number(row.creator?.id ?? 0),
        });
      }
    }
    cursor = data?.nextPageCursor || null;
    if (!cursor) break;
  }
  results.sort((a, b) => a.price - b.price);
  return results;
}

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
    const data = await fetchGamepasses(userId);
    cache.set(cacheKey, data);
    res.json({ data, cached: false });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Proxy running on port", PORT));
