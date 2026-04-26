const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const { formatTime } = require('./time');

// ==========================
// 角色設定（統一命名）
// ==========================
const ROLE = {
  tank: { icon: '🛡️', name: '坦克' },
  healer: { icon: '💚', name: '治療' },
  dps: { icon: '⚔️', name: '輸出' }
};

// ==========================
// 時間解析（保留你的格式）
// ==========================
function parseEventTime(t) {
  if (!t) return null;

  // 2026-3-26-16-57 → 2026-03-26T16:57:00
  const parts = t.split('-');
  if (parts.length === 5) {
    const [y, m, d, h, min] = parts;
    return new Date(
      `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min.padStart(2, '0')}:00`
    );
  }

  return new Date(t);
}

// ==========================
// 建立 Embed
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
    .setTitle(`⚔️ ${event.name}`)
    .setColor(getStatusColor(event))
    .addFields(
      { name: '👑 團長', value: `<@${event.ownerId}>`, inline: true },
      { name: '📊 狀態', value: status, inline: true },
      { name: '👥 人數', value: `${event.players.length}/${event.maxPlayers}`, inline: true },

      {
        name: '📅 活動開始',
        value: safeFormatTime(event.eventTime),
        inline: true
      },
      {
        name: '⏳ 報名截止',
        value: safeFormatTime(event.endTime),
        inline: true
      },
      { name: '\u200b', value: '\u200b', inline: true },

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
        value: (event.queue && event.queue.length > 0)
      ? event.queue.map(q => `⏳ <@${q.id}>`).join('\n')
      : '—'
      }
    );

    
}

// ==========================
// 按鈕
// ==========================
function buttons(event) {

  const tanks = event.players.filter(p => p.role === 'tank').length;
  const healers = event.players.filter(p => p.role === 'healer').length;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tank')
      .setLabel('🛡️ 坦')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(tanks >= event.maxTanks),

    new ButtonBuilder()
      .setCustomId('healer')
      .setLabel('💚 補')
      .setStyle(ButtonStyle.Success)
      .setDisabled(healers >= event.maxHealers),

    new ButtonBuilder()
      .setCustomId('dps')
      .setLabel('⚔️ 輸出')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('leave')
      .setLabel('❌ 離隊')
      .setStyle(ButtonStyle.Danger)
  );
}

// ==========================
// 團長按鈕
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
// 邊框顏色
// ==========================
function getStatusColor(event) {

  const tanks = event.players.filter(p => p.role === 'tanks').length;
  const healers = event.players.filter(p => p.role === 'healers').length;

  const total = event.players.length;
  const max = event.maxPlayers;

  if (total >= max) return 0xff0000; // 🔴 滿
  if (total >= max * 0.7) return 0xffff00; // 🟡 快滿
  return 0x00ff00; // 🟢 招募中
}


function safeFormatTime(input) {
  if (!input) return '未設定';

  // 情況1：字串格式 "2026-04-26 20:00"
  if (typeof input === 'string' && input.includes(' ')) {
    const [datePart, timePart] = input.split(' ');

    const [y, m, d] = datePart.split('-');
    const [h, min] = timePart.split(':');

    const date = new Date(y, m - 1, d, h, min);

    return isNaN(date.getTime())
      ? '時間錯誤'
      : date.toLocaleString('zh-TW', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
  }

  // 情況2：ISO / Date
  const date = new Date(input);

  return isNaN(date.getTime())
    ? '時間錯誤'
    : date.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
}

module.exports = {
  buildEmbed,
  buttons,
  ownerBtn
};