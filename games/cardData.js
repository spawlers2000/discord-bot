// ─── 卡牌數據定義 ───
// type: attack / defense / heal / special
// cost: 行動點消耗
// oncePerBattle: 每場限用1次
// dmg: [min, max] 傷害範圍
// shield: 護盾值
// heal: 回復值
// effect: 特殊效果描述（給玩家看）
// fn: 效果函數名稱（battle engine 用）

const CARDS = {
  // ===== ⚔️ 攻擊牌 =====
  atk_normal:      { name: '一般攻擊',       type: 'attack',  cost: 1, dmg: [8,12],  effect: '造成 8~12 傷害' },
  atk_normal_1:    { name: '一般攻擊+1',     type: 'attack',  cost: 1, dmg: [8,15],  effect: '造成 8~15 傷害' },
  atk_normal_2:    { name: '一般攻擊+2',     type: 'attack',  cost: 1, dmg: [8,18],  effect: '造成 8~18 傷害' },

  atk_sword_w:     { name: '寄宿之力（弱）', type: 'attack',  cost: 1, dmg: [8,12],  bonus: 5,  effect: '造成 8~12 +5 傷害' },
  atk_sword_w1:    { name: '寄宿之力（弱）+1', type: 'attack', cost: 1, dmg: [8,12], bonus: 10, effect: '造成 8~12 +10 傷害' },
  atk_sword_w2:    { name: '寄宿之力（弱）+2', type: 'attack', cost: 1, dmg: [8,12], bonus: 15, effect: '造成 8~12 +15 傷害' },

  atk_sword_s:     { name: '寄宿之力（強）', type: 'attack',  cost: 2, dmg: [8,12],  bonus: 20, effect: '造成 8~12 +20 傷害' },
  atk_sword_s1:    { name: '寄宿之力（強）+1', type: 'attack', cost: 2, dmg: [8,12], bonus: 25, effect: '造成 8~12 +25 傷害' },
  atk_sword_s2:    { name: '寄宿之力（強）+2', type: 'attack', cost: 2, dmg: [8,12], bonus: 30, effect: '造成 8~12 +30 傷害' },

  atk_fatal:       { name: '必殺之劍',       type: 'attack',  cost: 3, dmg: [25,50], oncePerBattle: true, effect: '造成 25~50 傷害（每場限1次）' },
  atk_fatal_1:     { name: '必殺之劍+1',     type: 'attack',  cost: 3, dmg: [30,50], oncePerBattle: true, effect: '造成 30~50 傷害（每場限1次）' },
  atk_fatal_2:     { name: '必殺之劍+2',     type: 'attack',  cost: 3, dmg: [35,50], oncePerBattle: true, effect: '造成 35~50 傷害（每場限1次）' },

  atk_chain:       { name: '連鎖斬擊',       type: 'attack',  cost: 2, dmg: [8,12],  fn: 'chain', oncePerBattle: true, effect: '攻擊 + 50%追加一次（每場限1次）' },
  atk_chain_1:     { name: '連鎖斬擊+1',     type: 'attack',  cost: 1, dmg: [8,12],  fn: 'chain', oncePerBattle: true, effect: '攻擊 + 50%追加一次（每場限1次）' },
  atk_chain_2:     { name: '連鎖斬擊+2',     type: 'attack',  cost: 1, dmg: [8,15],  fn: 'chain', oncePerBattle: true, effect: '攻擊 + 50%追加一次（每場限1次）' },

  atk_poison_arrow: { name: '毒箭',          type: 'attack',  cost: 1, dmg: [5,8],   bonus: 10, fn: 'poison', poisonTurns: 3, poisonDmg: 5, effect: '造成 5~8 +10 傷害 + 中毒3回合（每回合5）' },
  atk_poison_arrow1:{ name: '毒箭+1',        type: 'attack',  cost: 1, dmg: [5,8],   bonus: 15, fn: 'poison', poisonTurns: 3, poisonDmg: 5, effect: '造成 5~8 +15 傷害 + 中毒3回合（每回合5）' },
  atk_poison_arrow2:{ name: '毒箭+2',        type: 'attack',  cost: 1, dmg: [5,8],   bonus: 20, fn: 'poison', poisonTurns: 3, poisonDmg: 5, effect: '造成 5~8 +20 傷害 + 中毒3回合（每回合5）' },

  atk_paralyze:    { name: '麻痺箭矢',       type: 'attack',  cost: 2, dmg: [5,8],   bonus: 10, fn: 'paralyze', oncePerBattle: true, effect: '造成 5~8 +10 傷害 + 麻痺1回合（每場限1次）' },
  atk_paralyze_1:  { name: '麻痺箭矢+1',     type: 'attack',  cost: 2, dmg: [5,8],   bonus: 15, fn: 'paralyze', oncePerBattle: true, effect: '造成 5~8 +15 傷害 + 麻痺1回合（每場限1次）' },
  atk_paralyze_2:  { name: '麻痺箭矢+2',     type: 'attack',  cost: 2, dmg: [5,8],   bonus: 20, fn: 'paralyze', oncePerBattle: true, effect: '造成 5~8 +20 傷害 + 麻痺1回合（每場限1次）' },

  atk_cost:        { name: '力量的代價',      type: 'attack',  cost: 1, fn: 'selfhurt', hpCostPct: 30, atkPct: 130, effect: '自損30%HP，以130%攻擊力攻擊' },
  atk_cost_1:      { name: '力量的代價+1',    type: 'attack',  cost: 1, fn: 'selfhurt', hpCostPct: 30, atkPct: 160, effect: '自損30%HP，以160%攻擊力攻擊' },
  atk_cost_2:      { name: '力量的代價+2',    type: 'attack',  cost: 1, fn: 'selfhurt', hpCostPct: 30, atkPct: 190, effect: '自損30%HP，以190%攻擊力攻擊' },

  atk_stone:       { name: '投石',            type: 'attack',  cost: 1, dmg: [0,0],   bonus: 15, effect: '附加傷害 +15' },
  atk_stone_1:     { name: '投石+1',          type: 'attack',  cost: 0, dmg: [0,0],   bonus: 15, effect: '附加傷害 +15（0費）' },
  atk_stone_2:     { name: '投石+2',          type: 'attack',  cost: 0, dmg: [0,0],   bonus: 20, effect: '附加傷害 +20（0費）' },

  atk_both:        { name: '攻守一體',        type: 'attack',  cost: 2, dmg: [8,12],  bonus: 0,  shield: 16, fn: 'atkshield', effect: '傷害 +20% + 護盾 +16' },
  atk_both_1:      { name: '攻守一體+1',      type: 'attack',  cost: 2, dmg: [8,12],  bonus: 0,  shield: 18, fn: 'atkshield', effect: '傷害 +25% + 護盾 +18' },
  atk_both_2:      { name: '攻守一體+2',      type: 'attack',  cost: 2, dmg: [8,12],  bonus: 0,  shield: 20, fn: 'atkshield', effect: '傷害 +30% + 護盾 +20' },

  atk_tech:        { name: '技術攻擊',        type: 'attack',  cost: 1, fn: 'shieldToAtk', draw: 1, oncePerBattle: true, effect: '護盾轉攻擊力 + 抽1牌（每場限1次）' },
  atk_tech_1:      { name: '技術攻擊+1',      type: 'attack',  cost: 0, fn: 'shieldToAtk', draw: 2, oncePerBattle: true, effect: '護盾轉攻擊力 + 抽2牌（每場限1次）' },
  atk_tech_2:      { name: '技術攻擊+2',      type: 'attack',  cost: 1, fn: 'shieldToAtk', draw: 2, oncePerBattle: true, effect: '護盾轉攻擊力 + 抽2牌（每場限1次）' },

  atk_knight:      { name: '騎士本領',        type: 'attack',  cost: 1, bonus: 10, fn: 'knightAtk', shieldPct: 60, buffTurns: 1, effect: '附加 +10 + 護盾 +60%（1回合）' },
  atk_knight_1:    { name: '騎士本領+1',      type: 'attack',  cost: 1, bonus: 15, fn: 'knightAtk', shieldPct: 60, buffTurns: 2, effect: '附加 +15 + 護盾 +60%（2回合）' },
  atk_knight_2:    { name: '騎士本領+2',      type: 'attack',  cost: 1, bonus: 20, fn: 'knightAtk', shieldPct: 60, buffTurns: 3, effect: '附加 +20 + 護盾 +60%（3回合）' },

  atk_counter:     { name: '反擊',            type: 'attack',  cost: 1, fn: 'counter', counterDmg: 10, effect: '本回合被攻擊時反彈 +10 傷害' },

  atk_victory:     { name: '勝利的信心',      type: 'attack',  cost: 2, bonus: 20, fn: 'victory', effect: '附加 +20 傷害' },
  atk_victory_1:   { name: '勝利的信心+1',    type: 'attack',  cost: 2, bonus: 25, fn: 'victory', effect: '附加 +25 傷害' },

  atk_revenge1:    { name: '復仇一擊1',       type: 'attack',  cost: 1, fn: 'revenge', threshold: 50, atkBonus: 25, effect: 'HP≤50% → 傷害 +25%' },
  atk_revenge2:    { name: '復仇一擊2',       type: 'attack',  cost: 1, fn: 'revenge', threshold: 30, atkBonus: 60, effect: 'HP≤30% → 傷害 +60%' },
  atk_revenge3:    { name: '復仇一擊3',       type: 'attack',  cost: 1, fn: 'revenge', threshold: 10, atkBonus: 100, effect: 'HP≤10% → 傷害 +100%' },

  atk_distance:    { name: '遠距離之力',      type: 'attack',  cost: 1, bonus: 10, effect: '附加傷害 +10' },
  atk_distance_1:  { name: '遠距離之力+1',    type: 'attack',  cost: 1, bonus: 20, effect: '附加傷害 +20' },
  atk_distance_2:  { name: '遠距離之力+2',    type: 'attack',  cost: 1, bonus: 30, effect: '附加傷害 +30' },

  atk_rage:        { name: '生氣轉攻',        type: 'attack',  cost: 1, fn: 'shieldToAtk2', effect: '護盾轉攻擊力' },
  atk_rage_1:      { name: '生氣轉攻+1',      type: 'attack',  cost: 1, fn: 'shieldToAtk2', bonus: 5, effect: '護盾轉攻擊力 + 附加5' },
  atk_rage_2:      { name: '生氣轉攻+2',      type: 'attack',  cost: 1, fn: 'shieldToAtk2', bonus: 10, effect: '護盾轉攻擊力 + 附加10' },

  atk_master:      { name: '大師的內在力量',   type: 'attack',  cost: 1, fn: 'masterAtk', atkPerCard: 4, oncePerBattle: true, effect: '手牌中攻擊牌數 ×4 傷害（每場限1次）' },
  atk_master_1:    { name: '大師的內在力量+1', type: 'attack',  cost: 1, fn: 'masterAtk', atkPerCard: 5, oncePerBattle: true, effect: '手牌中攻擊牌數 ×5 傷害（每場限1次）' },

  // ===== 🛡️ 防禦牌 =====
  def_shield_w:    { name: '防禦之盾（弱）',   type: 'defense', cost: 1, shield: 10, effect: '護盾 +10' },
  def_shield_w1:   { name: '防禦之盾（弱）+1', type: 'defense', cost: 1, shield: 15, effect: '護盾 +15' },
  def_shield_w2:   { name: '防禦之盾（弱）+2', type: 'defense', cost: 1, shield: 20, effect: '護盾 +20' },

  def_shield_s:    { name: '防禦之盾（強）',   type: 'defense', cost: 2, shield: 20, effect: '護盾 +20' },
  def_shield_s1:   { name: '防禦之盾（強）+1', type: 'defense', cost: 2, shield: 30, effect: '護盾 +30' },
  def_shield_s2:   { name: '防禦之盾（強）+2', type: 'defense', cost: 2, shield: 40, effect: '護盾 +40' },

  def_big:         { name: '防禦大盾',         type: 'defense', cost: 1, fn: 'reducePct', reducePct: 50, oncePerBattle: true, effect: '減傷 50%（每場限1次）' },

  def_dodge:       { name: '完全迴避',         type: 'defense', cost: 3, fn: 'dodge', oncePerBattle: true, effect: '閃避下一次攻擊（每場限1次）' },
  def_dodge_1:     { name: '完全迴避+1',       type: 'defense', cost: 3, fn: 'dodge', oncePerBattle: true, effect: '閃避下一次攻擊（每場限1次）' },
  def_dodge_2:     { name: '完全迴避+2',       type: 'defense', cost: 2, fn: 'dodge', oncePerBattle: true, effect: '閃避下一次攻擊（每場限1次，2費）' },

  def_steel:       { name: '鋼之肌肉',        type: 'defense', cost: 2, fn: 'shieldToDmgReduce', oncePerBattle: true, effect: '護盾轉為減傷值（每場限1次）' },
  def_steel_1:     { name: '鋼之肌肉+1',      type: 'defense', cost: 1, fn: 'shieldToDmgReduce', oncePerBattle: true, effect: '護盾轉為減傷值（每場限1次）' },
  def_steel_2:     { name: '鋼之肌肉+2',      type: 'defense', cost: 1, fn: 'shieldToDmgReduce', oncePerBattle: true, effect: '護盾轉為減傷值（每場限1次）' },

  def_armor:       { name: '鋼鐵鎧甲',        type: 'defense', cost: 1, fn: 'shieldBoost', boostPct: 60, oncePerBattle: true, effect: '護盾 +60%（每場限1次）' },

  def_endure:      { name: '忍耐',            type: 'defense', cost: 2, fn: 'endure', oncePerBattle: true, effect: '致命傷害時以1HP存活（每場限1次）' },
  def_endure_1:    { name: '忍耐+1',          type: 'defense', cost: 1, fn: 'endure', oncePerBattle: true, effect: '致命傷害時以1HP存活（每場限1次，1費）' },
  def_endure_2:    { name: '忍耐+2',          type: 'defense', cost: 0, fn: 'endure', oncePerBattle: true, effect: '致命傷害時以1HP存活（每場限1次，0費）' },

  def_sacrifice:   { name: '犧牲之盾',        type: 'defense', cost: 1, fn: 'sacrificeShield', perCard: 3, effect: '棄所有手牌，每張 +3 護盾' },
  def_sacrifice_1: { name: '犧牲之盾+1',      type: 'defense', cost: 1, fn: 'sacrificeShield', perCard: 4, effect: '棄所有手牌，每張 +4 護盾' },

  def_boost:       { name: '補強盾牌',        type: 'defense', cost: 1, fn: 'defBoost', effect: '本回合防禦牌效果翻倍' },

  def_magic:       { name: '魔法之盾',        type: 'defense', cost: 2, shield: 99, oncePerBattle: true, effect: '護盾 +99（每場限1次）' },

  def_weaken_w:    { name: '鎧甲弱化（弱）',  type: 'defense', cost: 2, fn: 'weakenDef', weakenPct: 40, oncePerBattle: true, effect: '降低對手護盾 40%（1回合，每場限1次）' },
  def_weaken_s:    { name: '鎧甲弱化（強）',  type: 'defense', cost: 2, fn: 'weakenDef', weakenPct: 60, oncePerBattle: true, effect: '降低對手護盾 60%（1回合，每場限1次）' },

  // ===== 💚 治療牌 =====
  heal_pot:        { name: '回復藥',          type: 'heal', cost: 1, heal: 10, effect: '回復 10HP' },
  heal_pot_1:      { name: '回復藥+1',        type: 'heal', cost: 1, heal: 15, effect: '回復 15HP' },
  heal_pot_2:      { name: '回復藥+2',        type: 'heal', cost: 1, heal: 20, effect: '回復 20HP' },

  heal_big:        { name: '回復特效藥',      type: 'heal', cost: 2, heal: 20, effect: '回復 20HP' },
  heal_big_1:      { name: '回復特效藥+1',    type: 'heal', cost: 2, heal: 30, effect: '回復 30HP' },
  heal_big_2:      { name: '回復特效藥+2',    type: 'heal', cost: 2, heal: 40, effect: '回復 40HP' },

  heal_divine:     { name: '神之庇佑',        type: 'heal', cost: 0, fn: 'cleanse', healPerDiscard: 1, effect: '移除所有負面，每棄1張手牌回復1HP' },
  heal_divine_1:   { name: '神之庇佑+1',      type: 'heal', cost: 0, fn: 'cleanse', healPerDiscard: 2, effect: '移除所有負面，每棄1張手牌回復2HP' },

  heal_antidote:   { name: '解毒藥',          type: 'heal', cost: 0, fn: 'curePoison', draw: 1, effect: '移除中毒 + 抽1牌' },
  heal_antidote_1: { name: '解毒藥+1',        type: 'heal', cost: 0, fn: 'curePoison', draw: 2, effect: '移除中毒 + 抽2牌' },

  heal_antistun:   { name: '解麻藥',          type: 'heal', cost: 0, fn: 'cureParalyze', draw: 1, effect: '移除麻痺 + 抽1牌' },
  heal_antistun_1: { name: '解麻藥+1',        type: 'heal', cost: 0, fn: 'cureParalyze', draw: 2, effect: '移除麻痺 + 抽2牌' },

  heal_spring:     { name: '泉源之力',        type: 'heal', cost: 1, fn: 'atkBoostBuff', boostPct: 30, buffTurns: 1, oncePerBattle: true, effect: '攻擊力 +30%（1回合，每場限1次）' },

  // ===== 💜 特殊牌 =====
  spc_supply:      { name: '補給',            type: 'special', cost: 0, fn: 'draw', draw: 2, effect: '抽 2 張牌' },
  spc_supply2:     { name: '補給（強化力量泉源）', type: 'special', cost: 0, fn: 'supplyBoost', effect: '強化力量泉源（成本+2），每場限1次', oncePerBattle: true },

  spc_clone:       { name: '幻影複製',        type: 'special', cost: 0, fn: 'clone', oncePerBattle: true, effect: '複製手中一張牌使用（每場限1次）' },
  spc_smoke:       { name: '煙幕',            type: 'special', cost: 2, fn: 'smoke', missPct: 80, oncePerBattle: true, effect: '對手下次攻擊 80% Miss（每場限1次）' },
  spc_morale:      { name: '高漲的鬥志',      type: 'special', cost: 1, fn: 'doubleAtk', effect: '本回合攻擊牌傷害翻倍' },
  spc_beg:         { name: '求饒',            type: 'special', cost: 0, fn: 'beg', reducePct: 25, oncePerBattle: true, effect: '對手攻擊力 -25%（1回合，每場限1次）' },

  spc_poison:      { name: '毒之力',          type: 'special', cost: 2, fn: 'applyPoison', poisonTurns: 3, poisonDmg: 5, effect: '對手中毒 3回合（每回合5）' },
  spc_poison_1:    { name: '毒之力+1',        type: 'special', cost: 1, fn: 'applyPoison', poisonTurns: 3, poisonDmg: 5, effect: '對手中毒 3回合（1費）' },
  spc_poison_2:    { name: '毒之力+2',        type: 'special', cost: 0, fn: 'applyPoison', poisonTurns: 3, poisonDmg: 5, oncePerBattle: true, effect: '對手中毒 3回合（0費，每場限1次）' },

  spc_lightning:   { name: '閃電之力',        type: 'special', cost: 3, fn: 'applyParalyze', oncePerBattle: true, effect: '對手麻痺1回合（每場限1次）' },
  spc_lightning_1: { name: '閃電之力+1',      type: 'special', cost: 2, fn: 'applyParalyze', oncePerBattle: true, effect: '對手麻痺1回合（2費，每場限1次）' },
  spc_lightning_2: { name: '閃電之力+2',      type: 'special', cost: 1, fn: 'applyParalyze', oncePerBattle: true, effect: '對手麻痺1回合（1費，每場限1次）' },

  spc_purify:      { name: '力量淨化',        type: 'special', cost: 1, fn: 'purify', draw: 1, effect: '消除對手所有增益 + 抽1牌' },
  spc_reset:       { name: '重整態勢',        type: 'special', cost: 1, fn: 'reset', drawCount: 5, oncePerBattle: true, effect: '棄所有手牌重抽5張（每場限1次）' },
  spc_companion:   { name: '同行者',          type: 'special', cost: 0, fn: 'shareDebuff', effect: '自己的負面狀態也給對手' },
  spc_merc:        { name: '傭兵的決心',      type: 'special', cost: 2, fn: 'mercResolve', hpCostPct: 30, boostPct: 100, buffTurns: 2, oncePerBattle: true, effect: '自損30%HP，攻防+100%（2回合，每場限1次）' },
  spc_merc_1:      { name: '傭兵的決心+1',    type: 'special', cost: 2, fn: 'mercResolve', hpCostPct: 30, boostPct: 125, buffTurns: 2, oncePerBattle: true, effect: '自損30%HP，攻防+125%（2回合，每場限1次）' },

  spc_spirit:      { name: '團長的戰鬥精神',  type: 'special', cost: 0, fn: 'extraTurn', oncePerBattle: true, effect: '增加1回合行動點（每場限1次）' },
  spc_spirit_1:    { name: '團長的戰鬥精神+1',type: 'special', cost: 0, fn: 'extraTurnPlus', boostPct: 20, oncePerBattle: true, effect: '增加1回合 + 攻擊力+20%（每場限1次）' },

  spc_lucky:       { name: '幸運氣',          type: 'special', cost: 0, fn: 'lucky', effect: '隨機獲得攻+2/防+5/護盾+5（1回合）' },
  spc_escape:      { name: '走為上策',        type: 'special', cost: 1, fn: 'escape', successPct: 50, effect: '50%機率逃走，結束戰鬥（平局）' },
  spc_method:      { name: '卑鄙的方法',      type: 'special', cost: 1, fn: 'dirty', dmgRange: [10, 150], draw: 3, oncePerBattle: true, effect: '攻擊10~150%傷害 + 抽3牌（每場限1次）' },
  spc_method_1:    { name: '卑鄙的方法+1',    type: 'special', cost: 1, fn: 'dirty', dmgRange: [30, 150], draw: 3, oncePerBattle: true, effect: '攻擊30~150%傷害 + 抽3牌（每場限1次）' },
  spc_method_2:    { name: '卑鄙的方法+2',    type: 'special', cost: 1, fn: 'dirty', dmgRange: [50, 150], draw: 3, oncePerBattle: true, effect: '攻擊50~150%傷害 + 抽3牌（每場限1次）' },

  spc_efficient:   { name: '有效率的戰略',    type: 'special', cost: 0, fn: 'freeAtk', effect: '不消耗行動點進行攻擊' },
  spc_efficient_1: { name: '有效率的戰略+1',  type: 'special', cost: 0, fn: 'freeAtk', bonus: 5, effect: '不消耗行動點攻擊 + 附加5' },
  spc_efficient_2: { name: '有效率的戰略+2',  type: 'special', cost: 0, fn: 'freeAtk', bonus: 10, effect: '不消耗行動點攻擊 + 附加10' },
};

// 初始 15 張新手包
const STARTER_DECK = [
  'atk_normal', 'atk_normal', 'atk_normal',
  'atk_sword_w',
  'def_shield_w', 'def_shield_w', 'def_shield_w',
  'def_shield_s',
  'heal_pot', 'heal_pot',
  'spc_supply', 'spc_supply',
  'heal_antidote',
  'atk_stone',
  'heal_antistun',
];

// 所有可從三選一獲得的卡牌（排除初始牌的基礎版）
const REWARD_POOL = Object.keys(CARDS).filter(id => !STARTER_DECK.includes(id) || id.includes('+') || id.includes('_1') || id.includes('_2'));

function getCard(id) { return CARDS[id] ? { id, ...CARDS[id] } : null; }
function rollDmg(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function getRewardCards(count = 3) {
  const pool = [...REWARD_POOL];
  const picks = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
  return picks;
}

export { CARDS, STARTER_DECK, REWARD_POOL, getCard, rollDmg, getRewardCards };
