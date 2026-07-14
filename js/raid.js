/* 口袋深淵 — 共鬥引擎（deterministic：固定步長 + 種子亂數 + 整數運算）
   相同 replay input 在任何裝置、任何時間都跑出逐 tick 一致的結果。
   數值約定：hp/atk/def ×10 存整數；crit/leech/healP/thorn 存 ‰；critD ×10（1500=150%）。 */
'use strict';

const RAID_TPS = 10;          /* 每秒邏輯 tick 數（固定步長） */
const RAID_MAX_TICKS = 600;   /* 60 秒戰鬥上限 */
const RAID_VERSION = 1;

const Raid = {
  /* ---------- 種子亂數（mulberry32，跨引擎一致） ---------- */
  mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  },
  rInt(rng, n) { return Math.floor(rng() * n); },

  /* ---------- Prompt 2：隊伍快照（重播所需最小欄位，全部整數） ---------- */
  mySnapshots() {
    return Game.state.party.map(cls => {
      const s = Game.heroStats(cls);
      const c = DATA.classes[cls];
      return {
        c: cls, l: Game.state.heroes[cls].lv,
        atk: Math.max(1, Math.floor(s.atk * 10)),
        hp: Math.max(10, Math.floor(s.hp * 10)),
        def: Math.max(0, Math.floor(s.def * 10)),
        itv: Math.max(2, Math.round(RAID_TPS / s.aspd)),                            /* 普攻間隔 ticks */
        cd: Math.max(RAID_TPS, Math.round(c.skill.cd * RAID_TPS / (1 + s.haste / 100))), /* 技能 CD ticks */
        crit: Math.floor(s.crit * 10),
        critD: Math.floor(s.critD * 10),
        leech: Math.floor(s.leech * 10),
        healP: Math.floor(s.healP * 10),
        thorn: Math.floor(s.thorn * 10),
      };
    });
  },

  /* 王的配置在開房裝置上算一次、存成整數 —— 重播路徑上沒有任何浮點 pow */
  bossConfig(raidLv) {
    const ms = Game.mobStats(raidLv, 'normal', true);
    return {
      z: Game.zoneIdx(raidLv), lv: raidLv,
      hp: Math.floor(ms.hp * 10) * 25,   /* 共鬥王 = 25 倍血牛 Boss */
      atk: Math.floor(ms.atk * 10),
      itv: Math.max(4, Math.round(ms.interval * RAID_TPS)),
    };
  },

  newChallenge(raidLv, name) {
    return {
      v: RAID_VERSION,
      seed: (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 1,
      boss: this.bossConfig(raidLv),
      teams: [{ n: name, h: this.mySnapshots() }],
    };
  },

  joinChallenge(input, name) {
    const full = JSON.parse(JSON.stringify(input));
    full.teams.push({ n: name, h: this.mySnapshots() });
    return full;
  },

  encode(input) { return btoa(unescape(encodeURIComponent(JSON.stringify(input)))); },
  decode(str) {
    try {
      const o = JSON.parse(decodeURIComponent(escape(atob(String(str).trim()))));
      if (!o || o.v !== RAID_VERSION || !o.boss || !Array.isArray(o.teams) || !o.teams.length) return null;
      return o;
    } catch (e) { return null; }
  },

  /* ---------- Prompt 1：固定步長模擬核心 ---------- */
  init(input) {
    const heroes = [];
    input.teams.forEach((t, ti) => t.h.forEach((s, hi) => heroes.push({
      team: ti, idx: hi, c: s.c, s,
      hp: s.hp, shield: 0,
      atkT: (ti * 3 + hi) % s.itv + 1,   /* 固定規則錯開起手（非亂數） */
      cdT: s.cd,
      dmg: 0,
    })));
    return {
      input, rng: this.mulberry32(input.seed), tick: 0, heroes,
      boss: { hp: input.boss.hp, atkT: input.boss.itv },
      done: false, win: false, events: [],
    };
  },

  stepTick(st) {
    if (st.done) return;
    st.tick++;
    const boss = st.boss;

    /* 英雄依固定順序行動（隊0→隊1、各依欄位序） */
    for (const h of st.heroes) {
      if (h.hp <= 0 || boss.hp <= 0) continue;
      h.atkT--; h.cdT--;
      if (h.atkT <= 0) {
        h.atkT += h.s.itv;
        this.heroStrike(st, h, 100, false);
      }
      if (h.cdT <= 0 && boss.hp > 0) {
        h.cdT += h.s.cd;
        this.castSkill(st, h);
      }
    }
    if (boss.hp <= 0) { st.done = true; st.win = true; return; }

    /* 王行動 */
    boss.atkT--;
    if (boss.atkT <= 0) {
      boss.atkT += st.input.boss.itv;
      const alive = st.heroes.filter(h => h.hp > 0);
      if (!alive.length) { st.done = true; return; }
      const t = alive[this.rInt(st.rng, alive.length)];
      const r = 90 + this.rInt(st.rng, 21);
      const raw = Math.floor(st.input.boss.atk * r / 100);
      const denom = t.s.def + (25 + st.input.boss.lv * 3) * 10;
      let dmg = Math.floor(raw * (denom - t.s.def) / denom);
      if (t.shield > 0) {
        const ab = Math.min(t.shield, dmg);
        t.shield -= ab; dmg -= ab;
      }
      t.hp -= dmg;
      st.events.push({ k: 'bhit', t: st.heroes.indexOf(t), amt: dmg });
      if (t.s.thorn > 0) {
        const td = Math.floor(t.s.atk * t.s.thorn / 1000);
        boss.hp -= td; t.dmg += td;
      }
      if (t.hp <= 0) { t.hp = 0; st.events.push({ k: 'down', t: st.heroes.indexOf(t) }); }
    }
    if (boss.hp <= 0) { st.done = true; st.win = true; return; }
    if (!st.heroes.some(h => h.hp > 0)) { st.done = true; return; }
    if (st.tick >= RAID_MAX_TICKS) st.done = true;
  },

  heroStrike(st, h, mult100, forceCrit) {
    const r = 90 + this.rInt(st.rng, 21);
    let dmg = Math.floor(Math.floor(h.s.atk * r / 100) * mult100 / 100);
    const crit = forceCrit || this.rInt(st.rng, 1000) < h.s.crit;
    if (crit) dmg = Math.floor(dmg * h.s.critD / 1000);
    st.boss.hp -= dmg;
    h.dmg += dmg;
    if (h.s.leech > 0) h.hp = Math.min(h.s.hp, h.hp + Math.floor(dmg * h.s.leech / 1000));
    st.events.push({ k: 'hit', h: st.heroes.indexOf(h), amt: dmg, crit });
  },

  castSkill(st, h) {
    const sk = DATA.classes[h.c].skill;
    st.events.push({ k: 'skill', h: st.heroes.indexOf(h) });
    const m100 = Math.round(sk.mult * 100);
    if (sk.type === 'aoe' || sk.type === 'single') {
      this.heroStrike(st, h, m100, !!sk.forceCrit);
    } else if (sk.type === 'multi') {
      for (let i = 0; i < sk.hits; i++) {
        if (st.boss.hp <= 0) break;
        this.heroStrike(st, h, m100, false);
      }
    } else if (sk.type === 'heal') {
      for (const a of st.heroes) {
        if (a.hp <= 0) continue;
        const amt = Math.floor(Math.floor(a.s.hp * m100 / 100) * (1000 + h.s.healP) / 1000);
        a.hp = Math.min(a.s.hp, a.hp + amt);
        st.events.push({ k: 'heal', t: st.heroes.indexOf(a), amt });
      }
    } else if (sk.type === 'shield') {
      const val = Math.floor(h.s.hp * m100 / 100);
      for (const a of st.heroes) {
        if (a.hp > 0) a.shield = Math.max(a.shield, val);
      }
    }
  },

  /* 一口氣跑完整場：回傳結果 + 全程狀態雜湊（determinism 驗證用） */
  simulate(input) {
    const st = this.init(input);
    let hash = 2166136261 >>> 0;
    const mix = (n) => {
      hash = (hash ^ ((n < 0 ? -n : n) >>> 0)) >>> 0;
      hash = Math.imul(hash, 16777619) >>> 0;
    };
    while (!st.done) {
      this.stepTick(st);
      st.events.length = 0;
      mix(st.tick); mix(st.boss.hp);
      for (const h of st.heroes) { mix(h.hp); mix(h.dmg); mix(h.shield); }
    }
    const teamDmg = st.input.teams.map(() => 0);
    for (const h of st.heroes) teamDmg[h.team] += h.dmg;
    return {
      win: st.win, ticks: st.tick, teamDmg,
      heroDmg: st.heroes.map(h => ({ c: h.c, team: h.team, dmg: h.dmg })),
      hash,
    };
  },

  /* 跨環境 determinism 測試用的固定輸入（Node 與瀏覽器都跑它比對雜湊） */
  testInput() {
    const mk = (c, atk, hp, def, itv, cd, crit) => ({
      c, l: 30, atk, hp, def, itv, cd,
      crit, critD: 1800, leech: 20, healP: 100, thorn: 50,
    });
    return {
      v: RAID_VERSION, seed: 123456789,
      boss: { z: 2, lv: 60, hp: 52000000, atk: 5200, itv: 16 },
      teams: [
        { n: 'A', h: [mk('blade', 8200, 61000, 900, 10, 55, 80), mk('ranger', 9100, 43000, 500, 8, 46, 180), mk('mage', 11500, 39000, 300, 14, 74, 100)] },
        { n: 'B', h: [mk('cleric', 4800, 52000, 800, 12, 74, 50), mk('rogue', 10800, 40000, 450, 7, 65, 240), mk('guard', 5200, 88000, 1500, 12, 111, 50)] },
      ],
    };
  },
};
