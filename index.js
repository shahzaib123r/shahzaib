import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import pino from "pino";
import chalk from "chalk";

import { config } from "./config.js";
import { handleConnection } from "./src/handlers/connectionHandler.js";
import { handleAntiDelete } from "./src/handlers/antiDelete.js";
import { handleStatus } from "./src/handlers/statusHandler.js";
import { handleCommand } from "./src/commands/index.js";
import { logger } from "./src/utils/logger.js";

// ─── Startup Banner ───────────────────────────────────────────
console.log(chalk.cyan(`
╔══════════════════════════════════════╗
║                                      ║
║   🤖  ${chalk.bold(config.BOT_NAME.padEnd(28))}  ║
║   👑  Owner: ${config.OWNER_NAME.padEnd(23)}  ║
║   📌  Prefix: ${config.PREFIX.padEnd(22)}  ║
║                                      ║
╚══════════════════════════════════════╝
`));

// ─── Message Cache ────────────────────────────────────────────
// Stores all received messages for anti-delete & .vv recovery
const messageCache = new Map();

function cacheMessage(msg) {
  if (!msg?.message) return;
  messageCache.set(msg.key.id, msg);
  if (messageCache.size > config.MAX_CACHE_SIZE) {
    messageCache.delete(messageCache.keys().next().value);
  }
}

// ─── Bot Start ────────────────────────────────────────────────
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  logger.info(`Using Baileys v${version.join(".")}`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
    },
    markOnlineOnConnect: config.AUTO_ONLINE,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
  });

  // ── Credentials save ────────────────────────────────────────
  sock.ev.on("creds.update", saveCreds);

  // ── Connection handling ──────────────────────────────────────
  handleConnection(sock, startBot);

  // ── Message upsert ───────────────────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    for (const msg of messages) {
      // Always cache every message
      cacheMessage(msg);

      // Skip if no message content
      if (!msg.message) continue;

      // Auto read DMs
      if (config.AUTO_READ_DM && !msg.key.remoteJid.endsWith("@g.us") && !msg.key.fromMe) {
        try { await sock.readMessages([msg.key]); } catch {}
      }

      // Status handler
      if (msg.key.remoteJid === "status@broadcast") {
        await handleStatus(sock, msg);
        continue;
      }

      // Command handler
      const handled = await handleCommand(sock, msg, messageCache);
      if (handled) continue;

      // Typing indicator for incoming DMs (optional)
      if (config.AUTO_TYPING && !msg.key.fromMe && !msg.key.remoteJid.endsWith("@g.us")) {
        try {
          await sock.sendPresenceUpdate("composing", msg.key.remoteJid);
          setTimeout(() => sock.sendPresenceUpdate("paused", msg.key.remoteJid).catch(() => {}), 2000);
        } catch {}
      }
    }
  });

  // ── Message update (delete detection) ────────────────────────
  sock.ev.on("messages.update", async (updates) => {
    for (const update of updates) {
      await handleAntiDelete(sock, update, messageCache);
    }
  });

  // ── Group participants update ─────────────────────────────────
  sock.ev.on("group-participants.update", async ({ id, participants, action }) => {
    if (action === "add") {
      logger.event(`➕ ${participants.join(", ")} joined ${id}`);
    } else if (action === "remove") {
      logger.event(`➖ ${participants.join(", ")} left ${id}`);
    }
  });

  return sock;
}

// ─── Global error handlers ────────────────────────────────────
process.on("uncaughtException", (err) => logger.error(`Uncaught: ${err.message}`));
process.on("unhandledRejection", (err) => logger.error(`Unhandled: ${err?.message || err}`));

startBot();
