import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const ORANGE = 0xFF8C00;
const CHANNEL_ID = process.env.SIGNUP_CHANNEL_ID || '1482375700299251753';

// 儲存進行中的報名（messageId → state）
const signups = new Map();

// Slash Command 定義
export const data = new SlashCommandBuilder()
  .setName('遊戲')
  .setDescription('發起遊戲報名')
  .addStringOption(option =>
    option.setName('名稱').setDescription('遊戲名稱').setRequired(true)
  )
  .addStringOption(option =>
    option.setName('日期').setDescription('遊玩日期（例如 2026/08/29）').setRequired(true)
  )
  .addIntegerOption(option =>
    option.setName('人數上限').setDescription('人數上限（不填則不限）').setRequired(false).setMinValue(1).setMaxValue(100)
  );

// 建立報名 Embed
function buildEmbed(state) {
  const { gameName, date, maxPlayers, creatorName, morning, afternoon, evening } = state;

  const totalPlayers = new Set([...morning, ...afternoon, ...evening]);
  const playerCount = totalPlayers.size;
  const limitText = maxPlayers ? `${playerCount} / ${maxPlayers}` : `${playerCount}`;

  const morningList = morning.length > 0 ? morning.map(p => p.name).join('、') : '—';
  const afternoonList = afternoon.length > 0 ? afternoon.map(p => p.name).join('、') : '—';
  const eveningList = evening.length > 0 ? evening.map(p => p.name).join('、') : '—';

  return new EmbedBuilder()
    .setColor(ORANGE)
    .setTitle(`🎮 ${gameName}`)
    .setDescription(
      `📅 **日期：**${date}\n` +
      `👥 **報名人數：**${limitText}\n` +
      `👑 **發起人：**${creatorName}\n\n` +
      `🌅 **早上**（${morning.length}人）：${morningList}\n\n` +
      `🌤️ **下午**（${afternoon.length}人）：${afternoonList}\n\n` +
      `🌙 **晚上**（${evening.length}人）：${eveningList}`
    )
    .setTimestamp();
}

function buildButtons(ts) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`signup_${ts}_morning`).setLabel('🌅 早上').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`signup_${ts}_afternoon`).setLabel('🌤️ 下午').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`signup_${ts}_evening`).setLabel('🌙 晚上').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`signup_${ts}_cancel`).setLabel('❌ 取消報名').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`signup_${ts}_delete`).setLabel('🗑️ 刪除此報名').setStyle(ButtonStyle.Danger),
    ),
  ];
}

// 執行 Slash Command
export async function execute(interaction) {
  if (interaction.channel.id !== CHANNEL_ID) {
    return interaction.reply({ content: '❌ 此指令只能在指定頻道使用！', ephemeral: true });
  }

  const gameName = interaction.options.getString('名稱');
  const date = interaction.options.getString('日期');
  const maxPlayers = interaction.options.getInteger('人數上限');
  const ts = Date.now();

  const state = {
    gameName,
    date,
    maxPlayers,
    creatorId: interaction.user.id,
    creatorName: interaction.member.displayName,
    morning: [],   // [{ id, name }]
    afternoon: [],
    evening: [],
    ts,
  };

  const msg = await interaction.reply({
    embeds: [buildEmbed(state)],
    components: buildButtons(ts),
    fetchReply: true,
  });

  signups.set(msg.id, state);

  // 長期 collector（24 小時）
  const collector = msg.createMessageComponentCollector({ time: 86400000 });

  collector.on('collect', async (i) => {
    const s = signups.get(msg.id);
    if (!s) { collector.stop(); return; }

    const action = i.customId.replace(`signup_${ts}_`, '');

    // 刪除報名（只有發起人）
    if (action === 'delete') {
      if (i.user.id !== s.creatorId) {
        return i.reply({ content: '❌ 只有發起人才能刪除！', ephemeral: true });
      }
      signups.delete(msg.id);
      collector.stop();
      await i.update({ content: '🗑️ 此報名已被刪除', embeds: [], components: [] });
      setTimeout(() => { msg.delete().catch(() => {}); }, 3000);
      return;
    }

    // 取消自己的報名
    if (action === 'cancel') {
      const userId = i.user.id;
      s.morning = s.morning.filter(p => p.id !== userId);
      s.afternoon = s.afternoon.filter(p => p.id !== userId);
      s.evening = s.evening.filter(p => p.id !== userId);
      await i.update({ embeds: [buildEmbed(s)], components: buildButtons(ts) });
      return;
    }

    // 選擇時段
    const slotMap = { morning: s.morning, afternoon: s.afternoon, evening: s.evening };
    const slot = slotMap[action];
    if (!slot) return;

    const userId = i.user.id;
    const userName = i.member.displayName;

    // 檢查人數上限
    if (s.maxPlayers) {
      const totalPlayers = new Set([...s.morning.map(p => p.id), ...s.afternoon.map(p => p.id), ...s.evening.map(p => p.id)]);
      if (!totalPlayers.has(userId) && totalPlayers.size >= s.maxPlayers) {
        return i.reply({ content: `❌ 已達人數上限 ${s.maxPlayers} 人！`, ephemeral: true });
      }
    }

    // 切換：已選 → 取消，未選 → 加入
    const existing = slot.findIndex(p => p.id === userId);
    if (existing >= 0) {
      slot.splice(existing, 1);
    } else {
      slot.push({ id: userId, name: userName });
    }

    await i.update({ embeds: [buildEmbed(s)], components: buildButtons(ts) });
  });

  collector.on('end', () => {
    signups.delete(msg.id);
    msg.edit({ components: [] }).catch(() => {});
  });
}


