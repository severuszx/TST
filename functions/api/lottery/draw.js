// The Slow Tide 国庆&开服100天双庆抽奖 —— 抽奖端点（具体路由优先于 functions/api/[[path]].js）
const SUPABASE_URL = 'https://jilcbcodphxpasicjghv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbGNiY29kcGh4cGFzaWNqZ2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDUzNTgsImV4cCI6MjEwNDE4MTM1OH0._DkyiWyL5viXByCJ5ejFifn9RuEVkVHjAnU4oQepsbs';
// 管理员口令：注意公开仓库可见，后续需改为环境变量并在数据库侧改密
const ADMIN_PWD = 'WYJQQNDYWHM';
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

export async function onRequestPost(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') return json({}, 204, request);
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
    // 原子核销：把奖品标记为【已使用】+原名（防止并发重复发放；重试刷新池）
    const res = await adminLottery('update_prize', { id: String(c.id), prize: '【已使用】' + (c.prize || '') });
    if (res && res.ok) { picked = c; break; }
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
