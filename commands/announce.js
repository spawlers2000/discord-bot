// commands/announce.js
// /公告 指令 — 開關百業戰自動公告（MongoDB 版）

import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getGuildConfig, setGuildConfig, canControlAnnounce } from "../utils/announceConfig.js";

export const data = new SlashCommandBuilder()
  .setName("公告")
  .setDescription("百業戰自動公告開關")
  .addSubcommand((sub) =>
    sub.setName("開啟").setDescription("開啟每週六日 20:25 自動公告")
  )
  .addSubcommand((sub) =>
    sub.setName("關閉").setDescription("關閉自動公告")
  )
  .addSubcommand((sub) =>
    sub.setName("狀態").setDescription("查看目前公告設定")
  );

export async function execute(interaction) {
  const guildId = interaction.guildId;
  const sub     = interaction.options.getSubcommand();

  // 所有子指令都需要權限
  if (!canControlAnnounce(interaction.member)) {
    return interaction.reply({
      content: "❌ 你沒有控制公告功能的權限。",
      ephemeral: true,
    });
  }

  // ── /公告 開啟 ──────────────────────────────────
  if (sub === "開啟") {
    if (!process.env.ANNOUNCE_CHANNEL_ID) {
      return interaction.reply({
        content: "⚠️ 環境變數尚未設定 `ANNOUNCE_CHANNEL_ID`。",
        ephemeral: true,
      });
    }
    await setGuildConfig(guildId, { enabled: true });
    return interaction.reply({
      content:
        "✅ 百業戰自動公告已**開啟**！\n" +
        `📢 頻道：<#${process.env.ANNOUNCE_CHANNEL_ID}>\n` +
        `👥 通知身分組：${process.env.ANNOUNCE_ROLE_ID ? `<@&${process.env.ANNOUNCE_ROLE_ID}>` : "（未設定）"}\n` +
        "⏰ 每週六、日 20:25（台灣時間）自動發送。",
      ephemeral: true,
    });
  }

  // ── /公告 關閉 ──────────────────────────────────
  if (sub === "關閉") {
    await setGuildConfig(guildId, { enabled: false });
    return interaction.reply({
      content: "🔕 百業戰自動公告已**關閉**。",
      ephemeral: true,
    });
  }

  // ── /公告 狀態 ──────────────────────────────────
  if (sub === "狀態") {
    const cfg = await getGuildConfig(guildId);

    const chDisplay   = process.env.ANNOUNCE_CHANNEL_ID ? `<#${process.env.ANNOUNCE_CHANNEL_ID}>` : "⚠️ 未設定";
    const roleDisplay = process.env.ANNOUNCE_ROLE_ID    ? `<@&${process.env.ANNOUNCE_ROLE_ID}>`   : "⚠️ 未設定";
    const adminDisplay = process.env.ANNOUNCE_ADMIN_ID  ? `<@${process.env.ANNOUNCE_ADMIN_ID}>`   : "⚠️ 未設定";

    const embed = new EmbedBuilder()
      .setColor(cfg.enabled ? 0xffd700 : 0x99aab5)
      .setTitle("📋　百業戰公告設定狀態")
      .addFields(
        { name: "狀態",     value: cfg.enabled ? "🟢 開啟中" : "🔴 已關閉", inline: true },
        { name: "公告頻道", value: chDisplay,    inline: true },
        { name: "通知身分", value: roleDisplay,  inline: true },
        { name: "管理員",   value: adminDisplay, inline: true },
      )
      .setFooter({ text: "每週六、日 20:25（台灣時間）自動發送" });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
