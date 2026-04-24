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
// RPG STYLE EMBED
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
      {
        name: '👑 團長',
        value: `<@${event.ownerId}>`,
        inline: true
      },
      {
        name: '📊 狀態',
        value: status,
        inline: true
      },
      {
        name: '👥 人數',
        value: `${event.players.length} / ${event.maxPlayers}`,
        inline: true
      },

      {
        name: `🛡 坦 (${tanks.length}/${event.maxTanks})`,
        value: list(tanks, '🛡️'),
        inline: true
      },
      {
        name: `💚 補 (${healers.length}/${event.maxHealers})`,
        value: list(healers, '💚'),
        inline: true
      },
      {
        name: `⚔️ 輸出 (${dps.length})`,
        value: list(dps, '⚔️'),
        inline: true
      },

      {
        name: '📥 候補',
        value: queue.length ? queue.map(q => `⏳ <@${q.id}>`).join('\n') : '—'
      }
    )
    .setFooter({ text: 'RPG Raid System • Discord Dungeon Party' });
}

// ==========================
// BUTTON UI
// ==========================
function buttons(event) {

  const tanks = event.players.filter(p => p.role === 'tanks').length;
  const healers = event.players.filter(p => p.role === 'healers').length;

  return new ActionRowBuilder().addComponents(

    new ButtonBuilder()
      .setCustomId('tank')
      .setLabel(`${ROLE.tank.icon} 坦`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(tanks >= event.maxTanks),

    new ButtonBuilder()
      .setCustomId('healer')
      .setLabel(`${ROLE.healer.icon} 補`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(healers >= event.maxHealers),

    new ButtonBuilder()
      .setCustomId('dps')
      .setLabel(`${ROLE.dps.icon} 輸出`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(false),

    new ButtonBuilder()
      .setCustomId('leave')
      .setLabel('❌ 離隊')
      .setStyle(ButtonStyle.Danger)
  );
}

// ==========================
// OWNER BUTTON
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
// READY
// ==========================
client.once(Events.ClientReady, () => {
  console.log("⚔️ RPG Raid Bot Ready");
});

// ==========================
// INTERACTION
// ==========================
client.on(Events.InteractionCreate, async (interaction) => {

  try {

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

    // ==========================
    // BUTTONS
    // ==========================
    if (interaction.isButton()) {

      let data = safeDB(await db.loadDB());

      const event = data.events.find(e => e.messageId === interaction.message.id);
      if (!event) return;

      const uid = interaction.user.id;

      if (Date.now() > new Date(event.endTime).getTime()) {
        return interaction.reply({ content: '⏳ 副本已結束', ephemeral: true });
      }

      // DELETE
      if (interaction.customId.startsWith('delete_')) {

        if (uid !== event.ownerId) {
          return interaction.reply({ content: '❌ 只有團長可以解散', ephemeral: true });
        }

        data.events = data.events.filter(e => e.id !== event.id);
        await db.saveDB(data);

        await interaction.message.delete().catch(() => {});
        return;
      }

      // LEAVE
      if (interaction.customId === 'leave') {

        event.players = event.players.filter(p => p.id !== uid);
        event.queue = event.queue.filter(p => p.id !== uid);

        await db.saveDB(data);

        return interaction.update({
          embeds: [buildEmbed(event)],
          components: [buttons(event), ownerBtn(event)]
        });
      }

      // ROLE JOIN
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

        if (!event.queue.find(q => q.id === uid)) {
          event.queue.push({ id: uid, role });
        }

        await db.saveDB(data);

        return interaction.reply({
          content: '📥 已進入候補隊列',
          ephemeral: true
        });
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