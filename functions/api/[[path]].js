






const SUPABASE_URL = 'https://jilcbcodphxpasicjghv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbGNiY29kcGh4cGFzaWNqZ2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDUzNTgsImV4cCI6MjEwNDE4MTM1OH0._DkyiWyL5viXByCJ5ejFifn9RuEVkVHjAnU4oQepsbs';
const DATA_ORIGIN = 'https://tst-server-site.pages.dev';

const TST_TOKEN = '0e18fe94d4f9259cb0eb3f59c44f6984a8a280ad399b1fb7';
const TST_KEY = 'tst_status_v1';
const TST_STALE_MS = 420000; 
function tstMemSet(rec) { try { globalThis.__TST_STATUS_REC = rec; } catch (e) {  } }
function tstMemGet() { try { return globalThis.__TST_STATUS_REC || null; } catch (e) { return null; } }

let ADMIN_PWD = null; 

const DEBUG_CODES = { 'TST-G4N7QX': 'bench3d', 'TST-K3M9X7': 'glass', 'TST-X2W5V8': 'light', 'TST-Q8N4R2': 'desktop', 'TST-M7Z1P6': 'mobile', 'TST-H6D3B9': 'perf', 'TST-F5J8C4': 'dev', 'TST-R2T7W1': 'reset', 'TST-7KQ2WP': 'chat', K3M9X7: 'glass', X2W5V8: 'light', Q8N4R2: 'desktop', M7Z1P6: 'mobile', H6D3B9: 'perf', F5J8C4: 'dev', R2T7W1: 'reset' };


const L_START = new Date('2026-10-01T00:00:00+08:00');  
const L_END = new Date('2026-10-08T23:59:59+08:00');    
const DRAW_DEV_MAP = new Map();  
const DRAW_IP_MAP = new Map();   

function cnDate(d) {
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
function pickWeighted(codes) {
  const total = codes.reduce((s, c) => s + (c.weight > 0 ? c.weight : 1), 0);
  let r = Math.random() * total;
  for (const c of codes) {
    r -= (c.weight > 0 ? c.weight : 1);
    if (r <= 0) return c;
  }
  return codes[codes.length - 1];
}
async function sbFetch(path, opts) {
  const headers = { apikey: SUPABASE_ANON, authorization: 'Bearer ' + SUPABASE_ANON, ...(opts && opts.headers ? opts.headers : {}) };
  const res = await fetch(SUPABASE_URL + path, { ...(opts || {}), headers });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = text; }
  return { status: res.status, body: body, text: text };
}
async function adminLottery(action, payload) {
  if (!ADMIN_PWD) return { ok: false, error: 'no_pwd' };
  if (!ADMIN_PWD) return { ok: false, error: 'no_pwd' };
  const r = await sbFetch('/rest/rpc/admin_lottery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_pwd: ADMIN_PWD, p_action: action, p_payload: payload || {} }),
  });
  return r.body;
}
async function fetchUnclaimedCodes() {
  const res = await adminLottery('list', {});
  if (!res || !res.ok || !Array.isArray(res.codes)) return null;
  return res.codes.filter(c => !c.claimed && !String(c.prize || '').startsWith('【已使用】'));
}


async function claimCode(id, prize, device, now) {
  const res = await adminLottery('update_prize', { id: String(id), prize: '【已使用】' + (prize || '') });
  return !!(res && res.ok);
}

function allowedOrigin(req) {
  const origin = req.headers.get('Origin') || '';
  const ok = ['https://theslowtide.pages.dev', 'https://theslowtidefk.pages.dev', 'http://localhost', 'http://127.0.0.1', 'null'];
  return ok.includes(origin) ? origin : '';
}
function corsHeaders(req) {
  const origin = allowedOrigin(req);
  return {
    'Access-Control-Allow-Origin': origin || 'https://theslowtide.pages.dev',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };
}
function json(obj, status, req) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
  });
}
function todayStr(d) {
  const dt = d || new Date();
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function clientIp(req) {
  return req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown';
}
async function proxyFetch(target, request) {
  const headers = new Headers(request.headers);
  headers.delete('host');
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
  const upstream = await fetch(target, { method: request.method, headers: headers, body: body, redirect: 'manual' });
  const respHeaders = new Headers(upstream.headers);
  respHeaders.set('Access-Control-Allow-Origin', allowedOrigin(request) || 'https://theslowtide.pages.dev');
  return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
}


let MEM_DATA = null, MEM_TS = 0, MEM_REFRESHING = null;


function cacheKeyOf(request) {
  const u = new URL(request.url);
  u.searchParams.delete('nocache');
  return new Request(u.toString(), { method: 'GET' });
}
function canUseEdgeCache(request) {
  return request.method === 'GET' && request.url.indexOf('nocache=1') < 0;
}
async function edgeGet(request) {
  try {
    const hit = await caches.default.match(cacheKeyOf(request));
    if (!hit) return null;
    const headers = new Headers(hit.headers);
    headers.set('X-Cache', 'HIT');
    return new Response(hit.body, { status: hit.status, headers: headers });
  } catch (e) { return null; }
}
async function edgeStore(ctx, request, upstream, ttl) {
  try {
    const text = await upstream.text();
    const headers = new Headers(upstream.headers);
    headers.set('Cache-Control', 'public, max-age=' + ttl + ', s-maxage=' + ttl);
    headers.set('X-Cache', 'MISS');
    const out = new Response(text, { status: upstream.status, headers: headers });
    if (upstream.status === 200 && ctx && ctx.waitUntil) {
      ctx.waitUntil(caches.default.put(cacheKeyOf(request), out.clone()).catch(function () {}));
    }
    return out;
  } catch (e) { return upstream; }
}

export async function onRequest(context) {
  if (context && context.env && context.env.ADMIN_PWD) ADMIN_PWD = context.env.ADMIN_PWD;
  if (context && context.env && context.env.ADMIN_PWD) ADMIN_PWD = context.env.ADMIN_PWD;
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(request) });
  }
  
  if (path === '/api/debug/verify' && request.method === 'POST') {
    let bd = {};
    try { bd = await request.json(); } catch (e) { bd = {}; }
    const code = String(bd.code || '').trim().toUpperCase();
    const feat = DEBUG_CODES[code];
    if (feat) return json({ ok: true, feature: feat }, 200, request);
    return json({ ok: false, error: 'bad_code' }, 200, request);
  }

  
  if (path === '/api/tst-status/push' && request.method === 'POST') {
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    const want = (context && context.env && context.env.TST_STATUS_TOKEN) || TST_TOKEN;
    if (String(bd.token || '') !== want) return json({ ok: false, error: 'bad_token' }, 403, request);
    const players = Array.isArray(bd.players) ? bd.players.slice(0, 64).map(function (p) {
      return {
        name: String((p && p.name) || '').slice(0, 32),
        uuid: String((p && p.uuid) || '').slice(0, 64),
        skin: (p && p.skin) ? String(p.skin).slice(0, 512) : null,
      };
    }).filter(function (p) { return p.name; }) : [];
    const rec = {
      name: String(bd.name || 'The Slow Tide').slice(0, 48),
      online: Number(bd.online) || 0,
      max: Number(bd.max) || 0,
      version: String(bd.version || '').slice(0, 32),
      tps: (typeof bd.tps === 'number') ? bd.tps : null,
      shutdown: !!bd.shutdown,
      players: players,
      perf: (bd.perf && typeof bd.perf === 'object') ? {
        tps1: num(bd.perf.tps1), tps5: num(bd.perf.tps5), tps15: num(bd.perf.tps15),
        mspt: num(bd.perf.mspt), mem: num(bd.perf.mem), memmax: num(bd.perf.memmax),
        chunks: num(bd.perf.chunks), entities: num(bd.perf.entities), uptime: num(bd.perf.uptime),
      } : null,
      receivedAt: Date.now(),
    };
    
    const isStatus = (typeof bd.online === 'number') || Array.isArray(bd.players);
    try {
      if (isStatus) {
        const tstKv = (context && context.env && context.env.SITE_CACHE) || null;
        if (tstKv) await tstKv.put(TST_KEY, JSON.stringify(rec), { expirationTtl: 3600 });
        else tstMemSet(rec);
      }
    } catch (e) {
      tstMemSet(rec);
      return json({ ok: false, error: 'kv_unavailable', receivedAt: rec.receivedAt }, 200, request);
    }
    
    try {
      const db = (context && context.env && context.env.TST_DB) || null;
      if (db) {
        const stmts = [];
        const p = bd.perf && typeof bd.perf === 'object' ? bd.perf : null;
        if (p) {
          stmts.push(db.prepare('INSERT INTO perf (ts,tps1,tps5,tps15,mspt,mem,memmax,online,maxp,chunks,entities,uptime) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
            .bind(rec.receivedAt / 1000 | 0, num(p.tps1), num(p.tps5), num(p.tps15), num(p.mspt), num(p.mem), num(p.memmax), num(rec.online), num(rec.max), num(p.chunks), num(p.entities), num(p.uptime)));
        }
        (Array.isArray(bd.chat) ? bd.chat.slice(-40) : []).forEach(function (c) {
          const nm = String((c && c.name) || '').slice(0, 32);
          const ms = String((c && c.msg) || '').slice(0, 200);
          if (nm && ms) stmts.push(db.prepare('INSERT INTO chat (ts,src,name,msg) VALUES (?,?,?,?)').bind(num(c.ts) || (rec.receivedAt / 1000 | 0), 'game', nm, ms));
        });
        (Array.isArray(bd.events) ? bd.events.slice(-20) : []).forEach(function (v) {
          stmts.push(db.prepare('INSERT INTO events (ts,kind,actor,detail) VALUES (?,?,?,?)')
            .bind(num(v.ts) || (rec.receivedAt / 1000 | 0), String(v.kind || 'misc').slice(0, 24), String(v.actor || '').slice(0, 32), String(v.detail || '').slice(0, 300)));
        });
        (Array.isArray(bd.logs) ? bd.logs.slice(-120) : []).forEach(function (l) {
          stmts.push(db.prepare('INSERT INTO logs (ts,lvl,src,body) VALUES (?,?,?,?)')
            .bind(num(l.ts) || (rec.receivedAt / 1000 | 0), String(l.lvl || 'INFO').slice(0, 8), String(l.src || '').slice(0, 40), String(l.body || '').slice(0, 500)));
        });
        (Array.isArray(bd.results) ? bd.results.slice(-10) : []).forEach(function (r) {
          stmts.push(db.prepare('INSERT INTO events (ts,kind,actor,detail) VALUES (?,?,?,?)')
            .bind(num(r.ts) || (rec.receivedAt / 1000 | 0), 'cmd', String(r.by || 'admin').slice(0, 32), ('$ ' + String(r.cmd || '').slice(0, 120) + ' → ' + String(r.out || r.error || 'ok').slice(0, 200))));
        });
        
        if (bd.cleanup) {
          const nowS = rec.receivedAt / 1000 | 0;
          stmts.push(db.prepare('DELETE FROM logs WHERE ts < ?').bind(nowS - 172800));
          stmts.push(db.prepare('DELETE FROM chat WHERE ts < ?').bind(nowS - 259200));
          stmts.push(db.prepare('DELETE FROM perf WHERE ts < ?').bind(nowS - 604800));
          stmts.push(db.prepare('DELETE FROM outbox WHERE state=1 AND ts < ?').bind(nowS - 86400));
        }
        if (stmts.length) await db.batch(stmts);
      }
    } catch (e) {
      return json({ ok: true, receivedAt: rec.receivedAt, dbNote: String(e && e.message || e).slice(0, 80) }, 200, request);
    }
    return json({ ok: true, receivedAt: rec.receivedAt }, 200, request);
  }

  if (path === '/api/tst-status/state') {
    let rec = null;
    try {
      const tstKv = (context && context.env && context.env.SITE_CACHE) || null;
      if (tstKv) {
        const raw = await tstKv.get(TST_KEY);
        if (raw) rec = JSON.parse(raw);
      }
    } catch (e) { rec = null; }
    if (!rec) rec = tstMemGet();
    const noStore = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
    if (!rec) {
      return new Response(JSON.stringify({ ok: true, online: false, reason: 'no_data' }), { status: 200, headers: { ...noStore, ...corsHeaders(request) } });
    }
    const age = Date.now() - (rec.receivedAt || 0);
    const online = !rec.shutdown && age < TST_STALE_MS;
    return new Response(JSON.stringify({
      ok: true,
      online: online,
      reason: online ? 'live' : (rec.shutdown ? 'shutdown' : 'stale'),
      onlineCount: online ? rec.online : 0,
      max: rec.max,
      version: rec.version,
      tps: rec.tps,
      players: online ? rec.players : [],
      perf: rec.perf || null,
      receivedAt: rec.receivedAt,
      ageMs: age,
      name: rec.name,
    }), { status: 200, headers: { ...noStore, ...corsHeaders(request) } });
  }

  
  const TST_DB = (context && context.env && context.env.TST_DB) || null;
  const tstPwd = function () { return (context && context.env && context.env.SITE_ADMIN_PWD) || ADMIN_PWD || ''; };
  const tstNowS = function () { return Math.floor(Date.now() / 1000); };
  async function tstIsAdmin(req2) {
    const pw = req2.headers.get('x-admin-pw') || '';
    if (pw && tstPwd() && pw === tstPwd()) return true;
    const tk = (req2.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!tk) return false;
    try {
      const r = await fetch('https://theslowtidefk.pages.dev/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk },
        body: JSON.stringify({ action: 'whoami' }),
      });
      const d = await r.json();
      return !!(d && d.ok && Number(d.admin_level || 0) >= 1);
    } catch (e) { return false; }
  }
  const TST_CMD_OK = ['say', 'tell', 'msg', 'broadcast', 'tps', 'list', 'time', 'weather', 'gamemode', 'tp', 'tphere', 'give', 'whitelist', 'kick', 'ban', 'unban', 'pardon', 'gamerule', 'save-all', 'save-off', 'save-on', 'difficulty', 'enchant', 'xp', 'effect', 'clear', 'spawnpoint', 'setworldspawn', 'title', 'playsound', 'seed', 'kickall'];
  function tstCmdAllowed(cmd) {
    const base = String(cmd || '').trim().replace(/^\//, '').split(/\s+/)[0].toLowerCase();
    return !!base && TST_CMD_OK.indexOf(base) >= 0;
  }

  
  if (path === '/api/chat/history' && request.method === 'GET') {
    if (!TST_DB) return json({ ok: false, error: 'no_db', messages: [] }, 200, request);
    const after = Number(url.searchParams.get('after') || 0) || 0;
    const before = Number(url.searchParams.get('before') || 0) || 0;
    const kw = String(url.searchParams.get('q') || '').trim().slice(0, 32);
    let rows = [];
    try {
      const q = kw
        ? TST_DB.prepare('SELECT id,ts,src,name,msg FROM chat WHERE name LIKE ? OR msg LIKE ? ORDER BY id DESC LIMIT 40').bind('%' + kw + '%', '%' + kw + '%')
        : before
          ? TST_DB.prepare('SELECT id,ts,src,name,msg FROM chat WHERE id<? ORDER BY id DESC LIMIT 40').bind(before)
          : after
            ? TST_DB.prepare('SELECT id,ts,src,name,msg FROM chat WHERE id>? ORDER BY id ASC LIMIT 60').bind(after)
            : TST_DB.prepare('SELECT id,ts,src,name,msg FROM chat ORDER BY id DESC LIMIT 40');
      const r = await q.all();
      rows = (r && r.results) || [];
      if (!after) rows = rows.slice().reverse();
    } catch (e) {
      return json({ ok: false, error: 'db_error', messages: [] }, 200, request);
    }
    const messages = rows.map(function (x) {
      return { id: x.id, ts: new Date((x.ts || 0) * 1000).toISOString(), sender: x.name, message: x.msg, kind: x.src === 'web' ? 'web' : 'game', src: x.src || 'game' };
    });
    return json({ ok: true, messages: messages }, 200, request);
  }

  
  if (path === '/api/chat/send' && request.method === 'POST') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    const msg = String(bd.message || '').trim().slice(0, 200);
    if (!msg) return json({ ok: false, error: 'empty' }, 200, request);
    const tk = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!tk) return json({ ok: false, error: 'login_required' }, 401, request);
    let nick = '';
    try {
      const r = await fetch('https://theslowtidefk.pages.dev/api/me', { headers: { 'Authorization': 'Bearer ' + tk } });
      const d = await r.json();
      if (d && d.ok) nick = String(d.nickname || (d.email || '').split('@')[0] || '').trim().slice(0, 24);
    } catch (e) { nick = ''; }
    if (!nick) return json({ ok: false, error: 'login_required' }, 401, request);
    const rl = globalThis.__TST_CHAT_RL || (globalThis.__TST_CHAT_RL = new Map());
    const ip = clientIp(request);
    const last = rl.get(ip) || 0;
    if (Date.now() - last < 8000) return json({ ok: false, error: 'too_fast' }, 429, request);
    rl.set(ip, Date.now());
    try {
      const now = tstNowS();
      await TST_DB.batch([
        TST_DB.prepare('INSERT INTO chat (ts,src,name,msg) VALUES (?,?,?,?)').bind(now, 'web', nick, msg),
        TST_DB.prepare('INSERT INTO outbox (ts,kind,payload,state) VALUES (?,?,?,0)').bind(now, 'chat', JSON.stringify({ name: nick, msg: msg })),
      ]);
      return json({ ok: true, sender: nick }, 200, request);
    } catch (e) {
      return json({ ok: false, error: 'db_error' }, 200, request);
    }
  }

  
  if (path === '/api/game/dm' && request.method === 'POST') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    const want = (context && context.env && context.env.TST_STATUS_TOKEN) || TST_TOKEN;
    if (String(bd.token || '') !== want) return json({ ok: false, error: 'bad_token' }, 403, request);
    const from = String(bd.from || '').trim().slice(0, 24);
    const to = String(bd.to || '').trim().slice(0, 24);
    const msg = String(bd.msg || '').trim().slice(0, 160);
    if (!from || !to || !msg) return json({ ok: false, error: 'empty' }, 200, request);
    try {
      await TST_DB.prepare('CREATE TABLE IF NOT EXISTS dm (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, from_name TEXT, to_name TEXT, msg TEXT)').run();
      await TST_DB.prepare('INSERT INTO dm (ts,from_name,to_name,msg) VALUES (?,?,?,?)')
        .bind(tstNowS(), from, to, msg).run();
      await TST_DB.prepare('CREATE TABLE IF NOT EXISTS mc_link (mc TEXT PRIMARY KEY, nickname TEXT, ts INTEGER)').run();
      await TST_DB.prepare('INSERT INTO mc_link (mc,nickname,ts) VALUES (?,?,?) ON CONFLICT(mc) DO UPDATE SET nickname=excluded.nickname, ts=excluded.ts')
        .bind(from, to, tstNowS()).run();
      return json({ ok: true, from: from, to: to }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  
  if (path === '/api/chat/dm' && request.method === 'POST') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    const to = String(bd.to || '').trim().slice(0, 24);
    const msg = String(bd.message || bd.msg || '').trim().slice(0, 160);
    if (!to || !msg) return json({ ok: false, error: 'empty' }, 200, request);
    const tk = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!tk) return json({ ok: false, error: 'login_required' }, 401, request);
    let nick = '';
    try {
      const r = await fetch('https://theslowtidefk.pages.dev/api/me', { headers: { 'Authorization': 'Bearer ' + tk } });
      const d = await r.json();
      if (d && d.ok) nick = String(d.nickname || (d.email || '').split('@')[0] || '').trim().slice(0, 24);
    } catch (e) { nick = ''; }
    if (!nick) return json({ ok: false, error: 'login_required' }, 401, request);
    if (to === nick) return json({ ok: false, error: 'self' }, 200, request);
    let mc = '';
    try {
      await TST_DB.prepare('CREATE TABLE IF NOT EXISTS mc_link (mc TEXT PRIMARY KEY, nickname TEXT, ts INTEGER)').run();
      const lk = await TST_DB.prepare('SELECT mc FROM mc_link WHERE nickname = ? COLLATE NOCASE LIMIT 1').bind(to).first();
      if (lk && lk.mc) mc = String(lk.mc).trim().slice(0, 16);
    } catch (e) { mc = ''; }

    try {
      await TST_DB.prepare('CREATE TABLE IF NOT EXISTS dm (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, from_name TEXT, to_name TEXT, msg TEXT)').run();
    } catch (e) {}
    try {
      const now = tstNowS();
      await TST_DB.batch([
        TST_DB.prepare('INSERT INTO dm (ts,from_name,to_name,msg) VALUES (?,?,?,?)').bind(now, nick, to, msg),
        TST_DB.prepare('INSERT INTO outbox (ts,kind,payload,state) VALUES (?,?,?,0)').bind(now, 'dm', JSON.stringify({ to: to, from: nick, msg: msg, mc: mc })),
      ]);
      return json({ ok: true, from: nick, to: to }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  
  if (path === '/api/chat/dm' && request.method === 'GET') {
    if (!TST_DB) return json({ ok: false, messages: [] }, 200, request);
    const tk = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!tk) return json({ ok: false, error: 'login_required' }, 401, request);
    let nick = '';
    try {
      const r = await fetch('https://theslowtidefk.pages.dev/api/me', { headers: { 'Authorization': 'Bearer ' + tk } });
      const d = await r.json();
      if (d && d.ok) nick = String(d.nickname || (d.email || '').split('@')[0] || '').trim().slice(0, 24);
    } catch (e) {}
    if (!nick) return json({ ok: false, error: 'login_required' }, 401, request);
    const withName = String(url.searchParams.get('with') || '').trim().slice(0, 24);
    if (!withName) return json({ ok: false, error: 'need_with' }, 200, request);
    let rows = [];
    try {
      await TST_DB.prepare('CREATE TABLE IF NOT EXISTS dm (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, from_name TEXT, to_name TEXT, msg TEXT)').run();
      const r = await TST_DB.prepare("SELECT id,ts,from_name,to_name,msg FROM dm WHERE (from_name=? AND to_name=?) OR (from_name=? AND to_name=?) ORDER BY id DESC LIMIT 50")
        .bind(nick, withName, withName, nick).all();
      rows = ((r && r.results) || []).slice().reverse();
    } catch (e) {}
    return json({ ok: true, me: nick, messages: rows.map(function (x) {
      return { id: x.id, ts: new Date((x.ts || 0) * 1000).toISOString(), from: x.from_name, to: x.to_name, from_name: x.from_name, to_name: x.to_name, message: x.msg, msg: x.msg };
    }) }, 200, request);
  }

  
  if (path === '/api/chat/report' && request.method === 'POST') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    const target = String(bd.target || '').trim().slice(0, 24);
    const reason = String(bd.reason || '').slice(0, 100);
    if (!target) return json({ ok: false, error: 'need_target' }, 200, request);
    const tk = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    let by = '';
    try {
      const r = await fetch('https://theslowtidefk.pages.dev/api/me', { headers: { 'Authorization': 'Bearer ' + tk } });
      const d = await r.json();
      if (d && d.ok) by = String(d.nickname || (d.email || '').split('@')[0] || '').trim().slice(0, 24);
    } catch (e) { by = ''; }
    if (!by) return json({ ok: false, error: 'login_required' }, 401, request);
    try {
      await TST_DB.prepare('CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, by_name TEXT, target TEXT, reason TEXT, snapshot TEXT)').run();
    } catch (e) {}
    let snap = [];
    try {
      const r = await TST_DB.prepare('SELECT ts,src,name,msg FROM chat WHERE name=? ORDER BY id DESC LIMIT 30').bind(target).all();
      snap = ((r && r.results) || []).slice().reverse();
    } catch (e) {}
    try {
      await TST_DB.prepare('INSERT INTO reports (ts,by_name,target,reason,snapshot) VALUES (?,?,?,?,?)')
        .bind(tstNowS(), by, target, reason, JSON.stringify(snap)).run();
      return json({ ok: true }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  
  if (path === '/api/reports/list' && request.method === 'GET') {
    if (!TST_DB) return json({ ok: false, reports: [] }, 200, request);
    if (String(request.headers.get('x-admin-pw') || '') !== tstPwd() || !tstPwd()) return json({ ok: false, error: 'forbidden' }, 403, request);
    const delId = Number(url.searchParams.get('del') || 0);
    if (delId > 0) {
      try { await TST_DB.prepare('DELETE FROM reports WHERE id=?').bind(delId).run(); } catch (e) {}
    }
    try {
      const r = await TST_DB.prepare('SELECT id,ts,by_name,target,reason,snapshot FROM reports ORDER BY id DESC LIMIT 50').all();
      return json({ ok: true, reports: ((r && r.results) || []) }, 200, request);
    } catch (e) { return json({ ok: false, reports: [] }, 200, request); }
  }

  
  if (path === '/api/chat/cmd' && request.method === 'POST') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    if (String(bd.pw || '') !== tstPwd() || !tstPwd()) return json({ ok: false, error: 'wrong_password' }, 200, request);
    const cmd = String(bd.cmd || '').trim().slice(0, 200);
    if (!cmd) return json({ ok: false, error: 'empty' }, 200, request);
    if (!tstCmdAllowed(cmd)) return json({ ok: false, error: 'command_blocked' }, 200, request);
    try {
      await TST_DB.prepare('INSERT INTO outbox (ts,kind,payload,state) VALUES (?,?,?,0)')
        .bind(tstNowS(), 'cmd', JSON.stringify({ cmd: cmd, by: '官网管理员' })).run();
    } catch (e) {
      return json({ ok: false, error: 'db_error' }, 200, request);
    }
    return json({ ok: true }, 200, request);
  }

  
  if (path === '/api/tst-cmd/send' && request.method === 'POST') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    if (!(await tstIsAdmin(request))) return json({ ok: false, error: 'forbidden' }, 403, request);
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    const cmd = String(bd.cmd || '').trim().slice(0, 200);
    if (!cmd) return json({ ok: false, error: 'empty' }, 200, request);
    if (!tstCmdAllowed(cmd)) return json({ ok: false, error: 'command_blocked' }, 200, request);
    try {
      await TST_DB.prepare('INSERT INTO outbox (ts,kind,payload,state) VALUES (?,?,?,0)')
        .bind(tstNowS(), 'cmd', JSON.stringify({ cmd: cmd, by: '控制台' })).run();
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
    return json({ ok: true }, 200, request);
  }

  
  if (path === '/api/tst-task/pull' && request.method === 'GET') {
    const want = (context && context.env && context.env.TST_STATUS_TOKEN) || TST_TOKEN;
    if (String(url.searchParams.get('token') || '') !== want) return json({ ok: false, error: 'bad_token' }, 403, request);
    if (!TST_DB) return json({ ok: false, error: 'no_db', tasks: [] }, 200, request);
    let rows = [];
    try {
      const r = await TST_DB.prepare('SELECT id,kind,payload FROM outbox WHERE state=0 ORDER BY id ASC LIMIT 20').all();
      rows = (r && r.results) || [];
      if (rows.length) {
        const ids = rows.map(function (x) { return x.id; });
        await TST_DB.prepare('UPDATE outbox SET state=1 WHERE id IN (' + ids.join(',') + ')').run();
      }
    } catch (e) { return json({ ok: false, error: 'db_error', tasks: [] }, 200, request); }
    const tasks = rows.map(function (x) {
      let p = {};
      try { p = JSON.parse(x.payload || '{}'); } catch (e) { p = {}; }
      return { id: x.id, kind: x.kind, data: p };
    });
    
    if (String(url.searchParams.get('fmt') || '') === 'line') {
      const b64 = function (s) { return btoa(unescape(encodeURIComponent(String(s == null ? '' : s)))); };
      const lines = tasks.map(function (t) {
        if (t.kind === 'chat') return t.id + '\tchat\t' + b64(t.data.name || '官网') + '\t' + b64(t.data.msg || '');
        if (t.kind === 'dm') return t.id + '\tdm\t' + b64(t.data.to || '') + '\t' + b64(t.data.from || '官网') + '\t' + b64(t.data.msg || '') + '\t' + b64(t.data.mc || '');
        return t.id + '\tcmd\t' + b64(t.data.cmd || '') + '\t' + b64(t.data.by || 'admin');
      });
      return new Response(lines.join('\n'), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': allowedOrigin(request) || 'https://theslowtide.pages.dev' },
      });
    }
    return json({ ok: true, tasks: tasks }, 200, request);
  }

  
  if (path === '/api/tst-perf/history' && request.method === 'GET') {
    if (!TST_DB) return json({ ok: false, error: 'no_db', points: [] }, 200, request);
    const hours = Math.min(168, Math.max(1, Number(url.searchParams.get('hours') || 24)));
    const since = tstNowS() - hours * 3600;
    let rows = [];
    try {
      const r = await TST_DB.prepare('SELECT ts,tps1,tps5,tps15,mspt,mem,memmax,online,maxp,chunks,entities,uptime FROM perf WHERE ts>=? ORDER BY ts ASC LIMIT 600').bind(since).all();
      rows = (r && r.results) || [];
    } catch (e) { return json({ ok: false, error: 'db_error', points: [] }, 200, request); }
    return json({ ok: true, points: rows, hours: hours }, 200, request);
  }

  
  if (path === '/api/tst-log/list' && request.method === 'GET') {
    if (!TST_DB) return json({ ok: false, error: 'no_db', logs: [] }, 200, request);
    if (!(await tstIsAdmin(request))) return json({ ok: false, error: 'forbidden', logs: [] }, 403, request);
    const lvl = String(url.searchParams.get('level') || '').toUpperCase().slice(0, 8);
    const q = String(url.searchParams.get('q') || '').slice(0, 60);
    const limit = Math.min(2000, Math.max(20, Number(url.searchParams.get('limit') || 300)));
    let rows = [];
    try {
      let sql = 'SELECT ts,lvl,src,body FROM logs';
      const cond = [];
      if (lvl === 'WARN' || lvl === 'ERROR' || lvl === 'INFO') cond.push('lvl=?');
      if (q) cond.push('body LIKE ?');
      if (cond.length) sql += ' WHERE ' + cond.join(' AND ');
      sql += ' ORDER BY id DESC LIMIT ' + limit;
      const stmt = TST_DB.prepare(sql);
      const binds = [];
      if (lvl === 'WARN' || lvl === 'ERROR' || lvl === 'INFO') binds.push(lvl);
      if (q) binds.push('%' + q + '%');
      const r = await (binds.length ? stmt.bind.apply(stmt, binds) : stmt).all();
      rows = (r && r.results) || [];
    } catch (e) { return json({ ok: false, error: 'db_error', logs: [] }, 200, request); }
    return json({ ok: true, logs: rows }, 200, request);
  }

  
  if (path === '/api/tst-events/list' && request.method === 'GET') {
    if (!TST_DB) return json({ ok: false, error: 'no_db', events: [] }, 200, request);
    const limit = Math.min(200, Math.max(5, Number(url.searchParams.get('limit') || 60)));
    let rows = [];
    try {
      const r = await TST_DB.prepare('SELECT ts,kind,actor,detail FROM events ORDER BY id DESC LIMIT ' + limit).all();
      rows = (r && r.results) || [];
    } catch (e) { return json({ ok: false, error: 'db_error', events: [] }, 200, request); }
    return json({ ok: true, events: rows }, 200, request);
  }

  
  if (path === '/api/server-status' && request.method === 'GET') {
    let st = null;
    try {
      const kv = context.env && context.env.SITE_CACHE;
      if (kv) { const raw = await kv.get(TST_KEY); if (raw) st = JSON.parse(raw); }
    } catch (e) { st = null; }
    if (!st) st = tstMemGet();
    if (!st) return json({ ok: false, status: 'offline' }, 200, request);
    const age = Date.now() - (st.receivedAt || 0);
    const on = !st.shutdown && age < TST_STALE_MS;
    return json({ ok: true, status: on ? 'online' : 'offline', online: on ? st.online : 0, max: st.max, tps: st.tps, latency: 0, ts: new Date(st.receivedAt || Date.now()).toISOString(), players: on && Array.isArray(st.players) ? st.players.map(function (x) { return String((x && x.name) || ''); }).filter(Boolean) : [] }, 200, request);
  }

  
  if (path === '/api/lottery/state' && request.method === 'GET') {
    const now = new Date();
    const sdate = cnDate(now);
    const ip = clientIp(request);
    const device = String(url.searchParams.get('device') || '').slice(0, 80);
    const dkey = 'dev:' + device + ':' + sdate;
    const ikey = 'ip:' + ip + ':' + sdate;
    const rec = (device && DRAW_DEV_MAP.get(dkey)) || DRAW_IP_MAP.get(ikey) || null;
    const codes = await fetchUnclaimedCodes();
    return json({
      drawn: !!rec,
      prize: rec ? rec.prize : null,
      code: rec ? rec.code : null,
      seq: rec ? rec.seq : null,
      serverDate: sdate,
      open: now >= L_START && now <= L_END,
      startAt: L_START.toISOString(),
      endAt: L_END.toISOString(),
      remaining: Array.isArray(codes) ? codes.length : 0,
    }, 200, request);
  }

  
  if (path === '/api/lottery/draw' && request.method === 'POST') {
    const now = new Date();
    const sdate = cnDate(now);
    if (now < L_START || now > L_END) {
      return json({ ok: false, error: 'not_in_window', serverDate: sdate }, 200, request);
    }
    let body = {};
    try { body = await request.json(); } catch (e) { body = {}; }
    const device = String(body.p_device || '').slice(0, 80);
    if (!device) return json({ ok: false, error: 'bad_device', serverDate: sdate }, 200, request);
    const ip = clientIp(request);
    const dkey = 'dev:' + device + ':' + sdate;
    const ikey = 'ip:' + ip + ':' + sdate;
    const rec = DRAW_DEV_MAP.get(dkey) || DRAW_IP_MAP.get(ikey);
    if (rec) {
      return json({ ok: false, error: 'already_drawn', prize: rec.prize, code: rec.code, seq: rec.seq, serverDate: sdate }, 200, request);
    }
    
    let codes = await fetchUnclaimedCodes();
    if (!codes || codes.length === 0) {
      return json({ ok: false, error: 'sold_out', serverDate: sdate }, 200, request);
    }
    
    let picked = null;
    for (let i = 0; i < 6; i++) {
      const c = pickWeighted(codes);
      const claimed = await claimCode(c.id, c.prize, device, now);
      if (claimed) { picked = c; break; }
      codes = await fetchUnclaimedCodes();
      if (!codes || codes.length === 0) break;
    }
    if (!picked) {
      return json({ ok: false, error: 'sold_out', serverDate: sdate }, 200, request);
    }
    const recInfo = { prize: picked.prize, code: picked.code, seq: picked.seq };
    DRAW_DEV_MAP.set(dkey, recInfo);
    DRAW_IP_MAP.set(ikey, recInfo);
    return json({ ok: true, ...recInfo, serverDate: sdate }, 200, request);
  }


  
  function dedupeSiteData(obj) {
    if (!obj) return obj;
    function clean(list) {
      if (!Array.isArray(list)) return list;
      var seen = {}, out = [];
      list.forEach(function (x) {
        if (!x) return;
        var k = String(x.id || '') + '|' + String(x.title || '') + '|' + String(x.date || x.created_at || '');
        if (!seen[k]) { seen[k] = 1; out.push(x); }
      });
      return out;
    }
    if (Array.isArray(obj.announcements)) obj.announcements = clean(obj.announcements);
    if (Array.isArray(obj.feeds)) obj.feeds = clean(obj.feeds);
    return obj;
  }

  
  if (path === '/api/data' || path.startsWith('/api/data/')) {
    if (request.method !== 'GET') return proxyFetch(DATA_ORIGIN + '/api/data' + url.search, request);
    const useEdge = canUseEdgeCache(request);
    if (useEdge) {
      const hit = await edgeGet(request);
      if (hit) return hit;
    }
    const baseHead = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigin(request) || 'https://theslowtide.pages.dev' };
    const kv = (context && context.env && context.env.SITE_CACHE) || null;
    let stale = null, staleAge = 1e9, src = 'MEM';
    
    if (MEM_DATA) { stale = MEM_DATA; staleAge = Date.now() - MEM_TS; }
    if (!stale && kv) {
      try {
        const r = await kv.getWithMetadata('site_data_v1', 'text');
        if (r && r.value) {
          const ts = Number((r.metadata && r.metadata.ts) || 0);
          stale = r.value;
          staleAge = ts ? (Date.now() - ts) : 1e9;
          src = 'KV';
          MEM_DATA = stale; MEM_TS = Date.now() - staleAge;
        }
      } catch (e) {}
    }
    function refresh() {
      if (MEM_REFRESHING) return MEM_REFRESHING;
      MEM_REFRESHING = (async function () {
      try {
      const up = await proxyFetch(DATA_ORIGIN + '/api/data' + url.search, request);
      let text = null;
      try {
        const raw = await up.clone().text();
        const obj = dedupeSiteData(JSON.parse(raw));
        if (obj && Array.isArray(obj.feeds)) {
          obj.feeds = obj.feeds.map(function (f) {
            if (!f) return f;
            var img = String(f.image || '');
            if (/^data:image/i.test(img)) { f.image = ''; }
            var c = String(f.content || '');
            c = c.replace(/<img[^>]*src=["']data:image[^"']*["'][^>]*>/gi, '');
            c = c.replace(/data:image\\?\s*\/?[^"'\s,;]{10,}/gi, '');
            if (c.length > 6000) c = c.slice(0, 6000);
            f.content = c;
            return f;
          });
        }
        text = JSON.stringify(obj);
      } catch (e) {}
      if (text === null) text = await up.text();
      MEM_DATA = text; MEM_TS = Date.now();
      if (kv) {
        try { await kv.put('site_data_v1', text, { expirationTtl: 1800, metadata: { ts: Date.now() } }); } catch (e) {}
      }
      return text;
      } finally { MEM_REFRESHING = null; }
      })();
      MEM_REFRESHING.catch(function () { MEM_REFRESHING = null; });
      return MEM_REFRESHING;
    }
    function wrap(text, tag, ttl) {
      const headers = new Headers(baseHead);
      headers.set('Cache-Control', 'public, max-age=30, s-maxage=' + ttl);
      headers.set('X-Cache', tag);
      return new Response(text, { status: 200, headers: headers });
    }
    if (stale) {
      
      if (staleAge > 1200 && context.waitUntil) context.waitUntil(refresh().catch(function () {}));
      const resp = wrap(stale, staleAge > 1200 ? 'STALE' : src, 60);
      if (useEdge && staleAge <= 1200 && context.waitUntil) {
        context.waitUntil(caches.default.put(cacheKeyOf(request), resp.clone()).catch(function () {}));
      }
      return resp;
    }
    try {
      const text = await refresh();
      const resp = wrap(text, 'MISS', 60);
      if (useEdge && context.waitUntil) {
        context.waitUntil(caches.default.put(cacheKeyOf(request), resp.clone()).catch(function () {}));
      }
      return resp;
    } catch (e) {
      return json({ ok: false, error: 'data_unavailable' }, 503, request);
    }
  }

  const PUSH_KEY = (context && context.env && context.env.TST_STATUS_TOKEN) || TST_TOKEN;
  function pushAllowed(request) {
    const k = String(request.headers.get('x-tst-key') || '');
    return !!k && k === PUSH_KEY;
  }
  async function ensureFeatureTables(db) {
    if (!db) return false;
    if (globalThis.__TST_FT_OK) return true;
    try {
      await db.batch([
        db.prepare('CREATE TABLE IF NOT EXISTS p3d (mc TEXT PRIMARY KEY, online_min INTEGER, deaths INTEGER, coins INTEGER, inv TEXT, armor TEXT, ts INTEGER)'),
        db.prepare('CREATE TABLE IF NOT EXISTS mkt_coin (mc TEXT PRIMARY KEY, bal INTEGER, ts INTEGER)'),
        db.prepare('CREATE TABLE IF NOT EXISTS mkt_price (item TEXT PRIMARY KEY, buy INTEGER, prev INTEGER, day TEXT, ts INTEGER)'),
        db.prepare('CREATE TABLE IF NOT EXISTS mkt_bet (id INTEGER PRIMARY KEY AUTOINCREMENT, mc TEXT, item TEXT, dir TEXT, stake INTEGER, price INTEGER, day TEXT, ts INTEGER)'),
        db.prepare('CREATE TABLE IF NOT EXISTS th_post (id INTEGER PRIMARY KEY AUTOINCREMENT, nick TEXT, content TEXT, likes INTEGER, ts INTEGER)'),
        db.prepare('CREATE TABLE IF NOT EXISTS th_like (ip TEXT, pid INTEGER)'),
        db.prepare('CREATE TABLE IF NOT EXISTS appeals (id INTEGER PRIMARY KEY AUTOINCREMENT, nick TEXT, mc TEXT, content TEXT, ban_reason TEXT, status TEXT, reply TEXT, ts INTEGER)'),
        db.prepare('CREATE TABLE IF NOT EXISTS rpt (ym TEXT, mc TEXT, online_min INTEGER, deaths INTEGER, coins_in INTEGER, coins_out INTEGER, top_item TEXT, wealth_rank INTEGER, ts INTEGER, PRIMARY KEY(ym, mc))'),
      ]);
      globalThis.__TST_FT_OK = true;
      return true;
    } catch (e) { return false; }
  }
  async function webNick(request) {
    const tk = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!tk) return '';
    try {
      const r = await fetch('https://theslowtidefk.pages.dev/api/me', { headers: { 'Authorization': 'Bearer ' + tk } });
      const d = await r.json();
      if (d && d.ok) return String(d.nickname || (d.email || '').split('@')[0] || '').trim().slice(0, 24);
    } catch (e) {}
    return '';
  }

  const SERVER_KEY = (context && context.env && context.env.TST_STATUS_TOKEN) || TST_TOKEN;
  function serverAllowed(request) {
    const k = String(request.headers.get('x-server-token') || '');
    return !!k && (k === TST_TOKEN || k === SERVER_KEY);
  }
  async function ensureBindTables(db) {
    try {
      await db.batch([
        db.prepare('CREATE TABLE IF NOT EXISTS bind_code (code TEXT PRIMARY KEY, nickname TEXT, created_at INTEGER, used INTEGER)'),
        db.prepare('CREATE TABLE IF NOT EXISTS bind_link (nickname TEXT PRIMARY KEY COLLATE NOCASE, uuid TEXT, mc TEXT, bound_at INTEGER)'),
      ]);
      return true;
    } catch (e) { return false; }
  }

  if (path === '/api/tst/game/bind/code' && request.method === 'POST') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    const nick = await webNick(request);
    if (!nick) return json({ ok: false, error: 'login_required' }, 401, request);
    if (!await ensureBindTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    const now = tstNowS();
    try {
      const linked = await TST_DB.prepare('SELECT nickname,uuid,mc,bound_at FROM bind_link WHERE nickname=? COLLATE NOCASE').bind(nick).first();
      if (linked && linked.mc) return json({ ok: true, code: '', bound: true, mc: linked.mc, uuid: linked.uuid || '', message: '这个账号已经绑定了角色' }, 200, request);
      const old = await TST_DB.prepare('SELECT code,created_at FROM bind_code WHERE nickname=? COLLATE NOCASE AND used=0 AND created_at>=? ORDER BY created_at DESC LIMIT 1').bind(nick, now - 600).first();
      if (old) return json({ ok: true, code: old.code, bound: false, expires_in: Math.max(60, 600 - (now - Number(old.created_at))), command: '/bind ' + old.code }, 200, request);
    } catch (e) {}
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    try {
      await TST_DB.prepare('DELETE FROM bind_code WHERE created_at < ?').bind(now - 3600).run();
      await TST_DB.prepare('INSERT INTO bind_code (code,nickname,created_at,used) VALUES (?,?,?,0)').bind(code, nick, now).run();
      return json({ ok: true, code: code, bound: false, expires_in: 600, nickname: nick, command: '/bind ' + code }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/tst/game/bind/status' && request.method === 'GET') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    const nick = await webNick(request);
    if (!nick) return json({ ok: false, error: 'login_required' }, 401, request);
    if (!await ensureBindTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    try {
      const row = await TST_DB.prepare('SELECT nickname,uuid,mc,bound_at FROM bind_link WHERE nickname=? COLLATE NOCASE').bind(nick).first();
      if (!row || !row.mc) return json({ ok: true, bound: false, nickname: nick }, 200, request);
      return json({ ok: true, bound: true, nickname: nick, mc: row.mc, uuid: row.uuid || '', bound_at: Number(row.bound_at) || 0 }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/tst/game/bind' && request.method === 'POST') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    if (!serverAllowed(request)) return json({ ok: false, error: 'bad_token' }, 403, request);
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    const code = String(bd.code || '').trim().toUpperCase().slice(0, 16);
    const uuid = String(bd.uuid || '').trim().slice(0, 64);
    const name = String(bd.name || '').trim().slice(0, 32);
    if (!code || !uuid || !name) return json({ ok: false, error: 'bad_params' }, 200, request);
    if (!await ensureBindTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    try {
      const rec = await TST_DB.prepare('SELECT code,nickname,created_at,used FROM bind_code WHERE code=?').bind(code).first();
      if (!rec || Number(rec.used) || (tstNowS() - Number(rec.created_at)) > 900) {
        return json({ ok: false, error: 'code_invalid', message: '验证码无效或已过期' }, 404, request);
      }
      const sameUser = await TST_DB.prepare('SELECT nickname,uuid,mc FROM bind_link WHERE nickname=? COLLATE NOCASE').bind(rec.nickname).first();
      if (sameUser && sameUser.uuid && String(sameUser.uuid) !== uuid) {
        return json({ ok: false, error: 'already_bound', message: '该官网账号已经绑定了另一个游戏角色' }, 409, request);
      }
      const sameUuid = await TST_DB.prepare('SELECT nickname,uuid,mc FROM bind_link WHERE uuid=?').bind(uuid).first();
      if (sameUuid && String(sameUuid.nickname).toLowerCase() !== String(rec.nickname).toLowerCase()) {
        return json({ ok: false, error: 'mc_bound_other', message: '该游戏角色已经绑定了另一个官网账号' }, 409, request);
      }
      await TST_DB.batch([
        TST_DB.prepare('INSERT INTO bind_link (nickname,uuid,mc,bound_at) VALUES (?,?,?,?) ON CONFLICT(nickname) DO UPDATE SET uuid=excluded.uuid, mc=excluded.mc, bound_at=excluded.bound_at').bind(rec.nickname, uuid, name, tstNowS()),
        TST_DB.prepare('UPDATE bind_code SET used=1 WHERE code=?').bind(code),
      ]);
      return json({ ok: true, binding: { user_id: rec.nickname, username: rec.nickname, display_name: rec.nickname, mc: name, uuid: uuid } }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/tst/game/bind' && request.method === 'GET') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    if (!serverAllowed(request)) return json({ ok: false, error: 'bad_token' }, 403, request);
    const uuid = String(url.searchParams.get('uuid') || '').trim().slice(0, 64);
    const name = String(url.searchParams.get('name') || '').trim().slice(0, 32);
    if (!uuid && !name) return json({ ok: false, error: 'bad_params' }, 200, request);
    if (!await ensureBindTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    try {
      const row = uuid
        ? await TST_DB.prepare('SELECT nickname,uuid,mc,bound_at FROM bind_link WHERE uuid=?').bind(uuid).first()
        : await TST_DB.prepare('SELECT nickname,uuid,mc,bound_at FROM bind_link WHERE mc=? COLLATE NOCASE').bind(name).first();
      if (!row) return json({ ok: false, error: 'not_bound' }, 404, request);
      return json({ ok: true, ready: true, binding: { user_id: row.nickname, username: row.nickname, display_name: row.nickname, mc: row.mc, uuid: row.uuid, bound_at: Number(row.bound_at) || 0 } }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/player3d/push' && request.method === 'POST') {
    if (!pushAllowed(request)) return json({ ok: false, error: 'bad_token' }, 403, request);
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    if (!await ensureFeatureTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    const now = tstNowS();
    const list = Array.isArray(bd.players) ? bd.players.slice(0, 200) : [];
    const stmts = [];
    for (const p of list) {
      const mc = String((p && p.mc) || '').slice(0, 32);
      if (!mc) continue;
      const om = Math.max(0, Math.min(52560000, Math.round(num(p.online_min) || 0)));
      const dt = Math.max(0, Math.round(num(p.deaths) || 0));
      const coins = Math.round(num(p.coins) || 0);
      const inv = p.inventory ? JSON.stringify(p.inventory).slice(0, 2000) : null;
      const armor = p.armor ? JSON.stringify(p.armor).slice(0, 800) : null;
      stmts.push(TST_DB.prepare('INSERT INTO p3d (mc,online_min,deaths,coins,inv,armor,ts) VALUES (?,?,?,?,?,?,?) ON CONFLICT(mc) DO UPDATE SET online_min=excluded.online_min, deaths=excluded.deaths, coins=excluded.coins, inv=COALESCE(excluded.inv,p3d.inv), armor=COALESCE(excluded.armor,p3d.armor), ts=excluded.ts').bind(mc, om, dt, coins, inv, armor, now));
    }
    if (!stmts.length) return json({ ok: true, saved: 0 }, 200, request);
    try {
      await TST_DB.batch(stmts);
      return json({ ok: true, saved: stmts.length }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/rank/top' && request.method === 'GET') {
    if (!TST_DB) return json({ ok: true, rows: [], total: 0 }, 200, request);
    if (!await ensureFeatureTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    const metric = ['online', 'deaths', 'coins'].includes(url.searchParams.get('metric')) ? url.searchParams.get('metric') : 'online';
    const col = metric === 'deaths' ? 'deaths' : (metric === 'coins' ? 'coins' : 'online_min');
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '30', 10) || 30));
    try {
      const rows = await TST_DB.prepare('SELECT mc,online_min,deaths,coins,' + col + ' AS value,ts FROM p3d WHERE ' + col + ' > 0 ORDER BY ' + col + ' DESC, ts DESC LIMIT ?').bind(limit).all();
      const cnt = await TST_DB.prepare('SELECT COUNT(*) AS c FROM p3d WHERE ' + col + ' > 0').first();
      let mine = null;
      const nick = await webNick(request);
      if (nick) {
        try {
          const row = await TST_DB.prepare('SELECT mc,online_min,deaths,coins,' + col + ' AS value,ts FROM p3d WHERE mc=? COLLATE NOCASE').bind(nick).first();
          if (row) {
            const above = await TST_DB.prepare('SELECT COUNT(*) AS c FROM p3d WHERE ' + col + ' > ?').bind(Number(row.value) || 0).first();
            mine = { mc: row.mc, value: Number(row.value) || 0, rank: Number((above && above.c) || 0) + 1, total: Number((cnt && cnt.c) || 0), online_min: Number(row.online_min) || 0, coins: Number(row.coins) || 0, deaths: Number(row.deaths) || 0 };
          }
        } catch (e) {}
      }
      return json({ ok: true, metric: metric, rows: ((rows && rows.results) || []).map(function (r) { return { mc: r.mc, value: Number(r.value) || 0, online_min: Number(r.online_min) || 0, coins: Number(r.coins) || 0, deaths: Number(r.deaths) || 0, ts: Number(r.ts) || 0 }; }), mine: mine, total: Number((cnt && cnt.c) || 0), ts: tstNowS() }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/rank/player' && request.method === 'GET') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    if (!await ensureFeatureTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    const metric = ['online', 'deaths', 'coins'].includes(url.searchParams.get('metric')) ? url.searchParams.get('metric') : 'online';
    const col = metric === 'deaths' ? 'deaths' : (metric === 'coins' ? 'coins' : 'online_min');
    const name = String(url.searchParams.get('name') || url.searchParams.get('mc') || '').trim().slice(0, 32);
    if (!name) return json({ ok: false, error: 'bad_name' }, 200, request);
    try {
      const row = await TST_DB.prepare('SELECT mc,' + col + ' AS value,ts,coins,deaths,online_min,inv,armor FROM p3d WHERE mc=? COLLATE NOCASE').bind(name).first();
      if (!row) return json({ ok: false, error: 'not_found' }, 200, request);
      const above = await TST_DB.prepare('SELECT COUNT(*) AS c FROM p3d WHERE ' + col + ' > ?').bind(Number(row.value) || 0).first();
      const cnt = await TST_DB.prepare('SELECT COUNT(*) AS c FROM p3d WHERE ' + col + ' > 0').first();
      const rank = Number((above && above.c) || 0) + 1;
      const total = Number((cnt && cnt.c) || 0);
      const stats = { mc: row.mc, value: Number(row.value) || 0, ts: Number(row.ts) || 0, rank: rank, total: total, coins: Number(row.coins) || 0, deaths: Number(row.deaths) || 0, online_min: Number(row.online_min) || 0, inv: row.inv || '', armor: row.armor || '' };
      return json({ ok: true, ready: true, metric: metric, snapshot: Object.assign({}, stats, { rank_online: rank }), player: stats }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/market/coin' && request.method === 'POST') {
    if (!pushAllowed(request)) return json({ ok: false, error: 'bad_token' }, 403, request);
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    if (!await ensureFeatureTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    const now = tstNowS();
    const stmts = [];
    const list = Array.isArray(bd.players) ? bd.players.slice(0, 200) : [];
    for (const p of list) {
      const mc = String((p && p.mc) || '').slice(0, 32);
      if (!mc) continue;
      const bal = Math.round(num(p.balance) || 0);
      stmts.push(TST_DB.prepare('INSERT INTO mkt_coin (mc,bal,ts) VALUES (?,?,?) ON CONFLICT(mc) DO UPDATE SET bal=excluded.bal, ts=excluded.ts').bind(mc, bal, now));
    }
    if (!stmts.length) return json({ ok: true, saved: 0 }, 200, request);
    try {
      await TST_DB.batch(stmts);
      return json({ ok: true, saved: stmts.length }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/market/push' && request.method === 'POST') {
    if (!pushAllowed(request)) return json({ ok: false, error: 'bad_token' }, 403, request);
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    if (!await ensureFeatureTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    const day = todayStr();
    const now = tstNowS();
    const list = Array.isArray(bd.items) ? bd.items.slice(0, 60) : [];
    const stmts = [];
    for (const it of list) {
      const item = String((it && it.item) || '').trim().slice(0, 40);
      const buy = Math.round(num(it && it.buy) || 0);
      if (!item || buy <= 0) continue;
      stmts.push(TST_DB.prepare('INSERT INTO mkt_price (item,buy,prev,day,ts) VALUES (?,?,?,?,?) ON CONFLICT(item) DO UPDATE SET prev=CASE WHEN mkt_price.day=? THEN mkt_price.prev ELSE mkt_price.buy END, buy=excluded.buy, day=excluded.day, ts=excluded.ts').bind(item, buy, buy, day, now, day));
    }
    if (!stmts.length) return json({ ok: true, saved: 0 }, 200, request);
    try {
      await TST_DB.batch(stmts);
      return json({ ok: true, saved: stmts.length, day: day }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/market/state' && request.method === 'GET') {
    if (!TST_DB) return json({ ok: true, focus: '', items: [], bets: [], balance: null }, 200, request);
    if (!await ensureFeatureTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    const want = String(url.searchParams.get('item') || '').trim();
    try {
      const rows = await TST_DB.prepare('SELECT item,buy,prev FROM mkt_price ORDER BY item ASC LIMIT 60').all();
      const items = ((rows && rows.results) || []).map(function (r) {
        const buy = Number(r.buy) || 0;
        const prev = Number(r.prev) || buy;
        const change = prev > 0 ? Math.round(((buy - prev) / prev) * 1000) / 10 : 0;
        return { item: r.item, buy: buy, change: change };
      });
      let focus = '';
      if (want) { for (const it of items) if (it.item === want) focus = want; }
      if (!focus && items.length) focus = items[0].item;
      let balance = null;
      const nick = await webNick(request);
      if (nick) {
        const c = await TST_DB.prepare('SELECT bal FROM mkt_coin WHERE mc=? COLLATE NOCASE').bind(nick).first();
        if (c) balance = Number(c.bal) || 0;
      }
      let bets = [];
      if (nick) {
        const b = await TST_DB.prepare('SELECT id,item,dir,stake,price,day,ts FROM mkt_bet WHERE mc=? COLLATE NOCASE ORDER BY id DESC LIMIT 20').bind(nick).all();
        bets = ((b && b.results) || []).map(function (x) { return { id: x.id, item: x.item, dir: x.dir, stake: Number(x.stake) || 0, price: Number(x.price) || 0, day: x.day, ts: Number(x.ts) || 0 }; });
      }
      return json({ ok: true, focus: focus, items: items, bets: bets, balance: balance, day: todayStr(), updated: (items.length ? (await TST_DB.prepare('SELECT MAX(ts) AS t FROM mkt_price').first() || {}).t : 0) || 0 }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/market/bet' && request.method === 'POST') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    const nick = await webNick(request);
    if (!nick) return json({ ok: false, error: 'login_required' }, 401, request);
    if (!await ensureFeatureTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    const item = String(bd.item || '').trim().slice(0, 40);
    const dir = bd.dir === 'down' ? 'down' : (bd.dir === 'up' ? 'up' : '');
    const stake = Math.round(num(bd.stake) || 0);
    if (!item || !dir) return json({ ok: false, error: 'bad_params' }, 200, request);
    if (stake < 100) return json({ ok: false, error: 'stake_too_low' }, 200, request);
    try {
      const price = await TST_DB.prepare('SELECT buy FROM mkt_price WHERE item=?').bind(item).first();
      if (!price) return json({ ok: false, error: 'no_price' }, 200, request);
      const coin = await TST_DB.prepare('SELECT bal FROM mkt_coin WHERE mc=? COLLATE NOCASE').bind(nick).first();
      if (coin && (Number(coin.bal) || 0) < stake) return json({ ok: false, error: 'balance_low' }, 200, request);
      const day = todayStr();
      const dup = await TST_DB.prepare('SELECT id FROM mkt_bet WHERE mc=? COLLATE NOCASE AND item=? AND day=?').bind(nick, item, day).first();
      if (dup) return json({ ok: false, error: 'already_bet' }, 200, request);
      await TST_DB.prepare('INSERT INTO mkt_bet (mc,item,dir,stake,price,day,ts) VALUES (?,?,?,?,?,?,?)').bind(nick, item, dir, stake, Number(price.buy) || 0, day, tstNowS()).run();
      return json({ ok: true, item: item, dir: dir, stake: stake, price: Number(price.buy) || 0, day: day }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/treehole/list' && request.method === 'GET') {
    if (!TST_DB) return json({ ok: true, posts: [], liked: [] }, 200, request);
    if (!await ensureFeatureTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    const sort = url.searchParams.get('sort') === 'hot' ? 'hot' : 'new';
    const ip = clientIp(request);
    try {
      const rows = await TST_DB.prepare('SELECT id,content,likes,ts FROM th_post ORDER BY ' + (sort === 'hot' ? 'likes DESC, ts DESC' : 'ts DESC') + ' LIMIT 30').all();
      const mine = await TST_DB.prepare('SELECT pid FROM th_like WHERE ip=?').bind(ip).all();
      return json({ ok: true, posts: ((rows && rows.results) || []).map(function (r) { return { id: r.id, content: r.content, likes: Number(r.likes) || 0, ts: Number(r.ts) || 0 }; }), liked: ((mine && mine.results) || []).map(function (r) { return r.pid; }) }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/treehole/post' && request.method === 'POST') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    const nick = await webNick(request);
    if (!nick) return json({ ok: false, error: 'login_required' }, 401, request);
    if (!await ensureFeatureTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    const content = String(bd.content || '').trim().slice(0, 300);
    if (content.length < 2) return json({ ok: false, error: 'too_short' }, 200, request);
    const ip = clientIp(request);
    const rl = globalThis.__TST_TH_RL || (globalThis.__TST_TH_RL = new Map());
    const last = rl.get(ip) || 0;
    if (Date.now() - last < 60000) return json({ ok: false, error: 'too_fast' }, 200, request);
    try {
      const dayStart = Math.floor(Date.now() / 1000) - 86400;
      const c = await TST_DB.prepare('SELECT COUNT(*) AS n FROM th_post WHERE nick=? AND ts > ?').bind(nick, dayStart).first();
      if (Number((c && c.n) || 0) >= 5) return json({ ok: false, error: 'daily_limit' }, 200, request);
      rl.set(ip, Date.now());
      await TST_DB.prepare('INSERT INTO th_post (nick,content,likes,ts) VALUES (?,?,?,?)').bind(nick, content, 0, tstNowS()).run();
      return json({ ok: true }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/treehole/like' && request.method === 'POST') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    if (!await ensureFeatureTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    const pid = Math.round(num(bd.id) || 0);
    if (!pid) return json({ ok: false, error: 'bad_id' }, 200, request);
    const ip = clientIp(request);
    try {
      const had = await TST_DB.prepare('SELECT 1 AS x FROM th_like WHERE ip=? AND pid=?').bind(ip, pid).first();
      if (had) {
        await TST_DB.batch([
          TST_DB.prepare('DELETE FROM th_like WHERE ip=? AND pid=?').bind(ip, pid),
          TST_DB.prepare('UPDATE th_post SET likes=MAX(0,likes-1) WHERE id=?').bind(pid),
        ]);
        return json({ ok: true, liked: false }, 200, request);
      }
      await TST_DB.batch([
        TST_DB.prepare('INSERT INTO th_like (ip,pid) VALUES (?,?)').bind(ip, pid),
        TST_DB.prepare('UPDATE th_post SET likes=likes+1 WHERE id=?').bind(pid),
      ]);
      return json({ ok: true, liked: true }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/appeal/mine' && request.method === 'GET') {
    if (!TST_DB) return json([], 200, request);
    if (!await ensureFeatureTables(TST_DB)) return json([], 200, request);
    const nick = await webNick(request);
    if (!nick) return json([], 200, request);
    try {
      const rows = await TST_DB.prepare('SELECT id,content,ban_reason,status,reply,ts FROM appeals WHERE nick=? ORDER BY id DESC LIMIT 20').bind(nick).all();
      return json(((rows && rows.results) || []).map(function (r) { return { id: r.id, content: r.content, ban_reason: r.ban_reason || '', status: r.status || 'pending', reply: r.reply || '', ts: Number(r.ts) || 0 }; }), 200, request);
    } catch (e) { return json([], 200, request); }
  }

  if (path === '/api/appeal/submit' && request.method === 'POST') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    const nick = await webNick(request);
    if (!nick) return json({ ok: false, error: 'login_required' }, 401, request);
    if (!await ensureFeatureTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    const content = String(bd.content || '').trim().slice(0, 800);
    const reason = String(bd.ban_reason || '').trim().slice(0, 200);
    if (content.length < 10) return json({ ok: false, error: 'too_short' }, 200, request);
    try {
      const pend = await TST_DB.prepare('SELECT id FROM appeals WHERE nick=? AND status=?').bind(nick, 'pending').first();
      if (pend) return json({ ok: false, error: 'already_pending' }, 200, request);
      const c = await TST_DB.prepare('SELECT COUNT(*) AS n FROM appeals WHERE nick=? AND ts > ?').bind(nick, tstNowS() - 86400).first();
      if (Number((c && c.n) || 0) >= 3) return json({ ok: false, error: 'daily_limit' }, 200, request);
      await TST_DB.prepare('INSERT INTO appeals (nick,mc,content,ban_reason,status,reply,ts) VALUES (?,?,?,?,?,?,?)').bind(nick, nick, content, reason, 'pending', '', tstNowS()).run();
      return json({ ok: true }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/report/me' && request.method === 'GET') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    if (!await ensureFeatureTables(TST_DB)) return json({ ok: false, error: 'db_error' }, 200, request);
    const nick = await webNick(request);
    if (!nick) return json({ ok: false, error: 'login_required' }, 401, request);
    const ym = /^\d{4}-\d{2}$/.test(String(url.searchParams.get('ym') || '')) ? String(url.searchParams.get('ym')) : todayStr().slice(0, 7);
    try {
      const cur = await TST_DB.prepare('SELECT ym,mc,online_min,deaths,coins_in,coins_out,top_item,wealth_rank FROM rpt WHERE mc=? COLLATE NOCASE AND ym=?').bind(nick, ym).first();
      const his = await TST_DB.prepare('SELECT ym,online_min,deaths,coins_in,coins_out FROM rpt WHERE mc=? COLLATE NOCASE ORDER BY ym DESC LIMIT 12').bind(nick).all();
      return json({ ok: true, ym: ym, current: cur ? { ym: cur.ym, mc: cur.mc, online_min: Number(cur.online_min) || 0, deaths: Number(cur.deaths) || 0, coins_in: Number(cur.coins_in) || 0, coins_out: Number(cur.coins_out) || 0, top_item: cur.top_item || '', wealth_rank: Number(cur.wealth_rank) || 0 } : null, history: ((his && his.results) || []).map(function (r) { return { ym: r.ym, online_min: Number(r.online_min) || 0, deaths: Number(r.deaths) || 0, coins_in: Number(r.coins_in) || 0, coins_out: Number(r.coins_out) || 0 }; }) }, 200, request);
    } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
  }

  if (path === '/api/admin/luckperms') {
    if (!(await tstIsAdmin(request))) return json({ ok: false, error: 'forbidden' }, 403, request);
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    if (request.method === 'GET') {
      try {
        const row = await TST_DB.prepare('SELECT value FROM settings WHERE key=?').bind('luckperms_editor_url').first();
        if (!row || !row.value) return json({ ok: false, error: 'not_configured' }, 200, request);
        return json({ ok: true, url: row.value }, 200, request);
      } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
    }
    if (request.method === 'POST') {
      let bd = {};
      try { bd = await request.json(); } catch (e) { bd = {}; }
      const u = String(bd.url || '').trim();
      if (!/^https:\/\/luckperms\.net\/editor\/[A-Za-z0-9_-]+$/.test(u)) return json({ ok: false, error: 'bad_url' }, 400, request);
      try {
        await TST_DB.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)').run();
        await TST_DB.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').bind('luckperms_editor_url', u).run();
        return json({ ok: true }, 200, request);
      } catch (e) { return json({ ok: false, error: 'db_error' }, 200, request); }
    }
    return json({ ok: false, error: 'method_not_allowed' }, 405, request);
  }

  if (path === '/api/admin' || path.startsWith('/api/admin/')) {
    return proxyFetch(DATA_ORIGIN + '/api/admin' + url.search, request);
  }
  
  if (path === '/api/dadmin' && request.method === 'POST') {
    let bd = {};
    try { bd = await request.json(); } catch (e) { bd = {}; }
    const spwd = (context && context.env && context.env.SITE_ADMIN_PWD) || '';
    if (!spwd) return json({ ok: false, error: 'not_configured' }, 200, request);
    const auth = request.headers.get('Authorization') || '';
    const who = await fetch('https://theslowtidefk.pages.dev/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': auth },
      body: JSON.stringify({ action: 'whoami' }),
    }).then(r => r.json()).catch(() => ({ ok: false }));
    if (!(who && who.ok && (who.admin_level || 0) >= 1)) {
      return json({ ok: false, error: 'no_permission' }, 200, request);
    }
    const lr = await fetch(DATA_ORIGIN + '/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', password: spwd }),
    }).then(r => r.json()).catch(() => ({ ok: false }));
    if (!(lr && lr.token)) return json({ ok: false, error: 'site_unavailable' }, 200, request);
    const up = await fetch(DATA_ORIGIN + '/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + lr.token },
      body: JSON.stringify(bd),
    });
    const upText = await up.text();
    const rhead = { 'Content-Type': 'application/json', ...corsHeaders(request) };
    let upBody = null;
    try { upBody = JSON.parse(upText); } catch (e) { upBody = upText; }
    return new Response(JSON.stringify(upBody === null ? { ok: false, error: 'site_error' } : upBody), { status: 200, headers: rhead });
  }

  
  if (path.startsWith('/api/tools')) {
    if (canUseEdgeCache(request)) {
      const hit = await edgeGet(request);
      if (hit) return hit;
      return edgeStore(context, request, await proxyFetch('https://theslowtidefk.pages.dev' + path + url.search, request), 45);
    }
    return proxyFetch('https://theslowtidefk.pages.dev' + path + url.search, request);
  }

  
  if (path.startsWith('/api/posts')) {
    if (canUseEdgeCache(request)) {
      const hit = await edgeGet(request);
      if (hit) return hit;
      return edgeStore(context, request, await proxyFetch('https://theslowtidefk.pages.dev' + path + url.search, request), 20);
    }
    return proxyFetch('https://theslowtidefk.pages.dev' + path + url.search, request);
  }

  
  if (path.startsWith('/api/server-status') && canUseEdgeCache(request)) {
    const hit = await edgeGet(request);
    if (hit) return hit;
    return edgeStore(context, request, await proxyFetch('https://theslowtidefk.pages.dev' + path + url.search, request), 10);
  }
  if (path.startsWith('/api/chat') || path.startsWith('/api/server-status')) {
    return proxyFetch('https://theslowtidefk.pages.dev' + path + url.search, request);
  }

  
  if (path.startsWith('/api/auth/') || path.startsWith('/api/rest/')) {
    let p = path.slice('/api'.length);
    if (p.startsWith('/rest/') && !p.startsWith('/rest/v1/')) {
      p = '/rest/v1' + p.slice('/rest'.length);
    }
    const target = SUPABASE_URL + p + url.search;
    const headers = new Headers(request.headers);
    headers.delete('host');
    if (!headers.get('apikey')) headers.set('apikey', SUPABASE_ANON);
    if (!headers.get('authorization')) headers.set('authorization', 'Bearer ' + SUPABASE_ANON);
    let bd = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();
    if (request.method === 'POST' && path.includes('/activity_participants') && bd && bd.byteLength) {
      try {
        const obj = JSON.parse(new TextDecoder().decode(bd));
        const cfIp = request.headers.get('CF-Connecting-IP') || '';
        if (!obj.ip) obj.ip = cfIp;
        bd = new TextEncoder().encode(JSON.stringify(obj));
      } catch (e) {  }
    }
    const upstream = await fetch(target, { method: request.method, headers: headers, body: bd, redirect: 'manual' });
    const respHeaders = new Headers(upstream.headers);
    respHeaders.set('Access-Control-Allow-Origin', allowedOrigin(request) || 'https://theslowtide.pages.dev');
    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  }

  return new Response('Not found', { status: 404 });
}

