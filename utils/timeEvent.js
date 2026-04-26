// ==========================
// 建立活動的時間用
// ==========================

function parseTime(input) {
  if (!input) return null;

  // "2026-04-26 20:00"
  const [datePart, timePart] = input.split(' ');
  if (!datePart || !timePart) return null;

  const [y, m, d] = datePart.split('-');
  const [h, min] = timePart.split(':');

  // 👉 用本地時間建構（避免 UTC +8 問題）
  return {
    year: Number(y),
    month: Number(m),
    day: Number(d),
    hour: Number(h),
    minute: Number(min)
  };
}

// 👉 顯示用（唯一轉 Date 的地方）
function formatTime(t) {
  if (!t) return '未設定';

  const date = new Date(
    t.year,
    t.month - 1,
    t.day,
    t.hour,
    t.minute
  );

  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

// 👉 比較時間用
function toTimestamp(t) {
  if (!t) return 0;

  return new Date(
    t.year,
    t.month - 1,
    t.day,
    t.hour,
    t.minute
  ).getTime();
}

module.exports = { parseTime, formatTime, toTimestamp };