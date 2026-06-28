// utils/announceScheduler.js
// 每分鐘檢查一次，在禮拜六日 20:25（台灣時間 UTC+8）發送百業戰公告

import { EmbedBuilder } from "discord.js";
import { getAllEnabledConfigs, setGuildConfig } from "./announceConfig.js";

const TW_OFFSET_MS = 8 * 60 * 60 * 1000;

export function startAnnounceScheduler(client) {
  console.log("⏰  百業戰公告排程已啟動（週六日 20:25 台灣時間）");

  setInterval(async () => {
    const tw     = new Date(Date.now() + TW_OFFSET_MS);
    const day    = tw.getUTCDay();
    const hour   = tw.getUTCHours();
    const minute = tw.getUTCMinutes();

    // 週六(6) 或 週日(0)，20:25
    if (!((day === 6 || day === 0) && hour === 20 && minute === 25)) return;

    const firedKey = `${tw.getUTCFullYear()}-${tw.getUTCMonth()}-${tw.getUTCDate()}-2025`;

    const channelId = process.env.ANNOUNCE_CHANNEL_ID;
    const roleId    = process.env.ANNOUNCE_ROLE_ID;

    if (!channelId) {
      console.warn("⚠️  ANNOUNCE_CHANNEL_ID 未設定，跳過公告");
      return;
    }

    try {
      const configs = await getAllEnabledConfigs();

      for (const cfg of configs) {
        if (cfg.lastFired === firedKey) continue; // 本分鐘已發過

        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased()) {
          console.warn(`⚠️  [${cfg.guildId}] 頻道不是文字頻道或無法取得`);
          continue;
        }

        const roleMention = roleId ? `<@&${roleId}>` : "";

        await channel.send({
          content: roleMention || undefined,
          embeds:  [buildAnnounceEmbed()],
        });

        await setGuildConfig(cfg.guildId, { lastFired: firedKey });
        console.log(`📣  [${cfg.guildId}] 百業戰公告已發送`);
      }
    } catch (err) {
      console.error("❌  公告發送失敗：", err.message);
    }
  }, 60 * 1000);
}

function buildAnnounceEmbed() {
  return new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle("⚔️　百業戰提醒！")
    .setDescription(
      "## 即將開始，請前往準備！\n" +
      "趕快揪隊友一起衝！"
    )
    .setTimestamp()
    .setFooter({ text: "每週六、日 20:25 自動提醒" });
}
