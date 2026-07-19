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
  /* 除錯：#verdemo 直接顯示更新橫幅 */
  if (location.hash.includes('verdemo')) setTimeout(() => UI.showUpdateBar(), 1500);
  /* 除錯：#expdemo 本機直接開一場遠征（視覺驗證用） */
  if (location.hash.includes('expdemo')) {
    setTimeout(() => {
      const fake = {
        players: [
          { n: '我', h: Raid.mySnapshots() },
          { n: '鏡像隊友', h: Raid.mySnapshots() },
        ],
        exp: { floor: Math.max(1, Game.state.maxFloorEver - 5) },
      };
      document.querySelector('#tabs button[data-tab=raid]').click();
      UI.startRaid(Raid.expInput(fake, 777), 0, null, null);
    }, 2500);
  }
  /* 除錯：#roomui 用假資料展示房間視圖（不打網路） */
  if (location.hash.includes('roomui')) {
    setTimeout(() => {
      Game.state.settings.playerName = '小明';
      Game.state.settings.roomCode = 'DEMO42';
      UI.roomData = {
        v: 3, code: 'DEMO42', seed: 1,
        boss: { z: 1, lv: 30, hp: 5000000, atk: 800, itv: 16 },
        players: [
          { n: '小明', h: Raid.mySnapshots(0, true), dmg: 1234560 },
          { n: '阿華', h: Raid.mySnapshots(Game.state.teamLv + 30, true), dmg: 987650 },
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
    const e = Raid.simulateExp(Raid.expTestInput());
    document.title = 'RAIDHASH ' + r.hash + ' EXP ' + e.hash;
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

  /* 邏輯迴圈：桌機背景分頁 setInterval 只是降頻；手機切背景／鎖屏會整頁凍結，
     恢復時間隔會一次跳很大 — 長中斷改走離線結算，短中斷逐步補算 */
  let last = Date.now();
  setInterval(() => {
    const now = Date.now();
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 120) {
      const off = Game.offline(dt);
      if (off) UI.showOffline(off);
      UI.drain();
      return;
    }
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

  /* 線上版本檢查：長開的掛機頁面發現新版時顯示更新橫幅 */
  if (location.protocol.startsWith('http')) {
    let notified = false;
    const checkVer = () => {
      if (notified) return;
      fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
        .then(r => r.json())
        .then(d => {
          if (d && d.v > GAME_VERSION && !notified) {
            notified = true;
            UI.showUpdateBar();
          }
        })
        .catch(() => { /* 離線時忽略 */ });
    };
    setInterval(checkVer, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkVer();
    });
    setTimeout(checkVer, 30 * 1000);
  }
})();
