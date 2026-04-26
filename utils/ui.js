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
        value: formatTime(event.eventTime),
        inline: true
      },
      {
        name: '⏳ 報名截止',
        value: formatTime(event.endTime),
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
        value: queue.length ? queue.map(q => `⏳ <@${q.id}>`).join('\n') : '—'
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

function getStatusColor(event) {

  const tanks = event.players.filter(p => p.role === 'tanks').length;
  const healers = event.players.filter(p => p.role === 'healers').length;

  const total = event.players.length;
  const max = event.maxPlayers;

  if (total >= max) return 0xff0000; // 🔴 滿
  if (total >= max * 0.7) return 0xffff00; // 🟡 快滿
  return 0x00ff00; // 🟢 招募中
}

module.exports = {
  buildEmbed,
  buttons,
  ownerBtn
};