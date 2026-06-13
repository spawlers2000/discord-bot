// handlers/buttonHandler.js
// 處理正式隊伍卡上的按鈕（坦/補/輸出/離隊/候補/解散）

import {
  buildPartyEmbed,
  buildPartyButtons,
  calcStatus,
  roleLabel,
  roleEmoji,
} from "../utils/partyHelper.js";

export async function handlePartyButton(interaction, partyStore) {
  const raw   = interaction.customId;
  const parts = raw.split(":");
  const action = parts[1]; // join | leave | sub | disband

  // join 和 sub 都帶 roleKey
  const hasRole = action === "join" || action === "sub";
  const roleKey = hasRole ? parts[2] : null;
  const partyId = hasRole ? parts.slice(3).join(":") : parts.slice(2).join(":");

  const party = partyStore.get(partyId);
  if (!party) {
    return interaction.reply({ content: "❌ 找不到這個隊伍，可能已被解散。", ephemeral: true });
  }

  // 確保 substitutes 是物件格式（向下相容）
  if (!party.substitutes || Array.isArray(party.substitutes)) {
    party.substitutes = { tank: [], healer: [], dps: [] };
  }

  const userId = interaction.user.id;

  if (action !== "disband" && party.deadlineTime && new Date() > party.deadlineTime) {
    party.status = "closed";
    return interaction.reply({ content: "⚫ 報名截止時間已過，無法操作。", ephemeral: true });
  }

  switch (action) {

    // ── 報名 ──────────────────────────────────────────
    case "join": {
      const slot = party.slots[roleKey];
      if (!slot) return;

      if (slot.members.includes(userId)) {
        return interaction.reply({
          content: `你已在 **${roleLabel(roleKey)}** 位置了，如要取消請按「離隊」。`,
          ephemeral: true,
        });
      }

      // 已在其他職業位置 → 先移除
      const curRole = findRole(party, userId);
      if (curRole) {
        party.slots[curRole].members = party.slots[curRole].members.filter((m) => m !== userId);
      }

      // 從所有候補移除
      removeFromAllSubs(party, userId);

      // 格位已滿 → 加入該職業候補
      if (slot.members.length >= slot.max) {
        if (!party.substitutes[roleKey].includes(userId)) {
          party.substitutes[roleKey].push(userId);
        }
        await refresh(interaction, party, partyStore);
        return interaction.reply({
          content: `📋 **${roleLabel(roleKey)}** 已滿，已將你加入 ${roleEmoji(roleKey)} 候補名單。`,
          ephemeral: true,
        });
      }

      slot.members.push(userId);
      party.status = calcStatus(party);
      await refresh(interaction, party, partyStore);
      return interaction.reply({
        content: `${roleEmoji(roleKey)} 成功報名 **${roleLabel(roleKey)}**！`,
        ephemeral: true,
      });
    }

    // ── 候補（指定職業）──────────────────────────────
    case "sub": {
      const alreadyInSub = party.substitutes[roleKey]?.includes(userId);
      if (alreadyInSub) {
        return interaction.reply({
          content: `你已在 ${roleEmoji(roleKey)} **${roleLabel(roleKey)}** 候補名單中了。`,
          ephemeral: true,
        });
      }

      const curRole = findRole(party, userId);
      if (curRole) {
        return interaction.reply({
          content: `你已是正式成員（${roleLabel(curRole)}），不需要候補。`,
          ephemeral: true,
        });
      }

      // 從其他職業候補移除（一人只能候補一個職業）
      removeFromAllSubs(party, userId);

      party.substitutes[roleKey].push(userId);
      await refresh(interaction, party, partyStore);
      return interaction.reply({
        content: `📋 已加入 ${roleEmoji(roleKey)} **${roleLabel(roleKey)}** 候補名單。`,
        ephemeral: true,
      });
    }

    // ── 離隊 ──────────────────────────────────────────
    case "leave": {
      const curRole = findRole(party, userId);
      const inSub   = isInAnySub(party, userId);

      if (!curRole && !inSub) {
        return interaction.reply({ content: "你本來就不在這個隊伍裡。", ephemeral: true });
      }

      if (curRole) {
        party.slots[curRole].members = party.slots[curRole].members.filter((m) => m !== userId);

        // 從同職業候補遞補
        const subList = party.substitutes[curRole];
        if (subList && subList.length > 0) {
          const nextUp = subList.shift();
          party.slots[curRole].members.push(nextUp);
          interaction.client.users.fetch(nextUp).then((u) =>
            u.send(`🎉 隊伍「**${party.title}**」有人離隊，你已從 ${roleEmoji(curRole)} 候補晉升為 **${roleLabel(curRole)}**！`)
             .catch(() => {})
          );
        }
      }

      // 從候補移除
      removeFromAllSubs(party, userId);

      party.status = calcStatus(party);
      await refresh(interaction, party, partyStore);
      return interaction.reply({ content: "🚪 已成功離隊。", ephemeral: true });
    }

    // ── 解散 ──────────────────────────────────────────
    case "disband": {
      if (userId !== party.leader) {
        return interaction.reply({ content: "❌ 只有團長可以解散隊伍。", ephemeral: true });
      }

      partyStore.delete(partyId);

      const disbandEmbed = buildPartyEmbed({ ...party, status: "disbanded" })
        .setTitle(`~~⚔️　${party.title}~~ — 已解散`);

      return interaction.update({
        embeds:     [disbandEmbed],
        components: buildPartyButtons(partyId, true),
      });
    }
  }
}

// ─────────────────────────────────────────────────────
//  工具
// ─────────────────────────────────────────────────────
function findRole(party, userId) {
  for (const [key, slot] of Object.entries(party.slots)) {
    if (slot.members.includes(userId)) return key;
  }
  return null;
}

function isInAnySub(party, userId) {
  return Object.values(party.substitutes).some((list) => list.includes(userId));
}

function removeFromAllSubs(party, userId) {
  for (const key of Object.keys(party.substitutes)) {
    party.substitutes[key] = party.substitutes[key].filter((m) => m !== userId);
  }
}

async function refresh(interaction, party, partyStore) {
  party.status = calcStatus(party);
  partyStore.set(party.id, party);
  await interaction.message?.edit({
    embeds:     [buildPartyEmbed(party)],
    components: buildPartyButtons(party.id, party.status === "closed"),
  }).catch(() => {});
}
