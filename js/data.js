/* 口袋深淵 — 全數值資料 */
'use strict';

const DATA = {};

/* ---------- 品質 12 階 ---------- */
DATA.qualities = [
  { id: 0,  name: '粗糙', color: '#8a8a8a', mult: 0.70 },
  { id: 1,  name: '普通', color: '#e8e8e8', mult: 1.00 },
  { id: 2,  name: '優良', color: '#5fd35f', mult: 1.25 },
  { id: 3,  name: '稀有', color: '#4da6ff', mult: 1.60 },
  { id: 4,  name: '史詩', color: '#b36bff', mult: 2.00 },
  { id: 5,  name: '傳說', color: '#ffa53d', mult: 2.60 },
  { id: 6,  name: '神話', color: '#ff5a5a', mult: 3.40 },
  { id: 7,  name: '永恆', color: '#ff7ad9', mult: 4.40 },
  { id: 8,  name: '星辰', color: '#57e6e6', mult: 5.80 },
  { id: 9,  name: '深淵', color: '#9d7dff', mult: 7.50 },
  { id: 10, name: '混沌', color: '#ff44aa', mult: 10.0 },
  { id: 11, name: '創世', color: '#ffe066', mult: 13.0 },
];
/* 品質 → 詞綴條數 */
DATA.affixCount = [0, 0, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6];
/* 掉落時由高至低嘗試的基礎機率（2 階以上；沒中則普通 80% / 粗糙 20%） */
DATA.qualityChance = [0, 0, 0.25, 0.12, 0.055, 0.025, 0.011, 0.005, 0.002, 0.0008, 0.0003, 0.0001];

/* ---------- 職業 ---------- */
DATA.classes = {
  blade: {
    name: '劍士', sprite: 'blade', color: '#6da2ff', unlock: { floor: 0, cost: 0 },
    base: { atk: 6, hp: 62, def: 3, aspd: 1.0, crit: 5 },
    skill: { name: '旋風斬', desc: '對全體敵人造成180%傷害', cd: 6, type: 'aoe', mult: 1.8 },
    pal: { h: '#8a5a2b', f: '#f0c8a0', e: '#1a1a1a', a: '#3f6fb4', b: '#22334f', c: '#5a4632', w: '#d7deee', s: '#c99a3a', x: '#88aadd' },
  },
  ranger: {
    name: '遊俠', sprite: 'ranger', color: '#7dd87d', unlock: { floor: 0, cost: 0 },
    base: { atk: 7, hp: 46, def: 2, aspd: 1.25, crit: 12 },
    skill: { name: '三連矢', desc: '對隨機敵人射出3箭，各70%傷害', cd: 5, type: 'multi', mult: 0.7, hits: 3 },
    pal: { h: '#2e5d34', f: '#f0c8a0', e: '#1a1a1a', a: '#4e7a3f', b: '#2a3d24', c: '#5a4632', w: '#8a5a2b', s: '#c99a3a', x: '#e0e6ee' },
  },
  mage: {
    name: '法師', sprite: 'mage', color: '#c9a8ff', unlock: { floor: 0, cost: 0 },
    base: { atk: 9, hp: 40, def: 1, aspd: 0.7, crit: 8 },
    skill: { name: '隕星術', desc: '對全體敵人造成250%傷害', cd: 8, type: 'aoe', mult: 2.5 },
    pal: { h: '#5b3b8f', f: '#f0c8a0', e: '#1a1a1a', a: '#7a4fc9', b: '#3a2760', c: '#3a2760', w: '#8a5a2b', s: '#67e8f9', x: '#c9b3ff' },
  },
  cleric: {
    name: '牧師', sprite: 'cleric', color: '#ffe08a', unlock: { floor: 15, cost: 2500 },
    base: { atk: 4, hp: 52, def: 3, aspd: 0.8, crit: 5 },
    skill: { name: '聖光禱言', desc: '全隊回復30%最大生命', cd: 8, type: 'heal', mult: 0.30 },
    pal: { h: '#e8e4d8', f: '#f0c8a0', e: '#1a1a1a', a: '#f5f0e0', b: '#c9bfa5', c: '#c9bfa5', w: '#c99a3a', s: '#b0863c', x: '#d4a017' },
  },
  rogue: {
    name: '盜賊', sprite: 'rogue', color: '#b8c4d8', unlock: { floor: 30, cost: 20000 },
    base: { atk: 8, hp: 42, def: 2, aspd: 1.45, crit: 18 },
    skill: { name: '背刺', desc: '對單一敵人造成300%必定暴擊傷害', cd: 7, type: 'single', mult: 3.0, forceCrit: true },
    pal: { h: '#3a3a4a', f: '#e6bd96', e: '#1a1a1a', a: '#4a4a5e', b: '#2b2b38', c: '#2b2b38', w: '#c0c8d8', s: '#7d8496', x: '#8899aa' },
  },
  guard: {
    name: '騎士', sprite: 'guard', color: '#e0b36a', unlock: { floor: 45, cost: 120000 },
    base: { atk: 4, hp: 95, def: 6, aspd: 0.8, crit: 5 },
    skill: { name: '壁壘', desc: '為全隊套上等同自身40%最大生命的護盾', cd: 12, type: 'shield', mult: 0.4 },
    pal: { h: '#9aa4b5', f: '#f0c8a0', e: '#1a1a1a', a: '#6b7688', b: '#3d4450', c: '#3d4450', w: '#d7deee', s: '#c99a3a', x: '#a23b3b' },
  },
};
DATA.classOrder = ['blade', 'ranger', 'mage', 'cleric', 'rogue', 'guard'];

/* ---------- 裝備欄位 ---------- */
DATA.slots = { weapon: '武器', helm: '頭盔', armor: '護甲', trinket: '飾品' };
DATA.slotOrder = ['weapon', 'helm', 'armor', 'trinket'];

/* ---------- 裝備基底 44 種（tier 越高越深層才會掉、基礎值越高） ---------- */
DATA.bases = [
  /* 武器 12 */
  { id: 'w01', name: '短刃', slot: 'weapon', tier: 0 },
  { id: 'w02', name: '鐵劍', slot: 'weapon', tier: 0 },
  { id: 'w03', name: '獵弓', slot: 'weapon', tier: 1 },
  { id: 'w04', name: '學徒法杖', slot: 'weapon', tier: 1 },
  { id: 'w05', name: '錘矛', slot: 'weapon', tier: 2 },
  { id: 'w06', name: '雙手巨劍', slot: 'weapon', tier: 2 },
  { id: 'w07', name: '影刃', slot: 'weapon', tier: 3 },
  { id: 'w08', name: '魔導書', slot: 'weapon', tier: 3 },
  { id: 'w09', name: '龍牙槍', slot: 'weapon', tier: 4 },
  { id: 'w10', name: '咒縛鏈刃', slot: 'weapon', tier: 5 },
  { id: 'w11', name: '符文之劍', slot: 'weapon', tier: 6 },
  { id: 'w12', name: '星隕之刃', slot: 'weapon', tier: 7 },
  /* 頭盔 10 */
  { id: 'h01', name: '皮革帽', slot: 'helm', tier: 0 },
  { id: 'h02', name: '鐵盔', slot: 'helm', tier: 1 },
  { id: 'h03', name: '遊俠兜帽', slot: 'helm', tier: 1 },
  { id: 'h04', name: '星紋法帽', slot: 'helm', tier: 2 },
  { id: 'h05', name: '骸骨面盔', slot: 'helm', tier: 3 },
  { id: 'h06', name: '龍鱗頭盔', slot: 'helm', tier: 4 },
  { id: 'h07', name: '聖銀面甲', slot: 'helm', tier: 5 },
  { id: 'h08', name: '霜鑄王冠', slot: 'helm', tier: 5 },
  { id: 'h09', name: '深淵之冠', slot: 'helm', tier: 6 },
  { id: 'h10', name: '虛空面罩', slot: 'helm', tier: 7 },
  /* 護甲 10 */
  { id: 'a01', name: '布衣', slot: 'armor', tier: 0 },
  { id: 'a02', name: '硬皮甲', slot: 'armor', tier: 0 },
  { id: 'a03', name: '鎖子甲', slot: 'armor', tier: 1 },
  { id: 'a04', name: '板甲', slot: 'armor', tier: 2 },
  { id: 'a05', name: '咒紋法袍', slot: 'armor', tier: 3 },
  { id: 'a06', name: '暗影披風', slot: 'armor', tier: 3 },
  { id: 'a07', name: '龍鱗鎧', slot: 'armor', tier: 4 },
  { id: 'a08', name: '聖光胸鎧', slot: 'armor', tier: 5 },
  { id: 'a09', name: '星輝戰甲', slot: 'armor', tier: 6 },
  { id: 'a10', name: '虛空織衣', slot: 'armor', tier: 7 },
  /* 飾品 12 */
  { id: 't01', name: '木製戒指', slot: 'trinket', tier: 0 },
  { id: 't02', name: '銅質護符', slot: 'trinket', tier: 0 },
  { id: 't03', name: '銀墜鍊', slot: 'trinket', tier: 1 },
  { id: 't04', name: '狩獵圖騰', slot: 'trinket', tier: 1 },
  { id: 't05', name: '金絲項鍊', slot: 'trinket', tier: 2 },
  { id: 't06', name: '懷錶', slot: 'trinket', tier: 2 },
  { id: 't07', name: '魔眼珠', slot: 'trinket', tier: 3 },
  { id: 't08', name: '血石戒指', slot: 'trinket', tier: 4 },
  { id: 't09', name: '符文石', slot: 'trinket', tier: 5 },
  { id: 't10', name: '星核墜飾', slot: 'trinket', tier: 5 },
  { id: 't11', name: '深淵之戒', slot: 'trinket', tier: 6 },
  { id: 't12', name: '創世餘燼', slot: 'trinket', tier: 7 },
];

/* ---------- 詞綴 16 種（min/max 為 1 階品質時的擲值範圍，隨品質放大） ---------- */
DATA.affixes = {
  atkP:  { name: '攻擊',     min: 4, max: 10, unit: '%' },
  hpP:   { name: '生命',     min: 4, max: 10, unit: '%' },
  defP:  { name: '防禦',     min: 4, max: 10, unit: '%' },
  crit:  { name: '暴擊率',   min: 2, max: 5,  unit: '%' },
  critD: { name: '暴擊傷害', min: 5, max: 15, unit: '%' },
  aspd:  { name: '攻擊速度', min: 3, max: 8,  unit: '%' },
  leech: { name: '吸血',     min: 1, max: 3,  unit: '%' },
  goldP: { name: '金幣獲取', min: 5, max: 12, unit: '%' },
  xpP:   { name: '經驗獲取', min: 5, max: 12, unit: '%' },
  dropP: { name: '掉落率',   min: 3, max: 8,  unit: '%' },
  mf:    { name: '魔尋',     min: 3, max: 8,  unit: '%' },
  haste: { name: '技能急速', min: 3, max: 8,  unit: '%' },
  healP: { name: '治療強度', min: 4, max: 10, unit: '%' },
  thorn: { name: '反傷',     min: 5, max: 15, unit: '%' },
  allP:  { name: '全屬性',   min: 2, max: 5,  unit: '%' },
  dustP: { name: '星塵獲取', min: 5, max: 12, unit: '%' },
};
DATA.affixKeys = Object.keys(DATA.affixes);

/* ---------- 星核：6 系 × 5 階 ---------- */
DATA.coreTypes = {
  flame: { name: '烈焰星核', stat: 'atkP',  base: 5, color: '#ff6b3d' },
  rock:  { name: '磐石星核', stat: 'defP',  base: 6, color: '#b0895a' },
  gale:  { name: '疾風星核', stat: 'aspd',  base: 4, color: '#7dd8a0' },
  keen:  { name: '銳目星核', stat: 'crit',  base: 3, color: '#ffd94d' },
  blood: { name: '血月星核', stat: 'leech', base: 2, color: '#e8536b' },
  /* 鍵沿用 sage：舊存檔的智慧星核原地變生命星核，不需搬資料 */
  sage:  { name: '生命星核', stat: 'hpP',   base: 6, color: '#ff8fb3' },
};
DATA.coreTypeOrder = ['flame', 'rock', 'gale', 'keen', 'blood', 'sage'];
DATA.coreTiers = [
  { name: '碎片', mult: 1 },
  { name: '凝聚', mult: 2 },
  { name: '輝耀', mult: 4 },
  { name: '燦爛', mult: 8 },
  { name: '奇點', mult: 16 },
];

/* ---------- 區域（每 25 層一區、8 區一輪迴 200 層） ---------- */
DATA.difficulties = ['普通', '惡夢', '煉獄', '超越'];
DATA.zones = [
  {
    name: '苔蘚洞窟', sky: '#101c16', ground: '#2c4a30', deco: '#4a7a52',
    mobs: [
      { name: '苔蘚史萊姆', arch: 'slime',    mod: 'normal', pal: { a: '#5a9a52', b: '#33592f', e: '#ffe98a', x: '#8ac47e' } },
      { name: '洞窟蝙蝠',   arch: 'bat',      mod: 'swift',  pal: { a: '#6b5a7a', b: '#3d3348', e: '#ffd94d', x: '#8a76a0' } },
      { name: '孢子菇人',   arch: 'mushroom', mod: 'normal', pal: { a: '#8fbf5a', b: '#c9b78f', e: '#3a2b1a', x: '#e6f0a0' } },
      { name: '石皮甲蟲',   arch: 'beetle',   mod: 'tank',   pal: { a: '#7d8a70', b: '#4a5442', e: '#ffe98a', x: '#a9b89a' } },
      { name: '濕地蛇',     arch: 'snake',    mod: 'swift',  pal: { a: '#4f8f5f', b: '#2e5638', e: '#ffdd55', x: '#7fbf8f' } },
      { name: '迷途幽魂',   arch: 'ghost',    mod: 'normal', pal: { a: '#a8c8b8', b: '#5f8272', e: '#274035', x: '#d0e8dc' } },
    ],
    boss: { name: '巨蕈之王', arch: 'mushroom', pal: { a: '#c94f6a', b: '#e8d8a8', e: '#2b1a1a', x: '#ffdf80' } },
  },
  {
    name: '幽暗密林', sky: '#0e1512', ground: '#22301f', deco: '#3f5c34',
    mobs: [
      { name: '夜梟蝠',     arch: 'bat',      mod: 'swift',  pal: { a: '#3d4a3a', b: '#222b20', e: '#ffb347', x: '#5a6e54' } },
      { name: '荊棘史萊姆', arch: 'slime',    mod: 'normal', pal: { a: '#3f6e3a', b: '#5a3a2a', e: '#ff9a5a', x: '#6a9a5a' } },
      { name: '毒鱗蛇',     arch: 'snake',    mod: 'fierce', pal: { a: '#7a9a3a', b: '#465c1e', e: '#ff5a5a', x: '#aac95a' } },
      { name: '樹靈',       arch: 'golem',    mod: 'tank',   pal: { a: '#6a5238', b: '#3d5c34', e: '#a0ff8a', x: '#8a6e4a' } },
      { name: '林間魅影',   arch: 'ghost',    mod: 'normal', pal: { a: '#5f7a6a', b: '#33453a', e: '#baffcf', x: '#7fa08c' } },
      { name: '德魯伊叛徒', arch: 'shaman',   mod: 'fierce', pal: { a: '#4a6e3f', b: '#2b421f', e: '#ffe98a', x: '#f0c8a0', w: '#8a5a2b' } },
    ],
    boss: { name: '密林古樹靈', arch: 'golem', pal: { a: '#7a5f3a', b: '#4a7a3a', e: '#c9ff5a', x: '#a08050' } },
  },
  {
    name: '廢棄礦坑', sky: '#161210', ground: '#3d332b', deco: '#6e5c46',
    mobs: [
      { name: '礦坑蝙蝠',   arch: 'bat',      mod: 'swift',  pal: { a: '#5c5248', b: '#332d26', e: '#ffdd55', x: '#7a6e5f' } },
      { name: '骸骨礦工',   arch: 'skull',    mod: 'normal', pal: { a: '#d8cfc0', b: '#8f8578', e: '#33241a', x: '#f0e8da' } },
      { name: '岩層史萊姆', arch: 'slime',    mod: 'tank',   pal: { a: '#8a7a62', b: '#544a3a', e: '#ffcf6a', x: '#a89678' } },
      { name: '掘地甲蟲',   arch: 'beetle',   mod: 'normal', pal: { a: '#a0703d', b: '#5f4224', e: '#ffe98a', x: '#c9925a' } },
      { name: '獨眼窺視者', arch: 'eye',      mod: 'fierce', pal: { a: '#8a6248', b: '#4a3527', e: '#2b1a10', x: '#e8d0a8' } },
      { name: '塌方石魔',   arch: 'golem',    mod: 'tank',   pal: { a: '#7d7468', b: '#4d463d', e: '#ffb347', x: '#9a9082' } },
    ],
    boss: { name: '深坑之瞳', arch: 'eye', pal: { a: '#a04a2b', b: '#5c2a18', e: '#1a0d08', x: '#ffce8a' } },
  },
  {
    name: '熔岩裂谷', sky: '#1c0d08', ground: '#4d1f10', deco: '#a04020',
    mobs: [
      { name: '熔岩史萊姆', arch: 'slime',    mod: 'normal', pal: { a: '#e05a2b', b: '#8f2f14', e: '#ffe98a', x: '#ff9a4a' } },
      { name: '火吻蝙蝠',   arch: 'bat',      mod: 'swift',  pal: { a: '#a03a2a', b: '#5c1f14', e: '#ffdd55', x: '#d0563a' } },
      { name: '焦骨戰士',   arch: 'skull',    mod: 'fierce', pal: { a: '#4a3d38', b: '#e05a2b', e: '#ff6b3d', x: '#6e5c54' } },
      { name: '燼眼',       arch: 'eye',      mod: 'normal', pal: { a: '#c9502b', b: '#701f0d', e: '#1a0800', x: '#ffce5a' } },
      { name: '熔核甲蟲',   arch: 'beetle',   mod: 'tank',   pal: { a: '#8f3a24', b: '#4d1a0d', e: '#ffce5a', x: '#e07038' } },
      { name: '火焰祭司',   arch: 'shaman',   mod: 'fierce', pal: { a: '#b03428', b: '#5c1414', e: '#ffe98a', x: '#f0a878', w: '#e0873d' } },
    ],
    boss: { name: '炎骨霸主', arch: 'skull', pal: { a: '#3d3230', b: '#ff6b2b', e: '#ffcf3d', x: '#5f504a' } },
  },
  {
    name: '寒霜墓穴', sky: '#0d1420', ground: '#2a3d54', deco: '#5a7ca0',
    mobs: [
      { name: '冰霜幽魂',   arch: 'ghost',    mod: 'normal', pal: { a: '#a8cce8', b: '#5f82a8', e: '#1f3d5c', x: '#d8ecff' } },
      { name: '凍骨衛士',   arch: 'skull',    mod: 'tank',   pal: { a: '#d8e4f0', b: '#8fa8c0', e: '#2a4a70', x: '#f0f6ff' } },
      { name: '霜雪史萊姆', arch: 'slime',    mod: 'normal', pal: { a: '#7db8e0', b: '#41729a', e: '#ffffff', x: '#aad4f0' } },
      { name: '冰窟蝙蝠',   arch: 'bat',      mod: 'swift',  pal: { a: '#6a86a8', b: '#3a4c66', e: '#bfe4ff', x: '#8aa6c8' } },
      { name: '寒目',       arch: 'eye',      mod: 'fierce', pal: { a: '#8ab0d0', b: '#456e94', e: '#0d2036', x: '#e0f0ff' } },
      { name: '亡靈巫師',   arch: 'shaman',   mod: 'fierce', pal: { a: '#5c7290', b: '#2f3d52', e: '#9adcff', x: '#c8d8ea', w: '#8aa0be' } },
    ],
    boss: { name: '墓穴霜君', arch: 'ghost', pal: { a: '#cfe4ff', b: '#7092c0', e: '#12294a', x: '#ffffff' } },
  },
  {
    name: '毒沼澤地', sky: '#121808', ground: '#39421a', deco: '#6a7a2a',
    mobs: [
      { name: '劇毒史萊姆', arch: 'slime',    mod: 'fierce', pal: { a: '#8fbf2b', b: '#4d6e14', e: '#2b0d2b', x: '#c9f05a' } },
      { name: '沼澤巨蟒',   arch: 'snake',    mod: 'tank',   pal: { a: '#5c7a2b', b: '#33470f', e: '#ffdd55', x: '#8faa4a' } },
      { name: '瘴氣蘑菇',   arch: 'mushroom', mod: 'normal', pal: { a: '#9a5faa', b: '#c9d88f', e: '#2b1a30', x: '#c98fdc' } },
      { name: '腐沼之眼',   arch: 'eye',      mod: 'normal', pal: { a: '#6e8f2b', b: '#3a4d0f', e: '#1a0d1f', x: '#c9e05a' } },
      { name: '泥沼魔像',   arch: 'golem',    mod: 'tank',   pal: { a: '#5f5638', b: '#39421a', e: '#c9f05a', x: '#7a704a' } },
      { name: '沼澤薩滿',   arch: 'shaman',   mod: 'fierce', pal: { a: '#4d6628', b: '#293d12', e: '#ffe98a', x: '#c9b78f', w: '#8a7a4a' } },
    ],
    boss: { name: '萬毒蛇后', arch: 'snake', pal: { a: '#8f2b8f', b: '#4d0f4d', e: '#c9f05a', x: '#c95ac9' } },
  },
  {
    name: '星隕遺跡', sky: '#100c1e', ground: '#2e2650', deco: '#6a5aa8',
    mobs: [
      { name: '星塵史萊姆', arch: 'slime',    mod: 'normal', pal: { a: '#6a5ac9', b: '#3a2f77', e: '#9ff3ff', x: '#9a8ae8' } },
      { name: '符文守衛',   arch: 'golem',    mod: 'tank',   pal: { a: '#5f6890', b: '#333a5c', e: '#67e8f9', x: '#8a94c0' } },
      { name: '星耀甲蟲',   arch: 'beetle',   mod: 'normal', pal: { a: '#4d5aa0', b: '#28305c', e: '#9ff3ff', x: '#8a97e0' } },
      { name: '虛空之眼',   arch: 'eye',      mod: 'fierce', pal: { a: '#7a4fc9', b: '#3d2470', e: '#0d0518', x: '#c9a8ff' } },
      { name: '遺跡遊魂',   arch: 'ghost',    mod: 'normal', pal: { a: '#8f8ac8', b: '#4f4a80', e: '#d8f8ff', x: '#b8b4e8' } },
      { name: '星占師',     arch: 'shaman',   mod: 'fierce', pal: { a: '#4a3d8f', b: '#241c52', e: '#9ff3ff', x: '#c9b3ff', w: '#8a7ad0' } },
    ],
    boss: { name: '隕星巨像', arch: 'golem', pal: { a: '#7a6ae0', b: '#3d3080', e: '#9ff3ff', x: '#a89aff' } },
  },
  {
    name: '虛空邊境', sky: '#0a060f', ground: '#241430', deco: '#5c2a70',
    mobs: [
      { name: '虛空史萊姆', arch: 'slime',    mod: 'normal', pal: { a: '#3d2456', b: '#1c0d2b', e: '#ff44aa', x: '#5f3d85' } },
      { name: '裂隙蝠',     arch: 'bat',      mod: 'swift',  pal: { a: '#472b5c', b: '#241236', e: '#ff6bd9', x: '#6a4285' } },
      { name: '虛無骸骨',   arch: 'skull',    mod: 'fierce', pal: { a: '#8a7aa0', b: '#4d3d66', e: '#ff44aa', x: '#b0a0c8' } },
      { name: '湮滅甲蟲',   arch: 'beetle',   mod: 'tank',   pal: { a: '#33203d', b: '#180b20', e: '#ff6bd9', x: '#57366a' } },
      { name: '暗蝕魅影',   arch: 'ghost',    mod: 'fierce', pal: { a: '#4a3466', b: '#241533', e: '#ff9ae8', x: '#6e528f' } },
      { name: '虛空先知',   arch: 'shaman',   mod: 'fierce', pal: { a: '#2f1c47', b: '#150a24', e: '#ff44aa', x: '#8f6ab0', w: '#5c3d80' } },
    ],
    boss: { name: '虛空吞噬者', arch: 'eye', pal: { a: '#2b1438', b: '#12081c', e: '#ff2b9e', x: '#8f44c9' } },
  },
];

/* ---------- 昇華天賦 ---------- */
DATA.talents = [
  { id: 'power',     name: '餘燼之力', stat: 'allP',      per: 4,  unit: '%',  max: 25, cost: 3, desc: '全屬性' },
  { id: 'edge',      name: '鋒銳餘燼', stat: 'atkP',      per: 6,  unit: '%',  max: 25, cost: 2, desc: '攻擊' },
  { id: 'vitality',  name: '深淵血脈', stat: 'hpP',       per: 8,  unit: '%',  max: 25, cost: 2, desc: '生命' },
  { id: 'greed',     name: '貪婪之焰', stat: 'goldP',     per: 10, unit: '%',  max: 25, cost: 2, desc: '金幣獲取' },
  { id: 'growth',    name: '快速成長', stat: 'xpP',       per: 10, unit: '%',  max: 25, cost: 2, desc: '經驗獲取' },
  { id: 'fortune',   name: '尋寶直覺', stat: 'dropP',     per: 5,  unit: '%',  max: 20, cost: 2, desc: '掉落率' },
  { id: 'resonance', name: '星核共鳴', stat: 'coreP',     per: 8,  unit: '%',  max: 15, cost: 2, desc: '星核掉率' },
  { id: 'hourglass', name: '時間沙漏', stat: 'offlineH',  per: 2,  unit: '小時', max: 6, cost: 4, desc: '離線收益上限' },
  { id: 'vanguard',  name: '先遣部隊', stat: 'startF',    per: 5,  unit: '層', max: 8,  cost: 5, desc: '昇華起始樓層' },
  { id: 'smith',     name: '鍛造大師', stat: 'forgeD',    per: 5,  unit: '%',  max: 8,  cost: 3, desc: '鍛造費用減免' },
];

/* ---------- 成就 52 種 ---------- */
DATA.achievements = (() => {
  const list = [];
  const add = (id, name, desc, type, key, n) => list.push({ id, name, desc, type, key, n });
  const R = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  [100, 1000, 10000, 1e5, 1e6, 1e7].forEach((n, i) =>
    add('kill' + i, '屠戮者' + R[i], `累計擊殺 ${n.toLocaleString()} 隻怪物`, 'stat', 'kills', n));
  [10, 25, 50, 100, 150, 200, 300, 400].forEach((n, i) =>
    add('floor' + i, '深潛者' + R[i], `抵達深淵第 ${n} 層`, 'stat', 'maxFloorEver', n));
  [5, 25, 100, 500, 2000].forEach((n, i) =>
    add('boss' + i, 'Boss獵人' + R[i], `擊敗 ${n} 個Boss`, 'stat', 'bossKills', n));
  [1e3, 1e5, 1e7, 1e9, 1e11].forEach((n, i) =>
    add('gold' + i, '富甲深淵' + R[i], `累計獲得 ${n.toLocaleString()} 金幣`, 'stat', 'goldEarned', n));
  [10, 100, 1000, 10000].forEach((n, i) =>
    add('item' + i, '收藏家' + R[i], `累計獲得 ${n.toLocaleString()} 件裝備`, 'stat', 'itemsFound', n));
  [1, 10, 50, 200].forEach((n, i) =>
    add('fuse' + i, '星核熔匠' + R[i], `熔合 ${n} 次星核`, 'stat', 'coresFused', n));
  [1, 3, 10, 25].forEach((n, i) =>
    add('asc' + i, '昇華者' + R[i], `完成 ${n} 次昇華`, 'stat', 'prestiges', n));
  [10, 25, 50, 100].forEach((n, i) =>
    add('lv' + i, '百戰老兵' + R[i], `隊伍等級達到 ${n} 級`, 'stat', 'maxHeroLv', n));
  for (let q = 3; q <= 11; q++)
    add('q' + q, DATA.qualities[q].name + '獵人', `獲得一件【${DATA.qualities[q].name}】品質裝備`, 'stat', 'bestQuality', q);
  [50, 1000, 20000].forEach((n, i) =>
    add('sal' + i, '回收專家' + R[i], `分解 ${n.toLocaleString()} 件裝備`, 'stat', 'itemsSalvaged', n));
  return list;
})();
