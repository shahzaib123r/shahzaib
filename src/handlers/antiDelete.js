import { config } from "../../config.js";
import { logDeletedMessage } from "../database/db.js";
import { getMsgType, getTextContent, downloadAndSave, sendMedia, getTimestamp, MEDIA_TYPES } from "../utils/helpers.js";
import { logger } from "../utils/logger.js";

const OWNER_JID = config.OWNER_NUMBER + "@s.whatsapp.net";

export async function handleAntiDelete(sock, update, messageCache) {
  if (!config.ANTI_DELETE) return;

  const { key, update: upd } = update;
  if (upd?.messageStubType !== 1) return; // 1 = REVOKE

  const cachedMsg = messageCache.get(key.id);
  if (!cachedMsg) return;

  // Skip own messages if configured
  if (!config.ANTI_DELETE_SELF && cachedMsg.key.fromMe) return;

  const jid = key.remoteJid;
  const isGroup = jid.endsWith("@g.us");

  if (isGroup && !config.ANTI_DELETE_GROUPS) return;
  if (!isGroup && !config.ANTI_DELETE_DM) return;

  // ── Gather info ──────────────────────────────────────────────
  let groupName = "Private Chat";
  let groupJid = "";
  let senderJid = key.participant || cachedMsg.key.participant || jid;
  let senderNumber = senderJid.replace("@s.whatsapp.net", "");
  let senderName = senderNumber;

  if (isGroup) {
    groupJid = jid;
    try {
      const meta = await sock.groupMetadata(jid);
      groupName = meta.subject;
      const member = meta.participants.find((p) => p.id === senderJid);
      if (member?.name) senderName = member.name;
    } catch {}
  }

  // Try to get name from push name
  if (cachedMsg.pushName) senderName = cachedMsg.pushName;

  const msgType = getMsgType(cachedMsg);
  const textContent = getTextContent(cachedMsg);
  const timestamp = getTimestamp();

  logger.event(`🗑️ Deleted msg by ${senderName} in ${groupName} [${msgType}]`);

  // ── Build notification text ──────────────────────────────────
  const infoText =
  `╔═━━━═══❖═══━━━═╗\n` +
  `     🗑️ MESSAGE DELETED DETECTED 🗑️\n` +
  `╚═━━━═══❖═══━━━═╝\n\n` +

  `╭───────────────◆\n` +
  `│ 👤 Name   : ${senderName}\n` +
  `│ 📱 Number : +${senderNumber}\n` +
  (isGroup
    ? `│ 👥 Group  : ${groupName}\n`
    : `│ 💬 Chat   : Private DM\n`) +
  `│ 📂 Type   : ${msgType?.replace("Message", "") || "Unknown"}\n` +
  `│ 🕐 Time   : ${timestamp}\n` +
  `╰───────────────◆\n\n` +

  (textContent
    ? `╔═━━━═══❖═══━━━═╗\n` +
      `        💬 MESSAGE CONTENT 💬\n` +
      `╚═━━━═══❖═══━━━═╝\n\n` +
      `${textContent}\n\n`
    : "") +

  `╭───────────────◆\n` +
  `│ 🛡️ Anti-Delete System Active\n` +
  `│ 💎 Powered by ${config.BOT_NAME}\n` +
  `╰───────────────◆`;

  // ── Send to owner ────────────────────────────────────────────
  try {
    if (MEDIA_TYPES.includes(msgType)) {
      const media = await downloadAndSave(sock, cachedMsg, "deleted");
      if (media) {
        logDeletedMessage({ msgId: key.id, senderName, senderJid, groupName, groupJid, msgType, content: textContent, mediaPath: media.filepath });
        await sendMedia(sock, OWNER_JID, media.buffer, media.mimetype, media.innerType, infoText);
        return;
      }
    }
    logDeletedMessage({ msgId: key.id, senderName, senderJid, groupName, groupJid, msgType, content: textContent, mediaPath: null });
    await sock.sendMessage(OWNER_JID, { text: infoText });
  } catch (err) {
    logger.error(`Anti-delete send failed: ${err.message}`);
  }
}
