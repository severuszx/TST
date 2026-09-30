// The Slow Tide 国庆&开服100天双庆抽奖 —— 抽奖端点（具体路由优先于 functions/api/[[path]].js）
const SUPABASE_URL = 'https://jilcbcodphxpasicjghv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbGNiY29kcGh4cGFzaWNqZ2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDUzNTgsImV4cCI6MjEwNDE4MTM1OH0._DkyiWyL5viXByCJ5ejFifn9RuEVkVHjAnU4oQepsbs';
// 管理员口令：注意公开仓库可见，后续需改为环境变量并在数据库侧改密
// 管理员口令：优先读环境变量 ADMIN_PWD（Cloudflare Pages Secret），未配置时回退内置
const ADMIN_PWD = (typeof context !== 'undefined' && context.env && context.env.ADMIN_PWD) ? context.env.ADMIN_PWD : 'WYJQQNDYWHM';
const L_START = new Date('2026-10-01T00:30:00+08:00');
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
  // 经同域代理 /api/rest/rpc/admin_lottery 调用（CF 环境直连 Supabase 偶发空响应，代理已验证稳定）
  const r = await fetch('https://theslowtide.pages.dev/api/rest/rpc/admin_lottery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_pwd: ADMIN_PWD, p_action: action, p_payload: payload || {} }),
  });
  const text = await r.text();
  try { return text ? JSON.parse(text) : null; } catch (e) { return { raw: text.slice(0, 160) }; }
}
async function fetchUnclaimedCodes() {
  const res = await adminLottery('list', {});
  if (!res || !res.ok || !Array.isArray(res.codes)) return null;
  return res.codes.filter(c => !String(c.code || '').startsWith('DC:') && c.code !== '08952870' && !c.claimed && !String(c.prize || '').startsWith('【已使用】'));
}
function clientIp(req) {
  return req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown';
}
function json(obj, status, req) {
  const origin = req.headers.get('Origin') || '';
  const ok = ['https://theslowtide.pages.dev', 'https://theslowtidefk.pages.dev', 'http://localhost', 'http://127.0.0.1', 'null'];
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ok.includes(origin) ? origin : 'https://theslowtide.pages.dev',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const now = new Date();
  const sdate = cnDate(now);
  const ip = clientIp(request);
  const device = String(url.searchParams.get('device') || '').slice(0, 80);
  const ua = String(request.headers.get('User-Agent') || '');
  const secUa = String(request.headers.get('Sec-CH-UA-Platform') || request.headers.get('Sec-CH-UA') || '');
  const rawFp = ip + '|' + ua + '|' + secUa + '|' + device;
  let fp = 5381;
  for (let i = 0; i < rawFp.length; i++) { fp = ((fp << 5) + fp + rawFp.charCodeAt(i)) >>> 0; }
  const fkey = 'DC:' + fp + ':' + sdate;
  const dkey = 'DC:dev:' + device + ':' + sdate;
  const list = await adminLottery('list', {});
  let rec = null;
  if (list && list.ok && Array.isArray(list.codes)) {
    rec = list.codes.find(c => c.code === fkey || c.code === dkey) || null;
  }
  const codes = await fetchUnclaimedCodes();
  return json({
    sv: 'state-file',
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
