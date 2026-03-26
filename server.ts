import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("swifttype.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    is_banned INTEGER DEFAULT 0,
    is_leaderboard_banned INTEGER DEFAULT 0,
    ban_reason TEXT,
    ban_expires_at DATETIME
  );
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    wpm INTEGER NOT NULL,
    accuracy INTEGER NOT NULL,
    mode TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Insert admin user
  INSERT OR IGNORE INTO users (username, password, is_admin) VALUES ('KRUSH', 'j93klam3', 1);
  -- Ensure KRUSH is always admin if they already exist
  UPDATE users SET is_admin = 1 WHERE username = 'KRUSH';
`);

// Helper to ensure columns exist (for existing databases)
try {
  db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN is_leaderboard_banned INTEGER DEFAULT 0");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN ban_reason TEXT");
} catch (e) {}
try {
  db.exec("ALTER TABLE users ADD COLUMN ban_expires_at DATETIME");
} catch (e) {}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Auth Endpoints
  app.get("/api/test", (req, res) => {
    res.json({ message: "API is working" });
  });

  app.get("/api/auth/me", (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const user = db.prepare(`
        SELECT id, username, is_admin, is_banned, ban_reason, ban_expires_at 
        FROM users 
        WHERE id = ?
      `).get(Number(userId)) as any;
      
      if (user) {
        // Check if ban has expired
        if (user.is_banned && user.ban_expires_at && new Date(user.ban_expires_at) < new Date()) {
          db.prepare("UPDATE users SET is_banned = 0, ban_reason = NULL, ban_expires_at = NULL WHERE id = ?").run(user.id);
          user.is_banned = 0;
          user.ban_reason = null;
          user.ban_expires_at = null;
        }
        res.json(user);
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/signup", (req, res) => {
    const { username, password } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
      const result = stmt.run(username, password);
      res.json({ id: result.lastInsertRowid, username, is_admin: 0, is_banned: 0 });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password) as any;
    if (user) {
      // Check if ban has expired
      if (user.is_banned && user.ban_expires_at && new Date(user.ban_expires_at) < new Date()) {
        db.prepare("UPDATE users SET is_banned = 0, ban_reason = NULL, ban_expires_at = NULL WHERE id = ?").run(user.id);
        user.is_banned = 0;
        user.ban_reason = null;
        user.ban_expires_at = null;
      }
      
      res.json({ 
        id: user.id, 
        username: user.username, 
        is_admin: user.is_admin,
        is_banned: user.is_banned,
        ban_reason: user.ban_reason,
        ban_expires_at: user.ban_expires_at
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.delete("/api/users/:id/stats", (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId || userId.toString() !== req.params.id) return res.status(401).json({ error: "Unauthorized" });
    
    try {
      db.prepare("DELETE FROM scores WHERE user_id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to reset stats" });
    }
  });

  // Score Endpoints
  app.post("/api/scores", (req, res) => {
    const { user_id, wpm, accuracy, mode } = req.body;
    if (!user_id) return res.status(401).json({ error: "Unauthorized" });
    
    // Check if user is banned
    const user = db.prepare("SELECT is_banned, ban_expires_at FROM users WHERE id = ?").get(user_id) as any;
    if (!user) return res.status(404).json({ error: "User not found" });
    
    if (user.is_banned) {
      if (user.ban_expires_at && new Date(user.ban_expires_at) < new Date()) {
        db.prepare("UPDATE users SET is_banned = 0, ban_reason = NULL, ban_expires_at = NULL WHERE id = ?").run(user_id);
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const stmt = db.prepare("INSERT INTO scores (user_id, wpm, accuracy, mode) VALUES (?, ?, ?, ?)");
    stmt.run(user_id, wpm, accuracy, mode);
    res.json({ success: true });
  });

  app.get("/api/leaderboard", (req, res) => {
    const { mode, limit } = req.query;
    const filterMode = mode && limit ? `${mode} ${limit}` : 'time 30';

    try {
      const scores = db.prepare(`
        SELECT u.id, u.username, s.wpm, s.accuracy, s.mode, s.created_at
        FROM scores s
        JOIN users u ON s.user_id = u.id
        WHERE s.id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY wpm DESC) as rn
            FROM scores
            WHERE mode = ?
          ) WHERE rn = 1
        )
        AND u.is_leaderboard_banned = 0 
        AND (u.is_banned = 0 OR (u.ban_expires_at IS NOT NULL AND u.ban_expires_at < CURRENT_TIMESTAMP))
        ORDER BY s.wpm DESC
        LIMIT 10
      `).all(filterMode);
      res.json(scores);
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Profile Endpoints
  app.get("/api/users/:id/stats", (req, res) => {
    const userId = req.params.id;
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_tests,
        MAX(wpm) as highest_wpm,
        AVG(wpm) as avg_wpm,
        AVG(accuracy) as avg_accuracy
      FROM scores
      WHERE user_id = ?
    `).get(userId) as any;

    const recentTests = db.prepare(`
      SELECT wpm, accuracy, mode, created_at
      FROM scores
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(userId);

    res.json({
      stats: {
        total_tests: stats?.total_tests || 0,
        highest_wpm: stats?.highest_wpm || 0,
        avg_wpm: Math.round(stats?.avg_wpm || 0),
        avg_accuracy: Math.round(stats?.avg_accuracy || 0)
      },
      recent_tests: recentTests
    });
  });

  app.put("/api/users/:id/username", (req, res) => {
    const userId = req.params.id;
    const { newUsername } = req.body;
    
    if (!newUsername || newUsername.trim().length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters long" });
    }

    try {
      db.prepare("UPDATE users SET username = ? WHERE id = ?").run(newUsername.trim(), userId);
      res.json({ success: true, username: newUsername.trim() });
    } catch (err: any) {
      if (err.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Admin Endpoints
  const isAdmin = (req: any, res: any, next: any) => {
    const adminId = req.headers['x-admin-id'];
    if (!adminId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const user = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(Number(adminId)) as any;
      if (user && user.is_admin) {
        next();
      } else {
        res.status(403).json({ error: "Forbidden" });
      }
    } catch (err) {
      console.error("Admin check error:", err);
      res.status(500).json({ error: "Internal server error during admin check" });
    }
  };

  app.get("/api/admin/users", isAdmin, (req, res) => {
    const users = db.prepare("SELECT id, username, is_admin, is_banned, is_leaderboard_banned, ban_reason, ban_expires_at FROM users").all();
    res.json(users);
  });

  app.post("/api/admin/user-action", isAdmin, (req, res) => {
    const { targetUserId, action, reason, duration } = req.body;
    let stmt;
    switch (action) {
      case 'ban':
        let expiresAt = null;
        if (duration && duration !== 'permanent') {
          const now = new Date();
          const d = parseInt(duration);
          if (duration.endsWith('h')) now.setHours(now.getHours() + d);
          else if (duration.endsWith('d')) now.setDate(now.getDate() + d);
          else if (duration.endsWith('m')) now.setMinutes(now.getMinutes() + d);
          expiresAt = now.toISOString();
        }
        stmt = db.prepare("UPDATE users SET is_banned = 1, ban_reason = ?, ban_expires_at = ? WHERE id = ?");
        stmt.run(reason || "No reason provided", expiresAt, targetUserId);
        return res.json({ success: true });
      case 'unban':
        stmt = db.prepare("UPDATE users SET is_banned = 0, ban_reason = NULL, ban_expires_at = NULL WHERE id = ?");
        stmt.run(targetUserId);
        return res.json({ success: true });
      case 'leaderboard_ban':
        stmt = db.prepare("UPDATE users SET is_leaderboard_banned = 1 WHERE id = ?");
        break;
      case 'leaderboard_unban':
        stmt = db.prepare("UPDATE users SET is_leaderboard_banned = 0 WHERE id = ?");
        break;
      case 'mod':
        stmt = db.prepare("UPDATE users SET is_admin = 1 WHERE id = ?");
        break;
      case 'demote':
        stmt = db.prepare("UPDATE users SET is_admin = 0 WHERE id = ?");
        break;
      default:
        return res.status(400).json({ error: "Invalid action" });
    }
    stmt.run(targetUserId);
    res.json({ success: true });
  });

  app.post("/api/admin/announce", isAdmin, (req, res) => {
    const { content } = req.body;
    const stmt = db.prepare("INSERT INTO announcements (content) VALUES (?)");
    stmt.run(content);
    res.json({ success: true });
  });

  app.put("/api/admin/announce/:id", isAdmin, (req, res) => {
    const { content } = req.body;
    const stmt = db.prepare("UPDATE announcements SET content = ? WHERE id = ?");
    stmt.run(content, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/admin/announce/:id", isAdmin, (req, res) => {
    const stmt = db.prepare("DELETE FROM announcements WHERE id = ?");
    stmt.run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/announcements", (req, res) => {
    const announcements = db.prepare("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 5").all();
    res.json(announcements);
  });

  // Catch-all for API routes that don't exist
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
