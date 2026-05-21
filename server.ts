import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Pool } from "pg";
import geoip from "geoip-lite";

const app = express();
const PORT = 3000;

// ─── PostgreSQL ───────────────────────────────────────────────────────────────
const neonDbUrl =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_kvGrWm9gp6LJ@ep-rapid-shadow-aoqs9ui2-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString: neonDbUrl,
  ssl:
    neonDbUrl.includes("neon.tech") || neonDbUrl.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
});

let isDbConnected = false;

// ─── DB Init ──────────────────────────────────────────────────────────────────
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS targets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        target VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        target_id UUID REFERENCES targets(id) ON DELETE CASCADE,
        source_ip VARCHAR(100) NOT NULL,
        user_agent TEXT,
        referer TEXT,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        method VARCHAR(10) NOT NULL,
        path VARCHAR(1024) NOT NULL,
        country VARCHAR(100),
        city VARCHAR(100),
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION
      );
    `);

    // Add new columns to existing tables if not present (safe migration)
    await pool.query(`
      ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
    `).catch(() => {});
    await pool.query(`
      ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS referer TEXT;
    `).catch(() => {});
    await pool.query(`
      ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS city VARCHAR(100);
    `).catch(() => {});

    console.log("✅ Database initialized successfully.");
    isDbConnected = true;
  } catch (err) {
    console.error("❌ Failed to initialize database:", err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract real client IP, handling proxies / Cloudflare / Render.
 */
function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      .split(",")[0]
      .trim();
    if (first) return first;
  }
  const cfIp = req.headers["cf-connecting-ip"];
  if (cfIp) return Array.isArray(cfIp) ? cfIp[0] : cfIp;

  return req.socket.remoteAddress || "0.0.0.0";
}

/**
 * Resolve geo-info from IP using local geoip-lite database.
 * Falls back gracefully when IP is private/unknown.
 */
function resolveGeo(ip: string): {
  country: string;
  city: string;
  lat: number | null;
  lng: number | null;
} {
  const geo = geoip.lookup(ip);
  if (!geo) {
    return { country: "Unknown", city: "Unknown", lat: null, lng: null };
  }
  return {
    country: geo.country || "Unknown",
    city: geo.city || "Unknown",
    lat: geo.ll ? geo.ll[0] : null,
    lng: geo.ll ? geo.ll[1] : null,
  };
}

// ─── SSE Clients ──────────────────────────────────────────────────────────────
const sseClients = new Set<express.Response>();

function broadcast(payload: object) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.write(data);
    } catch (_) {
      sseClients.delete(client);
    }
  });
}

// ─── 1×1 transparent GIF ─────────────────────────────────────────────────────
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// ─── Server Bootstrap ─────────────────────────────────────────────────────────
async function startServer() {
  app.use(express.json());

  await initDB();

  // ── GET /api/targets ────────────────────────────────────────────────────────
  app.get("/api/targets", async (_req, res) => {
    if (!isDbConnected) {
      return res.status(503).json({ error: "Database not connected" });
    }
    try {
      const result = await pool.query(
        `SELECT id, target, type, added_at as "addedAt" FROM targets ORDER BY added_at DESC`
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch targets" });
    }
  });

  // ── POST /api/targets ───────────────────────────────────────────────────────
  app.post("/api/targets", async (req, res) => {
    const { target, type } = req.body;
    if (!target || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!isDbConnected) {
      return res.status(503).json({ error: "Database not connected" });
    }
    try {
      const result = await pool.query(
        `INSERT INTO targets (target, type)
         VALUES ($1, $2)
         RETURNING id, target, type, added_at as "addedAt"`,
        [target, type]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create target" });
    }
  });

  // ── DELETE /api/targets/:id ─────────────────────────────────────────────────
  app.delete("/api/targets/:id", async (req, res) => {
    if (!isDbConnected) {
      return res.status(503).json({ error: "Database not connected" });
    }
    try {
      await pool.query("DELETE FROM targets WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete target" });
    }
  });

  // ── GET /api/logs ───────────────────────────────────────────────────────────
  app.get("/api/logs", async (req, res) => {
    if (!isDbConnected) {
      return res.status(503).json({ error: "Database not connected" });
    }
    const limit = Math.min(Number(req.query.limit) || 1000, 5000);
    try {
      const result = await pool.query(
        `SELECT
           l.id,
           l.target_id    AS "targetId",
           t.target,
           t.type         AS "targetType",
           l.source_ip    AS "sourceIp",
           l.user_agent   AS "userAgent",
           l.referer,
           l.timestamp,
           l.method,
           l.path,
           l.country,
           l.city,
           l.lat,
           l.lng
         FROM access_logs l
         LEFT JOIN targets t ON l.target_id = t.id
         ORDER BY l.timestamp DESC
         LIMIT $1`,
        [limit]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  // ── GET /api/logs/stream (SSE) ──────────────────────────────────────────────
  app.get("/api/logs/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    res.write(`data: {"type":"connected"}\n\n`);
    sseClients.add(res);

    req.on("close", () => sseClients.delete(res));
  });

  // ── TRACKING ENDPOINTS ──────────────────────────────────────────────────────
  // These are the endpoints that external sites embed to track real traffic.

  /**
   * GET /track/:targetId
   * Returns a 1×1 transparent GIF (tracking pixel).
   * Embed as: <img src="https://your-server/track/TARGET_ID" style="display:none">
   */
  app.get("/track/:targetId", async (req, res) => {
    // Respond immediately with pixel — never block the tracked page
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.end(TRANSPARENT_GIF);

    // Record in background
    if (!isDbConnected) return;

    try {
      const { targetId } = req.params;

      // Verify target exists
      const targetCheck = await pool.query(
        "SELECT id, target, type FROM targets WHERE id = $1",
        [targetId]
      );
      if (!targetCheck.rowCount || targetCheck.rowCount === 0) return;
      const targetRow = targetCheck.rows[0];

      const sourceIp = getClientIp(req);
      const geo = resolveGeo(sourceIp);
      const userAgent = req.headers["user-agent"] || null;
      const referer = req.headers["referer"] || req.headers["referrer"] || null;

      const logResult = await pool.query(
        `INSERT INTO access_logs
           (target_id, source_ip, user_agent, referer, method, path, country, city, lat, lng)
         VALUES ($1, $2, $3, $4, 'GET', '/track', $5, $6, $7, $8)
         RETURNING
           id,
           target_id  AS "targetId",
           source_ip  AS "sourceIp",
           user_agent AS "userAgent",
           referer,
           timestamp,
           method,
           path,
           country,
           city,
           lat,
           lng`,
        [
          targetId,
          sourceIp,
          userAgent,
          referer,
          geo.country,
          geo.city,
          geo.lat,
          geo.lng,
        ]
      );

      const newLog = {
        ...logResult.rows[0],
        target: targetRow.target,
        targetType: targetRow.type,
      };

      broadcast({ type: "new_log", data: newLog });
      console.log(`📍 Track hit: target="${targetRow.target}" ip="${sourceIp}" country="${geo.country}"`);
    } catch (err) {
      console.error("Track error:", err);
    }
  });

  /**
   * GET /track/:targetId/js
   * Returns a JavaScript snippet that records a hit with referrer + UA.
   * Embed as: <script src="https://your-server/track/TARGET_ID/js" async></script>
   */
  app.get("/track/:targetId/js", async (req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

    // Minimal JS — just fires a beacon back to /track/:targetId/beacon
    const { targetId } = req.params;
    res.end(`(function(){
  var d=document,b=navigator.sendBeacon||function(u){var x=new XMLHttpRequest();x.open('POST',u,true);x.send();};
  b('/track/${targetId}/beacon?r='+encodeURIComponent(d.referrer||'')+'&t='+encodeURIComponent(d.title||''));
})();`);

    // Also record this request itself as a hit
    if (!isDbConnected) return;
    try {
      const targetCheck = await pool.query(
        "SELECT id, target, type FROM targets WHERE id = $1",
        [targetId]
      );
      if (!targetCheck.rowCount || targetCheck.rowCount === 0) return;
      const targetRow = targetCheck.rows[0];

      const sourceIp = getClientIp(req);
      const geo = resolveGeo(sourceIp);
      const userAgent = req.headers["user-agent"] || null;
      const referer = req.headers["referer"] || req.headers["referrer"] || null;

      const logResult = await pool.query(
        `INSERT INTO access_logs
           (target_id, source_ip, user_agent, referer, method, path, country, city, lat, lng)
         VALUES ($1, $2, $3, $4, 'GET', '/track/js', $5, $6, $7, $8)
         RETURNING id, target_id AS "targetId", source_ip AS "sourceIp",
                   user_agent AS "userAgent", referer, timestamp, method, path,
                   country, city, lat, lng`,
        [targetId, sourceIp, userAgent, referer, geo.country, geo.city, geo.lat, geo.lng]
      );
      broadcast({
        type: "new_log",
        data: { ...logResult.rows[0], target: targetRow.target, targetType: targetRow.type },
      });
    } catch (err) {
      console.error("Track JS error:", err);
    }
  });

  /**
   * POST /track/:targetId/beacon
   * Called by the JS snippet via navigator.sendBeacon.
   * Records with referer from query param (page-level referer) and UA.
   */
  app.post("/track/:targetId/beacon", async (req, res) => {
    res.status(204).end();

    if (!isDbConnected) return;
    try {
      const { targetId } = req.params;
      const pageReferer = (req.query.r as string) || null;
      const pageTitle   = (req.query.t as string) || null;

      const targetCheck = await pool.query(
        "SELECT id, target, type FROM targets WHERE id = $1",
        [targetId]
      );
      if (!targetCheck.rowCount || targetCheck.rowCount === 0) return;
      const targetRow = targetCheck.rows[0];

      const sourceIp = getClientIp(req);
      const geo = resolveGeo(sourceIp);
      const userAgent = req.headers["user-agent"] || null;
      const referer = pageReferer || req.headers["referer"] || null;
      const pathLabel = pageTitle ? `/page:${pageTitle.slice(0, 120)}` : "/track/beacon";

      const logResult = await pool.query(
        `INSERT INTO access_logs
           (target_id, source_ip, user_agent, referer, method, path, country, city, lat, lng)
         VALUES ($1, $2, $3, $4, 'GET', $5, $6, $7, $8, $9)
         RETURNING id, target_id AS "targetId", source_ip AS "sourceIp",
                   user_agent AS "userAgent", referer, timestamp, method, path,
                   country, city, lat, lng`,
        [targetId, sourceIp, userAgent, referer, pathLabel, geo.country, geo.city, geo.lat, geo.lng]
      );
      broadcast({
        type: "new_log",
        data: { ...logResult.rows[0], target: targetRow.target, targetType: targetRow.type },
      });
      console.log(`📍 Beacon hit: target="${targetRow.target}" ip="${sourceIp}" country="${geo.country}"`);
    } catch (err) {
      console.error("Beacon error:", err);
    }
  });

  // ── Admin login ─────────────────────────────────────────────────────────────
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "admin") {
      res.json({ token: "mock-admin-token" });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // ── Vite / Static ───────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
