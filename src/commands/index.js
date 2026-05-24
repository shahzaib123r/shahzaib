import { config } from "../../config.js";
import { getStats, getRecentDeleted, logVVRecovery } from "../database/db.js";
import {
  getMsgType, getInnerMsg, downloadAndSave, sendMedia,
  getTextContent, isViewOnce, isOwner, formatUptime, getTimestamp,
} from "../utils/helpers.js";
import { logger } from "../utils/logger.js";
import { getContentType } from "@whiskeysockets/baileys";

const START_TIME = Date.now();

// ─── Command Registry ─────────────────────────────────────────
const commands = new Map();

function addCmd(names, ownerOnly, fn) {
  const arr = Array.isArray(names) ? names : [names];
  arr.forEach((n) => commands.set(n.toLowerCase(), { fn, ownerOnly }));
}

// ─── .ping ────────────────────────────────────────────────────
addCmd("ping", false, async (sock, msg) => {
  const start = Date.now();
  await sock.sendMessage(msg.key.remoteJid, { text: "🏓 Pong!" }, { quoted: msg });
  const latency = Date.now() - start;
  await sock.sendMessage(msg.key.remoteJid, { text: `⚡ *Latency:* ${latency}ms` }, { quoted: msg });
});

// ─── .alive ───────────────────────────────────────────────────
addCmd(["alive", "on"], false, async (sock, msg) => {
  const uptime = formatUptime(Date.now() - START_TIME);

  await sock.sendMessage(
    msg.key.remoteJid,
    {
      text:
        `╔━━━〔 🤖 ${config.BOT_NAME} 🤖 〕━━━╗\n` +
        `┃\n` +
        `┃ ✦ Status   : Online ✅\n` +
        `┃ ✦ Uptime   : ${uptime}\n` +
        `┃ ✦ Owner    : ${config.OWNER_NAME}\n` +
        `┃ ✦ Time     : ${getTimestamp()}\n` +
        `┃\n` +
        `╚━━━━━━━━━━━━━━━━━━━━╝\n\n` +

        `╭─〔 🌟 INFORMATION 🌟 〕─╮\n` +
        `│ Prefix : ${config.PREFIX}\n` +
        `│ Mode   : Public\n` +
        `│ Speed  : Fast ⚡\n` +
        `╰────────────────────╯\n\n` +

        `✨ Type *${config.PREFIX}help* to view all commands`
    },
    { quoted: msg }
  );
});

// ─── .help ────────────────────────────────────────────────────
addCmd(["menu"], false, async (sock, msg) => {
  const ownerTag = isOwner(msg.key.participant || msg.key.remoteJid)
    ? `\n╔══════════════════════╗\n` +
      `║     👑 OWNER ZONE 👑     ║\n` +
      `╚══════════════════════╝\n` +
      `➤ .stats\n` +
      `➤ .logs\n` +
      `➤ .antidelete on/off\n` +
      `➤ .statusview on/off\n`
    : "";

  await sock.sendMessage(
    msg.key.remoteJid,
    {
      text:
        `╔═━━━═══❖═══━━━═╗\n` +
        `      🤖 ${config.BOT_NAME} 🤖\n` +
        `╚═━━━═══❖═══━━━═╝\n\n` +

        `╭───────────────◆\n` +
        `│ 👑 Owner : ${config.OWNER_NAME}\n` +
        `│ ⚡ Prefix : .\n` +
        `│ 🚀 Status : Online\n` +
        `│ 🕒 Runtime : Active\n` +
        `╰───────────────◆\n\n` +

        `╔══════════════════════╗\n` +
        `║     🌟 GENERAL MENU 🌟     ║\n` +
        `╚══════════════════════╝\n` +
        `➤ .ping\n` +
        `➤ .alive\n` +
        `➤ .menu\n` +
        `➤ .info\n` +
        `➤ .owner\n\n` +

        `╔══════════════════════╗\n` +
        `║      🎨 MEDIA MENU 🎨      ║\n` +
        `╚══════════════════════╝\n` +
        `➤ .vv\n` +
        `➤ .sticker\n\n` +

        `╔══════════════════════╗\n` +
        `║      👥 GROUP MENU 👥      ║\n` +
        `╚══════════════════════╝\n` +
        `➤ .tagall\n` +
        `➤ .groupinfo\n` +

        ownerTag +

        `\n╭───────────────◆\n` +
        `│ ✨ Powered By ${config.BOT_NAME}\n` +
        `│ 💎 Fast • Secure • Powerful\n` +
        `╰───────────────◆`
    },
    { quoted: msg }
  );
});

// ─── .info ────────────────────────────────────────────────────
addCmd("info", false, async (sock, msg) => {
  await sock.sendMessage(
    msg.key.remoteJid,
    {
      text:
        `╔═━━━═══❖═══━━━═╗\n` +
        `       🤖 BOT INFORMATION 🤖\n` +
        `╚═━━━═══❖═══━━━═╝\n\n` +

        `╭───────────────◆\n` +
        `│ 🤖 Bot Name : ${config.BOT_NAME}\n` +
        `│ 👑 Owner    : ${config.OWNER_NAME}\n` +
        `│ 📌 Prefix   : ${config.PREFIX}\n` +
        `│ 🌐 Platform : Node.js + Baileys\n` +
        `╰───────────────◆\n\n` +

        `╔══════════════════════╗\n` +
        `║       ⚙️ SETTINGS ⚙️       ║\n` +
        `╚══════════════════════╝\n` +
        `➤ 🛡️ Anti-Delete : ${config.ANTI_DELETE ? "ON ✅" : "OFF ❌"}\n` +
        `➤ 📺 Status View : ${config.AUTO_STATUS_VIEW ? "ON ✅" : "OFF ❌"}\n` +
        `➤ 💬 Status React: ${config.AUTO_STATUS_REACT ? "ON ✅" : "OFF ❌"}\n\n` +

        `╭───────────────◆\n` +
        `│ ⚡ Speed : Fast & Stable\n` +
        `│ 💎 Version : Premium Edition\n` +
        `╰───────────────◆`
    },
    { quoted: msg }
  );
});

// ─── .owner ───────────────────────────────────────────────────
addCmd("owner", false, async (sock, msg) => {
  await sock.sendMessage(
    msg.key.remoteJid,
    {
      text:
        `╔═━━━═══❖═══━━━═╗\n` +
        `        👑 BOT OWNER 👑\n` +
        `╚═━━━═══❖═══━━━═╝\n\n` +

        `╭───────────────◆\n` +
        `│ 👤 Name   : ${config.OWNER_NAME}\n` +
        `│ 📱 Number : +${config.OWNER_NUMBER}\n` +
        `╰───────────────◆\n\n` +

        `✨ Feel free to contact for help & support`
      ,
      mentions: [config.OWNER_NUMBER + "@s.whatsapp.net"],
    },
    { quoted: msg }
  );
});

// ─── .stats (owner only) ──────────────────────────────────────
addCmd("stats", true, async (sock, msg) => {
  const stats = getStats();
  const uptime = formatUptime(Date.now() - START_TIME);
  await sock.sendMessage(msg.key.remoteJid, {
    text:
      `╔═━━━═══❖═══━━━═╗\n` +
      `       📊 BOT STATISTICS 📊\n` +
      `╚═━━━═══❖═══━━━═╝\n\n` +

      `⏱️ *Uptime:* ${uptime}\n` +
      `🗑️ *Deleted Msgs:* ${stats.deleted_count}\n` +
      `📺 *Statuses Viewed:* ${stats.status_viewed}\n` +
      `👁️ *VV Recovered:* ${stats.vv_recovered}\n` +
      `🕐 *Time:* ${getTimestamp()}\n`
  }, { quoted: msg });
});

// ─── .logs (owner only) ───────────────────────────────────────
addCmd("logs", true, async (sock, msg) => {
  const rows = getRecentDeleted(5);
  if (!rows.length) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: "╔══❖══╗\n📭 No Deleted Logs Found\n╚══❖══╝"
    }, { quoted: msg });
    return;
  }

  const text = rows.map((r, i) =>
    `╭──〔 ${i + 1} 〕──╮\n` +
    `👤 ${r.sender_name}\n` +
    `👥 ${r.group_name}\n` +
    `📌 ${r.msg_type}\n` +
    `📝 ${r.content || "(media)"}\n` +
    `🕐 ${r.timestamp}\n` +
    `╰────────────╯`
  ).join("\n\n");

  await sock.sendMessage(msg.key.remoteJid, {
    text:
      `╔═━━━═══❖═══━━━═╗\n` +
      `       📋 RECENT LOGS 📋\n` +
      `╚═━━━═══❖═══━━━═╝\n\n` +
      text
  }, { quoted: msg });
});

// ─── .vv (View Once Recovery) ─────────────────────────────────
addCmd("vv", false, async (sock, msg, args, messageCache) => {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;

  if (!quoted) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: `❌ Kisi View Once message par reply karke *${config.PREFIX}vv* likhein.`
    }, { quoted: msg });
    return;
  }

  const type = Object.keys(quoted)[0];

  // ── Proper ViewOnce detection ──
  const isViewOnce =
    type === "viewOnceMessage" ||
    type === "viewOnceMessageV2";

  if (!isViewOnce) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: "❌ Yeh message View Once nahi hai."
    }, { quoted: msg });
    return;
  }

  try {
    // ── IMPORTANT FIX: unwrap correct message ──
    const innerMsg =
      quoted.viewOnceMessage?.message ||
      quoted.viewOnceMessageV2?.message;

    if (!innerMsg) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "❌ View Once media extract nahi ho saki."
      }, { quoted: msg });
      return;
    }

    // ── Fake message for downloader ──
    const fakeMsg = {
      key: msg.key,
      message: innerMsg,
    };

    const cachedMsg = messageCache.get(ctx.stanzaId);
    const targetMsg = cachedMsg || fakeMsg;

    const media = await downloadAndSave(sock, targetMsg, "viewonce");

    if (!media) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "❌ Media download nahi ho saki."
      }, { quoted: msg });
      return;
    }

    const requester = (msg.key.participant || msg.key.remoteJid)
      .replace("@s.whatsapp.net", "");

    logger.cmd(`👁️ .vv used by ${requester}`);

    await sendMedia(
      sock,
      msg.key.remoteJid,
      media.buffer,
      media.mimetype,
      media.innerType,
      "👁️ *View Once Recovered*",
      msg
    );

  } catch (err) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: `❌ Error: ${err.message}`
    }, { quoted: msg });
  }
});

// ─── .sticker ─────────────────────────────────────────────────
addCmd(["sticker", "s"], false, async (sock, msg, args, messageCache) => {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const stanzaId = ctx?.stanzaId;
  const cachedMsg = stanzaId ? messageCache.get(stanzaId) : null;
  const targetMsg = cachedMsg || msg;
  const type = getMsgType(targetMsg);

  if (type !== "imageMessage" && type !== "videoMessage") {
    await sock.sendMessage(msg.key.remoteJid, {
      text: "❌ Reply to image/video first."
    }, { quoted: msg });
    return;
  }

  const media = await downloadAndSave(sock, targetMsg, "stickers");
  if (!media) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: "❌ Failed to download media."
    }, { quoted: msg });
    return;
  }

  await sock.sendMessage(msg.key.remoteJid, {
    sticker: media.buffer
  }, { quoted: msg });
});
// ─── .tagall (group only) ─────────────────────────────────────
addCmd("tagall", false, async (sock, msg, args) => {
  const jid = msg.key.remoteJid;

  if (!jid.endsWith("@g.us")) {
    await sock.sendMessage(jid, {
      text: "❌ Only for groups."
    }, { quoted: msg });
    return;
  }

  try {
    const meta = await sock.groupMetadata(jid);
    const mentions = meta.participants.map((p) => p.id);
    const tagText = args.join(" ") || "📢 ATTENTION EVERYONE";

    const text =
      `╔═━━━═══❖═══━━━═╗\n` +
      `        📢 GROUP ALERT 📢\n` +
      `╚═━━━═══❖═══━━━═╝\n\n` +
      `${tagText}\n\n` +
      mentions.map(m => `➤ @${m.replace("@s.whatsapp.net", "")}`).join("\n");

    await sock.sendMessage(jid, { text, mentions }, { quoted: msg });

  } catch {
    await sock.sendMessage(jid, { text: "❌ Failed to fetch group info." }, { quoted: msg });
  }
});

// ─── .groupinfo ───────────────────────────────────────────────
addCmd("groupinfo", false, async (sock, msg) => {
  const jid = msg.key.remoteJid;

  if (!jid.endsWith("@g.us")) {
    await sock.sendMessage(jid, {
      text: "❌ Only for groups."
    }, { quoted: msg });
    return;
  }

  try {
    const meta = await sock.groupMetadata(jid);
    const admins = meta.participants
      .filter((p) => p.admin)
      .map((p) => `+${p.id.replace("@s.whatsapp.net", "")}`)
      .join(", ");

    await sock.sendMessage(jid, {
      text:
        `╔═━━━═══❖═══━━━═╗\n` +
        `       👥 GROUP INFO 👥\n` +
        `╚═━━━═══❖═══━━━═╝\n\n` +
        `📌 Name: ${meta.subject}\n` +
        `🆔 JID: ${jid}\n` +
        `👤 Members: ${meta.participants.length}\n` +
        `👑 Admins: ${admins || "N/A"}\n` +
        `📅 Created: ${new Date(meta.creation * 1000).toLocaleDateString("en-PK")}\n` +
        (meta.desc ? `📝 Desc: ${meta.desc}` : "")
    }, { quoted: msg });

  } catch {
    await sock.sendMessage(jid, {
      text: "❌ Failed to fetch group info."
    }, { quoted: msg });
  }
});

// ─── .antidelete toggle (owner only) ─────────────────────────
addCmd("antidelete", true, async (sock, msg, args) => {
  const val = args[0]?.toLowerCase();

  if (val === "on") {
    config.ANTI_DELETE = true;
    await sock.sendMessage(msg.key.remoteJid, {
      text:
        `╔═━━━═══❖═══━━━═╗\n` +
        `      🛡️ ANTI-DELETE SYSTEM 🛡️\n` +
        `╚═━━━═══❖═══━━━═╝\n\n` +
        `✅ Status: ENABLED\n` +
        `💾 Messages are now being saved`
    }, { quoted: msg });

  } else if (val === "off") {
    config.ANTI_DELETE = false;
    await sock.sendMessage(msg.key.remoteJid, {
      text:
        `╔═━━━═══❖═══━━━═╗\n` +
        `      🛡️ ANTI-DELETE SYSTEM 🛡️\n` +
        `╚═━━━═══❖═══━━━═╝\n\n` +
        `❌ Status: DISABLED\n` +
        `⚠️ Protection turned off`
    }, { quoted: msg });

  } else {
    await sock.sendMessage(msg.key.remoteJid, {
      text:
        `╔═━━━═══❖═══━━━═╗\n` +
        `      🛡️ ANTI-DELETE SYSTEM 🛡️\n` +
        `╚═━━━═══❖═══━━━═╝\n\n` +
        `ℹ️ Current Status: ${config.ANTI_DELETE ? "ON ✅" : "OFF ❌"}\n` +
        `📌 Use: .antidelete on/off`
    }, { quoted: msg });
  }
});

// ─── .statusview toggle (owner only) ─────────────────────────
addCmd("statusview", true, async (sock, msg, args) => {
  const val = args[0]?.toLowerCase();

  if (val === "on") {
    config.AUTO_STATUS_VIEW = true;
    await sock.sendMessage(msg.key.remoteJid, {
      text:
        `╔═━━━═══❖═══━━━═╗\n` +
        `     👁️ STATUS VIEW SYSTEM 👁️\n` +
        `╚═━━━═══❖═══━━━═╝\n\n` +
        `✅ Status View: ENABLED\n` +
        `📡 Auto watching active`
    }, { quoted: msg });

  } else if (val === "off") {
    config.AUTO_STATUS_VIEW = false;
    await sock.sendMessage(msg.key.remoteJid, {
      text:
        `╔═━━━═══❖═══━━━═╗\n` +
        `     👁️ STATUS VIEW SYSTEM 👁️\n` +
        `╚═━━━═══❖═══━━━═╝\n\n` +
        `❌ Status View: DISABLED\n` +
        `⚠️ Auto watching stopped`
    }, { quoted: msg });

  } else {
    await sock.sendMessage(msg.key.remoteJid, {
      text:
        `╔═━━━═══❖═══━━━═╗\n` +
        `     👁️ STATUS VIEW SYSTEM 👁️\n` +
        `╚═━━━═══❖═══━━━═╝\n\n` +
        `ℹ️ Current: ${config.AUTO_STATUS_VIEW ? "ON ✅" : "OFF ❌"}`
    }, { quoted: msg });
  }
});

// ─── Command Dispatcher ───────────────────────────────────────
export async function handleCommand(sock, msg, messageCache) {
  const body = (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    ""
  ).trim();

  if (!body.startsWith(config.PREFIX)) return false;

  const [rawCmd, ...args] = body.slice(config.PREFIX.length).trim().split(/\s+/);
  const cmdName = rawCmd.toLowerCase();
  const cmd = commands.get(cmdName);

  if (!cmd) return false;

  const senderJid = msg.key.participant || msg.key.remoteJid;

  if (cmd.ownerOnly && !isOwner(senderJid)) {
    await sock.sendMessage(msg.key.remoteJid, {
      text: "🚫 OWNER ONLY COMMAND"
    }, { quoted: msg });
    return true;
  }

  logger.cmd(`${config.PREFIX}${cmdName} by ${senderJid.replace("@s.whatsapp.net", "")}`);

  try {
    await cmd.fn(sock, msg, args, messageCache);
  } catch (err) {
    logger.error(`Command ${cmdName} failed: ${err.message}`);
    await sock.sendMessage(msg.key.remoteJid, {
      text:
        `❌ ERROR OCCURRED\n\n` +
        `${err.message}`
    }, { quoted: msg });
  }

  return true;
}
