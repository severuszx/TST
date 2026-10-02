// The Slow Tide 国庆&开服100天双庆抽奖 —— 抽奖端点（具体路由优先于 functions/api/[[path]].js）
const SUPABASE_URL = 'https://jilcbcodphxpasicjghv.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbGNiY29kcGh4cGFzaWNqZ2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDUzNTgsImV4cCI6MjEwNDE4MTM1OH0._DkyiWyL5viXByCJ5ejFifn9RuEVkVHjAnU4oQepsbs';
// 管理员口令：注意公开仓库可见，后续需改为环境变量并在数据库侧改密
// 管理员口令：优先读环境变量 ADMIN_PWD（Cloudflare Pages Secret），未配置时回退内置
let ADMIN_PWD = null; // 管理员口令：仅由 onRequest 从环境变量 ADMIN_PWD 注入（仓库不含口令）
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
  if (!ADMIN_PWD) return { ok: false, error: 'no_pwd' };
  if (!ADMIN_PWD) return { ok: false, error: 'no_pwd' };
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
  return res.codes.filter(c => !String(c.code || '').startsWith('DC') && !String(c.prize || '').includes('神秘礼包') && !c.claimed && !String(c.prize || '').startsWith('【已使用】'));
}

async function drawGate(fp, device, ip, sdate) {
  const list = await adminLottery('list', {});
  if (!list || !list.ok || !Array.isArray(list.codes)) return { err: 'server_error' };
  const fkey = 'DC:' + fp + ':' + sdate;
  const dkey = 'DC:dev:' + device + ':' + sdate;
  const ikey = 'DCIP:' + ip + ':' + sdate;
  const row = list.codes.find(c => c.code === fkey || c.code === dkey || c.code === ikey);
  if (row) return { existing: row };
  // IP 闸门：每 IP 每天一次（防换浏览器/清 Cookie 绕过；唯一约束原子防并发）
  const addIp = await adminLottery('add', { code: ikey, prize: 'IP抽奖标记', weight: 0 });
  if (addIp && addIp.error === 'code_exists') return { existing: { prize: 'IP抽奖标记' } };
  if (!addIp || !addIp.ok) return { err: 'server_error' };
  // 设备指纹闸门：同设备防重复
  const addF = await adminLottery('add', { code: fkey, prize: '设备抽奖标记', weight: 0 });
  if (addF && addF.error === 'code_exists') return { existing: { prize: '设备抽奖标记' } };
  if (!addF || !addF.ok) return { err: 'server_error' };
  return { fresh: true };
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
  if (context && context.env && context.env.ADMIN_PWD) ADMIN_PWD = context.env.ADMIN_PWD;
  if (context && context.env && context.env.ADMIN_PWD) ADMIN_PWD = context.env.ADMIN_PWD;
  const { request } = context;
  if (request.method === 'OPTIONS') return json({}, 204, request);
  const now = new Date();
  const sdate = cnDate(now);
  if (now < L_START || now > L_END) {
    return json({ sv: 'draw-file', ok: false, error: 'not_in_window', serverDate: sdate }, 200, request);
  }
  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }
  const device = String(body.p_device || '').slice(0, 80);
  if (!device) return json({ ok: false, error: 'bad_device', serverDate: sdate }, 200, request);
  const ip = clientIp(request);
  // 服务端指纹：IP+UA+平台头+前端指纹 组合（防单点伪造；NAT 同 IP 不同设备不互锁）
  const ua = String(request.headers.get('User-Agent') || '');
  const secUa = String(request.headers.get('Sec-CH-UA-Platform') || request.headers.get('Sec-CH-UA') || '');
  const rawFp = ip + '|' + ua + '|' + secUa + '|' + device;
  let fp = 5381;
  for (let i = 0; i < rawFp.length; i++) { fp = ((fp << 5) + fp + rawFp.charCodeAt(i)) >>> 0; }
  const fkey = 'DC:' + fp + ':' + sdate;
  const dkey = 'DC:dev:' + device + ':' + sdate;
  const gate = await drawGate(fp, device, ip, sdate);
  if (gate && gate.existing) {
    // 防泄露：existing 是闸门标记行（prize 含「标记」/code 为 DCIP: 或 DC:）时，
    // 绝不把标记信息（含玩家 IP）回给前端，统一返回已抽过。
    const exP = String(gate.existing.prize || '');
    const exC = String(gate.existing.code || '');
    const isMarker = exP.indexOf('标记') >= 0 || exC.indexOf('DCIP:') === 0 || exC.indexOf('DC:') === 0;
    if (isMarker) {
      return json({ ok: false, error: 'already_drawn', serverDate: sdate }, 200, request);
    }
    return json({ ok: false, error: 'already_drawn', prize: gate.existing.prize, code: gate.existing.code, seq: gate.existing.seq, serverDate: sdate }, 200, request);
  }
  if (gate && gate.err) {
    return json({ ok: false, error: gate.err, serverDate: sdate }, 200, request);
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
  DRAW_IP_MAP.set(fkey, recInfo);
  return json({ ok: true, ...recInfo, serverDate: sdate }, 200, request);
}
