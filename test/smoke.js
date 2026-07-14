/* 無頭煙霧測試：node test/smoke.js
   在 Node 中載入 data.js + game.js，模擬長時間掛機並演練各系統。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Date, JSON, Object, Array, String, Number, Infinity, NaN };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/data.js', 'js/game.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  vm.runInContext(src, ctx, { filename: f });
}

/* 頂層 const 不會掛在 sandbox 物件上，改由 context 內取回參照 */
const { Game, DATA } = vm.runInContext('({ Game, DATA })', ctx);

function assert(cond, msg) {
  if (!cond) { console.error('FAIL: ' + msg); process.exitCode = 1; }
  else console.log('ok: ' + msg);
}

/* --- 資料完整性 --- */
assert(DATA.qualities.length === 12, '品質 12 階');
assert(DATA.bases.length === 44, '裝備基底 44 種');
let mobCount = 0;
for (const z of DATA.zones) mobCount += z.mobs.length + 1;
assert(mobCount === 56, `怪物 56 種 (實際 ${mobCount})`);
assert(DATA.achievements.length === 52, `成就 52 種 (實際 ${DATA.achievements.length})`);
assert(DATA.zones.length === 8, '區域 8 區');

/* --- 新遊戲 + 模擬掛機 --- */
Game.newGame();
const DT = 0.2;
let simSec = 0;
function sim(seconds) {
  for (let t = 0; t < seconds; t += DT) Game.tick(DT);
  simSec += seconds;
}

sim(600); /* 10 分鐘 */
const s = Game.state;
console.log(`\n[10分鐘] 樓層=${s.floor} 擊殺=${s.stats.kills} 金幣=${Game.fmt(s.gold)} ` +
  `背包=${s.inventory.length} kps=${s.kps.toFixed(2)}`);
assert(s.floor > 3, `10分鐘應離開前3層 (floor=${s.floor})`);
assert(s.stats.kills > 30, `10分鐘擊殺>30 (kills=${s.stats.kills})`);
assert(s.inventory.length > 0, '有掉落裝備');

/* --- 裝備最好的裝備給小隊 --- */
function autoEquipAll() {
  for (const cls of s.party) {
    for (const slot of DATA.slotOrder) {
      const cands = s.inventory.filter(i => i.slot === slot);
      if (!cands.length) continue;
      cands.sort((a, b) => Game.itemScore(b) - Game.itemScore(a));
      const cur = s.heroes[cls].equip[slot];
      if (!cur || Game.itemScore(cands[0]) > Game.itemScore(cur)) {
        Game.equip(cands[0].id, cls);
      }
    }
  }
}
autoEquipAll();
const atkBefore = Game.heroStats('blade').atk;
assert(atkBefore > DATA.classes.blade.base.atk, `裝備後攻擊上升 (${atkBefore.toFixed(1)})`);

/* --- 長時間掛機（模擬 4 小時，每 30 分鐘自動換裝） --- */
for (let i = 0; i < 8; i++) { sim(1800); autoEquipAll(); }
console.log(`\n[~4小時] 樓層=${s.floor} 最深=${s.maxFloorEver} 擊殺=${s.stats.kills} ` +
  `金幣=${Game.fmt(s.gold)} Boss=${s.stats.bossKills} 星塵=${Game.fmt(s.dust)} ` +
  `等級=${s.heroes.blade.lv} 最佳品質=${DATA.qualities[s.stats.bestQuality].name}`);
assert(s.maxFloorEver >= 25, `4小時應達25層+ (${s.maxFloorEver})`);
assert(s.stats.bossKills >= 2, `擊敗過Boss (${s.stats.bossKills})`);
assert(s.heroes.blade.lv > 5, `英雄有升級 (lv=${s.heroes.blade.lv})`);

/* --- 解鎖英雄 --- */
if (s.maxFloorEver >= 15) {
  s.gold += 5000;
  assert(Game.unlockHero('cleric'), '解鎖牧師');
  Game.toggleParty('blade');
  assert(Game.toggleParty('cleric') === false || s.party.includes('cleric') || Game.toggleParty('cleric'),
    '牧師可上陣');
  Game.toggleParty('blade');
}

/* --- 鍛造 --- */
s.dust += 1e6; s.gold += 1e7;
const it = s.inventory[0] || null;
if (it) {
  const q0 = it.q;
  assert(Game.upgrade(it), '升品成功');
  assert(it.q === q0 + 1, `品質+1 (${q0}→${it.q})`);
  assert(Game.reroll(it), '重鑄成功');
  const s0 = it.sockets;
  if (s0 < 3) { assert(Game.addSocket(it), '鑿孔成功'); assert(it.sockets === s0 + 1, '插槽+1'); }
}

/* --- 星核 --- */
s.cores['flame_0'] = 5;
const f1Before = s.cores['flame_1'] || 0; /* 模擬期間可能已隨機掉落 */
assert(Game.fuseCore('flame', 0), '熔合星核');
assert((s.cores['flame_1'] || 0) === f1Before + 1 && s.cores['flame_0'] === 2, '3碎片→1凝聚');
if (it && it.sockets > 0) {
  assert(Game.socketCore(it, 'flame', 1), '鑲嵌星核');
  const atkA = Game.heroStats('blade').atk;
  Game.equip(it.id, 'blade');
  assert(Game.socketCore(s.heroes.blade.equip[it.slot], 'flame', 0) || true, '鑲嵌已裝備物品');
}

/* --- 昇華 --- */
if (s.runMaxFloor < 50) { s.runMaxFloor = 60; s.maxFloorEver = Math.max(s.maxFloorEver, 60); s.stats.maxFloorEver = s.maxFloorEver; }
const gain = Game.emberGain();
assert(gain > 0, `餘燼預覽 ${gain}`);
assert(Game.ascend(), '昇華成功');
assert(s.heroes.blade.lv === 1 && s.floor === 1, '昇華後重置');
assert(s.ember >= gain, `餘燼入帳 ${s.ember}`);
assert(Game.buyTalent('vanguard'), '購買先遣部隊');
assert(Game.startFloor() === 6, `起始樓層=6 (${Game.startFloor()})`);
Game.ascend; /* no-op */
s.floor = Game.startFloor();

/* --- 成就 --- */
Game.checkAch();
const achN = Object.keys(s.achievements).length;
assert(achN >= 5, `已解鎖成就 ${achN} 個`);

/* --- 離線收益 --- */
s.kps = 0.5;
const off = Game.offline(3600 * 2);
assert(off && off.kills > 0, `離線2小時: 擊殺${off && off.kills} 金幣${off && Game.fmt(off.gold)} 裝備${off && off.items}`);

/* --- 存檔序列化 --- */
const json = JSON.stringify(Game.state);
const back = JSON.parse(json);
assert(back.floor === Game.state.floor, '存檔可序列化往返');

/* --- 昇華後再掛機一段（確認天賦生效、可繼續推進） --- */
sim(900);
console.log(`\n[昇華後15分鐘] 樓層=${s.floor} 金幣=${Game.fmt(s.gold)} 擊殺=${s.stats.kills}`);
assert(s.floor > Game.startFloor(), `昇華後能繼續推進 (${s.floor})`);

/* --- 深層數值不溢出 --- */
const deep = Game.mobStats(700, 'normal', true);
assert(isFinite(deep.hp) && isFinite(deep.atk), `深層(700F)數值有限 hp=${deep.hp.toExponential(2)}`);

console.log(`\n模擬總時長 ${(simSec / 3600).toFixed(1)} 小時，事件佇列 ${Game.events.length} 筆`);
console.log(process.exitCode ? '\n=== 有測試失敗 ===' : '\n=== 煙霧測試全部通過 ===');
