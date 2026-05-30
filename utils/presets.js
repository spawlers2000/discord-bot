// utils/presets.js
// 隊伍人數預設配置

export const PRESETS = {
  five: {
    id: "five",
    label: "5 人本",
    emoji: "🗡️",
    desc: "坦×1　補×1　輸出×3",
    maxMembers: 5,
    slots: { tank: 1, healer: 1, dps: 3 },
  },
  ten: {
    id: "ten",
    label: "10 人本",
    emoji: "⚔️",
    desc: "坦×1　補×2　輸出×7",
    maxMembers: 10,
    slots: { tank: 1, healer: 2, dps: 7 },
  },
  custom: {
    id: "custom",
    label: "自訂人數",
    emoji: "⚙️",
    desc: "自行填寫各職業上限",
    maxMembers: null,
    slots: null, // 由第二個 modal 填入
  },
};
