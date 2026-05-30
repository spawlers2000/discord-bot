// handlers/configHandler.js
// 處理建立流程中的選單與按鈕互動

import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";

import {
  buildConfigEmbed,
  buildConfigComponents,
  buildPartyEmbed,
  buildPartyButtons,
  parseDateTime,
  resolveDeadline,
  calcStatus,
  isConfigReady,
} from "../utils/partyHelper.js";

import { PRESETS } from "../utils/presets.js";

// ─────────────────────────────────────────────────────
//  Select 選單（時間 / 截止時間）
// ─────────────────────────────────────────────────────
export async function handleConfigSelect(interaction, draftStore) {
  const [, type, userId] = interaction.customId.split(":");
  if (!["time", "deadline"].includes(type)) return;

  // 只有建立者本人可以操作（ephemeral 本就只有自己看得到，雙重確認）
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: "❌ 這不是你的設定介面。", ephemeral: true });
  }

  const draft = draftStore.get(userId);
  if (!draft) {
    return interaction.reply({ content: "❌ 找不到草稿，請重新使用 `/建立隊伍`。", ephemeral: true });
  }

  const value = interaction.values[0];

  if (type === "time") {
    draft.activityTime = value;
    // 截止時間如果之前選的是跟時間有關的選項，需要重新計算顯示，但值本身不變
  }

  if (type === "deadline") {
    draft.deadlineOption = value;
  }

  draftStore.set(userId, draft);

  await interaction.update({
    embeds:     [buildConfigEmbed(draft)],
    components: buildConfigComponents(draft),
  });
}

// ─────────────────────────────────────────────────────
//  按鈕（人員配置、確認、取消）
// ─────────────────────────────────────────────────────
export async function handleConfigButton(interaction, draftStore, partyStore) {
  const parts  = interaction.customId.split(":");
  // cfg:preset:five:userId  → parts = ["cfg","preset","five","userId"]
  // cfg:confirm:userId      → parts = ["cfg","confirm","userId"]
  const action = parts[1];
  const userId = parts[parts.length - 1];

  if (interaction.user.id !== userId) {
    return interaction.reply({ content: "❌ 這不是你的設定介面。", ephemeral: true });
  }

  const draft = draftStore.get(userId);
  if (!draft) {
    return interaction.reply({ content: "❌ 找不到草稿，請重新使用 `/建立隊伍`。", ephemeral: true });
  }

  // ── 取消 ──
  if (action === "cancel") {
    draftStore.delete(userId);
    return interaction.update({
      content:    "已取消建立隊伍。",
      embeds:     [],
      components: [],
    });
  }

  // ── 選預設配置 ──
  if (action === "preset") {
    const presetId = parts[2];
    draft.preset = presetId;

    // 如果是自訂，彈出 Modal 讓使用者填人數
    if (presetId === "custom") {
      draftStore.set(userId, draft);

      const modal = new ModalBuilder()
        .setCustomId(`modal:customSlots:${userId}`)
        .setTitle("⚙️ 自訂人員配置");

      const make = (id, label, placeholder) =>
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short)
            .setPlaceholder(placeholder).setMinLength(1).setMaxLength(2).setRequired(true)
        );

      modal.addComponents(
        make("tankMax",   "坦克上限",   "例如：1"),
        make("healerMax", "補師上限",   "例如：1"),
        make("dpsMax",    "輸出上限",   "例如：3"),
        make("totalMax",  "總人數上限", "例如：5（建議填坦+補+輸出的總和）"),
      );

      return interaction.showModal(modal);
    }

    // 非自訂，清除舊的 customSlots
    draft.customSlots = null;
    draftStore.set(userId, draft);

    return interaction.update({
      embeds:     [buildConfigEmbed(draft)],
      components: buildConfigComponents(draft),
    });
  }

  // ── 確認建立 ──
  if (action === "confirm") {
    if (!isConfigReady(draft)) {
      return interaction.reply({ content: "❌ 請先完成所有設定。", ephemeral: true });
    }

    // 解析時間
    const activityTime = parseDateTime(draft.activityDate, draft.activityTime);
    if (!activityTime) {
      return interaction.reply({
        content: "❌ 活動日期/時間解析失敗，請重新使用 `/建立隊伍`。",
        ephemeral: true,
      });
    }

    const deadlineTime = resolveDeadline(draft.deadlineOption, activityTime);

    // 取得人員配置
    let slots, maxMembers;
    if (draft.preset === "custom" && draft.customSlots) {
      slots      = {
        tank:   { max: draft.customSlots.tank,   members: [] },
        healer: { max: draft.customSlots.healer, members: [] },
        dps:    { max: draft.customSlots.dps,    members: [] },
      };
      maxMembers = draft.customSlots.total;
    } else {
      const p = PRESETS[draft.preset];
      slots = {
        tank:   { max: p.slots.tank,   members: [] },
        healer: { max: p.slots.healer, members: [] },
        dps:    { max: p.slots.dps,    members: [] },
      };
      maxMembers = p.maxMembers;
    }

    const partyId = `${interaction.guildId}-${Date.now()}`;
    const party = {
      id:           partyId,
      title:        draft.title,
      leader:       userId,
      maxMembers,
      activityTime,
      deadlineTime,
      slots,
      substitutes:  [],
      status:       "recruiting",
      messageId:    null,
      channelId:    interaction.channelId,
    };

    partyStore.set(partyId, party);
    draftStore.delete(userId);

    // 先關掉 ephemeral 設定訊息
    await interaction.update({
      content:    "✅ 隊伍已建立！",
      embeds:     [],
      components: [],
    });

    // 再發出正式隊伍卡到頻道
    const msg = await interaction.followUp({
      embeds:     [buildPartyEmbed(party)],
      components: buildPartyButtons(partyId),
    });

    party.messageId = msg.id;
    return;
  }
}

// ─────────────────────────────────────────────────────
//  自訂人數 Modal 送出
// ─────────────────────────────────────────────────────
export async function handleCustomSlotsModal(interaction, draftStore) {
  const parts  = interaction.customId.split(":");
  // modal:customSlots:userId
  const userId = parts[2];

  const draft = draftStore.get(userId);
  if (!draft) {
    return interaction.reply({ content: "❌ 找不到草稿，請重新使用 `/建立隊伍`。", ephemeral: true });
  }

  const tank   = parseInt(interaction.fields.getTextInputValue("tankMax"),   10);
  const healer = parseInt(interaction.fields.getTextInputValue("healerMax"), 10);
  const dps    = parseInt(interaction.fields.getTextInputValue("dpsMax"),    10);
  const total  = parseInt(interaction.fields.getTextInputValue("totalMax"),  10);

  if ([tank, healer, dps, total].some((n) => isNaN(n) || n < 0 || n > 40)) {
    return interaction.reply({
      content: "❌ 人數請填 0–40 之間的整數。",
      ephemeral: true,
    });
  }

  draft.customSlots = { tank, healer, dps, total };
  draftStore.set(userId, draft);

  // 更新原本的設定訊息（ephemeral）
  // showModal 之後只能 reply，不能 update，改用 followUp 更新
  await interaction.reply({
    embeds:     [buildConfigEmbed(draft)],
    components: buildConfigComponents(draft),
    ephemeral:  true,
  });
}
