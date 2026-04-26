const db = require('../db');
const safeDB = require('../utils/dbSafe');

const {
  parseTime,
  formatTime,
  toTimestamp
} = require('../utils/timeEvent');

const { buildEmbed, buttons, ownerBtn } = require('../utils/ui');

// ==========================
// 建立活動
// ==========================
async function createEvent(interaction) {

  try {

    await interaction.deferReply();

    let data = safeDB(await db.loadDB());

    const eventTimeInput = interaction.options.getString('event-time');
    const endTimeInput = interaction.options.getString('end-time');

    const eventTime = parseTime(eventTimeInput);
    const endTime = parseTime(endTimeInput);

    if (!eventTime || !endTime) {
      return interaction.editReply("❌ 時間格式錯誤（YYYY-MM-DD HH:mm）");
    }

    const event = {
      id: Date.now().toString(),
      name: interaction.options.getString('name'),
      maxPlayers: interaction.options.getInteger('max'),
      maxTanks: interaction.options.getInteger('tanks'),
      maxHealers: interaction.options.getInteger('healers'),

      players: [],
      queue: [],
      ownerId: interaction.user.id,

      // 🔥 統一：只存字串
      eventTime,
      endTime,

      messageId: null
    };

    data.events.push(event);

    await db.saveDB(data);

    const msg = await interaction.editReply({
      embeds: [buildEmbed(event)],
      components: [buttons(event), ownerBtn(event)]
    });

    let data2 = safeDB(await db.loadDB());
    const saved = data2.events.find(e => e.id === event.id);

    if (saved) saved.messageId = msg.id;

    await db.saveDB(data2);

  } catch (err) {
    console.error("❌ createEvent:", err);

    if (interaction.deferred) {
      await interaction.editReply("❌ 建立失敗");
    }
  }
}

// ==========================
// 按鈕處理
// ==========================
async function handleButton(interaction) {

  try {

    let data = safeDB(await db.loadDB());

    const event = data.events.find(e => e.messageId === interaction.message.id);
    if (!event) return;

    const uid = interaction.user.id;

  // 解散
      if (interaction.customId.startsWith('delete_')) {

        if (uid !== event.ownerId) {
          return interaction.reply({ content: '❌ 只有團長可以解散', ephemeral: true });
        }

        data.events = data.events.filter(e => e.id !== event.id);
        await db.saveDB(data);

        await interaction.message.delete().catch(() => {});
        return;
      }

    // ⏳ 報名截止
    if (Date.now() > toTimestamp(event.endTime)) {
      return interaction.reply({
        content: '⏳ 報名已截止',
        ephemeral: true
      });
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
        components: [buttons(event), ownerBtn(event)]
      });
    }

    // ==========================
    // 角色
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

      if (!event.queue.find(q => q.id === uid)) {
        event.queue.push({ id: uid, role });
      }

      await db.saveDB(data);

      return interaction.reply({
        content: '📥 候補隊列',
        ephemeral: true
      });
    }

    event.players.push({ id: uid, role });

    await db.saveDB(data);

    return interaction.update({
      embeds: [buildEmbed(event)],
      components: [buttons(event), ownerBtn(event)]
    });

  } catch (err) {
    console.error("❌ handleButton:", err);

    if (!interaction.replied) {
      await interaction.reply({
        content: '❌ 發生錯誤',
        ephemeral: true
      });
    }
  }
}

module.exports = {
  createEvent,
  handleButton
};