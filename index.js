// index.js
// Discord 組隊機器人 v2 — 主程式

import { Client, GatewayIntentBits, Collection } from "discord.js";

import * as partyCommand       from "./commands/party.js";
import * as announceCommand    from "./commands/announce.js";
import { handleModal }         from "./handlers/modalHandler.js";
import {
  handleConfigSelect,
  handleConfigButton,
  handleCustomSlotsModal,
}                              from "./handlers/configHandler.js";
import { handlePartyButton }   from "./handlers/buttonHandler.js";
import { startAnnounceScheduler } from "./utils/announceScheduler.js";

// ─────────────────────────────────────────────────────
//  Client
// ─────────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// 指令集合
client.commands = new Collection();
client.commands.set(partyCommand.data.name,    partyCommand);
client.commands.set(announceCommand.data.name, announceCommand);

// ─────────────────────────────────────────────────────
//  資料儲存（記憶體）
//  draftStore : userId  → 建立中的草稿
//  partyStore : partyId → 已建立的隊伍
//  公告設定改存 data/announceConfig.json（重啟不消失）
// ─────────────────────────────────────────────────────
const draftStore = new Map();
const partyStore = new Map();

// ─────────────────────────────────────────────────────
//  Ready
// ─────────────────────────────────────────────────────
client.once("ready", (c) => {
  console.log(`✅  機器人上線：${c.user.tag}`);
  console.log(`📡  已加入 ${c.guilds.cache.size} 個伺服器`);

  // 啟動百業戰公告排程
  startAnnounceScheduler(client);
});

// ─────────────────────────────────────────────────────
//  Slash Command
// ─────────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[指令錯誤] ${interaction.commandName}:`, err);
    safeReply(interaction, "⚠️ 執行指令時發生錯誤，請稍後再試。");
  }
});

// ─────────────────────────────────────────────────────
//  Modal 送出
// ─────────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  try {
    if (interaction.customId === "modal:createParty") {
      await handleModal(interaction, draftStore);
      return;
    }
    if (interaction.customId.startsWith("modal:customSlots:")) {
      await handleCustomSlotsModal(interaction, draftStore);
      return;
    }
  } catch (err) {
    console.error("[Modal 錯誤]", err);
    safeReply(interaction, "⚠️ 處理表單時發生錯誤，請稍後再試。");
  }
});

// ─────────────────────────────────────────────────────
//  Select 選單
// ─────────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  try {
    if (interaction.customId.startsWith("cfg:")) {
      await handleConfigSelect(interaction, draftStore);
    }
  } catch (err) {
    console.error("[Select 錯誤]", err);
    safeReply(interaction, "⚠️ 處理選單時發生錯誤，請稍後再試。");
  }
});

// ─────────────────────────────────────────────────────
//  Button
// ─────────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  try {
    if (interaction.customId.startsWith("cfg:")) {
      await handleConfigButton(interaction, draftStore, partyStore);
      return;
    }
    if (interaction.customId.startsWith("party:")) {
      await handlePartyButton(interaction, partyStore);
      return;
    }
  } catch (err) {
    console.error("[Button 錯誤]", err);
    safeReply(interaction, "⚠️ 處理按鈕時發生錯誤，請稍後再試。");
  }
});

// ─────────────────────────────────────────────────────
//  定期清理過期隊伍（每小時）
// ─────────────────────────────────────────────────────
setInterval(() => {
  const now = new Date();
  let cleaned = 0;
  for (const [id, party] of partyStore.entries()) {
    if (party.activityTime && now - party.activityTime > 4 * 60 * 60 * 1000) {
      partyStore.delete(id);
      cleaned++;
    }
  }
  if (cleaned > 0) console.log(`🧹  清理了 ${cleaned} 個過期隊伍`);
}, 60 * 60 * 1000);

// ─────────────────────────────────────────────────────
//  登入
// ─────────────────────────────────────────────────────
if (!process.env.TOKEN) {
  console.error("❌  找不到 TOKEN！請確認 .env 是否設定正確。");
  process.exit(1);
}

client.login(process.env.TOKEN);

async function safeReply(interaction, content) {
  const msg = { content, ephemeral: true };
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  } catch (_) {}
}
