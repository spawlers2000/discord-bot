function nowTW() {
  // 👉 直接用 UTC +8（最穩，不受 container 影響）
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
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

module.exports = {
  nowTW,
  formatTime
};