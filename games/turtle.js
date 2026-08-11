import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';

const GOLD = 0xFFD700;
const e = (text) => new EmbedBuilder().setColor(GOLD).setDescription(text);
const games = new Map();
const usedPuzzles = new Set();

// ─── 內建題庫 ───
const PUZZLES = [
  { puzzle: '一個男人走進一家餐廳，點了一碗海龜湯。他喝了一口，然後回家自殺了。', answer: '他曾經和朋友遇難漂流，朋友死了。同伴說煮了海龜湯給他喝，讓他活下來。現在他喝到真正的海龜湯，發現味道完全不同，才知道當年喝的是朋友的肉。' },
  { puzzle: '一個女人在自己的婚禮上笑著流淚。三天後她殺了自己的丈夫。', answer: '她是盲人，婚禮上她聽到丈夫對伴娘說「等她死了我們就在一起」。她笑著流淚是因為聽到了真相。' },
  { puzzle: '一個人買了一棟新房子，搬進去的第一天晚上就死了。', answer: '他是夢遊症患者，新房子的陽台門和舊家的廁所門在同一個位置。他夢遊時以為要去廁所，推開門走出了陽台摔死了。' },
  { puzzle: '教室裡所有人都死了，只有老師活著。', answer: '老師在教游泳課，學生都溺水了。' },
  { puzzle: '一個男人每天都準時在同一時間打電話給妻子，但有一天他沒打，妻子就報警了。', answer: '丈夫是定時炸彈拆除專家，每次完成任務都會打電話報平安。那天沒打電話代表任務失敗了。' },
  { puzzle: '一個人在沙漠中死了，身邊只有一個沒打開的包裹。', answer: '包裹是降落傘，但沒有打開，所以他從高空摔死了。' },
  { puzzle: '一個女人看了天氣預報後就哭了。', answer: '她的丈夫是漁夫，天氣預報說有暴風雨，而丈夫正在海上。' },
  { puzzle: '一個房間裡有50個人，地上有一把槍和一個死人，但沒有人報警。', answer: '這是一場葬禮，死人本來就在那裡。槍是軍人葬禮的禮砲。' },
  { puzzle: '一個男人走進電梯，按了12樓，到了之後就死了。', answer: '他是醫生，12樓是手術室，他要去動手術。但電梯故障困了太久，病人等不到手術死了，他因此被判醫療疏失，承受不了壓力自殺了。' },
  { puzzle: '一對夫妻去露營，第二天早上丈夫發現帳篷外有熊的腳印，但他很開心。', answer: '妻子前一天和他吵架說要離婚。熊的腳印代表妻子半夜出去時遇到了熊，不會離開他了（回到帳篷裡）。' },
  { puzzle: '一個男人站在窗前看到對面大樓的燈關了，就跳樓自殺了。', answer: '他是燈塔管理員，對面的燈是燈塔的燈。燈滅了代表會有船難，他無法承受責任。' },
  { puzzle: '她在生日那天死了，所有人都說她活該。', answer: '她是 2 月 29 日出生的，每四年才過一次生日。她堅持只在生日當天吃藥，所以藥效不夠死了。大家覺得是她自己固執。' },
  { puzzle: '一個人在荒島上發現了一具穿著太空衣的屍體。', answer: '他是消防員，在森林大火時，直升機從湖裡取水滅火，意外把正在潛水的人（穿著潛水衣，看起來像太空衣）一起吸上去，丟到了荒島上。' },
  { puzzle: '一個女人每天都買一模一樣的東西，但她從來不用。', answer: '她買的是驗孕棒，每天測試但一直沒有懷孕。' },
  { puzzle: '一個人走進一家店，什麼都沒說，店員就報警了。', answer: '這是一家假髮店，他走進來脫掉了帽子露出光頭，店員以為他是來搶劫的。實際上他只是想買假髮，太緊張了。' },
  { puzzle: '一個男人在家裡聽到門鈴響，開門後看到一個陌生人。陌生人說了一句話後，男人就開槍了。', answer: '陌生人說：「恭喜你中獎了！」男人以為是詐騙集團。（實際上真的中獎了）' },
  { puzzle: '一個女人走進超市，買了一把刀和一條繩子，收銀員祝她生日快樂。', answer: '她買刀切蛋糕，繩子綁氣球。收銀員看到她的會員卡上的生日日期。' },
  { puzzle: '一個人在一樓按了電梯，等了30分鐘電梯都沒來，他就笑了。', answer: '他是電梯維修工人，電梯壞了代表他有工作做，可以賺錢。' },
  { puzzle: '一個房間裡的鐘停在3:15，房間的主人就知道兇手是誰了。', answer: '那不是時鐘，是保險箱的密碼鎖。兇手試圖開保險箱，密碼停在3-15，而只有特定的人知道保險箱的存在。' },
  { puzzle: '一個盲人恢復視力後，第一件事就是離婚。', answer: '他恢復視力後看到妻子長得很醜。（或者看到妻子和別人的合照）' },
  { puzzle: '一個人每天走同一條路回家，有一天他走了不同的路，結果救了一條命。', answer: '他平常走的路會經過一座橋，那天橋塌了。走不同的路讓他避開了橋，救了自己的命。' },
  { puzzle: '一個女孩在日記裡寫下「今天是我最後一天寫日記」，但她沒有死。', answer: '她買了新的日記本，舊的寫完了。' },
  { puzzle: '醫生說：「這是我見過最棘手的病例。」但他笑了。', answer: '他在看醫學教科書上的案例，覺得很有趣。不是真的病人。' },
  { puzzle: '一個人在雨中奔跑，但他身上完全沒有濕。', answer: '他在跑步機上跑步，雨在窗外。' },
  { puzzle: '一個男人走進酒吧，向酒保要了一杯水。酒保拿出一把槍指著他。男人說了聲謝謝就離開了。', answer: '男人打嗝了，想喝水止嗝。酒保用槍嚇他，嚇一跳就不打嗝了。所以他說謝謝。' },
  { puzzle: '一棟大樓裡，13樓的人全部搬走了，但14樓的人一點也不擔心。', answer: '那棟大樓沒有13樓（很多大樓因為迷信跳過13樓），14樓其實是13樓。' },
  { puzzle: '一個人收到一封信後，立刻把房子賣了。', answer: '信是政府通知，他的房子所在的地方要被徵收蓋高速公路。他趕快賣掉還能賣個好價錢。' },
  { puzzle: '一個女人在鏡子前哭泣，但鏡子裡的她在笑。', answer: '那不是鏡子，是一張她以前開心時拍的照片，裝在像鏡子一樣的相框裡。' },
  { puzzle: '一個人在圖書館大聲喊叫，但沒有人阻止他。', answer: '圖書館失火了，他在喊「快跑」。' },
  { puzzle: '一個男人在生日那天收到了100份禮物，但他哭了。', answer: '他是孤兒院的院長，100份禮物是捐給孤兒的，沒有一份是給他的。' },
  { puzzle: '一個人每天晚上都聽到隔壁有人唱歌，有一天歌聲停了，他就報警了。', answer: '隔壁住的是一個獨居老人，每天唱歌代表還活著。歌聲停了可能是出事了。' },
  { puzzle: '一個人買了兩張同一班飛機的機票，但他只有一個人。', answer: '他太胖了，一個座位坐不下，需要買兩個座位。' },
  { puzzle: '一個女人打開冰箱後就尖叫了。', answer: '冰箱裡有一顆頭（她是法醫，把工作帶回家了）。或者：冰箱裡有活的東西跳出來（青蛙）。' },
  { puzzle: '一個人掉進了水裡，但他沒有溺水，反而渴死了。', answer: '他掉進的是大海，海水是鹹的不能喝，最後脫水而死。' },
  { puzzle: '五個人在屋子裡，燈突然滅了。燈亮的時候，有一個人死了，所有人都知道兇手是誰。', answer: '他們在玩俄羅斯輪盤，輪到那個人的時候槍響了。所有人都看到了。' },
  { puzzle: '一個人上了計程車，告訴司機目的地後，司機就把他趕下車了。', answer: '目的地就是他現在站的地方。' },
  { puzzle: '一個男人每天帶傘出門，但從來不打開。', answer: '傘是給他的導盲犬遮陽用的。他是盲人，不需要自己撐傘。' },
  { puzzle: '一個人死在了一間密室裡，房間裡只有一灘水和碎玻璃。', answer: '他是一條金魚，魚缸打破了，水流出來，他缺水而死。' },
  { puzzle: '一個女人在海邊撿到一個漂流瓶，讀完信後就大笑了。', answer: '信是她自己小時候寫的，漂了很多年又回來了。' },
  { puzzle: '一個人在自己家裡迷路了。', answer: '他剛搬進一棟很大的豪宅，還不熟悉房間的位置。或者：他失明了。' },
];

function pickRandomPuzzle() {
  let available = PUZZLES.map((p, i) => ({ ...p, idx: i })).filter(x => !usedPuzzles.has(x.idx));
  if (available.length === 0) { usedPuzzles.clear(); available = PUZZLES.map((p, i) => ({ ...p, idx: i })); }
  const pick = available[Math.floor(Math.random() * available.length)];
  usedPuzzles.add(pick.idx);
  return pick;
}

const commands = {
  async hs(message) {
    if (games.has(message.channel.id)) return message.reply({ embeds: [e('❌ 這個頻道已有進行中的海龜湯！')] });

    const ts = Date.now();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`hs_custom_${ts}`).setLabel('✏️ 自訂題目').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`hs_random_${ts}`).setLabel('🎲 隨機題目').setStyle(ButtonStyle.Secondary),
    );

    const msg = await message.channel.send({
      embeds: [e(`🐢 **${message.member.displayName}** 要出海龜湯！\n\n選擇出題方式：`)],
      components: [row],
    });

    const modeCollector = msg.createMessageComponentCollector({
      filter: i => i.customId.startsWith(`hs_`) && i.customId.endsWith(`_${ts}`) && i.user.id === message.author.id,
      max: 1, time: 60000,
    });

    modeCollector.on('collect', async (i) => {
      if (i.customId === `hs_random_${ts}`) {
        // 隨機出題
        const picked = pickRandomPuzzle();
        const state = {
          channelId: message.channel.id,
          hostId: message.author.id,
          hostName: message.member.displayName,
          puzzle: picked.puzzle,
          answer: picked.answer,
          qaLog: [],
          questionCount: 0,
        };
        games.set(message.channel.id, state);

        await i.update({ components: [] });
        await message.channel.send({
          embeds: [e(`✅ 答案已私訊給出題者！`)],
        });

        // DM 答案給出題者
        try {
          const member = await message.guild.members.fetch(message.author.id);
          await member.send({ embeds: [e(`🐢 **海龜湯答案（只有你看得到）：**\n\n${picked.answer}`)] });
        } catch {
          await i.followUp({ embeds: [e(`🐢 **答案（只有你看得到）：**\n\n${picked.answer}`)], flags: MessageFlags.Ephemeral });
        }

        await message.channel.send({
          embeds: [new EmbedBuilder()
            .setColor(GOLD)
            .setTitle('🐢 海龜湯')
            .setDescription(`**湯面：**\n${picked.puzzle}\n\n👑 出題者：**${state.hostName}**\n\n用 \`!hg 問題\` 提問（只能問是非題）\n出題者按按鈕回答：✅是 ❌否 ❓無關`)
            .setFooter({ text: '出題者輸入 !ha 公布答案結束遊戲' })
          ],
        });
        return;
      }

      // 自訂出題 - Modal
      const modal = new ModalBuilder()
        .setCustomId(`hs_modal_${ts}`)
        .setTitle('海龜湯出題')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('puzzle')
              .setLabel('題目（湯面）')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('描述情境...')
              .setRequired(true)
              .setMaxLength(1000)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('answer')
              .setLabel('答案（湯底）')
              .setStyle(TextInputStyle.Paragraph)
              .setPlaceholder('完整真相...')
              .setRequired(true)
              .setMaxLength(1000)
          ),
        );

      await i.showModal(modal);

      try {
        const submitted = await i.awaitModalSubmit({ time: 300000 });
        const puzzle = submitted.fields.getTextInputValue('puzzle').trim();
        const answer = submitted.fields.getTextInputValue('answer').trim();

        const state = {
          channelId: message.channel.id,
          hostId: message.author.id,
          hostName: message.member.displayName,
          puzzle,
          answer,
          qaLog: [],
          questionCount: 0,
        };
        games.set(message.channel.id, state);

        await submitted.reply({ embeds: [e(`✅ 題目已設定！答案只有你看得到：\n\n**${answer}**`)], flags: MessageFlags.Ephemeral });
        await msg.edit({ components: [] });

        await message.channel.send({
          embeds: [new EmbedBuilder()
            .setColor(GOLD)
            .setTitle('🐢 海龜湯')
            .setDescription(`**湯面：**\n${puzzle}\n\n👑 出題者：**${state.hostName}**\n\n用 \`!hg 問題\` 提問（只能問是非題）\n出題者按按鈕回答：✅是 ❌否 ❓無關`)
            .setFooter({ text: '出題者輸入 !ha 公布答案結束遊戲' })
          ],
        });
      } catch {
        // Modal 取消
      }
    });

    modeCollector.on('end', (c) => {
      if (c.size === 0) msg.edit({ components: [] }).catch(() => {});
    });
  },

  async hg(message, args) {
    const state = games.get(message.channel.id);
    if (!state) return message.reply({ embeds: [e('❌ 沒有進行中的海龜湯！用 `!hs` 開始')] });
    if (message.author.id === state.hostId) return message.reply({ embeds: [e('❌ 出題者不能提問！')] });

    const question = args.join(' ').trim();
    if (!question) return message.reply({ embeds: [e('❌ 請輸入問題！例如 `!hg 他是男生嗎`')] });

    state.questionCount++;
    const qNum = state.questionCount;
    const askerName = message.member.displayName;
    const ts = Date.now();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`hg_${ts}_yes`).setLabel('✅ 是').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`hg_${ts}_no`).setLabel('❌ 否').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`hg_${ts}_irrelevant`).setLabel('❓ 無關').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`hg_${ts}_correct`).setLabel('🎯 正確！').setStyle(ButtonStyle.Primary),
    );

    const qMsg = await message.channel.send({
      content: `<@${state.hostId}>`,
      embeds: [e(`💬 Q${qNum}. **${askerName}**：「${question}」`)],
      components: [row],
    });

    const collector = qMsg.createMessageComponentCollector({
      filter: i => i.customId.startsWith(`hg_${ts}_`) && i.user.id === state.hostId,
      max: 1, time: 600000,
    });

    collector.on('collect', async (i) => {
      const response = i.customId.replace(`hg_${ts}_`, '');
      const labels = { yes: '✅ 是', no: '❌ 否', irrelevant: '❓ 無關', correct: '🎯 正確！' };

      state.qaLog.push({ asker: askerName, question, answer: labels[response] });

      if (response === 'correct') {
        await i.update({
          embeds: [e(`💬 Q${qNum}. **${askerName}**：「${question}」\n\n👑 回答：**${labels[response]}**`)],
          components: [],
        });
        // 公布答案
        await message.channel.send({
          embeds: [new EmbedBuilder()
            .setColor(GOLD)
            .setTitle('🎉 海龜湯解開了！')
            .setDescription(`🏆 **${askerName}** 猜對了！\n\n**湯底（答案）：**\n${state.answer}\n\n📊 共提問 ${state.questionCount} 題`)
          ],
        });
        games.delete(message.channel.id);
      } else {
        await i.update({
          embeds: [e(`💬 Q${qNum}. **${askerName}**：「${question}」\n\n👑 回答：**${labels[response]}**`)],
          components: [],
        });
      }
    });

    collector.on('end', (c) => {
      if (c.size === 0) qMsg.edit({ components: [] }).catch(() => {});
    });
  },

  async ha(message) {
    const state = games.get(message.channel.id);
    if (!state) return message.reply({ embeds: [e('❌ 沒有進行中的海龜湯！')] });
    if (message.author.id !== state.hostId) return message.reply({ embeds: [e('❌ 只有出題者才能公布答案！')] });

    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor(GOLD)
        .setTitle('🐢 海龜湯結束！')
        .setDescription(`**湯底（答案）：**\n${state.answer}\n\n📊 共提問 ${state.questionCount} 題\n👑 出題者：${state.hostName}`)
      ],
    });
    games.delete(message.channel.id);
  },

  async hl(message) {
    const state = games.get(message.channel.id);
    if (!state) return message.reply({ embeds: [e('❌ 沒有進行中的海龜湯！')] });

    if (state.qaLog.length === 0) {
      return message.channel.send({ embeds: [e('🐢 **提問紀錄**\n\n目前還沒有人提問。')] });
    }

    const log = state.qaLog.map((qa, i) =>
      `**Q${i + 1}.** ${qa.asker}：「${qa.question}」\n→ ${qa.answer}`
    ).join('\n\n');

    message.channel.send({
      embeds: [new EmbedBuilder()
        .setColor(GOLD)
        .setTitle(`🐢 提問紀錄（共 ${state.qaLog.length} 題）`)
        .setDescription(log.length > 4000 ? log.substring(0, 4000) + '\n\n...（太長已截斷）' : log)
      ],
    });
  },

  async hq(message) {
    const state = games.get(message.channel.id);
    if (!state) return message.reply({ embeds: [e('❌ 沒有進行中的海龜湯！')] });
    if (message.author.id !== state.hostId) return message.reply({ embeds: [e('❌ 只有出題者才能取消！')] });
    games.delete(message.channel.id);
    message.channel.send({ embeds: [e(`🚫 **${message.member.displayName}** 取消了海龜湯！`)] });
  },
};

export default commands;
