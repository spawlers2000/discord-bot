module.exports = function safeDB(data) {
  if (!data.events) data.events = [];
  return data;
};