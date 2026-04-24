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
// Emoji 統一（重點修正）
// ==========================
const FORCE_ICON = {
  tanks: '🛡️\uFE0F',
  healers: '💚\uFE0F',
  dps: '💥\uFE0F'
};

// ==========================
// DB 安全
// ==========================
function safeDB(data) {
  if (!data.events) data.events = [];
  return data;
}

// ==========================
// Embed UI
// ==========================
function buildEmbed(event) {

  const tanks = event.players.filter(p => p.role === 'tanks');
  const healers = event.players.filter(p => p.role === 'healers');
  const dps = event.players.filter(p => p.role === 'dps');
  const queue = event.queue || [];

  const list = (arr, icon) =>
    arr.length ? arr.map(p => `${icon} <@${p.id}>`).join('\n') : '無';

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📢 ${event.name}`)
    .addFields(
      { name: '👑 建立者', value: `<@${event.ownerId}>`, inline: true },
      { name: '👥 人數', value: `${event.players.length}/${event.maxPlayers}`, inline: true },
      { name: '⏳ 截止', value: new Date(event.endTime).toLocaleDateString('zh-TW'), inline: true },

      { name: `🛡 坦 (${tanks.length}/${event.maxTanks})`, value: list(tanks, ROLE_ICON.tanks), inline: true },
      { name: `💚 補 (${healers.length}/${event.maxHealers})`, value: list(healers, ROLE_ICON.healers), inline: true },
      { name: `💥 輸出 (${dps.length})`, value: list(dps, ROLE_ICON.dps), inline: true },

      { name: '📥 候補', value: queue.length ? queue.map(q => `<@${q.id}>`).join('\n') : '無' }
    );
}

// ==========================
// 按鈕 UI
// ==========================
function buttons(event) {

  const tanks = event.players.filter(p => p.role === 'tanks').length;
  const healers = event.players.filter(p => p.role === 'healers').length;

  return new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId('tank')
      .setLabel('🛡 坦')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(tanks >= event.maxTanks),

    new ButtonBuilder()
      .setCustomId('healer')
      .setLabel('💚 補')
      .setStyle(ButtonStyle.Success)
      .setDisabled(healers >= event.maxHealers),

    // DPS 無上限
    new ButtonBuilder()
      .setCustomId('dps')
      .setLabel('💥 輸出')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(false),

    new ButtonBuilder()
      .setCustomId('leave')
      .setLabel('❌ 取消')
      .setStyle(ButtonStyle.Danger)
  );
}

// ==========================
// 管理按鈕
// ==========================
function ownerBtn(event) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`delete_${event.id}`)
      .setLabel('🗑️ 刪除活動')
      .setStyle(ButtonStyle.Danger)
  );
}

// ==========================
// Ready
// ==========================
client.once(Events.ClientReady, () => {
  console.log("Bot Ready");
});

// ==========================
// Interaction
// ==========================
client.on(Events.InteractionCreate, async (interaction) => {

  try {

    // ======================
    // 建立活動
    // ======================
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'event') {

        await interaction.deferReply();

        let data = safeDB(await db.loadDB());

        const id = Date.now().toString();

        const event = {
          id,
          name: interaction.options.getString('name'),
          maxPlayers: interaction.options.getInteger('max'),
          maxTanks: interaction.options.getInteger('tanks'),
          maxHealers: interaction.options.getInteger('healers'),
          maxDps: 999999,
          players: [],
          queue: [],
          ownerId: interaction.user.id,
          endTime: new Date(interaction.options.getString('end-time') + 'T23:59:59').toISOString(),
          eventTime: new Date(interaction.options.getString('event-time') + 'T00:00:00').toISOString(),
          channelId: interaction.channelId,
          messageId: null
        };

        data.events.push(event);
        await db.saveDB(data);

        const msg = await interaction.editReply({
          embeds: [buildEmbed(event)],
          components: [buttons(event), ownerBtn(event)]
        });

        let data2 = safeDB(await db.loadDB());
        const saved = data2.events.find(e => e.id === id);
        if (saved) saved.messageId = msg.id;
        await db.saveDB(data2);
      }
    }

    // ======================
    // 按鈕操作
    // ======================
    if (interaction.isButton()) {

      let data = safeDB(await db.loadDB());

      const event = data.events.find(e => e.messageId === interaction.message.id);
      if (!event) return;

      const uid = interaction.user.id;

      // 過期
      if (Date.now() > new Date(event.endTime).getTime()) {
        return interaction.reply({ content: '⏳ 活動已結束', ephemeral: true });
      }

      // ======================
      // 刪除
      // ======================
      if (interaction.customId.startsWith('delete_')) {

        if (uid !== event.ownerId) {
          return interaction.reply({ content: '❌ 只有建立者', ephemeral: true });
        }

        data.events = data.events.filter(e => e.id !== event.id);
        await db.saveDB(data);

        await interaction.message.delete().catch(() => {});
        return;
      }

      // ======================
      // 取消
      // ======================
      if (interaction.customId === 'leave') {

        event.players = event.players.filter(p => p.id !== uid);
        event.queue = event.queue.filter(p => p.id !== uid);

        await db.saveDB(data);

        return interaction.update({
          embeds: [buildEmbed(event)],
          components: [buttons(event), ownerBtn(event)]
        });
      }

      // ======================
      // 加入
      // ======================
      let role = null;

      if (interaction.customId === 'tank') role = 'tanks';
      if (interaction.customId === 'healer') role = 'healers';
      if (interaction.customId === 'dps') role = 'dps';

      if (!role) return;

      // 移除舊資料
      event.players = event.players.filter(p => p.id !== uid);

      const count = event.players.filter(p => p.role === role).length;
      const limit =
        role === 'tanks' ? event.maxTanks :
        role === 'healers' ? event.maxHealers :
        Infinity;

      // 滿人 → 候補
      if (count >= limit) {

        if (!event.queue.find(q => q.id === uid)) {
          event.queue.push({ id: uid, role });
        }

        await db.saveDB(data);

        return interaction.reply({
          content: '📥 已進入候補',
          ephemeral: true
        });
      }

      // 正常加入
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