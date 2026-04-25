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
// normalize
// ==========================
function normalize(e) {
  if (!e) return e;

  return {
    ...e,
    eventTime: Number(e.eventTime),
    endTime: Number(e.endTime),
    players: e.players || [],
    queue: e.queue || []
  };
}

// ==========================
// DB safe
// ==========================
function safeDB(data) {
  if (!data.events) data.events = [];
  data.events = data.events.map(normalize);
  return data;
}

// ==========================
// time parse
// ==========================
function parseTime(input) {
  const [date, time] = input.split(' ');
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
}

// ==========================
// format
// ==========================
function formatTime(t) {
  return new Date(Number(t)).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

// ==========================
// embed
// ==========================
function buildEmbed(event) {

  event = normalize(event);

  const now = Date.now();

  const players = event.players;
  const queue = event.queue;

  const status =
    players.length >= event.maxPlayers ? '🔴 已滿'
    : now >= event.endTime ? '⛔ 已截止'
    : now >= event.eventTime ? '⏰ 已開始'
    : '🟢 招募中';

   return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(`⚔️ ${event.name}`)
    .addFields(
      { name: '👑 團長', value: `<@${event.ownerId}>`, inline: true },
      { name: '📊 狀態', value: status, inline: true },
      { name: '👥 人數', value: `${players.length}/${event.maxPlayers}`, inline: true },

      { name: '📅 開始', value: formatTime(event.eventTime), inline: true },
      { name: '⏳ 截止', value: formatTime(event.endTime), inline: true },

      { name: '🛡 坦', value: list(tanks, '🛡️'), inline: true },
      { name: '💚 補', value: list(healers, '💚'), inline: true },
      { name: '⚔️ 輸出', value: list(dps, '⚔️'), inline: true },

      { name: '📥 候補', value: queue.length ? queue.map(q => `<@${q.id}>`).join('\n') : '—' }
    );
}

// ==========================
// buttons
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
      .setLabel('🗑️解散')
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

    // ==========================
    // ALWAYS reload DB (🔥關鍵修正)
    // ==========================
    let data = safeDB(await db.loadDB());
    const now = Date.now();

    // ==========================
    // CREATE
    // ==========================
    if (interaction.isChatInputCommand() && interaction.commandName === 'event') {

      await interaction.deferReply();

      const eventTime = parseTime(interaction.options.getString('event-time'));
      const endTime = parseTime(interaction.options.getString('end-time'));

      if (!eventTime || !endTime)
        return interaction.editReply('❌ 時間錯誤');

      const event = normalize({
        id: Date.now().toString(),
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
      });

      data.events.push(event);
      await db.saveDB(data);

      const msg = await interaction.editReply({
        embeds: [buildEmbed(event)],
        components: [buttons(), ownerBtn(event)]
      });

      event.messageId = msg.id;
      await db.saveDB(data);
    }

    // ==========================
    // BUTTON
    // ==========================
    if (!interaction.isButton()) return;

    // 🔥 重抓最新資料（關鍵）
    data = safeDB(await db.loadDB());

    let event = data.events.find(e => e.messageId === interaction.message.id);
    if (!event) return;

    event = normalize(event);

    const uid = interaction.user.id;
    const now2 = Date.now();

    // ==========================
    // DELETE
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
    // LEAVE
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
    // 🔥 最終截止判斷（強制 number）
    // ==========================
    const end = Number(event.endTime);
    const start = Number(event.eventTime);

    // 🔥 DEBUG（如果還壞，看這行）
    console.log('[DEBUG]', {
      now: now2,
      end,
      start,
      type: typeof event.endTime
    });

    if (now2 >= start)
      return interaction.reply({ content: '⏰ 已開始', ephemeral: true });

    if (now2 >= end)
      return interaction.reply({ content: '🚫 已截止', ephemeral: true });

    // ==========================
    // ROLE
    // ==========================
    let role = null;
    if (interaction.customId === 'tank') role = 'tanks';
    if (interaction.customId === 'healer') role = 'healers';
    if (interaction.customId === 'dps') role = 'dps';

    if (!role) return;

    event.players = event.players.filter(p => p.id !== uid);
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