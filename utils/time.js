module.exports = {
  parseTime(input) {
    if (!input) return null;

    input = input.replace(' ', 'T');
    const date = new Date(input);

    if (isNaN(date)) return null;

    return date.toISOString();
  },

  formatTime(time) {
    return new Date(time).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
};