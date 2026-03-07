import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

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
    is_leaderboard_banned INTEGER DEFAULT 0
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

async function startServer() {
  const app = express();
  const PORT = 3000;

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
      const user = db.prepare("SELECT id, username, is_admin FROM users WHERE id = ?").get(Number(userId)) as any;
      if (user) {
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
      res.json({ id: result.lastInsertRowid, username, is_admin: 0 });
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
      if (user.is_banned) {
        return res.status(403).json({ error: "Your account has been banned." });
      }
      res.json({ id: user.id, username: user.username, is_admin: user.is_admin });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Score Endpoints
  app.post("/api/scores", (req, res) => {
    const { user_id, wpm, accuracy, mode } = req.body;
    if (!user_id) return res.status(401).json({ error: "Unauthorized" });
    
    // Check if user is banned
    const user = db.prepare("SELECT is_banned FROM users WHERE id = ?").get(user_id) as any;
    if (!user || user.is_banned) return res.status(403).json({ error: "Forbidden" });

    const stmt = db.prepare("INSERT INTO scores (user_id, wpm, accuracy, mode) VALUES (?, ?, ?, ?)");
    stmt.run(user_id, wpm, accuracy, mode);
    res.json({ success: true });
  });

  app.get("/api/leaderboard", (req, res) => {
    const scores = db.prepare(`
      SELECT u.id, u.username, MAX(s.wpm) as wpm, s.accuracy, s.mode, s.created_at
      FROM scores s
      JOIN users u ON s.user_id = u.id
      WHERE u.is_leaderboard_banned = 0 AND u.is_banned = 0
      GROUP BY u.id
      ORDER BY wpm DESC
      LIMIT 10
    `).all();
    res.json(scores);
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
    const users = db.prepare("SELECT id, username, is_admin, is_banned, is_leaderboard_banned FROM users").all();
    res.json(users);
  });

  app.post("/api/admin/user-action", isAdmin, (req, res) => {
    const { targetUserId, action } = req.body;
    let stmt;
    switch (action) {
      case 'ban':
        stmt = db.prepare("UPDATE users SET is_banned = 1 WHERE id = ?");
        break;
      case 'unban':
        stmt = db.prepare("UPDATE users SET is_banned = 0 WHERE id = ?");
        break;
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
