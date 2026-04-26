const db = require('../db');
const safeDB = require('../utils/dbSafe');
const { parseTime, formatTime } = require('../utils/time');
const { buildEmbed, buttons, ownerBtn } = require('../utils/ui');

// ==========================
// 建立活動
// ==========================
async function createEvent(interaction) {

  try {

    console.log("🧪 createEvent START");

    await interaction.deferReply();

    console.log("🧪 after deferReply");

    let data = safeDB(await db.loadDB());

    console.log("🧪 db loaded");

    const eventTimeInput = interaction.options.getString('event-time');
    const endTimeInput = interaction.options.getString('end-time');

    console.log("🧪 input:", eventTimeInput, endTimeInput);

    const eventTime = parseTime(eventTimeInput);
    const endTime = parseTime(endTimeInput);

    console.log("🧪 parsed:", eventTime, endTime);

    if (!eventTime || !endTime) {
      return await interaction.editReply("❌ 時間格式錯誤");
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
      endTime,
      eventTime,
      messageId: null
    };

    console.log("🧪 event built");

    data.events.push(event);

    await db.saveDB(data);

    console.log("🧪 saved DB");

    const msg = await interaction.editReply({
      content: "✅ 活動建立成功"
    });

    console.log("🧪 replied");

  } catch (err) {

    console.error("❌ createEvent ERROR FULL:", err);
    console.error("❌ message:", err?.message);
    console.error("❌ stack:", err?.stack);

    if (interaction.deferred) {
      await interaction.editReply("❌ 建立活動失敗（看 console）");
    }
  }
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