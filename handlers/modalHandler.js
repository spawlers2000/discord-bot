// handlers/modalHandler.js
// Modal 送出後，顯示設定介面（時間選單 + 配置按鈕）

import { parseDateTime, buildConfigEmbed, buildConfigComponents } from "../utils/partyHelper.js";

export async function handleModal(interaction, draftStore) {
  if (interaction.customId !== "modal:createParty") return;

  const title        = interaction.fields.getTextInputValue("partyTitle").trim();
  const activityDate = interaction.fields.getTextInputValue("activityDate").trim();

  // 日期格式驗證（接受 YYYY/MM/DD 或 YYYY-MM-DD）
  const dateTest = parseDateTime(activityDate, "00:00");
  if (!dateTest) {
    return interaction.reply({
      content:
        "❌ **日期格式錯誤！**\n" +
        "請使用 `YYYY/MM/DD` 格式，例如：`2026/05/28`",
      ephemeral: true,
    });
  }

  // 建立草稿
  const draft = {
    userId:        interaction.user.id,
    title,
    activityDate,
    activityTime:  null,        // 等選單選
    deadlineOption: undefined,  // 等選單選
    preset:        null,        // 等按鈕選
    customSlots:   null,        // 如果選自訂才填
  };

  draftStore.set(interaction.user.id, draft);

  await interaction.reply({
    embeds:     [buildConfigEmbed(draft)],
    components: buildConfigComponents(draft),
    ephemeral:  true,
  });
}
