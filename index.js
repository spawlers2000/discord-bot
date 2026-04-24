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
// UI（Embed）
// ==========================
function buildEventEmbed(event) {

  const tanks = event.players.filter(p => p.role === 'tanks');
  const healers = event.players.filter(p => p.role === 'healers');
  const dps = event.players.filter(p => p.role === 'dps');

  const list = (arr, icon) =>
    arr.length ? arr.map(p => `${icon} <@${p.id}>`).join('\n') : '無';

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📢 ${event.name}`)
    .addFields(
      { name: '📅 活動時間', value: new Date(event.eventTime).toLocaleDateString('zh-TW'), inline: true },
      { name: '👥 人數', value: `${event.players.length}/${event.maxPlayers}`, inline: true },
      { name: '👑 建立者', value: `<@${event.ownerId}>`, inline: true },

      { name: `🛡 坦 (${tanks.length}/${event.maxTanks})`, value: list(tanks, '🛡'), inline: true },
      { name: `💚 補 (${healers.length}/${event.maxHealers})`, value: list(healers, '💚'), inline: true },
      { name: `💥 輸出 (${dps.length}/${event.maxDps})`, value: list(dps, '💥'), inline: true },

      { name: '⏳ 截止', value: new Date(event.endTime).toLocaleDateString('zh-TW') }
    )
    .setFooter({ text: '按鈕操作：報名 / 取消 / 刪除' });
}

// ==========================
// Buttons
// ==========================
function buildButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('join_tank')
      .setLabel('🛡 坦')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('join_healer')
      .setLabel('💚 補')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('join_dps')
      .setLabel('💥 輸出')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('leave')
      .setLabel('❌ 取消')
      .setStyle(ButtonStyle.Danger)
  );
}

function buildOwnerButton(event) {
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
// Slash Command（建立活動）
// ==========================
client.on(Events.InteractionCreate, async (interaction) => {

  try {

    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'event') {

        await interaction.deferReply();

        const name = interaction.options.getString('name');
        const max = interaction.options.getInteger('max');
        const tanks = interaction.options.getInteger('tanks');
        const healers = interaction.options.getInteger('healers');
        const dps = interaction.options.getInteger('dps');

        const endTimeStr = interaction.options.getString('end-time');
        const eventTimeStr = interaction.options.getString('event-time');

        const eventTime = new Date(eventTimeStr + 'T00:00:00');
        const endTime = new Date(endTimeStr + 'T23:59:59');

        const id = Date.now().toString();

        let data = await db.loadDB();
        if (!data.events) data.events = [];

        const event = {
          id,
          name,
          maxPlayers: max,
          maxTanks: tanks,
          maxHealers: healers,
          maxDps: dps,
          players: [],
          endTime: endTime.toISOString(),
          eventTime: eventTime.toISOString(),
          ownerId: interaction.user.id,
          channelId: interaction.channelId,
          messageId: null
        };

        data.events.push(event);
        await db.saveDB(data);

        const msg = await interaction.editReply({
          embeds: [buildEventEmbed(event)],
          components: [buildButtons(), buildOwnerButton(event)]
        });

        let data2 = await db.loadDB();
        const saved = data2.events.find(e => e.id === id);
        if (saved) saved.messageId = msg.id;
        await db.saveDB(data2);
      }
    }

    // ==========================
    // Buttons Interaction
    // ==========================
    if (interaction.isButton()) {

      let data = await db.loadDB();
      if (!data.events) data.events = [];

      const event = data.events.find(e =>
        e.id === interaction.message?.id ||
        e.messageId === interaction.message?.id
      );

      // fallback search
      const ev = data.events.find(e => e.messageId === interaction.message.id);

      const target = ev || event;
      if (!target) return;

      const userId = interaction.user.id;

      // ======================
      // DELETE
      // ======================
      if (interaction.customId.startsWith('delete_')) {

        if (userId !== target.ownerId) {
          return interaction.reply({
            content: '❌ 只有建立者可以刪除',
            ephemeral: true
          });
        }

        data.events = data.events.filter(e => e.id !== target.id);
        await db.saveDB(data);

        await interaction.message.delete().catch(() => {});
        return;
      }

      // ======================
      // LEAVE
      // ======================
      if (interaction.customId === 'leave') {

        target.players = target.players.filter(p => p.id !== userId);
        await db.saveDB(data);

        return interaction.update({
          embeds: [buildEventEmbed(target)],
          components: [buildButtons(), buildOwnerButton(target)]
        });
      }

      // ======================
      // JOIN
      // ======================
      let role = null;

      if (interaction.customId === 'join_tank') role = 'tanks';
      if (interaction.customId === 'join_healer') role = 'healers';
      if (interaction.customId === 'join_dps') role = 'dps';

      if (!role) return;

      // remove old
      target.players = target.players.filter(p => p.id !== userId);

      // limit check
      const count = target.players.filter(p => p.role === role).length;

      if (role === 'tanks' && count >= target.maxTanks)
        return interaction.reply({ content: '❌ 坦已滿', ephemeral: true });

      if (role === 'healers' && count >= target.maxHealers)
        return interaction.reply({ content: '❌ 補已滿', ephemeral: true });

      if (role === 'dps' && count >= target.maxDps)
        return interaction.reply({ content: '❌ 輸出已滿', ephemeral: true });

      target.players.push({ id: userId, role });

      await db.saveDB(data);

      await interaction.update({
        embeds: [buildEventEmbed(target)],
        components: [buildButtons(), buildOwnerButton(target)]
      });
    }

  } catch (err) {
    console.error(err);
  }
});

client.login(process.env.TOKEN);