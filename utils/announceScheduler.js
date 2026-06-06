// utils/announceScheduler.js
// 每分鐘檢查一次，在禮拜六日 20:30（台灣時間 UTC+8）發送百業戰公告

import { EmbedBuilder } from "discord.js";
import { loadConfig, setGuildConfig } from "./announceConfig.js";

const TW_OFFSET_MS = 8 * 60 * 60 * 1000;

export function startAnnounceScheduler(client) {
  console.log("⏰  百業戰公告排程已啟動（週六日 20:30 台灣時間）");

  setInterval(async () => {
    const tw     = new Date(Date.now() + TW_OFFSET_MS);
    const day    = tw.getUTCDay();     // 0=日, 6=六
    const hour   = tw.getUTCHours();
    const minute = tw.getUTCMinutes();

    if (!((day === 6 || day === 0) && hour === 20 && minute === 25)) return;

    const firedKey = `${tw.getUTCFullYear()}-${tw.getUTCMonth()}-${tw.getUTCDate()}-2030`;

    // 頻道 ID 和身分組 ID 從 .env 讀取（固定值）
    const channelId = process.env.ANNOUNCE_CHANNEL_ID;
    const roleId    = process.env.ANNOUNCE_ROLE_ID;

    if (!channelId) {
      console.warn("⚠️  ANNOUNCE_CHANNEL_ID 未設定，跳過公告");
      return;
    }

    // 用 guildId 追蹤是否開啟、以及防止重複發送
    // 遍歷所有已啟用的伺服器設定
    const allConfigs = loadConfig();

    for (const [guildId, cfg] of Object.entries(allConfigs)) {
      if (!cfg.enabled) continue;
      if (cfg.lastFired === firedKey) continue; // 本分鐘已發過

      try {
        const channel = await client.channels.fetch(channelId);
        if (!channel?.isTextBased()) {
          console.warn(`⚠️  [${guildId}] 頻道 ${channelId} 不是文字頻道`);
          continue;
        }

        const roleMention = roleId ? `<@&${roleId}>` : "";

        await channel.send({
          content: roleMention || undefined,
          embeds:  [buildAnnounceEmbed()],
        });

        setGuildConfig(guildId, { lastFired: firedKey });
        console.log(`📣  [${guildId}] 百業戰公告已發送`);
      } catch (err) {
        console.error(`❌  [${guildId}] 公告發送失敗：`, err.message);
      }
    }
  }, 60 * 1000);
}

// ─────────────────────────────────────────────────────
//  公告 Embed（左框金色）
// ─────────────────────────────────────────────────────
function buildAnnounceEmbed() {
  return new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle("⚔️　百業戰開始囉！！")
    .setDescription(
      "## 百業戰現在開放！\n" +
      "趕快揪隊友一起衝！\n\n" 
      
    )
    .setTimestamp()
    .setFooter({ text: "每週六、日 20:30 自動提醒" });
}
