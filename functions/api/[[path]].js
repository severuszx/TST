// Cloudflare Pages Functions - The Slow Tide 官网 API 代理
// /api/auth/* -> Supabase Auth；/api/rest/* -> Supabase REST
// /api/data、/api/admin -> 转发到数据服务站点
// 国庆&开服100天双庆抽奖：/api/lottery/draw（后端加权随机+原子核销）、/api/lottery/state
// 每日限抽：设备指纹+IP（isolate 内存 Map，尽力方案）+ 兑换码原子核销兜底
// CORS 仅放行本站与反馈站

const SUPABASE_URL = 'https://jilcbcodphxpasicjghv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbGNiY29kcGh4cGFzaWNqZ2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDUzNTgsImV4cCI6MjEwNDE4MTM1OH0._DkyiWyL5viXByCJ5ejFifn9RuEVkVHjAnU4oQepsbs';
const DATA_ORIGIN = 'https://tst-server-site.pages.dev';
// 管理员口令：注意此文件在公开仓库，密码会随源码可见；后续需改为环境变量+数据库侧改密
const ADMIN_PWD = 'WYJQQNDYWHM';

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
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(request) });
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
    return proxyFetch(DATA_ORIGIN + '/api/data' + url.search, request);
  }
  if (path === '/api/admin' || path.startsWith('/api/admin/')) {
    return proxyFetch(DATA_ORIGIN + '/api/admin' + url.search, request);
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
