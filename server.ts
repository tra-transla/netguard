import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Pool } from "pg";

const app = express();
const PORT = 3000;

// Setup PostgreSQL connection
const neonDbUrl = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_kvGrWm9gp6LJ@ep-rapid-shadow-aoqs9ui2-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const pool = new Pool({
  connectionString: neonDbUrl,
  ssl: neonDbUrl.includes("neon.tech") || neonDbUrl.includes("sslmode=require") ? {
    rejectUnauthorized: false
  } : undefined
});

let isDbConnected = false;

// Fallback Memory Data
let memoryTargets = [
  { id: "1", target: "192.168.1.1", type: "ip", addedAt: new Date().toISOString() },
  { id: "2", target: "example.com", type: "domain", addedAt: new Date().toISOString() },
];
let memoryLogs: any[] = [];

// Initialize Database Tables
async function initDB() {
  if (!neonDbUrl) {
    console.warn("DATABASE_URL is not set. Cannot connect to Neon. Please add it to your secrets.");
    return;
  }
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
        source_ip VARCHAR(50) NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        method VARCHAR(10) NOT NULL,
        path VARCHAR(255) NOT NULL,
        country VARCHAR(100),
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION
      );
    `);
    console.log("Database initialized successfully.");
    isDbConnected = true;
  } catch (err) {
    console.error("Failed to initialize database:", err);
  }
}

async function startServer() {
  app.use(express.json());

  await initDB();

  // API routes
  app.get("/api/targets", async (req, res) => {
    if (!isDbConnected) {
      return res.json(memoryTargets);
    }
    try {
      const result = await pool.query("SELECT id, target, type, added_at as \"addedAt\" FROM targets ORDER BY added_at DESC");
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch targets" });
    }
  });

  app.post("/api/targets", async (req, res) => {
    const { target, type } = req.body;
    if (!target || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    if (!isDbConnected) {
      console.warn("Database not connected, using memory fallback to add target");
      const newTarget = {
        id: Math.random().toString(36).substring(7),
        target,
        type,
        addedAt: new Date().toISOString()
      };
      memoryTargets.push(newTarget);
      return res.json(newTarget);
    }

    try {
      const result = await pool.query(
        "INSERT INTO targets (target, type) VALUES ($1, $2) RETURNING id, target, type, added_at as \"addedAt\"",
        [target, type]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error("Failed to create target in database:", err);
      res.status(500).json({ error: "Failed to create target" });
    }
  });

  app.delete("/api/targets/:id", async (req, res) => {
    if (!isDbConnected) {
      memoryTargets = memoryTargets.filter(t => t.id !== req.params.id);
      memoryLogs = memoryLogs.filter(l => l.targetId !== req.params.id);
      return res.json({ success: true });
    }
    try {
      await pool.query("DELETE FROM targets WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete target" });
    }
  });

  app.get("/api/logs", async (req, res) => {
    if (!isDbConnected) {
      const logsWithTargets = memoryLogs.map(log => {
        const targetObj = memoryTargets.find(t => t.id === log.targetId);
        return {
          ...log,
          target: targetObj ? targetObj.target : "Unknown",
          targetType: targetObj ? targetObj.type : "Unknown"
        };
      });
      return res.json(logsWithTargets);
    }
    try {
      // LIMIT 1000 for performance on the dashboard
      const result = await pool.query(
        `SELECT l.id, l.target_id as "targetId", t.target, t.type as "targetType", 
                l.source_ip as "sourceIp", l.timestamp, l.method, l.path, 
                l.country, l.lat, l.lng 
         FROM access_logs l
         LEFT JOIN targets t ON l.target_id = t.id
         ORDER BY l.timestamp DESC LIMIT 1000`
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  const clients = new Set<express.Response>();

  app.get("/api/logs/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(`data: {"type": "connected"}\n\n`);

    clients.add(res);

    req.on("close", () => {
      clients.delete(res);
    });
  });

  // Simulate real-time traffic
  setInterval(async () => {
    if (clients.size === 0) return;

    let targetId: string;

    if (!isDbConnected) {
      if (memoryTargets.length === 0) return;
      targetId = memoryTargets[Math.floor(Math.random() * memoryTargets.length)].id;
    } else {
      try {
        const targetQuery = await pool.query("SELECT id FROM targets ORDER BY RANDOM() LIMIT 1");
        if (targetQuery.rowCount === 0) return;
        targetId = targetQuery.rows[0].id;
      } catch (err) {
        console.error("Error querying targets for simulation:", err);
        return;
      }
    }

    const sourceIps = [
      "203.0.113.5", "198.51.100.14", "104.154.21.1", "172.16.254.1", 
      "8.8.8.8", "1.1.1.1", "9.9.9.9", "45.33.22.11", "101.22.33.44", "12.34.56.78"
    ];
    const sourceIp = sourceIps[Math.floor(Math.random() * sourceIps.length)];
    const methods = ["GET", "GET", "GET", "POST", "PUT", "DELETE"];
    const paths = ["/", "/index.html", "/login", "/api/data", "/images/logo.png", "/about", "/dashboard", "/api/users"];
    
    const locs = [
      { country: "United States", lat: 37.7749, lng: -122.4194 },
      { country: "India", lat: 20.5937, lng: 78.9629 },
      { country: "China", lat: 35.8617, lng: 104.1954 },
      { country: "Canada", lat: 56.1304, lng: -106.3468 },
      { country: "Japan", lat: 36.2048, lng: 138.2529 },
      { country: "Germany", lat: 51.1657, lng: 10.4515 },
      { country: "Vietnam", lat: 14.0583, lng: 108.2772 },
      { country: "Brazil", lat: -14.2350, lng: -51.9253 }
    ];
    const loc = locs[Math.floor(Math.random() * locs.length)];
    const method = methods[Math.floor(Math.random() * methods.length)];
    const pathUrl = paths[Math.floor(Math.random() * paths.length)];

    let newLog: any;
    let targetName = "Unknown";
    let targetType = "Unknown";

    if (!isDbConnected) {
      const targetObj = memoryTargets.find(t => t.id === targetId);
      if (targetObj) {
        targetName = targetObj.target;
        targetType = targetObj.type;
      }
      newLog = {
        id: Math.random().toString(36).substring(7),
        targetId,
        target: targetName,
        targetType,
        sourceIp,
        timestamp: new Date().toISOString(),
        method,
        path: pathUrl,
        country: loc.country,
        lat: loc.lat,
        lng: loc.lng
      };
      memoryLogs.push(newLog);
      if (memoryLogs.length > 1000) memoryLogs.shift();
    } else {
      try {
        const targetQueryData = await pool.query("SELECT target, type FROM targets WHERE id = $1", [targetId]);
        if (targetQueryData.rowCount && targetQueryData.rowCount > 0) {
          targetName = targetQueryData.rows[0].target;
          targetType = targetQueryData.rows[0].type;
        }

        const logQuery = await pool.query(
          `INSERT INTO access_logs (target_id, source_ip, method, path, country, lat, lng) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           RETURNING id, target_id as "targetId", source_ip as "sourceIp", timestamp, method, path, country, lat, lng`,
          [targetId, sourceIp, method, pathUrl, loc.country, loc.lat, loc.lng]
        );
        newLog = Object.assign({}, logQuery.rows[0], {
          target: targetName,
          targetType: targetType
        });
      } catch (err) {
        console.error("Error inserting log block:", err);
        return;
      }
    }

    const data = JSON.stringify({ type: "new_log", data: newLog });
    clients.forEach(client => {
      client.write(`data: ${data}\n\n`);
    });
  }, 1500);

  // Basic admin login (mock)
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "admin") {
      res.json({ token: "mock-admin-token" });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
