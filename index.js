require('dotenv').config();

const {
  Client,
  Events,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags
} = require('discord.js');

const db = require('./db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==========================
// 建立訊息
// ==========================
function buildEventMessage(event) {
  const tanks = event.players.filter(p => p.role === 'tanks').length;
  const healers = event.players.filter(p => p.role === 'healers').length;
  const dps = event.players.filter(p => p.role === 'dps').length;

  const endTime = new Date(event.endTime).toLocaleDateString('zh-TW');
  const eventTime = new Date(event.eventTime).toLocaleDateString('zh-TW');

  return `
---
📢 ~**${event.name}**~
📅 活動開始時間：${eventTime}

👥 人數：${event.players.length}/${event.maxPlayers}

🛡 坦：${tanks}/${event.maxTanks}
💚 補：${healers}/${event.maxHealers}
💥 輸出：${dps}

⏳ 報名結束：${endTime}
---

玩家：
${event.players.map(p =>
  `${p.role === 'tanks' ? '🛡' : p.role === 'healers' ? '💚' : '💥'} <@${p.id}>`
).join('\n') || '無'}
`;
}

// ==========================
// Bot Ready
// ==========================
client.once(Events.ClientReady, () => {
  console.log("Bot Ready");
});

// ==========================
// Interaction
// ==========================
client.on(Events.InteractionCreate, async (interaction) => {
  try {

    // ======================
    // slash command
    // ======================
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'event') {

        await interaction.deferReply(); // ✅ 防 timeout

        const name = interaction.options.getString('name');
        const max = interaction.options.getInteger('max');
        const tanks = interaction.options.getInteger('tanks');
        const healers = interaction.options.getInteger('healers');
        const dps = interaction.options.getInteger('dps');

        const endTimeStr = interaction.options.getString('end-time');
        const eventTimeStr = interaction.options.getString('event-time');

        const eventTime = new Date(eventTimeStr + 'T00:00:00');
        const endTime = new Date(endTimeStr + 'T23:59:59');

        const id = Date.now().toString();

        let data = db.loadDB();

        const newEvent = {
          id,
          name,
          time: Date.now(),
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
        };

        data.events.push(newEvent);
        db.saveDB(data);

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`role_${id}`)
            .setPlaceholder('選擇職業')
            .addOptions(
              { label: '坦克', value: 'tanks', emoji: '🛡' },
              { label: '補師', value: 'healers', emoji: '💚' },
              { label: '輸出', value: 'dps', emoji: '💥' },
              { label: '取消', value: 'leave', emoji: '❌' }
            )
        );

        await interaction.editReply({
          content: buildEventMessage(newEvent),
          components: [row]
        });

        const msg = await interaction.fetchReply();

        // 存 messageId
        let data2 = db.loadDB();
        const event = data2.events.find(e => e.id === id);
        if (event) event.messageId = msg.id;
        db.saveDB(data2);
      }
    }

    // ======================
    // select menu
    // ======================
    if (interaction.isStringSelectMenu()) {

      if (interaction.customId.startsWith('role_')) {

        await interaction.deferUpdate(); // 🔥 核心修正

        const role = interaction.values[0];
        const id = interaction.customId.split('_')[1];

        let data = db.loadDB();
        if (!data.events) data.events = [];

        const event = data.events.find(e => e.id === id);

         if (!event) {
      console.log("找不到活動ID:", id);

      return interaction.editReply({
        content: '❌ 活動不存在（資料可能錯誤）'
      });
    }

        const userId = interaction.user.id;

        if (Date.now() > new Date(event.endTime).getTime()) {
          return interaction.editReply({
            content: '❌ 活動已結束',
            flags: MessageFlags.Ephemeral
          });
        }

        // leave
        if (role === 'leave') {
          event.players = event.players.filter(p => p.id !== userId);
          db.saveDB(data);

          return interaction.editReply({
            content: buildEventMessage(event),
            components: interaction.message.components
          });
        }

        // 移除舊職業
        event.players = event.players.filter(p => p.id !== userId);

        const tanks = event.players.filter(p => p.role === 'tanks').length;
        const healers = event.players.filter(p => p.role === 'healers').length;

        if (role === 'tanks' && tanks >= event.maxTanks) {
          return interaction.editReply({
            content: '❌ 坦已滿',
            flags: MessageFlags.Ephemeral
          });
        }

        if (role === 'healers' && healers >= event.maxHealers) {
          return interaction.editReply({
            content: '❌ 補已滿',
            flags: MessageFlags.Ephemeral
          });
        }

        event.players.push({ id: userId, role });
        db.saveDB(data);

        // ✅ 只用 update（避免 40060）
        await interaction.editReply({
          content: buildEventMessage(event),
          components: interaction.message.components
        });
      }
    }

  } catch (err) {
    console.error("Interaction Error:", err);

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: '❌ 系統錯誤'
        });
      } else {
        await interaction.editReply({
          content: '❌ 系統錯誤',
          flags: MessageFlags.Ephemeral
        });
      }
    } catch (e) {
      console.error("Error while handling error:", e);
    }
  }
});

// ==========================
// scheduler
// ==========================
client.once(Events.ClientReady, () => {

  setInterval(async () => {
    try {

      const now = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" })
      );

      const day = now.getDay();
      const hour = now.getHours();
      const minute = now.getMinutes();

      if ((day === 0 || day === 6) && hour === 20 && minute === 30) {

        const channel = await client.channels.fetch("1439790753940242483");

        await channel.send("<@&1451525866231169147> ⏰ 活動即將開始！");

      }

    } catch (err) {
      console.error("scheduler error:", err);
    }

  }, 60000);

});

client.login(process.env.TOKEN);