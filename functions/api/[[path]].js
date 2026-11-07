// Cloudflare Pages Functions - The Slow Tide 官网 API 代理
// /api/auth/* -> Supabase Auth；/api/rest/* -> Supabase REST
// /api/data、/api/admin -> 转发到数据服务站点
// 国庆&开服100天双庆抽奖：/api/lottery/draw（后端加权随机+原子核销）、/api/lottery/state
// 每日限抽：设备指纹+IP（isolate 内存 Map，尽力方案）+ 兑换码原子核销兜底
// CORS 仅放行本站与反馈站

const SUPABASE_URL = 'https://jilcbcodphxpasicjghv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbGNiY29kcGh4cGFzaWNqZ2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDUzNTgsImV4cCI6MjEwNDE4MTM1OH0._DkyiWyL5viXByCJ5ejFifn9RuEVkVHjAnU4oQepsbs';
const DATA_ORIGIN = 'https://tst-server-site.pages.dev';
// Java 服（the slow tide）状态：插件每 180 秒 POST 一次，这里只做接收与缓存，不主动连服务器
const TST_TOKEN = '0e18fe94d4f9259cb0eb3f59c44f6984a8a280ad399b1fb7';
const TST_KEY = 'tst_status_v1';
const TST_STALE_MS = 420000; // 上报间隔 180 秒，连续 7 分钟没消息才判离线（留两轮容错）
function tstMemSet(rec) { try { globalThis.__TST_STATUS_REC = rec; } catch (e) { /* 忽略 */ } }
function tstMemGet() { try { return globalThis.__TST_STATUS_REC || null; } catch (e) { return null; } }
// 管理员口令：注意此文件在公开仓库，密码会随源码可见；后续需改为环境变量+数据库侧改密
let ADMIN_PWD = null; // 管理员口令：仅由 onRequest 从环境变量 ADMIN_PWD 注入（仓库不含口令）
// ===== 调试台验证（同源；前端优先调用，兜底反馈站）=====
const DEBUG_CODES = { 'TST-G4N7QX': 'bench3d', K3M9X7: 'glass', X2W5V8: 'light', Q8N4R2: 'desktop', M7Z1P6: 'mobile', H6D3B9: 'perf', F5J8C4: 'dev', R2T7W1: 'reset', 'TST-7KQ2WP': 'chat' };

// ===== 国庆&开服100天双庆抽奖（时区：北京时间 UTC+8）=====
const L_START = new Date('2026-10-01T00:00:00+08:00');  // 2026-10-01 00:00 正式开放
const L_END = new Date('2026-10-08T23:59:59+08:00');    // 2026-10-08 23:59:59 结束
const DRAW_DEV_MAP = new Map();  // dev:<device>:<cnDate> -> {prize,code,seq}
const DRAW_IP_MAP = new Map();   // ip:<ip>:<cnDate> -> {prize,code,seq}

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
// 核销：把奖品名标记为【已使用】+原名（数据库侧无 claimed 更新通道，用 prize 前缀做已使用标记；
// 后台管理员列表会显示【已使用】提示，仍可 delete 删除）
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

export async function onRequest(context) {
  if (context && context.env && context.env.ADMIN_PWD) ADMIN_PWD = context.env.ADMIN_PWD;
  if (context && context.env && context.env.ADMIN_PWD) ADMIN_PWD = context.env.ADMIN_PWD;
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(request) });
  }
  // ===== 调试台验证（同源，减少对反馈站域名的依赖）=====
  if (path === '/api/debug/verify' && request.method === 'POST') {
    let bd = {};
    try { bd = await request.json(); } catch (e) { bd = {}; }
    const code = String(bd.code || '').trim().toUpperCase();
    const feat = DEBUG_CODES[code];
    if (feat) return json({ ok: true, feature: feat }, 200, request);
    return json({ ok: false, error: 'bad_code' }, 200, request);
  }

  // ===== Java 服 · the slow tide：状态推送与查询（插件只出站 POST，不占任何端口）=====
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
    try {
      const tstKv = (context && context.env && context.env.SITE_CACHE) || null;
      if (tstKv) await tstKv.put(TST_KEY, JSON.stringify(rec), { expirationTtl: 3600 });
      else tstMemSet(rec);
    } catch (e) {
      tstMemSet(rec);
      return json({ ok: false, error: 'kv_unavailable', receivedAt: rec.receivedAt }, 200, request);
    }
    // 同时写入 D1（性能历史 / 游戏内聊天 / 事件 / 日志 / 指令结果）
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
        // 老数据清理（插件每小时带 cleanup=true 触发一次）
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

  // ===== Java 服 · 聊天 / 指令队列 / 性能 / 日志（D1: TST_DB）=====
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

  // 游戏内聊天记录
  if (path === '/api/chat/history' && request.method === 'GET') {
    if (!TST_DB) return json({ ok: false, error: 'no_db', messages: [] }, 200, request);
    const after = Number(url.searchParams.get('after') || 0) || 0;
    let rows = [];
    try {
      const q = after
        ? TST_DB.prepare('SELECT id,ts,src,name,msg FROM chat WHERE id>? ORDER BY id ASC LIMIT 60').bind(after)
        : TST_DB.prepare('SELECT id,ts,src,name,msg FROM chat ORDER BY id DESC LIMIT 40');
      const r = await q.all();
      rows = (r && r.results) || [];
      if (!after) rows = rows.slice().reverse();
    } catch (e) {
      return json({ ok: false, error: 'db_error', messages: [] }, 200, request);
    }
    const messages = rows.map(function (x) {
      return { id: x.id, ts: new Date((x.ts || 0) * 1000).toISOString(), sender: x.name, message: x.msg, kind: x.src === 'web' ? 'web' : 'game' };
    });
    return json({ ok: true, messages: messages }, 200, request);
  }

  // 官网发言 → 写入聊天记录 + 指令队列
  if (path === '/api/chat/send' && request.method === 'POST') {
    if (!TST_DB) return json({ ok: false, error: 'no_db' }, 200, request);
    let bd = {};
    try { bd = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400, request); }
    const msg = String(bd.message || '').trim().slice(0, 200);
    const sender = String(bd.sender || '官网').trim().slice(0, 24) || '官网';
    if (!msg) return json({ ok: false, error: 'empty' }, 200, request);
    const rl = globalThis.__TST_CHAT_RL || (globalThis.__TST_CHAT_RL = new Map());
    const ip = clientIp(request);
    const last = rl.get(ip) || 0;
    if (Date.now() - last < 8000) return json({ ok: false, error: 'too_fast' }, 429, request);
    rl.set(ip, Date.now());
    try {
      const now = tstNowS();
      await TST_DB.batch([
        TST_DB.prepare('INSERT INTO chat (ts,src,name,msg) VALUES (?,?,?,?)').bind(now, 'web', sender, msg),
        TST_DB.prepare('INSERT INTO outbox (ts,kind,payload,state) VALUES (?,?,?,0)').bind(now, 'chat', JSON.stringify({ name: sender, msg: msg })),
      ]);
    } catch (e) {
      return json({ ok: false, error: 'db_error' }, 200, request);
    }
    return json({ ok: true }, 200, request);
  }

  // 官网管理员指令下发（聊天室里的那个按钮）
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

  // 管理员控制台接口（带登录态）
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

  // 插件拉取待执行任务（聊天广播 / 指令）
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
    // fmt=line：给插件用的纯文本协议（避免在 Java 里写 JSON 解析）
    if (String(url.searchParams.get('fmt') || '') === 'line') {
      const b64 = function (s) { return btoa(unescape(encodeURIComponent(String(s == null ? '' : s)))); };
      const lines = tasks.map(function (t) {
        if (t.kind === 'chat') return t.id + '\tchat\t' + b64(t.data.name || '官网') + '\t' + b64(t.data.msg || '');
        return t.id + '\tcmd\t' + b64(t.data.cmd || '') + '\t' + b64(t.data.by || 'admin');
      });
      return new Response(lines.join('\n'), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': allowedOrigin(request) || 'https://theslowtide.pages.dev' },
      });
    }
    return json({ ok: true, tasks: tasks }, 200, request);
  }

  // 性能历史（24h 折线）
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

  // 服务器日志（仅管理员）
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

  // 游戏动态（进出/死亡/成就/指令记录）
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

  // 服务器状态（老聊天室的在线状态条复用）
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
    return json({ ok: true, status: on ? 'online' : 'offline', online: on ? st.online : 0, max: st.max, tps: st.tps, latency: 0, ts: new Date(st.receivedAt || Date.now()).toISOString() }, 200, request);
  }

  // ===== 抽奖状态查询（含开放状态/剩余码数/今日已抽）=====
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

  // ===== 国庆&开服100天抽奖（后端加权随机 + 原子核销 + 每日限抽）=====
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
    // 读未认领码池
    let codes = await fetchUnclaimedCodes();
    if (!codes || codes.length === 0) {
      return json({ ok: false, error: 'sold_out', serverDate: sdate }, 200, request);
    }
    // 加权随机 + 原子核销（并发下重试）
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

  // 数据/管理接口：转发到数据服务站点
  if (path === '/api/data' || path.startsWith('/api/data/')) {
    const kv = (context && context.env && context.env.SITE_CACHE) || null;
    if (kv) {
      try {
        const cached = await kv.get('site_data_v1');
        if (cached) {
          return new Response(cached, { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigin(request) || 'https://theslowtide.pages.dev', 'Cache-Control': 'public, max-age=300, s-maxage=300', 'CDN-Cache-Control': 'public, max-age=300' } });
        }
      } catch (e) { /* KV 不可用则回源 */ }
    }
    const upstream = await proxyFetch(DATA_ORIGIN + '/api/data' + url.search, request);
    // 瘦身：剥离动态内嵌 base64 大图（如 1MB 截图），单条内容截断，避免 1.9MB 拖垮主线程
    let slimText = null;
    try {
      const raw = await upstream.clone().text();
      const obj = JSON.parse(raw);
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
        slimText = JSON.stringify(obj);
      }
    } catch (e) { /* 解析失败则原样返回 */ }
    if (slimText === null) slimText = await upstream.text();
    if (kv) {
      try { await kv.put('site_data_v1', slimText, { expirationTtl: 300 }); } catch (e) { /* 写缓存失败不影响响应 */ }
    }
    return new Response(slimText, { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allowedOrigin(request) || 'https://theslowtide.pages.dev', 'Cache-Control': 'public, max-age=300, s-maxage=300', 'CDN-Cache-Control': 'public, max-age=300' } });
  }
  if (path === '/api/admin' || path.startsWith('/api/admin/')) {
    return proxyFetch(DATA_ORIGIN + '/api/admin' + url.search, request);
  }
  // 数据站管理鉴权中介：官网 token 校验（经 TSTFK whoami）+ 服务器端带数据站口令转发，前端全程不接触数据站密码
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

  // 服务器工具（禁用物品/任务）转发到数据服务站点（反馈站 TSTFK 的 D1）
  if (path.startsWith('/api/tools')) {
    return proxyFetch('https://theslowtidefk.pages.dev' + path + url.search, request);
  }

  // 玩家自由发帖（内测·卡密）转发到 TSTFK
  if (path.startsWith('/api/posts')) {
    return proxyFetch('https://theslowtidefk.pages.dev' + path + url.search, request);
  }

  // 聊天桥 + 服务器状态转发到 TSTFK
  if (path.startsWith('/api/chat') || path.startsWith('/api/server-status')) {
    return proxyFetch('https://theslowtidefk.pages.dev' + path + url.search, request);
  }

  // 仅代理 /api/auth/* 与 /api/rest/*（含 draw_lottery 兼容转发）
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
      } catch (e) { /* 非 JSON 原样转发 */ }
    }
    const upstream = await fetch(target, { method: request.method, headers: headers, body: bd, redirect: 'manual' });
    const respHeaders = new Headers(upstream.headers);
    respHeaders.set('Access-Control-Allow-Origin', allowedOrigin(request) || 'https://theslowtide.pages.dev');
    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  }

  return new Response('Not found', { status: 404 });
}

