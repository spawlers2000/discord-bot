// commands/announce.js
// /公告 指令 — 開關百業戰自動公告
// 頻道、管理員、身分組都固定在 .env，不需要下指令設定

import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getGuildConfig, setGuildConfig, canControlAnnounce } from "../utils/announceConfig.js";

export const data = new SlashCommandBuilder()
  .setName("公告")
  .setDescription("百業戰自動公告開關")
  .addSubcommand((sub) =>
    sub.setName("開啟").setDescription("開啟每週六日 20:30 自動公告")
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

  // ── /公告 開啟 ────────────────────────────────────
  if (sub === "開啟") {
    if (!process.env.ANNOUNCE_CHANNEL_ID) {
      return interaction.reply({
        content: "⚠️ `.env` 尚未設定 `ANNOUNCE_CHANNEL_ID`，請先設定再開啟。",
        ephemeral: true,
      });
    }
    setGuildConfig(guildId, { enabled: true });
    return interaction.reply({
      content:
        "✅ 百業戰自動公告已**開啟**！\n" +
        `📢 頻道：<#${process.env.ANNOUNCE_CHANNEL_ID}>\n` +
        `👥 通知身分組：${process.env.ANNOUNCE_ROLE_ID ? `<@&${process.env.ANNOUNCE_ROLE_ID}>` : "（未設定）"}\n` +
        "⏰ 每週六、日 20:30（台灣時間）自動發送。",
      ephemeral: true,
    });
  }

  // ── /公告 關閉 ────────────────────────────────────
  if (sub === "關閉") {
    setGuildConfig(guildId, { enabled: false });
    return interaction.reply({
      content: "🔕 百業戰自動公告已**關閉**。",
      ephemeral: true,
    });
  }

  // ── /公告 狀態 ────────────────────────────────────
  if (sub === "狀態") {
    const cfg = getGuildConfig(guildId);

    const chDisplay =
      process.env.ANNOUNCE_CHANNEL_ID
        ? `<#${process.env.ANNOUNCE_CHANNEL_ID}>`
        : "⚠️ 未設定（請在 .env 填寫 ANNOUNCE_CHANNEL_ID）";

    const roleDisplay =
      process.env.ANNOUNCE_ROLE_ID
        ? `<@&${process.env.ANNOUNCE_ROLE_ID}>`
        : "⚠️ 未設定（請在 .env 填寫 ANNOUNCE_ROLE_ID）";

    const adminDisplay =
      process.env.ANNOUNCE_ADMIN_ID
        ? `<@${process.env.ANNOUNCE_ADMIN_ID}>`
        : "⚠️ 未設定（請在 .env 填寫 ANNOUNCE_ADMIN_ID）";

    const embed = new EmbedBuilder()
      .setColor(cfg.enabled ? 0xffd700 : 0x99aab5)
      .setTitle("📋　百業戰公告設定狀態")
      .addFields(
        { name: "狀態",     value: cfg.enabled ? "🟢 開啟中" : "🔴 已關閉", inline: true },
        { name: "公告頻道", value: chDisplay,    inline: true },
        { name: "通知身分", value: roleDisplay,  inline: true },
        { name: "管理員",   value: adminDisplay, inline: true },
      )
      .setFooter({ text: "每週六、日 20:30（台灣時間）自動發送" });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
