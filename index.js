require('dotenv').config();

const {
  Client,
  Events,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const db = require('./db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==========================
// 🎮 RPG ICON SYSTEM
// ==========================
const ROLE = {
  tank: { icon: '🛡️', name: '坦克', color: 0x3498db },
  healer: { icon: '💚', name: '治療', color: 0x2ecc71 },
  dps: { icon: '⚔️', name: '輸出', color: 0xe74c3c }
};

// ==========================
// DB safe
// ==========================
function safeDB(data) {
  if (!data.events) data.events = [];
  return data;
}

// ==========================
// ⏰ 時間解析
// ==========================
function parseTime(input) {
  if (!input) return null;
  input = input.replace(' ', 'T');
  const date = new Date(input);
  if (isNaN(date)) return null;
  return date.toISOString();
}

// ==========================
// ⏰ 顯示時間
// ==========================
function formatTime(time) {
  return new Date(time).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

// ==========================
// ❗ 統一錯誤回應（避免 failed）
// ==========================
async function replyError(interaction, msg) {
  if (interaction.deferred || interaction.replied) {
    return interaction.followUp({ content: msg, ephemeral: true });
  } else {
    await interaction.deferReply({ ephemeral: true });
    return interaction.editReply({ content: msg });
  }
}

// ==========================
// EMBED
// ==========================
function buildEmbed(event) {

  const tanks = event.players.filter(p => p.role === 'tanks');
  const healers = event.players.filter(p => p.role === 'healers');
  const dps = event.players.filter(p => p.role === 'dps');
  const queue = event.queue || [];

  const list = (arr, icon) =>
    arr.length ? arr.map(p => `${icon} <@${p.id}>`).join('\n') : '—';

  const status =
    event.players.length >= event.maxPlayers ? '🔴 已滿'
    : event.players.length >= event.maxPlayers * 0.7 ? '🟡 即將滿'
    : '🟢 招募中';

  return new EmbedBuilder()
    .setColor(
      event.players.length >= event.maxPlayers ? 0xe74c3c :
      event.players.length >= event.maxPlayers * 0.7 ? 0xf1c40f :
      0x2ecc71
    )
    .setTitle(`⚔️ ${event.name}`)
    .addFields(
      { name: '👑 團長', value: `<@${event.ownerId}>`, inline: true },
      { name: '📊 狀態', value: status, inline: true },
      { name: '👥 人數', value: `${event.players.length} / ${event.maxPlayers}`, inline: true },

      { name: '📅 活動開始', value: formatTime(event.eventTime), inline: true },
      { name: '⏳ 報名截止', value: formatTime(event.endTime), inline: true },
      { name: '\u200b', value: '\u200b', inline: true },

      { name: `🛡 坦 (${tanks.length}/${event.maxTanks})`, value: list(tanks, '🛡️'), inline: true },
      { name: `💚 補 (${healers.length}/${event.maxHealers})`, value: list(healers, '💚'), inline: true },
      { name: `⚔️ 輸出 (${dps.length})`, value: list(dps, '⚔️'), inline: true },

      { name: '📥 候補', value: queue.length ? queue.map(q => `⏳ <@${q.id}>`).join('\n') : '—' }
    );
}

// ==========================
// BUTTON UI
// ==========================
function buttons(event) {

  const tanks = event.players.filter(p => p.role === 'tanks').length;
  const healers = event.players.filter(p => p.role === 'healers').length;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tank').setLabel('🛡️ 坦').setStyle(ButtonStyle.Primary).setDisabled(tanks >= event.maxTanks),
    new ButtonBuilder().setCustomId('healer').setLabel('💚 補').setStyle(ButtonStyle.Success).setDisabled(healers >= event.maxHealers),
    new ButtonBuilder().setCustomId('dps').setLabel('⚔️ 輸出').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('leave').setLabel('❌ 離隊').setStyle(ButtonStyle.Danger)
  );
}

// ==========================
function ownerBtn(event) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`delete_${event.id}`)
      .setLabel('🗑️ 解散隊伍')
      .setStyle(ButtonStyle.Danger)
  );
}

// ==========================
client.once(Events.ClientReady, () => {
  console.log("⚔️ RPG Raid Bot Ready");
});

// ==========================
client.on(Events.InteractionCreate, async (interaction) => {

  try {

    // ==========================
    // 建立活動
    // ==========================
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'event') {

        await interaction.deferReply();

        let data = safeDB(await db.loadDB());

        const id = Date.now().toString();

        const eventTime = parseTime(interaction.options.getString('event-time'));
        const endTime = parseTime(interaction.options.getString('end-time'));

        if (!eventTime || !endTime)
          return interaction.editReply({ content: '❌ 時間格式錯誤（例：2026-04-30 20:30）' });

        if (new Date(eventTime) < Date.now())
          return interaction.editReply({ content: '❌ 活動時間不能是過去時間' });

        if (new Date(endTime) > new Date(eventTime))
          return interaction.editReply({ content: '❌ 報名截止不能晚於活動開始' });

        const event = {
          id,
          name: interaction.options.getString('name'),
          maxPlayers: interaction.options.getInteger('max'),
          maxTanks: interaction.options.getInteger('tanks'),
          maxHealers: interaction.options.getInteger('healers'),
          players: [],
          queue: [],
          ownerId: interaction.user.id,
          endTime,
          eventTime,
          messageId: null
        };

        data.events.push(event);
        await db.saveDB(data);

        const msg = await interaction.editReply({
          embeds: [buildEmbed(event)],
          components: [buttons(event), ownerBtn(event)]
        });

        const saved = data.events.find(e => e.id === id);
        if (saved) saved.messageId = msg.id;
        await db.saveDB(data);
      }
    }

    // ==========================
    // BUTTON
    // ==========================
    if (interaction.isButton()) {

      let data = safeDB(await db.loadDB());
      const event = data.events.find(e => e.messageId === interaction.message.id);
      if (!event) return;

      const uid = interaction.user.id;
      const now = Date.now();

      // 🗑️ 解散（永遠可用）
      if (interaction.customId.startsWith('delete_')) {
        if (uid !== event.ownerId)
          return replyError(interaction, '❌ 只有團長可以解散');

        data.events = data.events.filter(e => e.id !== event.id);
        await db.saveDB(data);
        await interaction.message.delete().catch(() => {});
        return;
      }

      // ❌ 離隊（永遠可用）
      if (interaction.customId === 'leave') {
        event.players = event.players.filter(p => p.id !== uid);
        event.queue = event.queue.filter(p => p.id !== uid);

        await db.saveDB(data);

        return interaction.update({
          embeds: [buildEmbed(event)],
          components: [buttons(event), ownerBtn(event)]
        });
      }

      // ⛔ 活動已開始
      if (now >= new Date(event.eventTime))
        return replyError(interaction, '⏰ 活動已開始');

      // 🚫 報名截止
      if (now > new Date(event.endTime))
        return replyError(interaction, '🚫 報名已截止');

      // ==========================
      // 報名
      // ==========================
      let role = null;
      if (interaction.customId === 'tank') role = 'tanks';
      if (interaction.customId === 'healer') role = 'healers';
      if (interaction.customId === 'dps') role = 'dps';
      if (!role) return;

      event.players = event.players.filter(p => p.id !== uid);

      const count = event.players.filter(p => p.role === role).length;
      const limit =
        role === 'tanks' ? event.maxTanks :
        role === 'healers' ? event.maxHealers :
        Infinity;

      if (count >= limit) {
        if (!event.queue.find(q => q.id === uid))
          event.queue.push({ id: uid, role });

        await db.saveDB(data);
        return replyError(interaction, '📥 已進入候補');
      }

      event.players.push({ id: uid, role });
      await db.saveDB(data);

      return interaction.update({
        embeds: [buildEmbed(event)],
        components: [buttons(event), ownerBtn(event)]
      });
    }

  } catch (err) {
    console.error(err);
  }
});

client.login(process.env.TOKEN);