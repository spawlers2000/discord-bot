const { nowTW } = require('../utils/time');

module.exports = (client) => {

  const TARGET_DAY = [0, 6]; // 週日 / 週六
  const TARGET_HOUR = 18;
  const TARGET_MINUTE = 40;

  let started = false;

  // =========================
  // 發送通知
  // =========================
  async function sendGuildWar() {
    try {

      const channel = await client.channels.fetch("1439790753940242483");

      await channel.send(
        "<@&1451525866231169147> ⏰ 百業戰開始！請準備集合！"
      );

      console.log("✅ guildWar sent:", nowTW().toLocaleString());

    } catch (err) {
      console.error("❌ send error:", err);
    }
  }

  // =========================
  // 計算下一次時間
  // =========================
  function getNextRunTime() {

    const now = nowTW();

    let next = new Date(now);
    next.setSeconds(0, 0);
    next.setHours(TARGET_HOUR, TARGET_MINUTE, 0, 0);

    const isTargetDay = TARGET_DAY.includes(now.getDay());

    if (!isTargetDay || now > next) {
      do {
        next.setDate(next.getDate() + 1);
      } while (!TARGET_DAY.includes(next.getDay()));

      next.setHours(TARGET_HOUR, TARGET_MINUTE, 0, 0);
    }

    return next;
  }

  // =========================
  // 主 scheduler
  // =========================
  function schedule() {

    if (started) return;
    started = true;

    const now = nowTW();
    const runAt = getNextRunTime();
    const delay = runAt - now;

    console.log("================================");
    console.log("🧪 SCHEDULER DEBUG");
    console.log("NOW(TW):", now.toLocaleString('zh-TW'));
    console.log("RUN(TW):", runAt.toLocaleString('zh-TW'));
    console.log("DELAY  :", delay);
    console.log("================================");

    // 🔥 如果時間已過 → 直接補發
    if (delay <= 0) {
      console.log("⚠️ missed → immediate send");

      sendGuildWar().then(() => {
        started = false;
        schedule();
      });

      return;
    }

    setTimeout(async () => {

      await sendGuildWar();

      started = false;
      schedule();

    }, delay);
  }

  // =========================
  // 啟動
  // =========================
  schedule();
};