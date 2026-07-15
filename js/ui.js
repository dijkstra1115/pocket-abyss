/* 口袋深淵 — 介面層 */
'use strict';

/* 特效色階（由新到舊） */
const FX_FIRE = ['#fff7c0', '#ffd94d', '#ff9a4a', '#ff5a2b', '#8f2f14'];
const FX_SPARK = ['#ffffff', '#ffd94d', '#ff9a4a'];
const FX_BLOOD = ['#ff9a9a', '#ff5a5a', '#8f2222'];
const FX_HEAL = ['#eafff0', '#7dff9a', '#3dbf6a'];
const FX_SMOKE = ['#9a9aa8', '#5f5f6e', '#33333d'];

const UI = {
  tab: 'party',
  bagFilter: 'all',
  forgeSel: null,          /* {loc:'inv',id} 或 {loc:'equip',cls,slot} */
  dmgTexts: [],
  heroFx: [],              /* {lunge, flash, flashC} */
  mobFx: [],               /* {lunge, flash, kb} */
  parts: [],               /* 粒子與投射物 */
  shakeT: 0,
  shakeAmp: 0,
  ctx: null,
  _toastN: 0,
  _invFullT: 0,

  /* ============ 打擊感特效 ============ */
  shake(amp, t) {
    if (this.calm) return;
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = Math.max(this.shakeT, t);
  },

  /* 火花／碎片：向四周飛散、受重力下墜 */
  sparks(x, y, n, ramp, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({
        kind: 'px', x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3,
        g: 90, life: 0.25 + Math.random() * 0.3, t: 0, ramp,
      });
    }
  },

  /* 上升粒子（治療光、餘燼） */
  rise(x, y, n, ramp) {
    for (let i = 0; i < n; i++) {
      this.parts.push({
        kind: 'px', x: x + (Math.random() * 10 - 5), y: y + Math.random() * 6,
        vx: Math.random() * 4 - 2, vy: -(8 + Math.random() * 10),
        g: 0, life: 0.4 + Math.random() * 0.35, t: 0, ramp,
      });
    }
  },

  /* 環形光（護盾） */
  ring(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.parts.push({
        kind: 'px', x: x + Math.cos(a) * 7, y: y + Math.sin(a) * 6,
        vx: Math.cos(a) * 6, vy: Math.sin(a) * 5,
        g: 0, life: 0.3, t: 0, ramp: [color, color, '#2c4a55'],
      });
    }
  },

  /* 斬擊弧光 */
  slash(x, y) {
    const arc = [[-5, -6], [-1, -8], [3, -7], [6, -4], [7, 0], [6, 4]];
    arc.forEach(([dx, dy], i) => this.parts.push({
      kind: 'px', x: x + dx, y: y + dy, vx: 14, vy: 0,
      g: 0, life: 0.13, t: -i * 0.015, ramp: ['#ffffff', '#d7deee'],
    }));
  },

  /* 投射物：箭矢／隕石，可帶火尾與著彈爆炸 */
  proj(x0, y0, x1, y1, dur, color, opts) {
    opts = opts || {};
    this.parts.push({
      kind: 'proj', x0, y0, x1, y1, dur, color,
      t: -(opts.delay || 0), trail: opts.trail, boom: opts.boom, size: opts.size || 2,
    });
  },

  mobCenter(i) {
    const b = Game.battle;
    const boss = b.mobs[i] && b.mobs[i].boss;
    const p = this.mobPos(i);
    return { x: p.x + (boss ? 10 : 5), y: p.y + (boss ? 8 : 5) };
  },
  heroCenter(i) {
    const p = this.heroPos(i);
    return { x: p.x + 5, y: p.y + 6 };
  },

  /* ============ 初始化 ============ */
  init() {
    this.ctx = document.getElementById('scene').getContext('2d');
    document.querySelectorAll('#tabs button').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b === btn));
        this.tab = btn.dataset.tab;
        this.renderPanel();
      };
    });
    document.getElementById('adv-btn').onclick = () => {
      Game.state.settings.autoAdvance = !Game.state.settings.autoAdvance;
      this.renderTop();
    };
    document.getElementById('mini-btn').onclick = () => this.toggleMini();
    document.getElementById('modal-root').onclick = (e) => {
      if (e.target.id === 'modal-root') this.closeModal();
    };
    if (Game.state.settings.mini) document.body.classList.add('mini');
    this.applyScale();
    if (Game.state.settings.roomCode) this.loadRoom();
    this.renderTop();
    this.renderPanel();
  },

  toggleMini() {
    const s = Game.state.settings;
    s.mini = !s.mini;
    document.body.classList.toggle('mini', s.mini);
    this.applyScale();
  },

  /* 介面縮放：內容用 zoom 縮放，視窗跟著自動改大小 */
  applyScale() {
    const s = Game.state.settings;
    const z = s.uiScale || 1;
    document.body.style.zoom = z;
    const w = Math.round(420 * z) + 16;                    /* 視窗邊框 */
    const h = s.mini ? Math.round(260 * z) + 40 : Math.round(700 * z) + 40; /* 標題列 */
    try { window.resizeTo(w, h); } catch (e) { /* 非 app 視窗會被拒 */ }
  },

  /* ============ 提示 ============ */
  toast(html) {
    const box = document.getElementById('toasts');
    if (box.children.length > 5) box.removeChild(box.firstChild);
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = html;
    box.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  },

  qname(q) { return `<span style="color:${DATA.qualities[q].color}">${DATA.qualities[q].name}</span>`; },

  /* ============ 事件佇列 → 動畫與提示 ============ */
  drain() {
    for (const e of Game.events) {
      /* 共鬥播放中：主遊戲照跑，但其視覺特效不疊到共鬥畫面上（提示照發） */
      if (this.raid && ['hit', 'kill', 'heal', 'shieldUp', 'atk', 'skill'].includes(e.k)) continue;
      switch (e.k) {
        case 'hit': {
          const fx = e.side === 'mob' ? this.mobFx : this.heroFx;
          if (fx[e.i] && !this.calm) {
            fx[e.i].flash = 0.12;
            fx[e.i].flashC = e.side === 'mob' ? '#ffffff' : '#ff8080';
            if (e.side === 'mob') fx[e.i].kb = 0.12;
          }
          let numColor = '#ff7a7a';
          if (e.side === 'mob') {
            const cc = DATA.classes[e.by];
            numColor = cc ? cc.color : '#ffffff';
            const c = this.mobCenter(e.i);
            this.sparks(c.x, c.y, e.crit ? 10 : 4,
              e.by === 'mage' ? FX_FIRE : FX_SPARK, e.crit ? 42 : 26);
            if (e.crit) this.shake(1, 0.1);
            /* 普攻的攻擊者演出（技能有自己的特效） */
            if (!e.sk && cc) {
              const hi = Game.battle.heroes.findIndex(h => h.cls === e.by);
              const hc = this.heroCenter(Math.max(0, hi));
              if (e.by === 'ranger') this.proj(hc.x + 5, hc.y - 1, c.x, c.y, 0.09, '#e8e0c0', { size: 3 });
              else if (e.by === 'mage') this.proj(hc.x + 5, hc.y - 3, c.x, c.y, 0.16, '#ffd94d', { trail: true });
              else if (e.by === 'cleric') this.proj(hc.x + 5, hc.y - 2, c.x, c.y, 0.14, '#ffe08a');
              else this.slash(c.x, c.y);
            }
          } else {
            const c = this.heroCenter(e.i);
            this.sparks(c.x, c.y, 4, FX_BLOOD, 22);
          }
          const pos = e.side === 'mob' ? this.mobPos(e.i) : this.heroPos(e.i);
          this.dmgTexts.push({
            x: pos.x + 4, y: pos.y - 4, t: 0.9,
            str: Game.fmt(Math.max(1, e.amt)),
            color: numColor,
            scale: e.crit ? 2 : 1,
          });
          break;
        }
        case 'kill': {
          const c = this.mobCenter(e.i);
          this.sparks(c.x, c.y, e.boss ? 26 : 10, [e.c1, e.c1, e.c2, '#2b2b30'], e.boss ? 55 : 32);
          this.rise(c.x, c.y - 2, e.boss ? 8 : 3, FX_SMOKE);
          if (e.boss) { this.sparks(c.x, c.y, 16, FX_FIRE, 40); this.shake(3, 0.35); }
          break;
        }
        case 'heal': {
          const pos = this.heroPos(e.i);
          const c = this.heroCenter(e.i);
          this.rise(c.x, c.y, 6, FX_HEAL);
          this.dmgTexts.push({ x: pos.x + 2, y: pos.y - 4, t: 0.9, str: '+' + Game.fmt(e.amt), color: '#7dff9a' });
          break;
        }
        case 'shieldUp':
          for (let i = 0; i < Game.battle.heroes.length; i++) {
            if (Game.battle.heroes[i].hp > 0) {
              const c = this.heroCenter(i);
              this.ring(c.x, c.y, '#57e6e6');
            }
          }
          break;
        case 'atk': {
          const fx = (e.side === 'hero' ? this.heroFx : this.mobFx)[e.i];
          if (fx) fx.lunge = 0.15;
          break;
        }
        case 'skill': {
          if (this.heroFx[e.i]) this.heroFx[e.i].lunge = 0.28;
          const b = Game.battle;
          const hc = this.heroCenter(e.i);
          /* 施法者亮起職業色光環 */
          const sc = DATA.classes[e.cls];
          if (sc) this.ring(hc.x, hc.y, sc.color);
          if (e.cls === 'mage') {
            /* 隕星術：對每隻怪砸下帶火尾的隕石 */
            for (let m = 0; m < Math.max(1, b.mobs.length); m++) {
              const c = this.mobCenter(m);
              this.proj(c.x + (Math.random() * 14 - 7), -8, c.x, c.y, 0.22, '#ffd94d',
                { delay: m * 0.09, trail: true, boom: true });
            }
          } else if (e.cls === 'blade') {
            for (let m = 0; m < b.mobs.length; m++) {
              const c = this.mobCenter(m);
              this.slash(c.x, c.y);
            }
          } else if (e.cls === 'ranger') {
            for (let n = 0; n < 3; n++) {
              const c = this.mobCenter(b.mobs.length ? Math.floor(Math.random() * b.mobs.length) : 0);
              this.proj(hc.x + 5, hc.y - 1, c.x, c.y, 0.1, '#e8e0c0', { delay: n * 0.07, size: 3 });
            }
          } else if (e.cls === 'rogue' && b.mobs.length) {
            const c = this.mobCenter(0);
            this.proj(hc.x, hc.y, c.x, c.y, 0.08, '#8899aa');
            this.slash(c.x, c.y);
          }
          break;
        }
        case 'loot':
          this.toast(`拾獲 ${this.qname(e.item.q)} <span style="color:${DATA.qualities[e.item.q].color}">${Game.baseOf(e.item).name}</span> Lv${e.item.lv}`);
          break;
        case 'core': {
          const ct = DATA.coreTypes[e.type];
          this.toast(`掉落 <span style="color:${ct.color}">${DATA.coreTiers[e.tier].name}·${ct.name}</span>！`);
          break;
        }
        case 'ach':
          this.toast(`🏆 成就達成：<b>${e.a.name}</b>`);
          break;
        case 'lvl':
          this.toast(`隊伍升到 ${e.lv} 級！`);
          break;
        case 'zone':
          this.toast(`進入新區域：<b>${e.name}</b>`);
          break;
        case 'bossKill':
          this.toast(`擊敗 Boss：<b>${e.name}</b>！`);
          break;
        case 'retreat':
          this.toast(`小隊受挫，退回第 ${e.floor} 層休整…`);
          break;
        case 'unlock':
          this.toast(`新英雄加入：<b>${DATA.classes[e.cls].name}</b>！`);
          break;
        case 'ascend':
          this.toast(`✦ 昇華完成，獲得 ${e.gain} 餘燼`);
          break;
        case 'invFull':
          if (Date.now() - this._invFullT > 15000) {
            this._invFullT = Date.now();
            this.toast('背包已滿，新掉落自動分解為星塵');
          }
          break;
      }
    }
    Game.events.length = 0;
  },

  /* ============ 戰鬥畫布 ============ */
  heroPos(i) { return { x: 8 + i * 19, y: 54 - 12 }; },
  mobPos(i) {
    const b = Game.battle;
    if (b.mobs[i] && b.mobs[i].boss) return { x: 96, y: 54 - 20 };
    return { x: 78 + i * 19, y: 54 - 10 };
  },

  renderScene(dt, t) {
    if (this.raid) return this.renderRaidScene(dt, t);
    const ctx = this.ctx, b = Game.battle, st = Game.state;
    if (!ctx || !b) return;
    const zone = Game.zoneOf(st.floor);

    /* 螢幕震動 */
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      sx = Math.round((Math.random() * 2 - 1) * this.shakeAmp);
      sy = Math.round((Math.random() * 2 - 1) * this.shakeAmp * 0.6);
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
    ctx.save();
    ctx.translate(sx, sy);

    /* 背景（多畫一圈避免震動露出黑邊） */
    ctx.fillStyle = zone.sky;
    ctx.fillRect(-4, -4, 143, 68);
    ctx.fillStyle = zone.ground;
    ctx.fillRect(-4, 54, 143, 10);
    /* 裝飾像素（以樓層為種子，固定不閃爍） */
    ctx.fillStyle = zone.deco;
    for (let i = 0; i < 10; i++) {
      const px = (st.floor * 37 + i * 53) % 135;
      const py = (st.floor * 17 + i * 29) % 48;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(px, py, 1, 1);
      ctx.globalAlpha = 1;
      ctx.fillRect((px * 7 + 13) % 135, 53, 1, 1);
    }

    /* 同步 FX 陣列長度 */
    while (this.heroFx.length < b.heroes.length) this.heroFx.push({ lunge: 0, flash: 0 });
    this.heroFx.length = b.heroes.length;
    while (this.mobFx.length < b.mobs.length) this.mobFx.push({ lunge: 0, flash: 0 });
    this.mobFx.length = b.mobs.length;

    /* 英雄 */
    for (let i = 0; i < b.heroes.length; i++) {
      const bh = b.heroes[i];
      const c = DATA.classes[bh.cls];
      const map = HERO_SPRITES[c.sprite];
      const fx = this.heroFx[i];
      fx.lunge = Math.max(0, fx.lunge - dt);
      fx.flash = Math.max(0, fx.flash - dt);
      const pos = this.heroPos(i);
      const bob = bh.hp > 0 ? Math.round(Math.sin(t * 2.5 + i * 1.7)) : 0;
      const lx = Math.round(fx.lunge * 24);
      /* 腳下職業色條 = 技能充能，滿格閃白後自動施放 */
      const effCd = c.skill.cd / (1 + Game.heroStats(bh.cls).haste / 100);
      const fill = Math.max(0, Math.min(1, 1 - bh.skillT / effCd));
      ctx.fillStyle = '#26202f';
      ctx.fillRect(pos.x, 55, 10, 1);
      ctx.fillStyle = (fill >= 0.98 && Math.floor(t * 8) % 2 === 0) ? '#ffffff' : c.color;
      ctx.fillRect(pos.x, 55, Math.max(1, Math.round(10 * fill)), 1);
      if (bh.hp <= 0) {
        ctx.globalAlpha = 0.35;
        Sprites.drawSilhouette(ctx, map, '#555566', pos.x, pos.y + 3, false, 1);
        ctx.globalAlpha = 1;
        continue;
      }
      if (fx.flash > 0) Sprites.drawSilhouette(ctx, map, fx.flashC || '#ffffff', pos.x + lx, pos.y + bob, false, 1);
      else Sprites.draw(ctx, map, c.pal, pos.x + lx, pos.y + bob, false, 1);
      /* 血條與護盾 */
      ctx.fillStyle = '#33121a';
      ctx.fillRect(pos.x, pos.y - 3, 10, 1);
      ctx.fillStyle = '#5fd35f';
      ctx.fillRect(pos.x, pos.y - 3, Math.max(0, Math.round(10 * bh.hp / bh.max)), 1);
      if (bh.shield > 0) {
        ctx.fillStyle = '#57e6e6';
        ctx.fillRect(pos.x, pos.y - 5, Math.min(10, Math.max(1, Math.round(10 * bh.shield / bh.max))), 1);
      }
    }

    /* 怪物 */
    for (let i = 0; i < b.mobs.length; i++) {
      const m = b.mobs[i];
      const map = MOB_SPRITES[m.def.arch];
      const fx = this.mobFx[i];
      fx.lunge = Math.max(0, fx.lunge - dt);
      fx.flash = Math.max(0, fx.flash - dt);
      fx.kb = Math.max(0, (fx.kb || 0) - dt);
      const scale = m.boss ? 2 : 1;
      const pos = this.mobPos(i);
      const bob = Math.round(Math.sin(t * 2 + i * 2.4));
      const lx = -Math.round(fx.lunge * 24) + Math.round(fx.kb * 20);
      const y = pos.y - (map.length * scale - (m.boss ? 20 : 10));
      if (fx.flash > 0) Sprites.drawSilhouette(ctx, map, '#ffffff', pos.x + lx, y + bob, true, scale);
      else Sprites.draw(ctx, map, m.def.pal, pos.x + lx, y + bob, true, scale);
      const bw = 10 * scale;
      ctx.fillStyle = '#33121a';
      ctx.fillRect(pos.x, y - 3, bw, 1);
      ctx.fillStyle = m.boss ? '#ff5a5a' : '#e0a03d';
      ctx.fillRect(pos.x, y - 3, Math.max(0, Math.round(bw * m.hp / m.max)), 1);
    }

    this.drawParticles(ctx, dt);

    /* 休整倒數 */
    if (b.pauseT > 0.7) {
      Sprites.text(ctx, '...', 64, 20, '#8a80a0');
    }

    this.drawDmgTexts(ctx, dt);

    ctx.restore();
  },

  drawParticles(ctx, dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t < 0) continue;
      if (p.kind === 'proj') {
        const k = Math.min(1, p.t / p.dur);
        const px = p.x0 + (p.x1 - p.x0) * k;
        const py = p.y0 + (p.y1 - p.y0) * k;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(px), Math.round(py), p.size, 1);
        if (p.trail && Math.random() < 0.8) {
          this.parts.push({
            kind: 'px', x: px, y: py, vx: Math.random() * 8 - 4, vy: -6 * Math.random(),
            g: 0, life: 0.22, t: 0, ramp: FX_FIRE,
          });
        }
        if (k >= 1) {
          this.parts.splice(i, 1);
          if (p.boom) { this.sparks(p.x1, p.y1, 12, FX_FIRE, 36); this.shake(1.5, 0.12); }
        }
        continue;
      }
      if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const ci = Math.min(p.ramp.length - 1, Math.floor(p.t / p.life * p.ramp.length));
      ctx.fillStyle = p.ramp[ci];
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    if (this.parts.length > 180) this.parts.splice(0, this.parts.length - 180);
  },

  drawDmgTexts(ctx, dt) {
    for (let i = this.dmgTexts.length - 1; i >= 0; i--) {
      const d = this.dmgTexts[i];
      d.t -= dt;
      d.y -= dt * 9;
      if (d.t <= 0) { this.dmgTexts.splice(i, 1); continue; }
      const sc = d.scale || 1;
      const w = Sprites.textWidth(d.str, sc);
      Sprites.text(ctx, d.str, Math.min(134 - w, Math.max(1, Math.round(d.x - w / 2))), Math.round(d.y), d.color, sc);
    }
    if (this.dmgTexts.length > 14) this.dmgTexts.splice(0, this.dmgTexts.length - 14);
  },

  /* ============ 共鬥（Prompt 3：六人同框） ============ */
  raid: null,   /* {full, st, myTeam, speed, acc, reportCode, fx:[], doneNotified} */

  startRaid(full, myTeam, reportCode, cloud) {
    this.raid = {
      full, st: full.mode === 'exp' ? Raid.expInit(full) : Raid.init(full), myTeam,
      speed: 1, acc: 0, reportCode: reportCode || null,
      cloud: cloud || null, posted: false,
      fx: full.teams.flatMap(t => t.h.map(() => ({ lunge: 0, flash: 0 }))),
      mobFxR: [], bossFlash: 0, doneNotified: false,
    };
    this.dmgTexts.length = 0;
    this.parts.length = 0;
    this.renderPanel();
  },

  /* 雲端出戰結束：把成果回寫房間 */
  postRaidResult(R) {
    if (!R.cloud || R.posted) return;
    R.posted = true;
    const name = Game.state.settings.playerName;
    if (R.st.mode === 'exp') {
      const from = R.full.from;
      const to = from + R.st.cleared;
      if (to > from) {
        /* 遠征獎勵（只發自己這輪實際推進的樓層） */
        let gold = 0, dust = 0, xp = 0;
        for (let f = from; f < to; f++) {
          gold += Math.ceil(Game.killGold(f)) * 12;
          dust += 5 + f;
          xp += Game.killXp(f) * 8;
        }
        Game.state.gold += gold;
        Game.state.stats.goldEarned += gold;
        Game.state.dust += dust;
        Game.gainXp(xp);
        this.toast(`遠征獎勵：金幣 ${Game.fmt(gold)}、星塵 ${Game.fmt(dust)}`);
      }
      Raid.postExp(R.cloud.code, name, from, to, R.cloud.seed)
        .then(room => {
          this.roomData = room;
          if (to > from) this.toast(`共享深度推進到第 ${room.exp.floor} 層！`);
          if (this.raid === R) this.renderPanel();
        })
        .catch(() => this.toast('進度回報失敗，請稍後在房間按「重新整理」'));
      return;
    }
    let myDmg = 0;
    for (const h of R.st.heroes) if (h.team === R.myTeam) myDmg += h.dmg;
    Raid.postDamage(R.cloud.code, name, myDmg, R.cloud.seed)
      .then(room => {
        this.roomData = room;
        this.toast(`已回報傷害 ${Game.fmt(myDmg / 10)}`);
        if (this.raid === R) this.renderPanel();
      })
      .catch(() => this.toast('傷害回報失敗，請稍後在房間按「重新整理」'));
  },

  endRaid() {
    this.raid = null;
    this.dmgTexts.length = 0;
    this.parts.length = 0;
    this.renderPanel();
  },

  raidHeroPos(h) {
    const mine = h.team === this.raid.myTeam;
    return mine
      ? { x: 4 + h.idx * 19, y: 54 - 12 }    /* 我方前排 */
      : { x: 13 + h.idx * 19, y: 47 - 12 };  /* 隊友後排（略高、錯位） */
  },

  raidMobPos(i, boss) {
    return boss ? { x: 100, y: 54 - 16 } : { x: 78 + i * 19, y: 54 - 10 };
  },

  raidEvent(e) {
    const R = this.raid, sim = R.st;
    const isExp = sim.mode === 'exp';
    const bossC = { x: 112, y: 42 };
    if (e.k === 'hit') {
      const h = sim.heroes[e.h];
      const mine = h.team === R.myTeam;
      const cc = DATA.classes[h.c];
      if (R.fx[e.h]) R.fx[e.h].lunge = 0.15;
      let tx, ty;
      if (isExp) {
        const mob = sim.mobs[e.m];
        const pos = this.raidMobPos(e.m, mob && mob.boss);
        tx = pos.x + 5; ty = pos.y + 5;
        if (R.mobFxR[e.m]) R.mobFxR[e.m].flash = 0.1;
      } else {
        tx = bossC.x + (e.h % 3) * 3 - 3; ty = bossC.y - (e.h % 2) * 5;
        R.bossFlash = 0.08;
      }
      this.sparks(tx, ty, e.crit ? 8 : 3, h.c === 'mage' ? FX_FIRE : FX_SPARK, e.crit ? 40 : 24);
      this.dmgTexts.push({
        x: isExp ? tx : 100 + (e.h % 3) * 8,
        y: isExp ? ty - 10 : 26 - Math.floor(e.h / 2) * 5,
        t: 0.8,
        str: Game.fmt(Math.max(1, e.amt / 10)),
        color: mine ? cc.color : '#c9c9d8',
        scale: e.crit ? 2 : 1,
      });
      if (e.crit) this.shake(1, 0.08);
    } else if (e.k === 'kill') {
      const pos = this.raidMobPos(e.m, e.boss);
      this.sparks(pos.x + 5, pos.y + 5, e.boss ? 22 : 10, [e.c1, e.c1, e.c2, '#2b2b30'], e.boss ? 50 : 32);
      this.rise(pos.x + 5, pos.y + 3, 3, FX_SMOKE);
      if (e.boss) this.shake(2.5, 0.3);
    } else if (e.k === 'matk') {
      if (R.mobFxR[e.i]) R.mobFxR[e.i].lunge = 0.15;
    } else if (e.k === 'floor') {
      this.dmgTexts.push({ x: 67, y: 18, t: 1.1, str: 'F' + e.f, color: '#ffd94d', scale: 2 });
      this.rise(67, 30, 8, FX_HEAL);
    } else if (e.k === 'bhit') {
      const pos = this.raidHeroPos(sim.heroes[e.t]);
      if (R.fx[e.t]) { R.fx[e.t].flash = 0.12; }
      this.sparks(pos.x + 5, pos.y + 6, 4, FX_BLOOD, 22);
      this.dmgTexts.push({
        x: pos.x + 5, y: pos.y - 4, t: 0.8,
        str: Game.fmt(Math.max(1, e.amt / 10)), color: '#ff7a7a',
      });
    } else if (e.k === 'heal') {
      const pos = this.raidHeroPos(sim.heroes[e.t]);
      this.rise(pos.x + 5, pos.y + 6, 3, FX_HEAL);
    } else if (e.k === 'skill') {
      const h = sim.heroes[e.h];
      const pos = this.raidHeroPos(h);
      if (R.fx[e.h]) R.fx[e.h].lunge = 0.28;
      this.ring(pos.x + 5, pos.y + 6, DATA.classes[h.c].color);
    } else if (e.k === 'down') {
      const pos = this.raidHeroPos(sim.heroes[e.t]);
      this.sparks(pos.x + 5, pos.y + 6, 8, FX_SMOKE, 26);
    }
  },

  renderRaidScene(dt, t) {
    const ctx = this.ctx, R = this.raid;
    if (!ctx || !R) return;
    const sim = R.st;

    /* 固定步長推進（渲染只是播放，不影響邏輯結果） */
    if (!sim.done) {
      R.acc += dt * R.speed;
      const step = 1 / RAID_TPS;
      let guard = 0;
      while (R.acc >= step && guard++ < 60) {
        R.acc -= step;
        Raid.step(sim);
        for (const e of sim.events) this.raidEvent(e);
        sim.events.length = 0;
        if (sim.done) break;
      }
      if (sim.done && !R.doneNotified) {
        R.doneNotified = true;
        this.postRaidResult(R);
        this.renderPanel();
      }
    }

    /* 震動與背景 */
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      sx = Math.round((Math.random() * 2 - 1) * this.shakeAmp);
      sy = Math.round((Math.random() * 2 - 1) * this.shakeAmp * 0.6);
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }
    ctx.save();
    ctx.translate(sx, sy);
    const isExp = sim.mode === 'exp';
    const zone = isExp
      ? DATA.zones[Math.floor(((sim.floor - 1) % 200) / 25)]
      : DATA.zones[R.full.boss.z];
    ctx.fillStyle = zone.sky;
    ctx.fillRect(-4, -4, 143, 68);
    ctx.fillStyle = zone.ground;
    ctx.fillRect(-4, 54, 143, 10);

    if (isExp) {
      /* 遠征：樓層標示 + 多隻怪物 */
      Sprites.text(ctx, 'F' + sim.floor, 4, 3, '#ffd94d');
      Sprites.text(ctx, '+' + sim.cleared, 4, 10, '#7dd87d');
      while (R.mobFxR.length < sim.mobs.length) R.mobFxR.push({ lunge: 0, flash: 0 });
      R.mobFxR.length = Math.max(R.mobFxR.length, sim.mobs.length);
      for (let i = 0; i < sim.mobs.length; i++) {
        const m = sim.mobs[i];
        const map = MOB_SPRITES[m.def.arch];
        const fx = R.mobFxR[i] || { lunge: 0, flash: 0 };
        fx.lunge = Math.max(0, fx.lunge - dt);
        fx.flash = Math.max(0, fx.flash - dt);
        const scale = m.boss ? 2 : 1;
        const pos = this.raidMobPos(i, m.boss);
        const bob = Math.round(Math.sin(t * 2 + i * 2.4));
        const lx = -Math.round(fx.lunge * 24);
        const y = 54 - map.length * scale;
        if (fx.flash > 0) Sprites.drawSilhouette(ctx, map, '#ffffff', pos.x + lx, y + bob, true, scale);
        else Sprites.draw(ctx, map, m.def.pal, pos.x + lx, y + bob, true, scale);
        const bw = 10 * scale;
        ctx.fillStyle = '#33121a';
        ctx.fillRect(pos.x, y - 3, bw, 1);
        ctx.fillStyle = m.boss ? '#ff5a5a' : '#e0a03d';
        ctx.fillRect(pos.x, y - 3, Math.max(0, Math.round(bw * m.hp / m.max)), 1);
      }
    } else {
      /* 共鬥王血條（頂部） */
      const pct = Math.max(0, sim.boss.hp) / R.full.boss.hp;
      ctx.fillStyle = '#33121a';
      ctx.fillRect(4, 3, 127, 2);
      ctx.fillStyle = pct > 0.3 ? '#ff5a5a' : '#ffd94d';
      ctx.fillRect(4, 3, Math.round(127 * pct), 2);
      Sprites.text(ctx, Math.round(pct * 100) + '.', 60, 7, '#d8d2e8');

      R.bossFlash = Math.max(0, R.bossFlash - dt);
      const bMap = MOB_SPRITES[zone.boss.arch];
      const bY = 54 - bMap.length * 2;
      const bBob = Math.round(Math.sin(t * 1.6));
      if (R.bossFlash > 0) Sprites.drawSilhouette(ctx, bMap, '#ffffff', 102, bY + bBob, true, 2);
      else Sprites.draw(ctx, bMap, zone.boss.pal, 102, bY + bBob, true, 2);
    }

    /* 六位英雄：先畫隊友後排、再畫我方前排 */
    const order = [...sim.heroes].sort((a, b) =>
      (a.team === R.myTeam ? 1 : 0) - (b.team === R.myTeam ? 1 : 0));
    for (const h of order) {
      const i = sim.heroes.indexOf(h);
      const fx = R.fx[i];
      fx.lunge = Math.max(0, fx.lunge - dt);
      fx.flash = Math.max(0, fx.flash - dt);
      const pos = this.raidHeroPos(h);
      const c = DATA.classes[h.c];
      const map = HERO_SPRITES[c.sprite];
      const mine = h.team === R.myTeam;
      /* 歸屬標記：我方=職業色條、隊友=灰色條 */
      ctx.fillStyle = mine ? c.color : '#8a8a9a';
      ctx.fillRect(pos.x + 2, pos.y + 13, 6, 1);
      if (h.hp <= 0) {
        ctx.globalAlpha = 0.35;
        Sprites.drawSilhouette(ctx, map, '#555566', pos.x, pos.y + 3, false, 1);
        ctx.globalAlpha = 1;
        continue;
      }
      const bob = Math.round(Math.sin(t * 2.5 + i * 1.3));
      const lx = Math.round(fx.lunge * 24);
      if (!mine) ctx.globalAlpha = 0.85;
      if (fx.flash > 0) Sprites.drawSilhouette(ctx, map, '#ff8080', pos.x + lx, pos.y + bob, false, 1);
      else Sprites.draw(ctx, map, c.pal, pos.x + lx, pos.y + bob, false, 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#33121a';
      ctx.fillRect(pos.x, pos.y - 3, 10, 1);
      ctx.fillStyle = mine ? '#5fd35f' : '#9ab8a0';
      ctx.fillRect(pos.x, pos.y - 3, Math.max(0, Math.round(10 * h.hp / h.s.hp)), 1);
      if (h.shield > 0) {
        ctx.fillStyle = '#57e6e6';
        ctx.fillRect(pos.x, pos.y - 5, Math.min(10, Math.max(1, Math.round(10 * h.shield / h.s.hp))), 1);
      }
    }

    this.drawParticles(ctx, dt);
    this.drawDmgTexts(ctx, dt);
    if (sim.done) {
      Sprites.text(ctx, sim.win ? '!!' : '--', 64, 16, sim.win ? '#ffd94d' : '#8a80a0', 2);
    }
    ctx.restore();
  },

  /* ============ 頂欄 / 狀態列 ============ */
  renderTop() {
    const st = Game.state, b = Game.battle;
    document.getElementById('zone-name').textContent = Game.zoneOf(st.floor).name;
    document.getElementById('floor-label').textContent = `第 ${st.floor} 層`;
    document.getElementById('diff-label').textContent = Game.diffName(st.floor);
    document.getElementById('res-gold').textContent = Game.fmt(st.gold);
    document.getElementById('res-dust').textContent = Game.fmt(st.dust);
    document.getElementById('res-ember').textContent = Game.fmt(st.ember);
    const advBtn = document.getElementById('adv-btn');
    advBtn.textContent = st.settings.autoAdvance ? '推進中' : '駐留中';
    advBtn.style.color = st.settings.autoAdvance ? '' : '#e0a03d';
    /* 波次點 */
    const pips = document.getElementById('wave-pips');
    const total = Game.wavesPerFloor(st.floor);
    let html = '';
    for (let i = 0; i < total; i++) {
      const cls = Game.isBossFloor(st.floor) ? 'boss' : (i < b.wave ? 'done' : '');
      html += `<i class="${cls}"></i>`;
    }
    pips.innerHTML = html;
  },

  /* ============ 面板 ============ */
  renderPanel() {
    const p = document.getElementById('panel');
    switch (this.tab) {
      case 'party': p.innerHTML = this.htmlParty(); this.bindParty(p); break;
      case 'bag': p.innerHTML = this.htmlBag(); this.bindBag(p); break;
      case 'forge': p.innerHTML = this.htmlForge(); this.bindForge(p); break;
      case 'core': p.innerHTML = this.htmlCore(); this.bindCore(p); break;
      case 'ascend': p.innerHTML = this.htmlAscend(); this.bindAscend(p); break;
      case 'raid': p.innerHTML = this.htmlRaid(); this.bindRaid(p); break;
      case 'achv': p.innerHTML = this.htmlAchv(); break;
      case 'set': p.innerHTML = this.htmlSet(); this.bindSet(p); break;
    }
  },

  refresh() {
    /* 週期刷新：避開含 <select>/輸入框 的分頁以免打斷操作 */
    if (!document.getElementById('modal-root').classList.contains('hidden')) return;
    if (['party', 'ascend', 'achv', 'core', 'forge'].includes(this.tab)) this.renderPanel();
    /* 共鬥戰鬥中：即時更新傷害統計（此狀態無輸入框） */
    if (this.tab === 'raid' && this.raid && !this.raid.st.done) this.renderPanel();
    /* 雲端房間：每 10 秒輪詢共享血池 */
    if (this.tab === 'raid' && !this.raid && Game.state.settings.roomCode) {
      this._pollN++;
      if (this._pollN % 5 === 0) this.loadRoom();
    }
  },

  /* ---------- 隊伍 ---------- */
  htmlParty() {
    const st = Game.state;
    const need = Game.xpNeed(st.teamLv);
    let html = `<div class="bag-tools"><span class="hint">上陣 ${st.party.length}/3 · 點裝備欄更換裝備</span>
      <button id="auto-eq" class="accent" style="margin-left:auto">一鍵配裝</button></div>
      <div class="raid-box" style="margin-bottom:6px">隊伍等級 <b>Lv${st.teamLv}</b>
        <span class="hint">全隊共享，換誰上場都同等級</span>
        <div class="xp-bar" style="margin-top:4px"><i style="width:${Math.min(100, 100 * st.teamXp / need)}%"></i></div>
      </div>`;
    for (const cls of DATA.classOrder) {
      const c = DATA.classes[cls];
      const h = st.heroes[cls];
      if (!h) {
        const can = Game.canUnlock(cls);
        const reach = st.maxFloorEver >= c.unlock.floor;
        html += `<div class="hero-card locked">
          <div class="hero-head">
            <canvas data-sprite="${cls}" width="20" height="24"></canvas>
            <div><div class="hero-name">${c.name}</div>
            <div class="hero-sub">${reach ? '' : `需抵達第 ${c.unlock.floor} 層 · `}費用 ${Game.fmt(c.unlock.cost)} 金幣</div></div>
            <div class="spacer"></div>
            <button data-unlock="${cls}" ${can ? '' : 'disabled'}>解鎖</button>
          </div>
          <div class="hero-sub">${c.skill.name}：${c.skill.desc}</div>
        </div>`;
        continue;
      }
      const s = Game.heroStats(cls);
      const inParty = st.party.includes(cls);
      html += `<div class="hero-card">
        <div class="hero-head">
          <canvas data-sprite="${cls}" width="20" height="24"></canvas>
          <div><div class="hero-name"><i class="ic" style="background:${c.color}"></i> ${c.name} <span class="hero-sub">Lv${st.teamLv}</span></div>
          <div class="hero-sub">${c.skill.name}：${c.skill.desc}</div></div>
          <div class="spacer"></div>
          <button data-party="${cls}" class="${inParty ? '' : 'accent'}">${inParty ? '下陣' : '上陣'}</button>
        </div>
        <div class="stat-grid">
          <span>攻擊 <b>${Game.fmt(s.atk)}</b></span>
          <span>生命 <b>${Game.fmt(s.hp)}</b></span>
          <span>防禦 <b>${Game.fmt(s.def)}</b></span>
          <span>攻速 <b>${s.aspd.toFixed(2)}</b></span>
          <span>暴擊 <b>${s.crit.toFixed(0)}%</b></span>
          <span>暴傷 <b>${s.critD.toFixed(0)}%</b></span>
        </div>
        <div class="equip-row">${DATA.slotOrder.map(slot => {
          const it = h.equip[slot];
          if (!it) return `<div class="eq-slot" data-eq="${cls}:${slot}"><span class="sl">${DATA.slots[slot]}</span><br>—</div>`;
          return `<div class="eq-slot" data-eq="${cls}:${slot}"><span class="sl">${DATA.slots[slot]} Lv${it.lv}</span><br>
            <span style="color:${DATA.qualities[it.q].color}">${Game.itemName(it)}</span></div>`;
        }).join('')}</div>
      </div>`;
    }
    return html;
  },

  bindParty(p) {
    p.querySelector('#auto-eq').onclick = () => {
      const n = Game.autoEquipParty();
      this.toast(n ? `一鍵配裝：更換了 ${n} 件裝備` : '沒有更好的裝備可換');
      this.renderPanel();
    };
    p.querySelectorAll('canvas[data-sprite]').forEach(cv => {
      const c = DATA.classes[cv.dataset.sprite];
      cv.getContext('2d').imageSmoothingEnabled = false;
      Sprites.draw(cv.getContext('2d'), HERO_SPRITES[c.sprite], c.pal, 0, 0, false, 2);
    });
    p.querySelectorAll('[data-unlock]').forEach(b => b.onclick = () => {
      if (Game.unlockHero(b.dataset.unlock)) this.renderPanel();
    });
    p.querySelectorAll('[data-party]').forEach(b => b.onclick = () => {
      Game.toggleParty(b.dataset.party);
      this.renderPanel();
    });
    p.querySelectorAll('[data-eq]').forEach(el => el.onclick = () => {
      const [cls, slot] = el.dataset.eq.split(':');
      /* 不論欄位是否已有裝備，一律開啟含比較的更換清單 */
      this.showEquipPicker(cls, slot);
    });
  },

  /* ---------- 物品共用 ---------- */
  itemChipHTML(it, attr) {
    const q = DATA.qualities[it.q];
    const bits = [`Lv${it.lv}`];
    if (it.aff.length) bits.push(`詞${it.aff.length}`);
    if (it.sockets) bits.push(`孔${it.gems.length}/${it.sockets}`);
    return `<div class="item-chip" ${attr}>
      <span class="inm" style="color:${q.color}">${q.name}${Game.baseOf(it).name}</span>
      <span class="ilv">${bits.join(' · ')}</span></div>`;
  },

  /* 選擇清單用：一列顯示主屬性，可與目前裝備比較（加綠減紅） */
  itemRowHTML(it, attr, cur, tag) {
    const q = DATA.qualities[it.q];
    const bs = Game.itemBaseStats(it);
    const cs = cur ? Game.itemBaseStats(cur) : null;
    const labels = { atk: '攻', hp: '命', def: '防' };
    const stat = ['atk', 'hp', 'def'].map(k => {
      if (!bs[k] && !(cs && cs[k])) return '';
      let dTxt = '';
      if (cs) {
        const d = Math.round(bs[k] - cs[k]);
        const cls = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
        dTxt = ` <i class="${cls}">(${d > 0 ? '+' : d < 0 ? '-' : '±'}${Game.fmt(Math.abs(d))})</i>`;
      }
      return `<span>${labels[k]} ${Game.fmt(bs[k])}${dTxt}</span>`;
    }).filter(Boolean).join('');
    const aff = it.aff.slice(0, 3).map(([k, v]) => `${DATA.affixes[k].name}+${v}%`).join(' ')
      + (it.aff.length > 3 ? ' …' : '');
    const bits = [`Lv${it.lv}`];
    if (it.sockets) bits.push(`孔${it.gems.length}/${it.sockets}`);
    if (tag) bits.unshift(tag);
    return `<div class="item-row" ${attr || ''}>
      <div class="ir-top"><span class="inm" style="color:${q.color}">${q.name}${Game.baseOf(it).name}</span>
        <span class="ilv">${bits.join(' · ')}</span></div>
      <div class="ir-stat">${stat}</div>
      ${aff ? `<div class="ir-aff">${aff}</div>` : ''}</div>`;
  },

  itemDetailHTML(it) {
    const q = DATA.qualities[it.q];
    const bs = Game.itemBaseStats(it);
    let html = `<div class="item-detail">
      <div class="inm" style="color:${q.color}">${q.name} · ${Game.baseOf(it).name} <span class="hint">Lv${it.lv} ${DATA.slots[it.slot]}</span></div>`;
    if (bs.atk) html += `<div class="row">攻擊 +${Game.fmt(bs.atk)}</div>`;
    if (bs.hp) html += `<div class="row">生命 +${Game.fmt(bs.hp)}</div>`;
    if (bs.def) html += `<div class="row">防禦 +${Game.fmt(bs.def)}</div>`;
    for (const [k, v] of it.aff)
      html += `<div class="row aff">${DATA.affixes[k].name} +${v}${DATA.affixes[k].unit}</div>`;
    for (let g = 0; g < it.sockets; g++) {
      const gem = it.gems[g];
      if (gem) {
        const [type, tier] = gem.split('_');
        const ct = DATA.coreTypes[type];
        html += `<div class="row gem">◆ ${DATA.coreTiers[+tier].name}·${ct.name}（${DATA.affixes[ct.stat].name} +${ct.base * DATA.coreTiers[+tier].mult}%）</div>`;
      } else {
        html += `<div class="row socket-empty">◇ 空插槽</div>`;
      }
    }
    html += '</div>';
    return html;
  },

  showItemModal(it, ref) {
    const st = Game.state;
    let cmpRows = '', btns = '';
    if (ref.loc === 'inv') {
      /* 逐英雄比較：換上這件會差多少 */
      const labels = { atk: '攻', hp: '命', def: '防' };
      for (const cls of DATA.classOrder) {
        if (!st.heroes[cls]) continue;
        const cur = st.heroes[cls].equip[it.slot];
        let cmp;
        if (!cur) {
          cmp = '<i class="up">空手 · 純提升</i>';
        } else {
          const bs = Game.itemBaseStats(it), cs = Game.itemBaseStats(cur);
          cmp = ['atk', 'hp', 'def'].map(k => {
            if (!bs[k] && !cs[k]) return '';
            const d = Math.round(bs[k] - cs[k]);
            const c = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
            const txt = d > 0 ? '+' + Game.fmt(d) : d < 0 ? '-' + Game.fmt(-d) : '±0';
            return `${labels[k]}<i class="${c}">${txt}</i>`;
          }).filter(Boolean).join(' ');
          cmp += ` <span class="hint">現有 ${Game.itemName(cur)}</span>`;
        }
        cmpRows += `<div class="cmp-row"><b>${DATA.classes[cls].name}</b>
          <span class="cd">${cmp}</span>
          <button data-equip="${cls}" class="accent">裝備</button></div>`;
      }
      btns += `<button data-salv class="warn">分解 +${Game.fmt(Game.dustFor(it))}塵</button>`;
    } else {
      btns += `<button data-swap class="accent">更換</button><button data-unequip>卸下</button>`;
    }
    btns += `<button data-forge>去鍛造</button>`;
    const m = this.modal(`
      ${this.itemDetailHTML(it)}
      ${cmpRows}
      <div class="btn-row">${btns}</div>
      <div class="close-row"><button data-close>關閉</button></div>`);
    m.querySelectorAll('[data-equip]').forEach(b => b.onclick = () => {
      Game.equip(it.id, b.dataset.equip);
      this.closeModal(); this.renderPanel();
    });
    const salv = m.querySelector('[data-salv]');
    if (salv) salv.onclick = () => {
      Game.salvage(it.id);
      this.closeModal(); this.renderPanel(); this.renderTop();
    };
    const swap = m.querySelector('[data-swap]');
    if (swap) swap.onclick = () => {
      this.closeModal();
      this.showEquipPicker(ref.cls, ref.slot);
    };
    const uneq = m.querySelector('[data-unequip]');
    if (uneq) uneq.onclick = () => {
      if (!Game.unequip(ref.cls, ref.slot)) this.toast('背包已滿，無法卸下');
      this.closeModal(); this.renderPanel();
    };
    m.querySelector('[data-forge]').onclick = () => {
      this.forgeSel = ref.loc === 'inv' ? { loc: 'inv', id: it.id } : ref;
      this.closeModal();
      document.querySelector('#tabs button[data-tab=forge]').click();
    };
    m.querySelector('[data-close]').onclick = () => this.closeModal();
  },

  showEquipPicker(cls, slot) {
    const cur = Game.state.heroes[cls].equip[slot] || null;
    const items = Game.state.inventory.filter(i => i.slot === slot)
      .sort((a, b) => Game.itemScore(b) - Game.itemScore(a));
    const curHtml = cur
      ? this.itemRowHTML(cur, 'data-current="1"', null, '目前裝備')
      : '<div class="hint" style="margin-bottom:4px">目前空手 —— 隨便一件都是提升</div>';
    const list = items.length
      ? items.map(i => this.itemRowHTML(i, `data-pick="${i.id}"`, cur)).join('')
      : '<div class="hint">背包裡沒有這個部位的裝備</div>';
    const curBtns = cur
      ? `<div class="btn-row" style="margin:0 0 8px">
          <button data-detail>詳情 / 鍛造</button>
          <button data-unequip>卸下</button></div>`
      : '';
    const m = this.modal(`<h3>${DATA.classes[cls].name} · 選擇${DATA.slots[slot]}</h3>
      ${curHtml}${curBtns}
      <div class="hint" style="margin-bottom:4px">點一件換上 · 括號內是與目前的差距</div>
      <div class="pick-list">${list}</div>
      <div class="close-row"><button data-close>關閉</button></div>`);
    m.querySelectorAll('[data-pick]').forEach(el => el.onclick = () => {
      Game.equip(+el.dataset.pick, cls);
      this.closeModal(); this.renderPanel();
    });
    const det = m.querySelector('[data-detail]');
    if (det) det.onclick = () => {
      this.closeModal();
      this.showItemModal(cur, { loc: 'equip', cls, slot });
    };
    const uneq = m.querySelector('[data-unequip]');
    if (uneq) uneq.onclick = () => {
      if (!Game.unequip(cls, slot)) this.toast('背包已滿，無法卸下');
      this.closeModal(); this.renderPanel();
    };
    m.querySelector('[data-close]').onclick = () => this.closeModal();
  },

  /* ---------- 背包 ---------- */
  htmlBag() {
    const st = Game.state;
    const items = st.inventory
      .filter(i => this.bagFilter === 'all' || i.slot === this.bagFilter)
      .sort((a, b) => Game.itemScore(b) - Game.itemScore(a));
    const opts = [['all', '全部'], ...DATA.slotOrder.map(s => [s, DATA.slots[s]])]
      .map(([v, n]) => `<option value="${v}" ${this.bagFilter === v ? 'selected' : ''}>${n}</option>`).join('');
    const salvOpts = [0, 1, 2, 3, 4, 5, 6]
      .map(q => `<option value="${q}" ${st.settings.autoSalv === q ? 'selected' : ''}>${q === 0 ? '不自動分解' : '自動分解低於' + DATA.qualities[q].name}</option>`).join('');
    return `<div class="bag-tools">
        <select id="bag-filter">${opts}</select>
        <select id="bag-salv">${salvOpts}</select>
        <button id="bag-salv-now" class="warn">立即分解</button>
        <span class="hint" style="margin-left:auto">${st.inventory.length}/60</span>
      </div>
      <div class="bag-grid">${items.map(i => this.itemChipHTML(i, `data-item="${i.id}"`)).join('') ||
        '<div class="hint">還沒有裝備，等勇者們打一會兒吧</div>'}</div>`;
  },

  bindBag(p) {
    p.querySelector('#bag-filter').onchange = (e) => { this.bagFilter = e.target.value; this.renderPanel(); };
    p.querySelector('#bag-salv').onchange = (e) => { Game.state.settings.autoSalv = +e.target.value; };
    p.querySelector('#bag-salv-now').onclick = () => {
      const q = +p.querySelector('#bag-salv').value;
      if (q <= 0) { this.toast('先在左側選擇分解門檻'); return; }
      const r = Game.salvageBelow(q);
      this.toast(`分解 ${r.n} 件，+${Game.fmt(r.d)} 星塵`);
      this.renderPanel(); this.renderTop();
    };
    p.querySelectorAll('[data-item]').forEach(el => el.onclick = () => {
      const it = Game.findItem(+el.dataset.item);
      if (it) this.showItemModal(it, { loc: 'inv', id: it.id });
    });
  },

  /* ---------- 鍛造 ---------- */
  forgeItem() {
    const sel = this.forgeSel;
    if (!sel) return null;
    if (sel.loc === 'inv') return Game.findItem(sel.id) || null;
    const h = Game.state.heroes[sel.cls];
    return (h && h.equip[sel.slot]) || null;
  },

  htmlForge() {
    const it = this.forgeItem();
    const st = Game.state;
    if (!it) {
      return `<div class="forge-target" id="forge-pick">＋ 點此選擇要鍛造的裝備<br>
        <span class="hint">（背包或身上的裝備都可以）</span></div>
        <div class="hint">升品：品質+1階，屬性重算，可能長出新詞綴<br>
        重鑄：重骰全部詞綴<br>鑿孔：追加星核插槽（最多3孔）<br>
        分解裝備可獲得星塵${Game.talentVal('smith') ? `<br>鍛造大師減免 ${Game.talentVal('smith')}%` : ''}</div>`;
    }
    const up = Game.upgradeCost(it);
    const maxQ = it.q >= 11;
    return `<div class="forge-target" id="forge-pick">${this.itemDetailHTML(it)}
        <span class="hint">（點擊更換鍛造目標）</span></div>
      <div class="forge-op"><div>升品 ${maxQ ? '<span class="hint">已達創世</span>' : `→ ${this.qname(it.q + 1)}`}
          <div class="cost">${Game.fmt(up.dust)} 星塵 + ${Game.fmt(up.gold)} 金幣</div></div>
        <button id="op-up" ${!maxQ && Game.canUpgrade(it) ? '' : 'disabled'}>升品</button></div>
      <div class="forge-op"><div>重鑄詞綴
          <div class="cost">${Game.fmt(Game.rerollCost(it))} 星塵</div></div>
        <button id="op-re" ${st.dust >= Game.rerollCost(it) ? '' : 'disabled'}>重鑄</button></div>
      <div class="forge-op"><div>鑿孔 ${it.sockets >= 3 ? '<span class="hint">已達3孔</span>' : `（${it.sockets}/3）`}
          <div class="cost">${Game.fmt(Game.socketCost(it))} 星塵</div></div>
        <button id="op-so" ${it.sockets < 3 && st.dust >= Game.socketCost(it) ? '' : 'disabled'}>鑿孔</button></div>
      ${it.gems.map((g, gi) => {
        const [type, tier] = g.split('_');
        return `<div class="forge-op"><div>取回 <span style="color:${DATA.coreTypes[type].color}">${DATA.coreTiers[+tier].name}·${DATA.coreTypes[type].name}</span>
          <div class="cost">${Game.fmt(Game.unsocketCost(+tier))} 星塵</div></div>
          <button data-unsocket="${gi}" ${st.dust >= Game.unsocketCost(+tier) ? '' : 'disabled'}>取回</button></div>`;
      }).join('')}`;
  },

  bindForge(p) {
    p.querySelector('#forge-pick').onclick = () => this.showForgePicker();
    const it = this.forgeItem();
    if (!it) return;
    const rebind = () => { this.renderPanel(); this.renderTop(); };
    const up = p.querySelector('#op-up');
    if (up) up.onclick = () => { Game.upgrade(it); rebind(); };
    const re = p.querySelector('#op-re');
    if (re) re.onclick = () => { Game.reroll(it); rebind(); };
    const so = p.querySelector('#op-so');
    if (so) so.onclick = () => { Game.addSocket(it); rebind(); };
    p.querySelectorAll('[data-unsocket]').forEach(b => b.onclick = () => {
      Game.unsocketCore(it, +b.dataset.unsocket); rebind();
    });
  },

  showForgePicker() {
    const st = Game.state;
    let html = '<h3>選擇鍛造目標</h3><div class="pick-list">';
    for (const cls of DATA.classOrder) {
      const h = st.heroes[cls];
      if (!h) continue;
      for (const slot of DATA.slotOrder) {
        if (h.equip[slot])
          html += this.itemRowHTML(h.equip[slot], `data-fp="equip:${cls}:${slot}"`, null,
            `${DATA.classes[cls].name}裝備中`);
      }
    }
    const items = [...st.inventory].sort((a, b) => Game.itemScore(b) - Game.itemScore(a)).slice(0, 30);
    for (const i of items) html += this.itemRowHTML(i, `data-fp="inv:${i.id}"`);
    html += '</div><div class="close-row"><button data-close>關閉</button></div>';
    const m = this.modal(html);
    m.querySelectorAll('[data-fp]').forEach(el => el.onclick = () => {
      const parts = el.dataset.fp.split(':');
      this.forgeSel = parts[0] === 'inv'
        ? { loc: 'inv', id: +parts[1] }
        : { loc: 'equip', cls: parts[1], slot: parts[2] };
      this.closeModal(); this.renderPanel();
    });
    m.querySelector('[data-close]').onclick = () => this.closeModal();
  },

  /* ---------- 星核 ---------- */
  htmlCore() {
    const st = Game.state;
    const keys = Object.keys(st.cores);
    let html = `<div class="hint">Boss 有機率掉落星核；3 顆同系同階可熔合升階。<br>鑲嵌需要裝備先有插槽（鍛造→鑿孔）。</div>`;
    if (!keys.length) return html + '<div class="hint" style="margin-top:8px">目前沒有星核，去打 Boss 吧！</div>';
    keys.sort();
    html += '<div class="core-grid" style="margin-top:6px">';
    for (const key of keys) {
      const [type, tierS] = key.split('_');
      const tier = +tierS;
      const ct = DATA.coreTypes[type];
      const n = st.cores[key];
      html += `<div class="core-cell">
        <span><i class="core-dot" style="background:${ct.color}"></i>${DATA.coreTiers[tier].name}·${ct.name}
          <span class="hint">×${n}</span><br>
          <span class="hint">${DATA.affixes[ct.stat].name} +${ct.base * DATA.coreTiers[tier].mult}%</span></span>
        <span>
          <button data-fuse="${key}" ${n >= 3 && tier < 4 ? '' : 'disabled'}>熔合</button>
          <button data-socket="${key}" class="accent">鑲嵌</button>
        </span></div>`;
    }
    return html + '</div>';
  },

  bindCore(p) {
    p.querySelectorAll('[data-fuse]').forEach(b => b.onclick = () => {
      const [type, tier] = b.dataset.fuse.split('_');
      if (Game.fuseCore(type, +tier)) this.toast('熔合成功！');
      this.renderPanel();
    });
    p.querySelectorAll('[data-socket]').forEach(b => b.onclick = () => {
      this.showSocketPicker(b.dataset.socket);
    });
  },

  showSocketPicker(coreKey) {
    const st = Game.state;
    const cands = [];
    for (const cls of DATA.classOrder) {
      const h = st.heroes[cls];
      if (!h) continue;
      for (const slot of DATA.slotOrder) {
        const it = h.equip[slot];
        if (it && it.gems.length < it.sockets) cands.push([it, `${DATA.classes[cls].name}`]);
      }
    }
    for (const it of st.inventory) {
      if (it.gems.length < it.sockets) cands.push([it, '背包']);
    }
    const list = cands.length
      ? cands.map(([it, who], i) => this.itemRowHTML(it, `data-sp="${i}"`, null, who)).join('')
      : '<div class="hint">沒有裝備有空插槽，先去鍛造鑿孔吧</div>';
    const m = this.modal(`<h3>選擇要鑲嵌的裝備</h3><div class="pick-list">${list}</div>
      <div class="close-row"><button data-close>關閉</button></div>`);
    m.querySelectorAll('[data-sp]').forEach(el => el.onclick = () => {
      const [it] = cands[+el.dataset.sp];
      const [type, tier] = coreKey.split('_');
      if (Game.socketCore(it, type, +tier)) this.toast('鑲嵌完成！');
      this.closeModal(); this.renderPanel();
    });
    m.querySelector('[data-close]').onclick = () => this.closeModal();
  },

  /* ---------- 昇華 ---------- */
  htmlAscend() {
    const st = Game.state;
    const gain = Game.emberGain();
    let html = `<div class="ascend-box">
      本輪最深：第 ${st.runMaxFloor} 層<br>
      昇華可得 <span class="big">${gain}</span> 餘燼
      ${gain <= 0 ? `<div class="hint">（抵達第 40 層開啟昇華）</div>` : ''}
      <div style="margin-top:6px"><button id="asc-btn" class="warn" ${gain > 0 ? '' : 'disabled'}>昇 華</button></div>
      <div class="hint" style="margin-top:4px">重置：樓層 / 英雄等級 / 金幣<br>保留：裝備 / 星核 / 星塵 / 成就 / 天賦</div>
    </div>`;
    for (const t of DATA.talents) {
      const rank = Game.talentRank(t.id);
      const cost = Game.talentCost(t.id);
      const maxed = rank >= t.max;
      html += `<div class="talent-row">
        <span><span class="tn">${t.name}</span> <span class="hint">${rank}/${t.max}</span><br>
        <span class="td">${t.desc} +${t.per}${t.unit}/級${rank ? `（目前 +${rank * t.per}${t.unit}）` : ''}</span></span>
        <button data-talent="${t.id}" ${!maxed && st.ember >= cost ? '' : 'disabled'}>
          ${maxed ? '滿級' : cost + ' 餘燼'}</button></div>`;
    }
    return html;
  },

  bindAscend(p) {
    const btn = p.querySelector('#asc-btn');
    if (btn) btn.onclick = () => {
      const gain = Game.emberGain();
      const m = this.modal(`<h3>確定要昇華嗎？</h3>
        <div class="hint">獲得 ${gain} 餘燼。樓層、英雄等級與金幣將歸零；<br>裝備、星核、星塵、成就、天賦全部保留。</div>
        <div class="btn-row"><button data-yes class="warn">昇華！</button><button data-close>再想想</button></div>`);
      m.querySelector('[data-yes]').onclick = () => {
        Game.ascend();
        this.closeModal(); this.renderPanel(); this.renderTop();
      };
      m.querySelector('[data-close]').onclick = () => this.closeModal();
    };
    p.querySelectorAll('[data-talent]').forEach(b => b.onclick = () => {
      Game.buyTalent(b.dataset.talent);
      this.renderPanel(); this.renderTop();
    });
  },

  /* ---------- 共鬥 ---------- */
  raidPreview: null,

  htmlRaid() {
    const st = Game.state;
    const R = this.raid;

    /* 戰鬥中 / 結算 */
    if (R) {
      const sim = R.st;
      const isExp = sim.mode === 'exp';
      const dmg = R.full.teams.map(() => 0);
      sim.heroes.forEach(h => { dmg[h.team] += h.dmg; });
      const maxSec = (isExp ? Raid.EXP_TICKS : RAID_MAX_TICKS) / RAID_TPS;
      const headline = isExp
        ? `遠征第 <b>${sim.floor}</b> 層（本輪已推 ${sim.cleared} 層）`
        : `王血量 <b>${(Math.max(0, sim.boss.hp) / R.full.boss.hp * 100).toFixed(1)}%</b>`;
      const title = isExp
        ? `${sim.done ? '遠征結算' : '遠征中'} — 深淵遠征`
        : `${sim.done ? '共鬥結算' : '共鬥進行中'} — ${DATA.zones[R.full.boss.z].boss.name} Lv${R.full.boss.lv}`;
      let html = `<div class="section-title">${title}</div>
        <div class="raid-box">
          ${headline} · ${Math.floor(sim.tick / RAID_TPS)}s / ${maxSec}s<br>
          ${R.full.teams.map((t, i) =>
            `<span style="color:${i === R.myTeam ? '#7dd87d' : '#c9c9d8'}">${i === R.myTeam ? '★' : '◇'} ${t.n}：${Game.fmt(dmg[i] / 10)}</span>`
          ).join('　')}
        </div>`;
      if (!sim.done) {
        html += `<div class="btn-row">
          <button id="raid-speed">速度 ×${R.speed}</button>
          <button id="raid-skip">跳到結果</button>
          <button id="raid-abort" class="warn">中止</button></div>`;
      } else {
        const doneMsg = isExp
          ? `遠征結束：第 ${R.full.from} 層 → 第 ${R.full.from + sim.cleared} 層（推進 ${sim.cleared} 層）`
          : (sim.win ? '🎉 共鬥王被擊破！' : '時間到，王還站著 —— 累積傷害如下');
        html += `<div class="raid-box" style="margin-top:6px">${doneMsg}<br>` +
          [...sim.heroes].sort((a, b) => b.dmg - a.dmg).map(h =>
            `<span style="color:${h.team === R.myTeam ? DATA.classes[h.c].color : '#c9c9d8'}">
             ${R.full.teams[h.team].n}的${DATA.classes[h.c].name}Lv${h.s.l} — ${Game.fmt(h.dmg / 10)}</span>`
          ).join('<br>') + '</div>';
        if (R.reportCode) {
          html += `<div class="hint" style="margin-top:6px">把這份戰報碼傳回給開戰的隊友，對方貼上就能重播同一場：</div>
            <textarea id="raid-report" readonly>${R.reportCode}</textarea>
            <div class="btn-row"><button id="raid-copy" class="accent">複製戰報碼</button>
            <button id="raid-close">關閉</button></div>`;
        } else {
          html += `<div class="btn-row" style="margin-top:6px"><button id="raid-close">關閉</button></div>`;
        }
      }
      return html;
    }

    /* 準備狀態 */
    const maxB = Math.max(10, Math.floor(st.maxFloorEver / 10) * 10);
    const floors = [];
    for (let f = maxB; f >= 10 && floors.length < 8; f -= 10) floors.push(f);
    const opts = floors.map(f =>
      `<option value="${f}">Lv${f} ${DATA.zones[Game.zoneIdx(f)].boss.name}</option>`).join('');

    let html = `<div class="section-title">和朋友同框並肩打共鬥王</div>`;

    /* 雲端房間視圖 */
    if (st.settings.roomCode && this.roomData) {
      const rm = this.roomData;
      const pct = rm.pool > 0 ? rm.remaining / rm.pool : 0;
      const bossName = DATA.zones[rm.boss.z].boss.name;
      const cleared = rm.remaining <= 0;
      html += `<div class="raid-box">
        房碼 <b>${rm.code}</b>（把它給朋友，7天有效）<br>
        ${bossName} Lv${rm.boss.lv} — 共同血池 ${(pct * 100).toFixed(1)}%<br>
        <span class="hint">${Game.fmt(rm.remaining / 10)} / ${Game.fmt(rm.pool / 10)}${rm.players.length < 2 ? ' · 等第二位參戰（血池將×1.7）' : ''}</span><br>` +
        rm.players.map(pl =>
          `<span style="color:${pl.n === st.settings.playerName ? '#7dd87d' : '#c9c9d8'}">${pl.n === st.settings.playerName ? '★' : '◇'} ${pl.n} Lv${(pl.h && pl.h[0] && pl.h[0].l) || '?'} — 累積 ${Game.fmt(pl.dmg / 10)}</span>`
        ).join('<br>') +
        `${cleared ? '<br>🎉 共鬥王已被你們擊破！' : ''}</div>
        <div class="btn-row">
          <button id="room-fight" class="accent" ${cleared ? 'disabled' : ''}>⚔ 出戰（60秒）</button>
          <button id="room-refresh">重新整理</button>
          <button id="room-copy">複製房碼</button>
          <button id="room-leave" class="warn">離開</button>
        </div>`;
      /* 雙人深淵遠征 */
      const exp = rm.exp || { floor: 1, best: 1, runs: [] };
      html += `<div class="section-title">深淵遠征 — 兩人共享進度的接力爬層</div>
        <div class="raid-box">
          目前深度 <b>第 ${exp.floor} 層</b>${exp.best > exp.floor ? `（紀錄 ${exp.best}）` : ''}<br>
          <span class="hint">六人同行往下推層，推到哪隊友就從哪接棒；全滅或 120 秒收兵，過層有金幣星塵獎勵</span>
        </div>
        <div class="btn-row"><button id="exp-fight" class="accent">⛏ 遠征出戰（120秒）</button></div>` +
        (exp.runs || []).slice(0, 3).map(r =>
          `<div class="forge-op"><div>${r.n}：第 ${r.from} → ${r.to} 層</div></div>`).join('');
      const replays = (rm.runs || []).slice(0, 3);
      if (replays.length) {
        html += `<div class="section-title">最近出戰（可重播觀戰）</div>` +
          replays.map((r, i) =>
            `<div class="forge-op"><div>${r.n} 造成 ${Game.fmt(r.dmg / 10)}</div>
             <button data-replay="${i}">重播</button></div>`).join('');
      }
      return html;
    }
    if (st.settings.roomCode) {
      html += `<div class="raid-box">連線房間 ${st.settings.roomCode} 中…</div>
        <div class="btn-row"><button id="room-refresh">重新整理</button>
        <button id="room-leave" class="warn">離開房間</button></div>`;
      return html;
    }

    /* 尚未進房：開房 / 加入 */
    html += `<div class="set-row" style="margin-top:6px"><span>我的名字</span>
        <input id="raid-name" maxlength="8" value="${st.settings.playerName}"></div>
      <div class="set-row"><span>挑戰的王</span><select id="raid-boss">${opts}</select></div>
      <div class="btn-row"><button id="room-make" class="accent">開雲端房（拿房碼給朋友）</button></div>
      <div class="set-row" style="margin-top:4px"><span>朋友給的房碼</span>
        <span><input id="room-code" maxlength="6" style="width:80px;text-transform:uppercase" placeholder="ABC123">
        <button id="room-join" class="accent">加入</button></span></div>
      <div class="hint">房間裡有兩種玩法（開房或加入後出現）：<br>
      ⚔ <b>共鬥王</b> — 兩人共磨同一條王血池（雙人血池×1.7），傷害即時累積<br>
      ⛏ <b>深淵遠征</b> — 六人同行接力爬層，你推到哪隊友就從哪接棒</div>
      <details style="margin-top:8px" ${this.raidPreview ? 'open' : ''}><summary class="hint" style="cursor:pointer">▸ 不用網路的碼交換模式（挑戰碼 / 戰報碼）</summary>
      <div class="hint">① 產生挑戰碼傳給朋友 ② 朋友貼上開戰後把「戰報碼」傳回 ③ 你貼上重播出逐幀相同的戰鬥</div>
      <div class="btn-row" style="margin-top:4px"><button id="raid-make">產生挑戰碼（帶上我的隊伍）</button></div>
      <textarea id="raid-out" readonly placeholder="挑戰碼會出現在這裡，複製傳給朋友"></textarea>
      <div class="section-title">貼上朋友的挑戰碼 / 戰報碼</div>
      <textarea id="raid-in" placeholder="貼在這裡"></textarea>
      <div class="btn-row"><button id="raid-load">讀取</button></div>`;
    if (this.raidPreview) {
      const pv = this.raidPreview;
      const bossName = DATA.zones[pv.boss.z].boss.name;
      html += `<div class="raid-box" style="margin-top:6px">
        ${bossName} Lv${pv.boss.lv}<br>` +
        pv.teams.map(t => `${t.n}：${t.h.map(s => `${DATA.classes[s.c].name}Lv${s.l}`).join('、')}`).join('<br>') +
        `</div><div class="btn-row">
        <button id="raid-fight" class="accent">${pv.teams.length === 1 ? '⚔ 並肩開戰（加入我的隊伍）' : '▶ 重播這場戰報'}</button></div>`;
    }
    html += '</details>';
    return html;
  },

  bindRaid(p) {
    const R = this.raid;
    if (R) {
      const sp = p.querySelector('#raid-speed');
      if (sp) sp.onclick = () => { R.speed = R.speed === 1 ? 4 : 1; this.renderPanel(); };
      const sk = p.querySelector('#raid-skip');
      if (sk) sk.onclick = () => {
        while (!R.st.done) { Raid.step(R.st); R.st.events.length = 0; }
        R.doneNotified = true;
        this.postRaidResult(R);
        this.dmgTexts.length = 0; this.parts.length = 0;
        this.renderPanel();
      };
      const ab = p.querySelector('#raid-abort');
      if (ab) ab.onclick = () => this.endRaid();
      const cl = p.querySelector('#raid-close');
      if (cl) cl.onclick = () => this.endRaid();
      const cp = p.querySelector('#raid-copy');
      if (cp) cp.onclick = () => {
        const ta = p.querySelector('#raid-report');
        ta.select();
        try { document.execCommand('copy'); this.toast('戰報碼已複製'); } catch (e) { /* 忽略 */ }
      };
      return;
    }
    /* ---- 雲端房間 ---- */
    const myName = () => Game.state.settings.playerName;
    const mk = p.querySelector('#room-make');
    if (mk) mk.onclick = async () => {
      mk.disabled = true;
      try {
        const room = await Raid.createRoom(+p.querySelector('#raid-boss').value, myName());
        Game.state.settings.roomCode = room.code;
        this.roomData = room;
        Game.save();
        this.toast(`房間 ${room.code} 已建立，把房碼給朋友！`);
        this.renderPanel();
      } catch (e) { this.toast('開房失敗：' + e.message); mk.disabled = false; }
    };
    const jn = p.querySelector('#room-join');
    if (jn) jn.onclick = async () => {
      const code = p.querySelector('#room-code').value.trim().toUpperCase();
      if (code.length !== 6) { this.toast('房碼是 6 碼英數字'); return; }
      jn.disabled = true;
      try {
        const room = await Raid.joinRoom(code, myName());
        Game.state.settings.roomCode = room.code;
        this.roomData = room;
        Game.save();
        this.toast('已加入房間！');
        this.syncRoomLevel(room);
        this.renderPanel();
      } catch (e) {
        this.toast(e.message === 'room full' ? '房間已滿（兩人）' : '加入失敗：' + e.message);
        jn.disabled = false;
      }
    };
    const rf = p.querySelector('#room-refresh');
    if (rf) rf.onclick = () => { this.loadRoom(); this.toast('已更新'); };
    const rc = p.querySelector('#room-copy');
    if (rc) rc.onclick = () => { this.copyText(Game.state.settings.roomCode); this.toast('房碼已複製'); };
    const lv = p.querySelector('#room-leave');
    if (lv) lv.onclick = () => {
      Game.state.settings.roomCode = '';
      this.roomData = null;
      Game.save();
      this.renderPanel();
    };
    const ft = p.querySelector('#room-fight');
    if (ft) ft.onclick = () => {
      const rm = this.roomData;
      if (!rm) return;
      const seed = Raid.newRoundSeed();
      const myIdx = rm.players.findIndex(pl => pl.n === myName());
      if (myIdx < 0) { this.toast('名字與房內參戰者不符'); return; }
      this.startRaid(Raid.roomInput(rm, seed), myIdx, null, { code: rm.code, seed });
    };
    const ef = p.querySelector('#exp-fight');
    if (ef) ef.onclick = () => {
      const rm = this.roomData;
      if (!rm) return;
      const seed = Raid.newRoundSeed();
      const myIdx = rm.players.findIndex(pl => pl.n === myName());
      if (myIdx < 0) { this.toast('名字與房內參戰者不符'); return; }
      this.startRaid(Raid.expInput(rm, seed), myIdx, null, { code: rm.code, seed });
    };
    p.querySelectorAll('[data-replay]').forEach(b => b.onclick = () => {
      const rm = this.roomData;
      const run = rm && (rm.runs || [])[+b.dataset.replay];
      if (!run) return;
      const myIdx = rm.players.findIndex(pl => pl.n === myName());
      this.startRaid(Raid.roomInput(rm, run.seed), Math.max(0, myIdx), null, null);
    });

    /* ---- 碼交換模式 ---- */
    const nameIn = p.querySelector('#raid-name');
    if (nameIn) nameIn.onchange = (e) => {
      Game.state.settings.playerName = e.target.value.trim() || '勇者';
    };
    const make = p.querySelector('#raid-make');
    if (make) make.onclick = () => {
      const code = Raid.encode(Raid.newChallenge(+p.querySelector('#raid-boss').value, myName()));
      const ta = p.querySelector('#raid-out');
      ta.value = code;
      ta.select();
      try { document.execCommand('copy'); this.toast('挑戰碼已複製，傳給朋友吧！'); } catch (e) { /* 忽略 */ }
    };
    const load = p.querySelector('#raid-load');
    if (load) load.onclick = () => {
      const obj = Raid.decode(p.querySelector('#raid-in').value);
      if (!obj) {
        this.toast(Raid.decodeErr === 'version'
          ? '版本不合：請兩邊都按 Ctrl+Shift+R 更新到最新版後重試'
          : '這不是有效的挑戰碼/戰報碼');
        return;
      }
      if (obj.teams.length > 2) { this.toast('隊伍數量異常'); return; }
      this.raidPreview = obj;
      const keep = p.querySelector('#raid-in').value;
      this.renderPanel();
      document.getElementById('panel').querySelector('#raid-in').value = keep;
    };
    const fight = p.querySelector('#raid-fight');
    if (fight) fight.onclick = () => {
      const pv = this.raidPreview;
      this.raidPreview = null;
      if (pv.teams.length === 1) {
        const full = Raid.joinChallenge(pv, myName());
        this.startRaid(full, 1, Raid.encode(full));
      } else {
        const myIdx = pv.teams.findIndex(t => t.n === myName());
        this.startRaid(pv, myIdx >= 0 ? myIdx : 0, null);
      }
    };
  },

  /* 雲端房間狀態 */
  roomData: null,
  _pollN: 0,

  /* 房間等級同步：隊伍等級拉平到兩人中較高者；並保持房內快照最新 */
  syncRoomLevel(room) {
    const st = Game.state;
    const myName = st.settings.playerName;
    let best = 0, who = '';
    for (const p of room.players) {
      if (p.n === myName) continue;
      const lv = (p.h && p.h[0] && p.h[0].l) || 0;
      if (lv > best) { best = lv; who = p.n; }
    }
    if (best > st.teamLv) {
      st.teamLv = best;
      st.teamXp = 0;
      st.stats.maxHeroLv = Math.max(st.stats.maxHeroLv, best);
      Game.dirty();
      Game.save();
      this.toast(`⚡ 與 ${who} 等級同步：隊伍升到 Lv${best}！`);
    }
    /* 我的等級/裝備有變 → 更新房內快照，讓隊友那邊也能同步 */
    const me = room.players.find(p => p.n === myName);
    if (me && me.h && me.h[0] && me.h[0].l !== st.teamLv) {
      Raid.joinRoom(room.code, myName)
        .then(r => { this.roomData = r; })
        .catch(() => { /* 下次輪詢再試 */ });
    }
  },

  loadRoom() {
    const code = Game.state.settings.roomCode;
    if (!code) return;
    Raid.getRoom(code).then(room => {
      if (room.v !== 1) {
        this.toast('房間版本不合，請兩邊都更新後重開房');
        return;
      }
      this.roomData = room;
      this.syncRoomLevel(room);
      if (this.tab === 'raid' && !this.raid) this.renderPanel();
    }).catch(e => {
      if (String(e.message).includes('not found')) {
        Game.state.settings.roomCode = '';
        this.roomData = null;
        this.toast('房間已過期或不存在');
        if (this.tab === 'raid' && !this.raid) this.renderPanel();
      }
    });
  },

  /* 新版本更新橫幅 */
  showUpdateBar() {
    if (document.getElementById('update-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'update-bar';
    bar.textContent = '🔄 新版本已釋出 — 點此立即更新（存檔不受影響）';
    bar.onclick = () => {
      Game.save();
      location.reload();
    };
    document.body.appendChild(bar);
  },

  copyText(str) {
    const ta = document.createElement('textarea');
    ta.value = str;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
    ta.remove();
  },

  /* ---------- 成就 ---------- */
  htmlAchv() {
    const st = Game.state;
    const done = Object.keys(st.achievements).length;
    let html = `<div class="hint">已達成 ${done}/${DATA.achievements.length} · 每個成就：全屬性 +0.5%、金幣 +1%</div>`;
    const sorted = [...DATA.achievements].sort((a, b) =>
      (st.achievements[b.id] ? 0 : 1) - (st.achievements[a.id] ? 0 : 1) || 0);
    for (const a of sorted) {
      const isDone = !!st.achievements[a.id];
      const cur = st.stats[a.key] || 0;
      html += `<div class="ach-row ${isDone ? 'done' : ''}">
        <span><span class="an">${isDone ? '✓ ' : ''}${a.name}</span><br><span class="ad">${a.desc}</span></span>
        <span class="ap">${isDone ? '達成' : Game.fmt(Math.min(cur, a.n)) + '/' + Game.fmt(a.n)}</span></div>`;
    }
    return html;
  },

  /* ---------- 設定 ---------- */
  htmlSet() {
    const st = Game.state;
    const capH = 8 + Game.talentVal('hourglass');
    return `
      <div class="set-row"><span>自動推進樓層</span>
        <button id="set-adv">${st.settings.autoAdvance ? '開' : '關'}</button></div>
      <div class="set-row"><span>迷你模式（只留戰鬥畫面）</span>
        <button id="set-mini">切換</button></div>
      <div class="set-row"><span>視窗大小</span><span>
        ${[['1', '大'], ['0.85', '中'], ['0.7', '小']].map(([v, n]) =>
          `<button data-scale="${v}" class="${Math.abs((st.settings.uiScale || 1) - +v) < 0.01 ? 'sel' : ''}">${n}</button>`
        ).join('')}</span></div>
      <div class="set-row"><span class="hint">離線收益上限：${capH} 小時 · 目前擊殺效率 ${st.kps.toFixed(2)}/秒</span></div>
      <div class="section-title">存檔</div>
      <textarea id="save-io" placeholder="匯出後複製保存；或貼上存檔碼後按匯入"></textarea>
      <div class="btn-row">
        <button id="save-exp">匯出存檔</button>
        <button id="save-imp">匯入存檔</button>
        <button id="save-wipe" class="warn">重置存檔</button>
      </div>
      <div class="section-title">關於</div>
      <div class="hint">《口袋深淵 Pocket Abyss》— 迷你像素放置RPG<br>
      靈感致敬《TBH：塔斯克巴·英雄》。純前端零依賴，資料存在本機瀏覽器。<br>
      累計遊玩 ${(st.stats.playtime / 3600).toFixed(1)} 小時 · 累計擊殺 ${Game.fmt(st.stats.kills)}</div>`;
  },

  bindSet(p) {
    p.querySelector('#set-adv').onclick = () => {
      Game.state.settings.autoAdvance = !Game.state.settings.autoAdvance;
      this.renderPanel(); this.renderTop();
    };
    p.querySelector('#set-mini').onclick = () => this.toggleMini();
    p.querySelectorAll('[data-scale]').forEach(b => b.onclick = () => {
      Game.state.settings.uiScale = +b.dataset.scale;
      this.applyScale();
      Game.save();
      this.renderPanel();
    });
    p.querySelector('#save-exp').onclick = () => {
      const ta = p.querySelector('#save-io');
      ta.value = Game.exportSave();
      ta.select();
      try { document.execCommand('copy'); this.toast('已複製到剪貼簿'); } catch (e) { /* 忽略 */ }
    };
    p.querySelector('#save-imp').onclick = () => {
      const v = p.querySelector('#save-io').value;
      if (Game.importSave(v)) { this.toast('匯入成功'); this.renderPanel(); this.renderTop(); }
      else this.toast('存檔碼無效');
    };
    p.querySelector('#save-wipe').onclick = () => {
      const m = this.modal(`<h3>重置存檔？</h3><div class="hint">所有進度將永久消失。</div>
        <div class="btn-row"><button data-yes class="warn">確定重置</button><button data-close>取消</button></div>`);
      m.querySelector('[data-yes]').onclick = () => {
        Game.wipe(); this.closeModal(); this.renderPanel(); this.renderTop();
      };
      m.querySelector('[data-close]').onclick = () => this.closeModal();
    };
  },

  /* ---------- 彈窗 ---------- */
  modal(html) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal">${html}</div>`;
    root.classList.remove('hidden');
    return root.firstChild;
  },

  closeModal() {
    const root = document.getElementById('modal-root');
    root.classList.add('hidden');
    root.innerHTML = '';
  },

  /* ---------- 離線收益結算窗 ---------- */
  showOffline(off) {
    if (!off) return;
    const h = Math.floor(off.seconds / 3600), min = Math.floor((off.seconds % 3600) / 60);
    const m = this.modal(`<h3>歡迎回來！</h3>
      <div class="hint">你離開的 ${h > 0 ? h + ' 小時 ' : ''}${min} 分鐘裡，小隊持續奮戰：</div>
      <div style="margin:8px 0; line-height:1.9">
        擊殺怪物 <b>${Game.fmt(off.kills)}</b> 隻<br>
        獲得金幣 <b style="color:var(--gold)">${Game.fmt(off.gold)}</b><br>
        拾獲裝備 <b>${off.items}</b> 件${off.dust > 0 ? `<br>獲得星塵 <b style="color:var(--dust)">${Game.fmt(off.dust)}</b>` : ''}
      </div>
      ${off.capped ? '<div class="hint">（已達離線收益上限，昇華天賦「時間沙漏」可延長）</div>' : ''}
      <div class="close-row"><button data-close>繼續冒險</button></div>`);
    m.querySelector('[data-close]').onclick = () => this.closeModal();
  },
};
