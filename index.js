import express from "express";
import fetch from "node-fetch";

const app = express();

// Simple endpoint for Roblox games
app.get("/gamepasses/:placeId", async (req, res) => {
  const { placeId } = req.params;
  const url = `https://www.roblox.com/games/getgamepassesinnerpartial?startIndex=0&maxRows=50&placeId=${placeId}`;
  console.log("Fetching:", url);
  try {
    const r = await fetch(url, { redirect: "follow" });
    const html = await r.text();

    // Parse /game-pass/{id}/{name} patterns from the HTML
    const matches = [...html.matchAll(/\/game-pass\/(\d+)\/([^\"]+)/g)];
    const passes = matches.map(m => ({
      id: Number(m[1]),
      name: m[2].replace(/-/g, " ")
    }));

    res.json({ success: true, count: passes.length, data: passes });
  } catch (e) {
    console.error("Error fetching:", e);
    res.status(500).json({ success: false, error: e.toString() });
  }
});

// Required by Render (Render assigns a random port)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy listening on port ${PORT}`));
