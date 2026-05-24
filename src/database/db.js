import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../database/bot.db");

// Ensure database directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS deleted_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    msg_id      TEXT,
    sender_name TEXT,
    sender_jid  TEXT,
    group_name  TEXT,
    group_jid   TEXT,
    msg_type    TEXT,
    content     TEXT,
    media_path  TEXT,
    timestamp   TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS status_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_jid  TEXT,
    sender_name TEXT,
    media_path  TEXT,
    msg_type    TEXT,
    viewed_at   TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vv_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    requester   TEXT,
    chat_jid    TEXT,
    media_path  TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bot_stats (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Initialize stats
db.prepare("INSERT OR IGNORE INTO bot_stats (key, value) VALUES (?, ?)").run("start_time", new Date().toISOString());
db.prepare("INSERT OR IGNORE INTO bot_stats (key, value) VALUES (?, ?)").run("deleted_count", "0");
db.prepare("INSERT OR IGNORE INTO bot_stats (key, value) VALUES (?, ?)").run("status_viewed", "0");
db.prepare("INSERT OR IGNORE INTO bot_stats (key, value) VALUES (?, ?)").run("vv_recovered", "0");

export function logDeletedMessage({ msgId, senderName, senderJid, groupName, groupJid, msgType, content, mediaPath }) {
  const timestamp = new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" });
  db.prepare(`
    INSERT INTO deleted_messages (msg_id, sender_name, sender_jid, group_name, group_jid, msg_type, content, media_path, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(msgId, senderName, senderJid, groupName, groupJid, msgType, content || "", mediaPath || null, timestamp);
  incrementStat("deleted_count");
}

export function logStatusView({ senderJid, senderName, mediaPath, msgType }) {
  const viewedAt = new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" });
  db.prepare(`
    INSERT INTO status_logs (sender_jid, sender_name, media_path, msg_type, viewed_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(senderJid, senderName, mediaPath || null, msgType, viewedAt);
  incrementStat("status_viewed");
}

export function logVVRecovery({ requester, chatJid, mediaPath }) {
  db.prepare(`
    INSERT INTO vv_logs (requester, chat_jid, media_path) VALUES (?, ?, ?)
  `).run(requester, chatJid, mediaPath || null);
  incrementStat("vv_recovered");
}

export function getStats() {
  const rows = db.prepare("SELECT key, value FROM bot_stats").all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function getRecentDeleted(limit = 10) {
  return db.prepare("SELECT * FROM deleted_messages ORDER BY created_at DESC LIMIT ?").all(limit);
}

function incrementStat(key) {
  db.prepare("UPDATE bot_stats SET value = CAST(value AS INTEGER) + 1 WHERE key = ?").run(key);
}
