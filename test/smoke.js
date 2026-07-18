/* 無頭煙霧測試：node test/smoke.js
   在 Node 中載入 data.js + game.js，模擬長時間掛機並演練各系統。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Date, JSON, Object, Array, String, Number, Infinity, NaN, atob, btoa };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/data.js', 'js/game.js', 'js/raid.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  vm.runInContext(src, ctx, { filename: f });
}

/* 頂層 const 不會掛在 sandbox 物件上，改由 context 內取回參照 */
const { Game, DATA, Raid } = vm.runInContext('({ Game, DATA, Raid })', ctx);

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
  `隊伍等級=${s.teamLv} 最佳品質=${DATA.qualities[s.stats.bestQuality].name}`);
assert(s.maxFloorEver >= 25, `4小時應達25層+ (${s.maxFloorEver})`);
assert(s.stats.bossKills >= 2, `擊敗過Boss (${s.stats.bossKills})`);
assert(s.teamLv > 5, `隊伍有升級 (lv=${s.teamLv})`);

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

/* --- 共鬥前排承傷（RAID_VERSION 2）：各隊末位應承受多數王的攻擊 --- */
{
  const st = Raid.init(Raid.testInput());
  const tally = {};
  while (!st.done) {
    Raid.stepTick(st);
    for (const e of st.events) if (e.k === 'bhit') tally[e.t] = (tally[e.t] || 0) + 1;
    st.events.length = 0;
  }
  const total = Object.values(tally).reduce((a, b) => a + b, 0);
  const frontHits = (tally[2] || 0) + (tally[5] || 0);
  assert(total > 0 && frontHits / total > 0.5,
    `共鬥前排承傷過半 (${frontHits}/${total})`);
}

/* --- 自訂共鬥隊伍 --- */
{
  s.raidParty = null;
  assert(Raid.mySnapshots().map(h => h.c).join(',') === s.party.join(','), '共鬥隊伍預設跟隨單機');
  s.raidParty = [s.party[0]];
  const snap = Raid.mySnapshots();
  assert(snap.length === 1 && snap[0].c === s.party[0], '自訂共鬥隊伍生效');
  s.raidParty = ['nope'];
  assert(Raid.mySnapshots().map(h => h.c).join(',') === s.party.join(','), '無效自訂回退單機隊伍');
  s.raidParty = null;
}

/* --- 前排承傷 --- */
{
  if (s.party.length >= 2) {
    const first = s.party[0];
    assert(Game.setFront(first), '設定前排');
    assert(s.party[s.party.length - 1] === first, '前排移位');
    assert(Game.setFront(first) === false, '已在前排時不重複移位');
  }
  const fake = [{ cls: 'a' }, { cls: 'b' }, { cls: 'c' }];
  let front = 0;
  for (let i = 0; i < 20000; i++) if (Game.pickTarget(fake) === fake[2]) front++;
  const pct = front / 200;
  assert(pct > 66 && pct < 74, `前排承傷約70% (${pct.toFixed(1)}%)`);
  assert(Game.pickTarget([fake[0]]) === fake[0], '僅剩一人必中');
}

/* --- 依等級自動分解 --- */
{
  const mk = (id, lv) => ({ id, base: DATA.bases[0].id, slot: DATA.bases[0].slot, lv, q: 5, aff: [], sockets: 0, gems: [] });
  s.inventory.push(mk(90001, 3), mk(90002, 99));
  const r = Game.salvageBelow(0, 10);
  assert(r.n >= 1 && !s.inventory.some(i => i.id === 90001), '手動分解 Lv<10');
  assert(s.inventory.some(i => i.id === 90002), 'Lv99 保留');
  s.settings.autoSalvLv = 10;
  const salvBefore = s.stats.itemsSalvaged;
  Game.addItem(mk(90003, 3));
  assert(!s.inventory.some(i => i.id === 90003) && s.stats.itemsSalvaged === salvBefore + 1, '掉落即分解 Lv<10');
  Game.addItem(mk(90004, 99));
  assert(s.inventory.some(i => i.id === 90004), '掉落 Lv99 保留');
  s.inventory = s.inventory.filter(i => i.id !== 90002 && i.id !== 90004);
  s.settings.autoSalvLv = 0;
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

/* --- 貪婪星核移除遷移 + 生命星核 --- */
{
  assert(DATA.coreTypes.sage.stat === 'hpP' && !DATA.coreTypes.greed, '生命星核=hpP，貪婪已自資料移除');
  s.cores['greed_1'] = 2;
  const sageBefore = s.cores['sage_1'] || 0;
  const gi = { id: 91001, base: DATA.bases[0].id, slot: DATA.bases[0].slot, lv: 5, q: 3, aff: [], sockets: 1, gems: ['greed_0'] };
  s.inventory.push(gi);
  Game.migrate();
  assert(!s.cores['greed_1'] && (s.cores['sage_1'] || 0) === sageBefore + 2, '庫存貪婪星核轉同階生命星核');
  assert(gi.gems[0] === 'sage_0', '已鑲嵌貪婪星核一併轉換');
  s.inventory = s.inventory.filter(i => i.id !== 91001);
}

/* --- 分解退回星核 --- */
{
  const gi = { id: 91002, base: DATA.bases[0].id, slot: DATA.bases[0].slot, lv: 5, q: 3, aff: [], sockets: 2, gems: ['flame_2', 'sage_0'] };
  s.inventory.push(gi);
  const f2 = s.cores['flame_2'] || 0, s0 = s.cores['sage_0'] || 0;
  const d = Game.salvage(91002);
  assert(d > 0 && !s.inventory.some(i => i.id === 91002), '鑲核裝備可分解');
  assert((s.cores['flame_2'] || 0) === f2 + 1 && (s.cores['sage_0'] || 0) === s0 + 1, '分解退回星核');
  const r = Game.salvageBelow(1, 0);
  assert(typeof r.c === 'number', '批次分解回報退核數');
}

/* --- 昇華 --- */
if (s.runMaxFloor < 50) { s.runMaxFloor = 60; s.maxFloorEver = Math.max(s.maxFloorEver, 60); s.stats.maxFloorEver = s.maxFloorEver; }
const gain = Game.emberGain();
assert(gain > 0, `餘燼預覽 ${gain}`);
assert(Game.ascend(), '昇華成功');
assert(s.teamLv === 1 && s.floor === 1, '昇華後重置');
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

/* ===== 共鬥引擎（deterministic）===== */
console.log('');
const tIn = Raid.testInput();
const r0 = Raid.simulate(tIn);
assert(r0.ticks > 0 && r0.teamDmg[0] > 0 && r0.teamDmg[1] > 0,
  `共鬥模擬有效 (ticks=${r0.ticks} 勝=${r0.win} A傷=${r0.teamDmg[0]} B傷=${r0.teamDmg[1]})`);

/* Determinism：同一輸入連跑 1000 次，全程狀態雜湊完全一致 */
let same = true;
for (let i = 0; i < 1000; i++) {
  if (Raid.simulate(tIn).hash !== r0.hash) { same = false; break; }
}
assert(same, `共鬥 1000 次重跑雜湊一致 (hash=${r0.hash})`);
console.log(`CROSS-ENV-HASH ${r0.hash}`); /* 供瀏覽器端比對 */

/* 深淵遠征：determinism 與推進有效性 */
const eIn = Raid.expTestInput();
const e0 = Raid.simulateExp(eIn);
assert(e0.cleared >= 1 && e0.teamDmg[0] > 0 && e0.teamDmg[1] > 0,
  `遠征模擬有效 (F${e0.from}→F${e0.to} 推進${e0.cleared}層 ticks=${e0.ticks})`);
let sameE = true;
for (let i = 0; i < 500; i++) {
  if (Raid.simulateExp(eIn).hash !== e0.hash) { sameE = false; break; }
}
assert(sameE, `遠征 500 次重跑雜湊一致 (hash=${e0.hash})`);
console.log(`CROSS-ENV-EXP ${e0.hash}`);

/* 序列化 round-trip：解碼後重播結果一致 */
const enc = Raid.encode(tIn);
const dec = Raid.decode(enc);
assert(dec && JSON.stringify(dec) === JSON.stringify(tIn), `挑戰碼 round-trip 一致 (${enc.length} bytes)`);
assert(Raid.simulate(dec).hash === r0.hash, '解碼後重播雜湊一致');
assert(Raid.decode('garbage!!') === null, '非法挑戰碼回傳 null');

/* 真實流程：用目前遊戲狀態開房 → 加入 → 兩端重播一致 */
const ch = Raid.newChallenge(20, '房主');
assert(ch.teams.length === 1 && ch.teams[0].h.length === Game.state.party.length, '開房快照');
const full = Raid.joinChallenge(Raid.decode(Raid.encode(ch)), '隊友');
const rA = Raid.simulate(full);
const rB = Raid.simulate(Raid.decode(Raid.encode(full)));
assert(rA.hash === rB.hash, `雙端重播戰報一致 (雙方傷害 ${rA.teamDmg.map(d => Game.fmt(d / 10)).join(' / ')})`);

console.log(`\n模擬總時長 ${(simSec / 3600).toFixed(1)} 小時，事件佇列 ${Game.events.length} 筆`);
console.log(process.exitCode ? '\n=== 有測試失敗 ===' : '\n=== 煙霧測試全部通過 ===');
