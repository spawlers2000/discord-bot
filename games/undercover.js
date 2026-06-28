import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

const GOLD = 0xFFD700;
const e = (text) => new EmbedBuilder().setColor(GOLD).setDescription(text);

// ─── 內建詞組（平民詞, 臥底詞）───
const WORD_PAIRS = [
  ['蘋果','芭樂'],['咖啡','可可'],['牛奶','豆漿'],['漢堡','三明治'],['薯條','洋蔥圈'],
  ['巧克力','牛奶糖'],['可樂','雪碧'],['珍珠奶茶','冬瓜茶'],['拉麵','烏龍麵'],['牛排','豬排'],
  ['水餃','餛飩'],['蛋糕','麵包'],['冰淇淋','霜淇淋'],['披薩','烤餅'],['壽司','生魚片'],
  ['啤酒','汽水'],['咖哩','味噌'],['布丁','果凍'],['鬆餅','可麗餅'],['臭豆腐','豆腐乳'],
  ['貓','狗'],['獅子','老虎'],['海豚','鯨魚'],['蝴蝶','蜻蜓'],['烏龜','蝸牛'],
  ['企鵝','海鷗'],['兔子','松鼠'],['鱷魚','蜥蜴'],['蜜蜂','黃蜂'],['貓頭鷹','老鷹'],
  ['公車','計程車'],['火車','高鐵'],['腳踏車','機車'],['飛機','直升機'],['輪船','帆船'],
  ['捷運','公車'],['救護車','消防車'],['滑板','溜冰鞋'],['熱氣球','降落傘'],['獨木舟','竹筏'],
  ['籃球','排球'],['足球','橄欖球'],['桌球','羽毛球'],['棒球','壘球'],['游泳','潛水'],
  ['瑜伽','皮拉提斯'],['拳擊','跆拳道'],['保齡球','撞球'],['滑雪','滑冰'],['衝浪','風帆'],
  ['醫生','護士'],['老師','教授'],['律師','法官'],['警察','保鏢'],['廚師','烘焙師'],
  ['畫家','雕刻家'],['歌手','DJ'],['演員','導演'],['記者','主播'],['消防員','救生員'],
  ['沙發','椅子'],['枕頭','抱枕'],['窗戶','門'],['電扇','冷氣'],['檯燈','吊燈'],
  ['牙刷','牙線'],['毛巾','浴巾'],['雨傘','陽傘'],['手錶','時鐘'],['眼鏡','墨鏡'],
  ['鋼琴','電子琴'],['吉他','烏克麗麗'],['小提琴','大提琴'],['鼓','鈴鼓'],['口琴','笛子'],
  ['電影院','劇場'],['遊樂園','動物園'],['圖書館','書店'],['餐廳','咖啡廳'],['醫院','診所'],
  ['學校','補習班'],['超市','便利商店'],['公園','廣場'],['博物館','美術館'],['百貨公司','夜市'],
  ['聖誕節','跨年'],['中秋節','端午節'],['情人節','七夕'],['萬聖節','鬼月'],['母親節','父親節'],
  ['太陽','月亮'],['星星','流星'],['雲','霧'],['彩虹','極光'],['海','湖'],
  ['山','丘陵'],['沙漠','草原'],['瀑布','噴泉'],['地震','颱風'],['雪','冰雹'],
  ['微信','LINE'],['YouTube','抖音'],['Google','百度'],['Instagram','Facebook'],['Twitter','Threads'],
  ['筷子','叉子'],['碗','盤子'],['鍋子','平底鍋'],['杯子','瓶子'],['吸管','湯匙'],
  ['口罩','面罩'],['手套','襪子'],['帽子','頭巾'],['圍巾','領帶'],['外套','背心'],
  ['照片','畫'],['日記','小說'],['信','明信片'],['地圖','指南針'],['鑰匙','鎖'],
  ['肥皂','洗手乳'],['洗髮精','沐浴乳'],['牙膏','漱口水'],['防曬乳','乳液'],['香水','體香劑'],
];

// ─── 角色配置 ───
function getRoleConfig(count) {
  if (count <= 6) return { civilian: count - 1, spy: 1, blank: 0 };
  if (count === 7) return { civilian: count - 2, spy: 1, blank: 1 };
  return { civilian: count - 3, spy: 2, blank: 1 };
}

// ─── 狀態 ───
const state = {
  phase: 'idle', hostId: null, channelId: null, guild: null,
  players: [], order: [], orderIndex: 0,
  round: 1, maxRounds: 0,
  wordPair: null,
  votes: new Map(), voteMsg: null,
  collectors: [],
};

function reset() {
  state.collectors.forEach(c => { try { c.stop(); } catch {} });
  Object.assign(state, {
    phase: 'idle', hostId: null, channelId: null, guild: null,
    players: [], order: [], orderIndex: 0,
    round: 1, maxRounds: 0,
    wordPair: null,
    votes: new Map(), voteMsg: null,
    collectors: [],
  });
}

function findPlayer(id) { return state.players.find(p => p.id === id); }
function getAlivePlayers() { return state.players.filter(p => p.alive); }

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 檢查勝負
function checkWin() {
  const alive = getAlivePlayers();
  const spies = alive.filter(p => p.role === 'spy');
  const civilians = alive.filter(p => p.role === 'civilian');

  if (spies.length === 0) return 'civilian'; // 所有臥底被投出
  if (civilians.length === 0) return 'spy';   // 場上沒有平民
  return null;
}

// ─── 描述回合 ───
async function startDescribePhase(channel) {
  state.phase = 'describing';
  state.orderIndex = 0;

  const aliveOrder = state.order.filter(id => findPlayer(id)?.alive);
  state.order = aliveOrder;

  await channel.send({ embeds: [e(`📢 **第 ${state.round} 輪開始！**\n\n輪流描述你的詞彙，描述完按「✅ 描述完成」換下一位。\n⚠️ 不能直接說出詞彙！`)] });
  await startDescribeTurn(channel);
}

async function startDescribeTurn(channel) {
  if (state.phase !== 'describing') return;
  if (state.orderIndex >= state.order.length) {
    // 所有人都描述完了，進入投票
    await startVoting(channel);
    return;
  }

  const currentId = state.order[state.orderIndex];
  const currentPlayer = findPlayer(currentId);
  const ts = Date.now();

  const orderList = state.order.map((id, i) => {
    const p = findPlayer(id);
    const arrow = i === state.orderIndex ? '➡️ ' : '　　';
    const status = i < state.orderIndex ? '✅' : '⏳';
    return `${arrow}${i + 1}. ${p.name} ${i < state.orderIndex ? status : ''}`;
  }).join('\n');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`describe_done_${ts}`)
      .setLabel('✅ 描述完成')
      .setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({
    content: `<@${currentId}>`,
    embeds: [e(`📋 描述順序：\n${orderList}\n\n🎯 輪到 **${currentPlayer.name}** 描述！\n\n請用一句話描述你的詞彙，說完按「✅ 描述完成」\n\n第 ${state.round} 輪`)],
    components: [row],
  });

  const collector = msg.createMessageComponentCollector({
    filter: i => i.customId === `describe_done_${ts}`,
    time: 600000,
  });

  collector.on('collect', async (i) => {
    if (i.user.id !== currentId) {
      return i.reply({ embeds: [e('❌ 還沒輪到你！')], flags: MessageFlags.Ephemeral });
    }
    collector.stop();
    await i.update({ components: [] });
    state.orderIndex++;
    await startDescribeTurn(channel);
  });

  collector.on('end', (c, reason) => {
    if (reason === 'time' && state.phase === 'describing') {
      msg.edit({ components: [] }).catch(() => {});
      channel.send({ embeds: [e(`⏰ **${currentPlayer.name}** 超時，自動跳過！`)] });
      state.orderIndex++;
      startDescribeTurn(channel);
    }
  });
  state.collectors.push(collector);
}

// ─── 投票 ───
async function startVoting(channel) {
  state.phase = 'voting';
  state.votes.clear();

  const alive = getAlivePlayers();
  const ts = Date.now();

  function buildVoteEmbed() {
    let text = '🗳️ **投票時間！**\n\n點按鈕投票，可以改票。開局人按「確認結算」結束投票。\n\n';
    const tally = {};
    for (const [voterId, targetId] of state.votes) {
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
    text += `\n已投票：${state.votes.size} / ${alive.length}`;
    return e(text);
  }

  function buildComponents() {
    const rows = [];
    for (let i = 0; i < alive.length; i += 5) {
      const row = new ActionRowBuilder();
      for (const p of alive.slice(i, i + 5)) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`uvote_${ts}_${p.id}`)
            .setLabel(p.name)
            .setStyle(ButtonStyle.Secondary)
        );
      }
      rows.push(row);
    }
    if (rows.length < 5) {
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`uvoteconfirm_${ts}`)
          .setLabel('✅ 確認結算')
          .setStyle(ButtonStyle.Success)
      ));
    }
    return rows;
  }

  const voteMsg = await channel.send({ embeds: [buildVoteEmbed()], components: buildComponents() });

  const aliveIds = new Set(alive.map(p => p.id));
  const collector = voteMsg.createMessageComponentCollector({
    filter: i => i.customId.startsWith(`uvote_${ts}_`) || i.customId === `uvoteconfirm_${ts}`,
    time: 3600000,
  });

  collector.on('collect', async (i) => {
    if (i.customId === `uvoteconfirm_${ts}`) {
      if (i.user.id !== state.hostId) {
        return i.reply({ embeds: [e('❌ 只有開局人才能確認結算！')], flags: MessageFlags.Ephemeral });
      }
      collector.stop();
      await i.update({ components: [] });
      await resolveVote(channel);
      return;
    }

    if (!aliveIds.has(i.user.id)) {
      return i.reply({ embeds: [e('❌ 你已經出局或不在這局遊戲中！')], flags: MessageFlags.Ephemeral });
    }

    const targetId = i.customId.replace(`uvote_${ts}_`, '');
    if (targetId === i.user.id) {
      return i.reply({ embeds: [e('❌ 不能投自己！')], flags: MessageFlags.Ephemeral });
    }

    state.votes.set(i.user.id, targetId);
    await i.update({ embeds: [buildVoteEmbed()], components: buildComponents() });
  });
  state.collectors.push(collector);
}

// ─── 結算投票 ───
async function resolveVote(channel) {
  const tally = {};
  for (const [, targetId] of state.votes) {
    tally[targetId] = (tally[targetId] || 0) + 1;
  }

  if (Object.keys(tally).length === 0) {
    await channel.send({ embeds: [e('⚖️ 沒有人投票，本輪沒有人出局。')] });
    await nextRoundOrEnd(channel);
    return;
  }

  const maxVotes = Math.max(...Object.values(tally));
  const topIds = Object.keys(tally).filter(id => tally[id] === maxVotes);

  if (topIds.length > 1) {
    const names = topIds.map(id => `**${findPlayer(id)?.name}**`).join('、');
    await channel.send({ embeds: [e(`⚖️ ${names} 各 ${maxVotes} 票，平票！本輪沒有人出局。`)] });
    await nextRoundOrEnd(channel);
    return;
  }

  const eliminatedId = topIds[0];
  const eliminated = findPlayer(eliminatedId);
  eliminated.alive = false;

  // 白板出局 → 白板自己輸，遊戲繼續
  if (eliminated.role === 'blank') {
    await channel.send({ embeds: [e(`⚖️ **${eliminated.name}** 被投出了！（${maxVotes} 票）\n\n🤷 他是**白板**，沒有拿到任何詞彙。遊戲繼續！`)] });
    await nextRoundOrEnd(channel);
    return;
  }

  // 檢查勝負
  const win = checkWin();
  if (win) {
    await announceResult(channel, win, eliminated);
  } else {
    await channel.send({ embeds: [e(`⚖️ **${eliminated.name}** 被投出了！（${maxVotes} 票）\n\n遊戲繼續...`)] });
    await nextRoundOrEnd(channel);
  }
}

// 下一輪或結束
async function nextRoundOrEnd(channel) {
  state.round++;
  if (state.maxRounds > 0 && state.round > state.maxRounds) {
    await announceResult(channel, 'spy_timeout', null);
    return;
  }

  const win = checkWin();
  if (win) {
    await announceResult(channel, win, null);
    return;
  }

  await startDescribePhase(channel);
}

// ─── 公布結果 ───
async function announceResult(channel, result, lastEliminated) {
  const roleNames = { civilian: '👤 平民', spy: '🕵️ 臥底', blank: '🤷 白板' };
  const roleList = state.players.map(p => {
    const status = p.alive ? '✅' : '💀';
    const word = p.role === 'blank' ? '（沒有詞）' : `（${p.word}）`;
    return `${status} ${p.name} — ${roleNames[p.role]} ${word}`;
  }).join('\n');

  let title = '';
  if (result === 'civilian') {
    title = '🎉🎉🎉 **平民勝利！** 所有臥底已被找出！';
  } else if (result === 'spy' || result === 'spy_timeout') {
    title = '🕵️🕵️🕵️ **臥底勝利！** 成功潛伏到最後！';
    if (result === 'spy_timeout') title += `\n\n⏰ 已達 ${state.maxRounds} 輪上限`;
  }

  await channel.send({
    embeds: [e(`${title}\n\n🔑 **平民詞彙：${state.wordPair[0]}**\n🔑 **臥底詞彙：${state.wordPair[1]}**\n\n📋 **角色公布：**\n${roleList}`)],
  });
  reset();
}

// ─── 指令 ───
const commands = {
  async us(message) {
    if (state.phase !== 'idle') return message.reply({ embeds: [e('❌ 目前已有一局誰是臥底進行中！')] });
    reset();
    state.phase = 'waiting'; state.hostId = message.author.id;
    state.channelId = message.channel.id; state.guild = message.guild;
    state.players.push({ id: message.author.id, name: message.member.displayName, role: null, word: null, alive: true });
    message.channel.send({ embeds: [e(`🕵️ **誰是臥底開局！**\n👑 開局人：${message.member.displayName}\n\n輸入 \`!uj\` 加入遊戲\n開局人輸入 \`!ub\` 開始遊戲（至少 3 人）\n\n目前玩家（1人）：${message.member.displayName}`)] });
  },

  async uj(message) {
    if (state.phase !== 'waiting') return message.reply({ embeds: [e('❌ 目前沒有開放加入的臥底局！')] });
    if (state.players.find(p => p.id === message.author.id)) return message.reply({ embeds: [e('❌ 你已經加入了！')] });
    if (state.players.length >= 10) return message.reply({ embeds: [e('❌ 已滿 10 人！')] });
    state.players.push({ id: message.author.id, name: message.member.displayName, role: null, word: null, alive: true });
    const names = state.players.map(p => p.name).join('、');
    message.channel.send({ embeds: [e(`✅ **${message.member.displayName}** 加入誰是臥底！\n目前玩家（${state.players.length}人）：${names}`)] });
  },

  async ub(message) {
    if (state.phase !== 'waiting') return message.reply({ embeds: [e('❌ 目前沒有等待中的臥底局！')] });
    if (message.author.id !== state.hostId) return message.reply({ embeds: [e('❌ 只有開局人才能開始遊戲！')] });
    if (state.players.length < 3) return message.reply({ embeds: [e('❌ 至少需要 3 人！')] });

    state.guild = message.guild;

    // 1. 選擇輪數限制
    const tsRound = Date.now();
    const roundRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`uround_${tsRound}_0`).setLabel('♾️ 不限輪數').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`uround_${tsRound}_3`).setLabel('3 輪').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`uround_${tsRound}_5`).setLabel('5 輪').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`uround_${tsRound}_7`).setLabel('7 輪').setStyle(ButtonStyle.Primary),
    );
    const roundMsg = await message.channel.send({
      content: `<@${message.author.id}>`,
      embeds: [e('📋 **開局人請選擇輪數限制：**')],
      components: [roundRow],
    });

    state.maxRounds = await new Promise((resolve) => {
      const collector = roundMsg.createMessageComponentCollector({
        filter: i => i.customId.startsWith(`uround_${tsRound}_`) && i.user.id === state.hostId,
        max: 1, time: 60000,
      });
      collector.on('collect', async (i) => {
        const rounds = parseInt(i.customId.replace(`uround_${tsRound}_`, ''));
        const label = rounds === 0 ? '不限輪數' : `${rounds} 輪`;
        await i.update({ embeds: [e(`📋 輪數限制：**${label}**`)], components: [] });
        resolve(rounds);
      });
      collector.on('end', (c) => {
        if (c.size === 0) {
          roundMsg.edit({ embeds: [e('📋 超時，預設不限輪數')], components: [] }).catch(() => {});
          resolve(0);
        }
      });
      state.collectors.push(collector);
    });

    if (state.phase === 'idle') return;

    // 2. 分配角色
    const config = getRoleConfig(state.players.length);
    const roles = [];
    for (let i = 0; i < config.spy; i++) roles.push('spy');
    for (let i = 0; i < config.blank; i++) roles.push('blank');
    while (roles.length < state.players.length) roles.push('civilian');
    const shuffledRoles = shuffle(roles);
    state.players.forEach((p, i) => { p.role = shuffledRoles[i]; });

    // 3. 選詞組
    const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    // 隨機決定哪個是平民詞哪個是臥底詞
    state.wordPair = Math.random() < 0.5 ? pair : [pair[1], pair[0]];

    // 4. 分配詞彙
    state.players.forEach(p => {
      if (p.role === 'civilian') p.word = state.wordPair[0];
      else if (p.role === 'spy') p.word = state.wordPair[1];
      else p.word = null; // blank
    });

    // 5. DM 詞彙（只發詞，不發身份）
    for (const p of state.players) {
      try {
        const member = await message.guild.members.fetch(p.id);
        if (p.role === 'blank') {
          await member.send({ embeds: [e('🤷 你沒有拿到任何詞彙。\n\n靠聽別人的描述來偽裝吧！')] });
        } else {
          await member.send({ embeds: [e(`🔑 你的詞彙是：**${p.word}**`)] });
        }
      } catch {
        await message.channel.send({ embeds: [e(`⚠️ 無法私訊 ${p.name}！`)] });
      }
    }

    // 6. 隨機排序
    state.order = shuffle(state.players.map(p => p.id));
    state.round = 1;

    const orderNames = state.order.map((id, i) => `${i + 1}. ${findPlayer(id).name}`).join('\n');
    const roundInfo = state.maxRounds > 0 ? `${state.maxRounds} 輪` : '不限';

    await message.channel.send({
      embeds: [e(`🕵️ **誰是臥底開始！共 ${state.players.length} 人**\n\n詞彙已透過 DM 發送，請查看私訊！\n\n📋 描述順序：\n${orderNames}\n\n⏱️ 輪數限制：${roundInfo}`)],
    });

    await startDescribePhase(message.channel);
  },

  async uq(message) {
    if (state.phase === 'idle') return message.reply({ embeds: [e('❌ 目前沒有進行中的臥底局！')] });
    const isHost = message.author.id === state.hostId;
    const isAdmin = message.author.id === process.env.ANNOUNCE_ADMIN_ID;
    const isPlayer = state.players.some(p => p.id === message.author.id);
    if (!isHost && !isAdmin && !isPlayer) return message.reply({ embeds: [e('❌ 只有參加的玩家才能取消遊戲！')] });

    const roleNames = { civilian: '👤 平民', spy: '🕵️ 臥底', blank: '🤷 白板' };
    const roleList = state.players.filter(p => p.role).map(p => {
      const word = p.role === 'blank' ? '（沒有詞）' : `（${p.word}）`;
      return `${p.name} — ${roleNames[p.role]} ${word}`;
    }).join('\n');
    const wordInfo = state.wordPair ? `\n🔑 平民詞：**${state.wordPair[0]}** ｜ 臥底詞：**${state.wordPair[1]}**` : '';

    reset();
    message.channel.send({ embeds: [e(`🚫 **${message.member.displayName}** 取消了誰是臥底！${wordInfo}\n\n${roleList ? `📋 角色公布：\n${roleList}` : ''}`)] });
  },

  async ul(message) {
    if (state.phase === 'idle') return message.reply({ embeds: [e('❌ 目前沒有進行中的臥底局！')] });
    const pi = state.players.findIndex(p => p.id === message.author.id);
    if (pi === -1) return message.reply({ embeds: [e('❌ 你沒有加入這局誰是臥底！')] });
    const playerName = message.member.displayName;

    if (state.phase === 'waiting') {
      state.players.splice(pi, 1);
      if (message.author.id === state.hostId && state.players.length > 0) {
        state.hostId = state.players[0].id;
        return message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了！\n👑 開局人轉移給 **${state.players[0].name}**`)] });
      }
      if (state.players.length === 0) { reset(); return; }
      return message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了！\n目前玩家（${state.players.length}人）：${state.players.map(p => p.name).join('、')}`)] });
    }

    // 遊戲中離開
    const roleNames = { civilian: '👤 平民', spy: '🕵️ 臥底', blank: '🤷 白板' };
    const roleList = state.players.filter(p => p.role).map(p => {
      const word = p.role === 'blank' ? '（沒有詞）' : `（${p.word}）`;
      return `${p.name} — ${roleNames[p.role]} ${word}`;
    }).join('\n');
    const wordInfo = state.wordPair ? `\n🔑 平民詞：**${state.wordPair[0]}** ｜ 臥底詞：**${state.wordPair[1]}**` : '';

    reset();
    message.channel.send({ embeds: [e(`👋 **${playerName}** 離開了，遊戲中斷！${wordInfo}\n\n📋 角色公布：\n${roleList}`)] });
  },
};

export default commands;
