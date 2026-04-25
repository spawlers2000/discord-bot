module.exports = (client) => {

  setInterval(async () => {
    try {

      const now = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" })
      );

      const day = now.getDay();
      const hour = now.getHours();
      const minute = now.getMinutes();

      // 六日 20:30
      if ((day === 0 || day === 6) && hour === 20 && minute === 30) {

        const channel = await client.channels.fetch("1439790753940242483");

        await channel.send("<@&1451525866231169147> ⏰ 活動即將開始！");
      }

    } catch (err) {
      console.error("guildWar scheduler error:", err);
    }

  }, 60000);

};