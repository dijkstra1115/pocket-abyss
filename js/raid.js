/* 口袋深淵 — 共鬥引擎（deterministic：固定步長 + 種子亂數 + 整數運算）
   相同 replay input 在任何裝置、任何時間都跑出逐 tick 一致的結果。
   數值約定：hp/atk/def ×10 存整數；crit/leech/healP/thorn 存 ‰；critD ×10（1500=150%）。 */
'use strict';

const RAID_TPS = 10;          /* 每秒邏輯 tick 數（固定步長） */
const RAID_MAX_TICKS = 600;   /* 60 秒戰鬥上限 */
const RAID_VERSION = 2; /* v2：前排承傷（各隊末位 70% 機率被攻擊） */

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

  /* ---------- Prompt 2：隊伍快照（重播所需最小欄位，全部整數） ----------
     lvBoost：共鬥借等級 — 以房內較高等級重算數值，單機等級（tl）不動。
     withEq：附上裝備明細（純檢視用，模擬不讀）。挑戰碼不帶以免碼太長 */
  mySnapshots(lvBoost, withEq) {
    /* 共鬥出戰等級取「歷史最高」：昇華重置單機等級不拖累共鬥戰力 */
    const own = Math.max(Game.state.teamLv, Game.state.stats.maxHeroLv || 1);
    const lv = Math.max(own, lvBoost || 0);
    return Game.raidPartyList().map(cls => {
      const s = Game.heroStatsAt(cls, lv);
      const c = DATA.classes[cls];
      const eq = withEq ? DATA.slotOrder.map(slot => {
        const it = Game.state.heroes[cls].equip[slot];
        return it ? { b: it.base, q: it.q, lv: it.lv, s: it.sockets, g: it.gems, a: it.aff } : 0;
      }) : undefined;
      return {
        c: cls, l: lv, tl: own, eq,
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
  decodeErr: null, /* 'format' | 'version' */
  decode(str) {
    this.decodeErr = null;
    try {
      const o = JSON.parse(decodeURIComponent(escape(atob(String(str).trim()))));
      if (!o || !o.boss || !Array.isArray(o.teams) || !o.teams.length) {
        this.decodeErr = 'format';
        return null;
      }
      if (o.v !== RAID_VERSION) {
        this.decodeErr = 'version';
        return null;
      }
      return o;
    } catch (e) { this.decodeErr = 'format'; return null; }
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

  /* 前排承傷（RAID_VERSION 2）：各隊最後一位存活者為前排，70% 機率被打。
     只用種子亂數，且 alive 依隊列固定順序 → 跨裝置重播一致 */
  pickHeroTarget(st, alive) {
    if (alive.length === 1) return alive[0];
    const lastByTeam = [];
    for (const h of alive) lastByTeam[h.team] = h;
    const fronts = lastByTeam.filter(Boolean);
    const backs = alive.filter(h => lastByTeam[h.team] !== h);
    if (!backs.length || this.rInt(st.rng, 100) < 70) return fronts[this.rInt(st.rng, fronts.length)];
    return backs[this.rInt(st.rng, backs.length)];
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
      const t = this.pickHeroTarget(st, alive);
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

  /* ---------- 雙人深淵遠征：共享進度的接力爬層 ---------- */
  EXP_TICKS: 1200, /* 每輪 120 秒 */

  expInput(room, seed) {
    return {
      v: RAID_VERSION, mode: 'exp', seed: seed >>> 0,
      from: Math.max(1, (room.exp && room.exp.floor) || 1),
      teams: room.players.map(p => ({ n: p.n, h: p.h })),
    };
  },

  /* 怪物成長用整數迭代（×1000 定點），任何引擎逐位一致 */
  expGrowth(floor) {
    const f = Math.min(Math.max(0, floor - 1), 350);
    let g = 1000, a = 1000;
    for (let i = 0; i < f; i++) {
      g = Math.floor(g * 1069 / 1000);
      a = Math.floor(a * 1045 / 1000);
    }
    return { g, a };
  },

  expMobStats(st, mod, boss) {
    const f = st.floor;
    let hp = Math.floor((12 + 5 * f) * 10 * st.g / 1000);
    let atk = Math.floor((25 + 9 * f) * st.a / 1000);
    let itv = 16;
    if (mod === 'tank') { hp = Math.floor(hp * 17 / 10); atk = Math.floor(atk * 8 / 10); itv = 20; }
    else if (mod === 'swift') { hp = Math.floor(hp * 7 / 10); atk = Math.floor(atk * 9 / 10); itv = 10; }
    else if (mod === 'fierce') { atk = Math.floor(atk * 15 / 10); }
    if (boss) { hp *= 9; atk = Math.floor(atk * 19 / 10); itv = 14; }
    return { hp: Math.max(10, hp), atk: Math.max(1, atk), itv };
  },

  expWavesFor(f) { return f % 10 === 0 ? 1 : 3; },

  expInit(input) {
    const heroes = [];
    input.teams.forEach((t, ti) => t.h.forEach((s, hi) => heroes.push({
      team: ti, idx: hi, c: s.c, s, hp: s.hp, shield: 0,
      atkT: (ti * 3 + hi) % s.itv + 1, cdT: s.cd, dmg: 0,
    })));
    const { g, a } = this.expGrowth(input.from);
    const st = {
      input, mode: 'exp', rng: this.mulberry32(input.seed), tick: 0, heroes,
      floor: input.from, cleared: 0, g, a,
      pendingWaves: this.expWavesFor(input.from), mobs: [],
      done: false, win: false, events: [],
    };
    this.expSpawn(st);
    return st;
  },

  expSpawn(st) {
    const f = st.floor;
    const zone = DATA.zones[Math.floor(((f - 1) % 200) / 25)];
    st.pendingWaves--;
    st.mobs = [];
    if (f % 10 === 0) {
      const ms = this.expMobStats(st, 'normal', true);
      st.mobs.push({ def: zone.boss, boss: true, hp: ms.hp, max: ms.hp, atk: ms.atk, itv: ms.itv, atkT: 10 });
    } else {
      const n = 2 + this.rInt(st.rng, 2);
      for (let i = 0; i < Math.min(3, n); i++) {
        const def = zone.mobs[this.rInt(st.rng, zone.mobs.length)];
        const ms = this.expMobStats(st, def.mod, false);
        st.mobs.push({ def, boss: false, hp: ms.hp, max: ms.hp, atk: ms.atk, itv: ms.itv, atkT: 6 + this.rInt(st.rng, 8) });
      }
    }
    st.events.push({ k: 'wave' });
  },

  expAdvance(st) {
    st.floor++;
    st.cleared++;
    st.g = Math.floor(st.g * 1069 / 1000);
    st.a = Math.floor(st.a * 1045 / 1000);
    /* 過層小休：存活者回復 25% */
    for (const h of st.heroes) {
      if (h.hp > 0) h.hp = Math.min(h.s.hp, h.hp + Math.floor(h.s.hp * 25 / 100));
    }
    st.pendingWaves = this.expWavesFor(st.floor);
    st.events.push({ k: 'floor', f: st.floor });
  },

  expHit(st, h, mob, mult100, forceCrit) {
    const r = 90 + this.rInt(st.rng, 21);
    let dmg = Math.floor(Math.floor(h.s.atk * r / 100) * mult100 / 100);
    const crit = forceCrit || this.rInt(st.rng, 1000) < h.s.crit;
    if (crit) dmg = Math.floor(dmg * h.s.critD / 1000);
    mob.hp -= dmg;
    h.dmg += dmg;
    if (h.s.leech > 0) h.hp = Math.min(h.s.hp, h.hp + Math.floor(dmg * h.s.leech / 1000));
    const mi = st.mobs.indexOf(mob);
    st.events.push({ k: 'hit', h: st.heroes.indexOf(h), m: mi, amt: dmg, crit });
    if (mob.hp <= 0) {
      st.events.push({ k: 'kill', m: mi, boss: mob.boss, c1: mob.def.pal.a, c2: mob.def.pal.e });
      st.mobs.splice(mi, 1);
    }
  },

  expSkill(st, h) {
    const sk = DATA.classes[h.c].skill;
    st.events.push({ k: 'skill', h: st.heroes.indexOf(h) });
    const m100 = Math.round(sk.mult * 100);
    if (sk.type === 'aoe') {
      for (const m of [...st.mobs]) this.expHit(st, h, m, m100, false);
    } else if (sk.type === 'multi') {
      for (let i = 0; i < sk.hits; i++) {
        if (!st.mobs.length) break;
        this.expHit(st, h, st.mobs[this.rInt(st.rng, st.mobs.length)], m100, false);
      }
    } else if (sk.type === 'single') {
      if (st.mobs.length) {
        const m = st.mobs.reduce((a, x) => x.hp > a.hp ? x : a, st.mobs[0]);
        this.expHit(st, h, m, m100, !!sk.forceCrit);
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

  expStep(st) {
    if (st.done) return;
    st.tick++;
    if (!st.mobs.length) {
      if (st.pendingWaves <= 0) this.expAdvance(st);
      this.expSpawn(st);
      return;
    }
    for (const h of st.heroes) {
      if (h.hp <= 0 || !st.mobs.length) continue;
      h.atkT--; h.cdT--;
      if (h.atkT <= 0) {
        h.atkT += h.s.itv;
        this.expHit(st, h, st.mobs[0], 100, false);
      }
      if (h.cdT <= 0 && st.mobs.length) {
        h.cdT += h.s.cd;
        this.expSkill(st, h);
      }
    }
    for (let mi = 0; mi < st.mobs.length; mi++) {
      const m = st.mobs[mi];
      m.atkT--;
      if (m.atkT > 0) continue;
      m.atkT += m.itv;
      const alive = st.heroes.filter(h => h.hp > 0);
      if (!alive.length) break;
      const t = this.pickHeroTarget(st, alive);
      const r = 90 + this.rInt(st.rng, 21);
      const raw = Math.floor(m.atk * r / 100);
      const denom = t.s.def + (25 + st.floor * 3) * 10;
      let dmg = Math.floor(raw * (denom - t.s.def) / denom);
      if (t.shield > 0) {
        const ab = Math.min(t.shield, dmg);
        t.shield -= ab; dmg -= ab;
      }
      t.hp -= dmg;
      st.events.push({ k: 'bhit', t: st.heroes.indexOf(t), amt: dmg });
      st.events.push({ k: 'matk', i: mi });
      if (t.s.thorn > 0) {
        const td = Math.floor(t.s.atk * t.s.thorn / 1000);
        m.hp -= td; t.dmg += td;
        if (m.hp <= 0) {
          st.events.push({ k: 'kill', m: mi, boss: m.boss, c1: m.def.pal.a, c2: m.def.pal.e });
          st.mobs.splice(mi, 1); mi--;
          continue;
        }
      }
      if (t.hp <= 0) { t.hp = 0; st.events.push({ k: 'down', t: st.heroes.indexOf(t) }); }
    }
    if (!st.heroes.some(h => h.hp > 0)) { st.done = true; return; }
    if (st.tick >= this.EXP_TICKS) st.done = true;
  },

  /* 統一入口：依模式推進一個 tick */
  step(st) {
    if (st.mode === 'exp') this.expStep(st);
    else this.stepTick(st);
  },

  simulateExp(input) {
    const st = this.expInit(input);
    let hash = 2166136261 >>> 0;
    const mix = (n) => {
      hash = (hash ^ ((n < 0 ? -n : n) >>> 0)) >>> 0;
      hash = Math.imul(hash, 16777619) >>> 0;
    };
    while (!st.done) {
      this.expStep(st);
      st.events.length = 0;
      mix(st.tick); mix(st.floor); mix(st.mobs.length);
      for (const m of st.mobs) mix(m.hp);
      for (const h of st.heroes) { mix(h.hp); mix(h.dmg); mix(h.shield); }
    }
    const teamDmg = st.input.teams.map(() => 0);
    for (const h of st.heroes) teamDmg[h.team] += h.dmg;
    return {
      from: input.from, to: input.from + st.cleared, cleared: st.cleared,
      ticks: st.tick, teamDmg,
      heroDmg: st.heroes.map(h => ({ c: h.c, team: h.team, dmg: h.dmg })),
      hash,
    };
  },

  expTestInput() {
    const base = this.testInput();
    return { v: RAID_VERSION, mode: 'exp', seed: 987654321, from: 35, teams: base.teams };
  },

  /* ---------- Prompt 4：雲端房間（Cloudflare Worker + KV） ---------- */
  API: 'https://pocket-abyss-rooms.style78432.workers.dev',

  async api(path, body) {
    const res = await fetch(this.API + path, body ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    } : undefined);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.err) || ('HTTP ' + res.status));
    return data;
  },

  createRoom(raidLv, name) {
    return this.api('/room', {
      v: 2, /* 房間格式版本＝模擬規則版本：v2 起含前排承傷 */
      seed: (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 1,
      boss: this.bossConfig(raidLv),
      player: { n: name, h: this.mySnapshots(0, true) },
    });
  },
  getRoom(code) { return this.api('/room/' + encodeURIComponent(code)); },
  joinRoom(code, name, lvBoost) {
    return this.api('/room/' + encodeURIComponent(code) + '/join', { n: name, h: this.mySnapshots(lvBoost, true) });
  },
  postDamage(code, name, dmg, seed) {
    return this.api('/room/' + encodeURIComponent(code) + '/damage', { n: name, dmg, seed });
  },
  postExp(code, name, from, to, seed) {
    return this.api('/room/' + encodeURIComponent(code) + '/exp', { n: name, from, to, seed });
  },

  /* 由房間狀態組出一場 replay input（雙方裝置以同 seed 組出即逐幀一致） */
  roomInput(room, seed) {
    return {
      v: RAID_VERSION, seed: seed >>> 0, boss: room.boss,
      teams: room.players.map(p => ({ n: p.n, h: p.h })),
    };
  },
  newRoundSeed() {
    return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 1;
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
