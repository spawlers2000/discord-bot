// utils/partyHelper.js

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";

import { PRESETS } from "./presets.js";

// ─────────────────────────────────────────────────────
//  時間解析（修正 Invalid Date Bug）
// ─────────────────────────────────────────────────────
export function parseDateTime(dateStr, timeStr) {
  const d = dateStr.replace(/\//g, "-").trim();
  const t = timeStr.trim();
  const iso = `${d}T${t}:00+08:00`;
  const dt = new Date(iso);
  return isNaN(dt.getTime()) ? null : dt;
}

// Discord 動態時間戳
export function ts(date, fmt = "f") {
  return `<t:${Math.floor(date.getTime() / 1000)}:${fmt}>`;
}

// ─────────────────────────────────────────────────────
//  角色工具
// ─────────────────────────────────────────────────────
export const ROLES = {
  tank:   { key: "tank",   emoji: "🛡️", label: "坦" },
  healer: { key: "healer", emoji: "💚", label: "補" },
  dps:    { key: "dps",    emoji: "⚔️",  label: "輸出" },
};

export function roleLabel(k) {
  return { tank: "坦克", healer: "補師", dps: "輸出" }[k] ?? k;
}
export function roleEmoji(k) {
  return { tank: "🛡️", healer: "💚", dps: "⚔️" }[k] ?? "✅";
}

// ─────────────────────────────────────────────────────
//  截止時間工具
// ─────────────────────────────────────────────────────
export const TIME_OPTIONS = [
  "12:00","13:00","14:00","15:00","16:00",
  "17:00","18:00","19:00","20:00","21:00","22:00","23:00",
];

export const DEADLINE_OPTIONS = [
  { label: "無截止時間",       value: "none",   desc: "報名不設截止" },
  { label: "活動前 30 分鐘",   value: "-30",    desc: "活動開始前 30 分鐘截止" },
  { label: "活動前 1 小時",    value: "-60",    desc: "活動開始前 1 小時截止" },
  { label: "活動前 2 小時",    value: "-120",   desc: "活動開始前 2 小時截止" },
  { label: "前一天 20:00",     value: "prev20", desc: "活動前一天晚上 20:00 截止" },
];

export function deadlineLabel(option, actDate, actTime) {
  if (!option || option === "none") return "無截止時間";
  if (option === "-30")    return `活動前 30 分鐘（${actTime ? shiftTime(actDate, actTime, -30)  : "?"}）`;
  if (option === "-60")    return `活動前 1 小時（${actTime  ? shiftTime(actDate, actTime, -60)  : "?"}）`;
  if (option === "-120")   return `活動前 2 小時（${actTime  ? shiftTime(actDate, actTime, -120) : "?"}）`;
  if (option === "prev20") return "前一天 20:00";
  return option;
}

export function resolveDeadline(option, activityTime) {
  if (!option || option === "none") return null;
  if (option === "-30")    return new Date(activityTime.getTime() -  30 * 60000);
  if (option === "-60")    return new Date(activityTime.getTime() -  60 * 60000);
  if (option === "-120")   return new Date(activityTime.getTime() - 120 * 60000);
  if (option === "prev20") {
    const d = new Date(activityTime);
    d.setDate(d.getDate() - 1);
    d.setHours(20, 0, 0, 0);
    return d;
  }
  return null;
}

function shiftTime(dateStr, timeStr, minutesDelta) {
  const dt = parseDateTime(dateStr, timeStr);
  if (!dt) return "?";
  const shifted = new Date(dt.getTime() + minutesDelta * 60000);
  return shifted.toLocaleTimeString("zh-TW", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Taipei",
  });
}

// ─────────────────────────────────────────────────────
//  草稿是否就緒
// ─────────────────────────────────────────────────────
export function isConfigReady(draft) {
  if (!draft.activityTime)               return false;
  if (draft.deadlineOption === undefined) return false;
  if (!draft.preset)                     return false;
  if (draft.preset === "custom" && !draft.customSlots) return false;
  return true;
}

// ─────────────────────────────────────────────────────
//  設定介面 Embed（建立流程，ephemeral）
// ─────────────────────────────────────────────────────
export function buildConfigEmbed(draft) {
  const check = (v) => (v ? "✅" : "⬜");
  const lines = [
    `**隊伍名稱：** ${draft.title}`,
    `**活動日期：** ${draft.activityDate}`,
  ];

  if (draft.activityTime) {
    const dt = parseDateTime(draft.activityDate, draft.activityTime);
    lines.push(`**活動時間：** ${check(true)} ${draft.activityTime}　${dt ? ts(dt, "R") : "⚠️ 日期格式錯誤"}`);
  } else {
    lines.push(`**活動時間：** ${check(false)} 尚未選擇`);
  }

  if (draft.deadlineOption !== undefined) {
    lines.push(`**報名截止：** ${check(true)} ${deadlineLabel(draft.deadlineOption, draft.activityDate, draft.activityTime)}`);
  } else {
    lines.push(`**報名截止：** ${check(false)} 尚未選擇`);
  }

  if (draft.preset && draft.preset !== "custom") {
    const p = PRESETS[draft.preset];
    lines.push(`**人員配置：** ${check(true)} ${p.emoji} ${p.label}　${p.desc}`);
  } else if (draft.preset === "custom" && draft.customSlots) {
    const { tank, healer, dps } = draft.customSlots;
    lines.push(`**人員配置：** ${check(true)} ⚙️ 自訂　坦×${tank} 補×${healer} 輸出×${dps}`);
  } else if (draft.preset === "custom") {
    lines.push(`**人員配置：** ⚙️ 自訂　${check(false)} 尚未填寫（請點下方「自訂」按鈕）`);
  } else {
    lines.push(`**人員配置：** ${check(false)} 尚未選擇`);
  }

  const ready = isConfigReady(draft);

  return new EmbedBuilder()
    .setColor(ready ? 0x57f287 : 0xfee75c)
    .setTitle("📋　建立隊伍 — 設定中")
    .setDescription(lines.join("\n"))
    .setFooter({
      text: ready
        ? "✅ 所有設定完成，點「建立隊伍」即可！"
        : "依序完成時間、截止、配置三個步驟",
    });
}

// ─────────────────────────────────────────────────────
//  設定介面元件
// ─────────────────────────────────────────────────────
export function buildConfigComponents(draft) {
  const uid = draft.userId;
  const rows = [];

  // ① 活動時間
  rows.push(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`cfg:time:${uid}`)
      .setPlaceholder(draft.activityTime ? `✅ 活動時間：${draft.activityTime}` : "① 選擇活動時間（必填）")
      .addOptions(
        TIME_OPTIONS.map((t) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(t).setValue(t).setDefault(draft.activityTime === t)
        )
      )
  ));

  // ② 截止時間（活動時間選完才啟用）
  rows.push(new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`cfg:deadline:${uid}`)
      .setPlaceholder(
        draft.deadlineOption !== undefined
          ? `✅ 截止：${deadlineLabel(draft.deadlineOption, draft.activityDate, draft.activityTime)}`
          : "② 選擇報名截止時間"
      )
      .setDisabled(!draft.activityTime)
      .addOptions(
        DEADLINE_OPTIONS.map((o) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(o.label).setValue(o.value).setDescription(o.desc)
            .setDefault(draft.deadlineOption === o.value)
        )
      )
  ));

  // ③ 人員配置按鈕
  rows.push(new ActionRowBuilder().addComponents(
    presetBtn(draft, "five",   "🗡️", "5 人本"),
    presetBtn(draft, "ten",    "⚔️",  "10 人本"),
    presetBtn(draft, "custom", "⚙️",  "自訂人數"),
  ));

  // ④ 確認 / 取消
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cfg:confirm:${uid}`)
      .setEmoji("✅").setLabel("建立隊伍")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!isConfigReady(draft)),
    new ButtonBuilder()
      .setCustomId(`cfg:cancel:${uid}`)
      .setEmoji("✖️").setLabel("取消")
      .setStyle(ButtonStyle.Danger),
  ));

  return rows;
}

function presetBtn(draft, id, emoji, label) {
  const active = draft.preset === id;
  return new ButtonBuilder()
    .setCustomId(`cfg:preset:${id}:${draft.userId}`)
    .setEmoji(emoji).setLabel(label)
    .setStyle(active ? ButtonStyle.Primary : ButtonStyle.Secondary);
}

// ─────────────────────────────────────────────────────
//  正式隊伍 Embed
// ─────────────────────────────────────────────────────
export function buildPartyEmbed(party) {
  const statusText = {
    recruiting: "🟢 招募中",
    full:       "🔴 已滿員",
    closed:     "⚫ 已截止",
    disbanded:  "🗑️ 已解散",
  }[party.status] ?? "⚪ 未知";

  const cur = Object.values(party.slots).reduce((s, v) => s + v.members.length, 0);

  function slotField(k) {
    const slot = party.slots[k];
    const bar  = slot.members.length >= slot.max ? "🔴" : "🟢";
    return {
      name:   `${ROLES[k].emoji} ${ROLES[k].label}　${bar} ${slot.members.length}/${slot.max}`,
      value:  slot.members.length ? slot.members.map((m) => `<@${m}>`).join("\n") : "－",
      inline: true,
    };
  }

  return new EmbedBuilder()
    .setColor(
      party.status === "disbanded" ? 0x99aab5 :
      party.status === "full"      ? 0xed4245 :
      party.status === "closed"    ? 0x99aab5 :
      0x57f287  // 招募中 → 綠色
    )
    .setTitle(`⚔️　${party.title}`)
    .setDescription(`> 由 <@${party.leader}> 建立`)
    .addFields(
      { name: "👑 團長",    value: `<@${party.leader}>`, inline: true },
      { name: "📊 狀態",    value: statusText,            inline: true },
      { name: "👥 人數",    value: `${cur} / ${party.maxMembers}`, inline: true },
      {
        name:  "📅 活動開始",
        value: party.activityTime
          ? `${ts(party.activityTime, "f")}\n${ts(party.activityTime, "R")}`
          : "⚠️ 未設定",
        inline: true,
      },
      {
        name:  "⏳ 報名截止",
        value: party.deadlineTime
          ? `${ts(party.deadlineTime, "f")}\n${ts(party.deadlineTime, "R")}`
          : "無截止時間",
        inline: true,
      },
      { name: "\u200B", value: "\u200B", inline: true },
      slotField("tank"),
      slotField("healer"),
      slotField("dps"),
      {
        name:  "📋 候補名單",
        value: party.substitutes.length
          ? party.substitutes.map((m, i) => `${i + 1}. <@${m}>`).join("\n")
          : "－",
      }
    )
    .setFooter({ text: "點下方按鈕報名 • 再按一次可取消" })
    .setTimestamp();
}

// ─────────────────────────────────────────────────────
//  正式隊伍按鈕
// ─────────────────────────────────────────────────────
export function buildPartyButtons(partyId, disabled = false) {
  const d = disabled;
  return [
    new ActionRowBuilder().addComponents(
      mkBtn(`party:join:tank:${partyId}`,   "🛡️", "坦",       ButtonStyle.Primary,   d),
      mkBtn(`party:join:healer:${partyId}`, "💚", "補",       ButtonStyle.Success,   d),
      mkBtn(`party:join:dps:${partyId}`,    "⚔️",  "輸出",     ButtonStyle.Secondary, d),
      mkBtn(`party:leave:${partyId}`,       "🚪", "離隊",     ButtonStyle.Danger,    d),
      mkBtn(`party:sub:${partyId}`,         "📋", "候補",     ButtonStyle.Secondary, d),
    ),
    new ActionRowBuilder().addComponents(
      mkBtn(`party:disband:${partyId}`,     "💣", "解散隊伍", ButtonStyle.Danger,    d),
    ),
  ];
}

function mkBtn(id, emoji, label, style, disabled) {
  return new ButtonBuilder()
    .setCustomId(id).setEmoji(emoji).setLabel(label)
    .setStyle(style).setDisabled(disabled);
}

// ─────────────────────────────────────────────────────
//  計算隊伍狀態
// ─────────────────────────────────────────────────────
export function calcStatus(party) {
  if (party.deadlineTime && new Date() > party.deadlineTime) return "closed";
  const allFull = Object.values(party.slots).every((s) => s.members.length >= s.max);
  if (allFull) return "full";
  return "recruiting";
}
