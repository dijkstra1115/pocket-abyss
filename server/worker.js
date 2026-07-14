/* 口袋深淵 — 共鬥房間 API（Cloudflare Worker + KV）
   只存最小共享狀態：王配置、共用血池、參戰者快照與累積傷害、最近出戰紀錄（供重播）。
   角色本體資料不上雲；房碼不含任何個資。 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', ...CORS },
});

/* 避開易混淆字元的 6 碼房號 */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 6 },
  () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

const TTL = 7 * 24 * 3600;           /* 房間 7 天後自動消失 */
const MAX_PLAYERS = 2;
/* 共鬥王血池隨人數 sub-linear 縮放：1人×1.0、2人×1.7 */
const poolFor = (bossHp, n) => Math.floor(bossHp * (n >= 2 ? 17 : 10) / 10);

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    try {
      if (parts[0] !== 'room') return json({ err: 'not found' }, 404);

      /* POST /room — 開房 */
      if (req.method === 'POST' && parts.length === 1) {
        const b = await req.json();
        if (!b || b.v !== 1 || !b.boss || !b.player ||
            !Array.isArray(b.player.h) || !b.player.h.length || b.player.h.length > 3)
          return json({ err: 'bad request' }, 400);
        if (JSON.stringify(b).length > 4000) return json({ err: 'too large' }, 400);
        let code, tries = 0;
        do { code = newCode(); } while (await env.ROOMS.get('room:' + code) && ++tries < 5);
        const pool = poolFor(b.boss.hp, 1);
        const room = {
          v: 1, code, seed: b.seed >>> 0, boss: b.boss,
          players: [{ n: String(b.player.n).slice(0, 8), h: b.player.h, dmg: 0 }],
          pool, remaining: pool, runs: [], created: Date.now(),
        };
        await env.ROOMS.put('room:' + code, JSON.stringify(room), { expirationTtl: TTL });
        return json(room);
      }

      const code = (parts[1] || '').toUpperCase();
      const raw = await env.ROOMS.get('room:' + code);
      if (!raw) return json({ err: 'room not found' }, 404);
      const room = JSON.parse(raw);

      /* GET /room/CODE — 讀房間狀態 */
      if (req.method === 'GET') return json(room);

      const action = parts[2];
      const b = await req.json();

      /* POST /room/CODE/join — 加入（或更新自己的隊伍快照） */
      if (action === 'join') {
        if (!b || !Array.isArray(b.h) || !b.h.length || b.h.length > 3)
          return json({ err: 'bad request' }, 400);
        const name = String(b.n || '').slice(0, 8) || '夥伴';
        const exist = room.players.find(p => p.n === name);
        if (exist) {
          exist.h = b.h;
        } else {
          if (room.players.length >= MAX_PLAYERS) return json({ err: 'room full' }, 409);
          room.players.push({ n: name, h: b.h, dmg: 0 });
          const used = room.pool - room.remaining;
          room.pool = poolFor(room.boss.hp, room.players.length);
          room.remaining = Math.max(0, room.pool - used);
        }
        await env.ROOMS.put('room:' + code, JSON.stringify(room), { expirationTtl: TTL });
        return json(room);
      }

      /* POST /room/CODE/damage — 回寫一輪出戰的傷害 */
      if (action === 'damage') {
        const name = String(b.n || '').slice(0, 8);
        const p = room.players.find(p => p.n === name);
        if (!p) return json({ err: 'not in room' }, 403);
        if (room.remaining > 0) {
          const dmg = Math.max(0, Math.min(Math.floor(+b.dmg || 0), room.pool));
          p.dmg += dmg;
          room.remaining = Math.max(0, room.remaining - dmg);
          room.runs.unshift({ n: name, seed: (+b.seed >>> 0) || 0, dmg, ts: Date.now() });
          room.runs = room.runs.slice(0, 10);
          await env.ROOMS.put('room:' + code, JSON.stringify(room), { expirationTtl: TTL });
        }
        return json(room);
      }

      return json({ err: 'not found' }, 404);
    } catch (e) {
      return json({ err: 'server error' }, 500);
    }
  },
};
