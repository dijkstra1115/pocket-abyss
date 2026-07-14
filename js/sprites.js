/* 口袋深淵 — 像素圖庫（純程式繪製，無圖檔） */
'use strict';

/* 3x5 迷你數字字型：用於畫布上的浮動傷害數字 */
const FONT3X5 = {
  '0': ['111','101','101','101','111'],
  '1': ['010','110','010','010','111'],
  '2': ['111','001','111','100','111'],
  '3': ['111','001','111','001','111'],
  '4': ['101','101','111','001','001'],
  '5': ['111','100','111','001','111'],
  '6': ['111','100','111','101','111'],
  '7': ['111','001','001','010','010'],
  '8': ['111','101','111','101','111'],
  '9': ['111','101','111','001','111'],
  '.': ['000','000','000','000','010'],
  '+': ['000','010','111','010','000'],
  '-': ['000','000','111','000','000'],
  'K': ['101','101','110','101','101'],
  'M': ['101','111','111','101','101'],
  'B': ['110','101','110','101','110'],
  'T': ['111','010','010','010','010'],
  '!': ['010','010','010','000','010'],
};

/* 六職業 10x12 */
const HERO_SPRITES = {
  blade: [
    '...hhhh..w',
    '..hhhhhh.w',
    '..ffffff.w',
    '..feffef.w',
    '...ffff..s',
    '.aaaaaaaa.',
    'aaaaaaaaa.',
    'a.aabbaa..',
    '..aaaa....',
    '..cc.cc...',
    '..cc.cc...',
    '.bb...bb..',
  ],
  ranger: [
    '...hhhh...',
    '..hhhhhh.w',
    '..ffffff.w',
    '..feffefw.',
    '...ffff.w.',
    '.aaaaaa.w.',
    '.aaaaaawx.',
    '.abbaaa.w.',
    '..aaaa..w.',
    '..cc.cc.w.',
    '..cc.cc..w',
    '.bb...bb..',
  ],
  mage: [
    '....hh....',
    '...hhhh...',
    '..hhhhhh..',
    '.hhhhhhhh.',
    '..ffffff.s',
    '..feffef.w',
    '...ffff..w',
    '.aaaaaaa.w',
    '.aaaaaaa.w',
    '.aaaaaaa.w',
    '..aaaa...w',
    '.bb..bb..w',
  ],
  cleric: [
    '...hhhh...',
    '..hhhhhh..',
    '..hffffh..',
    '..feffef..',
    '...ffff...',
    '.aaaaaa.s.',
    '.aaaaaa.ss',
    '.aaxxaa.ss',
    '.aaxxaa...',
    '..aaaa....',
    '..a..a....',
    '.bb..bb...',
  ],
  rogue: [
    '...hhhh...',
    '..hhhhhh..',
    '..ffffff..',
    '..feffef..',
    '...ffff...',
    'w.aaaaaa.w',
    'w.aaaaaa.w',
    's.abbaa..s',
    '..aaaa....',
    '..cc.cc...',
    '..cc.cc...',
    '.bb...bb..',
  ],
  guard: [
    '...hhhh...',
    '..hhhhhh..',
    '..hffffh..',
    '..feffef..',
    'ss.ffff...',
    'sxsaaaaaa.',
    'sxsaaaaaa.',
    'sxsaabbaa.',
    'ss.aaaa...',
    '..cc.cc...',
    '..cc.cc...',
    '.bb...bb..',
  ],
};

/* 十種怪物像素原型；各區以名稱+調色盤做出 56 種變體 */
const MOB_SPRITES = {
  slime: [
    '..........',
    '...aaaa...',
    '..aaaaaa..',
    '.aaeaaeaa.',
    '.aaaaaaaa.',
    'aaaaaaaaaa',
    'aabaabaaba',
    '.aaaaaaaa.',
  ],
  bat: [
    '..a....a..',
    '..aa..aa..',
    '.aaaaaaaa.',
    'aaaeaaeaaa',
    'aaaaaaaaaa',
    'a.aa..aa.a',
    '...b..b...',
    '..........',
  ],
  skull: [
    '...aaaa...',
    '..aaaaaa..',
    '..aeaaea..',
    '..aaaaaa..',
    '...abab...',
    '....bb....',
    '..babbab..',
    '....bb....',
    '...b..b...',
    '...b..b...',
  ],
  mushroom: [
    '...aaaa...',
    '.aaaaaaaa.',
    'aaxaaaaxaa',
    'aaaaaaaaaa',
    '..bbbbbb..',
    '..bebbeb..',
    '..bbbbbb..',
    '...b..b...',
  ],
  eye: [
    '...aaaa...',
    '.aaaaaaaa.',
    '.aaxxxxaa.',
    'aaxxeexxaa',
    'aaxxeexxaa',
    '.aaxxxxaa.',
    '.aaaaaaaa.',
    '...aaaa...',
    '..b..b.b..',
  ],
  snake: [
    '..........',
    '...aaaa.b.',
    '..aaeaaab.',
    '..aaaaaa..',
    '.b.....a..',
    '.aaaaaaa..',
    'aaaaaaaa..',
    '.aaaaaa...',
  ],
  golem: [
    '.aaaaaaaa.',
    '.aeaaaaea.',
    '.aaaaaaaa.',
    'aabaaaabaa',
    'aabaaaabaa',
    'a..aaaa..a',
    '...aaaa...',
    '..aaaaaa..',
    '..aa..aa..',
    '.bb....bb.',
  ],
  ghost: [
    '...aaaa...',
    '..aaaaaa..',
    '.aaeaaeaa.',
    '.aaaaaaaa.',
    '.aaabbaaa.',
    '.aaaaaaaa.',
    '.aaaaaaaa.',
    '.a.aa.aa..',
    '..........',
  ],
  beetle: [
    '..b....b..',
    '...b..b...',
    '..aaaaaa..',
    '.aaxaaxaa.',
    'aaaaaaaaaa',
    'aaxaaaaxaa',
    '.aaaaaaaa.',
    '..b.bb.b..',
  ],
  shaman: [
    '...aaaa..w',
    '..aaaaaa.w',
    '..aeaaea.w',
    '...aaaa..w',
    '.aaaaaaaxw',
    '.aaaaaaa.w',
    '.aabbaaa.w',
    '.aaaaaaa.w',
    '.aaaaaaa..',
    '.a.a..a.a.',
  ],
};

const Sprites = {
  /* 畫像素圖。pal: {字元:色碼}；缺字元時退回 a 色。flip 水平翻轉。 */
  draw(ctx, map, pal, x, y, flip, scale) {
    scale = scale || 1;
    const w = map[0].length;
    for (let r = 0; r < map.length; r++) {
      const row = map[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        ctx.fillStyle = pal[ch] || pal.a || '#f0f';
        const cx = flip ? (w - 1 - c) : c;
        ctx.fillRect(x + cx * scale, y + r * scale, scale, scale);
      }
    }
  },

  /* 純色剪影（受擊白閃） */
  drawSilhouette(ctx, map, color, x, y, flip, scale) {
    scale = scale || 1;
    const w = map[0].length;
    ctx.fillStyle = color;
    for (let r = 0; r < map.length; r++) {
      const row = map[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c] === '.') continue;
        const cx = flip ? (w - 1 - c) : c;
        ctx.fillRect(x + cx * scale, y + r * scale, scale, scale);
      }
    }
  },

  /* 3x5 迷你字 */
  text(ctx, str, x, y, color, scale) {
    scale = scale || 1;
    ctx.fillStyle = color;
    let px = x;
    for (const ch of String(str)) {
      const g = FONT3X5[ch];
      if (!g) { px += 4 * scale; continue; }
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
          if (g[r][c] === '1') ctx.fillRect(px + c * scale, y + r * scale, scale, scale);
        }
      }
      px += 4 * scale;
    }
  },

  textWidth(str, scale) { return (String(str).length * 4 - 1) * (scale || 1); },

  spriteSize(map, scale) {
    scale = scale || 1;
    return { w: map[0].length * scale, h: map.length * scale };
  },
};
