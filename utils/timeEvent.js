function parseTime(input) {
  if (!input) return null;

  // "2026-04-26 20:00"
  return input;
}

function formatTime(input) {
  if (!input) return '未設定';

  const [datePart, timePart] = input.split(' ');
  if (!datePart || !timePart) return '未設定';

  const [y, m, d] = datePart.split('-');
  const [h, min] = timePart.split(':');

  const date = new Date(y, m - 1, d, h, min);

  if (isNaN(date.getTime())) return '時間錯誤';

  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function toTimestamp(input) {
  if (!input) return 0;

  const [datePart, timePart] = input.split(' ');
  const [y, m, d] = datePart.split('-');
  const [h, min] = timePart.split(':');

  return new Date(y, m - 1, d, h, min).getTime();
}

module.exports = { parseTime, formatTime, toTimestamp };