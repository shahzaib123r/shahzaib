import { config } from "../../config.js";
import { logStatusView } from "../database/db.js";
import { getMsgType, downloadAndSave, MEDIA_TYPES } from "../utils/helpers.js";
import { logger } from "../utils/logger.js";

export async function handleStatus(sock, msg) {
  if (msg.key.remoteJid !== "status@broadcast") return;

  const senderJid = msg.key.participant || msg.key.remoteJid;
  const senderName = msg.pushName || senderJid.replace("@s.whatsapp.net", "");
  const msgType = getMsgType(msg);

  logger.event(
    `╔══════════════════════╗\n` +
    `║     📺 STATUS VIEW     ║\n` +
    `╚══════════════════════╝\n` +
    `👤 From : ${senderName}\n` +
    `📂 Type : ${msgType}`
  );

  // ── Auto View ────────────────────────────────────────────────
  if (config.AUTO_STATUS_VIEW) {
    try {
      await sock.readMessages([msg.key]);
    } catch {}
  }

  // ── Auto React ───────────────────────────────────────────────
  if (config.AUTO_STATUS_REACT) {
    try {
      const emojis = config.STATUS_REACT_EMOJI || ["🔥", "💯", "⚡", "💎"];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];

      await sock.sendMessage(msg.key.remoteJid, {
        react: { text: emoji, key: msg.key },
      });
    } catch {}
  }

  // ── Auto Save ────────────────────────────────────────────────
  let mediaPath = null;

  if (config.AUTO_STATUS_SAVE && MEDIA_TYPES.includes(msgType)) {
    try {
      const media = await downloadAndSave(sock, msg, "status");
      if (media) mediaPath = media.filepath;
    } catch {}
  }

  logStatusView({
    senderJid,
    senderName,
    mediaPath,
    msgType,
  });
}