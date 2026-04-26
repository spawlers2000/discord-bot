// ==========================
// 建立活動的時間用
// ==========================

function parseTime(input) {
  if (!input) return null;

  // "2026-04-26 20:00"
  const [datePart, timePart] = input.split(' ');
  if (!datePart || !timePart) return null;

  const [year, month, day] = datePart.split('-');
  const [hour, minute] = timePart.split(':');

  // 👉 用本地時間建立（不走 UTC）
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );
}

function formatTime(date) {
  return new Date(date).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

module.exports = { parseTime, formatTime };