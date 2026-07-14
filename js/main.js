/* 口袋深淵 — 開機與主迴圈 */
'use strict';

(function boot() {
  const offline = Game.boot();
  UI.init();
  if (offline) UI.showOffline(offline);

  /* 除錯：#calm 關閉受擊白閃（供截圖用） */
  if (location.hash.includes('calm')) UI.calm = true;
  /* 除錯：#dbg=1 將視窗資訊寫進標題 */
  if (location.hash.includes('dbg=1')) {
    document.title = `${window.innerWidth}x${window.innerHeight} dpr${window.devicePixelRatio}`;
  }
  /* 除錯：#roomui 用假資料展示房間視圖（不打網路） */
  if (location.hash.includes('roomui')) {
    setTimeout(() => {
      Game.state.settings.playerName = '小明';
      Game.state.settings.roomCode = 'DEMO42';
      UI.roomData = {
        v: 1, code: 'DEMO42', seed: 1,
        boss: { z: 1, lv: 30, hp: 5000000, atk: 800, itv: 16 },
        players: [
          { n: '小明', h: Raid.mySnapshots(), dmg: 1234560 },
          { n: '阿華', h: Raid.mySnapshots(), dmg: 987650 },
        ],
        pool: 8500000, remaining: 6277790,
        runs: [{ n: '阿華', seed: 99, dmg: 987650, ts: 0 }, { n: '小明', seed: 98, dmg: 634560, ts: 0 }],
      };
      document.querySelector('#tabs button[data-tab=raid]').click();
    }, 2500);
  }
  /* 除錯：#roomtest 從瀏覽器完整走一遍雲端房間流程（開房→加入→模擬→回寫→讀回） */
  if (location.hash.includes('roomtest')) {
    setTimeout(async () => {
      try {
        const room = await Raid.createRoom(10, '甲');
        await Raid.joinRoom(room.code, '乙');
        const seed = 424242;
        const rm = await Raid.getRoom(room.code);
        const res = Raid.simulate(Raid.roomInput(rm, seed));
        const after = await Raid.postDamage(room.code, '乙', res.teamDmg[1], seed);
        Game.state.settings.roomCode = room.code;
        UI.roomData = after;
        document.querySelector('#tabs button[data-tab=raid]').click();
        document.title = `ROOMTEST ok code=${after.code} pool=${after.pool} remaining=${after.remaining} players=${after.players.length} runs=${after.runs.length}`;
      } catch (e) {
        document.title = 'ROOMTEST fail ' + e.message;
      }
    }, 2500);
  }
  /* 除錯：#raiddemo 用自己的隊伍左右互搏開一場共鬥（視覺驗證用） */
  if (location.hash.includes('raiddemo')) {
    setTimeout(() => {
      const ch = Raid.newChallenge(Math.max(10, Math.floor(Game.state.maxFloorEver / 10) * 10), '我');
      const full = Raid.joinChallenge(ch, '鏡像隊友');
      document.querySelector('#tabs button[data-tab=raid]').click();
      UI.startRaid(full, 1, null);
    }, 2500);
  }
  /* 除錯：#raidtest 跑固定共鬥輸入、雜湊寫進標題（與 Node 比對跨環境一致性） */
  if (location.hash.includes('raidtest')) {
    const r = Raid.simulate(Raid.testInput());
    document.title = 'RAIDHASH ' + r.hash + ' ticks ' + r.ticks;
  }
  /* 除錯：#scale=0.7 強制介面縮放 */
  const hashScale = location.hash.match(/scale=([\d.]+)/);
  if (hashScale) { Game.state.settings.uiScale = +hashScale[1]; UI.applyScale(); }
  /* 除錯：#eqbest 自動配裝；#pick=blade:weapon 直接開選裝面板 */
  if (location.hash.includes('eqbest')) setTimeout(() => Game.autoEquipParty(), 2000);
  const hashPick = location.hash.match(/pick=(\w+):(\w+)/);
  if (hashPick) setTimeout(() => UI.showEquipPicker(hashPick[1], hashPick[2]), 3000);
  /* 除錯：#tab=bag 直接開指定分頁 */
  const hashTab = location.hash.match(/tab=(\w+)/);
  if (hashTab) {
    const btn = document.querySelector(`#tabs button[data-tab=${hashTab[1]}]`);
    if (btn) btn.click();
  }

  /* 邏輯迴圈：setInterval 在背景分頁仍會（降頻）觸發，掛機不中斷 */
  let last = Date.now();
  setInterval(() => {
    const now = Date.now();
    let dt = Math.min((now - last) / 1000, 30); /* 極端凍結視同小段掛機 */
    last = now;
    while (dt > 0) {
      const step = Math.min(dt, 0.25);
      Game.tick(step);
      dt -= step;
    }
    UI.drain();
  }, 200);

  /* 畫面迴圈 */
  let lastFrame = performance.now();
  function frame(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    UI.renderScene(dt, now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* 低頻 UI 刷新 */
  setInterval(() => UI.renderTop(), 300);
  setInterval(() => UI.refresh(), 2000);

  /* 存檔保險 */
  window.addEventListener('beforeunload', () => Game.save());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Game.save();
  });
})();
