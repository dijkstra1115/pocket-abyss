/* 口袋深淵 — 核心邏輯（無 DOM，可獨立於 Node 測試） */
'use strict';

const SAVE_KEY = 'pocket-abyss-save-v1';
const INV_CAP = 60;
const LS = (typeof localStorage !== 'undefined') ? localStorage : null;

const Game = {
  state: null,
  battle: null,
  events: [],
  _cache: {},
  _achT: 0,
  _saveT: 0,

  /* ============ 存檔 ============ */
  defaultState() {
    return {
      version: 1,
      gold: 0, dust: 0, ember: 0,
      floor: 1, maxFloorEver: 1, runMaxFloor: 1,
      failStreak: 0,
      nextId: 1,
      teamLv: 1, teamXp: 0,
      heroes: {
        blade: { equip: {} },
        ranger: { equip: {} },
        mage: { equip: {} },
      },
      party: ['blade', 'ranger', 'mage'],
      inventory: [],
      cores: {},
      talents: {},
      achievements: {},
      stats: {
        kills: 0, bossKills: 0, goldEarned: 0, itemsFound: 0, itemsSalvaged: 0,
        coresFused: 0, prestiges: 0, maxHeroLv: 1, bestQuality: 0, maxFloorEver: 1,
        playtime: 0,
      },
      kps: 0.2,
      settings: { autoAdvance: true, autoSalv: 0, autoSalvLv: 0, mini: false, uiScale: 1, playerName: '勇者', roomCode: '' },
      lastSeen: Date.now(),
    };
  },

  save() {
    if (!LS) return;
    this.state.lastSeen = Date.now();
    try { LS.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch (e) { /* 空間不足時放棄 */ }
  },

  load() {
    if (!LS) return false;
    const raw = LS.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      const d = this.defaultState();
      this.state = Object.assign(d, parsed);
      this.state.stats = Object.assign(d.stats, parsed.stats || {});
      this.state.settings = Object.assign(d.settings, parsed.settings || {});
      this.migrate();
      return true;
    } catch (e) { return false; }
  },

  /* 舊存檔遷移：個別英雄等級 → 全隊等級（取最高者，不虧） */
  migrate() {
    const st = this.state;
    if (st.teamLv === undefined || st.teamLv === null) {
      let maxLv = 1;
      for (const cls of Object.keys(st.heroes)) {
        if (st.heroes[cls].lv > maxLv) maxLv = st.heroes[cls].lv;
      }
      st.teamLv = maxLv;
      st.teamXp = 0;
    }
    for (const cls of Object.keys(st.heroes)) {
      delete st.heroes[cls].lv;
      delete st.heroes[cls].xp;
    }
  },

  exportSave() {
    return btoa(unescape(encodeURIComponent(JSON.stringify(this.state))));
  },

  importSave(str) {
    try {
      const parsed = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
      if (!parsed || !parsed.heroes) return false;
      const d = this.defaultState();
      this.state = Object.assign(d, parsed);
      this.state.stats = Object.assign(d.stats, parsed.stats || {});
      this.state.settings = Object.assign(d.settings, parsed.settings || {});
      this.migrate();
      this.dirty();
      this.initBattle();
      this.save();
      return true;
    } catch (e) { return false; }
  },

  wipe() {
    if (LS) LS.removeItem(SAVE_KEY);
    this.newGame();
  },

  newGame() {
    this.state = this.defaultState();
    this.dirty();
    this.initBattle();
  },

  boot() {
    if (!this.load()) this.state = this.defaultState();
    this.dirty();
    this.initBattle();
    const elapsed = (Date.now() - (this.state.lastSeen || Date.now())) / 1000;
    return this.offline(elapsed);
  },

  emit(e) { this.events.push(e); if (this.events.length > 300) this.events.shift(); },
  dirty() { this._cache = {}; },

  /* ============ 數值輔助 ============ */
  fmt(n) {
    n = Math.floor(n);
    if (n < 1000) return String(n);
    const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (const [v, u] of units) {
      if (n >= v) {
        const x = n / v;
        return (x >= 100 ? Math.floor(x) : x.toFixed(1)) + u;
      }
    }
    return String(n);
  },

  cycleOf(floor) { return Math.floor((floor - 1) / 200); },
  zoneIdx(floor) { return Math.floor(((floor - 1) % 200) / 25); },
  zoneOf(floor) { return DATA.zones[this.zoneIdx(floor)]; },
  diffName(floor) {
    const c = this.cycleOf(floor);
    return c < 3 ? DATA.difficulties[c] : DATA.difficulties[3] + (c - 2);
  },
  isBossFloor(floor) { return floor % 10 === 0; },
  wavesPerFloor(floor) {
    return this.isBossFloor(floor) ? 1 : 4 + Math.min(4, Math.floor(floor / 50));
  },
  startFloor() { return 1 + this.talentVal('vanguard'); },

  talentRank(id) { return this.state.talents[id] || 0; },
  talentVal(id) {
    const t = DATA.talents.find(t => t.id === id);
    return t ? this.talentRank(id) * t.per : 0;
  },
  achPts() { return Object.keys(this.state.achievements).length; },

  /* ============ 裝備數值 ============ */
  itemBaseStats(item) {
    const base = DATA.bases.find(b => b.id === item.base);
    const m = DATA.qualities[item.q].mult * (1 + (base ? base.tier : 0) * 0.06);
    const lv = item.lv;
    const s = { atk: 0, hp: 0, def: 0 };
    if (item.slot === 'weapon') s.atk = (3 + lv * 1.6) * m;
    else if (item.slot === 'helm') { s.hp = (8 + lv * 2.6) * m; s.def = (1 + lv * 0.45) * m; }
    else if (item.slot === 'armor') { s.hp = (12 + lv * 4) * m; s.def = (2 + lv * 0.65) * m; }
    else { s.atk = (1 + lv * 0.5) * m; s.hp = (5 + lv * 1.6) * m; }
    s.atk = Math.round(s.atk); s.hp = Math.round(s.hp); s.def = Math.round(s.def);
    return s;
  },

  /* 裝備上所有加成（詞綴 + 星核） */
  itemBonuses(item, out) {
    for (const [k, v] of item.aff) out[k] = (out[k] || 0) + v;
    for (const g of item.gems) {
      const [type, tier] = g.split('_');
      const ct = DATA.coreTypes[type];
      if (ct) out[ct.stat] = (out[ct.stat] || 0) + ct.base * DATA.coreTiers[+tier].mult;
    }
    return out;
  },

  itemScore(item) { return item.q * 10000 + item.lv * 10 + item.aff.length; },

  heroStats(cls) {
    if (this._cache[cls]) return this._cache[cls];
    const c = DATA.classes[cls];
    const h = this.state.heroes[cls];
    const lvM = 1 + 0.15 * (this.state.teamLv - 1);
    let fAtk = 0, fHp = 0, fDef = 0;
    const bon = {};
    for (const slot of DATA.slotOrder) {
      const it = h.equip[slot];
      if (!it) continue;
      const bs = this.itemBaseStats(it);
      fAtk += bs.atk; fHp += bs.hp; fDef += bs.def;
      this.itemBonuses(it, bon);
    }
    for (const t of DATA.talents) {
      if (['atkP', 'hpP', 'allP'].includes(t.stat))
        bon[t.stat] = (bon[t.stat] || 0) + this.talentRank(t.id) * t.per;
    }
    const allP = (bon.allP || 0) + this.achPts() * 0.5;
    const st = {
      atk: (c.base.atk * lvM + fAtk) * (1 + ((bon.atkP || 0) + allP) / 100),
      hp: Math.max(1, (c.base.hp * lvM + fHp) * (1 + ((bon.hpP || 0) + allP) / 100)),
      def: (c.base.def * lvM + fDef) * (1 + ((bon.defP || 0) + allP) / 100),
      aspd: c.base.aspd * (1 + (bon.aspd || 0) / 100),
      crit: c.base.crit + (bon.crit || 0),
      critD: 150 + (bon.critD || 0),
      leech: bon.leech || 0,
      haste: bon.haste || 0,
      healP: bon.healP || 0,
      thorn: bon.thorn || 0,
    };
    this._cache[cls] = st;
    return st;
  },

  /* 全隊經濟加成（上陣裝備 + 天賦 + 成就） */
  economy() {
    if (this._cache.__eco) return this._cache.__eco;
    const bon = {};
    for (const cls of this.state.party) {
      const h = this.state.heroes[cls];
      if (!h) continue;
      for (const slot of DATA.slotOrder) {
        if (h.equip[slot]) this.itemBonuses(h.equip[slot], bon);
      }
    }
    for (const t of DATA.talents) {
      if (['goldP', 'xpP', 'dropP', 'coreP'].includes(t.stat))
        bon[t.stat] = (bon[t.stat] || 0) + this.talentRank(t.id) * t.per;
    }
    const eco = {
      goldP: (bon.goldP || 0) + this.achPts() * 1,
      xpP: bon.xpP || 0,
      dropP: bon.dropP || 0,
      mf: bon.mf || 0,
      dustP: bon.dustP || 0,
      coreP: bon.coreP || 0,
    };
    this._cache.__eco = eco;
    return eco;
  },

  /* ============ 怪物 ============ */
  MOB_MODS: {
    normal: { hp: 1.0, atk: 1.0, spd: 1.0 },
    tank: { hp: 1.7, atk: 0.8, spd: 0.8 },
    swift: { hp: 0.7, atk: 0.9, spd: 1.5 },
    fierce: { hp: 0.9, atk: 1.5, spd: 1.0 },
  },

  mobStats(floor, mod, isBoss) {
    const f = Math.min(floor, 400);
    const cycle = this.cycleOf(floor);
    const m = this.MOB_MODS[mod] || this.MOB_MODS.normal;
    let hp = (12 + 5 * floor) * Math.pow(1.069, f) * Math.pow(4, cycle) * m.hp;
    let atk = (2.5 + 0.9 * floor) * Math.pow(1.045, f) * Math.pow(2.5, cycle) * m.atk;
    if (isBoss) { hp *= 9; atk *= 1.9; }
    return { hp, atk, interval: 1.6 / m.spd / (isBoss ? 0.9 : 1) };
  },

  killGold(floor) {
    const f = Math.min(floor, 300);
    return (2 + 1.2 * floor) * Math.pow(1.035, f) * (1 + this.cycleOf(floor));
  },
  killXp(floor) {
    return (4 + 2.2 * floor) * (1 + this.cycleOf(floor) * 0.5);
  },
  dropChance() { return 0.10 * (1 + this.economy().dropP / 100); },

  /* ============ 戰鬥 ============ */
  initBattle() {
    this.battle = { heroes: [], mobs: [], wave: 0, pauseT: 0.5 };
    this.rebuildHeroes();
  },

  rebuildHeroes() {
    this.battle.heroes = this.state.party.map(cls => {
      const st = this.heroStats(cls);
      return { cls, hp: st.hp, max: st.hp, atkT: Math.random() * 0.5, skillT: 2 + Math.random() * 2, shield: 0 };
    });
  },

  spawnWave() {
    const st = this.state;
    const zone = this.zoneOf(st.floor);
    const mobs = [];
    if (this.isBossFloor(st.floor)) {
      const b = zone.boss;
      const ms = this.mobStats(st.floor, 'normal', true);
      mobs.push({ def: b, boss: true, hp: ms.hp, max: ms.hp, atk: ms.atk, interval: ms.interval, atkT: 1.2 });
    } else {
      const count = 1 + Math.floor(Math.random() * Math.min(3, 1 + st.floor / 8));
      for (let i = 0; i < Math.min(3, count); i++) {
        const def = zone.mobs[Math.floor(Math.random() * zone.mobs.length)];
        const ms = this.mobStats(st.floor, def.mod, false);
        mobs.push({ def, boss: false, hp: ms.hp, max: ms.hp, atk: ms.atk, interval: ms.interval, atkT: 0.8 + Math.random() * 0.8 });
      }
    }
    this.battle.mobs = mobs;
    this.emit({ k: 'wave' });
  },

  tick(dt) {
    const st = this.state, b = this.battle;
    if (!st || !b) return;
    st.stats.playtime += dt;
    this._killAcc = 0;

    this._achT += dt;
    if (this._achT > 2) { this._achT = 0; this.checkAch(); }
    this._saveT += dt;
    if (this._saveT > 15) { this._saveT = 0; this.save(); }

    /* 屬性變動時同步血量上限 */
    for (const bh of b.heroes) {
      const s = this.heroStats(bh.cls);
      if (Math.abs(s.hp - bh.max) > 0.5) {
        const ratio = bh.max > 0 ? bh.hp / bh.max : 1;
        bh.max = s.hp;
        bh.hp = Math.min(bh.max, Math.max(bh.hp > 0 ? 1 : 0, bh.max * ratio));
      }
    }

    if (b.pauseT > 0) {
      b.pauseT -= dt;
      if (b.pauseT <= 0) {
        for (const bh of b.heroes) { bh.hp = bh.max; bh.shield = 0; }
        this.spawnWave();
      }
      return;
    }

    if (b.mobs.length === 0) { this.spawnWave(); return; }

    /* 英雄行動 */
    for (let i = 0; i < b.heroes.length; i++) {
      const bh = b.heroes[i];
      if (bh.hp <= 0) continue;
      const s = this.heroStats(bh.cls);
      bh.atkT -= dt;
      bh.skillT -= dt;
      if (bh.atkT <= 0 && b.mobs.length) {
        bh.atkT += 1 / Math.max(0.1, s.aspd);
        this.heroHit(i, bh, s, b.mobs[0], 1, false);
      }
      if (bh.skillT <= 0 && b.mobs.length) {
        this.castSkill(i, bh, s);
      }
      if (b.mobs.length === 0) break;
    }

    /* 波次清空 → 推進 */
    if (b.mobs.length === 0) {
      b.wave++;
      st.failStreak = 0;
      if (b.wave >= this.wavesPerFloor(st.floor)) {
        b.wave = 0;
        if (st.settings.autoAdvance) {
          const prevZone = this.zoneIdx(st.floor);
          st.floor++;
          st.runMaxFloor = Math.max(st.runMaxFloor, st.floor);
          if (st.floor > st.maxFloorEver) {
            st.maxFloorEver = st.floor;
            st.stats.maxFloorEver = st.floor;
          }
          if (this.zoneIdx(st.floor) !== prevZone) {
            this.emit({ k: 'zone', name: this.zoneOf(st.floor).name });
          }
        }
      }
      b.pauseT = 0.6;
      return;
    }

    /* 怪物行動 */
    const alive = b.heroes.filter(h => h.hp > 0);
    if (!alive.length) { this.onWipe(); return; }
    for (let mi = 0; mi < b.mobs.length; mi++) {
      const m = b.mobs[mi];
      m.atkT -= dt;
      if (m.atkT > 0) continue;
      m.atkT += m.interval;
      const targets = b.heroes.filter(h => h.hp > 0);
      if (!targets.length) break;
      const t = targets[Math.floor(Math.random() * targets.length)];
      const ti = b.heroes.indexOf(t);
      const s = this.heroStats(t.cls);
      const raw = m.atk * (0.9 + Math.random() * 0.2);
      let dmg = raw * (1 - s.def / (s.def + 25 + this.state.floor * 3));
      if (t.shield > 0) {
        const absorbed = Math.min(t.shield, dmg);
        t.shield -= absorbed;
        dmg -= absorbed;
      }
      t.hp -= dmg;
      this.emit({ k: 'hit', side: 'hero', i: ti, amt: dmg, crit: false });
      this.emit({ k: 'atk', side: 'mob', i: mi });
      if (s.thorn > 0) {
        m.hp -= s.atk * s.thorn / 100;
        if (m.hp <= 0) { this.onKill(m); b.mobs.splice(mi, 1); mi--; continue; }
      }
      if (t.hp <= 0) {
        t.hp = 0;
        this.emit({ k: 'down', i: ti });
        if (!b.heroes.some(h => h.hp > 0)) { this.onWipe(); return; }
      }
    }

    /* 擊殺速率 EMA（供離線收益） */
    if (this._killAcc > 0) {
      st.kps = st.kps + (this._killAcc / Math.max(dt, 0.01) - st.kps) * Math.min(1, dt / 60);
      st.kps = Math.min(st.kps, 8);
    } else {
      st.kps = Math.max(0.02, st.kps - st.kps * dt / 600);
    }
  },

  heroHit(hi, bh, s, mob, mult, forceCrit, isSkill) {
    const b = this.battle;
    let dmg = s.atk * (0.9 + Math.random() * 0.2) * mult;
    const crit = forceCrit || Math.random() * 100 < s.crit;
    if (crit) dmg *= s.critD / 100;
    mob.hp -= dmg;
    if (s.leech > 0) bh.hp = Math.min(bh.max, bh.hp + dmg * s.leech / 100);
    const mi = b.mobs.indexOf(mob);
    this.emit({ k: 'hit', side: 'mob', i: mi, amt: dmg, crit, by: bh.cls, sk: !!isSkill });
    this.emit({ k: 'atk', side: 'hero', i: hi });
    if (mob.hp <= 0) {
      this.onKill(mob);
      const idx = b.mobs.indexOf(mob);
      if (idx >= 0) b.mobs.splice(idx, 1);
    }
  },

  castSkill(hi, bh, s) {
    const b = this.battle;
    const c = DATA.classes[bh.cls];
    const sk = c.skill;
    bh.skillT = sk.cd / (1 + s.haste / 100);
    this.emit({ k: 'skill', i: hi, cls: bh.cls, type: sk.type, name: sk.name });
    if (sk.type === 'aoe') {
      for (const m of [...b.mobs]) this.heroHit(hi, bh, s, m, sk.mult, false, true);
    } else if (sk.type === 'multi') {
      for (let n = 0; n < sk.hits; n++) {
        if (!b.mobs.length) break;
        const m = b.mobs[Math.floor(Math.random() * b.mobs.length)];
        this.heroHit(hi, bh, s, m, sk.mult, false, true);
      }
    } else if (sk.type === 'single') {
      if (b.mobs.length) {
        const m = b.mobs.reduce((a, x) => x.hp > a.hp ? x : a, b.mobs[0]);
        this.heroHit(hi, bh, s, m, sk.mult, !!sk.forceCrit, true);
      }
    } else if (sk.type === 'heal') {
      for (let i = 0; i < b.heroes.length; i++) {
        const h = b.heroes[i];
        if (h.hp <= 0) continue;
        const amt = h.max * sk.mult * (1 + s.healP / 100);
        h.hp = Math.min(h.max, h.hp + amt);
        this.emit({ k: 'heal', i, amt });
      }
    } else if (sk.type === 'shield') {
      const val = bh.max * sk.mult * (1 + s.healP / 100);
      for (const h of b.heroes) {
        if (h.hp <= 0) continue;
        h.shield = Math.max(h.shield, val);
      }
      this.emit({ k: 'shieldUp' });
    }
  },

  onWipe() {
    const st = this.state, b = this.battle;
    st.failStreak++;
    b.wave = 0;
    b.mobs = [];
    b.pauseT = 3;
    if (st.failStreak >= 3) {
      st.failStreak = 0;
      const back = Math.max(this.startFloor(), st.floor - 1);
      if (back !== st.floor) {
        st.floor = back;
        this.emit({ k: 'retreat', floor: st.floor });
      }
    }
    this.emit({ k: 'wipe' });
  },

  onKill(mob) {
    const st = this.state;
    const eco = this.economy();
    const f = st.floor;
    this.emit({
      k: 'kill', i: this.battle.mobs.indexOf(mob), boss: mob.boss,
      c1: mob.def.pal.a, c2: mob.def.pal.e,
    });
    this._killAcc = (this._killAcc || 0) + 1;
    st.stats.kills++;
    if (mob.boss) st.stats.bossKills++;

    const gold = Math.ceil(this.killGold(f) * (mob.boss ? 8 : 1) * (1 + eco.goldP / 100));
    st.gold += gold;
    st.stats.goldEarned += gold;

    const xp = this.killXp(f) * (mob.boss ? 6 : 1) * (1 + eco.xpP / 100);
    this.gainXp(xp);

    if (mob.boss) {
      this.addItem(this.rollItem(f, true));
      this.addItem(this.rollItem(f, true));
      if (Math.random() < 0.35 * (1 + eco.coreP / 100)) this.dropCore(f);
      this.emit({ k: 'bossKill', name: mob.def.name });
    } else {
      if (Math.random() < this.dropChance()) this.addItem(this.rollItem(f, false));
      if (Math.random() < 0.004 * (1 + eco.coreP / 100)) this.dropCore(f);
    }
  },

  /* 全隊共享等級：換上任何英雄都是隊伍等級 */
  gainXp(amt) {
    const st = this.state;
    st.teamXp += amt;
    let leveled = false;
    while (st.teamXp >= this.xpNeed(st.teamLv) && st.teamLv < 999) {
      st.teamXp -= this.xpNeed(st.teamLv);
      st.teamLv++;
      leveled = true;
    }
    if (leveled) {
      st.stats.maxHeroLv = Math.max(st.stats.maxHeroLv, st.teamLv);
      this.dirty();
      this.emit({ k: 'lvl', lv: st.teamLv });
    }
  },

  xpNeed(lv) { return Math.floor(25 * Math.pow(1.17, lv - 1)); },

  /* ============ 掉寶 ============ */
  rollQuality(floor, isBoss) {
    const eco = this.economy();
    const cycle = this.cycleOf(floor);
    const boost = (1 + eco.mf / 100) * (1 + cycle * 0.35) * (1 + floor / 500) * (isBoss ? 4 : 1);
    for (let q = 11; q >= 2; q--) {
      if (Math.random() < DATA.qualityChance[q] * boost) return q;
    }
    let q = Math.random() < 0.8 ? 1 : 0;
    if (isBoss && q < 3) q = 3;
    return q;
  },

  rollItem(floor, isBoss) {
    const st = this.state;
    const q = this.rollQuality(floor, isBoss);
    const slot = DATA.slotOrder[Math.floor(Math.random() * 4)];
    const pool = DATA.bases.filter(b => b.slot === slot && b.tier * 22 <= floor);
    const base = pool[Math.floor(Math.random() * pool.length)];
    const n = DATA.affixCount[q];
    const keys = [...DATA.affixKeys];
    const aff = [];
    for (let i = 0; i < n && keys.length; i++) {
      const ki = Math.floor(Math.random() * keys.length);
      const k = keys.splice(ki, 1)[0];
      const a = DATA.affixes[k];
      const v = Math.round((a.min + Math.random() * (a.max - a.min)) * (1 + q * 0.12) * 10) / 10;
      aff.push([k, v]);
    }
    let sockets = 0;
    if (Math.random() < 0.06 + q * 0.02) sockets++;
    if (Math.random() < 0.02 + q * 0.012) sockets++;
    return { id: st.nextId++, base: base.id, slot, lv: floor, q, aff, sockets, gems: [] };
  },

  baseOf(item) { return DATA.bases.find(b => b.id === item.base); },
  itemName(item) {
    const b = this.baseOf(item);
    return `${DATA.qualities[item.q].name}${b ? b.name : '?'}`;
  },

  addItem(item) {
    const st = this.state;
    st.stats.itemsFound++;
    if (item.q > st.stats.bestQuality) st.stats.bestQuality = item.q;
    if (item.q < st.settings.autoSalv ||
        (st.settings.autoSalvLv > 0 && item.lv < st.settings.autoSalvLv)) {
      st.dust += this.dustFor(item);
      st.stats.itemsSalvaged++;
      return;
    }
    if (st.inventory.length >= INV_CAP) {
      st.dust += this.dustFor(item);
      st.stats.itemsSalvaged++;
      this.emit({ k: 'invFull' });
      return;
    }
    st.inventory.push(item);
    if (item.q >= 3) this.emit({ k: 'loot', item });
  },

  dropCore(floor) {
    const type = DATA.coreTypeOrder[Math.floor(Math.random() * DATA.coreTypeOrder.length)];
    let tier = 0;
    while (tier < 4 && Math.random() < 0.10 + Math.min(0.25, floor / 800)) tier++;
    const key = `${type}_${tier}`;
    this.state.cores[key] = (this.state.cores[key] || 0) + 1;
    this.emit({ k: 'core', type, tier });
  },

  /* ============ 背包 / 裝備 ============ */
  findItem(id) { return this.state.inventory.find(i => i.id === id); },

  equip(id, cls) {
    const st = this.state;
    const item = this.findItem(id);
    const h = st.heroes[cls];
    if (!item || !h) return false;
    const old = h.equip[item.slot];
    st.inventory = st.inventory.filter(i => i.id !== id);
    h.equip[item.slot] = item;
    if (old) st.inventory.push(old);
    this.dirty();
    return true;
  },

  /* 一鍵配裝：為上陣英雄逐欄位換上評分最高的裝備 */
  autoEquipParty() {
    let n = 0;
    for (const cls of this.state.party) {
      for (const slot of DATA.slotOrder) {
        const cands = this.state.inventory.filter(i => i.slot === slot);
        if (!cands.length) continue;
        cands.sort((a, b) => this.itemScore(b) - this.itemScore(a));
        const cur = this.state.heroes[cls].equip[slot];
        if (!cur || this.itemScore(cands[0]) > this.itemScore(cur)) {
          if (this.equip(cands[0].id, cls)) n++;
        }
      }
    }
    return n;
  },

  unequip(cls, slot) {
    const st = this.state;
    const h = st.heroes[cls];
    const item = h && h.equip[slot];
    if (!item) return false;
    if (st.inventory.length >= INV_CAP) return false;
    delete h.equip[slot];
    st.inventory.push(item);
    this.dirty();
    return true;
  },

  dustFor(item) {
    const eco = this.economy();
    return Math.ceil((2 + item.lv * 0.25) * Math.pow(1.8, item.q) * (1 + eco.dustP / 100));
  },

  salvage(id) {
    const st = this.state;
    const item = this.findItem(id);
    if (!item) return 0;
    const d = this.dustFor(item);
    st.dust += d;
    st.stats.itemsSalvaged++;
    st.inventory = st.inventory.filter(i => i.id !== id);
    return d;
  },

  salvageBelow(q, lv = 0) {
    const st = this.state;
    let n = 0, d = 0;
    for (const item of [...st.inventory]) {
      if (item.q < q || (lv > 0 && item.lv < lv)) { d += this.salvage(item.id); n++; }
    }
    return { n, d };
  },

  /* ============ 鍛造 ============ */
  forgeDiscount() { return 1 - this.talentVal('smith') / 100; },

  upgradeCost(item) {
    const disc = this.forgeDiscount();
    const dust = Math.ceil((12 + item.lv * 0.8) * Math.pow(2.0, item.q) * disc);
    return { dust, gold: dust * 6 };
  },

  canUpgrade(item) {
    if (item.q >= 11) return false;
    const c = this.upgradeCost(item);
    return this.state.dust >= c.dust && this.state.gold >= c.gold;
  },

  upgrade(item) {
    if (item.q >= 11 || !this.canUpgrade(item)) return false;
    const c = this.upgradeCost(item);
    this.state.dust -= c.dust;
    this.state.gold -= c.gold;
    item.q++;
    /* 品質提升可能長出新詞綴 */
    const want = DATA.affixCount[item.q];
    if (item.aff.length < want) {
      const used = item.aff.map(a => a[0]);
      const avail = DATA.affixKeys.filter(k => !used.includes(k));
      if (avail.length) {
        const k = avail[Math.floor(Math.random() * avail.length)];
        const a = DATA.affixes[k];
        const v = Math.round((a.min + Math.random() * (a.max - a.min)) * (1 + item.q * 0.12) * 10) / 10;
        item.aff.push([k, v]);
      }
    }
    if (item.q > this.state.stats.bestQuality) this.state.stats.bestQuality = item.q;
    this.dirty();
    return true;
  },

  rerollCost(item) {
    return Math.ceil((6 + item.lv * 0.4) * Math.pow(1.7, item.q) * this.forgeDiscount());
  },

  reroll(item) {
    const cost = this.rerollCost(item);
    if (this.state.dust < cost) return false;
    this.state.dust -= cost;
    const n = Math.max(item.aff.length, DATA.affixCount[item.q]);
    const keys = [...DATA.affixKeys];
    item.aff = [];
    for (let i = 0; i < n && keys.length; i++) {
      const ki = Math.floor(Math.random() * keys.length);
      const k = keys.splice(ki, 1)[0];
      const a = DATA.affixes[k];
      const v = Math.round((a.min + Math.random() * (a.max - a.min)) * (1 + item.q * 0.12) * 10) / 10;
      item.aff.push([k, v]);
    }
    this.dirty();
    return true;
  },

  socketCost(item) {
    return Math.ceil((40 + item.lv * 2) * Math.pow(3, item.sockets) * this.forgeDiscount());
  },

  addSocket(item) {
    if (item.sockets >= 3) return false;
    const cost = this.socketCost(item);
    if (this.state.dust < cost) return false;
    this.state.dust -= cost;
    item.sockets++;
    this.dirty();
    return true;
  },

  /* ============ 星核 ============ */
  fuseCore(type, tier) {
    const st = this.state;
    if (tier >= 4) return false;
    const key = `${type}_${tier}`;
    if ((st.cores[key] || 0) < 3) return false;
    st.cores[key] -= 3;
    if (st.cores[key] === 0) delete st.cores[key];
    const up = `${type}_${tier + 1}`;
    st.cores[up] = (st.cores[up] || 0) + 1;
    st.stats.coresFused++;
    this.dirty();
    return true;
  },

  socketCore(item, type, tier) {
    const st = this.state;
    const key = `${type}_${tier}`;
    if ((st.cores[key] || 0) < 1) return false;
    if (item.gems.length >= item.sockets) return false;
    st.cores[key]--;
    if (st.cores[key] === 0) delete st.cores[key];
    item.gems.push(key);
    this.dirty();
    return true;
  },

  unsocketCost(tier) { return Math.ceil(50 * Math.pow(2, tier) * this.forgeDiscount()); },

  unsocketCore(item, gi) {
    const st = this.state;
    const key = item.gems[gi];
    if (!key) return false;
    const tier = +key.split('_')[1];
    const cost = this.unsocketCost(tier);
    if (st.dust < cost) return false;
    st.dust -= cost;
    item.gems.splice(gi, 1);
    st.cores[key] = (st.cores[key] || 0) + 1;
    this.dirty();
    return true;
  },

  /* ============ 英雄解鎖 / 隊伍 ============ */
  canUnlock(cls) {
    const c = DATA.classes[cls];
    return !this.state.heroes[cls] &&
      this.state.maxFloorEver >= c.unlock.floor &&
      this.state.gold >= c.unlock.cost;
  },

  unlockHero(cls) {
    if (!this.canUnlock(cls)) return false;
    this.state.gold -= DATA.classes[cls].unlock.cost;
    this.state.heroes[cls] = { equip: {} }; /* 直接享有全隊等級 */
    this.emit({ k: 'unlock', cls });
    this.dirty();
    return true;
  },

  toggleParty(cls) {
    const p = this.state.party;
    const i = p.indexOf(cls);
    if (i >= 0) {
      if (p.length <= 1) return false;
      p.splice(i, 1);
    } else {
      if (p.length >= 3 || !this.state.heroes[cls]) return false;
      p.push(cls);
    }
    this.dirty();
    this.rebuildHeroes();
    return true;
  },

  /* ============ 昇華 ============ */
  emberGain() {
    const m = this.state.runMaxFloor;
    if (m < 40) return 0;
    const cycle = this.cycleOf(m);
    return Math.floor(Math.pow((m - 30) / 10, 1.6) * 2 * (1 + cycle * 0.5));
  },

  ascend() {
    const gain = this.emberGain();
    if (gain <= 0) return false;
    const st = this.state;
    st.ember += gain;
    st.stats.prestiges++;
    st.teamLv = 1;
    st.teamXp = 0;
    st.gold = 0;
    st.floor = this.startFloor();
    st.runMaxFloor = st.floor;
    st.failStreak = 0;
    this.dirty();
    this.initBattle();
    this.checkAch();
    this.save();
    this.emit({ k: 'ascend', gain });
    return true;
  },

  talentCost(id) {
    const t = DATA.talents.find(t => t.id === id);
    return t ? t.cost * (this.talentRank(id) + 1) : Infinity;
  },

  buyTalent(id) {
    const t = DATA.talents.find(t => t.id === id);
    if (!t) return false;
    const rank = this.talentRank(id);
    const cost = this.talentCost(id);
    if (rank >= t.max || this.state.ember < cost) return false;
    this.state.ember -= cost;
    this.state.talents[id] = rank + 1;
    this.dirty();
    return true;
  },

  /* ============ 成就 ============ */
  checkAch() {
    const st = this.state;
    for (const a of DATA.achievements) {
      if (st.achievements[a.id]) continue;
      if ((st.stats[a.key] || 0) >= a.n) {
        st.achievements[a.id] = true;
        this.dirty();
        this.emit({ k: 'ach', a });
      }
    }
  },

  /* ============ 離線收益 ============ */
  offline(elapsed) {
    const st = this.state;
    if (elapsed < 120) return null;
    const capH = 8 + this.talentVal('hourglass');
    const t = Math.min(elapsed, capH * 3600);
    const kps = Math.min(Math.max(st.kps, 0.02), 8);
    const kills = Math.floor(kps * t * 0.8); /* 離線效率 80% */
    if (kills <= 0) return null;
    const eco = this.economy();
    const f = st.floor;
    const gold = Math.ceil(this.killGold(f) * kills * (1 + eco.goldP / 100));
    const xpTotal = this.killXp(f) * kills * (1 + eco.xpP / 100);
    st.gold += gold;
    st.stats.goldEarned += gold;
    st.stats.kills += kills;
    this.gainXp(xpTotal);
    const dustBefore = st.dust;
    const invBefore = st.inventory.length;
    const expect = kills * this.dropChance();
    const nItems = Math.min(30, Math.floor(expect) + (Math.random() < expect % 1 ? 1 : 0));
    for (let i = 0; i < nItems; i++) this.addItem(this.rollItem(f, false));
    this.checkAch();
    this.save();
    return {
      seconds: t, kills, gold,
      items: nItems,
      kept: st.inventory.length - invBefore,
      dust: st.dust - dustBefore,
      capped: elapsed > t,
    };
  },
};
