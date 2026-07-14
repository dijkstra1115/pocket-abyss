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
