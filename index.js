require('dotenv').config();
const fs = require('fs');
const {
  Client,
  Events,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags
} = require('discord.js');



const file = './data.json';

function load() {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({ events: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(file));
}

function save(data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports = { load, save };


//const config = require('./config.json');
//const db = require('./db');
const eventManager = require('./eventManager');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});



function buildEventMessage(event) {
  const tanks = event.players.filter(p => p.role === 'tanks').length;
  const healers = event.players.filter(p => p.role === 'healers').length;
  const dps = event.players.filter(p => p.role === 'dps').length;
 // const endTime = new Date(event.endTime).toLocaleString(); // 格式化時間
  //const eventTime = new Date(event.eventTime).toLocaleString(); // 格式化時間

  const endTime = new Date(event.endTime).toLocaleDateString('zh-TW', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const eventTime = new Date(event.eventTime).toLocaleDateString('zh-TW', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

  return `
---
📢 ~**${event.name}**~
📅 活動開始時間：${eventTime}

👥 人數：${event.players.length}/${event.maxPlayers}

🛡 需要坦：${tanks}/${event.maxTanks}
💚 需要補：${healers}/${event.maxHealers}
💥 輸出：${dps}

⏳ 報名結束時間：${endTime}
---

玩家列表：

${event.players.map(p =>
  `${p.role === 'tanks' ? '🛡' : p.role === 'healers' ? '💚' : '💥'} <@${p.id}>`
).join('\n') || '無'}
`;
}

client.once(Events.ClientReady, () => {
  console.log("Bot Ready");
});

client.on(Events.InteractionCreate, async (interaction) => {

  // ======================
  // slash command
  // ======================
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === 'event') {

      const name = interaction.options.getString('name');
      const max = interaction.options.getInteger('max');
      const tanks = interaction.options.getInteger('tanks');
      const healers = interaction.options.getInteger('healers');
      const dps = interaction.options.getInteger('dps');  // 加上這一行，將 dps 傳遞過來
      const endTimeStr = interaction.options.getString('end-time'); // 用戶輸入的結束時間
      const eventTimeStr = interaction.options.getString('event-time'); // 用戶輸入的活動時間

      // 如果用戶提供了結束時間，轉換為時間戳
      //const endTime = endTimeStr ? new Date(endTimeStr) : new Date(Date.now() + 3600000); // 默認設為開始時間後一小時
      //const eventTime = endTimeStr ? new Date(eventTimeStr) : new Date(Date.now() + 3600000); // 默認設為開始時間後一小時 活動時間

      const eventTime = new Date(eventTimeStr + 'T20:00:00');
      const endTime = new Date(endTimeStr + 'T23:59:59');

      // 如果結束時間無效，提醒用戶
      if (isNaN(endTime)) {
        return interaction.reply({
          content: '❌ 提供的結束時間無效，請輸入有效的時間格式（例如：2023-12-31 12:00）。',
          ephemeral: true
        });
      }

      const id = Date.now().toString();
      const startTime = Date.now();

      // 在活動創建時，預設結束時間為1小時後
      const defaultEndTime = new Date(Date.now() + 3600000); // 預設結束時間：活動開始後1小時

    const db = require('./db');

//let data = db.load();
db.loadDB()

data.events.push({
  id,
  name,
  time: startTime,
  maxPlayers: max,
  maxTanks: tanks,
  maxHealers: healers,
  maxDps: dps,
  players: [],
  waitlist: [],
  channelId: interaction.channelId,
  messageId: null,
  endTime: endTime.toISOString(),
  eventTime: eventTime.toISOString()
});

db.save(data);



      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`role_${id}`)
          .setPlaceholder('選擇職業')
          .addOptions(
            { label: '坦克', value: 'tanks',emoji: '🛡' },
            { label: '補師', value: 'healers',emoji: '💚' },
            { label: '輸出', value: 'dps' ,emoji: '💥'},
            { label: '取消', value: 'leave',emoji: '❌' }
          )
      );

      //儲存玩家資訊 職業需求量 以及目前職業數量 結束時間
      const msg = await interaction.reply({
        content: buildEventMessage({
          name,
          players: [], // [{ id: '123', role: 'tanks' }]
          maxPlayers: max,
          maxTanks: tanks,
          maxHealers: healers,
          tanks,
          healers,
          endTime: endTime.toISOString(), // 使用格式化的結束時間
          eventTime: eventTime.toISOString() // 使用格式化的活動時間
        }),
        components: [row],
        fetchReply: true
      });

      db.run(`UPDATE events SET messageId = ? WHERE id = ?`, [
        msg.id,
        id
      ]);
    }
  }

  
  // ======================
  // select menu（職業）
  // ======================
  if (interaction.isStringSelectMenu()) {

    if (interaction.customId.startsWith('role_')) {

      const role = interaction.values[0];
      const id = interaction.customId.split('_')[1];

      const event = await eventManager.getEvent(id);
      const userId = interaction.user.id;

      // 如果活動結束時間已過，不能再報名
      if (Date.now() > event.endTime) {
        return interaction.update({
          content: '❌ 活動已結束，無法報名',
          flags: MessageFlags.Ephemeral
        });
      }

// ✅ 先確保 players 是陣列（如果你從 DB 來）
    event.players = Array.isArray(event.players)
      ? event.players
      : JSON.parse(event.players || "[]");

    if (role === 'leave') {

  const before = event.players.length;

  event.players = event.players.filter(p => p.id !== userId);

  
  if (event.players.length === before) {
    return interaction.update({
      content: '❌ 你沒有報名',
      flags: MessageFlags.Ephemeral
    });
  }

  await eventManager.saveEvent(event);

  //await interaction.update({
   // content: buildEventMessage(event)
 //});

  return interaction.update({
    content: buildEventMessage(event)
  });

  //return;
}

   
     // =========================✅ 選職業

      // ✅ 先移除舊職業（避免重複）
      event.players = event.players.filter(p => p.id !== userId);

      // ✅ 重新計算人數
     const tanks = event.players.filter(p => p.role === 'tanks').length;
     const healers = event.players.filter(p => p.role === 'healers').length;
     const dps = event.players.filter(p => p.role === 'dps').length;
     

      // ✅ 檢查限制（在加入之前）
    if (role === 'tanks' && tanks >= event.maxTanks) {
      return interaction.reply({
        content: '❌ 坦已滿',
        flags: MessageFlags.Ephemeral
      });
    }

    if (role === 'healers' && healers >= event.maxHealers) {
      return interaction.reply({
        content: '❌ 補已滿',
        flags: MessageFlags.Ephemeral
      });
    }


    // ✅ 加入玩家
     eventManager.addPlayerRole(event, userId, role);

      await interaction.reply({
        content: `✅ 已選擇職業：${role}`,
        flags: MessageFlags.Ephemeral
      });

      const channel = await client.channels.fetch(event.channelId);
      const msg = await channel.messages.fetch(event.messageId);

      await msg.edit({
        content: buildEventMessage(event)
      });
    }
  }
});




//固定時間提醒
 

client.once('clientReady', () => {
  setInterval(async () => {
    
    try {

      // 🇹🇼 台灣時間
      const now = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" })
      );

      const day = now.getDay();   // 0 = 日, 6 = 六
      const hour = now.getHours();
      const minute = now.getMinutes();

      console.log(`[scheduler] ${hour}:${minute} day=${day}`);

      // 🟡 週六 / 週日 + 20:25
      if ((day === 0 || day === 6) && hour === 20 && minute === 30) {

        // 🔒 防止重複發送（每天只一次）
        const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
        const file = './remind-lock.json';

        let lock = {};
        try {
          lock = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {}

        //if (lock[key]) return; //要測試在註解掉

        const channelId = "1439790753940242483"; // ⭐ dc頻道id
        const channel = await client.channels.fetch(channelId);

        await channel.send({
          content: "<@&1451525866231169147> ⏰ **提醒：~百業戰~即將開始！請準備集合！**" //@身分組ID
        });

        // 🔒 記錄已發送
        lock[key] = true;
        fs.writeFileSync(file, JSON.stringify(lock));

        console.log("提醒已發送");
      }

    } catch (err) {
      console.error("scheduler error:", err);
    }

  }, 60 * 1000);
});


//client.login(config.token);
client.login(process.env.TOKEN);