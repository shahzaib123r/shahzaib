import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "database", "logs.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS deleted_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_name TEXT,
    sender_number TEXT,
    group_name TEXT,
    message_type TEXT,
    content TEXT,
    media_path TEXT,
    timestamp TEXT
  )
`);

export function logDeletedMessage({ senderName, senderNumber, groupName, messageType, content, mediaPath }) {
  const timestamp = new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" });
  db.prepare(
    `INSERT INTO deleted_messages (sender_name, sender_number, group_name, message_type, content, media_path, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(senderName, senderNumber, groupName, messageType, content, mediaPath || null, timestamp);
}
