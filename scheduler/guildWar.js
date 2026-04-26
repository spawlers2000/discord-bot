let started = false;

module.exports = (client) => {

  if (started) {
    console.log("⚠️ scheduler already running → skip");
    return;
  }

  started = true;

  console.log("🔥 guildWar scheduler STARTED");

  const TARGET_DAY = [0, 6];
  const TARGET_HOUR = 20;
  const TARGET_MINUTE = 30;

  function nowTW() {
    return new Date(Date.now() + 8 * 60 * 60 * 1000);
  }

  async function sendGuildWar() {
    const channel = await client.channels.fetch("1439790753940242483");

    await channel.send("<@&1451525866231169147> ⏰ 提醒：~百業戰~即將開始！請準備集合！");
    console.log("✅ SENT:", new Date().toLocaleString());
  }

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

  function schedule() {

    const now = nowTW();
    const runAt = getNextRunTime();
    const delay = runAt - now;

    console.log("================================");
    console.log("🧪 SCHEDULER DEBUG");
    console.log("NOW :", now.toLocaleString());
    console.log("RUN :", runAt.toLocaleString());
    console.log("DELAY:", delay);
    console.log("================================");

    if (delay <= 0) {
      sendGuildWar().then(schedule);
      return;
    }

    setTimeout(async () => {
      await sendGuildWar();
      schedule();
    }, delay);
  }

  schedule();
};