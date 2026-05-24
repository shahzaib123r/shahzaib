import qrcode from "qrcode-terminal";
import { DisconnectReason } from "@whiskeysockets/baileys";
import { config } from "../../config.js";
import { logger } from "../utils/logger.js";

export function handleConnection(sock, startBot) {
  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    
    if (qr) {
      console.clear();
      console.log("\n");
      qrcode.generate(qr, { small: true });

      logger.info(
        "╔════════════════════════════╗\n" +
        "║   📱 SCAN QR TO CONNECT   ║\n" +
        "╚════════════════════════════╝\n" +
        "➡ Settings → Linked Devices\n" +
        "➡ Tap 'Link a Device'"
      );
    }

    if (connection === "open") {
      logger.success(
        `╔════════════════════════════╗\n` +
        `║   🤖 BOT CONNECTED 🤖   ║\n` +
        `╚════════════════════════════╝\n` +
        `✨ Name  : ${config.BOT_NAME}\n` +
        `👑 Owner : +${config.OWNER_NUMBER}\n` +
        `🚀 Status: Online & Active`
      );

      if (config.AUTO_ONLINE) {
        setInterval(async () => {
          try {
            await sock.sendPresenceUpdate("available");
          } catch {}
        }, 15000);
      }
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        logger.warn(
          `⚠️ Connection closed (code: ${code})\n🔄 Reconnecting...`
        );
        setTimeout(startBot, 3000);
      } else {
        logger.error(
          `╔════════════════════════════╗\n` +
          `║      🚪 LOGGED OUT 🚪      ║\n` +
          `╚════════════════════════════╝\n` +
          `📁 Delete auth_info folder\n` +
          `🔁 Then restart bot`
        );
        process.exit(1);
      }
    }

  });
}