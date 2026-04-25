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
// 🎮 ROLE
// ==========================
const ROLE = {
  tank: { icon: '🛡️' },
  healer: { icon: '💚' },
  dps: { icon: '⚔️' }
};

// ==========================
// DB safe（🔥已修：強制轉數字）
// ==========================
function safeDB(data) {
  if (!data.events) data.events = [];

  data.events = data.events.map(e => ({
    ...e,
    eventTime: Number(e.eventTime),
    endTime: Number(e.endTime)
  }));

  return data;
}

// ==========================
// ⏰ 時間解析
// ==========================
function parseTime(input) {
  if (!input) return null;

  const [date, time] = input.split(' ');
  if (!date || !time) return null;

  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);

  const dateObj = new Date(y, m - 1, d, h, min);
  if (isNaN(dateObj)) return null;

  return dateObj.getTime();
}

// ==========================
// ⏰ 顯示時間
// ==========================
function formatTime(time) {
  return new Date(Number(time)).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
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

  const now = Date.now();

  const status =
    event.players.length >= event.maxPlayers ? '🔴 已滿'
    : now >= event.endTime ? '⛔ 已截止'
    : now >= event.eventTime ? '⏰ 已開始'
    : '🟢 招募中';

  return new EmbedBuilder()
    .setColor(event.players.length >= event.maxPlayers ? 0xe74c3c : 0x2ecc71)
    .setTitle(`⚔️ ${event.name}`)
    .addFields(
      { name: '👑 團長', value: `<@${event.ownerId}>`, inline: true },
      { name: '📊 狀態', value: status, inline: true },
      { name: '👥 人數', value: `${event.players.length}/${event.maxPlayers}`, inline: true },

      { name: '📅 活動開始', value: formatTime(event.eventTime), inline: true },
      { name: '⏳ 報名截止', value: formatTime(event.endTime), inline: true },
      { name: '\u200b', value: '\u200b', inline: true },

      { name: `🛡 坦`, value: list(tanks, '🛡️'), inline: true },
      { name: `💚 補`, value: list(healers, '💚'), inline: true },
      { name: `⚔️ 輸出`, value: list(dps, '⚔️'), inline: true },

      { name: '📥 候補', value: queue.length ? queue.map(q => `<@${q.id}>`).join('\n') : '—' }
    );
}

// ==========================
// BUTTONS
// ==========================
function buttons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tank').setLabel('🛡️坦').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('healer').setLabel('💚補').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('dps').setLabel('⚔️輸出').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('leave').setLabel('❌離隊').setStyle(ButtonStyle.Danger)
  );
}

function ownerBtn(event) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`delete_${event.id}`)
      .setLabel('🗑️解散隊伍')
      .setStyle(ButtonStyle.Danger)
  );
}

// ==========================
// READY
// ==========================
client.once(Events.ClientReady, () => {
  console.log('⚔️ Bot Ready');
});

// ==========================
// INTERACTION
// ==========================
client.on(Events.InteractionCreate, async (interaction) => {

  try {

    const data = safeDB(await db.loadDB());
    const now = Date.now();

    // ==========================
    // 建立活動
    // ==========================
    if (interaction.isChatInputCommand() && interaction.commandName === 'event') {

      await interaction.deferReply();

      const id = Date.now().toString();

      const eventTime = parseTime(interaction.options.getString('event-time'));
      const endTime = parseTime(interaction.options.getString('end-time'));

      if (!eventTime || !endTime)
        return interaction.editReply({ content: '❌ 時間格式錯誤（2026-04-30 20:30）' });

      if (eventTime < now)
        return interaction.editReply({ content: '❌ 活動不能是過去時間' });

      if (endTime > eventTime)
        return interaction.editReply({ content: '❌ 報名截止不能晚於開始時間' });

      const event = {
        id,
        name: interaction.options.getString('name'),
        maxPlayers: interaction.options.getInteger('max'),
        maxTanks: interaction.options.getInteger('tanks'),
        maxHealers: interaction.options.getInteger('healers'),
        players: [],
        queue: [],
        ownerId: interaction.user.id,
        eventTime,
        endTime,
        messageId: null
      };

      data.events.push(event);
      await db.saveDB(data);

      const msg = await interaction.editReply({
        embeds: [buildEmbed(event)],
        components: [buttons(), ownerBtn(event)]
      });

      const saved = data.events.find(e => e.id === id);
      if (saved) saved.messageId = msg.id;

      await db.saveDB(data);
    }

    // ==========================
    // BUTTON
    // ==========================
    if (!interaction.isButton()) return;

    const event = data.events.find(e => e.messageId === interaction.message.id);
    if (!event) return;

    const uid = interaction.user.id;

    // ==========================
    // 解散
    // ==========================
    if (interaction.customId.startsWith('delete_')) {
      if (uid !== event.ownerId)
        return interaction.reply({ content: '❌ 只有團長', ephemeral: true });

      data.events = data.events.filter(e => e.id !== event.id);
      await db.saveDB(data);

      await interaction.message.delete().catch(() => {});
      return;
    }

    // ==========================
    // 離隊
    // ==========================
    if (interaction.customId === 'leave') {

      event.players = event.players.filter(p => p.id !== uid);
      event.queue = event.queue.filter(p => p.id !== uid);

      await db.saveDB(data);

      return interaction.update({
        embeds: [buildEmbed(event)],
        components: [buttons(), ownerBtn(event)]
      });
    }

    // ==========================
    // ⛔ 已開始
    // ==========================
    if (now >= event.eventTime)
      return interaction.reply({ content: '⏰ 活動已開始', ephemeral: true });

    // ==========================
    // 🚫 已截止（🔥核心修正）
    // ==========================
    const endTime = Number(event.endTime);

if (now >= endTime) {
  return interaction.reply({
    content: '🚫 報名已截止',
    ephemeral: true
  });
}

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
      return interaction.reply({ content: '📥 候補', ephemeral: true });
    }

    event.players.push({ id: uid, role });

    await db.saveDB(data);

    return interaction.update({
      embeds: [buildEmbed(event)],
      components: [buttons(), ownerBtn(event)]
    });

  } catch (err) {
    console.error(err);
  }
});

client.login(process.env.TOKEN);