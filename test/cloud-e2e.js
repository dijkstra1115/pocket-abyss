/* 雲端房間端到端測試：node test/cloud-e2e.js
   用客戶端同一套 Raid API 程式碼實打線上 Worker：
   開房 → 加入 → 本機 deterministic 模擬 → 回寫傷害 → 讀回 → 由雲端紀錄重播驗證逐幀一致。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = {
  console, Math, Date, JSON, Object, Array, String, Number,
  Infinity, NaN, atob, btoa, fetch, Promise, Error,
};
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/data.js', 'js/game.js', 'js/raid.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const { Game, Raid } = vm.runInContext('({ Game, Raid })', ctx);

function assert(cond, msg) {
  if (!cond) { console.error('FAIL: ' + msg); process.exitCode = 1; }
  else console.log('ok: ' + msg);
}

(async () => {
  Game.newGame();
  for (let t = 0; t < 120; t += 0.2) Game.tick(0.2); /* 練一點等級再快照 */

  const room = await Raid.createRoom(10, '甲node');
  assert(room.code && room.code.length === 6, `開房成功 code=${room.code} pool=${room.pool}`);
  assert(room.pool === room.boss.hp, '單人血池 ×1.0');

  const joined = await Raid.joinRoom(room.code, '乙node');
  assert(joined.players.length === 2, '第二人加入');
  assert(joined.pool === Math.floor(room.boss.hp * 17 / 10), `雙人血池 ×1.7 (${joined.pool})`);

  const seed = 5555;
  const input = Raid.roomInput(joined, seed);
  const r1 = Raid.simulate(input);
  assert(r1.hash === Raid.simulate(input).hash, `本機模擬 deterministic (hash=${r1.hash})`);
  assert(r1.teamDmg[1] > 0, `乙隊有輸出 ${r1.teamDmg[1]}`);

  const after = await Raid.postDamage(room.code, '乙node', r1.teamDmg[1], seed);
  assert(after.remaining === Math.max(0, after.pool - r1.teamDmg[1]),
    `血池扣減正確 remaining=${after.remaining}`);
  assert(after.players.find(p => p.n === '乙node').dmg === r1.teamDmg[1], '個人貢獻累積');
  assert(after.runs.length === 1 && after.runs[0].seed === seed, '出戰紀錄含 seed');

  const g = await Raid.getRoom(room.code);
  assert(g.remaining === after.remaining, '重讀一致');

  /* 夥伴視角：只憑雲端資料重建同一場戰鬥 → 逐幀一致 */
  const replay = Raid.simulate(Raid.roomInput(g, g.runs[0].seed));
  assert(replay.hash === r1.hash, '由雲端紀錄重播 → 與原戰鬥逐幀一致');

  /* 深淵遠征：出戰 → 回報 → 共享深度前進 → 夥伴重播一致 */
  const expSeed = 4242;
  const expRes = Raid.simulateExp(Raid.expInput(g, expSeed));
  assert(expRes.cleared >= 1, `遠征推進 F${expRes.from}→F${expRes.to}`);
  const afterExp = await Raid.postExp(room.code, '乙node', expRes.from, expRes.to, expSeed);
  assert(afterExp.exp.floor === expRes.to, `共享深度更新為 ${afterExp.exp.floor}`);
  assert(afterExp.exp.runs.length === 1, '遠征紀錄寫入');
  const run0 = afterExp.exp.runs[0];
  const expReplay = Raid.simulateExp(Raid.expInput(
    { ...afterExp, exp: { floor: run0.from } }, run0.seed));
  assert(expReplay.hash === expRes.hash, '遠征由雲端紀錄重播 → 逐幀一致');

  console.log(process.exitCode ? '\n=== 雲端E2E失敗 ===' : '\n=== 雲端E2E全部通過 ===');
})().catch(e => { console.error('FAIL(exception): ' + e.message); process.exitCode = 1; });
