// Roblox Gamepass Proxy with Caching
const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Cache Settings =====
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = {}; // { placeId: { timestamp, data } }

// ===== Utility: Parse gamepasses from HTML =====
function parseGamepasses(html) {
  const regex = /\/game-pass\/(\d+)\/([^\"]+)/g;
  const matches = [...html.matchAll(regex)];
  return matches.map((m) => ({
    id: Number(m[1]),
    name: m[2].replace(/-/g, " "),
  }));
}

// ===== Core fetcher with pagination =====
async function fetchAllGamepasses(placeId) {
  let startIndex = 0;
  const maxRows = 50;
  const allPasses = [];

  while (true) {
    const url = `https://www.roblox.com/games/getgamepassesinnerpartial?startIndex=${startIndex}&maxRows=${maxRows}&placeId=${placeId}`;
    console.log("Fetching:", url);

    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) {
      console.error("Request failed:", response.status, response.statusText);
      break;
    }

    const html = await response.text();
    const passes = parseGamepasses(html);
    console.log(`→ Found ${passes.length} passes (page ${startIndex / maxRows + 1})`);
    allPasses.push(...passes);

    if (passes.length < maxRows) break; // No more pages
    startIndex += maxRows;
  }

  return allPasses;
}

// ===== API endpoint =====
app.get("/gamepasses/:placeId", async (req, res) => {
  const { placeId } = req.params;

  // Check cache
  const cached = cache[placeId];
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[CACHE] Returning cached data for place ${placeId}`);
    return res.json({
      success: true,
      placeId,
      count: cached.data.length,
      data: cached.data,
      cached: true,
    });
  }

  try {
    console.log(`[LIVE] Fetching fresh data for place ${placeId}`);
    const passes = await fetchAllGamepasses(placeId);

    // Store in cache
    cache[placeId] = { timestamp: now, data: passes };

    res.json({
      success: true,
      placeId,
      count: passes.length,
      data: passes,
      cached: false,
    });
  } catch (err) {
    console.error("Error fetching:", err);
    res.status(500).json({
      success: false,
      error: err.toString(),
    });
  }
});

// ===== Health check =====
app.get("/", (req, res) => {
  res.send("✅ Roblox Gamepass Proxy with caching is running!");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
