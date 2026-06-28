import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, MessageFlags } from 'discord.js';

const GOLD = 0xFFD700;
const e = (text) => new EmbedBuilder().setColor(GOLD).setDescription(text);

// ─── 內建詞庫（300+）───
const DEFAULT_WORDS = [
  // 食物飲料
  '蘋果','巧克力','漢堡','泡麵','冰淇淋','珍珠奶茶','壽司','披薩','薯條','雞排',
  '棉花糖','爆米花','咖啡','拉麵','火鍋','牛排','蛋塔','芒果','西瓜','草莓',
  '麻辣鍋','鹹酥雞','豆花','臭豆腐','蔥油餅','水餃','湯圓','月餅','鳳梨酥','芋圓',
  // 動物
  '企鵝','恐龍','北極熊','貓頭鷹','章魚','螢火蟲','樹懶','海豚','長頸鹿','無尾熊',
  '變色龍','水母','獨角獸','河馬','紅鶴','穿山甲','海龜','蜂鳥','鯊魚','大象',
  '孔雀','鱷魚','蝴蝶','浣熊','刺蝟','貓熊','袋鼠','犀牛','蝸牛','螃蟹',
  // 自然景觀
  '月亮','彩虹','火山','瀑布','龍捲風','北極光','沙漠','海嘯','日出','銀河',
  '冰川','珊瑚礁','溫泉','流星','閃電','綠洲','峽谷','雪崩','深海','極光',
  // 日常物品
  '雨傘','鑽石','太陽眼鏡','橡皮擦','鬧鐘','口紅','高跟鞋','日記本','指南針','滅火器',
  '望遠鏡','防毒面具','降落傘','萬花筒','打字機','氣球','風箏','拼圖','蹺蹺板','溜滑梯',
  '存錢筒','保溫瓶','行李箱','安全帽','夾娃娃機','耳機','隨身碟','馬克杯','暖暖包','自拍棒',
  '紅包','骰子','放大鏡','計算機','OK繃','指甲剪','迴紋針','便利貼','泡泡紙','創可貼',
  // 建築地標
  '金字塔','吊橋','摩天輪','電梯','燈塔','城堡','教堂','鐘樓','摩天大樓','地下鐵',
  '自由女神','巴黎鐵塔','萬里長城','比薩斜塔','天空樹','雪梨歌劇院','台北101','迪士尼',
  // 職業人物
  '魔術師','考古學家','太空人','消防員','偵探','忍者','海盜','機長','廚師','畫家',
  '小丑','導遊','救生員','氣象播報員','牙醫','法官','特技演員','調酒師','園丁','礦工',
  // 交通工具
  '潛水艇','飛碟','直升機','熱氣球','雲霄飛車','纜車','獨木舟','摩托車','帆船','消防車',
  '冰淇淋車','垃圾車','救護車','坦克','三輪車','滑板','電動滑板車','高鐵','郵輪','太空梭',
  // 科技電子
  '機器人','藍芽','投影機','無人機','衛星','虛擬實境','人工智慧','3D列印','觸控螢幕','密碼鎖',
  // 節慶活動
  '聖誕節','萬聖節','跨年','中秋節','情人節','端午節','元宵節','母親節','愚人節','感恩節',
  // 運動遊戲
  '棒球','保齡球','衝浪','跳傘','攀岩','射箭','西洋棋','桌球','溜冰','躲避球',
  '飛盤','彈珠台','套圈圈','打地鼠','拔河','跳繩','呼拉圈','踩高蹺','騎馬','滑翔翼',
  // 抽象概念
  '時光機','隱形斗篷','許願池','記憶','平行宇宙','夢遊','心電感應','預知未來','迷宮','黑洞',
  '時差','靈感','默契','直覺','既視感','蝴蝶效應','因果報應','諧音梗','社死','內捲',
  // 文化娛樂
  '鋼琴','木乃伊','稻草人','仙人掌','竹蜻蜓','摺紙','魔術方塊','套娃','達摩','招財貓',
  '風鈴','許願燈','沙漏','水晶球','塔羅牌','捕夢網','幸運草','雪花球','音樂盒','走馬燈',
  // 台灣特色
  '夜市','天燈','珍珠','鼎泰豐','九份','阿里山','日月潭','墾丁','媽祖','歌仔戲',
  '布袋戲','辦桌','機車瀑布','悠遊卡','超商','騎樓','鐵皮屋','檳榔','電音三太子','搶孤',
];

const ROLE_NAMES = {
  mayor: '👑 村長', wolf: '🐺 狼人', seer: '🔮 先知', villager: '👤 村民',
};

// ─── 狀態 ───
const state = {
  phase: 'idle', hostId: null, channelId: null, guild: null,
  players: [], word: null,
  order: [], orderIndex: 0, round: 1, maxRounds: 5,
  mayorId: null, collectors: [], turnTimer: null, turnTimeLimit: 0,
  qaRecords: [],
};

function reset() {
  state.collectors.forEach(c => { try { c.stop(); } catch {} });
  if (state.turnTimer) { clearTimeout(state.turnTimer); state.turnTimer = null; }
  Object.assign(state, {
    phase: 'idle', hostId: null, channelId: null, guild: null,
    players: [], word: null, order: [], orderIndex: 0,
    round: 1, maxRounds: 5, mayorId: null, collectors: [], turnTimer: null, turnTimeLimit: 0,
    qaRecords: [],
  });
}

function findPlayer(id) { return state.players.find(p => p.id === id); }

// DM QA紀錄給非村長的玩家
async function sendQARecords(guild) {
  if (state.qaRecords.length === 0) return;
  let currentRound = 0;
  let recordText = '📝 **提問紀錄：**\n';
  for (const r of state.qaRecords) {
    if (r.round !== currentRound) {
      currentRound = r.round;
      recordText += `\n**── 第 ${currentRound} 輪 ──**\n`;
    }
    recordText += `${r.asker}：「${r.question}」→ ${r.answer}\n`;
  }
  for (const p of state.players) {
    if (p.id === state.mayorId) continue;
    try {
      const member = await guild.members.fetch(p.id);
      await member.send({ embeds: [e(recordText)] });
    } catch {}
  }
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getRoleConfig(count) {
  if (count <= 6) return { mayor: 1, wolf: 1, seer: 1, villager: count - 3 };
  return { mayor: 1, wolf: 2, seer: 1, villager: count - 4 };
}

// ─── 村長回答面板（含「正確」按鈕）───
async function showMayorPanel(channel, content, askerName) {
  const ts = Date.now();
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mra_${ts}_yes`).setLabel('✅ 是').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`mra_${ts}_no`).setLabel('❌ 否').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`mra_${ts}_close`).setLabel('🤏 接近了').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`mra_${ts}_far`).setLabel('🚫 差很多').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`mra_${ts}_unsure`).setLabel('❓ 不確定').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mra_${ts}_correct`).setLabel('🎯 正確！').setStyle(ButtonStyle.Primary),
  );

  const msg = await channel.send({
    embeds: [e(`💬 **${askerName}**：「${content}」\n\n👑 村長請用按鈕回答：`)],
    components: [row1, row2],
  });

  return new Promise((resolve) => {
    const collector = msg.createMessageComponentCollector({
      filter: i => i.customId.startsWith(`mra_${ts}_`) && i.user.id === state.mayorId,
      max: 1, time: 300000,
    });
    collector.on('collect', async (i) => {
      const answer = i.customId.replace(`mra_${ts}_`, '');
      const labels = {
        yes: '✅ 是', no: '❌ 否', close: '🤏 接近了',
        far: '🚫 差很多', unsure: '❓ 不確定', correct: '🎯 正確！',
      };
      await i.update({
        embeds: [e(`💬 **${askerName}**：「${content}」\n\n👑 村長回答：**${labels[answer]}**`)],
        components: [],
      });
      state.qaRecords.push({ round: state.round, asker: askerName, question: content, answer: labels[answer] });
      // DM 累加 QA 紀錄給非村長的玩家
      await sendQARecords(channel.guild);
      resolve(answer);
    });
    collector.on('end', (c) => {
      if (c.size === 0) {
        msg.edit({ embeds: [e(`💬 **${askerName}**：「${content}」\n\n👑 村長未回答（超時）`)], components: [] }).catch(() => {});
        state.qaRecords.push({ round: state.round, asker: askerName, question: content, answer: '⏰ 超時' });
        resolve(null);
      }
    });
    state.collectors.push(collector);
  });
}

// ─── 開始回合 ───
async function startTurn(channel) {
  if (state.phase !== 'playing') return;
  if (state.turnTimer) { clearTimeout(state.turnTimer); state.turnTimer = null; }

  const currentPlayerId = state.order[state.orderIndex];
  const mayor = findPlayer(state.mayorId);
  const timeInfo = state.turnTimeLimit > 0 ? ` ｜ ⏱️ ${state.turnTimeLimit / 60000} 分鐘` : '';

  const orderList = state.order.map((id, i) => {
    const p = findPlayer(id);
    const arrow = id === currentPlayerId ? '➡️ ' : '　　';
    return `${arrow}${i + 1}. ${p.name}`;
  }).join('\n');

  // 抓狼按鈕
  const ts = Date.now();
  const catchRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`catchwolf_${ts}`)
      .setLabel('🔮 抓狼人')
      .setStyle(ButtonStyle.Danger)
  );

  const turnMsg = await channel.send({
    content: `<@${currentPlayerId}>`,
    embeds: [e(`👑 村長：**${mayor.name}**\n\n📋 提問順序：\n${orderList}\n\n🎯 輪到 **${findPlayer(currentPlayerId).name}**！\n用 \`!wwg 內容\` 提問或猜詞，或 \`!wwp\` 跳過\n\n第 ${state.round} / ${state.maxRounds} 輪${timeInfo}`)],
    components: [catchRow],
  });

  // 抓狼按鈕 collector（不設 max，讓多人可以嘗試按）
  const catchCollector = turnMsg.createMessageComponentCollector({
    filter: i => i.customId === `catchwolf_${ts}`,
    time: state.turnTimeLimit > 0 ? state.turnTimeLimit : 3600000,
  });

  catchCollector.on('collect', async (i) => {
    try {
      const player = findPlayer(i.user.id);
      if (!player || player.role !== 'seer') {
        return i.reply({ embeds: [e('❌ 你無法使用這個技能！')], flags: MessageFlags.Ephemeral });
      }

      // 先 defer 避免超時
      await i.deferReply({ flags: MessageFlags.Ephemeral });

      // 先知選擇要抓的人
      const candidates = state.players.filter(p => p.id !== i.user.id && p.role !== 'mayor');
      const pickTs = Date.now();
      const pickRows = [];
      for (let j = 0; j < candidates.length; j += 5) {
        const row = new ActionRowBuilder();
        for (const c of candidates.slice(j, j + 5)) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`pickwolf_${pickTs}_${c.id}`)
              .setLabel(c.name)
              .setStyle(ButtonStyle.Secondary)
          );
        }
        pickRows.push(row);
      }

      const replyMsg = await i.editReply({
        embeds: [e('🔮 **選擇你認為的狼人：**\n\n抓對 → 好人勝利\n抓錯 → 狼人勝利')],
        components: pickRows,
      });

      // 用 awaitMessageComponent 等待先知選人
      try {
        const pi = await replyMsg.awaitMessageComponent({
          filter: pi => pi.customId.startsWith(`pickwolf_${pickTs}_`) && pi.user.id === i.user.id,
          time: 60000,
        });

        if (state.phase !== 'playing') return;
        const targetId = pi.customId.replace(`pickwolf_${pickTs}_`, '');
        const target = findPlayer(targetId);
        const isWolf = target?.role === 'wolf';
        const roleList = state.players.map(p => `${p.name} — ${ROLE_NAMES[p.role]}`).join('\n');

        if (state.turnTimer) { clearTimeout(state.turnTimer); state.turnTimer = null; }
        catchCollector.stop();
        await turnMsg.edit({ components: [] }).catch(() => {});

        if (isWolf) {
          await channel.send({ embeds: [e(`🔮 **有人發動了技能，抓到了 ${target.name} 是狼人！**\n\n🔑 答案是：**${state.word}**\n\n🎉🎉🎉 **好人陣營勝利！**\n\n📋 **角色公布：**\n${roleList}`)] });
        } else {
          await channel.send({ embeds: [e(`🔮 **有人發動了技能，但 ${target.name} 不是狼人！**\n\n🔑 答案是：**${state.word}**\n\n🐺🐺🐺 **狼人陣營勝利！**\n\n📋 **角色公布：**\n${roleList}`)] });
        }
        await pi.update({ embeds: [e(isWolf ? '✅ 抓對了！' : '❌ 抓錯了！')], components: [] }).catch(() => {});
        await sendQARecords(channel.guild);
        reset();
      } catch {
        // 先知超時沒選人
        await i.editReply({ embeds: [e('⏰ 超時，取消抓狼。')], components: [] }).catch(() => {});
      }
    } catch (err) {
      console.error('[狼人真言] 抓狼按鈕錯誤:', err);
      i.reply({ embeds: [e('❌ 發生錯誤，請再試一次')], flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });
  state.collectors.push(catchCollector);

  if (state.turnTimeLimit > 0) {
    state.turnTimer = setTimeout(async () => {
      if (state.phase !== 'playing') return;
      catchCollector.stop();
      await turnMsg.edit({ components: [] }).catch(() => {});
      const player = findPlayer(currentPlayerId);
      await channel.send({ embeds: [e(`⏰ **${player?.name}** 超時，自動跳過！`)] });
      await advanceTurn(channel);
    }, state.turnTimeLimit);
  }
}

// 推進回合
async function advanceTurn(channel) {
  if (state.phase !== 'playing') return;
  state.orderIndex++;
  if (state.orderIndex >= state.order.length) {
    state.orderIndex = 0;
    state.round++;
    if (state.round > state.maxRounds) {
      await channel.send({ embeds: [e(`⏰ **${state.maxRounds} 輪已結束！沒有人猜出答案。**\n答案是：**${state.word}**\n\n接下來投票猜誰是狼人...`)] });
      await startVillagerVote(channel);
      return;
    }
    await channel.send({ embeds: [e(`📋 **第 ${state.round} 輪開始！**`)] });
  }
  await startTurn(channel);
}

// ─── 狼人投票猜先知（猜對答案後）───
async function startWolfVote(channel) {
  state.phase = 'wolf_vote';
  const wolves = state.players.filter(p => p.role === 'wolf');
  const candidates = state.players.filter(p => p.role !== 'wolf' && p.role !== 'mayor');

  const ts = Date.now();
  const rows = [];
  for (let i = 0; i < candidates.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const p of candidates.slice(i, i + 5)) {
      row.addComponents(new ButtonBuilder().setCustomId(`wvote_${ts}_${p.id}`).setLabel(p.name).setStyle(ButtonStyle.Secondary));
    }
    rows.push(row);
  }

  const wolfMentions = wolves.map(w => `<@${w.id}>`).join(' ');
  const wolfDisplayNames = wolves.map(w => `**${w.name}**`).join('、');
  const msg = await channel.send({
    content: wolfMentions,
    embeds: [e(`🐺 **狼人投票時間！**\n\n${wolfDisplayNames}，猜猜誰是先知？\n猜中 → 狼人勝利！猜不中 → 好人勝利！`)],
    components: rows,
  });

  const wolfIds = new Set(wolves.map(w => w.id));
  const collector = msg.createMessageComponentCollector({
    filter: i => i.customId.startsWith(`wvote_${ts}_`) && wolfIds.has(i.user.id),
    max: 1, time: 300000,
  });
  collector.on('collect', async (i) => {
    const targetId = i.customId.replace(`wvote_${ts}_`, '');
    const target = findPlayer(targetId);
    const isSeer = target?.role === 'seer';
    await i.update({ components: [] });
    const roleList = state.players.map(p => `${p.name} — ${ROLE_NAMES[p.role]}`).join('\n');
    if (isSeer) {
      await channel.send({ embeds: [e(`🐺 **狼人猜中了！** ${target.name} 就是先知！\n\n🐺🐺🐺 **狼人陣營勝利！**\n\n📋 **角色公布：**\n${roleList}`)] });
    } else {
      await channel.send({ embeds: [e(`🐺 狼人猜了 ${target.name}，但不是先知！\n\n🎉🎉🎉 **好人陣營勝利！**\n\n📋 **角色公布：**\n${roleList}`)] });
    }
    await sendQARecords(channel.guild);
    reset();
  });
  collector.on('end', (c) => {
    if (c.size === 0) {
      const roleList = state.players.map(p => `${p.name} — ${ROLE_NAMES[p.role]}`).join('\n');
      channel.send({ embeds: [e(`⏰ 狼人未投票，好人陣營勝利！\n\n📋 **角色公布：**\n${roleList}`)] });
      sendQARecords(channel.guild);
      reset();
    }
  });
  state.collectors.push(collector);
}

// ─── 村民投票猜狼人（沒猜出答案後）───
async function startVillagerVote(channel) {
  state.phase = 'villager_vote';
  const voters = state.players.filter(p => p.role !== 'mayor');
  const candidates = state.players.filter(p => p.role !== 'mayor');
  const votes = new Map();
  const ts = Date.now();

  function buildVoteEmbed() {
    let text = '🗳️ **投票猜狼人！**\n\n點按鈕投票，可以改票。主持人按確認後結算。\n\n';
    const tally = {};
    for (const [voterId, targetId] of votes) {
      if (!tally[targetId]) tally[targetId] = [];
      tally[targetId].push(findPlayer(voterId)?.name);
    }
    if (Object.keys(tally).length === 0) {
      text += '目前還沒有人投票。';
    } else {
      for (const [tid, vnames] of Object.entries(tally)) {
        text += `**${findPlayer(tid)?.name}**（${vnames.length} 票）：${vnames.join('、')}\n`;
      }
    }
    text += `\n已投票：${votes.size} / ${voters.length}`;
    return e(text);
  }

  function buildComponents() {
    const rows = [];
    for (let i = 0; i < candidates.length; i += 5) {
      const row = new ActionRowBuilder();
      for (const p of candidates.slice(i, i + 5)) {
        row.addComponents(new ButtonBuilder().setCustomId(`cvote_${ts}_${p.id}`).setLabel(p.name).setStyle(ButtonStyle.Secondary));
      }
      rows.push(row);
    }
    if (rows.length < 5) {
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cvoteconfirm_${ts}`).setLabel('✅ 確認結算').setStyle(ButtonStyle.Success)
      ));
    }
    return rows;
  }

  const msg = await channel.send({ embeds: [buildVoteEmbed()], components: buildComponents() });
  const voterIds = new Set(voters.map(v => v.id));
  const collector = msg.createMessageComponentCollector({
    filter: i => i.customId.startsWith(`cvote_${ts}_`) || i.customId === `cvoteconfirm_${ts}`,
    time: 3600000,
  });

  collector.on('collect', async (i) => {
    if (i.customId === `cvoteconfirm_${ts}`) {
      if (i.user.id !== state.hostId) return i.reply({ embeds: [e('❌ 只有主持人才能確認結算！')], flags: MessageFlags.Ephemeral });
      collector.stop();
      await i.update({ components: [] });
      const tally = {};
      for (const [, tid] of votes) tally[tid] = (tally[tid] || 0) + 1;
      const roleList = state.players.map(p => `${p.name} — ${ROLE_NAMES[p.role]}`).join('\n');
      if (Object.keys(tally).length === 0) {
        await channel.send({ embeds: [e(`沒有人投票！\n\n🐺🐺🐺 **狼人陣營勝利！**\n\n📋 **角色公布：**\n${roleList}`)] });
        await sendQARecords(channel.guild); reset(); return;
      }
      const maxVotes = Math.max(...Object.values(tally));
      const topIds = Object.keys(tally).filter(id => tally[id] === maxVotes);
      if (topIds.length > 1) {
        await channel.send({ embeds: [e(`⚖️ 平票！\n\n🐺🐺🐺 **狼人陣營勝利！**\n\n📋 **角色公布：**\n${roleList}`)] });
        await sendQARecords(channel.guild); reset(); return;
      }
      const voted = findPlayer(topIds[0]);
      if (voted?.role === 'wolf') {
        await channel.send({ embeds: [e(`🎯 **${voted.name}** 被票選出局，是狼人！\n\n🎉🎉🎉 **好人陣營勝利！**\n\n📋 **角色公布：**\n${roleList}`)] });
      } else {
        await channel.send({ embeds: [e(`😱 **${voted.name}** 被票選出局，但不是狼人！\n\n🐺🐺🐺 **狼人陣營勝利！**\n\n📋 **角色公布：**\n${roleList}`)] });
      }
      await sendQARecords(channel.guild); reset(); return;
    }
    if (!voterIds.has(i.user.id)) return i.reply({ embeds: [e('❌ 你不在這局遊戲中！')], flags: MessageFlags.Ephemeral });
    const targetId = i.customId.replace(`cvote_${ts}_`, '');
    votes.set(i.user.id, targetId);
    await i.update({ embeds: [buildVoteEmbed()], components: buildComponents() });
  });
  state.collectors.push(collector);
}

// ─── 指令 ───
const commands = {
  async wws(message) {
    if (state.phase !== 'idle') return message.reply({ embeds: [e('❌ 目前已有一局狼人真言進行中！')] });
    reset();
    state.phase = 'waiting'; state.hostId = message.author.id;
    state.channelId = message.channel.id; state.guild = message.guild;
    state.players.push({ id: message.author.id, name: message.member.displayName, role: null });
    message.channel.send({ embeds: [e(`🔮 **狼人真言開局！**\n👑 主持人：${message.member.displayName}\n\n輸入 \`!wwj\` 加入遊戲\n主持人輸入 \`!wwb\` 開始遊戲（至少 4 人）\n\n目前玩家（1人）：${message.member.displayName}`)] });
  },

  async wwj(message) {
    if (state.phase !== 'waiting') return message.reply({ embeds: [e('❌ 目前沒有開放加入的狼人真言局！')] });
    if (state.players.find(p => p.id === message.author.id)) return message.reply({ embeds: [e('❌ 你已經加入了！')] });
    if (state.players.length >= 10) return message.reply({ embeds: [e('❌ 已滿 10 人！')] });
    state.players.push({ id: message.author.id, name: message.member.displayName, role: null });
    const names = state.players.map(p => p.name).join('、');
    message.channel.send({ embeds: [e(`✅ **${message.member.displayName}** 加入狼人真言！\n目前玩家（${state.players.length}人）：${names}`)] });
  },

  async wwb(message) {
    if (state.phase !== 'waiting') return message.reply({ embeds: [e('❌ 目前沒有等待中的狼人真言局！')] });
    if (message.author.id !== state.hostId) return message.reply({ embeds: [e('❌ 只有主持人才能開始遊戲！')] });
    if (state.players.length < 4) return message.reply({ embeds: [e('❌ 至少需要 4 人！')] });

    const config = getRoleConfig(state.players.length);
    const roles = [];
    for (const [role, num] of Object.entries(config)) { for (let i = 0; i < num; i++) roles.push(role); }
    const shuffled = shuffle(roles);
    state.players.forEach((p, i) => { p.role = shuffled[i]; });

    const mayor = state.players.find(p => p.role === 'mayor');
    state.mayorId = mayor.id;
    state.guild = message.guild;

    // 1. 先私訊角色給每個人（還沒有詞彙）
    for (const p of state.players) {
      try {
        const member = await message.guild.members.fetch(p.id);
        await member.send({ embeds: [e(`你的角色是：${ROLE_NAMES[p.role]}`)] });
      } catch {
        await message.channel.send({ embeds: [e(`⚠️ 無法私訊 ${p.name}！`)] });
      }
    }

    // 2. 公布村長
    await message.channel.send({ embeds: [e(`🔮 **角色已分配！請查看 DM**\n\n👑 村長是：**${mayor.name}**`)] });

    // 3. 村長選擇限時
    const tsTime = Date.now();
    const timeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`timelimit_${tsTime}_0`).setLabel('⏳ 不限時').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`timelimit_${tsTime}_120`).setLabel('⏱️ 2 分鐘').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`timelimit_${tsTime}_180`).setLabel('⏱️ 3 分鐘').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`timelimit_${tsTime}_300`).setLabel('⏱️ 5 分鐘').setStyle(ButtonStyle.Primary),
    );
    const timeMsg = await message.channel.send({
      content: `<@${mayor.id}>`,
      embeds: [e(`⏱️ **村長請選擇每回合限時：**`)],
      components: [timeRow],
    });

    state.turnTimeLimit = await new Promise((resolve) => {
      const collector = timeMsg.createMessageComponentCollector({
        filter: i => i.customId.startsWith(`timelimit_${tsTime}_`) && i.user.id === state.mayorId,
        max: 1, time: 60000,
      });
      collector.on('collect', async (i) => {
        const seconds = parseInt(i.customId.replace(`timelimit_${tsTime}_`, ''));
        const label = seconds === 0 ? '不限時' : `${seconds / 60} 分鐘`;
        await i.update({ embeds: [e(`⏱️ 每回合限時：**${label}**`)], components: [] });
        resolve(seconds * 1000);
      });
      collector.on('end', (c) => {
        if (c.size === 0) {
          timeMsg.edit({ embeds: [e('⏱️ 村長超時，預設不限時')], components: [] }).catch(() => {});
          resolve(0);
        }
      });
      state.collectors.push(collector);
    });

    // 如果等待期間被取消了，中止
    if (state.phase === 'idle') return;

    // 3.5 村長選擇回合數
    const tsRound = Date.now();
    const roundRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`roundlimit_${tsRound}_3`).setLabel('3 輪').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`roundlimit_${tsRound}_5`).setLabel('5 輪').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`roundlimit_${tsRound}_7`).setLabel('7 輪').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`roundlimit_${tsRound}_10`).setLabel('10 輪').setStyle(ButtonStyle.Secondary),
    );
    const roundMsg = await message.channel.send({
      embeds: [e(`📋 **村長請選擇回合數：**`)],
      components: [roundRow],
    });

    state.maxRounds = await new Promise((resolve) => {
      const collector = roundMsg.createMessageComponentCollector({
        filter: i => i.customId.startsWith(`roundlimit_${tsRound}_`) && i.user.id === state.mayorId,
        max: 1, time: 60000,
      });
      collector.on('collect', async (i) => {
        const rounds = parseInt(i.customId.replace(`roundlimit_${tsRound}_`, ''));
        await i.update({ embeds: [e(`📋 回合數：**${rounds} 輪**`)], components: [] });
        resolve(rounds);
      });
      collector.on('end', (c) => {
        if (c.size === 0) {
          roundMsg.edit({ embeds: [e('📋 村長超時，預設 5 輪')], components: [] }).catch(() => {});
          resolve(5);
        }
      });
      state.collectors.push(collector);
    });

    // 如果等待期間被取消了，中止
    if (state.phase === 'idle') return;

    // 4. 頻道內讓村長設定詞彙
    const ts = Date.now();
    const setupRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`wordsetup_${ts}_custom`).setLabel('✏️ 自訂詞彙').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`wordsetup_${ts}_random`).setLabel('🎲 隨機選詞').setStyle(ButtonStyle.Secondary),
    );
    const setupMsg = await message.channel.send({
      embeds: [e(`👑 **等待村長設定詞彙...**`)],
      components: [setupRow],
    });

    const word = await new Promise((resolve) => {
      const collector = setupMsg.createMessageComponentCollector({
        filter: i => i.customId.startsWith(`wordsetup_${ts}_`) && i.user.id === mayor.id,
        time: 120000,
      });
      collector.on('collect', async (i) => {
        if (i.customId === `wordsetup_${ts}_random`) {
          collector.stop();
          const w = DEFAULT_WORDS[Math.floor(Math.random() * DEFAULT_WORDS.length)];
          await i.update({ embeds: [e(`👑 村長已設定詞彙！\n\n🎲 來源：**隨機選詞**\n📝 字數：**${w.length} 個字**`)], components: [] });
          await i.followUp({ embeds: [e(`👑 你設定的詞彙是：**${w}**\n（只有你看得到）`)], flags: MessageFlags.Ephemeral });
          resolve(w);
        } else {
          const modal = new ModalBuilder()
            .setCustomId(`wordmodal_${ts}`)
            .setTitle('設定魔法咒語')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('word_input')
                  .setLabel('輸入你的詞彙')
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder('例如：蘋果')
                  .setRequired(true)
                  .setMaxLength(20)
              )
            );
          await i.showModal(modal);
          try {
            const submitted = await i.awaitModalSubmit({ time: 120000 });
            collector.stop();
            const w = submitted.fields.getTextInputValue('word_input').trim();
            await setupMsg.edit({ embeds: [e(`👑 村長已設定詞彙！\n\n✏️ 來源：**自訂詞彙**\n📝 字數：**${w.length} 個字**`)], components: [] });
            await submitted.reply({ embeds: [e(`👑 你設定的詞彙是：**${w}**\n（只有你看得到）`)], flags: MessageFlags.Ephemeral });
            resolve(w);
          } catch {
            // Modal 被取消，不做任何事，讓村長可以再按一次按鈕
          }
        }
      });
      collector.on('end', (c, reason) => {
        if (reason === 'time') {
          const w = DEFAULT_WORDS[Math.floor(Math.random() * DEFAULT_WORDS.length)];
          setupMsg.edit({ embeds: [e(`👑 村長超時，已隨機選詞！\n\n🎲 來源：**隨機選詞**\n📝 字數：**${w.length} 個字**`)], components: [] }).catch(() => {});
          resolve(w);
        }
      });
      state.collectors.push(collector);
    });

    state.word = word;

    // 如果等待期間被取消了，中止
    if (state.phase === 'idle') return;

    // 如果設定期間有人離開導致人數不足，中止
    if (state.players.length < 4) {
      reset();
      return message.channel.send({ embeds: [e('❌ 設定期間有人離開，玩家不足 4 人，遊戲取消！')] });
    }

    // 5. 私訊詞彙給村長、狼人、先知
    for (const p of state.players) {
      if (p.role === 'mayor' || p.role === 'wolf' || p.role === 'seer') {
        try {
          const member = await message.guild.members.fetch(p.id);
          await member.send({ embeds: [e(`🔑 魔法咒語是：**${state.word}**`)] });
        } catch {}
      }
    }

    // 6. 設定提問順序（不含村長）
    state.order = shuffle(state.players.filter(p => p.role !== 'mayor').map(p => p.id));
    state.orderIndex = 0; state.round = 1; state.phase = 'playing';

    const finalMayor = findPlayer(state.mayorId);
    const orderNames = state.order.map((id, i) => `${i + 1}. ${findPlayer(id).name}`).join('\n');
    await message.channel.send({ embeds: [e(`🔮 **狼人真言開始！共 ${state.players.length} 人**\n\n👑 村長：**${finalMayor.name}**\n\n📋 提問順序：\n${orderNames}\n\n共 ${state.maxRounds} 輪機會，開始！`)] });
    await startTurn(message.channel);
  },

  async wwg(message, args) {
    if (state.phase !== 'playing') return message.reply({ embeds: [e('❌ 目前沒有進行中的狼人真言！')] });
    const currentPlayerId = state.order[state.orderIndex];
    if (message.author.id !== currentPlayerId) {
      return message.reply({ embeds: [e(`❌ 現在輪到 **${findPlayer(currentPlayerId)?.name}**，還沒輪到你！`)] });
    }
    const content = args.join(' ').trim();
    if (!content) return message.reply({ embeds: [e('❌ 請輸入內容！例如 `!wwg 是動物嗎` 或 `!wwg 蘋果`')] });

    // 清除計時器
    if (state.turnTimer) { clearTimeout(state.turnTimer); state.turnTimer = null; }

    // 顯示村長回答面板
    const answer = await showMayorPanel(message.channel, content, findPlayer(currentPlayerId).name);

    // 村長按了「正確」
    if (answer === 'correct') {
      await message.channel.send({ embeds: [e(`🎉 **答案猜中了！**\n\n🔑 答案是：**${state.word}**\n\n接下來狼人要猜出誰是先知...`)] });
      await startWolfVote(message.channel);
      return;
    }

    // 其他回答 → 下一個人
    await advanceTurn(message.channel);
  },

  async wwp(message) {
    if (state.phase !== 'playing') return;
    const currentPlayerId = state.order[state.orderIndex];
    if (message.author.id !== currentPlayerId) return;
    if (state.turnTimer) { clearTimeout(state.turnTimer); state.turnTimer = null; }
    await message.channel.send({ embeds: [e(`⏭️ **${findPlayer(currentPlayerId).name}** 跳過了這回合。`)] });
    await advanceTurn(message.channel);
  },

  async wwq(message) {
    if (state.phase === 'idle') return message.reply({ embeds: [e('❌ 目前沒有進行中的狼人真言局！')] });
    const isHost = message.author.id === state.hostId;
    const isAdmin = message.author.id === process.env.ANNOUNCE_ADMIN_ID;
    const isPlayer = state.players.some(p => p.id === message.author.id);
    if (!isHost && !isAdmin && !isPlayer) return message.reply({ embeds: [e('❌ 只有參加的玩家才能取消遊戲！')] });
    const roleList = state.players.filter(p => p.role).map(p => `${p.name} — ${ROLE_NAMES[p.role]}`).join('\n');
    const wordInfo = state.word ? `\n🔑 答案是：**${state.word}**` : '';
    reset();
    message.channel.send({ embeds: [e(`🚫 **${message.member.displayName}** 取消了狼人真言！${wordInfo}\n\n${roleList ? `📋 角色公布：\n${roleList}` : ''}`)] });
  },

  async wwl(message) {
    if (state.phase === 'idle') return message.reply({ embeds: [e('❌ 目前沒有進行中的狼人真言局！')] });
    const pi = state.players.findIndex(p => p.id === message.author.id);
    if (pi === -1) return message.reply({ embeds: [e('❌ 你沒有加入這局狼人真言！')] });
    const playerName = message.member.displayName;

    if (state.phase === 'waiting') {
      state.players.splice(pi, 1);
      if (message.author.id === state.hostId && state.players.length > 0) {
        state.hostId = state.players[0].id;
        return message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了！\n👑 主持人轉移給 **${state.players[0].name}**`)] });
      }
      if (state.players.length === 0) { reset(); return; }
      return message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了！\n目前玩家（${state.players.length}人）：${state.players.map(p => p.name).join('、')}`)] });
    }

    const roleList = state.players.filter(p => p.role).map(p => `${p.name} — ${ROLE_NAMES[p.role]}`).join('\n');
    const wordInfo = state.word ? `\n🔑 答案是：**${state.word}**` : '';
    reset();
    message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了，遊戲中斷！${wordInfo}\n\n📋 角色公布：\n${roleList}`)] });
  },
};

export default commands;
