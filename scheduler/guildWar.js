const db = require('../db');

// ==========================
// 百業戰提醒（穩定 production 版）
// ==========================
module.exports = (client) => {

  const TARGET_DAY = [0, 6]; // 週日 / 週六
  const TARGET_HOUR = 17;
  const TARGET_MINUTE = 45;

  let running = false;

  // ==========================
  // 發送提醒
  // ==========================
  async function sendGuildWar() {
    try {

      const channel = await client.channels.fetch("1468841017019990188");

      await channel.send(
        "  ⏰ 百業戰開始！請準備集合！"
      );

      console.log("✅ guildWar sent:", new Date().toLocaleString());

    } catch (err) {
      console.error("❌ sendGuildWar error:", err);
    }
  }

  // ==========================
  // 計算下一次執行時間
  // ==========================
  function getNextRunTime() {
    const now = new Date();

    let next = new Date();
    next.setSeconds(0, 0);
    next.setHours(TARGET_HOUR, TARGET_MINUTE, 0, 0);

    const isTargetDay = TARGET_DAY.includes(now.getDay());

    // 👉 如果不是目標日 or 已過時間 → 找下一天
    if (!isTargetDay || now > next) {
      do {
        next.setDate(next.getDate() + 1);
      } while (!TARGET_DAY.includes(next.getDay()));

      next.setHours(TARGET_HOUR, TARGET_MINUTE, 0, 0);
    }

    return next;
  }

  // ==========================
  // 主 scheduler
  // ==========================
  function schedule() {

    if (running) return;
    running = true;

    const now = new Date();
    const runAt = getNextRunTime();
    const delay = runAt - now;

    // ==========================
    // DEBUG（你會看到這個）
    // ==========================
    console.log("================================");
    console.log("🧪 SCHEDULER DEBUG");
    console.log("NOW     :", now.toLocaleString());
    console.log("RUN AT  :", runAt.toLocaleString());
    console.log("DELAY   :", delay);
    console.log("DAY     :", now.getDay());
    console.log("================================");

    // ==========================
    // 🔥 重啟補償（關鍵）
    // ==========================
    if (delay <= 0) {
      console.log("⚠️ missed schedule → sending immediately");

      sendGuildWar().then(() => {
        running = false;
        schedule();
      });

      return;
    }

    setTimeout(async () => {

      await sendGuildWar();

      running = false;
      schedule();

    }, delay);
  }

  // ==========================
  // 啟動
  // ==========================
  schedule();
};