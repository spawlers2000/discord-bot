const db = require('../db');
const safeDB = require('../utils/dbSafe');
const { parseTime, formatTime } = require('../utils/time');
const { buildEmbed, buttons, ownerBtn } = require('../utils/ui');

// ==========================
// 建立活動
// ==========================
async function createEvent(interaction) {

  await interaction.deferReply();

  let data = safeDB(await db.loadDB());

  const id = Date.now().toString();

  const eventTimeInput = interaction.options.getString('event-time');
  const endTimeInput = interaction.options.getString('end-time');

  const eventTime = parseTime(eventTimeInput);
  const endTime = parseTime(endTimeInput);

  if (!eventTime || !endTime) {
    return interaction.editReply({
      content: '❌ 時間格式錯誤，請用：2026-04-30 20:30'
    });
  }

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

  // 儲存 messageId
  let data2 = safeDB(await db.loadDB());
  const saved = data2.events.find(e => e.id === id);
  if (saved) saved.messageId = msg.id;
  await db.saveDB(data2);
}

// ==========================
// 按鈕處理
// ==========================
async function handleButton(interaction) {

  let data = safeDB(await db.loadDB());

  const event = data.events.find(e => e.messageId === interaction.message.id);
  if (!event) return;

  const uid = interaction.user.id;

  // ⏳ 已截止
  if (Date.now() > new Date(event.endTime).getTime()) {
    return interaction.reply({
      content: '⏳ 報名已截止',
      ephemeral: true
    });
  }

  // ==========================
  // 解散
  // ==========================
  if (interaction.customId.startsWith('delete_')) {

    if (uid !== event.ownerId) {
      return interaction.reply({
        content: '❌ 只有團長可以解散',
        ephemeral: true
      });
    }

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
      components: [buttons(event), ownerBtn(event)]
    });
  }

  // ==========================
  // 加入角色
  // ==========================
  let role = null;

  if (interaction.customId === 'tank') role = 'tank';
  if (interaction.customId === 'healer') role = 'healer';
  if (interaction.customId === 'dps') role = 'dps';

  if (!role) return;

  // 先移除舊角色
  event.players = event.players.filter(p => p.id !== uid);

  const count = event.players.filter(p => p.role === role).length;

  const limit =
    role === 'tanks' ? event.maxTanks :
    role === 'healers' ? event.maxHealers :
    Infinity;

  // 滿 → 候補
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

  // 正常加入
  event.players.push({ id: uid, role });

  await db.saveDB(data);

  return interaction.update({
    embeds: [buildEmbed(event)],
    components: [buttons(event), ownerBtn(event)]
  });
}

module.exports = {
  createEvent,
  handleButton
};