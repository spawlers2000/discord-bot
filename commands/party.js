// commands/party.js
// /建立隊伍 指令 — 只負責彈出 Modal

import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("隊伍")
  .setDescription("建立一個組隊招募卡（會彈出填寫視窗）");

export async function execute(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("modal:createParty")
    .setTitle("⚔️  建立隊伍");

  const nameInput = new TextInputBuilder()
    .setCustomId("partyTitle")
    .setLabel("隊伍名稱")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("例如：爬塔開荒小隊、周三副本團")
    .setMinLength(1)
    .setMaxLength(50)
    .setRequired(true);

  const dateInput = new TextInputBuilder()
    .setCustomId("activityDate")
    .setLabel("活動日期（格式：YYYY/MM/DD）")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("例如：2026/05/28")
    .setMinLength(8)
    .setMaxLength(10)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(dateInput),
  );

  await interaction.showModal(modal);
}
