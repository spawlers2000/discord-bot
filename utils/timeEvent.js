// ==========================
// 建立活動的時間用
// ==========================

function parseTime(input) {
  if (!input) return null;

  // 支援 "2026-04-26 20:00"
  const normalized = input.replace(' ', 'T') + ':00';

  const date = new Date(normalized);

  if (isNaN(date.getTime())) return null;

  return date;
}

function formatTime(time) {
  return new Date(time).toLocaleString('zh-TW', {
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