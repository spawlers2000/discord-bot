const db = require('../db');

// ==========================
// 百業戰提醒（穩定版）
// ==========================

module.exports = (client) => {

  // 👉 設定固定時間
  const TARGET_DAY = [0, 6]; // 0=週日, 6=週六
  const TARGET_HOUR = 17;
  const TARGET_MINUTE = 32;

  // ==========================
  // 計算下一次執行時間
  // ==========================
  function getNextRunTime() {
    const now = new Date();

    let next = new Date();

    next.setSeconds(0, 0);

    // 先設今天目標時間
    next.setHours(TARGET_HOUR, TARGET_MINUTE, 0, 0);

    // 如果今天已過 or 今天不是目標日
    const isTargetDay = TARGET_DAY.includes(now.getDay());

    if (!isTargetDay || now > next) {
      // 找下一個符合的日期
      do {
        next.setDate(next.getDate() + 1);
      } while (!TARGET_DAY.includes(next.getDay()));

      next.setHours(TARGET_HOUR, TARGET_MINUTE, 0, 0);
    }

    return next;
  }

  // ==========================
  // 主排程
  // ==========================
  function schedule() {

    const runAt = getNextRunTime();
    const delay = runAt - Date.now();

    console.log(`⏳ guildWar next run at: ${runAt}`);

    setTimeout(async () => {

      try {

        const data = await db.loadDB();

        const channel = await client.channels.fetch("1468841017019990188");

        await channel.send(
          " ⏰ 提醒：~百業戰~即將開始！請準備集合！"
        );

        console.log("✅ guildWar sent:", new Date().toISOString());

      } catch (err) {
        console.error("guildWar scheduler error:", err);
      }

      // 👉 重要：跑完自動排下一次
      schedule();

    }, Math.max(delay, 1000)); // 防止負數
  }

  // ==========================
  // 啟動 scheduler
  // ==========================
  schedule();
};