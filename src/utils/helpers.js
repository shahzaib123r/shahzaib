import { getContentType, downloadMediaMessage } from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR = path.join(__dirname, "../../media");
fs.mkdirSync(MEDIA_DIR, { recursive: true });

// ─── Message Type ────────────────────────────────────────────
export function getMsgType(msg) {
  const content = msg?.message;
  if (!content) return null;
  const type = getContentType(content);
  if (type === "ephemeralMessage") return getContentType(content.ephemeralMessage?.message);
  if (type === "viewOnceMessage") return "viewOnceMessage";
  if (type === "viewOnceMessageV2") return "viewOnceMessageV2";
  return type;
}

// ─── Unwrap inner message ─────────────────────────────────────
export function getInnerMsg(msg) {
  const content = msg?.message;
  if (!content) return null;
  const type = getContentType(content);
  if (type === "ephemeralMessage") return content.ephemeralMessage?.message;
  if (type === "viewOnceMessage") return content.viewOnceMessage?.message;
  if (type === "viewOnceMessageV2") return content.viewOnceMessageV2?.message;
  return content;
}

// ─── Extract text from any message ───────────────────────────
export function getTextContent(msg) {
  const inner = getInnerMsg(msg);
  if (!inner) return "";
  return (
    inner.conversation ||
    inner.extendedTextMessage?.text ||
    inner.imageMessage?.caption ||
    inner.videoMessage?.caption ||
    inner.documentMessage?.caption ||
    ""
  );
}

// ─── Check if message is View Once ───────────────────────────
export function isViewOnce(msg) {
  const type = getMsgType(msg);
  return type === "viewOnceMessage" || type === "viewOnceMessageV2";
}

// ─── Media types list ─────────────────────────────────────────
export const MEDIA_TYPES = ["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"];

const EXT_MAP = {
  imageMessage: "jpg",
  videoMessage: "mp4",
  audioMessage: "ogg",
  documentMessage: "bin",
  stickerMessage: "webp",
};

// ─── Download & save media ────────────────────────────────────
export async function downloadAndSave(sock, msg, subfolder = "deleted") {
  try {
    const logger = { level: "silent", child: () => logger, info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, fatal: () => {} };
    const buffer = await downloadMediaMessage(
      msg,
      "buffer",
      {},
      { logger, reuploadRequest: sock.updateMediaMessage }
    );
    const type = getMsgType(msg);
    const inner = getInnerMsg(msg);
    const innerType = getContentType(inner) || type;
    const ext = EXT_MAP[innerType] || "bin";
    const mimetype = inner?.[innerType]?.mimetype || "application/octet-stream";
    const dir = path.join(MEDIA_DIR, subfolder);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, buffer);
    return { buffer, filepath, mimetype, ext, innerType };
  } catch {
    return null;
  }
}

// ─── Send media to JID ────────────────────────────────────────
export async function sendMedia(sock, jid, buffer, mimetype, type, caption = "", quoted = null) {
  const opts = quoted ? { quoted } : {};
  const typeMap = {
    imageMessage: () => sock.sendMessage(jid, { image: buffer, caption, mimetype }, opts),
    videoMessage: () => sock.sendMessage(jid, { video: buffer, caption, mimetype }, opts),
    audioMessage: () => sock.sendMessage(jid, { audio: buffer, mimetype, ptt: true }, opts),
    stickerMessage: () => sock.sendMessage(jid, { sticker: buffer }, opts),
    documentMessage: () => sock.sendMessage(jid, { document: buffer, mimetype, caption }, opts),
  };
  const sender = typeMap[type];
  if (sender) await sender();
}

// ─── Timestamp ───────────────────────────────────────────────
export function getTimestamp() {
  return new Date().toLocaleString("en-PK", { timeZone: config.TIMEZONE });
}

// ─── Format uptime ───────────────────────────────────────────
export function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// ─── Is owner ────────────────────────────────────────────────
export function isOwner(jid) {
  return jid.replace("@s.whatsapp.net", "") === config.OWNER_NUMBER;
}

// ─── Get sender JID from message ─────────────────────────────
export function getSenderJid(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

// ─── Get sender number ───────────────────────────────────────
export function getSenderNumber(msg) {
  return getSenderJid(msg).replace("@s.whatsapp.net", "").replace("@g.us", "");
}
