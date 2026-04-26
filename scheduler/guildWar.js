// ==========================
// 百業戰提醒
// ==========================

const db = require('../db');

module.exports = (client) => {

  setInterval(async () => {
    try {

      let data = await db.loadDB();

      if (!data.scheduler) data.scheduler = {};
      if (!data.scheduler.guildWar) data.scheduler.guildWar = [];

      const now = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" })
      );

      const day = now.getDay();
      const hour = now.getHours();
      const minute = now.getMinutes();

      // 👉 只用「分鐘級 key」
      const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hour}-${minute}`;

      const triggered = data.scheduler.guildWar;

      // 🎯 目標時間
      const isTarget = (day === 0 || day === 6 && hour === 20 && minute === 30);

      if (!isTarget) return;

      // ❌ 已發過 → 跳過
      if (triggered.includes(key)) return;

      const channel = await client.channels.fetch("1439790753940242483");

      await channel.send("<@&1451525866231169147> ⏰ 提醒：~百業戰~即將開始！請準備集合！");

      console.log("✅ guildWar sent:", key);

      // ✅ 記錄到 DB（關鍵）
      triggered.push(key);

      // 🧹 限制大小（避免 DB 爆）
      if (triggered.length > 500) {
        triggered.splice(0, triggered.length - 500);
      }

      await db.saveDB(data);

    } catch (err) {
      console.error("guildWar scheduler error:", err);
    }

  }, 15000);

};