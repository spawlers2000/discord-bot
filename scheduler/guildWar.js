const db = require('../db');

module.exports = (client) => {

  const TARGET_DAY = [0, 6]; // 0=週日, 6=週六
  const TARGET_HOUR = 17;
  const TARGET_MINUTE = 38;

  // ==========================
  // 計算下一次執行時間
  // ==========================
  function getNextRunTime() {
    const now = new Date();

    let next = new Date();
    next.setSeconds(0, 0);

    // 設定今天目標時間
    next.setHours(TARGET_HOUR, TARGET_MINUTE, 0, 0);

    const isTargetDay = TARGET_DAY.includes(now.getDay());

    // 如果不是目標日 or 已過時間 → 找下一次
    if (!isTargetDay || now > next) {
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

    const now = new Date();
    const runAt = getNextRunTime();
    const delay = runAt - now;

    // ==========================
    // 🔥 DEBUG 區（你要看的重點）
    // ==========================
    console.log("================================");
    console.log("🧪 SCHEDULER DEBUG");
    console.log("NOW     :", now.toLocaleString());
    console.log("RUN AT  :", runAt.toLocaleString());
    console.log("DELAY(ms):", delay);
    console.log("DAY     :", now.getDay());
    console.log("================================");

    if (delay < 0) {
      console.log("⚠️ delay < 0 → 重新計算");
      return schedule();
    }

    setTimeout(async () => {

      try {

        const channel = await client.channels.fetch("1468841017019990188");

        await channel.send(
          "  ⏰ 百業戰即將開始！請準備集合！"
        );

        console.log("✅ guildWar sent:", new Date().toLocaleString());

      } catch (err) {
        console.error("❌ scheduler error:", err);
      }

      // 👉 重新排下一次
      schedule();

    }, delay);
  }

  // ==========================
  // 啟動
  // ==========================
  schedule();
};